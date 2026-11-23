# Copier ce fichier en "deploy.config.ps1" et renseigner les valeurs manquantes.
# Le compte SFTP doit être limité au dossier Tools. Le chemin distant est donc relatif à Tools.

$SftpHost = "ssh.cluster128.hosting.ovh.net"
$SftpPort = 22
$SftpUserName = "votre-login"
$SftpPassword = ""
$SshHostKeyFingerprint = ""
$RemotePath = "EasyCodec"
$PublicBaseUrl = "https://support.watteco.com/Tools/EasyCodec/"

# Facultatif : chemin vers WinSCPnet.dll ou vers le dossier qui le contient.
# Le paquet d'automatisation WinSCP est requis. Sous PowerShell 7, le script préfère netstandard2.0.
# $WinSCPPath = "C:\\Tools\\WinSCP"

# Facultatif : les sauvegardes sont placées dans .deploy-backups par défaut.
# $BackupRoot = "D:\\Backups\\EasyCodec"
