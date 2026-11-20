# Notes de build

La procédure détaillée pour lancer, construire et héberger la version web se
trouve dans le
[guide d'installation et d'hébergement local](docs/local-installation.md).

## Web

```shell
npm ci
npm run dev      # serveur de développement
npm run build    # build de production dans dist/
npm run preview  # validation locale du build uniquement
```

Le build web utilise actuellement le chemin de base `/EasyCodec/`.

Chaque build web génère aussi `version.json`. La version web vérifie ce fichier
sans cache au chargement, au retour sur l'onglet et toutes les cinq minutes. Un
numéro de version différent déclenche une seule tentative de rechargement
automatique au démarrage. S'il apparaît pendant l'utilisation, un bouton de
mise à jour permet de recharger l'application sans dépendre du cache de la page
parente ou de son iframe.

### Déploiement en production

Pour une nouvelle livraison web, choisir le numéro puis le saisir une seule
fois depuis la racine du dépôt. npm met à jour `package.json` et
`package-lock.json` ensemble.

```powershell
npm.cmd version 0.11.20 --no-git-tag-version
git add -- package.json package-lock.json
git commit -m "chore: release EasyCodec Web 0.11.20"
.\deployToProd.ps1
```

Vérifier que Git est propre avant le déploiement. Le script inscrit la version
web et le commit courant dans `deployment.json`. Pour relancer un déploiement
interrompu, reprendre le même commit et relancer le script directement.

Le script PowerShell construit l'application, sauvegarde la production actuelle,
puis synchronise `dist/` vers la destination configurée :

```powershell
.\deployToProd.ps1
```

Deux sauvegardes complètes sont conservées par défaut dans le dossier `backups`
de la destination. La limite peut être ramenée à une sauvegarde :

```powershell
.\deployToProd.ps1 -MaxBackups 1
```

Le script compare également les dossiers `config/` et `localisation/` du serveur
avec ceux du build. Le rapport est enregistré dans `server-overrides.txt` avec
la sauvegarde afin de retrouver les fichiers modifiés directement en production.

Pour consulter les sauvegardes disponibles :

```powershell
.\deployToProd.ps1 -ListBackups
```

La commande affiche la version du `package.json` local et, lorsqu'elle est
connue, la version contenue dans chaque sauvegarde. Le script déploie un fichier
`deployment.json` pour identifier précisément les versions lors des prochains
backups et rollbacks.

Pour restaurer la sauvegarde la plus récente :

```powershell
.\deployToProd.ps1 -Revert
```

Une sauvegarde précise peut être sélectionnée avec son identifiant :

```powershell
.\deployToProd.ps1 -Revert -BackupId "20261113-162045-000-before-v0.11.17"
```

Le build automatique peut être ignoré si `dist/` contient déjà le build web
validé pour la version à déployer :

```powershell
.\deployToProd.ps1 -SkipBuild
```

## Versions de l'application BLE

`app-version.json` contient la version mobile commune à Android et iOS.
`version` est la version produit. `buildNumber` sert de numéro natif
pour Android et les builds iOS de release. Il reste à `1` jusqu'à la
première publication officielle. `devNumber` identifie les itérations debug
à partir de `d1` et sert de numéro natif aux builds iOS de dev.

### Itérations locales de dev

Sur Windows, lancer `npm run android:debug`. Sur le Mac, lancer
`npm run ios:debug`. Si Git contient des changements, la commande incrémente
uniquement `devNumber` avant de construire les assets, par exemple de
`0.12.0d41` à `0.12.0d42`. Ce numéro s'affiche dans l'application et
à la fin de la commande.
Chaque relance avec des changements locaux prend le numéro suivant, y compris
après un échec de compilation. Avec un dépôt propre, la commande utilise le
numéro du commit courant.

### Préparer une livraison mobile

- Pour le **premier build**, utiliser les valeurs `0.12.0` et `1` déjà
  enregistrées.
- Pour **préparer un build de dev commun aux deux machines**, lancer
  sur une seule machine
  `npm run version:app:next`. La commande exige un dépôt Git propre et
  incrémente uniquement `devNumber` dans `app-version.json`.
- Pour la **première publication officielle**, choisir `version` à la main
  et utiliser `buildNumber: 1`. Pour les mises à jour publiées, augmenter
  `buildNumber` à la main, y compris lors des changements de version produit.

Après une modification de `app-version.json`, synchroniser les réglages
Xcode sur la machine qui prépare la livraison. Cette commande fonctionne aussi
sous Windows.

