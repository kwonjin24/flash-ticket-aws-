import json
import boto3
import gzip
import re
import time
from datetime import datetime
from io import BytesIO
from urllib.parse import urlparse

s3 = boto3.client('s3')
logs = boto3.client('logs')

LOG_GROUP_NAME = '/aws/alb/flash-ticket'
LOG_STREAM_NAME = 'alb-access-logs'

def parse_alb_log(line):
    """
    ALB Access Log 라인을 구조화된 JSON으로 파싱
    상태 코드와 응답 시간을 별도 필드로 추출하여 CloudWatch Logs에서 필터링 가능하게 함
    서비스 구분을 위해 request path를 파싱하여 service 필드 추가

    ALB 로그 필드 인덱스 (0-based):
    0: type (http/https/h2/wss)
    1: time (ISO 8601 timestamp)
    2: elb (ALB resource ID)
    3: client:port
    4: target:port
    5: request_processing_time (초)
    6: target_processing_time (초)
    7: response_processing_time (초)
    8: elb_status_code (상태 코드)
    9: target_status_code (대상 상태 코드)
    10-11: bytes_sent, user_agent (생략)
    12: request ("GET /path HTTP/1.1" 형식)
    """
    try:
        # 기본 필드 추출
        parts = line.split(None, 2)
        if len(parts) < 3:
            return None

        log_type = parts[0]
        log_time = parts[1]
        rest = parts[2]

        # 타임스탬프 변환
        try:
            dt = datetime.fromisoformat(log_time.replace('Z', '+00:00'))
            timestamp_ms = int(dt.timestamp() * 1000)
        except:
            timestamp_ms = int(time.time() * 1000)

        # 상태 코드 및 응답 시간 추출
        status_code = None
        target_status_code = None
        response_time = None
        request_processing_time = None
        target_processing_time = None
        response_processing_time = None
        service = "unknown"
        request_path = None
        http_method = None

        try:
            # 공백으로 구분된 필드들을 파싱
            fields = line.split()

            # 상태 코드 추출 (인덱스 8: elb_status_code)
            if len(fields) > 8:
                try:
                    status_code = int(fields[8])
                except (ValueError, IndexError):
                    pass

            # 대상 상태 코드 추출 (인덱스 9: target_status_code)
            if len(fields) > 9:
                try:
                    target_status_code = int(fields[9])
                except (ValueError, IndexError):
                    pass

            # 응답 시간 추출 (총 응답 시간 = 모든 처리 단계의 합)
            # 인덱스 5, 6, 7: 각 처리 단계의 시간 (초 단위)
            if len(fields) > 7:
                try:
                    request_time = float(fields[5])          # 요청 처리 시간
                    target_time = float(fields[6])           # 대상 처리 시간
                    response_time_seconds = float(fields[7]) # 응답 처리 시간

                    # -1은 타겟에 연결되지 않은 요청 (크롤러, 404 등)을 의미함
                    # 이 경우 응답 시간은 null로 설정
                    if request_time == -1 or target_time == -1 or response_time_seconds == -1:
                        response_time = None
                    else:
                        # 총 응답 시간을 밀리초로 변환 (정수로 반올림하여 부동소수점 오차 제거)
                        response_time = round((request_time + target_time + response_time_seconds) * 1000)

                        # 각 단계별 시간도 저장 (상세 분석용)
                        request_processing_time = round(request_time * 1000)
                        target_processing_time = round(target_time * 1000)
                        response_processing_time = round(response_time_seconds * 1000)
                except (ValueError, IndexError):
                    pass

            # 요청 경로에서 서비스 구분
            # ALB 로그의 request 필드는 따옴표로 감싸져 있음
            # 예시: "GET https://gateway.highgarden.cloud:443/queue/status HTTP/1.1"
            # 또는: "GET /orders HTTP/1.1"
            # 정규표현식으로 직접 추출 (user-agent에 공백이 있어서 split 위치가 가변적)
            try:
                # 따옴표로 감싸진 request 필드 전체 추출
                import re as regex
                request_match = regex.search(r'"((?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+[^\s]+\s+HTTP[^"]*)"', line)
                if request_match:
                    request_line = request_match.group(1)  # 예: "GET https://gateway.highgarden.cloud:443/queue/status HTTP/1.1"

                    # 메서드와 경로를 공백으로 분리 (처음 2개만 관심)
                    parts = request_line.split(None, 2)  # [메서드, 경로, HTTP버전...]
                    if len(parts) >= 2:
                        http_method = parts[0]  # GET, POST, etc.
                        raw_path = parts[1]     # /orders 또는 https://gateway.highgarden.cloud:443/queue/status

                        # URL 형식이면 경로만 추출
                        if raw_path.startswith('http://') or raw_path.startswith('https://'):
                            # https://gateway.highgarden.cloud:443/queue/status?query=param → /queue/status
                            parsed_url = urlparse(raw_path)
                            request_path = parsed_url.path if parsed_url.path else '/'
                        else:
                            # /queue/status?query=param → /queue/status
                            request_path = raw_path.split('?')[0] if '?' in raw_path else raw_path

                        # 경로 기반 서비스 구분 로직
                        # API 도메인에서 오는 요청 (api.highgarden.cloud)
                        # 실제 요청 경로: /payments, /orders, /events 등 (프리픽스 없음)
                        if 'payment' in request_path or 'pay' in request_path:
                            service = "flash-api-payment"
                        elif 'order' in request_path:
                            service = "flash-api-order"
                        elif request_path.startswith('/api/'):
                            # /api/* 형식의 API 엔드포인트
                            if 'payment' in request_path or 'pay' in request_path:
                                service = "flash-api-payment"
                            elif 'order' in request_path:
                                service = "flash-api-order"
                            else:
                                service = "flash-api"
                        elif request_path.startswith('/events'):
                            # /events는 API 서비스
                            service = "flash-api"
                        elif request_path.startswith('/queue'):
                            service = "flash-gateway-queue"
                        elif request_path.startswith('/orders'):
                            service = "flash-gateway-orders"
                        elif request_path.startswith('/products'):
                            service = "flash-gateway-products"
                        elif request_path.startswith('/'):
                            service = "flash-gateway"
                        else:
                            service = "unknown"
            except (ValueError, IndexError):
                pass
        except:
            pass

        # 구조화된 JSON 저장
        parsed = {
            'type': log_type,
            'time': log_time,
            'status_code': status_code,
            'target_status_code': target_status_code,
            'response_time_ms': response_time,  # 총 응답 시간 (밀리초)
            'request_processing_time_ms': request_processing_time,
            'target_processing_time_ms': target_processing_time,
            'response_processing_time_ms': response_processing_time,
            'service': service,  # 서비스 구분 필드 (flash-gateway, flash-api, etc.)
            'request_path': request_path,  # 요청 경로
            'http_method': http_method,  # HTTP 메서드 (GET, POST, etc.)
            'raw_message': line,
            'timestamp_ms': timestamp_ms
        }

        return parsed
    except Exception as e:
        print(f"Error parsing log line: {str(e)}")
        return None

