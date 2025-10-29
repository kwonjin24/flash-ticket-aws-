#!/bin/bash

# Kustomize 설치 스크립트

set -e

echo "🔧 Installing Kustomize..."

# 운영체제 확인
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
    x86_64)
        ARCH="amd64"
        ;;
    arm64|aarch64)
        ARCH="arm64"
        ;;
esac

# 최신 버전 확인
VERSION=$(curl -s https://api.github.com/repos/kubernetes-sigs/kustomize/releases | grep '"tag_name":' | grep -v 'kustomize/v' | head -1 | sed -E 's/.*"kustomize\/v([^"]+)".*/\1/')

echo "📦 Downloading Kustomize v${VERSION}..."

# 다운로드 및 설치
curl -sL "https://github.com/kubernetes-sigs/kustomize/releases/download/kustomize%2Fv${VERSION}/kustomize_v${VERSION}_${OS}_${ARCH}.tar.gz" | tar xz

# 실행 권한 부여
chmod +x kustomize

# /usr/local/bin으로 이동
if [ -w /usr/local/bin ]; then
    mv kustomize /usr/local/bin/
    echo "✅ Kustomize installed to /usr/local/bin/kustomize"
else
    sudo mv kustomize /usr/local/bin/
    echo "✅ Kustomize installed to /usr/local/bin/kustomize (with sudo)"
fi

# 버전 확인
kustomize version

echo "🎉 Kustomize installation complete!"
