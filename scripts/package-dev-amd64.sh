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

# Set VITE environment variables for build
export VITE_API_BASE_URL=https://api.highgarden.cloud

run pnpm --dir web build

run pnpm --dir api install
run pnpm --dir gateway install
run pnpm --dir pay install
run pnpm --dir pay build

run docker build --platform=$PLATFORM -t flash-tickets-api:dev -f Dockerfile.api .
run docker build --platform=$PLATFORM -t flash-tickets-queue:dev -f Dockerfile.queue .
run docker build --platform=$PLATFORM -t flash-tickets-pay:dev -f Dockerfile.pay .
run docker build --platform=$PLATFORM -t flash-tickets-nginx:dev ./nginx

OUTPUT_DIR="$ROOT_DIR/output"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run docker save -o "$OUTPUT_DIR/flash-tickets-dev-images.tar" flash-tickets-api:dev flash-tickets-queue:dev flash-tickets-pay:dev flash-tickets-nginx:dev
run gzip -f "$OUTPUT_DIR/flash-tickets-dev-images.tar"

run tar -czf "$OUTPUT_DIR/web-dist.tar.gz" -C web dist

cat <<INFO
Build artifacts ready (AMD64 platform):
- Docker images archive: $OUTPUT_DIR/flash-tickets-dev-images.tar.gz (includes api, queue gateway, mock pay, nginx)
- Frontend bundle archive: $OUTPUT_DIR/web-dist.tar.gz
- Platform: $PLATFORM
INFO
