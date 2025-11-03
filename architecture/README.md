# Flash Tickets Cloud Architecture (Draft)

## 1. CI/CD & GitOps Workflow
- **Source Repository**: GitHub `CloudDx/flash-ticket-final`.
- **Argo CD** (`argocd` namespace in EKS) watches the repository and applies manifests (`gitops/**`) to the cluster.
- **Container Registry**: Amazon ECR (`flash-tickets/{api,gateway,pay,web}`).
- Deployment workflow:
  1. Build & push new image tag to ECR.
  2. Update GitOps manifest with new tag.
  3. Argo CD syncs and triggers a rolling update in EKS.

## 2. AWS Networking & Cluster Layout
- **VPC**: `vpc-0b89143b4397e00e6`, multi-AZ subnets (`ap-northeast-2a/b/c`).
- **EKS Cluster**: `flash-tickets-eks`.
- **Ingress/ALB**:
  - AWS Load Balancer Controller manages ALB for `flash-ingress`.
  - TLS certificates via ACM (`00596951-525b-4bdd-8451-a7a1081fa19b`, `8f0b62ea-3544-48c2-824d-bea976bb49af`).
  - Routing:
    | Host | Target Service | Port |
    |------|----------------|------|
    | `www.highgarden.cloud` | `flash-web` | 80 |
    | `api.highgarden.cloud` | `flash-api` | 4000 |
    | `gateway.highgarden.cloud` | `flash-gateway` | 3000 |
  - Additional ingress for Argo CD admin UI.

## 3. Compute & Autoscaling
- **Node Pools**
  - Managed Node Group `flash-tickets-nodes` (baseline capacity).
  - **Karpenter** (`karpenter` namespace) provisioner:
    - NodePool `default`: Spot `t3.medium`, zones `{2a,2b,2c}`, `limits.resources.cpu=1000`.
    - EC2NodeClass `default`: AMI `ami-005d052564a5faae5`, discovery tag `karpenter.sh/discovery: flash-tickets-eks`.
    - IAM roles: `KarpenterControllerRole-flash-tickets-eks` and `KarpenterNodeInstanceRole-flash-tickets-eks`.
- **HPA (autoscaling/v2)** for workloads in `flash-ticket` namespace:
  - `flash-api`, `flash-gateway`, `flash-pay` → min 2, max 10 replicas, CPU/Mem targets defined.
- **Observability**: CloudWatch Container Insights/Observability controller present (`amazon-cloudwatch-observability-controller`).

## 4. Application Services (flash-ticket namespace)
| Service | Description | External Exposure |
|---------|-------------|-------------------|
| `flash-web` | Nginx static SPA | ALB → `www.highgarden.cloud` |
| `flash-gateway` | NestJS Queue Gateway (Redis queue, JWT, WebSocket) | ALB → `gateway.highgarden.cloud` |
| `flash-api` | NestJS REST API (orders, users, payments) | ALB → `api.highgarden.cloud` |
| `flash-pay` | RabbitMQ-driven mock payment worker | Internal only |

ConfigMap & Secret resources under `eks/configs` supply environment variables (Redis host, DB URL, RabbitMQ URL, JWT secrets, etc.).

## 5. Managed Dependencies
- **Amazon ElastiCache Redis**  
  - Endpoint: `master.flash-tickets-redis.rrzszk.apn2.cache.amazonaws.com:6379` (TLS).  
  - Used by Gateway (queue), API (caching/queue metrics).
- **PostgreSQL**  
  - Connection: `postgres://flash_tickets_app:...@211.46.52.152:15432/flash_tickets`.  
  - Managed externally (RDS or self-hosted), security groups allow EKS access.
- **Amazon MQ (RabbitMQ)**  
  - Endpoint: `b-45e98261-9f7f-45e7-a70f-7b9c33e154bc.mq.ap-northeast-2.on.aws:5671`.  
  - TLS + credentials stored in `api-secret`/`pay-secret`.
- **ACM Certificates** for ALB TLS termination.

## 6. Security
- ALB enforces HTTPS (port 443 redirect) using ACM certs; security group tags used for Karpenter discovery.
- `aws-auth` ConfigMap maps:
  - `flash-tickets-eks-nodes-role` (managed node group)
  - `KarpenterNodeInstanceRole-flash-tickets-eks` (provisioned nodes)
- Secrets (`api-secret`, `gateway-secret`, `pay-secret`, etc.) hold DB/RabbitMQ/JWT credentials.
- Network policies not defined (default allow); rely on VPC SG controls.

## 7. Observability & Metrics
- API exposes `/metrics` with Queue & DB statistics (Prometheus format).
- Gateway exposes `/metrics` for queue lengths, `/live` gauge for probes.
- Pay exposes `/live` via lightweight HTTP server (`PAY_HEALTH_PORT` default 3100).
- ALB health checks use `/health` endpoints; HPA metrics flow to Kubernetes metrics server.

## 8. Data Flow Overview
1. User → `www.highgarden.cloud` → `flash-web`.
2. Login → `gateway.highgarden.cloud/auth`, JWT issued, Redis queue ticket created (`queue:event:__global__`).
3. Gateway’s queue promotion (Redis) issues READY/gate token → client REST polling or WebSocket updates.
4. Purchase → `api.highgarden.cloud` → PostgreSQL + Redis → RabbitMQ (`payments_request`).
5. `flash-pay` worker processes payment → results to API → persisted & returned to client.

## 9. Deployment Artifacts Summary
- GitOps manifests under `gitops/`:
  - `apps/<service>/base`: Deployment/Service/HPA definitions.
  - `argocd-apps`: Argo CD `Application` definitions.
  - `karpenter/`: Karpenter Helm manifest + NodePool/EC2NodeClass.
  - `ingress/`: ALB ingress definitions.
  - `configs/`: ConfigMap & Secret templates.
- Argo CD Applications:
  - `flash-tickets` (app of apps), `flash-tickets-api`, `flash-tickets-gateway`, `flash-tickets-pay`, `flash-tickets-web`.

---

> **Next Steps**: Convert this draft into an AWS Architecture Diagram (VPC, EKS, ALB, Redis, RDS, MQ, CI/CD) and document runbooks (deployment, scaling, failover).*** End Patch
