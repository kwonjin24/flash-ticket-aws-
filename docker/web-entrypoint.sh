#!/bin/sh
set -e

API_BASE_URL=${API_BASE_URL:-http://localhost:4000}
GATEWAY_BASE_URL=${GATEWAY_BASE_URL:-http://localhost:3000}

escaped_api=${API_BASE_URL//\//\\/}
escaped_api=${escaped_api//&/\\&}
escaped_gateway=${GATEWAY_BASE_URL//\//\\/}
escaped_gateway=${escaped_gateway//&/\\&}

find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.html' \) -print0 | while IFS= read -r -d '' file; do
  sed -i "s/__API_BASE_URL__/${escaped_api}/g" "$file"
  sed -i "s/__GATEWAY_BASE_URL__/${escaped_gateway}/g" "$file"
done

echo "Starting nginx with API_BASE_URL=$API_BASE_URL, GATEWAY_BASE_URL=$GATEWAY_BASE_URL"
exec "$@"
