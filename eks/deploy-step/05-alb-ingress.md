# 05. ALB / Ingress 구성

## 5-1. AWS Load Balancer Controller 확인

- 컨트롤러 설치 여부: `kubectl get deployment -n kube-system aws-load-balancer-controller`
- `Error from server (NotFound)`라면 현재 설치되어 있지 않은 상태입니다.
- 미설치 시 아래 단계대로 OIDC/IAM/Helm 설치를 진행합니다.

## 5-1-1. eksctl 설치 (권장)

- macOS/Homebrew 환경: `brew install eksctl`
- 설치 확인: `eksctl version`
- Homebrew를 쓰지 않을 경우 [eksctl 공식 문서](https://eksctl.io/installation/)의 tarball 설치 방법을 사용합니다.
- eksctl을 설치하지 않고 진행하려면 AWS CLI와 kubectl을 이용한 수동 설정(서비스어카운트 YAML 작성 등)을 직접 수행해야 합니다.

## 5-2. IAM 및 OIDC 준비

- EKS 클러스터에 OIDC 프로바이더가 연결돼있는지 확인: `eksctl utils associate-iam-oidc-provider --cluster flash-tickets-eks --approve`
  - eksctl 없이 확인할 경우: `aws eks describe-cluster --name flash-tickets-eks --query "cluster.identity.oidc.issuer" --output text`
  - 값이 비어있다면 AWS 콘솔 또는 CLI로 OIDC 공급자를 직접 연결해야 합니다.
- `No cluster found for name` 오류가 발생하면 클러스터 이름이 실제와 다른 것이므로
  - `aws eks list-clusters --region ap-northeast-2`로 현재 계정/리전에 존재하는 클러스터 이름을 확인하고
  - 확인된 이름으로 다시 실행합니다: `eksctl utils associate-iam-oidc-provider --cluster flash-tickets-eks --approve`
- `AccessDeniedException`이 뜨면서 `eks:DescribeClusterVersions` 권한이 없다는 메시지가 나오면
  - 현재 사용하는 IAM 사용자/역할에 `eks:DescribeClusterVersions`(및 관련 `eks:*`) 액션이 포함된 Policy를 추가해야 합니다.
  - 관리형 정책 예: `AmazonEKSClusterPolicy`, `AmazonEKS_CostEffectiveness` 등. 필요 시 커스텀 정책에 권한을 명시하세요.
  - 예시 커스텀 정책:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "eks:DescribeCluster",
            "eks:DescribeClusterVersions",
            "eks:TagResource",
            "iam:GetOpenIDConnectProvider",
            "iam:CreateOpenIDConnectProvider",
            "iam:ListOpenIDConnectProviders",
            "iam:TagOpenIDConnectProvider"
          ],
          "Resource": "*"
        }
      ]
    }
    ```
  - 위 JSON을 `allow_eks_permissions.json` 파일로 저장한 뒤 아래 명령으로 사용자에 적용합니다.
    ```bash
    cat <<'EOF' > allow_eks_permissions.json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "eks:DescribeCluster",
            "eks:DescribeClusterVersions",
            "eks:TagResource",
            "iam:GetOpenIDConnectProvider",
            "iam:CreateOpenIDConnectProvider",
            "iam:ListOpenIDConnectProviders",
            "iam:TagOpenIDConnectProvider"
          ],
          "Resource": "*"
        }
      ]
    }
    EOF
    aws iam put-user-policy \
      --user-name <username> \
      --policy-name AllowEksOidcSetup \
      --policy-document file://allow_eks_permissions.json
    ```
  - 권한 추가 후 동일 명령을 재수행합니다.
- `IAM Open ID Connect provider is already associated...` 메시지가 나오면 이미 OIDC 연동이 완료된 상태이므로 다음 단계로 넘어가면 됩니다.
- AWS에서 `AWSLoadBalancerControllerIAMPolicy`를 다운받아 IAM Policy 생성:
  ```bash
  curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.0/docs/install/iam_policy.json
  aws iam create-policy \
    --policy-name AWSLoadBalancerControllerIAMPolicy \
    --policy-document file://iam_policy.json
  ```
- 파일이 정상 생성됐는지 확인:
  ```bash
  ls -l iam_policy.json
  cat iam_policy.json
  ```
- `AccessDenied`로 `iam:CreatePolicy` 권한이 없을 경우
  - IAM 사용자/역할에 `iam:CreatePolicy`, `iam:AttachRolePolicy` 등의 권한이 포함된 정책을 부여하거나, 관리자에게 정책 생성을 요청합니다.
  - 예시 커스텀 정책:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "eks:DescribeCluster",
            "eks:DescribeClusterVersions",
            "eks:TagResource",
            "iam:GetOpenIDConnectProvider",
            "iam:CreateOpenIDConnectProvider",
            "iam:ListOpenIDConnectProviders",
            "iam:TagOpenIDConnectProvider",
            "iam:CreatePolicy",
            "iam:AttachRolePolicy"
          ],
          "Resource": "*"
        }
      ]
    }
    ```
  - 적용 명령:
    ```bash
    cat <<'EOF' > allow_iam_policy_creation.json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "eks:DescribeCluster",
            "eks:DescribeClusterVersions",
            "eks:TagResource",
            "iam:GetOpenIDConnectProvider",
            "iam:CreateOpenIDConnectProvider",
            "iam:ListOpenIDConnectProviders",
            "iam:TagOpenIDConnectProvider",
            "iam:CreatePolicy",
            "iam:AttachRolePolicy"
          ],
          "Resource": "*"
        }
      ]
    }
    EOF
    aws iam put-user-policy \
      --user-name jeongwon-cli \
      --policy-name AllowIamPolicyCreation \
      --policy-document file://allow_iam_policy_creation.json
    ```
  - 권한을 확보한 뒤 동일 명령을 재실행합니다.
