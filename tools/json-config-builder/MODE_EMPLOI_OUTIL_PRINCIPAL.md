# Mode d'emploi - Outil principal

`app.py` sert a creer, completer ou fusionner un JSON Easy Codec.

URL par defaut:

```text
http://localhost:8501
```

Interface:

```text
Easy Codec JSON Builder
```

## Role

L'outil principal transforme une source en JSON Easy Codec exploitable.

Sources possibles:

- une ROM config `.txt`;
- des trames collees manuellement;
- un JSON Easy Codec deja pret a ajouter;
- un JSON existant a enrichir ou corriger.

Il peut aussi transmettre le resultat dans un projet Easy Codec local.

## Installation

A faire une seule fois:

```bat
cd <repo-outil>
python -m pip install -r requirements.txt
```

## Lancement

Le plus simple:

```bat
Lanceroutil.bat
```

Puis choisir:

- `1`: lancer seulement l'outil principal;
- `3`: lancer l'outil principal avec `ROM Config Finder`.

Lancement manuel:

```bat
python -m streamlit run app.py --server.port 8501
```

Puis ouvrir:

```text
http://localhost:8501
```

## Workflow Simple

1. Charger une source dans la barre laterale.
2. Verifier les trames detectees.
3. Garder seulement les trames utiles.
4. Regler les groupes, labels et variables.
5. Verifier le JSON genere.
6. Telecharger le JSON ou utiliser `Transmission Easy Codec`.

## Si Tu Viens De ROM Config Finder

Quand `app.py` est ouvert depuis `ROM Config Finder`, plusieurs champs sont deja remplis:

- la ROM config est chargee automatiquement;
- le nom produit est repris;
- le nom du fichier JSON est propose;
- la categorie est ajoutee pour `AvailableProductList`;
- le lien support reste disponible.

Dans ce cas, tu peux passer directement a la verification des trames, puis generer le JSON.

## Variables

Point important: deux variables differentes ne doivent pas avoir le meme `Nom variable`.

Regle simple:

- si c'est la meme valeur, garder le meme nom;
- si c'est une autre valeur, choisir un autre nom;
- si l'outil affiche `Nom variable deja utilise`, verifier avant de continuer.

Exception normale:

```text
gBatchEmission
```

Cette variable est globale et peut etre partagee.

## Reutiliser Une Variable Existante

Quand tu enrichis un JSON existant, tu peux reutiliser une variable deja presente.

1. Charger le JSON existant.
2. Ouvrir la valeur configurable dans une trame.
3. Cocher `Utiliser une variable existante`.
4. Choisir la variable dans `Variable existante`.

La variable est alors inseree dans la trame, mais elle n'est pas recreee dans le JSON.

## Enrichir Un JSON Existant

Utiliser ce mode quand tu veux ajouter de nouvelles trames dans un JSON deja fait.

1. Charger les nouvelles trames ou la nouvelle ROM.
2. Charger le JSON existant dans `JSON existant a comprendre/enrichir`.
3. Ouvrir `Maintenance d'un JSON existant`.
4. Cocher `Enrichir un JSON existant au lieu de repartir de zero`.
5. Verifier le `JSON fusionne`.

Laisser `Remplacer les champs existants portant le meme nom` decoche, sauf si tu veux vraiment ecraser des champs existants.

## Transmission Easy Codec

`Transmission Easy Codec` copie le resultat dans un projet Easy Codec local.

Detection du projet cible:

- variable d'environnement `EASY_CODEC_PROJECT_PATH`;
- sinon dossier voisin `../Watteco-Easy-Codec`;
- sinon dossier voisin `../Watteco-Easy-Codec-main`.

Fichiers qui peuvent etre modifies:

```text
public\config\<nom_du_fichier>.json
public\config\AvailableProductList.json
public\localisation\fr_FR.json
public\localisation\en_US.json
```

Important: la transmission reste locale. Elle ne fait ni `git commit`, ni `git push`.

## Apres Transmission

Dans le projet Easy Codec:

```bat
cd <repo-watteco-easy-codec>
git status
git diff
```

Si tout est bon:

```bat
git add public\config\<nom_du_fichier>.json public\config\AvailableProductList.json public\localisation\fr_FR.json public\localisation\en_US.json
git commit -m "Add Easy Codec config for <nom_du_produit>"
git push
```

## Problemes Frequents

Projet Easy Codec introuvable:

- verifier `EASY_CODEC_PROJECT_PATH`;
- verifier que `Watteco-Easy-Codec` ou `Watteco-Easy-Codec-main` est dans le dossier voisin.

Streamlit introuvable:

```bat
python -m pip install -r requirements.txt
```

JSON incorrect:

- verifier les trames gardees;
- verifier les noms de variables;
- verifier les groupes et labels;
- verifier la fusion;
- verifier les localisations.

## Verification

Compilation:

```bat
cd <repo-outil>
python -m py_compile app.py app2.py easy_codec_builder\core.py
```
