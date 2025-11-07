import json
import boto3
import gzip
import re
import time
from datetime import datetime
from io import BytesIO

s3 = boto3.client('s3')
logs = boto3.client('logs')

LOG_GROUP_NAME = '/aws/alb/flash-ticket'
LOG_STREAM_NAME = 'alb-access-logs'

def parse_alb_log(line):
    """
    ALB Access Log 라인을 구조화된 JSON으로 파싱
    상태 코드와 응답 시간을 별도 필드로 추출하여 CloudWatch Logs에서 필터링 가능하게 함
    
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
                        # 총 응답 시간을 밀리초로 변환
                        response_time = (request_time + target_time + response_time_seconds) * 1000

                        # 각 단계별 시간도 저장 (상세 분석용)
                        request_processing_time = request_time * 1000
                        target_processing_time = target_time * 1000
                        response_processing_time = response_time_seconds * 1000
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
