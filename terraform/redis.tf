resource "aws_cloudwatch_log_group" "redis_slow_log" {
  name              = "/aws/elasticache/flash-ticket-redis-slowlog"
  retention_in_days = 7
}

resource "aws_cloudwatch_log_group" "redis_engine_log" {
  name              = "/aws/elasticache/flash-ticket-redis-enginelog"
  retention_in_days = 7
}

resource "aws_security_group" "redis" {
  name        = "${var.project_name}-redis-sg"
  description = "Allow Redis traffic from EKS nodes"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "my_redis_cluster" {
  replication_group_id       = "flash-ticket-redis"
  description                = "Flash-Ticket Redis cluster"
  node_type                  = "cache.t3.small"
  engine                     = "redis"
  engine_version             = "7.0"
  port                       = 6379
  automatic_failover_enabled = true
  apply_immediately          = true

  subnet_group_name  = aws_elasticache_subnet_group.redis.name
  security_group_ids = [aws_security_group.redis.id]
  
  log_delivery_configuration {
    destination_type = "cloudwatch-logs"
    destination      = aws_cloudwatch_log_group.redis_slow_log.name
    log_type         = "slow-log"
    log_format       = "json"
  }

  log_delivery_configuration {
    destination_type = "cloudwatch-logs"
    destination      = aws_cloudwatch_log_group.redis_engine_log.name
    log_type         = "engine-log"
    log_format       = "json"
  }

  tags = {
    Project = var.project_name
  }
}
