#!/usr/bin/env sh
set -eu
DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$DEPLOY_DIR/.env.staging"
test -f "$ENV_FILE"
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.staging.yml" down
