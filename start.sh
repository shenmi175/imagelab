#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  ADMIN_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")"
  QUEUE_BOARD_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")"
  node -e "const fs=require('fs');let s=fs.readFileSync('.env','utf8');s=s.replace('change-this-to-a-long-random-secret', process.argv[1]);s=s.replace('ADMIN_PASSWORD=change-me-before-deploy', 'ADMIN_PASSWORD=' + process.argv[2]);s=s.replace('QUEUE_BOARD_PASSWORD=change-me-before-deploy', 'QUEUE_BOARD_PASSWORD=' + process.argv[3]);fs.writeFileSync('.env',s)" "$SECRET" "$ADMIN_PASSWORD" "$QUEUE_BOARD_PASSWORD"
  echo "Created .env with a random SESSION_SECRET."
  echo "Initial admin password: $ADMIN_PASSWORD"
  echo "Initial Bull Board password: $QUEUE_BOARD_PASSWORD"
fi

ensure_env() {
  local key="$1"
  local value="$2"
  if ! grep -q "^${key}=" .env; then
    printf "\n%s=%s\n" "$key" "$value" >> .env
  fi
}

ensure_env "NODE_IMAGE" "node:22-bookworm-slim"
ensure_env "POSTGRES_IMAGE" "postgres:16-alpine"
ensure_env "REDIS_IMAGE" "redis:7-alpine"
ensure_env "NPM_REGISTRY" "https://registry.npmjs.org/"

if grep -q "SUB2API_API_KEY=sk-change-me" .env; then
  echo "Warning: SUB2API_API_KEY is still the placeholder. The site will start, but image generation will fail until you update .env."
fi

docker compose up --build
