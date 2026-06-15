# CLAUDE.md — NodeFactory

**NodeFactory est NOTRE jeu web** : hybride **factory-builder + idle/automation**, 100 % client,
open source. Le joueur pose des mineurs sur des gisements, relie machines/convoyeurs/câbles dans un
éditeur React Flow, et l'usine produit en continu (même hors-ligne). Né comme planner Satisfactory,
il **n'en vise plus la fidélité** : Satisfactory/Factorio/shapez = inspirations de genre, pas une
spec. Items, recettes, débits, économie = **notre design, conçu pour le feel**.

> **Le différenciateur** : le solveur LP **assiste** (« Compléter l'usine ») et **note** (score
> d'efficacité = distance à l'optimum). L'efficacité est une mécanique de progression. Ne jamais
> diluer ça. Le **game balance est une discipline centrale**.

> **Deux skills projet :**
> - **`satisfactory-planner`** — le **cœur** : domaine, formulation LP, données, graphe/physique
>   d'usine, stores, persistance, stratégie de test.
> - **`game-design`** — le **jeu** : boucle, progression, longévité (Hook/Habit/Hobby),
>   idle/offline, prestige, score, équilibrage.
>
> **Trois agents** (`.claude/agents/`) : `satisfactory-data` (données réelles, inspiration
> optionnelle), `game-design-veille` (veille concurrentielle), `game-balance` (équilibrage chiffré).

## Commandes

```bash
npm run dev          # dev Vite
npm run build        # tsc -b && vite build (statique → dist/)
npm run test         # vitest run (unitaires)
npm run test:watch   # vitest watch
npm run test:e2e     # Playwright (parcours joueur ; démarre Vite tout seul)
npm run typecheck    # tsc -b --noEmit
npm run validate:data -- mock   # valide le dataset
```

## Stack imposée (ne pas dévier)

Vite + React 18 + TypeScript strict · React Flow `@xyflow/react` · Zustand · Tailwind CSS v4 ·
**glpk.js** (LP en WASM) · GSAP (animations UI) · Dexie · Vitest · Playwright.
**Pas de backend, pas de DB serveur, pas de Next.js.** Alias `@` → `src/`.

## Architecture — découplage strict

| Dossier            | Rôle |
| ------------------ | ---- |
| `src/data`         | Schéma (`types.ts`) + frontière **unique** `loadGameData()` + `validate.ts`. Lecture seule. |
| `src/solver`       | Moteur **LP pur et déterministe**, zéro dépendance React/UI/état de jeu. |
| `src/graph`        | Physique d'usine : `computeFactoryAndPower` (flux + électricité + fuel, 2 passes), logistique (belts plafonnés, splitters/mergers), `machineStatus`, `suggest`, `assist` (LP), `power`. |
| `src/game`         | **Couche jeu PURE** : `balance.ts` (économie chiffrée), `progression.ts`, `score.ts`, `tutorial.ts`. Lit `data`/`solver`/`graph`, **jamais l'inverse**. |
| `src/store`        | Zustand : `useGraphStore` (nodes/edges, **persisté** `nf-graph`), `useProgressionStore` (persisté `nf-progression`), `useWorldStore` (gisements, persisté `nf-world`), `useFactoryStore` (données). |
| `src/ui`           | Composants React (HUD industriel orange/cyan, GSAP). **Aucune logique métier ici.** |
| `src/persistence`  | Dexie + export/import. Partage URL : à venir. |
| `e2e/`             | Tests Playwright du parcours joueur (seeds localStorage idempotents). |

## Règles du monde (mécaniques actées, ne pas casser)

- **Pas de courant, pas de production** : `computeFactoryAndPower` coupe les machines des réseaux
  électriques absents/en déficit (`unpoweredMachines`). Réseaux = composantes connexes des câbles
  `power-out`/`power-in` (union-find, `src/graph/power.ts`).
- **Pas de charbon, pas de courant** : un générateur non nourri en combustible (belt `in-coal`,
  débit suffisant) génère 0 MW. Calcul en **2 passes** (pass 1 suppose les générateurs nourris →
  flux réel → pass 2 valide). La boucle de démarrage mineur-coal ⇄ générateur converge.
- **Belts plafonnés** : le débit d'une arête est limité à la capacité du meilleur tier disponible.
- **Calculs THÉORIQUES** (assistance LP, score d'efficacité) : neutralisent le gating électrique
  via `computeFactory(nodes, edges, game, new Map())`. Convention à conserver.
- **Jamais de faux nombres** : AP dérivés du débit réel × efficacité ; offline = delta-time
  plafonné 4 h ; courbes idle prod ×1.1 / coût ×1.15. Pas de dark patterns.

## Règles non négociables

- **Vision** : extrêmement simple pour le débutant, profond pour l'expert (progressive
  disclosure — milestones repliés, tutoriel par sections, palette gatée).
