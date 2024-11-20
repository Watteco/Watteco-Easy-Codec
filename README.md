# Watteco Easy Codec

**Watteco Easy Codec** (nom provisoire) est une application intuitive conçue pour simplifier la configuration et l'utilisation des capteurs IoT de Watteco. L'objectif principal de ce projet est de proposer une alternative allégée et user-friendly au codec en ligne existant, en se concentrant sur les fonctionnalités essentielles, tout en modernisant l'interface utilisateur.

## Objectifs du Projet

1. **Simplification** : Réduire la complexité des configurations en ne conservant que les fonctions principales les plus fréquemment utilisées par les utilisateurs lambda.
2. **Accessibilité** : Proposer une interface utilisateur moderne et intuitive, adaptée à tous les types d'utilisateurs, indépendamment de leur expertise technique.
3. **Portabilité** :
   - Une application web accessible via navigateur.
   - Des versions standalone pour Windows et macOS grâce à [Electron](https://www.electronjs.org/).
   - Des applications mobiles pour Android et iOS.
4. **Support Avancé** :
   - Intégration de la configuration **par FOTA (Firmware Over-The-Air)** pour la version PC.
   - Support de la configuration **par NFC (Near Field Communication)** pour les versions mobiles.

## Fonctionnalités Actuelles

### Version Web
Le projet est actuellement hébergé à l'adresse suivante : [Watteco Easy Codec](https://lora.watteco.fr/EasyCodec/).

#### Fonctionnalités Implémentées :
- **Interface Simplifiée** : Une UI modernisée avec une gestion dynamique des capteurs.
- **Chargement des Configurations** : 
  - Gestion des paramètres depuis des fichiers JSON.
  - Affichage des configurations spécifiques à chaque capteur.
- **Support de Plusieurs Capteurs** : Bien que non exhaustif pour le moment, les principaux capteurs de Watteco sont pris en charge.

## Stack Technique

### Frameworks et Technologies
- **Ionic** : Utilisé pour développer une interface moderne et responsive.
- **Vue.js** : Framework JavaScript pour la gestion des états et composants réactifs.
- **Electron** : Prévu pour la version standalone (hors ligne).
- **Android/iOS** : Les versions mobiles seront construites à partir du projet Ionic.
- **FOTA** : Pour la mise à jour et la configuration des capteurs sur la version PC.
- **NFC** : Pour la configuration des capteurs sur les versions mobiles.

### Organisation des Fichiers
- **Front-End** : Basé sur Ionic et Vue.js, avec une architecture modulaire.
- **Assets** : Les fichiers JSON de configuration nécessaires sont stockés dans un répertoire `config`.

## État Actuel

### Version Développement
La version de développement peut être lancée localement avec `ionic serve` et prend en charge :
- Les fonctionnalités principales de configuration.
- Le chargement dynamique des paramètres.

### Version Production
La version web fonctionnelle est accessible via : [https://lora.watteco.fr/EasyCodec/](https://lora.watteco.fr/EasyCodec/). Elle est actuellement en cours de tests avec une prise en charge limitée de capteurs.

## Développement Futur

Les prochaines étapes de développement incluent :
1. **Support Complet des Capteurs** : Intégrer la totalité des capteurs Watteco et leurs configurations.
2. **Versions Mobiles et PC** : 
   - Packager l'application avec Electron pour Windows/macOS.
   - Générer des applications Android et iOS via Ionic Capacitor.
3. **FOTA et NFC** :
   - Intégrer la configuration FOTA dans la version standalone PC.
   - Activer la configuration NFC dans les versions mobiles.

---

Ce README a pour but de fournir une vue d'ensemble du projet **Watteco Easy Codec**. Bien que ce projet soit hébergé sur un dépôt GitHub, il ne vise pas actuellement à accueillir des contributions externes.

