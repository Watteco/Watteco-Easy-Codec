# Guide pour la Création de Fichiers de Configuration pour nke Watteco LoRaWAN

Ce guide explique comment transformer des trames de configuration brutes en fichiers JSON structurés pour l'***Easy Codec*** de **Watteco**.

## Principe de Base

1. Vous partez d'une configuration par défaut sous forme de trames hexadécimales, par exemple:
   ```
   11 50 00 50 02 03
   11 06 04 02 15 00 00 00 80 0A 80 3C 00 00 00 0A 03
   31 06 04 02 15 00 00 00 80 0A 80 3C 00 00 00 0A 0B
   11 06 00 50 15 00 06 04 85 A0 85 A0 00 00 00 64 2B
   ```

2. Vous identifiez les valeurs qui doivent être configurables par l'utilisateur.

3. Vous créez un fichier JSON structuré où:
   - Les trames fixes sont conservées dans `cfg_block`
   - Les valeurs variables sont remplacées par des références à des paramètres: `(paramName)`
   - Les paramètres sont définis dans des sections appropriées avec types et contraintes

## Structure du Fichier

Un fichier de configuration est organisé en trois sections principales:

1. **`general_params`**: Paramètres généraux (suppression de la configuration, confirmations)
2. **`batch_params`**: Paramètres pour les rapports batch (agrégation de données)
3. **`standard_params`**: Paramètres pour les rapports standards (mesures individuelles)

## Étapes de Création d'un Fichier

### 1. Créer la Structure de Base

```json
{
    "general_params": {
        "remove_config": {},
        "confirmed": {},
        "cfg_block": []
    },
    "batch_params": {
        "batch_X_params": {},
        "global_params": {},
        "cfg_block": []
    },
    "standard_params": {
        "standard_X_params": {},
        "cfg_block": []
    }
}
```

### 2. Identifier les Trames et les Paramètres Variables

Pour chaque trame hexadécimale:
1. Déterminez sa fonction (configuration générale, batch, standard)
2. Identifiez les octets qui représentent des valeurs configurables
3. Définissez un nom de paramètre pour chaque valeur configurable

Exemple:
```
11 06 04 02 15 00 00 00 80 0A 80 3C 00 00 00 0A 03
                         ^^^   ^^^
             échantillonnage   émission
```

### 3. Définir les Paramètres dans les Sections Appropriées

Pour chaque paramètre, définissez:
- **`type`**: Le type de donnée (voir tableau des types)
- **`default_value`**: Valeur par défaut
- **`min_value`/`max_value`**: Limites
- **`HMI`**: Paramètres d'interface utilisateur

Exemple:
```json
"tBatchEchant": {
    "type": "timeVal",
    "default_value": "10",
    "min_value": "1",
    "max_value": "60",
    "depends_on": "gBatchEmission",
    "HMI": {
        "label": "@echantLabel",
        "visual_type": "timeSlider"
    }
}
```

### 4. Configurer les Blocs de Trames (cfg_block)

Remplacez les valeurs variables dans les trames par des références aux paramètres:

```json
"cfg_block": [
    ["11 06 04 02 15 00 00 00 (tBatchEchant) (gBatchEmission) 00 00 00 0A 03", "@cfgCommentBatchTemp"]
]
```

## Types de Paramètres Disponibles

| **Type**    | **Composant UI** | **Description**                                   | **Exemple**                        |
|-------------|------------------|---------------------------------------------------|------------------------------------|
| `timeVal`   | TimeSlider       | Valeur temporelle (minutes)                       | `"default_value": "10"`            |
| `hex[x]B`   | DoubleSlider     | Valeur hexadécimale sur x octets                  | `"type": "hex2B"` pour 2 octets    |
| `bool`      | CheckBox         | Valeur booléenne (true/false)                     | `"default_value": "false"`         |
| `frame`     | CustomFrame      | Trame fixe non modifiable                         | Utilisé pour `removeCurrentConfig` |
| `string`    | TextInput        | Chaîne de caractères                              | Pour des identifiants              |
| `dropdown`  | DropDown         | Liste déroulante de choix                         | Pour des modes de fonctionnement   |

## Conversion de Valeurs pour les Trames

Les valeurs sont automatiquement converties au format approprié:

- **`timeVal`**: Valeur décimale → hexadécimal sur 2 octets avec offset 32768 (ex: 10 → 800A)
- **`hex[x]B`**: Valeur décimale → hexadécimal sur x octets (ex: pour hex2B, 21 → 0015)
- **`bool`**: true/false → 01/00

## Localisation des Étiquettes

