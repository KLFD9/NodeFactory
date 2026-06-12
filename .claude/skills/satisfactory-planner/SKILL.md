---
name: satisfactory-planner
description: Domain knowledge and working rules for NodeFactory's engine core — LP solver (glpk.js), game data, factory physics (flow/power/fuel/belts), graph & logistics, stores, persistence (Vite/React/TS, React Flow). Use whenever working on this project's solver, data, graph layer, stores, UI plumbing, or persistence.
---

# Cœur moteur de NodeFactory (ex-Satisfactory Planner)

Web app, open source, gratuite, 100 % client. **NodeFactory est un JEU** factory-builder +
idle/automation : le joueur construit son usine dans un éditeur de nœuds React Flow ; le moteur
calcule flux, électricité, combustible, convoyeurs et bilans — et le solveur LP l'assiste et le note.

> Ce skill porte le **cœur moteur** (solveur, données, graphe/physique d'usine, stores,
> persistance). Pour le **gameplay / progression / longévité / équilibrage**, charge le skill
> **`game-design`** — et respecte son découplage : `game` lit `solver`/`data`/`graph`, jamais
> l'inverse ; le solveur reste un LP pur sans état de jeu.

## Vision produit (non négociable)
**Extrêmement simple pour le débutant, puissant pour l'expert.** Un seul solveur LP, deux usages :
- **Le joueur CONSTRUIT.** L'auto-génération « tape X/min → usine posée d'un coup » a été
  **retirée définitivement** (2026-06-09) : elle court-circuitait le plaisir de construire.
- **Le LP assiste et note** : « Compléter l'usine » (`src/graph/assist.ts` : lit les déficits,
  `solveDemands` calcule l'amont, `buildGraphFromSolution` le greffe, `connectFlow` le branche)
  et **score d'efficacité** (`src/game/score.ts` : 3 solves LP vs usine réelle → 3 dimensions).
  Il n'utilise que les alternatives **débloquées** (`allowedAlternates`).
- Progressive disclosure partout ; zéro friction (pas de compte, données embarquées).

## Stack imposée (ne pas dévier)
Vite + React 18 + TypeScript strict (SPA statique) · React Flow `@xyflow/react` · Zustand ·
Tailwind CSS v4 · **glpk.js** (GLPK WASM) · GSAP (animations UI) · Dexie · Vitest · Playwright.
**Pas de backend, pas de DB serveur, pas de Next.js.** Alias `@` → `src/`.

## Architecture (découplage strict)
- `src/data` — schéma + frontière unique `loadGameData()` + `validate.ts` (lecture seule).
- `src/solver` — moteur LP **pur, déterministe, sans dépendance React ni état de jeu**.
- `src/graph` — physique d'usine et logistique :
  - `computeFactory.ts` : `computeFactoryAndPower` (bilan + réseaux + fuel, 2 passes), `planBelt`.
  - `power.ts` : réseaux électriques (union-find sur câbles `power-out`/`power-in`).
  - `machineStatus.ts` : flux réels par node + états (nominal/starved/blocked/unpowered).
  - `logistics.ts`, `connection.ts`, `buildGraphFromSolution.ts`, `assist.ts`, `suggest.ts`,
    `layout.ts` (ELK), `nodeInfo.ts`.
- `src/game` — couche jeu PURE (voir skill `game-design`).
- `src/store` — Zustand : `useGraphStore` (nodes/edges, **persisté** `nf-graph`, ids recalés au
  rehydrate via `syncNodeCounter`), `useProgressionStore` (`nf-progression`), `useWorldStore`
  (gisements, `nf-world`), `useFactoryStore` (chargement des données).
- `src/ui` — composants React (HUD industriel, toolbar gauche OBJ/COMP, modales). **Aucune
  logique métier.**
- `src/persistence` — Dexie + export/import. Partage URL : à venir.
- `e2e/` — Playwright (parcours joueur ; seeds localStorage **idempotents**, format
  zustand/persist `{state, version}`).

## Physique d'usine (mécaniques actées — ne pas casser)
- **Pas de courant, pas de production** : machines des réseaux absents/en déficit coupées
  (`unpoweredMachines`), zéro flux, zéro conso.
