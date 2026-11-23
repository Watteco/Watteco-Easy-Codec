param(
    [switch]$Revert,
    [switch]$ListBackups,
    [switch]$SkipBuild,
    [switch]$ScanHostKey,
    [switch]$ListRemote,
    [string]$BackupId,
    [ValidateRange(1, 20)]
    [int]$MaxBackups = 2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# L'installation Windows de WinSCP fournit une assembly .NET Framework qui
# n'est pas compatible avec PowerShell 7. Sous Windows, relancer le script avec
# Windows PowerShell 5.1 permet de conserver la commande de déploiement habituelle.
if ($PSVersionTable.PSEdition -eq "Core" -and $env:WINDIR) {
    $WindowsPowerShell = Join-Path $env:WINDIR "System32\WindowsPowerShell\v1.0\powershell.exe"
    if (Test-Path -LiteralPath $WindowsPowerShell -PathType Leaf) {
        $ForwardedArguments = [Collections.Generic.List[string]]::new()
        foreach ($Entry in $PSBoundParameters.GetEnumerator()) {
            if ($Entry.Value -is [Management.Automation.SwitchParameter]) {
                if ($Entry.Value.IsPresent) {
                    $ForwardedArguments.Add("-$($Entry.Key)")
                }
            } else {
                $ForwardedArguments.Add("-$($Entry.Key)")
                $ForwardedArguments.Add([string]$Entry.Value)
            }
        }

        & $WindowsPowerShell `
            -NoProfile `
            -ExecutionPolicy Bypass `
            -File $PSCommandPath `
            @ForwardedArguments
        exit $LASTEXITCODE
    }
}

$ConfigFile = Join-Path $PSScriptRoot "deploy.config.ps1"
$ExampleConfigFile = Join-Path $PSScriptRoot "deploy.config.example.ps1"
$DistPath = Join-Path $PSScriptRoot "dist"
$PackageFile = Join-Path $PSScriptRoot "package.json"

function Stop-Deployment {
    param([string]$Message)
    throw $Message
}

function Get-ConfiguredValue {
    param([Parameter(Mandatory)][string]$Name, $DefaultValue = $null)
    $Variable = Get-Variable -Name $Name -Scope Script -ErrorAction SilentlyContinue
    if ($null -eq $Variable) { return $DefaultValue }
    return $Variable.Value
}

function Assert-RequiredText {
    param([string]$Name, [AllowNull()][object]$Value)
    if ($null -eq $Value -or [string]::IsNullOrWhiteSpace([string]$Value)) {
        Stop-Deployment "La variable `$$Name doit être renseignée dans $ConfigFile"
    }
}

function Get-NormalizedRemotePath {
    param([string]$Path)
    Assert-RequiredText -Name "RemotePath" -Value $Path
    $Normalized = $Path.Trim().Replace("\", "/").Trim("/")
    $Parts = @($Normalized.Split("/") | Where-Object { $_ -ne "" })
    if ($Normalized -eq "" -or $Parts -contains "." -or $Parts -contains "..") {
        Stop-Deployment "Chemin distant refusé : '$Path'. Il doit désigner uniquement le dossier EasyCodec."
    }
    return $Normalized
}

function Join-RemotePath {
    param([string]$Parent, [string]$Child)
    return "$($Parent.TrimEnd('/'))/$($Child.TrimStart('/'))"
}

function Get-RemoteSitePath {
    param($Session)
    return Join-RemotePath -Parent $Session.HomePath -Child $Script:RemotePath
}

function Resolve-WinSCPAssembly {
    $ConfiguredPath = Get-ConfiguredValue -Name "WinSCPPath"
    $Candidates = [Collections.Generic.List[string]]::new()
    foreach ($BasePath in @($ConfiguredPath, $env:WINSCP_PATH)) {
        if ([string]::IsNullOrWhiteSpace([string]$BasePath)) { continue }
        if ([IO.Path]::GetExtension([string]$BasePath) -eq ".dll") {
            $Candidates.Add([string]$BasePath)
        } else {
            if ($PSVersionTable.PSEdition -eq "Core") {
                $Candidates.Add((Join-Path ([string]$BasePath) "netstandard2.0\WinSCPnet.dll"))
            }
            $Candidates.Add((Join-Path ([string]$BasePath) "WinSCPnet.dll"))
        }
    }
    if ($PSVersionTable.PSEdition -eq "Core") {
        $Candidates.Add((Join-Path $PSScriptRoot "tools\WinSCP\netstandard2.0\WinSCPnet.dll"))
    }
    $Candidates.Add((Join-Path $PSScriptRoot "tools\WinSCP\WinSCPnet.dll"))
    if (${env:ProgramFiles(x86)}) {
        $Candidates.Add((Join-Path ${env:ProgramFiles(x86)} "WinSCP\WinSCPnet.dll"))
    }
    if ($env:ProgramFiles) {
        $Candidates.Add((Join-Path $env:ProgramFiles "WinSCP\WinSCPnet.dll"))
    }
    if ($env:LOCALAPPDATA) {
        $Candidates.Add((Join-Path $env:LOCALAPPDATA "Programs\WinSCP\WinSCPnet.dll"))
    }

    $AssemblyPath = $Candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
    if (-not $AssemblyPath) {
        Stop-Deployment @"
WinSCPnet.dll est introuvable. Installez le paquet d'automatisation WinSCP, puis renseignez `$WinSCPPath dans $ConfigFile.
Sous PowerShell 7, utilisez de préférence le dossier contenant netstandard2.0\WinSCPnet.dll.
"@
    }
    $AssemblyDirectory = Split-Path -Parent $AssemblyPath
    $ExecutableCandidates = @(
        (Join-Path $AssemblyDirectory "WinSCP.exe"),
        (Join-Path (Split-Path -Parent $AssemblyDirectory) "WinSCP.exe")
    )
    $Script:WinSCPExecutablePath = $ExecutableCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1
    if (-not $Script:WinSCPExecutablePath) {
        Stop-Deployment "WinSCP.exe est introuvable à côté de WinSCPnet.dll : $AssemblyPath"
    }
    Add-Type -Path $AssemblyPath
    return $AssemblyPath
}

function New-SftpSessionOptions {
    param([switch]$WithoutCredentials)
    $Options = [WinSCP.SessionOptions]::new()
    $Options.Protocol = [WinSCP.Protocol]::Sftp
    $Options.HostName = $Script:SftpHost
    $Options.PortNumber = $Script:SftpPort
    $Options.UserName = $Script:SftpUserName
    if (-not $WithoutCredentials) {
        $Options.SecurePassword = ConvertTo-SecureString $Script:SftpPassword -AsPlainText -Force
        $Options.SshHostKeyFingerprint = $Script:SshHostKeyFingerprint
    }
    return $Options
}

function Open-SftpSession {
    $Session = [WinSCP.Session]::new()
    $Session.ExecutablePath = $Script:WinSCPExecutablePath
    try {
        $Session.Open((New-SftpSessionOptions))
        return $Session
    } catch {
        $Session.Dispose()
        throw
    }
}

function New-TransferOptions {
    $Options = [WinSCP.TransferOptions]::new()
    $Options.TransferMode = [WinSCP.TransferMode]::Binary
    $Options.PreserveTimestamp = $true
    return $Options
}

function Receive-RemoteSite {
    param($Session, [string]$LocalPath)
    New-Item -ItemType Directory -Path $LocalPath -Force | Out-Null
    $RemoteSitePath = Get-RemoteSitePath -Session $Session
    $Result = $Session.SynchronizeDirectories(
        [WinSCP.SynchronizationMode]::Local,
        $LocalPath,
        $RemoteSitePath,
        $true,
        $true,
        [WinSCP.SynchronizationCriteria]::Either,
        (New-TransferOptions)
    )
    $Result.Check()
}

function Send-Site {
    param($Session, [string]$LocalPath)
    $RemoteSitePath = Get-RemoteSitePath -Session $Session
    $Result = $Session.SynchronizeDirectories(
        [WinSCP.SynchronizationMode]::Remote,
        $LocalPath,
        $RemoteSitePath,
        $true,
        $true,
        [WinSCP.SynchronizationCriteria]::Either,
        (New-TransferOptions)
    )
    $Result.Check()
}

function Get-RemoteVersion {
    param($Session)
    $TemporaryFile = Join-Path ([IO.Path]::GetTempPath()) "EasyCodec-version-$([guid]::NewGuid().ToString('N')).json"
    try {
        $RemoteVersionPath = Join-RemotePath -Parent (Get-RemoteSitePath -Session $Session) -Child "version.json"
        $Result = $Session.GetFiles(
            [WinSCP.RemotePath]::EscapeFileMask($RemoteVersionPath),
            $TemporaryFile,
            $false,
            (New-TransferOptions)
        )
        $Result.Check()
        return (Get-Content -LiteralPath $TemporaryFile -Raw | ConvertFrom-Json).version
    } finally {
        Remove-Item -LiteralPath $TemporaryFile -Force -ErrorAction SilentlyContinue
    }
}

function Get-BackupEntries {
    if (-not (Test-Path -LiteralPath $Script:BackupRoot -PathType Container)) { return @() }
    return @(
        Get-ChildItem -LiteralPath $Script:BackupRoot -Directory |
            Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName "site.zip") -PathType Leaf } |
            Sort-Object Name -Descending
    )
}

