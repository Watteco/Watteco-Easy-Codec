# Enregistrer ce fichier en "UTF-8 with  BOM" pour que les accents fonctionnent dans le terminal

$ConfigFile = Join-Path $PSScriptRoot "deploy.config.ps1"

if (-not (Test-Path $ConfigFile)) {
    Write-Error "Fichier de configuration introuvable : $ConfigFile"
    Write-Host "Copiez deploy.config.example.ps1 vers deploy.config.ps1 puis renseignez la destination."
    exit 1
}

. $ConfigFile

if ([string]::IsNullOrWhiteSpace($Destination)) {
    Write-Error "La variable `$Destination n'est pas définie dans $ConfigFile"
    exit 1
}

$Source = Join-Path $PSScriptRoot "dist"
$BackupRoot = Join-Path $Destination "backups"
$Timestamp = Get-Date -Format "ddMMyyyyHHmm"

Write-Host ""
Write-Host "ATTENTION : ce script va effectuer une synchronisation miroir vers la prod."
Write-Host "Les fichiers présents uniquement dans la destination seront supprimés."
Write-Host "L'état actuel sera perdu."
Write-Host "Une sauvegarde des fichiers de config sera effectuée dans $BackupRoot."
Write-Host ""

$Confirmation = Read-Host "Êtes-vous sûr ? Tapez 'y' pour continuer"

if ($Confirmation.Trim().ToLower() -ne "y") {
    Write-Host "Opération annulée."
    exit 0
}

# ------------------------------------------------------------
# Vérifications
# ------------------------------------------------------------

if (-not (Test-Path $Source)) {
    Write-Error "Le dossier source n'existe pas : $Source"
    exit 1
}

if (-not (Test-Path $Destination)) {
    Write-Error "Le dossier destination n'existe pas : $Destination"
    exit 1
}

New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null


# ------------------------------------------------------------
# Sauvegarde des dossiers config et localisation
# ------------------------------------------------------------

$FoldersToBackup = @(
    "config",
    "localisation"
)

foreach ($Folder in $FoldersToBackup) {

    $BackupSource = Join-Path $Destination $Folder
    $BackupDestination = Join-Path $BackupRoot "$Folder - $Timestamp"

    if (-not (Test-Path $BackupSource)) {
        Write-Error "Le dossier à sauvegarder n'existe pas : $BackupSource"
        exit 1
    }

    Write-Host ""
    Write-Host "Sauvegarde de $Folder vers :"
    Write-Host "  $BackupDestination"

    robocopy `
        $BackupSource `
        $BackupDestination `
        /E `
        /R:1 `
        /W:1 `
        /XJ `
        /NP

    if ($LASTEXITCODE -ge 8) {
        Write-Error "Échec de la sauvegarde de '$Folder'. Robocopy : $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}


# ------------------------------------------------------------
# Synchronisation miroir
# ------------------------------------------------------------

Write-Host ""
Write-Host "Synchronisation miroir..."
Write-Host "$Source"
Write-Host " -> $Destination"

robocopy `
    $Source `
    $Destination `
    /MIR `
    /XD $BackupRoot `
    /XF "thumbs.db" "desktop.ini" `
    /R:1 `
    /W:1 `
    /XJ `
    /NP

$RoboCopyExitCode = $LASTEXITCODE

if ($RoboCopyExitCode -ge 8) {
    Write-Error "Erreur pendant la synchronisation. Robocopy : $RoboCopyExitCode"
    exit $RoboCopyExitCode
}

Write-Host ""
Write-Host "Synchronisation terminée avec succès."
exit 0