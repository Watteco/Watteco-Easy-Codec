# Guide Dev — Créer un fichier de configuration Easy Codec (version simple)

Ce guide aide à créer un fichier JSON de configuration quand vous connaissez le capteur et sa configuration par défaut sous forme de trames, mais pas l'outil.

Objectif: partir d'une configuration par défaut sous forme de trames hexadécimales et arriver à un JSON lisible, testable, et prêt pour l'interface.

## Sommaire

- [Démarrage rapide](#démarrage-rapide-à-suivre-dans-lordre)
- [Squelette minimal recommandé](#squelette-minimal-recommandé)
- [Méthode pas à pas](#méthode-pas-à-pas)
- [Référence rapide: types, UI et conversion](#référence-rapide-types-ui-et-conversion)
- [Exemples utiles](#exemples-utiles)
- [Cas de logique entre champs](#cas-de-logique-entre-champs)
- [Paramètres d'affichage de section](#paramètres-daffichage-de-section)
- [Aperçu visuel des champs UI](#aperçu-visuel-des-champs-ui)
- [Exemples existants](#exemples-existants)
- [Checklist avant validation](#checklist-avant-validation)

## Démarrage rapide (à suivre dans l'ordre)

1. Créez un squelette JSON minimal (voir section suivante).
2. Classez chaque trame dans `general_params`, `batch_params` ou `standard_params`.
3. Remplacez les valeurs configurables par des placeholders `(paramName)` dans `cfg_block`.
4. Déclarez chaque paramètre dans la bonne section (`fields`) avec `type`, bornes, valeur par défaut et `HMI.visual_type`.
5. Vérifiez les clés de localisation `@...` dans `public/localisation/` (FR + EN).
6. Testez dans l'app et comparez les trames générées aux trames attendues.

## Squelette minimal recommandé

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

## Méthode pas à pas

### 1) Partir de la configuration par défaut

Exemple:

```
11 50 00 50 02 03
11 06 04 02 15 00 00 00 80 0A 80 3C 00 00 00 0A 03
31 06 04 02 15 00 00 00 80 0A 80 3C 00 00 00 0A 0B
11 06 00 50 15 00 06 04 85 A0 85 A0 00 00 00 64 2B
```

### 2) Repérer ce qui est variable

Pour chaque trame:

1. Identifiez sa famille: général, batch, standard.
2. Repérez les octets qui doivent être modifiables.
3. Donnez un nom clair à chaque variable.

Exemple:

```
11 06 04 02 15 00 00 00 80 0A 80 3C 00 00 00 0A 03
                         ^^^   ^^^
             échantillonnage   émission
```

### 3) Remplacer dans les trames (`cfg_block`)

Format attendu: `["<trame>", "@commentaire"]`

```json
"cfg_block": [
    ["11 06 04 02 15 00 00 00 (tBatchEchant) (gBatchEmission) 00 00 00 0A 03", "@cfgCommentBatchTemp"]
]
```

### 4) Déclarer les paramètres (`fields`)

Pour chaque paramètre, renseignez au minimum:

- `type`
- `default_value`
- `min_value` / `max_value` (si pertinent)
- `HMI.label`
- `HMI.visual_type`

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

### 5) Vérifier les libellés localisés

Toutes les clés `@...` doivent exister dans les deux fichiers de langue (`fr_FR` et `en_US`).

### 6) Cas fréquent: configuration par défaut avec uniquement des trames batch

Même si la configuration par défaut ne contient que du batch, il est généralement pertinent d'ajouter les champs standards correspondants dans `standard_params` vec une section standard désactivée au chargement (`default_state: "false"`).

Cela permet d'exposer les options standard dans l'UI sans les activer par défaut.

## Référence rapide: types, UI et conversion

| Type | Visual type conseillé | Usage | Conversion trame |
|------|------------------------|-------|------------------|
| `timeVal` | `timeSlider` | Temps (minutes) | Décimal → hexa 2 octets avec offset 32768 (ex: 10 → 800A) |
| `hex[x]B` | `doubleSlider`, `slider` ou `numInput` | Entier sur x octets | Décimal → hexa sur x octets (ex: hex2B, 21 → 0015) |
| `bool` | `checkbox` | Booléen | true/false → 01/00 |
| `float` | `slider` (ou `numInput`) | Décimal | IEEE 754 simple précision (4 octets, 8 chars hexa) |
| `stringPad[x]` | `textInput` | Chaîne paddée | Pad à gauche avec `0` (ex: stringPad4, 7 → 0007) |
| `string` | `textInput` ou `customValue` | Texte libre ou valeur fixe | Selon contenu |
| `frame` | `customFrame` | Trame fixe non éditable | Injectée telle quelle |
| `dropdown` | `dropdown` | Choix listé | Valeur choisie injectée |

Remarques:

- `customValue` est utile pour une valeur fixe affichée mais non éditable.
- Pour `float`, utilisez en général `precision` et `step` (ex: `2` et `0.01`).

## Exemples utiles

### Dropdown

```json
"mode": {
    "type": "hex1B",
    "default_value": "3",
    "choices": [
        ["1", "@modeA"],
        ["2", "@modeB"],
        ["3", "@modeC"]
    ],
    "HMI": {
        "label": "@modeLabel",
        "visual_type": "dropdown"
    }
}
```

### Float avec slider

```json
"Distance1": {
    "type": "float",
    "default_value": "1.50",
    "min_value": "0",
    "max_value": "10",
    "precision": 2,
    "step": "0.01",
    "HMI": {
        "label": "D1: @altoTestDistance1Label (m)",
        "visual_type": "slider"
    }
}
```

### Entier avec slider

```json
"nbRegistres": {
    "type": "hex2B",
    "default_value": "1",
    "min_value": "1",
    "max_value": "10",
    "HMI": {
        "label": "@nbRegistresLabel",
        "visual_type": "slider"
    }
}
```

## Cas de logique entre champs

### 1) Checkbox inversée (`inverted`)

Permet d'inverser la valeur hex générée:

- cochée → `00`
- non cochée → `01`

```json
"remove": {
    "type": "bool",
    "default_value": "false",
    "inverted": "true",
    "HMI": {
        "label": "@removeHeaderLabel",
        "visual_type": "checkbox"
    }
}
```

### 2) Dépendance dynamique (`depends_on`)

Usage très courant (présent dans la quasi-totalité des fichiers): `tBatchEchant` dépend de `gBatchEmission`.

Effet: la valeur max du champ dépendant est limitée automatiquement à la valeur courante du champ parent (sans dépasser son propre max initial).

### 3) Relation entre champs (`field_relationships`)

⚠️ Cas plus avancé / WIP (actuellement surtout utilisé pour Alt'O).

Types supportés:

- `lessThan`
- `greaterThan`

```json
"field_relationships": [
    {
        "type": "lessThan",
        "field1": "AlarmLow",
        "field2": "AlarmHigh",
        "margin": 0.01
    }
]
```

## Paramètres d'affichage de section

- `default_state`: active/désactive au chargement (`"true"` / `"false"`)
- `folded`: section repliée au chargement
- `outputCardOverride`: autorise la carte de sortie même sans catégorie cochée
- `outputCardHidden`: masque la carte de sortie
- `image`: image capteur associée (dans `public/img/`)

## Aperçu visuel des champs UI

| Type | Champ UI | Capture |
|------|----------|---------|
| `timeVal` | `timeSlider` | ![timeSlider](img/readme-ui/timeSlider.png) |
| `hex[x]B` | `doubleSlider` | ![doubleSlider](img/readme-ui/doubleSlider.png) |
| `bool` | `checkbox` | ![checkbox](img/readme-ui/checkbox.png) |
| `float` / `hex[x]B` | `slider` | ![sliderFloat](img/readme-ui/sliderFloat.png) |
| `hex[x]B` | `numInput` | ![numInput](img/readme-ui/numInput.png) |
| `string` / `stringPad[x]` | `textInput` | ![textInput](img/readme-ui/textInput.png) |
| `dropdown` | `dropdown` | ![dropDown](img/readme-ui/dropDown.png) |
| `frame` | `customFrame` | N/A |
| `string` (fixe) | `customValue` | N/A |

Astuce: gardez des noms de fichiers d'images stables pour éviter de retoucher la doc à chaque update UI.

## Exemples existants

Plutôt qu'un exemple artificiel, utilisez les fichiers déjà présents dans `public/config/` comme base de travail.

Recommandation pratique:

1. Prenez le fichier le plus proche du capteur ciblé.
2. Dupliquez-le puis adaptez les trames et les champs.
3. Gardez la structure existante (noms de sections, style des `cfg_block`, conventions de labels `@...`).

Pour voir des exemples complets, consultez les fichiers de `public/config/`.

## Checklist avant validation

1. JSON valide (syntaxe OK).
2. Toutes les trames d'origine présentes dans les `cfg_block`.
3. Tous les placeholders `(paramName)` correspondent à un champ déclaré.
4. Toutes les clés `@...` existent en FR et EN.
5. Le rendu UI est correct et les valeurs sont modifiables.
6. Les trames générées correspondent au comportement attendu capteur.

---
