#!/usr/bin/env sh
set -eu
DEPLOY_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ENV_FILE="$DEPLOY_DIR/.env.staging"
if [ ! -f "$ENV_FILE" ]; then
  secret() { openssl rand -base64 "$1" | tr -d '\n'; }
  umask 077
  {
    echo "ADMIN_PUBLIC_URL=http://localhost:8080"
    echo "STAGING_HTTP_PORT=8080"
    echo "POSTGRES_USER=question_bank"
    echo "POSTGRES_PASSWORD=$(secret 32)"
    echo "POSTGRES_DB=question_bank_staging"
    echo "REDIS_PASSWORD=$(secret 32)"
    echo "JWT_ACCESS_SECRET=$(secret 48)"
    echo "JWT_REFRESH_SECRET=$(secret 48)"
    echo "PROVIDER_CREDENTIALS_MASTER_KEY=$(secret 32)"
    echo "CORS_ORIGINS=http://localhost:8080"
    echo "INTELLIGENT_SERVICES_ENABLED=true"
    echo "GOOGLE_AUTH_ENABLED=false"
    echo "GOOGLE_CLIENT_ID="
    echo "FCM_ENABLED=false"
    echo "OCR_ENABLED=true"
    echo "OCR_LANGUAGES=eng"
    echo "VECTOR_DIMENSIONS=1536"
    echo "EMBEDDING_BATCH_SIZE=16"
    echo "DOCUMENT_WORKER_CONCURRENCY=2"
    echo "QUESTION_IMPORT_ENABLED=false"
  } > "$ENV_FILE"
  echo "Created deploy/.env.staging with generated local secrets."
fi
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.staging.yml" up -d --build
docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.staging.yml" ps
echo "Staging is available at http://localhost:8080"