- **Pas de charbon, pas de courant** : générateur non nourri (belt `in-coal`, débit ≥ requis)
  = 0 MW. Calcul en **2 passes** : pass 1 suppose les générateurs nourris → flux réel → pass 2
  valide. La boucle de démarrage mineur-coal ⇄ générateur converge ; pas de boucle
  énergie→fuel→énergie au-delà.
- **Belts plafonnés** : débit d'arête limité à la capacité du meilleur tier disponible.
- **Calculs THÉORIQUES** (assist, score, tests logistiques purs) : neutraliser le gating
  électrique via `computeFactory(nodes, edges, game, new Map())`. Convention à conserver.
- **Modèle de graphe : 1 node = 1 machine** ; mergers/splitters réels (hubs 3-voies) ; handles
  par item (`out-<item>`/`in-<item>`) + pins énergie (`power-in`/`power-out`) ; propagation de
  flux à travers les hubs. Clic-sur-pin de gisement = mineur lié posé (coût AP).

## Données — l'économie de NOTRE jeu
`public/data/mock/` n'est PAS un placeholder : c'est la **v1 de notre économie** (22 items,
24 recettes dont 6 alternatives, 13 bâtiments, 6 tiers de belts), à faire évoluer **pour le
feel** (agent `game-balance`). Schéma : recette = `id`, `name`, `alternate`, `time` (s),
`producedIn`, `ingredients[]`/`products[]` ({item, amountPerCycle}) ; débit/min =
`amountPerCycle * 60 / time`. Électricité : recette `coal-generator-power` (coal → electricity).

**Toute alternative doit gagner sur ≥ 1 objectif LP et perdre sur ≥ 1 autre — valider la
non-dominance PAR DES TESTS LP** (leçon T5 : la spec papier s'était trompée, ore→ingot est 1:1
sans perte). `npm run validate:data -- mock` après toute modif de données.

Données Satisfactory réelles = **inspiration optionnelle** (agent `satisfactory-data`,
`/public/data/{version}/`, jamais le défaut sans décision humaine). Ne pas parser `Docs.json`.

## Le cœur : moteur LP (glpk.js)
**Un problème de programmation linéaire, pas un parcours d'arbre.**
- Variables : taux d'exécution de chaque recette candidate.
- Contraintes : demande (production nette cible ≥ quantité) + bilans matière (prod ≥ conso).
- Objectif sélectionnable : min ressources brutes | min machines | min énergie.
- Alternatives = colonnes supplémentaires, filtrées par `allowedAlternates` (= déblocages).
- Après résolution : machines = `ceil(taux_requis / taux_machine)` ; énergie = Σ machines × MW.
- La logistique reste HORS du LP (pas de coût de belts dans le LP).

## Tests (priorité absolue)
Aucune fonctionnalité du moteur sans test sur cas à réponse connue, AVANT ou PENDANT le code.
État : **~220 tests Vitest + 15 E2E Playwright**. Couverture : solveur (7 cas canoniques + éco
v1 + non-dominance des alts), physique (bilan, gating électrique, fuel, belts), logistique
(tiering, hubs), balance/progression/tutoriel/score, données. E2E : accueil, tutoriel par clics
réels, gating palette, pose payée AP, récap offline, persistance au reload.
Reste à couvrir : partage URL (test 12 du plan d'origine).

## Pièges connus (appris sur le terrain)
- **ViewportPortal** hérite d'un pointer-events neutralisé → tout élément interactif de la couche
  monde doit réactiver `pointer-events: auto` (cf. `index.css`).
- **PowerShell + UTF-8** : jamais de `Get-Content -Raw | Set-Content` pour éditer (mojibake) —
  outils Edit/Write uniquement.
- **E2E** : `addInitScript` rejoue à chaque navigation → seeds avec marqueur `:seeded`.
- **Drop palette** : HTML5 `DataTransfer` (`application/nodefactory-building`) — en E2E,
  `evaluateHandle(new DataTransfer)` + `dispatchEvent('drop')`.
- Déposer une **machine** (pas un hub) sur une arête la branche sur `in-0/out-0` génériques →
  arêtes pendantes après choix de recette (garde-fou possible : division réservée à `logistics`).

## Méthode de travail
- Analyse d'abord, code ensuite. Incrémental : chaque tranche livrable avec ses tests verts.
- TypeScript strict aux frontières. Commits atomiques. Pas d'over-engineering.
- README et CLAUDE.md à jour quand une mécanique change.
