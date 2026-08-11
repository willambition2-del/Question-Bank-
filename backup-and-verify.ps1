$ErrorActionPreference = "Stop"

# 1. Ensure directory
New-Item -ItemType Directory -Force -Path "D:\three\backups" | Out-Null

# 2. Get connection string
$envLine = Get-Content D:\three\question-bank-api\.env | Where-Object { $_ -match "^DATABASE_URL=" }
$dbUrl = $envLine.Split("=", 2)[1].Trim('"')
$dbUrlNoSchema = $dbUrl.Split("?")[0]
$pgBin = "C:\Program Files\PostgreSQL\16\bin"
$backupFile = "D:\three\backups\question-bank-current-for-vps.dump"
$testDbName = "question_bank_test_restore"

# Extract connection string for the default 'postgres' database for createdb/dropdb
$baseDbUrl = $dbUrlNoSchema.Substring(0, $dbUrlNoSchema.LastIndexOf("/")) + "/postgres"

Write-Host "Creating backup..."
& "$pgBin\pg_dump.exe" --format=custom -d $dbUrlNoSchema -f $backupFile

$fileInfo = Get-Item $backupFile
$fileSize = "{0:N2} MB" -f ($fileInfo.Length / 1MB)
$sha256 = (Get-FileHash $backupFile -Algorithm SHA256).Hash

Write-Host "Running pg_restore --list..."
& "$pgBin\pg_restore.exe" --list $backupFile | Out-Null

Write-Host "Dropping test database if exists..."
& "$pgBin\psql.exe" -d $baseDbUrl -c "DROP DATABASE IF EXISTS $testDbName;" | Out-Null

Write-Host "Creating test database: $testDbName..."
& "$pgBin\psql.exe" -d $baseDbUrl -c "CREATE DATABASE $testDbName;" | Out-Null

Write-Host "Restoring to test database..."
$testDbUrl = $dbUrlNoSchema.Substring(0, $dbUrlNoSchema.LastIndexOf("/")) + "/" + $testDbName
$restoreOutput = & "$pgBin\pg_restore.exe" -d $testDbUrl $backupFile 2>&1

Write-Host "Verifying restore..."
$env:DATABASE_URL = $testDbUrl
node D:\three\question-bank-api\check-counts.js > test_counts.json

Write-Host "Dropping test database..."
# Disconnect from testDb first to avoid "database is being accessed by other users" if any lingering connection
& "$pgBin\psql.exe" -d $baseDbUrl -c "DROP DATABASE IF EXISTS $testDbName;" | Out-Null

Write-Host "Done!"
Write-Host "--- RESULT ---"
Write-Host "Backup path: $backupFile"
Write-Host "File size: $fileSize"
Write-Host "SHA-256: $sha256"

$counts = Get-Content test_counts.json | ConvertFrom-Json
$pass = $true
if ($counts.Questions -ne 19862) { $pass = $false }
if ($counts.Options -ne 42070) { $pass = $false }
if ($counts.QuestionSourceReference -ne 19841) { $pass = $false }
if ($counts.Subjects -ne 7) { $pass = $false }
if ($counts.Units -ne 40) { $pass = $false }
if ($counts.Lessons -ne 305) { $pass = $false }
if ($counts.Sources -ne 19) { $pass = $false }
if ($counts.ReadingPassages -ne 90) { $pass = $false }
if ($counts.ImportJobs -ne 1) { $pass = $false }

if ($pass) {
    Write-Host "Restore verification: PASS"
} else {
    Write-Host "Restore verification: FAIL"
}
Write-Host "Questions: $($counts.Questions)"
Write-Host "Options: $($counts.Options)"
Write-Host "SourceReferences: $($counts.QuestionSourceReference)"
Write-Host "Units: $($counts.Units)"
Write-Host "Lessons: $($counts.Lessons)"
Write-Host "Sources: $($counts.Sources)"
