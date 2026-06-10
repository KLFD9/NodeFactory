# CLAUDE.md — NodeFactory

Planificateur d'usines **Satisfactory 1.0**, web, open source, 100% client. L'utilisateur fixe une
cible (« 60 plaques de fer renforcées/min ») → l'appli calcule machines, recettes (dont alternatives),
convoyeurs, énergie et matières premières, dans un éditeur de nœuds React Flow.

> **Identité (révisée 2026-06-09) : NodeFactory devient SON PROPRE jeu web.** Hybride
> **factory-builder + idle/automation**. Né comme planner Satisfactory, il **n'en vise plus la
> fidélité** : Satisfactory / Factorio / shapez sont des **inspirations de genre**, pas une spec. Items,
> recettes, débits, économie = **notre design, conçu pour le feel**. Le différenciateur : le solveur LP
> **assiste** (« Compléter ») et **note** (score d'efficacité) — il transforme « l'efficacité » en
> mécanique de progression. Le moteur LP reste pur et **agnostique des données** ; la couche jeu
> (milestones, déblocages, idle/offline, prestige, score) est **additive**. Le **game balance est une
> discipline centrale** (« essentiel pour le feel »).

> **Deux skills projet :**
> - **`satisfactory-planner`** — le **cœur** : domaine, formulation LP, tables de valeurs, données,
>   graphe, store, persistance, stratégie de test. À charger pour le solveur/données/graphe/UI.
> - **`game-design`** — le **jeu** : boucle de gameplay, progression, longévité (Hook/Habit/Hobby),
>   idle/offline, prestige, score d'efficacité, équilibrage. À charger pour toute mécanique de jeu.
>
> **Trois agents** (`.claude/agents/`) : `satisfactory-data` (vraies données 1.0), `game-design-veille`
> (veille concurrentielle + reco game design), `game-balance` (équilibrage chiffré de la progression).
> Ce CLAUDE.md n'est que le résumé opérationnel des deux skills.

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
| `src/game`         | **Couche jeu PURE** : économie/équilibrage (`balance.ts`), progression (`progression.ts`), score (`score.ts`). Lit `data`/`solver`/`graph`, **jamais l'inverse**. |
| `src/store`        | État Zustand (`useFactoryStore` = données/objectif ; `useGraphStore` = graphe ; `useProgressionStore` = progression, persistée localStorage). |
| `src/ui`           | Composants React, nœuds custom, panneaux. **Aucune logique métier ici.** |
| `src/persistence`  | Dexie + export/import JSON + état → URL compressée (partage). |

## Règles non négociables

- **Vision** : extrêmement simple pour le débutant, puissant pour l'expert. En cas de doute UX,
  choisir le contact simple et planquer la puissance derrière un mode avancé (progressive disclosure).
- **Données = l'économie de NOTRE jeu** (révisé) : tout passe par `loadGameData()` (frontière unique,
  schéma stable, solveur/UI agnostiques). Mais `public/data/mock/` n'est plus un placeholder « en
  attendant Satisfactory » : c'est la **v1 de notre économie**, à faire évoluer **pour le feel** (via
  `game-balance`). Importer des valeurs Satisfactory réelles (`satisfactory-data`) = **inspiration
  optionnelle**, plus l'objectif. Ne pas parser `Docs.json`.
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
ressources/machines/énergie, `allowedAlternates`).

> **Retiré (2026-06-09)** : l'**auto-génération** (« tape X/min → usine posée d'un coup », bouton
> Calculer + `TargetPanel`) a été **supprimée** — recentrage sur le gameplay : le joueur **construit**.
> `buildGraphFromSolution` et `solveDemands` subsistent au service de l'**assistance** (« Compléter
> l'usine ») et du futur **score d'efficacité**.

**Modèle de graphe : 1 node = 1 machine** (décision user). On pose une machine par node (1 in/1 out) et
on insère des **mergers/splitters réels** entre les groupes ; `computeFactory` fait la **propagation de
flux** à travers ces hubs (merger = somme, splitter = répartition). Handles par item, hubs = nodes
`buildingId: 'merger'|'splitter'` avec `portsIn/portsOut` dynamiques.

