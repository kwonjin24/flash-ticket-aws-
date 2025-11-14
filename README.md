# Flash Ticket: A Scalable, Real-time Ticketing System

Flash Tickets는 대규모 이벤트 티켓팅을 안정적으로 처리하기 위한 서비스로, 실시간 대기열과 주문 파이프라인을 포함한 멀티 패키지(monorepo) 구조입니다. NestJS 기반 API(`api/`), Vite React 프런트엔드(`web/`), 모의 결제 서비스(`pay/`)가 함께 포함되어 있어 개발·테스트·운영을 한 저장소에서 관리합니다.

---

## Architecture Diagram

The following diagram illustrates the overall architecture of the Flash Ticket system on AWS.

```mermaid
graph TD
    subgraph AWS["AWS Account 339712948064 (ap-northeast-2)"]
        subgraph VPC["VPC: vpc-0b89143b4397e00e6"]
            subgraph PublicSubnet["Public Subnets"]
                ALB[[Application Load Balancer
flash-ingress]]
            end
            subgraph PrivateSubnet["Private Subnets"]
                subgraph EKS["EKS Cluster: flash-tickets-eks"]
                    subgraph ArgoCDNS["Namespace: argocd"]
                        ArgoCD["Argo CD
Application Controller"]
                    end
                    subgraph FlashNS["Namespace: flash-ticket"]
                        Web["Deployment: flash-web (React SPA)"]
                        Gateway["Deployment: flash-gateway (NestJS Queue)"]
                        API["Deployment: flash-api (NestJS API)"]
                        Pay["Deployment: flash-pay (Mock Payment Worker)"]
                        HPA["HPAs (api/gateway/pay)"]
                    end
                    Karpenter["Karpenter Controller
(NodePool default Spot t3.medium)"]
                    NodeGroup["Managed Node Group
flash-tickets-nodes"]
                end
                CloudWatch[("Amazon CloudWatch
Observability")]]
            end
        end

        subgraph Managed["Managed Services"]
            Redis[("ElastiCache Redis
master.flash-tickets-redis")]
            RDS[("PostgreSQL
211.46.52.152:15432")]
            RabbitMQ[("Amazon MQ for RabbitMQ
b-45e98261-...mq.ap-northeast-2.on.aws")]
            ECR[("Amazon ECR
flash-tickets/*")]
            ACM[("AWS Certificate Manager")]
        end
    end

    subgraph GitHub["GitHub Repo: CloudDx/flash-ticket-final"]
        Repo[("GitOps Manifests & Source")]
    end

    subgraph Developers["Developers"]
        Dev["Build & Push Images"]
    end

    User["End Users"]

    User -->|HTTPS| ALB
    ALB -->|"/"| Web
    ALB -->|"/auth,/queue"| Gateway
    ALB -->|"/api"| API

    Gateway -->|"queue events"| Redis
    Gateway -->|REST| API
    API -->|"orders/payments"| RDS
    API -->|"enqueue payments"| RabbitMQ
    Pay -->|consume| RabbitMQ
    Pay -->|"update status"| API

    Web -->|"static assets"| S3[("Static Assets
(inside container)")]

    ArgoCD -->|"Sync manifests"| FlashNS
    ArgoCD -->|"Karpenter manifests"| Karpenter
    Repo --> ArgoCD
    Dev -->|"docker push"| ECR
    ArgoCD -->|"pull images"| ECR

    ALB --> ACM
    Gateway --> CloudWatch
    API --> CloudWatch
    Pay --> CloudWatch
```

## Key Features

