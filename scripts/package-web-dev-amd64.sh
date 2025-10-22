#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)
cd "$ROOT_DIR"

PLATFORM=linux/amd64
VITE_API_BASE_URL=${VITE_API_BASE_URL:-https://api.highgarden.cloud}

run() {
  echo "> $*"
  "$@"
}

run pnpm install
run pnpm --dir web install

export VITE_API_BASE_URL
run pnpm --dir web build

run docker build --platform=$PLATFORM \
  -t flash-tickets-web:dev \
  -f Dockerfile.web \
  --build-arg VITE_API_BASE_URL="$VITE_API_BASE_URL" \
  .

OUTPUT_DIR="$ROOT_DIR/output/web"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run docker save -o "$OUTPUT_DIR/flash-tickets-web-dev-image.tar" flash-tickets-web:dev
run gzip -f "$OUTPUT_DIR/flash-tickets-web-dev-image.tar"
run tar -czf "$OUTPUT_DIR/web-dist.tar.gz" -C web dist

cat <<INFO
Web build artifacts ready (AMD64 platform):
- Docker image archive: $OUTPUT_DIR/flash-tickets-web-dev-image.tar.gz
- Frontend bundle archive: $OUTPUT_DIR/web-dist.tar.gz
- VITE_API_BASE_URL: $VITE_API_BASE_URL
- Nginx config: nginx/default.web.conf
- Platform: $PLATFORM
INFO
