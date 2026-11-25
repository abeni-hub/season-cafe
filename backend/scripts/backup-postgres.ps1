[CmdletBinding()]
param(
    [string]$OutputDirectory = (Join-Path $env:USERPROFILE "SeasonCakeBackups")
)

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $projectRoot
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$containerFile = "/tmp/season-cake-$timestamp.dump"
$backupFile = Join-Path $OutputDirectory "season-cake-$timestamp.dump"

& docker compose exec -T db pg_dump -U season_cake -d season_cake -Fc --file $containerFile
if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL backup creation failed."
}

try {
    & docker compose cp "db:$containerFile" $backupFile
    if ($LASTEXITCODE -ne 0) {
        throw "Copying the PostgreSQL backup to the host failed."
    }
}
finally {
    & docker compose exec -T db rm -f $containerFile
}

Write-Output "Created backup: $backupFile"