- **실시간 WebSocket 대기열:** 사용자는 대기열 위치와 상태를 실시간으로 확인하며, 서버는 BullMQ 기반 승격 작업을 통해 병목 없이 READY 상태를 부여합니다.
- **주문 및 결제 파이프라인:** NestJS API가 주문/결제/보류(hold)를 관리하고, Redis와 PostgreSQL을 조합해 일관성 있게 재고를 차감합니다.
- **운영 친화적 구성:** 환경 변수 템플릿, Dev/Prod용 Dockerfile, 배포/패키징 스크립트를 제공하여 로컬 개발부터 클러스터 배포까지 한 흐름으로 구성했습니다.
- **모의 결제 시나리오:** `pay/` 서비스가 메시지 큐 기반(mock) 결제 응답을 반환해 전체 플로우를 검증할 수 있습니다.
- **Cloud-Native & Scalable Infrastructure:** The entire infrastructure is defined as code (IaC) using **Terraform** and runs on a **Kubernetes (EKS)** cluster that can auto-scale with **Karpenter**.
- **End-to-End Observability:** A comprehensive monitoring stack using **Prometheus, Grafana, and Loki** provides deep insights into application performance, system metrics, and logs.
- **GitOps-driven CI/CD:** All deployments are managed through a GitOps workflow with **ArgoCD**, ensuring that the cluster state always matches the manifests defined in the Git repository.


## Tech Stack

| Category          | Technologies                                                              |
| ----------------- | ------------------------------------------------------------------------- |
| **Frontend**      | React 18, TypeScript, Vite, Zustand, Socket.IO Client                     |
| **Backend**       | NestJS 11, TypeScript, WebSockets (Socket.IO), BullMQ, RabbitMQ           |
| **Database**      | PostgreSQL (Amazon RDS), Redis (Amazon ElastiCache)                       |
| **Infrastructure**| AWS, Terraform, Docker, Kubernetes (Amazon EKS), Karpenter, NGINX         |
| **CI/CD**         | GitHub Actions, ArgoCD (GitOps)                                           |
| **Monitoring**    | Prometheus, Grafana, Loki, Amazon CloudWatch                              |
| **Monorepo**      | pnpm Workspaces                                                           |

## My Role & Contributions

*(This is a template. Please edit it to accurately reflect your contributions.)*

As the lead developer and cloud engineer on this project, I was responsible for the end-to-end design, implementation, and deployment of the Flash Ticket system. My key contributions include:

- **Cloud Architecture & IaC:**
  - Designed the scalable and resilient cloud architecture on AWS.
  - Wrote and maintained all **Terraform** code to provision the networking (VPC, Subnets), compute (EKS), database (RDS, ElastiCache), and other cloud resources.
- **Backend Development:**
  - Developed the core backend services (`api`, `gateway`) using **NestJS**.
  - Implemented the real-time waiting queue logic with **WebSockets** and **Redis (BullMQ)** to manage user traffic and prevent server overload.
  - Designed the database schema and implemented transactional order processing logic with **PostgreSQL (TypeORM)**.
- **Kubernetes & Deployment:**
  - Containerized all applications using **Docker** with multi-stage builds for optimization.
  - Wrote and managed all **Kubernetes manifests** (Deployments, Services, Ingress) for the application.
  - Implemented **Karpenter** for just-in-time, cost-efficient node provisioning on the EKS cluster.
- **CI/CD & GitOps:**
  - Established a **GitOps** workflow using **ArgoCD** to automate application deployment and ensure the cluster state is synchronized with the Git repository.
  - Configured **GitHub Actions** to build and push Docker images to Amazon ECR.


## 개발 환경 준비

- Node.js 20.19.0 (`.nvmrc` 제공) — `nvm install && nvm use` 권장
- pnpm 10.17.1 — `corepack prepare pnpm@10.17.1 --activate`

## 개발 서버 실행

```bash
pnpm install
pnpm --dir api install
pnpm --dir web install
pnpm dev
```

환경 변수는 루트 `.env.example`과 각 패키지의 예시 파일을 참고해 `.env`를 준비하세요. dev/prod 배포 절차는 `DEV_DEPLOYMENT.md` 및 `scripts/` 디렉터리를 참고하면 빠르게 따라 할 수 있습니다.

```