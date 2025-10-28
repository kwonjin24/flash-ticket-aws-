#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)
cd "$ROOT_DIR"

NODE_ENV=dev
PLATFORM=linux/amd64

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

run docker build --platform=$PLATFORM -t flash-tickets-api:amd64 -f Dockerfile.api .
run docker build --platform=$PLATFORM -t flash-tickets-gateway:amd64 -f Dockerfile.gateway .
run docker build --platform=$PLATFORM -t flash-tickets-pay:amd64 -f Dockerfile.pay .
run docker build --platform=$PLATFORM -t flash-tickets-web:amd64 -f Dockerfile.web .

OUTPUT_DIR="$ROOT_DIR/output/amd64"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run docker save -o "$OUTPUT_DIR/flash-tickets-api-amd64.tar" flash-tickets-api:amd64
run docker save -o "$OUTPUT_DIR/flash-tickets-gateway-amd64.tar" flash-tickets-gateway:amd64
run docker save -o "$OUTPUT_DIR/flash-tickets-pay-amd64.tar" flash-tickets-pay:amd64
run docker save -o "$OUTPUT_DIR/flash-tickets-web-amd64.tar" flash-tickets-web:amd64

cat <<INFO
Built AMD64 images and exported to $OUTPUT_DIR:
- flash-tickets-api-amd64.tar
- flash-tickets-gateway-amd64.tar
- flash-tickets-pay-amd64.tar
- flash-tickets-web-amd64.tar
INFO