function Show-Backups {
    $Backups = @(Get-BackupEntries)
    if ($Backups.Count -eq 0) {
        Write-Host "Aucune sauvegarde locale dans $Script:BackupRoot"
        return
    }
    Write-Host "Sauvegardes locales :"
    foreach ($Backup in $Backups) {
        $ManifestPath = Join-Path $Backup.FullName "deployment.json"
        $Version = "inconnue"
        if (Test-Path -LiteralPath $ManifestPath -PathType Leaf) {
            try {
                $Version = (Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json).backedUpVersion
                if ([string]::IsNullOrWhiteSpace([string]$Version)) { $Version = "inconnue" }
            } catch { $Version = "manifeste illisible" }
        }
        Write-Host " - $($Backup.Name) (version $Version)"
    }
}

function Remove-OldBackups {
    $Backups = @(Get-BackupEntries)
    if ($Backups.Count -lt $MaxBackups) { return }
    $Backups | Select-Object -Skip ($MaxBackups - 1) | ForEach-Object {
        Write-Host "Suppression de l'ancienne sauvegarde locale $($_.Name)"
        Remove-Item -LiteralPath $_.FullName -Recurse -Force
    }
}

function Get-FileHashMap {
    param([string]$Root)
    $Map = @{}
    if (-not (Test-Path -LiteralPath $Root -PathType Container)) { return $Map }
    $RootPrefix = (Resolve-Path -LiteralPath $Root).ProviderPath.TrimEnd("\") + "\"
    foreach ($File in Get-ChildItem -LiteralPath $Root -File -Recurse) {
        $RelativePath = $File.FullName.Substring($RootPrefix.Length).Replace("\", "/")
        $Map[$RelativePath] = (Get-FileHash -LiteralPath $File.FullName -Algorithm SHA256).Hash
    }
    return $Map
}

function Show-ConfigurationDifferences {
    param([string]$BuildRoot, [string]$CurrentRoot)
    foreach ($Folder in @("config", "localisation")) {
        $BuildFiles = Get-FileHashMap -Root (Join-Path $BuildRoot $Folder)
        $CurrentFiles = Get-FileHashMap -Root (Join-Path $CurrentRoot $Folder)
        $AllFiles = @($BuildFiles.Keys + $CurrentFiles.Keys | Sort-Object -Unique)
        foreach ($File in $AllFiles) {
            $State = if (-not $BuildFiles.ContainsKey($File)) {
                "uniquement sur le serveur"
            } elseif (-not $CurrentFiles.ContainsKey($File)) {
                "nouveau dans le build"
            } elseif ($BuildFiles[$File] -ne $CurrentFiles[$File]) {
                "différent"
            } else { $null }
            if ($State) { Write-Warning "$Folder/$File : $State" }
        }
    }
}

function New-ZipFromDirectory {
    param([string]$SourcePath, [string]$ArchivePath)
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    if (Test-Path -LiteralPath $ArchivePath) { Remove-Item -LiteralPath $ArchivePath -Force }
    [IO.Compression.ZipFile]::CreateFromDirectory(
        $SourcePath,
        $ArchivePath,
        [IO.Compression.CompressionLevel]::Optimal,
        $false
    )
}

function New-LocalBackup {
    param([string]$SnapshotPath, [string]$NewVersion)
    New-Item -ItemType Directory -Path $Script:BackupRoot -Force | Out-Null
    Remove-OldBackups
    $Id = Get-Date -Format "yyyyMMdd-HHmmss"
    $BackupPath = Join-Path $Script:BackupRoot $Id
    New-Item -ItemType Directory -Path $BackupPath -Force | Out-Null
    $CurrentVersion = "inconnue"
    $CurrentVersionFile = Join-Path $SnapshotPath "version.json"
    if (Test-Path -LiteralPath $CurrentVersionFile -PathType Leaf) {
        try { $CurrentVersion = (Get-Content -LiteralPath $CurrentVersionFile -Raw | ConvertFrom-Json).version }
        catch { $CurrentVersion = "inconnue" }
    }
    New-ZipFromDirectory -SourcePath $SnapshotPath -ArchivePath (Join-Path $BackupPath "site.zip")
    $Manifest = [ordered]@{
        id = $Id
        createdAt = (Get-Date).ToString("o")
        backedUpVersion = $CurrentVersion
        targetVersion = $NewVersion
        destination = "sftp://$($Script:SftpHost):$($Script:SftpPort)/$($Script:RemotePath)"
    }
    $Manifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $BackupPath "deployment.json") -Encoding utf8
    return $BackupPath
}

function Restore-Backup {
    param($Session, [string]$ArchivePath)
    $RestorePath = Join-Path ([IO.Path]::GetTempPath()) "EasyCodec-restore-$([guid]::NewGuid().ToString('N'))"
    try {
        Expand-Archive -LiteralPath $ArchivePath -DestinationPath $RestorePath -Force
        Send-Site -Session $Session -LocalPath $RestorePath
    } finally {
        Remove-Item -LiteralPath $RestorePath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path -LiteralPath $ConfigFile -PathType Leaf)) {
    Stop-Deployment "Fichier de configuration introuvable : $ConfigFile`nCopiez $ExampleConfigFile vers deploy.config.ps1 puis renseignez les valeurs."
}
. $ConfigFile

$Script:SftpHost = [string](Get-ConfiguredValue -Name "SftpHost")
$Script:SftpPort = [int](Get-ConfiguredValue -Name "SftpPort" -DefaultValue 22)
$Script:SftpUserName = [string](Get-ConfiguredValue -Name "SftpUserName")
$Script:SftpPassword = [string](Get-ConfiguredValue -Name "SftpPassword")
$Script:SshHostKeyFingerprint = [string](Get-ConfiguredValue -Name "SshHostKeyFingerprint")
$Script:RemotePath = Get-NormalizedRemotePath -Path ([string](Get-ConfiguredValue -Name "RemotePath"))
$Script:PublicBaseUrl = [string](Get-ConfiguredValue -Name "PublicBaseUrl")
$ConfiguredBackupRoot = Get-ConfiguredValue -Name "BackupRoot"
$Script:BackupRoot = if ([string]::IsNullOrWhiteSpace([string]$ConfiguredBackupRoot)) {
    Join-Path $PSScriptRoot ".deploy-backups"
} else { [IO.Path]::GetFullPath([string]$ConfiguredBackupRoot) }

Assert-RequiredText -Name "SftpHost" -Value $Script:SftpHost
Assert-RequiredText -Name "SftpUserName" -Value $Script:SftpUserName

if ($ListBackups) {
    Show-Backups
    exit 0
}

Resolve-WinSCPAssembly | Out-Null

if ($ScanHostKey) {
    $Session = [WinSCP.Session]::new()
    $Session.ExecutablePath = $Script:WinSCPExecutablePath
    try {
        $Fingerprint = $Session.ScanFingerprint((New-SftpSessionOptions -WithoutCredentials), "SHA-256")
        Write-Host "Empreinte présentée par le serveur :"
        Write-Host $Fingerprint
        Write-Host "Vérifiez-la auprès de l'administrateur avant de la copier dans `$SshHostKeyFingerprint."
    } finally { $Session.Dispose() }
    exit 0
}

Assert-RequiredText -Name "SftpPassword" -Value $Script:SftpPassword
Assert-RequiredText -Name "SshHostKeyFingerprint" -Value $Script:SshHostKeyFingerprint

if ($ListRemote) {
    $Session = Open-SftpSession
    try {
        Write-Host "Dossier d'arrivée SFTP : $($Session.HomePath)"
        Write-Host "Contenu du dossier d'arrivée :"
        $Session.ListDirectory($Session.HomePath).Files |
            Where-Object { $_.Name -notin @(".", "..") } |
            ForEach-Object {
                $Type = if ($_.IsDirectory) { "dossier" } else { "fichier" }
                Write-Host " - $($_.Name) ($Type)"
            }
        $RemoteSitePath = Get-RemoteSitePath -Session $Session
        $IndexPath = Join-RemotePath -Parent $RemoteSitePath -Child "index.html"
        if ($Session.FileExists($IndexPath)) {
            Write-Host "Site EasyCodec trouvé : $RemoteSitePath"
        } else {
            Write-Warning "Le dossier cible ne contient pas index.html : $RemoteSitePath"
        }
    } finally {
        $Session.Dispose()
    }
    exit 0
}

if ($Revert) {
    $Backups = @(Get-BackupEntries)
    if ($Backups.Count -eq 0) { Stop-Deployment "Aucune sauvegarde locale à restaurer dans $Script:BackupRoot" }
    $SelectedBackup = if ([string]::IsNullOrWhiteSpace($BackupId)) {
        $Backups[0]
    } else { $Backups | Where-Object Name -eq $BackupId | Select-Object -First 1 }
    if (-not $SelectedBackup) { Stop-Deployment "Sauvegarde introuvable : $BackupId" }
    $Confirmation = Read-Host "Restaurer $($SelectedBackup.Name) sur $($Script:RemotePath) ? Tapez OUI"
    if ($Confirmation -ne "OUI") { Stop-Deployment "Restauration annulée." }
    $Session = Open-SftpSession
    try {
        Restore-Backup -Session $Session -ArchivePath (Join-Path $SelectedBackup.FullName "site.zip")
        Write-Host "Restauration terminée : $($SelectedBackup.Name)"
    } finally { $Session.Dispose() }
    exit 0
}

if (-not (Test-Path -LiteralPath $PackageFile -PathType Leaf)) { Stop-Deployment "package.json est introuvable." }
$Package = Get-Content -LiteralPath $PackageFile -Raw | ConvertFrom-Json
$Version = [string]$Package.version

$Confirmation = Read-Host "Déployer la version $Version vers $($Script:RemotePath) ? Tapez OUI"
if ($Confirmation -ne "OUI") {
    Write-Host "Déploiement annulé."
    exit 0
}

if (-not $SkipBuild) {
    Write-Host "Construction de la version $Version..."
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { Stop-Deployment "Le build a échoué avec le code $LASTEXITCODE." }
}
if (-not (Test-Path -LiteralPath (Join-Path $DistPath "index.html") -PathType Leaf)) {
    Stop-Deployment "Le dossier dist n'est pas prêt. Relancez sans -SkipBuild."
}

$DeploymentManifest = [ordered]@{
    version = $Version
    deployedAt = (Get-Date).ToString("o")
    commit = (& git rev-parse --short HEAD 2>$null)
}
$DeploymentManifest | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $DistPath "deployment.json") -Encoding utf8

