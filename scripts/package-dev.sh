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
run pnpm --dir web build

run pnpm --dir api install
run pnpm --dir pay install
run pnpm --dir pay build

run docker build -t flash-tickets-api:dev -f Dockerfile.api .
run docker build -t flash-tickets-pay:dev -f Dockerfile.pay .
run docker build -t flash-tickets-nginx:dev ./nginx

OUTPUT_DIR="$ROOT_DIR/output"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run docker save flash-tickets-api:dev flash-tickets-pay:dev flash-tickets-nginx:dev | gzip > "$OUTPUT_DIR/flash-tickets-dev-images.tar.gz"

run tar -czf "$OUTPUT_DIR/web-dist.tar.gz" -C web dist

cat <<INFO
Build artifacts ready:
- Docker images archive: $OUTPUT_DIR/flash-tickets-dev-images.tar.gz (includes api, mock pay, nginx)
- Frontend bundle archive: $OUTPUT_DIR/web-dist.tar.gz
INFO
