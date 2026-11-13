# Enregistrer ce fichier en "UTF-8 with BOM" pour que les accents fonctionnent dans le terminal

[CmdletBinding()]
param(
    [switch]$Revert,
    [switch]$ListBackups,
    [switch]$SkipBuild,
    [string]$BackupId,
    [ValidateRange(1, 2)]
    [int]$MaxBackups = 2
)

$ErrorActionPreference = "Stop"
$ConfigFile = Join-Path $PSScriptRoot "deploy.config.ps1"
$Source = Join-Path $PSScriptRoot "dist"

function Stop-Deployment {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Message,
        [int]$ExitCode = 1
    )

    Write-Error $Message -ErrorAction Continue
    exit $ExitCode
}

function Get-NormalizedExistingPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Description
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        Stop-Deployment "$Description n'existe pas : $Path"
    }

    return (Resolve-Path -LiteralPath $Path).Path
}

function Test-PathInside {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Child,
        [Parameter(Mandatory = $true)]
        [string]$Parent
    )

    $Separator = [IO.Path]::DirectorySeparatorChar
    $ParentPrefix = $Parent.TrimEnd($Separator, [IO.Path]::AltDirectorySeparatorChar) + $Separator
    return $Child.StartsWith($ParentPrefix, [StringComparison]::OrdinalIgnoreCase)
}

function Assert-SafeDestination {
    param(
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath
    )

    $Separator = [IO.Path]::DirectorySeparatorChar
    $TrimmedDestination = $DestinationPath.TrimEnd($Separator, [IO.Path]::AltDirectorySeparatorChar)
    $DestinationRoot = [IO.Path]::GetPathRoot($DestinationPath).TrimEnd($Separator, [IO.Path]::AltDirectorySeparatorChar)
    $RepositoryPath = (Resolve-Path -LiteralPath $PSScriptRoot).Path

    if ([string]::IsNullOrWhiteSpace($TrimmedDestination) -or
        $TrimmedDestination.Equals($DestinationRoot, [StringComparison]::OrdinalIgnoreCase)) {
        Stop-Deployment "La destination ne peut pas être la racine d'un disque : $DestinationPath"
    }

    if ($DestinationPath.Equals($RepositoryPath, [StringComparison]::OrdinalIgnoreCase) -or
        (Test-PathInside -Child $DestinationPath -Parent $RepositoryPath)) {
        Stop-Deployment "La destination ne peut pas être le dépôt ni un de ses sous-dossiers : $DestinationPath"
    }
}

function Invoke-Robocopy {
    param(
        [Parameter(Mandatory = $true)]
        [string]$From,
        [Parameter(Mandatory = $true)]
        [string]$To,
        [string[]]$ExcludedDirectories = @()
    )

    $Arguments = @(
        $From,
        $To,
        "/MIR",
        "/R:1",
        "/W:1",
        "/XJ",
        "/NP",
        "/XF", "thumbs.db", "desktop.ini"
    )

    if ($ExcludedDirectories.Count -gt 0) {
        $Arguments += "/XD"
        $Arguments += $ExcludedDirectories
    }

    & robocopy @Arguments | Out-Host
    return $LASTEXITCODE
}

function Get-BackupEntries {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRootPath
    )

    if (-not (Test-Path -LiteralPath $BackupRootPath -PathType Container)) {
        return @()
    }

    return @(
        Get-ChildItem -LiteralPath $BackupRootPath -Directory |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "site.zip") -PathType Leaf } |
            Sort-Object Name
    )
}

function Show-Backups {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [System.IO.DirectoryInfo[]]$Backups,
        [Parameter(Mandatory = $true)]
        [string]$PackageVersion
    )

    Write-Host "Version locale de package.json : v$PackageVersion"

    if ($Backups.Count -eq 0) {
        Write-Host "Aucune sauvegarde disponible."
        return
    }

    Write-Host ""
    Write-Host "Sauvegardes disponibles :"

    foreach ($Backup in ($Backups | Sort-Object Name -Descending)) {
        $ManifestPath = Join-Path $Backup.FullName "deployment.json"
        $Details = ""

        if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
            try {
                $Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
                $BackedUpVersion = if ([string]::IsNullOrWhiteSpace([string]$Manifest.backedUpVersion)) {
                    "inconnue"
                }
                else {
                    "v$($Manifest.backedUpVersion)"
                }
                $Details = " | version sauvegardée $BackedUpVersion | avant déploiement v$($Manifest.incomingVersion) | commit $($Manifest.incomingCommit)"
            }
            catch {
                $Details = " | manifeste illisible"
            }
        }

        Write-Host "  $($Backup.Name)$Details"
    }
}

