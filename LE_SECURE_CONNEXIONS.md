# Compatibilité LE Secure Connections

## Contexte actuel

- Plugin BLE utilisé : `@capacitor-community/bluetooth-le` v6.1.0
- L'application gère aujourd'hui le scan, la connexion et l'écriture BLE
- Une première implémentation Android du pairing / bonding est désormais en place
- Android est présent dans le projet
- La plateforme iOS Capacitor est maintenant présente dans le projet

---

## Objectif

Rendre l'application compatible avec **LE Secure Connections (LESC)** sur **Android** et **iOS**.

LESC est géré en grande partie par l'OS, mais l'application doit correctement :

- déclencher ou accompagner le pairing
- gérer les erreurs d'authentification BLE
- informer l'utilisateur pendant la phase de sécurisation
- prévoir le comportement spécifique à Android et à iOS

---

## Travaux à prévoir côté applicatif

### 1. Mettre en place le bonding avant ou pendant la connexion BLE

Statut : **implémenté côté Android**

Dans la logique de connexion BLE, l'application :

- appelle `BleClient.createBond(deviceId)` sur Android avant `BleClient.connect()` si nécessaire
- prévoit un branchement conditionnel par plateforme
- conserve le comportement standard iOS à implémenter plus tard, où le pairing est généralement déclenché automatiquement par le système

Point d'entrée concerné :

- [src/composables/useBle.ts](src/composables/useBle.ts)

---

### 2. Gérer les erreurs GATT liées à l'authentification

Statut : **implémentation partielle côté Android**

Lors des écritures BLE, certains périphériques sécurisés peuvent refuser l'accès tant que la liaison n'est pas chiffrée.

Il faudra gérer notamment les cas de type :

- `GATT_INSUFFICIENT_AUTHENTICATION`
- `GATT_INSUFFICIENT_ENCRYPTION`

Dans ce cas, l'application doit :

- tenter ou relancer le bonding
- refaire une tentative d'écriture après sécurisation
- remonter un message clair à l'utilisateur si le pairing échoue

Remarque :

- le plugin ne remonte pas des codes GATT très détaillés dans tous les cas
- la récupération actuelle repose donc sur une détection heuristique des erreurs de bond / pairing / chiffrement

Zone de code concernée :

- [src/composables/useBle.ts](src/composables/useBle.ts)

---

### 3. Ajouter un état UI dédié au pairing

Statut : **implémenté côté Android**

Il est conseillé d'ajouter un état réactif du type :

- `pairing`
- `bondingInProgress`
- ou équivalent

Cela permettra de :

- désactiver temporairement certaines actions utilisateur
- afficher un message du type « Appairage sécurisé en cours »
- éviter de lancer des écritures avant la fin de la sécurisation

Remarque :

- un état `pairing` est présent
- il est déjà exploité dans l'UI BLE Android

---

### 4. Prévoir la persistance ou la vérification du bond

Statut : **implémenté côté Android**

Sur Android, il sera utile de :

- vérifier si un périphérique est déjà bondé avec `BleClient.isBonded(deviceId)` si disponible
- éviter de relancer un pairing inutile
- éventuellement mémoriser les périphériques déjà associés

Remarque :

- une mémoire locale des périphériques bondés est maintenant utilisée côté application
- cette mémoire est revalidée avec `isBonded()` quand c'est possible

---

## Travaux spécifiques Android

### 1. Permissions

Le manifeste Android semble déjà correctement préparé pour le BLE moderne :

- `BLUETOOTH`
- `BLUETOOTH_ADMIN`
- `BLUETOOTH_SCAN`
- `BLUETOOTH_CONNECT`
- `ACCESS_FINE_LOCATION`

Fichier concerné :

- [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml)

À noter :

- `BLUETOOTH_CONNECT` est indispensable pour le bonding
- aucune permission système spéciale supplémentaire n'est normalement accessible à une application tierce

---

### 2. Vérifier le support matériel et OS

Le projet cible actuellement :

- `minSdkVersion = 22`
- `targetSdkVersion = 34`

Fichier concerné :

- [android/variables.gradle](android/variables.gradle)

Cela est cohérent avec une prise en charge Android moderne du BLE, mais la compatibilité réelle LESC dépendra aussi :

- du téléphone
- de sa pile Bluetooth
- et surtout du périphérique BLE Watteco

---

### 3. Gérer les cas de bond perdu ou invalide

Statut : **implémenté partiellement côté Android**

Sur Android, la logique actuelle commence à gérer les cas où :