- 서비스 어카운트와 IAM Role을 연결:
  ```bash
  eksctl create iamserviceaccount \
    --cluster flash-tickets-eks \
    --namespace kube-system \
    --name aws-load-balancer-controller \
    --attach-policy-arn arn:aws:iam::339712948064:policy/AWSLoadBalancerControllerIAMPolicy \
    --override-existing-serviceaccounts \
    --approve
  ```
- `existing iamserviceaccount(s) will be excluded` 메시지가 나타나면
  - 동일 이름의 서비스어카운트가 이미 존재한다는 의미입니다. `--override-existing-serviceaccounts`를 줬다면 메타데이터만 업데이트되고 새로운 작업은 수행되지 않습니다.
  - 기존 서비스어카운트와 IAM Role이 의도한 설정인지 확인한 뒤, 필요 시 아래 명령으로 삭제 후 재생성하세요.
    ```bash
    eksctl get iamserviceaccount --cluster flash-tickets-eks
    eksctl delete iamserviceaccount \
      --cluster flash-tickets-eks \
      --namespace kube-system \
      --name aws-load-balancer-controller
    # CloudFormation 스택 삭제가 완료될 때까지 대기
    aws cloudformation describe-stacks \
      --stack-name eksctl-flash-tickets-eks-addon-iamserviceaccount-kube-system-aws-load-balancer-controller
    # 서비스어카운트가 남아있으면 직접 삭제
    kubectl get sa aws-load-balancer-controller -n kube-system
    kubectl delete sa aws-load-balancer-controller -n kube-system
    # 스택 삭제 완료 후 상태 재확인
    eksctl get iamserviceaccount --cluster flash-tickets-eks
    ```
- `cloudformation:ListStacks` 등 CloudFormation 권한이 없다는 AccessDenied가 발생하면
  - eksctl은 내부적으로 CloudFormation 스택을 조회/생성하므로 해당 IAM 사용자/역할에 `cloudformation:ListStacks`, `cloudformation:CreateStack`, `cloudformation:UpdateStack`, `cloudformation:DescribeStacks` 등을 허용해야 합니다.
  - 예시 커스텀 정책:
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "cloudformation:ListStacks",
            "cloudformation:CreateStack",
            "cloudformation:UpdateStack",
            "cloudformation:DescribeStacks"
          ],
          "Resource": "*"
        }
      ]
    }
    ```
  - 권한이 없다면 관리자에게 요청하거나, CloudFormation 콘솔에서 직접 스택을 생성/업데이트하는 방식으로 진행해야 합니다.
- CloudFormation 스택 생성 중 `Failure`로 종료되면
  - CloudFormation 콘솔(`eksctl-<cluster>-addon-iamserviceaccount-...` 스택)에서 이벤트 로그를 확인해 원인을 파악합니다.
  - 주로 IAM 권한 부족, 이미 존재하는 리소스 충돌, 서비스 링크드 역할 부족 등이 원인입니다.
  - `UnauthorizedTaggingOperation` 또는 `iam:CreateRole` 403 에러가 발생하면 IAM 사용자/역할에 다음 권한을 추가하세요.
    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Action": [
            "iam:CreateRole",
            "iam:TagRole",
            "iam:TagUser",
            "iam:TagPolicy",
            "iam:AddRoleToInstanceProfile",
            "iam:PassRole"
          ],
          "Resource": "*"
        }
      ]
    }
    ```
  - CloudFormation이 태깅 작업을 수행할 수 있도록 `iam:Tag*` 또는 `iam:TagRole` 권한과 더불어 대상 리소스(eksctl이 생성하는 IAM Role)에 `iam:CreateRole`, `iam:AttachRolePolicy`, `iam:PassRole` 권한을 부여해야 합니다.
  - 문제를 해결한 후 위의 `eksctl delete iamserviceaccount` 명령 또는 콘솔에서 스택을 정리하고 다시 아래 명령을 실행합니다.
    ```bash
    eksctl create iamserviceaccount \
      --cluster flash-tickets-eks \
      --namespace kube-system \
      --name aws-load-balancer-controller \
      --attach-policy-arn arn:aws:iam::339712948064:policy/AWSLoadBalancerControllerIAMPolicy \
      --override-existing-serviceaccounts \
      --approve
    ```
