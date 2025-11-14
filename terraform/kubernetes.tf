provider "kubernetes" {
  host                   = aws_eks_cluster.main.endpoint
  cluster_ca_certificate = base64decode(aws_eks_cluster.main.certificate_authority[0].data)
  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    # This requires the aws-cli to be installed and configured
    args        = ["eks", "get-token", "--cluster-name", aws_eks_cluster.main.name]
  }
}

resource "kubernetes_secret" "app_secrets" {
  metadata {
    name = "app-secrets"
  }

  data = {
    DB_HOST     = "placeholder.db.host"
    DB_USER     = "admin"
    DB_PASSWORD = "changeme"
    JWT_SECRET  = "changeme-super-secret-jwt-key"
  }

  type = "Opaque"
}