function Remove-OldBackups {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRootPath,
        [Parameter(Mandatory = $true)]
        [int]$MaximumCount
    )

    $Backups = @(Get-BackupEntries -BackupRootPath $BackupRootPath)

    while ($Backups.Count -ge $MaximumCount) {
        $Oldest = $Backups | Sort-Object Name | Select-Object -First 1
        Write-Host "Suppression de la sauvegarde la plus ancienne : $($Oldest.Name)"
        Remove-Item -LiteralPath $Oldest.FullName -Recurse -Force
        $Backups = @(Get-BackupEntries -BackupRootPath $BackupRootPath)
    }
}

function Get-FileHashMap {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Root
    )

    $Map = @{}

    if (-not (Test-Path -LiteralPath $Root -PathType Container)) {
        return $Map
    }

    $RootPrefix = (Resolve-Path -LiteralPath $Root).Path.TrimEnd(
        [IO.Path]::DirectorySeparatorChar,
        [IO.Path]::AltDirectorySeparatorChar
    ) + [IO.Path]::DirectorySeparatorChar

    foreach ($File in Get-ChildItem -LiteralPath $Root -File -Recurse) {
        $RelativePath = $File.FullName.Substring($RootPrefix.Length)
        $Map[$RelativePath] = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash
    }

    return $Map
}

function Get-ServerConfigurationReport {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BuildRoot,
        [Parameter(Mandatory = $true)]
        [string]$ServerRoot
    )

    $Lines = [Collections.Generic.List[string]]::new()
    $Lines.Add("Comparaison des configurations avant déploiement")
    $Lines.Add("Date : $((Get-Date).ToString('o'))")
    $Lines.Add("")
    $DifferenceCount = 0

    foreach ($Folder in @("config", "localisation")) {
        $Lines.Add("[$Folder]")
        $BuildMap = Get-FileHashMap -Root (Join-Path $BuildRoot $Folder)
        $ServerMap = Get-FileHashMap -Root (Join-Path $ServerRoot $Folder)
        $AllPaths = @($BuildMap.Keys + $ServerMap.Keys | Sort-Object -Unique)
        $FolderDifferenceCount = 0

        foreach ($RelativePath in $AllPaths) {
            $InBuild = $BuildMap.ContainsKey($RelativePath)
            $OnServer = $ServerMap.ContainsKey($RelativePath)

            if ($OnServer -and -not $InBuild) {
                $Lines.Add("SERVEUR UNIQUEMENT : $RelativePath")
                $FolderDifferenceCount++
                $DifferenceCount++
            }
            elseif ($InBuild -and -not $OnServer) {
                $Lines.Add("BUILD UNIQUEMENT   : $RelativePath")
                $FolderDifferenceCount++
                $DifferenceCount++
            }
            elseif ($BuildMap[$RelativePath] -ne $ServerMap[$RelativePath]) {
                $Lines.Add("CONTENU DIFFÉRENT  : $RelativePath")
                $FolderDifferenceCount++
                $DifferenceCount++
            }
        }

        if ($FolderDifferenceCount -eq 0) {
            $Lines.Add("Aucune différence.")
        }

        $Lines.Add("")
    }

    if ($DifferenceCount -gt 0) {
        Write-Warning "$DifferenceCount différence(s) détectée(s) dans config/ et localisation/."
    }
    else {
        Write-Host "Aucune différence de configuration détectée entre le serveur et le build."
    }

    foreach ($Line in $Lines) {
        Write-Host $Line
    }

    return $Lines
}

function Backup-CurrentServerConfigurations {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServerRoot,
        [Parameter(Mandatory = $true)]
        [string]$BackupPath
    )

    if (Test-Path -LiteralPath $BackupPath) {
        Remove-Item -LiteralPath $BackupPath -Recurse -Force
    }

    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null

    foreach ($Folder in @("config", "localisation")) {
        $FolderSource = Join-Path $ServerRoot $Folder
        if (-not (Test-Path -LiteralPath $FolderSource -PathType Container)) {
            continue
        }

        $FolderDestination = Join-Path $BackupPath $Folder
        $ExitCode = Invoke-Robocopy -From $FolderSource -To $FolderDestination
        if ($ExitCode -ge 8) {
            throw "Échec de la sauvegarde de '$Folder'. Robocopy : $ExitCode"
        }
    }
}

