#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)
cd "$ROOT_DIR"

NODE_ENV=dev

run() {
  echo "> $*"
  "$@"
}

run pnpm install
run pnpm --dir web install
run pnpm --dir api install
run pnpm --dir gateway install
run pnpm --dir pay install

run pnpm --dir web build
run pnpm --dir api build
run pnpm --dir gateway build
run pnpm --dir pay build

run docker build --platform=linux/arm64 -t flash-tickets-api:arm64 -f Dockerfile.api .
run docker build --platform=linux/arm64 -t flash-tickets-gateway:arm64 -f Dockerfile.gateway .
run docker build --platform=linux/arm64 -t flash-tickets-pay:arm64 -f Dockerfile.pay .
run docker build --platform=linux/arm64 -t flash-tickets-web:arm64 -f Dockerfile.web .

OUTPUT_DIR="$ROOT_DIR/output/arm64"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run docker save -o "$OUTPUT_DIR/flash-tickets-api-arm64.tar" flash-tickets-api:arm64
run docker save -o "$OUTPUT_DIR/flash-tickets-gateway-arm64.tar" flash-tickets-gateway:arm64
run docker save -o "$OUTPUT_DIR/flash-tickets-pay-arm64.tar" flash-tickets-pay:arm64
run docker save -o "$OUTPUT_DIR/flash-tickets-web-arm64.tar" flash-tickets-web:arm64

cat <<INFO
Built ARM64 images and exported to $OUTPUT_DIR:
- flash-tickets-api-arm64.tar
- flash-tickets-gateway-arm64.tar
- flash-tickets-pay-arm64.tar
- flash-tickets-web-arm64.tar
INFO
