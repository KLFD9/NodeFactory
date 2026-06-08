# Extraction des données réelles Satisfactory 1.0

> **Statut : préparé, NON branché.** Ce dossier trace le chemin de mise à jour des données
> réelles, mais rien n'est implémenté tant que le MVP n'est pas solide. Ne pas parser
> `Docs.json` maintenant. Le MVP tourne sur les données **mockées** de `/public/data/mock/`.

## Pourquoi ce dossier existe

Toute l'appli consomme les données via la frontière unique `loadGameData()` (`src/data/`).
Le mock respecte **exactement** le schéma final (`src/data/types.ts`). Le jour où l'extraction
produit le vrai JSON normalisé, il se substitue au mock **sans changer une ligne de type** :
on ne touche qu'au chargeur, jamais au solveur ni à l'UI.

## Sources possibles (par ordre de fiabilité)

1. **`Docs.json`** livré avec le jeu (`.../Satisfactory/CommunityResources/Docs/Docs.json`) —
   la source canonique. Contient recettes, bâtiments, items, durées, coûts énergie. **À privilégier.**
2. **Wiki communautaire** [satisfactory.wiki.gg](https://satisfactory.wiki.gg) — s'appuie lui-même
   sur `Docs.json`, utile pour recouper les libellés et les valeurs.
3. **Sheets communautaires** (Google Sheets de référence ratios) — en dépannage uniquement,
   valeurs à revérifier.

## Cible

Le **même schéma normalisé** que le mock (`src/data/types.ts` → `GameData`), versionné par patch :

```
/public/data/{version}/items.json
/public/data/{version}/buildings.json
/public/data/{version}/recipes.json
/public/data/{version}/belts.json
/public/data/{version}/generators.json
```

`loadGameData(version)` saura alors servir une version précise. `GAME_DATA_VERSION` (dans
`src/data/loadGameData.ts`) passera de `'mock'` à `'1.0'` une fois l'extraction validée.

## Pipeline prévu (cf. `extract.ts`)

```
Docs.json  ──parse──►  AST brut  ──normalize──►  GameData  ──validate──►  écrire JSON par version
```

1. **Parser** `Docs.json` (encodage UTF-16 historiquement — vérifier).
2. **Normaliser** vers le schéma : mapper les classes natives (FGRecipe, FGBuildingDescriptor…)
   vers `Recipe`/`Building`/`GameItem`, convertir les durées et quantités par cycle.
3. **Valider** avec `validateGameData()` — réutiliser la même validation que la frontière de chargement.
4. **Écrire** les 5 fichiers JSON dans `/public/data/{version}/`.

## Lancer (plus tard)

```bash
# NON IMPLÉMENTÉ — placeholder
npx tsx scripts/extraction/extract.ts --docs <chemin/vers/Docs.json> --version 1.0
```
