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

## iOS / Capacitor

La plateforme iOS est maintenant présente dans le projet.

Avant le premier build, ou après une modification des dépendances, lancer `npm install`.
Après l'ajout d'un plugin Capacitor, lancer `npm run ios` pour construire les assets et synchroniser aussi les dépendances natives CocoaPods. Le script `ios:debug` utilise `cap copy ios` et ne met pas à jour les Pods.

### Commandes utiles

- Build web iOS avec la bonne configuration Capacitor :
  - `npm run build:ios`

- Synchroniser le projet iOS :
  - `npm run sync:ios`

- Faire le build + sync iOS en une seule commande :
  - `npm run ios`

- Préparer un build iOS avec le mode développeur BLE :
  - `npm run ios:debug`
  - Incrémente automatiquement la version `-dev.N` avant le build si Git contient des changements, puis affiche la version générée à la fin, comme `android:debug`.
  - Puis relancer l'application sur l'iPhone depuis Xcode. Dans les paramètres de l'application, cinq appuis rapides sur la version activent le mode développeur pour cette session.

### Remarques importantes

- Sur Windows, ces commandes préparent correctement la partie Capacitor iOS, mais ne permettent pas de compiler l'application native.
- La finalisation iOS nécessite :
  - macOS
  - Xcode
  - CocoaPods

### Workflow recommandé

1. préparer les assets avec :
   - `npm run ios`
2. ouvrir ensuite le projet iOS sur un Mac
3. lancer les étapes natives Xcode / CocoaPods si nécessaire

### Archivage Xcode

Ouvrir `ios/App/App.xcworkspace`, sélectionner une destination iOS générique, puis lancer **Product > Archive**.

La version native est synchronisée depuis `package.json` par `npm run ios`, `npm run ios:debug`, les builds iOS et `npm run sync:ios`. Par exemple, `0.11.15-dev.366` devient **Version 0.11.15 / Build 367** : la version conserve les trois nombres, et le build vaut le compteur `dev` + 1. Une version sans suffixe utilise le build `1`.

Si seule la version du package a changé, lancer `npm run version:ios` avant d'archiver. L'action Archive seule ne relit pas `package.json`. Les archives déjà créées conservent leur ancienne version. Pour plusieurs envois d'une même version sur App Store Connect, veiller à augmenter le compteur `dev` afin d'obtenir un nouveau numéro de build.

Si `rsync` signale `../../../IntermediateBuildFilesPath/UninstalledProducts/iphoneos/Capacitor.framework: (l)stat: No such file or directory`, relancer `npm run sync:ios` puis l'archive. Le `Podfile` applique après génération des scripts le correctif CocoaPods de résolution des liens symboliques (`readlink -f`), nécessaire avec CocoaPods antérieur à 1.12.1.

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

- Build Android autorisant le mode développeur BLE (5 appuis rapides sur la version dans les paramètres pour afficher/masquer le panneau debug et le bouton Skip BLE) :
  - `npm run android:debug`

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
