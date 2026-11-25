[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = "High")]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [Parameter(Mandatory = $true)]
    [ValidatePattern("^[A-Za-z0-9_]+$")]
    [string]$TargetDatabase,
    [string]$AgeIdentityFile
)

$resolvedBackup = (Resolve-Path -LiteralPath $BackupFile).Path
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $projectRoot
$containerFile = "/tmp/season-cake-restore-$([guid]::NewGuid().ToString('N')).dump"

if ($PSCmdlet.ShouldProcess(
    "PostgreSQL database '$TargetDatabase'",
    "Replace its contents from '$resolvedBackup'"
)) {
    $restoreFile = $resolvedBackup
    $decryptedFile = $null
    try {
        if ([System.IO.Path]::GetExtension($resolvedBackup) -eq ".age") {
            if (-not $AgeIdentityFile) {
                throw "Provide -AgeIdentityFile to restore an encrypted backup."
            }
            $resolvedIdentity = (Resolve-Path -LiteralPath $AgeIdentityFile).Path
            Get-Command age -ErrorAction Stop | Out-Null
            $decryptedFile = Join-Path $env:TEMP "season-cake-restore-$([guid]::NewGuid().ToString('N')).dump"
            & age --decrypt --identity $resolvedIdentity --output $decryptedFile $resolvedBackup
            if ($LASTEXITCODE -ne 0) {
                throw "Decrypting the PostgreSQL backup failed."
            }
            $restoreFile = $decryptedFile
        }

        & docker compose cp $restoreFile "db:$containerFile"
        if ($LASTEXITCODE -ne 0) {
            throw "Copying the PostgreSQL backup into the database container failed."
        }

        try {
            & docker compose exec -T db pg_restore -U season_cake --dbname $TargetDatabase --clean --if-exists --no-owner $containerFile
            if ($LASTEXITCODE -ne 0) {
                throw "PostgreSQL restore failed."
            }
        }
        finally {
            & docker compose exec -T db rm -f $containerFile
        }
    }
    finally {
        if ($decryptedFile -and (Test-Path -LiteralPath $decryptedFile)) {
            Remove-Item -LiteralPath $decryptedFile -Force
        }
    }
}
