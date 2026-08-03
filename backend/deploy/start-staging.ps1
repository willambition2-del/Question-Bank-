$ErrorActionPreference = "Stop"
$deploy = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $deploy ".env.staging"
if (-not (Test-Path -LiteralPath $envFile)) {
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  function New-Secret([int]$bytes) {
    $buffer = New-Object byte[] $bytes
    $rng.GetBytes($buffer)
    return [Convert]::ToBase64String($buffer)
  }
  $lines = @(
    "ADMIN_PUBLIC_URL=http://localhost:8080",
    "STAGING_HTTP_PORT=8080",
    "POSTGRES_USER=question_bank",
    "POSTGRES_PASSWORD=$(New-Secret 32)",
    "POSTGRES_DB=question_bank_staging",
    "REDIS_PASSWORD=$(New-Secret 32)",
    "JWT_ACCESS_SECRET=$(New-Secret 48)",
    "JWT_REFRESH_SECRET=$(New-Secret 48)",
    "PROVIDER_CREDENTIALS_MASTER_KEY=$(New-Secret 32)",
    "CORS_ORIGINS=http://localhost:8080",
    "INTELLIGENT_SERVICES_ENABLED=true",
    "GOOGLE_AUTH_ENABLED=false",
    "GOOGLE_CLIENT_ID=",
    "FCM_ENABLED=false",
    "OCR_ENABLED=true",
    "OCR_LANGUAGES=eng",
    "VECTOR_DIMENSIONS=1536",
    "EMBEDDING_BATCH_SIZE=16",
    "DOCUMENT_WORKER_CONCURRENCY=2",
    "QUESTION_IMPORT_ENABLED=false"
  )
  [System.IO.File]::WriteAllLines($envFile, $lines, [System.Text.UTF8Encoding]::new($false))
  $rng.Dispose()
  Write-Host "Created deploy/.env.staging with generated local secrets."
}
docker compose --env-file $envFile -f (Join-Path $deploy "docker-compose.staging.yml") up -d --build
docker compose --env-file $envFile -f (Join-Path $deploy "docker-compose.staging.yml") ps
Write-Host "Staging is available at http://localhost:8080"
