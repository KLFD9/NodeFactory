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
(`buildGraphFromSolution` + bouton Calculer, glpk chargé en lazy-import).

**Modèle de graphe : 1 node = 1 machine** (décision user). L'auto-génération émet un node par machine
physique (1 in/1 out) et insère des **mergers/splitters réels** entre les groupes ; `computeFactory`
fait la **propagation de flux** à travers ces hubs (merger = somme, splitter = répartition). Handles par
item, hubs = nodes `buildingId: 'merger'|'splitter'` avec `portsIn/portsOut` dynamiques.

**Optimisation assistée** : `src/graph/assist.ts` `completeFactory` (« Compléter l'usine ») —
lit les déficits, `solveDemands` calcule l'amont, `buildGraphFromSolution` le génère et `connectFlow`
(`src/graph/logistics.ts`) le branche sur les consommateurs existants. Bouton dans `FactorySummaryPanel`.

Faits aussi : `BeltEdge` (label hover-expand + bouton « + » → insérer hub), drop/insertion de hub sur
arête, multi-sélection, `isValidConnection`, ELK lazy, copié-collé, `NodeToolbar` (dupliquer/supprimer),
splitters/mergers carrés 3-voies. **33 tests verts.**

### Couche visuelle « game feel » (session 2026-06-09)

**Style n8n** : icônes SVG par catégorie (`src/ui/icons.tsx`), bordure-accent gauche colorée, handles
ronds (orange entrées, vert sorties), BeltEdge hover-expand (label compact → détail au survol), flèches
réduites à 10 px. Voir `walkthrough.md` dans le brain Gemini pour le détail.

**Animations de flux sur les arêtes** (`src/ui/edges/BeltEdge.tsx`) :
- Overlay `<path>` animé avec `stroke-dasharray="3 12"` et `@keyframes belt-flow` (CSS `stroke-dashoffset`).
- Vitesse proportionnelle au débit : `duration = 2.5 / (rate/60)` s (2.5 s à 60/min → 0.35 s à 1200/min).
- Arête de base atténuée à 45 % d'opacité quand flux actif ; halo rouge `drop-shadow` si surchargée.
- `animated: true` React Flow supprimé (évite double-animation).

**Animations internes des nodes** (`src/ui/nodes/MachineNode.tsx`) :
- **Barre de cycle** (`CycleBar`) : 3 px, remplit gauche→droite en `cycleTime` s. Extracteurs :
  `60/rate` s par item. Machines à recette : `recipe.time / efficiency` s (ralentit si sous-alimenté).
- **Point d'activité pulsant** dans le header : vert (#10b981) si efficacité ≥ 99 %, amber si < 99 %,
  rouge si < 50 %. Animation `nf-activity-dot` à 1.5 s.
- **Affichage réel/capacité** sur les lignes d'entrée : si un node reçoit 15/m au lieu de 30/m,
  affiche `15`(amber)`/30/m` au lieu du seul taux théorique.

**Contexte de flux** (`src/ui/NodeFlowContext.ts`) :
- `GraphCanvas` calcule en un seul `useMemo` les styles d'arêtes **ET** un `NodeFlowMap`
  (nodeId → `{inputs, outputs}` depuis les `EdgePlan`).
- Fourni via `<NodeFlowContext.Provider>` ; consommé par `MachineNode` via `useContext`.
- Efficacité = `min(actualInput / theoreticalInput)` sur tous les inputs → pilote la vitesse de la
  barre de cycle et la couleur du point d'activité.

**Auto-détection de recette à la connexion** (`src/ui/GraphCanvas.tsx`) :
- `onConnect` wrappé : après création de l'arête, si le target n'a pas de recette et qu'une seule
  recette standard du bâtiment accepte l'item entrant → `updateNodeData({ recipeId })` automatique.
- Source : item lu depuis le `sourceHandle` (`out-<itemId>`) ou premier output de `computeNodeInfo`.

**Bilan dynamique** (`src/ui/FactorySummaryPanel.tsx`) :
- **Compteur accumulateur** : `setInterval(250 ms)` incrémente un accumulateur par item
  (`rate × dtMin`). Affiche `+1.2K` en monospace. Se remet à zéro quand la structure du bilan change.
- **Ticker animé** (`nf-bilan-ticker`) : bande CSS `repeating-linear-gradient` + `background-position`
  animée. Vitesse = `60 / rate` s. Couleur variant par type (vert surplus, amber brut, rouge déficit).
- **Débit total** : carte synthèse au-dessus du détail par item.
- Référence design : Cookie Clicker (compteur accumulé), Universal Paperclips (taux + total).

### Direction jeu (post-audit 2026-06-09)

NodeFactory évolue vers un **factory builder + idle/clicker** hybride. Mécaniques validées par
audit d'agents (voir mémoire `project_game_design_direction.md`) :

**Prochaine priorité** :
- Système de milestones de production → déblocage de recettes alternatives (ex. produire 500 Iron
  Rods pour débloquer l'Assembler). Barre de progression visible avant atteinte.
- Badge état machine (vert/orange/rouge = nominal/starved/blocked) sur le node.
- Panneau d'audit bottleneck : liste machines < 80 % capacité + cause.

**Plus tard (ne pas commencer)** :
- Offline progress avec plafond 4 h + popup récap à la reconnexion.
- Prestige/saisons : objectif → blueprint débloqué (factory pré-configurée importable).
- Coût logistique dans le LP (v2).
- Données réelles 1.0.

**Reste MVP initial** : persistance locale + partage URL (tests 11-12) ; icônes d'item sur les
arêtes ; helper lines ; données réelles 1.0 (agent prêt, accès web autorisé — rester sur le mock).