function New-SiteBackupArchive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ServerRoot,
        [Parameter(Mandatory = $true)]
        [string]$BackupRootPath,
        [Parameter(Mandatory = $true)]
        [string]$ArchivePath
    )

    $ItemsToArchive = @(
        Get-ChildItem -LiteralPath $ServerRoot -Force |
            Where-Object { -not $_.FullName.Equals($BackupRootPath, [StringComparison]::OrdinalIgnoreCase) }
    )

    if ($ItemsToArchive.Count -eq 0) {
        throw "La production ne contient aucun fichier à sauvegarder."
    }

    Compress-Archive `
        -LiteralPath @($ItemsToArchive.FullName) `
        -DestinationPath $ArchivePath `
        -CompressionLevel Optimal `
        -Force

    if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf) -or
        (Get-Item -LiteralPath $ArchivePath).Length -eq 0) {
        throw "L'archive de sauvegarde est absente ou vide."
    }
}

function Restore-SiteBackupArchive {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ArchivePath,
        [Parameter(Mandatory = $true)]
        [string]$DestinationPath,
        [Parameter(Mandatory = $true)]
        [string]$BackupRootPath
    )

    if (-not (Test-Path -LiteralPath $ArchivePath -PathType Leaf)) {
        throw "Archive de sauvegarde introuvable : $ArchivePath"
    }

    $TemporaryRestorePath = Join-Path ([IO.Path]::GetTempPath()) "EasyCodec-restore-$([guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path $TemporaryRestorePath -Force | Out-Null

    try {
        Expand-Archive -LiteralPath $ArchivePath -DestinationPath $TemporaryRestorePath -Force

        if (-not (Test-Path -LiteralPath (Join-Path $TemporaryRestorePath "index.html") -PathType Leaf)) {
            throw "L'archive de sauvegarde ne contient pas index.html."
        }

        return Invoke-Robocopy `
            -From $TemporaryRestorePath `
            -To $DestinationPath `
            -ExcludedDirectories @($BackupRootPath)
    }
    finally {
        if (Test-Path -LiteralPath $TemporaryRestorePath) {
            Remove-Item -LiteralPath $TemporaryRestorePath -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
    Stop-Deployment "Fichier de configuration introuvable : $ConfigFile`nCopiez deploy.config.example.ps1 vers deploy.config.ps1 puis renseignez la destination."
}

. $ConfigFile

if ([string]::IsNullOrWhiteSpace($Destination)) {
    Stop-Deployment "La variable `$Destination n'est pas définie dans $ConfigFile"
}

$PackagePath = Join-Path $PSScriptRoot "package.json"
if (-not (Test-Path -LiteralPath $PackagePath -PathType Leaf)) {
    Stop-Deployment "package.json est introuvable : $PackagePath"
}

$Package = Get-Content -LiteralPath $PackagePath -Raw | ConvertFrom-Json
$Version = [string]$Package.version
$Commit = "unknown"

if ($null -ne (Get-Command git -ErrorAction SilentlyContinue)) {
    $GitResult = & git -C $PSScriptRoot rev-parse --short HEAD 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($GitResult)) {
        $Commit = $GitResult.Trim()
    }
}

$DestinationPath = Get-NormalizedExistingPath -Path $Destination -Description "Le dossier destination"
Assert-SafeDestination -DestinationPath $DestinationPath

$BackupRoot = Join-Path $DestinationPath "backups"
New-Item -ItemType Directory -Path $BackupRoot -Force | Out-Null
$BackupRoot = (Resolve-Path -LiteralPath $BackupRoot).Path

$LegacyBackupDirectories = @(
    Get-ChildItem -LiteralPath $BackupRoot -Directory |
        Where-Object { -not (Test-Path -LiteralPath (Join-Path $_.FullName "site.zip") -PathType Leaf) }
)

if ($LegacyBackupDirectories.Count -gt 0) {
    Write-Warning "$($LegacyBackupDirectories.Count) ancien(s) dossier(s) de sauvegarde ne sont pas gérés par la rotation automatique. Vérifiez-les avant de les supprimer manuellement."
}

if ($ListBackups) {
    Show-Backups -Backups @(Get-BackupEntries -BackupRootPath $BackupRoot) -PackageVersion $Version
    exit 0
}