def lambda_handler(event, context):
    """
    S3 이벤트로부터 ALB 로그 파일을 읽어 CloudWatch Logs로 전송 (구조화된 JSON)
    """
    try:
        # S3 이벤트 파싱
        bucket = event['Records'][0]['s3']['bucket']['name']
        key = event['Records'][0]['s3']['object']['key']

        print(f"Processing S3 object: s3://{bucket}/{key}")

        # Log Stream 생성 (존재하지 않으면)
        try:
            logs.create_log_stream(
                logGroupName=LOG_GROUP_NAME,
                logStreamName=LOG_STREAM_NAME
            )
        except logs.exceptions.ResourceAlreadyExistsException:
            pass

        # S3에서 파일 다운로드
        response = s3.get_object(Bucket=bucket, Key=key)

        # gzip 파일 해제
        with gzip.GzipFile(fileobj=BytesIO(response['Body'].read())) as gzipfile:
            content = gzipfile.read().decode('utf-8')

        # ALB 로그 파싱 및 저장
        log_events = []
        for line in content.strip().split('\n'):
            if not line or line.startswith('#'):
                continue

            parsed = parse_alb_log(line)
            if parsed:
                # 크롤러/봇 요청 필터링: response_time_ms가 null이면 ALB에서 차단된 요청
                # (실제 target에 도달하지 않은 요청)
                if parsed['response_time_ms'] is None:
                    continue

                log_events.append({
                    'timestamp': parsed['timestamp_ms'],
                    'message': json.dumps(parsed, ensure_ascii=False)
                })

        # CloudWatch Logs에 업로드
        if log_events:
            # 타임스탬프 기준 정렬 (CloudWatch 요구사항)
            log_events.sort(key=lambda x: x['timestamp'])

            logs.put_log_events(
                logGroupName=LOG_GROUP_NAME,
                logStreamName=LOG_STREAM_NAME,
                logEvents=log_events
            )

            print(f"Successfully uploaded {len(log_events)} log events")

        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Successfully processed ALB logs',
                'bucket': bucket,
                'key': key,
                'events_count': len(log_events)
            })
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