```shell
npm run version:ios
git add -- app-version.json ios/App/App.xcodeproj/project.pbxproj
git commit -m "chore: prepare BLE app 0.12.0d42"
git push
```

Adapter le message de commit aux valeurs choisies, puis récupérer **le même
commit** sur les deux machines. Pour les builds de test avec le mode
développeur BLE, lancer `npm run android:debug` sur Windows et
`npm run ios:debug` sur le Mac. Pour préparer les assets de release,
utiliser `npm run android` et `npm run ios`. Terminer la compilation native
dans Android Studio ou Xcode. Une compilation relancée depuis le même
commit avec un dépôt propre réutilise le numéro attribué à la livraison.

## iOS / Capacitor

La plateforme iOS est maintenant présente dans le projet.

Avant le premier build, ou après une modification des dépendances, lancer `npm install`.
Après l'ajout d'un plugin Capacitor, lancer `npm run ios` pour construire les assets et synchroniser aussi les dépendances natives CocoaPods. Le script `ios:debug` utilise `cap copy ios` et ne met pas à jour les Pods.

Si `pod install` échoue avec `ffi_c.bundle` et `incompatible architecture (have 'x86_64', need 'arm64e' or 'arm64')`, vérifier quel CocoaPods est utilisé avec `which pod`. Sur ce Mac, Ruby et CocoaPods ARM sont déjà installés via Homebrew. Pour les sélectionner dans le terminal courant :

```sh
export PATH="/opt/homebrew/opt/ruby/bin:/opt/homebrew/lib/ruby/gems/4.0.0/bin:$PATH"
pod --version
npm run sync:ios
```

Le chemin des exécutables des gems dépend de la version Ruby installée. Après une mise à jour de Ruby, le vérifier avec `ruby -r rubygems -e 'puts Gem.bindir'`.

### Commandes utiles

- Build web iOS avec la bonne configuration Capacitor :
  - `npm run build:ios`

- Synchroniser le projet iOS :
  - `npm run sync:ios`

- Faire le build + sync iOS en une seule commande :
  - `npm run ios`

- Préparer un build iOS avec le mode développeur BLE :
  - `npm run ios:debug`
  - Affiche la version et le numéro de build à la fin de la copie des assets.
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

Les commandes de build et de synchro iOS appliquent les valeurs de
`app-version.json` au projet Xcode. L'action **Archive** lit les réglages
du projet. Si tu as édité le JSON depuis la dernière préparation des assets,
relance `npm run ios` ou `npm run ios:debug` avant d'archiver pour que la
version soit aussi à jour dans l'interface.

### TestFlight

Sur le Mac, lancer `npm run ios:debug`, puis créer l'archive dans Xcode.
Xcode reçoit `version` et `devNumber` comme numéro de build. L'itération
`0.12.0d1` peut ainsi être archivée en `0.12.0 (1)`, et `0.12.0d42` en
`0.12.0 (42)`.

Si tu dois téléverser un nouveau binaire depuis un dépôt propre alors que
l'itération courante est déjà sur TestFlight, prépare un nouveau compteur avec
`npm run version:app:next` et committe `app-version.json` avant `ios:debug`.
Si des builds ont déjà été envoyés avec un autre compteur, augmente au besoin
`devNumber` pour que le nouveau numéro natif dépasse le dernier envoyé pour
cette version.

Le numéro TestFlight est écrit dans les réglages Xcode locaux. Pour revenir
aux réglages standards, lancer `npm run version:ios` avant de committer le
projet Xcode. Pour préparer la publication officielle, `npm run ios`
réapplique aussi le `buildNumber` commun depuis `app-version.json`.
Pour téléverser un nouveau binaire officiel avec le build `1`, choisir une
version produit distincte de celle utilisée pour les essais TestFlight,
par exemple `1.0.0` après `0.12.0`.

Si `rsync` signale `../../../IntermediateBuildFilesPath/UninstalledProducts/iphoneos/Capacitor.framework: (l)stat: No such file or directory`, relancer `npm run sync:ios` puis l'archive. Le `Podfile` applique après génération des scripts le correctif CocoaPods de résolution des liens symboliques (`readlink -f`), nécessaire avec CocoaPods antérieur à 1.12.1.

## Android / Capacitor

Pour éviter les problèmes de `base path` sur Android, utiliser les scripts npm dédiés.

Après `npm run android:debug`, les infos système Android affichent le
numéro exact des assets embarqués, par exemple `0.12.0d42`. Cette version
est visible même si l'app ne démarre pas. `npm run android` prépare les
assets de release, dont la version système est `0.12.0`.

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
