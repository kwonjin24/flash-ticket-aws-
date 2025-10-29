# EKS 노드 추가 후 보안 그룹 누락으로 인한 서비스 장애

**날짜**: 2025-10-29
**영향**: API, Gateway 서비스 장애 (Redis 연결 타임아웃)
**심각도**: High
**해결 시간**: ~40분

---

## 📋 문제 상황

### 증상
- EKS 클러스터에 노드 1개 추가 (리소스 부족으로 인한 확장)
- 노드 추가 후 API Pod가 새 노드에 스케줄링되면서 **CrashLoopBackOff** 발생
- Gateway도 일시적으로 Redis 연결 에러 발생

### 에러 로그
```
[Nest] 1  - 10/29/2025, 1:47:19 AM   ERROR [QueueRedis] [Redis] ❌ Redis error: connect ETIMEDOUT
Error: connect ETIMEDOUT
    at TLSSocket.<anonymous> (/node_modules/.pnpm/ioredis@5.8.0/node_modules/ioredis/built/Redis.js:171:41)
```

### 영향 받은 서비스
- ❌ **API**: CrashLoopBackOff (Redis 연결 실패)
- ⚠️ **Gateway**: Redis 타임아웃 반복 (재시도 후 연결 성공)
- ✅ **Pay**: 정상 (RabbitMQ만 사용)
- ✅ **Web**: 정상 (외부 리소스 의존 없음)

---

## 🔍 원인 분석

### 1단계: Pod 상태 확인
```bash
kubectl get pods -n flash-ticket -o wide
```

**발견 사항**:
- 새 노드 (ip-10-0-30-158)에 배포된 API Pod만 실패
- 기존 노드의 API Pod는 정상 작동
- Gateway와 Pay는 새 노드에서도 정상 작동

### 2단계: 노드 보안 그룹 비교
```bash
# 새 노드 (i-073d7a509256104d4)
aws ec2 describe-instances --instance-ids i-073d7a509256104d4

# 기존 노드 (i-0365d3434ac7439cc)
aws ec2 describe-instances --instance-ids i-0365d3434ac7439cc
```

**발견된 문제**:

| 구분 | 보안 그룹 | 설명 |
|------|----------|------|
| **기존 노드** | sg-06bf5f46ace325ef6<br/>sg-0e5a96d33de056bfe | ✅ 정상 (2개) |
| **새 노드** | sg-06bf5f46ace325ef6 | ❌ 누락 (1개만) |

### 3단계: Redis 보안 그룹 확인
```bash
aws ec2 describe-security-groups --group-ids sg-0de41853ae31eda84
```

**Redis ElastiCache 인바운드 규칙**:
- 포트 6379 (Redis): **sg-0e5a96d33de056bfe** 허용
- 포트 6380 (TLS): **sg-0e5a96d33de056bfe** 허용

→ 새 노드에 `flash-tickets-eks-nodes-sg` 보안 그룹이 없어서 Redis 접근 불가!

### 근본 원인
**EKS 노드 그룹이 Launch Template 없이 생성**되어, 노드 추가 시 보안 그룹이 자동으로 할당되지 않음.

```bash
aws eks describe-nodegroup --cluster-name flash-tickets-eks --nodegroup-name flash-tickets-nodes
```

```json
{
  "launchTemplate": null,  // ❌ Launch Template 없음
  "scalingConfig": {
    "minSize": 1,
    "maxSize": 4,
    "desiredSize": 3
  }
}
```

---

## ✅ 해결 방법

### 방법 1: Redis 보안 그룹 수정 (임시 조치)

클러스터 SG를 Redis 보안 그룹에 추가하여 모든 EKS Pod가 접근 가능하도록 설정:

```bash
# Redis 포트 6379 허용
aws ec2 authorize-security-group-ingress \
  --group-id sg-0de41853ae31eda84 \
  --protocol tcp \
  --port 6379 \
  --source-group sg-06bf5f46ace325ef6 \
  --region ap-northeast-2

# Redis TLS 포트 6380 허용
aws ec2 authorize-security-group-ingress \
  --group-id sg-0de41853ae31eda84 \
  --protocol tcp \
  --port 6380 \
  --source-group sg-06bf5f46ace325ef6 \
  --region ap-northeast-2
```

**결과**: Gateway와 Pay는 정상 작동하기 시작했지만, API는 여전히 시작되지 않음.

### 방법 2: 새 노드에 누락된 보안 그룹 추가 (근본 해결)

