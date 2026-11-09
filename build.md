# Notes de build

La procédure détaillée pour lancer, construire et héberger la version web se
trouve dans le
[guide d'installation et d'hébergement local](localizedReadme/installation-locale.md).

## Web

```shell
npm ci
npm run dev      # serveur de développement
npm run build    # build de production dans dist/
npm run preview  # validation locale du build uniquement
```

Le build web utilise actuellement le chemin de base `/EasyCodec/`.