- CloudFormation 스택이 정상 완료되면 콘솔 이벤트에 `IAM role for serviceaccount "kube-system/aws-load-balancer-controller" [created and managed by eksctl]` 메시지가 나타납니다.
  - 이 메시지가 보이면 IAM Role/ServiceAccount 생성이 완료된 상태이며, 다음 단계(Helm 설치)로 진행합니다.
- 현재 서비스어카운트가 올바른 IAM Role을 참조하는지 확인:
  ```bash
  kubectl get sa aws-load-balancer-controller -n kube-system -o yaml
  ```
- eksctl 미사용 시에는 IAM 콘솔/CLI로 Role을 만들고, `kubectl apply`로 ServiceAccount manifest를 작성하여 `eks.amazonaws.com/role-arn` 어노테이션을 수동 지정합니다.

최종 Role 권한 정의
```json
{
	"Version": "2012-10-17",
	"Statement": [
		{
			"Effect": "Allow",
			"Action": [
				"eks:DescribeCluster",
				"eks:DescribeClusterVersions",
				"eks:TagResource",
				"iam:GetOpenIDConnectProvider",
				"iam:CreateOpenIDConnectProvider",
				"iam:ListOpenIDConnectProviders",
				"iam:TagOpenIDConnectProvider",
				"iam:GetRole",
				"iam:CreatePolicy",
				"iam:AttachRolePolicy",
				"iam:DetachRolePolicy",
				"iam:DeleteRole",
				"iam:CreateRole",
				"iam:TagRole",
				"iam:TagUser",
				"iam:TagPolicy",
				"iam:AddRoleToInstanceProfile",
				"iam:PassRole",
				"cloudformation:ListStacks",
				"cloudformation:CreateStack",
				"cloudformation:UpdateStack",
				"cloudformation:DescribeStacks",
				"cloudformation:DeleteStack"
			],
			"Resource": "*"
		}
	]
}
```

## 5-3. Helm으로 컨트롤러 설치

- Helm 리포지토리 추가: `helm repo add eks https://aws.github.io/eks-charts`
- 최신 업데이트: `helm repo update`
- 설치:
  ```bash
  helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
    -n kube-system \
    --set clusterName=flash-tickets-eks \
    --set serviceAccount.create=false \
    --set serviceAccount.name=aws-load-balancer-controller \
    --set region=ap-northeast-2
  ```
- 배포 상태 확인: `kubectl get pods -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller -w`

## 5-4. Ingress 매니페스트 작성

- `eks/ingress/flash-ingress.yaml` 경로로 다음과 비슷한 템플릿을 생성합니다.
  ```yaml
  apiVersion: networking.k8s.io/v1
  kind: Ingress
  metadata:
    name: flash-ingress
    namespace: flash-tickets
    annotations:
      kubernetes.io/ingress.class: alb
      alb.ingress.kubernetes.io/scheme: internet-facing
      alb.ingress.kubernetes.io/target-type: ip
      alb.ingress.kubernetes.io/listen-ports: '[{"HTTP":80},{"HTTPS":443}]'
      alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:<ACCOUNT_ID>:certificate/<CERT_ID>
      alb.ingress.kubernetes.io/subnets: subnet-aaa,subnet-bbb
  spec:
    rules:
      - host: api.highgarden.cloud
        http:
          paths:
            - path: /
              pathType: Prefix
              backend:
                service:
                  name: flash-api
                  port:
                    number: 4000
      - host: gateway.highgarden.cloud
        http:
          paths:
            - path: /
              pathType: Prefix
              backend:
                service:
                  name: flash-gateway
                  port:
                    number: 4000
      - host: www.highgarden.cloud
        http:
          paths:
            - path: /
              pathType: Prefix
              backend:
                service:
                  name: flash-web
                  port:
                    number: 80
  ```
