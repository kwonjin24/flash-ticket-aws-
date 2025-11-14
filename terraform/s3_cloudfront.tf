# 'var.environment' 변수 선언이 누락되어 추가했습니다.
variable "environment" {
  description = "The deployment environment (e.g., dev, prod)"
  type        = string
  default     = "dev" # 필요에 따라 기본값을 설정하거나 apply 시 입력하세요.
}

# 'var.project_name' 변수 선언이 누락되어 추가했습니다.
variable "project_name" {
  description = "The name of the project"
  type        = string
  default     = "flash-ticket" # 필요에 따라 기본값을 설정하거나 apply 시 입력하세요.
}

resource "aws_s3_bucket" "web_contents" {
  bucket = "flash-ticket-web-contents"

  tags = {
    Name        = "flash-ticket-web-contents"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_public_access_block" "web_contents_public_access_block" {
  bucket = aws_s3_bucket.web_contents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ACM Certificate
resource "aws_acm_certificate" "web_certificate" {
  domain_name       = "highgarden.cloud"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name        = "flash-ticket-web-certificate"
    Environment = var.environment
    Project     = var.project_name
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "web_distribution" {
  origin {
    domain_name = aws_s3_bucket.web_contents.bucket_regional_domain_name
    origin_id   = "S3-flash-ticket-web-contents"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.web_oai.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CloudFront distribution for Flash Ticket web frontend"
  default_root_object = "index.html"

  aliases = ["highgarden.cloud"]

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "S3-flash-ticket-web-contents"
    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 86400
    max_ttl                = 31536000

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.web_certificate.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  logging_config {
    include_cookies = false
    bucket          = aws_s3_bucket.cloudfront_logs.bucket_domain_name
    prefix          = ""
  }

  tags = {
    Name        = "flash-ticket-web-cloudfront"
    Environment = var.environment
    Project     = var.project_name
  }

  # ACM 인증서 유효성 검사가 완료된 후 CloudFront가 생성되도록
  # 명시적 의존성을 추가하여 배포 안정성을 높였습니다.
  depends_on = [
    aws_acm_certificate_validation.web_certificate_validation
  ]
} # <--- 여기에 빠졌던 닫는 중괄호 '}'를 추가했습니다.

resource "aws_cloudfront_origin_access_identity" "web_oai" {
  comment = "OAI for flash-ticket-web-contents S3 bucket"
}

resource "aws_s3_bucket_policy" "web_contents_oai_policy" {
  bucket = aws_s3_bucket.web_contents.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Action    = "s3:GetObject",
        Effect    = "Allow",
        Principal = {
          AWS = aws_cloudfront_origin_access_identity.web_oai.iam_arn
        },
        Resource = "${aws_s3_bucket.web_contents.arn}/*"
      }
    ]
  })

  # S3 퍼블릭 액세스 차단이 먼저 적용된 후 정책이 적용되도록
  # 명시적 의존성을 추가하여 안정성을 높였습니다.
  depends_on = [
    aws_s3_bucket_public_access_block.web_contents_public_access_block
  ]
}

resource "aws_s3_bucket" "cloudfront_logs" {
  bucket = "flash-ticket-cloudfront-logs"

  tags = {
    Name        = "flash-ticket-cloudfront-logs"
    Environment = var.environment
    Project     = var.project_name
  }
}

resource "aws_s3_bucket_acl" "cloudfront_logs_acl" {
  bucket = aws_s3_bucket.cloudfront_logs.id
  acl    = "log-delivery-write"
}

resource "aws_route53_record" "web_certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.web_certificate.domain_validation_options : dvo.domain_name => dvo
  }

  allow_overwrite = true
  name            = each.value.resource_record_name
  records         = [each.value.resource_record_value]
  ttl             = 60
  type            = each.value.resource_record_type
  zone_id         = "Z08193981RRMSSAU1ARDC" # Actual Route 53 Hosted Zone ID
}

resource "aws_acm_certificate_validation" "web_certificate_validation" {
  certificate_arn         = aws_acm_certificate.web_certificate.arn
  validation_record_fqdns = [for record in aws_route53_record.web_certificate_validation : record.fqdn]
}