#### 2-1. 네트워크 인터페이스 확인
```bash
aws ec2 describe-instances \
  --instance-ids i-073d7a509256104d4 \
  --region ap-northeast-2 \
  --query 'Reservations[0].Instances[0].NetworkInterfaces[*].[NetworkInterfaceId,Attachment.DeviceIndex,Groups[*].GroupId]'
```

**출력**:
```json
[
    ["eni-09cd901becd27fbb1", 1, ["sg-06bf5f46ace325ef6"]],
    ["eni-0897f793a23f08636", 2, ["sg-06bf5f46ace325ef6"]],
    ["eni-05591093ba1722414", 0, ["sg-06bf5f46ace325ef6"]]  // Primary ENI
]
```

#### 2-2. 주 네트워크 인터페이스에 보안 그룹 추가
```bash
aws ec2 modify-network-interface-attribute \
  --network-interface-id eni-05591093ba1722414 \
  --groups sg-06bf5f46ace325ef6 sg-0e5a96d33de056bfe \
  --region ap-northeast-2
```

#### 2-3. 검증
```bash
aws ec2 describe-network-interfaces \
  --network-interface-ids eni-05591093ba1722414 \
  --region ap-northeast-2 \
  --query 'NetworkInterfaces[0].Groups[*].[GroupId,GroupName]' \
  --output table
```

**출력**:
```
------------------------------------------------------------------------
|                       DescribeNetworkInterfaces                      |
+-----------------------+----------------------------------------------+
|  sg-06bf5f46ace325ef6 |  eks-cluster-sg-flash-tickets-eks-637059658  |
|  sg-0e5a96d33de056bfe |  flash-tickets-eks-nodes-sg                  |
+-----------------------+----------------------------------------------+
```

✅ **보안 그룹 추가 완료!**

#### 2-4. API Pod 재시작
```bash
# 기존 Deployment 삭제 후 재생성
kubectl delete deployment flash-api -n flash-ticket
kubectl apply -f eks/deployments/api-deployment.yaml

# 또는 특정 Pod만 삭제 (자동 재생성)
kubectl delete pod flash-api-xxx -n flash-ticket
```

---

## 📊 해결 후 상태

### 전체 Pod 상태
```bash
kubectl get pods -n flash-ticket -o wide
```

| Pod | Status | Node | IP |
|-----|--------|------|-----|
| flash-api-7c56c94c9-27kn7 | Running 1/1 ✅ | ip-10-0-30-158 (새 노드) | 10.0.30.129 |
| flash-api-7c56c94c9-g27zl | Running 1/1 ✅ | ip-10-0-40-22 (기존) | 10.0.40.70 |
| flash-gateway-6974ccc94f-59cd4 | Running 1/1 ✅ | ip-10-0-30-158 (새 노드) | 10.0.30.12 |
| flash-pay-59977c9bbd-r8k9r | Running 1/1 ✅ | ip-10-0-30-158 (새 노드) | 10.0.30.118 |
| flash-web-74c9b9dcd4-2pdcb | Running 1/1 ✅ | ip-10-0-30-28 (기존) | 10.0.30.111 |
| flash-web-74c9b9dcd4-n479c | Running 1/1 ✅ | ip-10-0-40-22 (기존) | 10.0.40.127 |

### API 로그 확인
```bash
kubectl logs -n flash-ticket flash-api-7c56c94c9-27kn7 | grep "Application started"
```

**출력**:
```
[Redis] ✅ Redis client is ready
[API] ✅ Application started successfully!
```

✅ **모든 서비스 정상 작동!**

---

## 🚀 재발 방지 대책

### 단기 대책 (수동 운영)
노드 추가 시 보안 그룹 수동 할당:

```bash
# 1. 새 노드 인스턴스 ID 확인
kubectl get nodes -o json | jq -r '.items[] | "\(.metadata.name) | \(.spec.providerID)"'

# 2. 보안 그룹 할당
NEW_INSTANCE_ID="i-xxxxx"
PRIMARY_ENI=$(aws ec2 describe-instances \
  --instance-ids $NEW_INSTANCE_ID \
  --query 'Reservations[0].Instances[0].NetworkInterfaces[?Attachment.DeviceIndex==`0`].NetworkInterfaceId' \
  --output text)

aws ec2 modify-network-interface-attribute \
  --network-interface-id $PRIMARY_ENI \
  --groups sg-06bf5f46ace325ef6 sg-0e5a96d33de056bfe
```

### 중장기 대책 (자동화)