- HTTPS가 필요 없으면 `alb.ingress.kubernetes.io/listen-ports` 및 `certificate-arn`을 생략하고, 트래픽을 HTTP 80만 사용하도록 조정합니다.
- 사내 IP만 허용할 경우에는 `alb.ingress.kubernetes.io/scheme: internal`과 보안그룹 어노테이션을 적용하세요.
- `alb.ingress.kubernetes.io/subnets`에는 ALB가 올라갈 서브넷 ID를 콤마로 구분하여 입력합니다.
  - `scheme: internet-facing`이면 IGW가 연결된 퍼블릭 서브넷 최소 2개(서로 다른 AZ)를 지정하세요.
  - `scheme: internal`이면 프라이빗 서브넷을 지정하고, 라우팅·보안그룹이 내부 통신에 맞는지 확인합니다.
  - 서브넷에는 AWS 권장 태그(`kubernetes.io/role/elb=1` 또는 `kubernetes.io/role/internal-elb=1`)가 붙어 있어야 합니다. 태그가 없다면 콘솔이나 CLI로 추가한 뒤 사용하세요.
- ACM 인증서 ARN 확인:
  ```bash
  aws acm list-certificates \
    --region ap-northeast-2 \
    --query "CertificateSummaryList[].{DomainName:DomainName,ARN:CertificateArn}"
  ```
  - 단일 도메인이면 해당 ARN을 그대로 `alb.ingress.kubernetes.io/certificate-arn`에 기입합니다.
  - 여러 도메인을 한 번에 연결하려면 와일드카드(`*.highgarden.cloud`) 인증서 ARN을 사용하는 것이 편리합니다.
  - 특정 ARN 세부 정보 확인:
    ```bash
    aws acm describe-certificate \
      --region ap-northeast-2 \
      --certificate-arn arn:aws:acm:ap-northeast-2:339712948064:certificate/<CERT_ID>
    ```
  - 여러 인증서를 동시에 지정하려면 ARNs를 콤마로 연결합니다.
    ```yaml
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:ap-northeast-2:339712948064:certificate/8f0b62ea-3544-48c2-824d-bea976bb49af,arn:aws:acm:ap-northeast-2:339712948064:certificate/00596951-525b-4bdd-8451-a7a1081fa19b
    ```

## 5-5. 배포 및 검증

- Ingress 디렉토리 생성(없다면): `mkdir -p eks/ingress`
- 리소스 적용:
  ```bash
  kubectl apply -f eks/configs/ -n flash-tickets
  kubectl apply -f eks/deployments/ -n flash-tickets
  kubectl apply -f eks/ingress/flash-ingress.yaml
  ```
- ALB 주소 확인: `kubectl get ingress flash-ingress -n flash-tickets`
- Route 53에서 ALB DNS를 CNAME으로 연결하고 SSL 인증서(ACM)를 DNS에 반영합니다.
- 웹/Gateway/API 접속 및 헬스체크 경로(`/health`)가 모두 성공하는지 검증하세요.

## 5-6. 문제 해결 팁

- TargetGroup 상태가 `initial`이면 보안 그룹 포트(4000/80 등) 또는 헬스체크 경로가 맞는지 확인하세요.
- `kubectl logs -n kube-system deploy/aws-load-balancer-controller`로 로그를 확인해 에러 메시지를 파악합니다.
- 필요 시 `alb.ingress.kubernetes.io/healthcheck-path`, `alb.ingress.kubernetes.io/success-codes` 어노테이션으로 세부 조정이 가능합니다.
- 컨트롤러 Pod가 `failed to fetch VPC ID from instance metadata` 메시지와 함께 CrashLoopBackOff가 될 경우
  - 노드가 Fargate 전용이거나 IMDS 접근이 제한된 환경일 수 있습니다.
  - VPC 정보를 직접 지정해 재설치합니다.
    ```bash
    aws eks describe-cluster \
      --name flash-tickets-eks \
      --region ap-northeast-2 \
      --query "cluster.resourcesVpcConfig.vpcId" \
      --output text
    VPC_ID=$(aws eks describe-cluster \
      --name flash-tickets-eks \
      --region ap-northeast-2 \
      --query "cluster.resourcesVpcConfig.vpcId" \
      --output text)
    helm upgrade --install aws-load-balancer-controller eks/aws-load-balancer-controller \
      -n kube-system \
      --set clusterName=flash-tickets-eks \
      --set serviceAccount.create=false \
      --set serviceAccount.name=aws-load-balancer-controller \
      --set region=ap-northeast-2 \
      --set vpcId=$VPC_ID \
      --set autoDiscoverAwsRegion=false \
      --set autoDiscoverAwsVpcID=false
    ```
  - 이미 설치되어 있다면 먼저 삭제 후 재설치합니다.
    ```bash
    helm uninstall aws-load-balancer-controller -n kube-system
    ```
