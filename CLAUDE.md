# CLAUDE.md — NodeFactory

Planificateur d'usines **Satisfactory 1.0**, web, open source, 100% client. L'utilisateur fixe une
cible (« 60 plaques de fer renforcées/min ») → l'appli calcule machines, recettes (dont alternatives),
convoyeurs, énergie et matières premières, dans un éditeur de nœuds React Flow.

> **Un skill projet existe : `satisfactory-planner`.** Il porte le détail du domaine, de la
> formulation LP, des tables de valeurs et de la stratégie de test. Charge-le pour toute tâche sur
> le solveur, les données, le graphe, le store, l'UI ou la persistance. Ce CLAUDE.md n'en est que le
> résumé opérationnel.

## Commandes

```bash
npm run dev        # dev Vite
npm run build      # tsc -b && vite build (statique → dist/)
npm run test       # vitest run (une fois)
npm run test:watch # vitest watch
npm run typecheck  # tsc -b --noEmit
```

## Stack imposée (ne pas dévier)

Vite + React 18 + TypeScript strict · React Flow `@xyflow/react` · Zustand · Tailwind CSS v4
(`@tailwindcss/vite`, `@import "tailwindcss"`) · **glpk.js** (LP en WASM) · Dexie (IndexedDB) · Vitest.
**Pas de backend, pas de DB serveur, pas de Next.js.** Tout dans le navigateur. Alias `@` → `src/`.

## Architecture — découplage strict

| Dossier            | Rôle |
| ------------------ | ---- |
| `src/data`         | Schéma (`types.ts`) + frontière **unique** `loadGameData()` + `validate.ts`. Lecture seule. |
| `src/solver`       | Moteur **LP pur et déterministe**, zéro dépendance React/UI. Testable en isolation. |
| `src/graph`        | Graphe React Flow depuis une `SolveResult` + couche logistique (tiering belts, splitters/mergers). |
| `src/store`        | État Zustand (`useFactoryStore`). |
| `src/ui`           | Composants React, nœuds custom, panneaux. **Aucune logique métier ici.** |
| `src/persistence`  | Dexie + export/import JSON + état → URL compressée (partage). |

## Règles non négociables

- **Vision** : extrêmement simple pour le débutant, puissant pour l'expert. En cas de doute UX,
  choisir le contact simple et planquer la puissance derrière un mode avancé (progressive disclosure).
- **Données mock-first** : tout passe par `loadGameData()`. Le mock (`public/data/mock/`) respecte
  **exactement** le schéma final. Remplacer le mock par les vraies données ne touchera **que** le
  chargeur — jamais le solveur ni l'UI. L'extraction (`scripts/extraction/`) est préparée, **non
  branchée** ; ne pas parser `Docs.json` maintenant.
- **Le solveur est un LP**, pas un parcours d'arbre. Reste découplé de la couche logistique
  (le LP décide *quoi/combien*, le graphe décide *comment router*). Pas de coût de belts dans le LP au MVP.
- **Tests d'abord/en même temps** : aucune fonctionnalité du solveur n'est terminée sans son test,
  sur des cas dont on connaît la réponse à la main. Lancer les tests après chaque tranche.
- **TypeScript strict** aux frontières. Commits atomiques. Pas d'over-engineering.
- **Ne pas déborder sur la v2** (vraies données 1.0, overclock/sloops, coût logistique dans le LP,
  patterns de build, édition manuelle avancée). MVP simple et correct d'abord.

## En cours

Faits : stack + structure + données + schéma ; **éditeur de nœuds manuel** (palette par catégorie,
drag & drop, inspecteur, multiplicateur de machines) ; **couche de calcul du graphe**
(`src/graph/computeFactory.ts` : machines, énergie, bilan matière, tiering convoyeur + surcharge) ;
**solveur LP** (`src/solver`, glpk.js — variables = cycles/min, demande + bilans, objectifs min
ressources/machines/énergie, toggle alternatives) ; **auto-génération** du graphe depuis une cible
(`buildGraphFromSolution` + bouton Calculer, glpk chargé en lazy-import). 21 tests verts (cas 1-7
du solveur, 8 logistique, données, graphe).

**Modèle de graphe : 1 node = 1 machine** (décision user). L'auto-génération émet un node par machine
physique (1 in/1 out) et insère des **mergers/splitters réels** entre les groupes ; `computeFactory`
fait la **propagation de flux** à travers ces hubs (merger = somme, splitter = répartition). Handles par
item (carrés), badge ×N (mode manuel encore agrégé — à terme remplacé par copié-collé). Hubs = nodes
`buildingId: 'merger'|'splitter'` avec `portsIn/portsOut` dynamiques.

**Optimisation assistée faite** : `src/graph/assist.ts` `completeFactory` (« Compléter l'usine ») —
lit les déficits du graphe manuel, `solveDemands` (multi-cibles) calcule l'amont, `buildGraphFromSolution`
(préfixe `opt-`) le génère, et `connectFlow` (`src/graph/logistics.ts`, arbres merger/splitter 3-voies
partagés) le branche sur les consommateurs existants. Bouton dans `FactorySummaryPanel`.

Faits aussi : `BeltEdge` (label + bouton « + » → insérer hub), drop/insertion de hub sur arête,
multi-sélection, `isValidConnection`, ELK lazy, copié-collé, `NodeToolbar` (dupliquer/supprimer),
splitters/mergers carrés 3-voies. **31→33 tests verts.**

**Reste** : persistance locale + partage URL (tests 11-12, fin de projet) ; polish (icônes d'item,
helper lines) ; données réelles 1.0 (agent prêt, accès web autorisé — rester sur le mock pour l'instant).
