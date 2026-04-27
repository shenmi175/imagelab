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

upgrade_env_default() {
  local key="$1"
  local old_value="$2"
  local new_value="$3"
  if grep -q "^${key}=${old_value}$" .env; then
    sed -i "s/^${key}=${old_value}$/${key}=${new_value}/" .env
  fi
}

ensure_env "NODE_IMAGE" "node:22-bookworm-slim"
ensure_env "POSTGRES_IMAGE" "postgres:16-alpine"
ensure_env "REDIS_IMAGE" "redis:7-alpine"
ensure_env "NPM_REGISTRY" "https://registry.npmjs.org/"
ensure_env "DEFAULT_IMAGE_BACKGROUND" "auto"
ensure_env "DEFAULT_IMAGE_MODERATION" "auto"
ensure_env "RATE_LIMIT_FEEDBACK_USER_HOUR" "10"
ensure_env "WORKER_STOP_GRACE_PERIOD" "20m"
ensure_env "WORKER_ORPHANED_RUNNING_GRACE_SECONDS" "120"
ensure_env "WORKER_HEARTBEAT_TTL_SECONDS" "90"
ensure_env "WORKER_HEARTBEAT_INTERVAL_SECONDS" "30"
ensure_env "RECONCILE_INTERVAL_SECONDS" "30"
upgrade_env_default "RUNNING_JOB_STALE_SECONDS" "960" "180"
upgrade_env_default "RECONCILE_INTERVAL_SECONDS" "60" "30"

if grep -q "SUB2API_API_KEY=sk-change-me" .env; then
  echo "Warning: SUB2API_API_KEY is still the placeholder. The site will start, but image generation will fail until you update .env."
fi

usage() {
  cat <<'EOF'
Usage: ./start.sh [app|worker|all|follow]

  app     Build/restart only the web app. This is the safest default for UI/admin changes.
  worker  Build/restart only the worker. Docker will wait for the current job to finish.
  all     Build/restart the full stack.
  follow  Build/restart the full stack in the foreground.

When no mode is provided, the script starts the full stack on first run and app-only after
the stack is already running, so ongoing image jobs are not interrupted by routine UI deploys.
EOF
}

mode="${1:-auto}"
case "$mode" in
  -h|--help|help)
    usage
    exit 0
    ;;
  auto)
    if docker compose ps --status running --services 2>/dev/null | grep -qx "worker"; then
      mode="app"
    else
      mode="all"
    fi
    ;;
esac

case "$mode" in
  app)
    echo "Deploying app only. Running worker jobs will continue."
    docker compose up -d --build app
    ;;
  worker)
    echo "Deploying worker only. Current worker jobs will be allowed to finish before shutdown."
    docker compose up -d --build worker
    ;;
  all)
    echo "Deploying full stack. Worker uses a long stop grace period to protect running jobs."
    docker compose up -d --build
    ;;
  follow)
    echo "Deploying full stack in foreground."
    docker compose up --build
    ;;
  *)
    echo "Unknown mode: $mode" >&2
    usage >&2
    exit 2
    ;;
esac