#### 옵션 A: Launch Template 생성 및 노드 그룹 업데이트 (권장)

**1. Launch Template 생성**:
```bash
# 최신 EKS 최적화 AMI 확인
AMI_ID=$(aws ssm get-parameter \
  --name /aws/service/eks/optimized-ami/1.33/amazon-linux-2/recommended/image_id \
  --region ap-northeast-2 \
  --query 'Parameter.Value' \
  --output text)

# Launch Template 생성
aws ec2 create-launch-template \
  --launch-template-name flash-tickets-nodes-lt \
  --region ap-northeast-2 \
  --launch-template-data '{
    "ImageId": "'${AMI_ID}'",
    "SecurityGroupIds": [
      "sg-06bf5f46ace325ef6",
      "sg-0e5a96d33de056bfe"
    ],
    "TagSpecifications": [{
      "ResourceType": "instance",
      "Tags": [
        {"Key": "Name", "Value": "flash-tickets-eks-node"},
        {"Key": "kubernetes.io/cluster/flash-tickets-eks", "Value": "owned"}
      ]
    }],
    "MetadataOptions": {
      "HttpTokens": "required",
      "HttpPutResponseHopLimit": 2
    }
  }'
```

**2. 새 노드 그룹 생성 (다운타임 최소화)**:
```bash
aws eks create-nodegroup \
  --cluster-name flash-tickets-eks \
  --nodegroup-name flash-tickets-nodes-v2 \
  --launch-template name=flash-tickets-nodes-lt \
  --scaling-config minSize=2,maxSize=4,desiredSize=3 \
  --subnets subnet-09b8ac857209350cc subnet-0c110de21c619a794 \
  --region ap-northeast-2
```

**3. 기존 노드 그룹 단계적 제거**:
```bash
# 새 노드 그룹 정상 확인 후
aws eks delete-nodegroup \
  --cluster-name flash-tickets-eks \
  --nodegroup-name flash-tickets-nodes \
  --region ap-northeast-2
```

#### 옵션 B: AWS Lambda로 자동 보안 그룹 할당

새 EC2 인스턴스 생성 이벤트를 감지하여 자동으로 보안 그룹 추가:

```python
# lambda_function.py
import boto3

def lambda_handler(event, context):
    ec2 = boto3.client('ec2')
    instance_id = event['detail']['instance-id']

    # EKS 노드인지 확인
    response = ec2.describe_instances(InstanceIds=[instance_id])
    tags = response['Reservations'][0]['Instances'][0].get('Tags', [])

    is_eks_node = any(
        tag['Key'] == 'kubernetes.io/cluster/flash-tickets-eks'
        for tag in tags
    )

    if is_eks_node:
        # Primary ENI 확인
        eni_id = response['Reservations'][0]['Instances'][0]['NetworkInterfaces'][0]['NetworkInterfaceId']

        # 보안 그룹 추가
        ec2.modify_network_interface_attribute(
            NetworkInterfaceId=eni_id,
            Groups=['sg-06bf5f46ace325ef6', 'sg-0e5a96d33de056bfe']
        )
```

**EventBridge 규칙**:
```json
{
  "source": ["aws.ec2"],
  "detail-type": ["EC2 Instance State-change Notification"],
  "detail": {
    "state": ["running"]
  }
}
```

---

## 📝 교훈

### 1. 인프라 자동화의 중요성
- Launch Template 없이 노드 그룹을 생성하면 일관성 없는 설정 발생
- IaC (Terraform, CloudFormation) 사용 권장

### 2. 보안 그룹 설계
- 클러스터 레벨과 노드 레벨 보안 그룹 구분 필요
- Redis처럼 중요한 리소스는 여러 경로로 접근 가능하도록 설정 고려

### 3. 모니터링 및 알람
- Pod CrashLoopBackOff 알람 설정 필요
- 보안 그룹 변경 감지 및 알람

### 4. 문서화
- 노드 추가 절차 문서화
- 필수 보안 그룹 목록 명시

---

## 📚 관련 문서

- [AWS EKS Security Groups](https://docs.aws.amazon.com/eks/latest/userguide/sec-group-reqs.html)
- [Launch Templates for Node Groups](https://docs.aws.amazon.com/eks/latest/userguide/launch-templates.html)
- [ElastiCache Security](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/GettingStarted.AuthorizeAccess.html)

---

## 🔗 관련 이슈

- 이슈 없음 (사이드 프로젝트)

---

**작성자**: Claude Code
**검토자**: -
**최종 업데이트**: 2025-10-29