- le capteur a été réinitialisé
- le téléphone pense être bondé alors que le périphérique ne l'est plus
- la connexion retourne une erreur GATT atypique

Dans ce cas, la stratégie actuelle est :

- oubli du bond mémorisé côté application
- nouveau `createBond()`
- nouvelle tentative de connexion ou d'écriture

Limite connue :

- le plugin utilisé ne fournit pas d'API publique `removeBond()`
- si les futurs tests réels montrent que cela ne suffit pas, un complément natif Android pourra devenir nécessaire

---

### 4. Support avancé du pairing (optionnel)

Si certains périphériques exigent un flux particulier de pairing (passkey, numeric comparison, confirmation explicite), il pourra être nécessaire d'ajouter :

- un composant natif Android
- un `BroadcastReceiver` sur les événements de pairing
- un pont Capacitor personnalisé

Ce point est **optionnel** tant que le dialogue système Android suffit.

---

## Travaux spécifiques iOS

### 1. Ajouter la plateforme iOS au projet

Statut : **implémenté côté structure Capacitor**

Le dossier `ios/` est maintenant présent dans le projet.

Déjà fait :

- installer la plateforme iOS Capacitor
- ajouter le projet iOS
- synchroniser les ressources Capacitor

Reste à faire sur machine Apple :

- ouvrir le projet dans Xcode
- installer les dépendances natives avec CocoaPods si nécessaire
- vérifier la compilation réelle sur simulateur ou device iOS

---

### 2. Déclarer les permissions Bluetooth dans `Info.plist`

Statut : **implémenté**

Les clés suivantes sont maintenant présentes dans le projet iOS :

- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription` (selon la cible et la compatibilité recherchée)

Fichier concerné :

- [ios/App/App/Info.plist](ios/App/App/Info.plist)

---

### 3. S'appuyer sur le pairing système iOS

Statut : **à valider sur matériel Apple**

Sur iOS, CoreBluetooth gère généralement le pairing sécurisé automatiquement.

En pratique, cela implique :

- pas de `createBond()` explicite comme sur Android
- apparition d'un dialogue système iOS si le périphérique l'exige
- besoin d'une UI applicative claire pour informer l'utilisateur

Remarque :

- aucune logique spécifique équivalente à `createBond()` n'est à ajouter côté TypeScript pour iOS à ce stade
- la validation réelle dépendra d'un test sur iPhone / iPad compatible

---

### 4. Vérifier la version cible iOS

Statut : **déjà conforme dans la configuration générée**

Le projet iOS généré est actuellement configuré avec une cible minimale iOS `13.0`.

Il faudra encore s'assurer que :

- la version minimale iOS choisie est compatible avec Capacitor 6
- la pile CoreBluetooth supporte correctement le comportement attendu avec les capteurs concernés

Fichiers concernés :

- [ios/App/Podfile](ios/App/Podfile)
- [ios/App/App.xcodeproj/project.pbxproj](ios/App/App.xcodeproj/project.pbxproj)

---

### 5. Workflow iOS à utiliser maintenant

Depuis le projet, les commandes disponibles sont :

- `npm run build:ios`
- `npm run sync:ios`
- `npm run ios`

Sur Windows, ces commandes permettent de :

- générer les assets web avec la bonne base Capacitor
- synchroniser ces assets dans le projet iOS
- maintenir la structure iOS à jour

Mais la compilation native complète nécessite ensuite :

- macOS
- Xcode
- CocoaPods

---

## Recommandations sur le plugin BLE

Le plugin actuel est :

- `@capacitor-community/bluetooth-le` v6.1.0

Travaux recommandés :

- vérifier précisément les API disponibles pour le bonding sur Android
- confirmer la disponibilité de `createBond()` et `isBonded()` dans la version réellement installée
- envisager une mise à jour mineure si des correctifs BLE récents existent

---

## Priorités proposées

### Priorité haute

1. Valider sur matériel réel la logique Android déjà en place
2. Tester les erreurs GATT réelles liées à l'authentification
3. Créer et configurer la plateforme iOS
4. Vérifier le comportement Android sur plusieurs téléphones

### Priorité moyenne

1. Renforcer si nécessaire la récupération d'un bond cassé
2. Tester les scénarios réels avec plusieurs téléphones
3. Ajouter éventuellement de l'instrumentation debug BLE dédiée au pairing

### Priorité optionnelle

1. Développer un complément natif Android pour des scénarios de pairing avancés
2. Ajouter un reset manuel du state de pairing côté application pour le debug

---

## Checklist de tests Android LESC

À exécuter dès qu'un périphérique compatible **LE Secure Connections** sera disponible.

### Préparation

- vérifier que l'application Android a bien été préparée avec :
	- `npm run android`
- installer la dernière version de l'application sur le téléphone de test
- vérifier que le Bluetooth est activé
- vérifier que les permissions Bluetooth Android ont bien été accordées
- si possible, tester sur au moins :
	- un téléphone Android récent
	- un second téléphone Android d'un autre constructeur

### Cas 1 — premier appairage sécurisé

Objectif : vérifier le tout premier pairing LESC.

Étapes :

1. supprimer toute trace d'appairage préalable côté téléphone
2. allumer le périphérique BLE compatible LESC
3. lancer l'application
4. scanner puis sélectionner le périphérique
5. vérifier qu'un dialogue système Android de pairing apparaît si nécessaire
6. accepter l'appairage
7. vérifier que la connexion aboutit
8. envoyer une ou plusieurs trames BLE

Résultat attendu :

- l'application passe par l'état de pairing
- la connexion aboutit sans écran bloqué
- les écritures BLE fonctionnent après pairing

### Cas 2 — reconnexion après bond déjà établi

Objectif : vérifier la réutilisation d'un bond existant.

Étapes :

1. quitter puis relancer l'application
2. rescanner le périphérique
3. se reconnecter au même device

Résultat attendu :

- pas de nouveau pairing inutile si le bond est toujours valide
- reconnexion plus rapide
- envoi BLE toujours fonctionnel

### Cas 3 — capteur réinitialisé / bond cassé côté périphérique

Objectif : vérifier la récupération d'un bond devenu invalide.

Étapes :

1. établir un bond fonctionnel
2. réinitialiser le capteur ou supprimer son état de bond côté périphérique
3. tenter une reconnexion depuis le téléphone

Résultat attendu :

- l'application détecte qu'un ancien bond n'est plus fiable
- l'état de bond mémorisé est oublié côté application
- un nouveau pairing est demandé proprement
- la reconnexion redevient possible

### Cas 4 — bond supprimé côté téléphone

Objectif : vérifier le comportement après suppression manuelle du bond Android.

Étapes :

1. appairer le périphérique une première fois
2. aller dans les réglages Bluetooth Android
3. supprimer l'appairage du périphérique
4. revenir dans l'application et tenter une reconnexion

Résultat attendu :

- l'application ne reste pas bloquée sur un faux état « déjà sécurisé »
- un nouveau pairing peut être relancé
- la connexion et les écritures redeviennent fonctionnelles

### Cas 5 — écriture refusée tant que la liaison n'est pas sécurisée

Objectif : vérifier la relance du bonding sur échec d'écriture.

Étapes :

1. se connecter au périphérique dans une situation où il exige une liaison sécurisée
2. déclencher un envoi BLE

Résultat attendu :

- si l'écriture échoue à cause d'un problème de sécurité, l'application tente une récupération propre
- un pairing forcé peut être relancé si nécessaire
- l'envoi BLE finit par réussir ou échoue avec un message explicite

### Cas 6 — comportement UI pendant le pairing

Objectif : vérifier l'expérience utilisateur pendant la sécurisation.

Points à observer :

- les actions sensibles sont désactivées pendant l'appairage
- un message visuel indique qu'un pairing sécurisé est en cours
- l'utilisateur comprend qu'il doit confirmer l'action côté Android

### Cas 7 — logs utiles à capturer

Pendant les tests, relever si possible :

- les logs Android filtrés sur `com.watteco.easycodec`
- les transitions de statut affichées par l'application
- les cas où un retry de pairing est déclenché
- le comportement après un reset du capteur

### Critères de validation minimum

La compatibilité Android LESC sera considérée comme suffisamment validée si :

- le premier pairing fonctionne
- la reconnexion avec bond valide fonctionne
- un bond cassé peut être récupéré proprement
- les écritures BLE fonctionnent après sécurisation
- l'utilisateur a un retour visuel clair pendant le pairing

---

## Conclusion

Pour être compatible **LE Secure Connections** dans ce projet, il faudra surtout :

- renforcer la logique BLE côté application
- intégrer explicitement le bonding sur Android
- préparer correctement iOS et ses permissions
- tester le comportement réel avec les capteurs Watteco ciblés

Le plus important est de considérer que **la sécurité BLE ne repose pas uniquement sur le scan et la connexion**, mais aussi sur :

- le pairing
- le chiffrement effectif de la liaison
- la gestion des erreurs de sécurité
- et l'expérience utilisateur pendant cette phase.