**Optimisation assistée** : `src/graph/assist.ts` `completeFactory` (« Compléter l'usine ») —
lit les déficits, `solveDemands` calcule l'amont, `buildGraphFromSolution` le génère et `connectFlow`
(`src/graph/logistics.ts`) le branche sur les consommateurs existants. Bouton dans `FactorySummaryPanel`
(avec sélecteur d'objectif LP). N'utilise que les **alternatives débloquées** par les milestones.

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

### Direction jeu — intentions finales (audit + veille 2026-06-09)

NodeFactory = **factory-builder + idle/automation web**. Détail complet dans le skill `game-design` ;
résumé opérationnel ici. **État réel du code : la couche jeu n'existe pas encore** — `useFactoryStore`
n'a aucun état de progression. Le « game feel » déjà livré (belts animés, barres de cycle, ticker) est
purement visuel ; il prépare le terrain mais ne contient ni monnaie, ni déblocage, ni idle.

**Boucle** : cible/milestone → construire (auto ou manuel) → regarder tourner → accumuler (monnaie
méta dérivée du **débit réel**, jamais de faux nombres) → optimiser (les objectifs LP = **score
d'efficacité**, le méta-jeu) → débloquer / étendre / prestige.

**Longévité** : Hook (0-30 min, « ça tourne tout seul ») → Habit (1-7 j, milestones + audit bottleneck
+ horloges de réengagement exponentielles ~20 min/5 h/2 j) → Hobby (semaines-mois, score + classements
+ prestige + tech tree 1.0).

**Découplage non négociable** : couche jeu dans `src/game/` + `useProgressionStore` ; `game` lit
`solver`/`data`, **jamais l'inverse** ; le solveur reste un LP pur sans état de jeu. Les milestones
**filtrent les recettes** passées *en entrée* du LP (seul point de contact, bon sens de dépendance).

**Ordre d'implémentation** (chaque tranche testée avant la suivante) :
1. ✅ Slice d'état de jeu (`src/game` purs + `useProgressionStore` persisté ; tick live + offline). **Fait.**
2. ✅ Milestones + déblocages appliqués (palette/inspecteur/LP) + `MilestonePanel` + `UnlockToast`. **Fait.**
3. ✅ **REC-04** : badges d'état machine (`MachineNode`) + audit bottleneck (`BottleneckPanel`), via le
   helper pur `src/graph/machineStatus.ts`. **Fait.**
4. ✅ **REC-05** : score d'efficacité (`src/game/score.ts` `evaluateEfficiency` + carte 3 dims dans le
   Bilan). **Fait.**
5. Idle/offline : tick + gains offline **faits** ; reste la **popup récap** de reconnexion.
6. Prestige / blueprints — base dans `balance.ts`, **non câblé**.

### 🔖 Reprise (état au 2026-06-10) — détail dans la mémoire `project_repo_state`
**147 tests verts**, typecheck/build/validate:data OK, **tout NON commité**. Économie maison **v1**
implémentée (T1-T4 : `public/data/mock/` → 21 items / 20 recettes, chaîne 5 étages, branches acier +
électronique ; spec `Docs/design/2026-06-10-economie-maison-v1.md`). **Prochaine étape : T5+T6** =
3 recettes alternatives (arbitrages LP pour le score) + leur gating via milestones M11-M13 (JSON prêt
dans la spec §7). MAJ visuelles depuis les notes « game feel » ci-dessus : le « point d'activité » est
devenu un **badge d'état** (nominal/sous-alim./en attente) ; le compteur du Bilan lit désormais
`cumulativeProduced` **persistant** (ne se réinitialise plus).

**Garde-fous** : pas de dark patterns ; cohérence interne de NOTRE économie (pas de faux nombres) ;
courbes idle prod ×~1.1 / coût ×~1.15. Équilibrage chiffré → agent `game-balance` ; veille → `game-design-veille`.

**Backlog** : popup récap offline ; prestige (REC-07) ; persistance du **graphe** + partage URL
(tests 11-12) ; pondération AP par palier (Q6, différée) ; proxy efficacité du tick à raffiner.
