$ErrorActionPreference = "Stop"
$deploy = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $deploy ".env.staging"
if (-not (Test-Path -LiteralPath $envFile)) { throw "deploy/.env.staging was not found" }
docker compose --env-file $envFile -f (Join-Path $deploy "docker-compose.staging.yml") down
