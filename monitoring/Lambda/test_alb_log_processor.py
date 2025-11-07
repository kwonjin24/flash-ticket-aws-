import json
import unittest
import sys
from datetime import datetime

# Lambda 파일 동적 로드 (하이픈이 있어서 import 불가능하므로)
import importlib.util
spec = importlib.util.spec_from_file_location("alb_log_processor", "alb-log-processor.py")
alb_log_processor = importlib.util.module_from_spec(spec)
sys.modules["alb_log_processor"] = alb_log_processor
spec.loader.exec_module(alb_log_processor)

parse_alb_log = alb_log_processor.parse_alb_log


class TestALBLogProcessor(unittest.TestCase):
    """
    ALB 로그 파서 테스트
    서비스 구분 기능이 제대로 작동하는지 검증
    """

    # 실제 ALB 로그 샘플 (서비스별)
    ALB_LOG_GATEWAY = 'http 2025-11-07T10:30:45.123456Z arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:loadbalancer/app/flash-ticket-alb/1234567890abcdef 203.0.113.1:54321 10.0.1.100:3000 0.000 0.023 0.000 200 200 34 156 "GET /orders HTTP/1.1" "Mozilla/5.0" "-" "-" arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-gateway/abcd1234 "Root=1-6549c8b7-abcd1234ef567890" "-" "arn:aws:acm:ap-northeast-2:339712948064:certificate/12345678-1234-1234-1234-123456789012" 0 2025-11-07T10:30:45.123456Z "http" "TLSv1.2" "ECDHE-RSA-AES128-GCM-SHA256" "arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-gateway/abcd1234" "Normal" "-" "-"'

    ALB_LOG_API_PAYMENT = 'http 2025-11-07T10:30:45.234567Z arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:loadbalancer/app/flash-ticket-alb/1234567890abcdef 203.0.113.2:54322 10.0.2.100:4000 0.001 0.156 0.000 200 200 145 289 "POST /api/payments HTTP/1.1" "Mozilla/5.0" "-" "-" arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-api/efgh5678 "Root=1-6549c8b7-efgh5678ij901234" "-" "arn:aws:acm:ap-northeast-2:339712948064:certificate/12345678-1234-1234-1234-123456789012" 0 2025-11-07T10:30:45.234567Z "http" "TLSv1.2" "ECDHE-RSA-AES128-GCM-SHA256" "arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-api/efgh5678" "Normal" "-" "-"'

    ALB_LOG_API_ORDER = 'http 2025-11-07T10:30:45.345678Z arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:loadbalancer/app/flash-ticket-alb/1234567890abcdef 203.0.113.3:54323 10.0.2.100:4000 0.000 0.089 0.000 200 200 156 267 "GET /api/orders/123 HTTP/1.1" "Mozilla/5.0" "-" "-" arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-api/efgh5678 "Root=1-6549c8b7-ijkl9012mn345678" "-" "arn:aws:acm:ap-northeast-2:339712948064:certificate/12345678-1234-1234-1234-123456789012" 0 2025-11-07T10:30:45.345678Z "http" "TLSv1.2" "ECDHE-RSA-AES128-GCM-SHA256" "arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-api/efgh5678" "Normal" "-" "-"'

    ALB_LOG_PAY = 'http 2025-11-07T10:30:45.456789Z arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:loadbalancer/app/flash-ticket-alb/1234567890abcdef 203.0.113.4:54324 10.0.3.100:3100 0.002 0.234 0.000 200 200 267 345 "POST /api/pay HTTP/1.1" "Mozilla/5.0" "-" "-" arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-pay/ijkl9012 "Root=1-6549c8b7-opqr1234st567890" "-" "arn:aws:acm:ap-northeast-2:339712948064:certificate/12345678-1234-1234-1234-123456789012" 0 2025-11-07T10:30:45.456789Z "http" "TLSv1.2" "ECDHE-RSA-AES128-GCM-SHA256" "arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-pay/ijkl9012" "Normal" "-" "-"'

    ALB_LOG_GATEWAY_PRODUCTS = 'http 2025-11-07T10:30:45.567890Z arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:loadbalancer/app/flash-ticket-alb/1234567890abcdef 203.0.113.5:54325 10.0.1.100:3000 0.000 0.045 0.000 200 200 89 234 "GET /products HTTP/1.1" "Mozilla/5.0" "-" "-" arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-gateway/abcd1234 "Root=1-6549c8b7-uvwx5678yz901234" "-" "arn:aws:acm:ap-northeast-2:339712948064:certificate/12345678-1234-1234-1234-123456789012" 0 2025-11-07T10:30:45.567890Z "http" "TLSv1.2" "ECDHE-RSA-AES128-GCM-SHA256" "arn:aws:elasticloadbalancing:ap-northeast-2:339712948064:targetgroup/flash-gateway/abcd1234" "Normal" "-" "-"'

    def test_gateway_service_detection(self):
        """Gateway Orders 서비스 요청 파싱 테스트"""
        parsed = parse_alb_log(self.ALB_LOG_GATEWAY)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['service'], 'flash-gateway-orders')  # /orders 경로는 gateway-orders
        self.assertEqual(parsed['request_path'], '/orders')
        self.assertEqual(parsed['http_method'], 'GET')
        self.assertEqual(parsed['status_code'], 200)
        self.assertEqual(parsed['response_time_ms'], 23)  # 0.000 + 0.023 + 0.000 = 0.023초 = 23ms
        print(f"✅ Gateway Orders 테스트 통과: {parsed['service']}")

    def test_api_payment_service_detection(self):
        """API Payment 서비스 요청 파싱 테스트"""
        parsed = parse_alb_log(self.ALB_LOG_API_PAYMENT)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['service'], 'flash-api-payment')
        self.assertEqual(parsed['request_path'], '/api/payments')
        self.assertEqual(parsed['http_method'], 'POST')
        self.assertEqual(parsed['status_code'], 200)
        self.assertEqual(parsed['response_time_ms'], 157)  # 0.001 + 0.156 + 0.000 = 0.157초 = 157ms
        print(f"✅ API Payment 테스트 통과: {parsed['service']}")

    def test_api_order_service_detection(self):
        """API Order 서비스 요청 파싱 테스트"""
        parsed = parse_alb_log(self.ALB_LOG_API_ORDER)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['service'], 'flash-api-order')
        self.assertEqual(parsed['request_path'], '/api/orders/123')
        self.assertEqual(parsed['http_method'], 'GET')
        self.assertEqual(parsed['status_code'], 200)
        self.assertEqual(parsed['response_time_ms'], 89)  # 0.000 + 0.089 + 0.000 = 0.089초 = 89ms
        print(f"✅ API Order 테스트 통과: {parsed['service']}")

    def test_pay_service_detection(self):
        """API Pay (결제) 서비스 요청 파싱 테스트"""
        parsed = parse_alb_log(self.ALB_LOG_PAY)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['service'], 'flash-api-payment')  # /api/pay 경로도 payment로 인식 (pay 포함)
        self.assertEqual(parsed['request_path'], '/api/pay')
        self.assertEqual(parsed['http_method'], 'POST')
        self.assertEqual(parsed['status_code'], 200)
        self.assertEqual(parsed['response_time_ms'], 236)  # 0.002 + 0.234 + 0.000 = 0.236초 = 236ms
        print(f"✅ API Pay 테스트 통과: {parsed['service']}")

    def test_gateway_products_service_detection(self):
        """Gateway Products 서비스 요청 파싱 테스트"""
        parsed = parse_alb_log(self.ALB_LOG_GATEWAY_PRODUCTS)

        self.assertIsNotNone(parsed)
        self.assertEqual(parsed['service'], 'flash-gateway-products')
        self.assertEqual(parsed['request_path'], '/products')
        self.assertEqual(parsed['http_method'], 'GET')
        self.assertEqual(parsed['status_code'], 200)
        self.assertEqual(parsed['response_time_ms'], 45)  # 0.000 + 0.045 + 0.000 = 0.045초 = 45ms
        print(f"✅ Gateway Products 테스트 통과: {parsed['service']}")

    def test_response_time_calculation(self):
        """응답 시간 계산 정확성 테스트"""
        parsed = parse_alb_log(self.ALB_LOG_API_PAYMENT)

        # 응답 시간 = (request_time + target_time + response_time) * 1000
        # = (0.001 + 0.156 + 0.000) * 1000 = 157ms
        expected_response_time = 157
        self.assertEqual(parsed['response_time_ms'], expected_response_time)
        print(f"✅ 응답 시간 계산 정확: {parsed['response_time_ms']}ms")

    def test_json_serialization(self):
        """JSON 직렬화 테스트 (CloudWatch Logs 업로드 호환성)"""
        parsed = parse_alb_log(self.ALB_LOG_API_PAYMENT)

        # JSON으로 변환 가능한지 확인
        json_str = json.dumps(parsed, ensure_ascii=False)
        self.assertIsNotNone(json_str)

        # 다시 파싱해서 데이터 일치성 확인
        reparsed = json.loads(json_str)
        self.assertEqual(reparsed['service'], parsed['service'])
        self.assertEqual(reparsed['response_time_ms'], parsed['response_time_ms'])
        print(f"✅ JSON 직렬화 테스트 통과")

    def test_all_services_latency_summary(self):
        """모든 서비스별 응답 시간 요약"""
        test_cases = [
            (self.ALB_LOG_GATEWAY, 'flash-gateway-orders', 23),
            (self.ALB_LOG_API_PAYMENT, 'flash-api-payment', 157),
            (self.ALB_LOG_API_ORDER, 'flash-api-order', 89),
            (self.ALB_LOG_PAY, 'flash-api-payment', 236),
            (self.ALB_LOG_GATEWAY_PRODUCTS, 'flash-gateway-products', 45),
        ]

        print("\n📊 서비스별 응답 시간 요약:")
        print("=" * 60)

        for log_line, expected_service, expected_latency in test_cases:
            parsed = parse_alb_log(log_line)
            self.assertEqual(parsed['service'], expected_service)
            self.assertEqual(parsed['response_time_ms'], expected_latency)
            print(f"  {expected_service:25} | {expected_latency:4}ms | {parsed['request_path']}")

        print("=" * 60)


if __name__ == '__main__':
    # 테스트 실행
    unittest.main(verbosity=2)