- **Données = l'économie de NOTRE jeu** : tout passe par `loadGameData()`. `public/data/mock/` est
  la **v1 de notre économie** (22 items, 24 recettes dont 6 alts, 13 bâtiments), à faire évoluer
  pour le feel (agent `game-balance`). Chaque alt doit gagner sur ≥ 1 objectif LP et perdre sur
  ≥ 1 autre — **valider la non-dominance par des tests LP**, pas sur le papier.
- **Le solveur est un LP** pur, sans état de jeu. Les milestones filtrent les recettes EN ENTRÉE
  du LP (`allowedAlternates`) — seul point de contact.
- **Tests d'abord/en même temps** : aucune mécanique sans test sur cas à réponse connue. Lancer
  `npm run test` après chaque tranche ; E2E pour tout ce qui touche le parcours joueur.
- **TypeScript strict** aux frontières. Commits atomiques. Pas d'over-engineering.
- **Zéro emoji dans l'UI** (décision user 2026-06-12) : toujours des **SVG** (`src/ui/icons.tsx`
  ou inline) ou la bibliothèque d'icônes du projet — le design doit coller à l'identité HUD
  industriel (monochrome, glow). Les caractères techniques monochromes (✓ ▶ ▼) sont tolérés
  dans les badges façon terminal ; aucun emoji coloré.

## État du jeu (2026-06-15)

> **Source de vérité « état + route vers la prod »** : `Docs/design/2026-06-15-roadmap-prod.md`
> (étapes établies, tâches restantes priorisées, check-list de vérification avant release).
> Cette section en est le résumé ; mettre les deux à jour ensemble.

**Pivot thématique acté — « Scrappy AI Lab »** (factory idle × Game Dev Tycoon). Le *genre*
(factory-builder + idle + score LP) est conservé ; seul le **thème** change (startup IA, vocabulaire
authentique mais accessible) et une **couche méta « Tycoon »** s'ajoute par-dessus le moteur d'usine.
Doc directeur : `Docs/design/2026-06-14-pivot-theme-startup-ia.md`.

**Salle des machines (moteur usine) — jouable de bout en bout** : accueil → tutoriel 9 étapes / 3
sections (Compute : boucle données→Datacenter auto-alimentée → Pipeline de données → Automatisation),
dérivé du graphe (`src/game/tutorial.ts`) · pose payée en **Bolts** (capital 50, `BUILDING_COSTS`) ·
clic-sur-pin pose un extracteur lié · suggestion contextuelle · 13 milestones · **contrats** clients
procéduraux (source de Bolts) · améliorations par machine · score d'efficacité 3 dims · récap offline
(plafond 4 h) · usine/progression/monde **persistés** · carte du monde en **biomes** · UI HUD
(toolbar OBJ/COMP/INSP/BILAN, GSAP). Dataset re-thématisé IA (`public/data/mock/`).

**Le Bureau (couche Tycoon, P1 livré)** : `src/game/tycoon.ts` (PUR, testé) — projet de modèle
(type × domaine × **dosage des phases**), **run piloté par le débit de compute** (= item `electricity`),
**qualité** = axe séparé du LP (dosage × dataset × compute − défauts) ; **ship → review** (benchmark +
réception × tendance × **hype**) → **revenus $ + RP + renommée** ; **staff** (3 rôles : vitesse run /
qualité / dataset, **masse salariale** récurrente) ; **marketing** pré-lancement. UI : `TycoonPanel`
(bouton **LAB** gaté au compute) + `ShipReviewToast`. Boucle : produire compute → projet → (marketing)
→ ship → $/RP/renommée → réinvestir (usine + staff) → recommencer.

**341 tests unitaires + 19 E2E verts** (typecheck + build OK). ⚠️ 1 E2E `AMÉLIORER` cassé **avant le
pivot** (NodeToolbar introuvable, sans rapport — à corriger). Tous les nombres de `tycoon.ts` sont un
premier jet `[À VALIDER game-balance]`. **Non committé** (cohérent avec l'historique).

## Pièges connus (appris sur le terrain)

- **ViewportPortal** : hérite d'un pointer-events neutralisé → tout élément interactif de la
  couche monde doit réactiver `pointer-events: auto` (cf. `index.css`).
- **PowerShell + fichiers UTF-8** : ne JAMAIS faire de remplacement regex via
  `Get-Content -Raw | Set-Content` (mojibake) — utiliser les outils Edit/Write.
- **E2E** : `addInitScript` rejoue à CHAQUE navigation → seeds localStorage idempotents
  (marqueur `:seeded`). Le format persist zustand est `{state, version}`.
- **Ids de nodes** : compteur module-level recalé au rehydrate (`syncNodeCounter`) — ne pas
  créer d'ids autrement que par `nextId()`.