Les étiquettes commençant par `@` sont des clés de localisation:
- `@tempLabel`: Étiquette pour la température
- `@echantLabel`: Étiquette pour l'échantillonnage
- `@forEp X`: Suffixe pour indiquer l'endpoint X  
  
Consultez les fichiers de localisation dans le dossier `public/localisation/` pour savoir à quoi correspondent les différentesclés.
Si vous devez en ajouter, n'oubliez pas les deux langues !

## Utilisation de `depends_on`

Le paramètre `depends_on` établit une relation de dépendance dynamique entre deux paramètres, généralement utilisé pour les valeurs temporelles.

### Fonctionnement

1. **Limitation dynamique de valeurs maximales** : Lorsqu'un paramètre A dépend d'un paramètre B (`depends_on: "B"`), la valeur maximale de A est automatiquement ajustée pour ne pas dépasser la valeur actuelle de B.

2. **Cas d'utilisation courant** : Pour les capteurs, l'intervalle d'échantillonnage (`tBatchEchant`) dépend souvent de l'intervalle d'émission (`gBatchEmission`). Cela garantit que vous ne configurez pas un échantillonnage moins fréquent que vos émissions.

3. **Exemple** :
```json
"tBatchEchant": {
    "type": "timeVal",
    "default_value": "10",
    "min_value": "1",
    "max_value": "60",   // Valeur maximale initiale
    "depends_on": "gBatchEmission",
    "HMI": {
        "label": "@echantLabel",
        "visual_type": "timeSlider"
    }
}
```

Si l'utilisateur règle `gBatchEmission` à 30 minutes, la valeur maximale de `tBatchEchant` sera automatiquement limitée à 30 minutes. Si l'utilisateur augmente ensuite `gBatchEmission` à 45 minutes, la limite maximale de `tBatchEchant` sera ajustée à 45 minutes (sans jamais dépasser sa valeur maximale initiale de 60).

4. **À utiliser lorsque** :
   - Vous configurez des intervalles temporels qui doivent respecter une hiérarchie logique
   - Vous souhaitez une validation dynamique des valeurs en fonction d'autres paramètres
   - Vous voulez simplifier l'expérience utilisateur en limitant automatiquement les choix invalides

## Exemple Complet

Voici un extrait simplifié d'un fichier de configuration:

```json
{
    "general_params": {
        "remove_config": {
            "label": "@removeCurrentConfigLabel",
            "default_state": "true",
            "fields": {
                "removeCurrentConfig": {
                    "type": "frame",
                    "HMI": {
                        "label": "@removeCurrentConfigLabel",
                        "visual_type": "customFrame"
                    }
                }
            }
        },
        "cfg_block": [
            ["11 50 00 50 02 03 (removeCurrentConfig)", "@cfgCommentRemoveConfig"]
        ]
    },
    "batch_params": {
        "batch_T_params": {
            "label": "@tempLabel",
            "fields": {
                "tBatchEchant": {
                    "type": "timeVal",
                    "default_value": "10",
                    "min_value": "1",
                    "max_value": "60",
                    "HMI": {
                        "label": "@echantLabel",
                        "visual_type": "timeSlider"
                    }
                }
            }
        },
        "cfg_block": [
            ["11 06 04 02 15 00 00 00 (tBatchEchant) (gBatchEmission) 00 00 00 0A 03", "@cfgCommentBatchTemp"]
        ]
    }
}
```

## Bonnes Pratiques

1. **Nommage des Paramètres**:
   - Préfixez avec une lettre indiquant le type de donnée (`t` pour température)
   - Utilisez des noms explicites (`tBatchEchant` plutôt que `tBE`)
   - Pour les endpoints multiples, ajoutez un suffixe numérique (`tBatchEchant1`, `tBatchEchant2`)

2. **Organisation**:
   - Groupez les paramètres par type de mesure (`batch_T_params` pour température)
   - Utilisez `global_params` pour les paramètres qui s'appliquent à plusieurs capteurs

3. **Dépendances**:
   - Utilisez `depends_on` pour établir des relations entre paramètres

4. **Documentation**:
   - Utilisez les commentaires (`@cfgComment...`) pour documenter chaque trame

## Vérification et Tests

1. Validez le format JSON (pas de virgules manquantes, etc.)
2. Vérifiez que toutes les trames d'origine sont représentées dans les `cfg_block`
3. Testez avec l'interface pour s'assurer que les paramètres sont correctement affichés et modifiables
4. Vérifiez que les trames générées correspondent à celles attendues

---

Pour des exemples complets, consultez les fichiers existants dans le dossier `public/config/`.