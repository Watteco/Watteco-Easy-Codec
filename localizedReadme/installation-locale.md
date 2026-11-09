# Installation et hébergement local

[→ In English](../docs/local-installation.md)

Ce guide concerne la version **web** actuelle.

## 1. Choisir le mode d'utilisation

- **Développement** : exécuter les sources avec Vite et le rechargement
  automatique.
- **Hébergement client/intranet** : construire l'application une fois, puis
  publier le contenu statique de `dist/` avec un serveur HTTP(S).
- **Livraison hors connexion** : fournir le dossier `dist/` généré et un
  serveur web statique local. Node.js n'est pas nécessaire sur le poste client
  lorsque le build lui est directement fourni.

L'ouverture directe de `dist/index.html` depuis le système de fichiers n'est
pas prise en charge.

## 2. Prérequis

Pour travailler à partir des sources :

- Git ;
- Node.js 18 ou supérieur ;
- npm ;
- un accès au registre npm lors de l'installation initiale des dépendances.

Vérifier les versions installées avec :

```shell
node --version
npm --version
```

## 3. Lancer le serveur de développement

Depuis la racine du dépôt :

```shell
npm ci
npm run dev
```

L'application est ensuite disponible à l'adresse :

```text
http://localhost:5173/EasyCodec/
```

`npm ci` garantit une installation reproductible à partir de
`package-lock.json`.
Sous Windows PowerShell, utiliser `npm.cmd` à la place de `npm` si la stratégie
d'exécution du système bloque le script intermédiaire `npm.ps1`.

### Accéder au serveur depuis un autre poste du réseau local

```shell
npm run dev -- --host 0.0.0.0
```

Depuis l'autre poste, ouvrir `http://<ip-du-poste>:5173/EasyCodec/`. Le port
doit être autorisé par le pare-feu du système. Ce mode est destiné au
développement et aux démonstrations temporaires, pas à la production.

## 4. Construire et valider la version de production

```shell
npm ci
npm run build
```

Les fichiers à déployer sont générés dans `dist/`. Pour valider ce build
localement :

```shell
npm run preview
```

`npm run preview` est un serveur de vérification, pas un serveur de production.

## 5. Héberger l'application chez un client

Publier le **contenu** de `dist/` avec un serveur HTTP(S), sous l'adresse :

```text
https://<serveur>/EasyCodec/
```

Le chemin de base Vite `/EasyCodec/` est actuellement fixé dans le build. Le
serveur web doit donc :

1. exposer les fichiers statiques sous `/EasyCodec/` ;
2. servir directement les ressources et fichiers JSON existants ;
3. renvoyer `/EasyCodec/index.html` pour les routes de l'application qui ne
   correspondent pas à un fichier ou dossier (repli SPA).

Un fichier Apache `.htaccess` réalisant ce repli est copié dans `dist/`. Il
nécessite `mod_rewrite` et l'autorisation d'utiliser les surcharges
`.htaccess`. Des règles équivalentes sont nécessaires avec Nginx, IIS ou un
autre serveur.

Pour déployer à la racine `/` ou sous un autre chemin, modifier `base` dans
`vite.config.ts` et `RewriteBase` dans `public/.htaccess`, puis reconstruire
l'application. `VITE_BASE_URL` ne configure pas actuellement le chemin de
base.

Pour une installation intranet, vérifier également le DNS ou l'adresse IP, le
pare-feu du serveur, les ports d'écoute et le certificat TLS si HTTPS est
utilisé.

## 6. Mettre à jour les configurations sans rebuild

Les fichiers de `public/` sont copiés tels quels dans `dist/` pendant le build.
Après déploiement, les personnes chargées de la configuration peuvent donc
mettre à jour :

- `config/*.json` pour les configurations des capteurs ;
- `config/AvailableProductList.json` pour la liste des produits ;
- `localisation/*.json` pour les traductions.

Ces chemins sont relatifs au dossier `EasyCodec` déployé. Pour apparaître dans
l'application, un produit doit contenir `"EasyCodec"` dans son tableau `apps`.
Conserver une sauvegarde et valider la syntaxe JSON avant toute publication.

Les modifications dans `src/`, les changements de dépendances et les réglages
Vite nécessitent toujours un nouveau `npm run build`.

## 7. Fonctionnement hors connexion

La logique de l'application, les styles, les images, les traductions et les
fichiers de configuration des capteurs sont inclus dans le build statique.
L'application principale peut donc fonctionner sur un réseau isolé une fois
hébergée localement.

Certains liens facultatifs renvoient vers le support Watteco et le favicon est
chargé depuis `lora.watteco.fr` ; ces ressources ne seront pas disponibles sans
accès à Internet. Une construction depuis les sources nécessite également que
les dépendances soient accessibles depuis npm ou un miroir/cache interne.

## 8. Checklist de déploiement

- `npm run build` se termine sans erreur.
- Le contenu de `dist/` est publié sous `/EasyCodec/`.
- `/EasyCodec/` se charge en HTTP(S).
- L'accès direct et le rafraîchissement de `/EasyCodec/tabs/downlink`
  fonctionnent.
- `/EasyCodec/config/AvailableProductList.json` renvoie du JSON.
- `/EasyCodec/localisation/fr_FR.json` renvoie du JSON.
- La console du navigateur ne contient pas d'erreur de ressource ou de JSON
  manquant.

Les causes habituelles d'une page blanche sont un déploiement sous le mauvais
chemin de base, l'absence de règle de repli SPA, ou des fichiers manquants dans
`config/` ou `localisation/`.
