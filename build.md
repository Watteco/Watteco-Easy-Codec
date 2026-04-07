# Build notes

## Browser / Web

Pour lancer le projet dans le navigateur en mode développement :

- `npm run dev`

Le serveur Vite affiche ensuite une URL locale à ouvrir dans le navigateur, généralement de type :

- `http://localhost:5173/EasyCodec/`

Pour faire un build web standard :

- `npm run build`

Pour prévisualiser localement le build web généré :

- `npm run preview`

## Android / Capacitor

Pour éviter les problèmes de `base path` sur Android, utiliser les scripts npm dédiés.

### Commandes utiles

- Build web Android avec la bonne configuration Capacitor :
  - `npm run build:android`

- Synchroniser le projet Android :
  - `npm run sync:android`

- Faire le build + sync Android en une seule commande :
  - `npm run android`

- Ouvrir le projet Android dans Android Studio :
  - `npm run open:android`

## Pourquoi ces scripts existent

Le projet utilise une base Vite différente selon le contexte :

- Web hébergé : `/EasyCodec/`
- Build Capacitor Android : `/`

Si on lance un build standard avant un `cap sync android`, les assets peuvent être générés avec un chemin du type :

- `/EasyCodec/assets/...`

Alors que Capacitor Android attend :

- `/assets/...`

Dans ce cas, l'application Android peut démarrer sur un écran vide avec des erreurs du type :

- `Unable to open asset URL: https://localhost/EasyCodec/assets/...`

## Recommandation

Pour Android, utiliser de préférence :

- `npm run android`

Puis ouvrir Android Studio si nécessaire avec :

- `npm run open:android`
