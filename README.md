# NodeFactory — Construis · Automatise · Optimise

**NodeFactory est un jeu web** hybride **factory-builder + idle/automation**, open source, gratuit,
**100 % client** (aucun backend, aucun compte). Tu poses des mineurs sur des gisements, tu relies
machines, convoyeurs et câbles électriques dans un éditeur de nœuds, et ton usine produit en
continu — même hors-ligne. Les paliers de production débloquent bâtiments et recettes alternatives.

> **Le différenciateur** : un vrai solveur d'optimisation linéaire (GLPK) **t'assiste**
> (« Compléter l'usine » comble les déficits) et **te note** (score d'efficacité = à quel point ton
> usine approche l'optimum). L'efficacité devient une mécanique de progression — ça n'existe nulle
> part ailleurs dans le genre.

Né comme planificateur Satisfactory, NodeFactory a pivoté : Satisfactory/Factorio/shapez sont des
**inspirations de genre**, pas une spec. Items, recettes, débits = notre propre économie, conçue
pour le feel.

## Les règles du monde

- **Pas de courant, pas de production** : chaque machine doit appartenir à un réseau électrique
  alimenté (générateurs + câbles ⚡). Un réseau en déficit s'arrête entièrement.
- **Pas de charbon, pas de courant** : les générateurs consomment du combustible réel (convoyeur
  de charbon requis). La première usine est une boucle auto-alimentée mineur ⇄ générateur.
- **Les convoyeurs ont une capacité** : le débit est physiquement plafonné par le tier du belt.
- **Jamais de faux nombres** : la monnaie méta (AP) dérive du débit réel de l'usine ; les gains
  hors-ligne sont du delta-time plafonné à 4 h. La simulation est la vérité.

## Stack

Vite · React 18 · TypeScript (strict) · [React Flow](https://reactflow.dev) (`@xyflow/react`) ·
Zustand · Tailwind CSS v4 · **glpk.js** (GLPK WASM, optimisation linéaire) · GSAP · Dexie ·
Vitest · Playwright.

## Démarrer

```bash
npm install
npm run dev          # serveur de dev Vite
npm run build        # build statique (dist/)
npm run preview      # prévisualise le build
npm run test         # suite Vitest (unitaires, une fois)
npm run test:watch   # Vitest en watch
npm run test:e2e     # suite Playwright (parcours joueur, lance Vite tout seul)
npm run typecheck    # vérification de types
npm run validate:data -- mock   # valide le dataset
```

## Structure des dossiers

```
public/data/mock/        L'économie du jeu v1 (22 items, 24 recettes dont 6 alternatives)
src/
  data/                  Schéma + frontière de chargement unique loadGameData() (lecture seule)
  solver/                Moteur LP pur et déterministe (glpk.js) — sans dépendance UI ni état de jeu
  graph/                 Calcul d'usine (flux, électricité+fuel, belts), logistique, suggestions
  game/                  Couche jeu PURE : balance, progression, milestones, score, tutoriel
  store/                 État Zustand (graphe + progression + monde, persistés en localStorage)
  ui/                    Composants React (canvas, panneaux HUD, modales, nœuds custom)
  persistence/           Dexie + export/import (partage URL : à venir)
e2e/                     Tests Playwright du parcours joueur réel
Docs/design/             Specs de conception et backlog gameplay
```

## La boucle de jeu

1. **Objectif** : un milestone dit quoi viser (« produis 60 Iron Ingot → débloque le Constructor »).
2. **Construire** : pose les machines (coût en AP), relie convoyeurs et câbles.
3. **Regarder tourner** : belts animés, barres de cycle, badges d'état, bilan en direct.
4. **Accumuler** : la production réelle génère des Automation Points — y compris hors-ligne (≤ 4 h).
5. **Optimiser** : les objectifs LP (min ressources/machines/énergie) notent ton usine.
6. **Débloquer** : 13 milestones — bâtiments, miners Mk.2/3, recettes alternatives… puis prestige.

## Le moteur de calcul

Le cœur est un problème de **programmation linéaire** (pas un parcours d'arbre) : variables = taux
d'exécution des recettes ; contraintes de demande + bilans matière ; objectif sélectionnable.
Le solveur est une **fonction pure et déterministe**, testée en isolation, sans état de jeu.
La physique de l'usine (`computeFactoryAndPower`) calcule flux, réseaux électriques et combustible
en deux passes cohérentes ; les calculs *théoriques* (assistance, score) neutralisent le gating
électrique — le courant est le problème du joueur, pas du solveur.

## Tests

Plus de 230 tests : unitaires (Vitest — solveur sur cas vérifiés à la main, balance, progression,
physique d'usine, tutoriel) et bout-en-bout (Playwright — accueil, tutoriel par clics réels,
gating de palette, pose payée en AP, récap offline, persistance au reload).

## Licence

Open source. (À préciser.)