if ($Revert) {
    $Backups = @(Get-BackupEntries -BackupRootPath $BackupRoot)

    if ($Backups.Count -eq 0) {
        Stop-Deployment "Aucune sauvegarde complète n'est disponible dans $BackupRoot"
    }

    Show-Backups -Backups $Backups -PackageVersion $Version

    if ([string]::IsNullOrWhiteSpace($BackupId)) {
        $SelectedBackup = $Backups | Sort-Object Name -Descending | Select-Object -First 1
    }
    else {
        if ([IO.Path]::GetFileName($BackupId) -ne $BackupId) {
            Stop-Deployment "BackupId doit être un nom de dossier simple."
        }

        $SelectedBackup = $Backups | Where-Object { $_.Name -eq $BackupId } | Select-Object -First 1
        if ($null -eq $SelectedBackup) {
            Stop-Deployment "Sauvegarde introuvable : $BackupId"
        }
    }

    $SelectedArchive = Join-Path $SelectedBackup.FullName "site.zip"
    $SelectedManifestPath = Join-Path $SelectedBackup.FullName "deployment.json"
    $SelectedVersion = "inconnue"

    if (Test-Path -LiteralPath $SelectedManifestPath -PathType Leaf) {
        try {
            $SelectedManifest = Get-Content -LiteralPath $SelectedManifestPath -Raw | ConvertFrom-Json
            if (-not [string]::IsNullOrWhiteSpace([string]$SelectedManifest.backedUpVersion)) {
                $SelectedVersion = "v$($SelectedManifest.backedUpVersion)"
            }
        }
        catch {
            $SelectedVersion = "inconnue"
        }
    }

    Write-Host ""
    Write-Warning "La production sera remplacée par la sauvegarde '$($SelectedBackup.Name)'."
    Write-Host "Version qui sera restaurée : $SelectedVersion"
    $Confirmation = Read-Host "Tapez 'revert' pour confirmer"
    if ($Confirmation.Trim().ToLowerInvariant() -ne "revert") {
        Write-Host "Restauration annulée."
        exit 0
    }

    $RescuePath = Join-Path $SelectedBackup.FullName "server-config-before-revert"
    Write-Host "Sauvegarde des configurations actuelles dans $RescuePath"
    try {
        Backup-CurrentServerConfigurations -ServerRoot $DestinationPath -BackupPath $RescuePath
    }
    catch {
        Stop-Deployment $_.Exception.Message
    }

    Write-Host "Restauration de '$($SelectedBackup.Name)'..."
    try {
        $RestoreExitCode = Restore-SiteBackupArchive `
            -ArchivePath $SelectedArchive `
            -DestinationPath $DestinationPath `
            -BackupRootPath $BackupRoot
    }
    catch {
        Stop-Deployment $_.Exception.Message
    }

    if ($RestoreExitCode -ge 8) {
        Stop-Deployment "Échec de la restauration. Robocopy : $RestoreExitCode" $RestoreExitCode
    }

    Write-Host "Restauration terminée avec succès."
    exit 0
}

Write-Host ""
Write-Host "ATTENTION : ce script va effectuer une synchronisation miroir vers la production."
Write-Host "Les fichiers présents uniquement dans la destination seront supprimés."
Write-Host "Une sauvegarde complète sera créée dans $BackupRoot."
Write-Host "Nombre maximal de sauvegardes complètes : $MaxBackups"
Write-Host ""

$Confirmation = Read-Host "Êtes-vous sûr ? Tapez 'y' pour continuer"
if ($Confirmation.Trim().ToLowerInvariant() -ne "y") {
    Write-Host "Opération annulée."
    exit 0
}

if (-not $SkipBuild) {
    Write-Host ""
    Write-Host "Création du build de production..."

    if ($null -eq (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
        Stop-Deployment "npm.cmd est introuvable."
    }

    Push-Location $PSScriptRoot
    try {
        & npm.cmd run build
        $BuildExitCode = $LASTEXITCODE
    }
    finally {
        Pop-Location
    }

    if ($BuildExitCode -ne 0) {
        Stop-Deployment "Échec du build de production. npm : $BuildExitCode" $BuildExitCode
    }
}

$SourcePath = Get-NormalizedExistingPath -Path $Source -Description "Le dossier source"

if (-not (Test-Path -LiteralPath (Join-Path $SourcePath "index.html") -PathType Leaf)) {
    Stop-Deployment "Le build ne contient pas index.html : $SourcePath"
}

if ($SourcePath.Equals($DestinationPath, [StringComparison]::OrdinalIgnoreCase) -or
    (Test-PathInside -Child $SourcePath -Parent $DestinationPath)) {
    Stop-Deployment "Le dossier source ne peut pas être identique à la destination ni se trouver à l'intérieur."
}

$CurrentDeploymentVersion = "unknown"
$CurrentDeploymentCommit = "unknown"
$CurrentDeploymentPath = Join-Path $DestinationPath "deployment.json"

if (Test-Path -LiteralPath $CurrentDeploymentPath -PathType Leaf) {
    try {
        $CurrentDeployment = Get-Content -LiteralPath $CurrentDeploymentPath -Raw | ConvertFrom-Json
        if (-not [string]::IsNullOrWhiteSpace([string]$CurrentDeployment.version)) {
            $CurrentDeploymentVersion = [string]$CurrentDeployment.version
        }
        if (-not [string]::IsNullOrWhiteSpace([string]$CurrentDeployment.commit)) {
            $CurrentDeploymentCommit = [string]$CurrentDeployment.commit
        }
    }
    catch {
        Write-Warning "Le fichier deployment.json actuellement en production est illisible. La version sauvegardée sera indiquée comme inconnue."
    }
}

$IncomingDeployment = [ordered]@{
    version = $Version
    commit = $Commit
    deployedAt = (Get-Date).ToString("o")
}

$IncomingDeployment |
    ConvertTo-Json |
    Set-Content -LiteralPath (Join-Path $SourcePath "deployment.json") -Encoding UTF8

$ConfigurationReport = @(Get-ServerConfigurationReport -BuildRoot $SourcePath -ServerRoot $DestinationPath)

Remove-OldBackups -BackupRootPath $BackupRoot -MaximumCount $MaxBackups

$SafeVersion = $Version -replace '[^A-Za-z0-9._-]', '_'
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss-fff"
$NewBackupId = "$Timestamp-before-v$SafeVersion"
$NewBackupRoot = Join-Path $BackupRoot $NewBackupId
$NewBackupArchive = Join-Path $NewBackupRoot "site.zip"
$NewBackupConfigurations = Join-Path $NewBackupRoot "server-config"

New-Item -ItemType Directory -Path $NewBackupRoot -Force | Out-Null

Write-Host ""
Write-Host "Sauvegarde complète de la production vers :"
Write-Host "  $NewBackupArchive"

try {
    Backup-CurrentServerConfigurations `
        -ServerRoot $DestinationPath `
        -BackupPath $NewBackupConfigurations

    New-SiteBackupArchive `
        -ServerRoot $DestinationPath `
        -BackupRootPath $BackupRoot `
        -ArchivePath $NewBackupArchive
}
catch {
    Remove-Item -LiteralPath $NewBackupRoot -Recurse -Force -ErrorAction SilentlyContinue
    Stop-Deployment $_.Exception.Message
}

$Manifest = [ordered]@{
    backupId = $NewBackupId
    createdAt = (Get-Date).ToString("o")
    backedUpVersion = $CurrentDeploymentVersion
    backedUpCommit = $CurrentDeploymentCommit
    incomingVersion = $Version
    incomingCommit = $Commit
    destination = $DestinationPath
}

$Manifest |
    ConvertTo-Json |
    Set-Content -LiteralPath (Join-Path $NewBackupRoot "deployment.json") -Encoding UTF8

$ConfigurationReport |
    Set-Content -LiteralPath (Join-Path $NewBackupRoot "server-overrides.txt") -Encoding UTF8

Write-Host ""
Write-Host "Synchronisation miroir..."
Write-Host "$SourcePath"
Write-Host " -> $DestinationPath"

$DeployExitCode = Invoke-Robocopy `
    -From $SourcePath `
    -To $DestinationPath `
    -ExcludedDirectories @($BackupRoot)

if ($DeployExitCode -ge 8) {
    Write-Warning "Le déploiement a échoué. Restauration automatique de la sauvegarde en cours..."

    try {
        $RollbackExitCode = Restore-SiteBackupArchive `
            -ArchivePath $NewBackupArchive `
            -DestinationPath $DestinationPath `
            -BackupRootPath $BackupRoot
    }
    catch {
        Stop-Deployment "Le déploiement et la restauration automatique ont échoué. Déploiement : $DeployExitCode. Restauration : $($_.Exception.Message)" $DeployExitCode
    }

    if ($RollbackExitCode -ge 8) {
        Stop-Deployment "Le déploiement et la restauration automatique ont échoué. Déploiement : $DeployExitCode, restauration : $RollbackExitCode" $RollbackExitCode
    }

    Stop-Deployment "Le déploiement a échoué, mais la production précédente a été restaurée. Robocopy : $DeployExitCode" $DeployExitCode
}

Write-Host ""
Write-Host "Déploiement de la version $Version terminé avec succès."
Write-Host "Sauvegarde créée : $NewBackupId"
exit 0
