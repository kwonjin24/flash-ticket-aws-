#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")"/.. && pwd)
cd "$ROOT_DIR"

PLATFORM=linux/amd64

run() {
  echo "> $*"
  "$@"
}

run pnpm install
run pnpm --dir web install

run pnpm --dir web build

run docker build --platform=$PLATFORM \
  -t flash-tickets-web:amd64 \
  -f Dockerfile.web .

OUTPUT_DIR="$ROOT_DIR/output/web-amd64"
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR"

run docker save -o "$OUTPUT_DIR/flash-tickets-web-amd64.tar" flash-tickets-web:amd64

cat <<INFO
Built web image (AMD64) and exported to $OUTPUT_DIR/flash-tickets-web-amd64.tar
INFO