$SnapshotPath = Join-Path ([IO.Path]::GetTempPath()) "EasyCodec-current-$([guid]::NewGuid().ToString('N'))"
$Session = $null
$BackupPath = $null
try {
    $Session = Open-SftpSession
    Write-Host "Téléchargement de la version actuellement en ligne..."
    Receive-RemoteSite -Session $Session -LocalPath $SnapshotPath
    if (-not (Test-Path -LiteralPath (Join-Path $SnapshotPath "index.html") -PathType Leaf)) {
        Stop-Deployment "Aucun site EasyCodec valide trouvé dans $($Script:RemotePath). Déploiement interrompu pour éviter une mauvaise cible."
    }
    Show-ConfigurationDifferences -BuildRoot $DistPath -CurrentRoot $SnapshotPath
    $BackupPath = New-LocalBackup -SnapshotPath $SnapshotPath -NewVersion $Version
    Write-Host "Sauvegarde locale créée : $BackupPath"
    Write-Host "Envoi de la version $Version vers $($Script:RemotePath)..."
    try {
        Send-Site -Session $Session -LocalPath $DistPath
        $RemoteVersion = Get-RemoteVersion -Session $Session
        if ($RemoteVersion -ne $Version) {
            throw "La vérification distante retourne la version '$RemoteVersion' au lieu de '$Version'."
        }
    } catch {
        Write-Warning "Le déploiement a échoué. Restauration automatique de la sauvegarde..."
        Restore-Backup -Session $Session -ArchivePath (Join-Path $BackupPath "site.zip")
        throw
    }
    Write-Host "Déploiement terminé et vérifié."
    Write-Host "Version : $Version"
    Write-Host "Destination : sftp://$($Script:SftpHost):$($Script:SftpPort)/$($Script:RemotePath)"
    if (-not [string]::IsNullOrWhiteSpace($Script:PublicBaseUrl)) {
        Write-Host "URL : $($Script:PublicBaseUrl)"
    }
} finally {
    if ($null -ne $Session) { $Session.Dispose() }
    Remove-Item -LiteralPath $SnapshotPath -Recurse -Force -ErrorAction SilentlyContinue
}
