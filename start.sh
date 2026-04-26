#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  cp .env.example .env
  SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"
  ADMIN_PASSWORD="$(node -e "console.log(require('crypto').randomBytes(18).toString('base64url'))")"
  node -e "const fs=require('fs');let s=fs.readFileSync('.env','utf8');s=s.replace('change-this-to-a-long-random-secret', process.argv[1]);s=s.replace('change-me-before-deploy', process.argv[2]);fs.writeFileSync('.env',s)" "$SECRET" "$ADMIN_PASSWORD"
  echo "Created .env with a random SESSION_SECRET."
  echo "Initial admin password: $ADMIN_PASSWORD"
fi

if grep -q "SUB2API_API_KEY=sk-change-me" .env; then
  echo "Warning: SUB2API_API_KEY is still the placeholder. The site will start, but image generation will fail until you update .env."
fi

docker compose up --build
