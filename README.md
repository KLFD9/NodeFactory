# NodeFactory — Satisfactory Factory Planner

Planificateur d'usines pour **Satisfactory 1.0**, web, open source, gratuit, **100% client**
(aucun backend). On fixe une production cible (« 60 plaques de fer renforcées / minute ») et
l'appli calcule automatiquement les machines, les recettes (y compris alternatives en minimisant
le gaspillage), les convoyeurs, l'énergie et les matières premières — le tout dans un éditeur de
nœuds.

> **Vision : extrêmement simple pour le débutant, puissant pour l'expert.** Le débutant tape
> « je veux X par minute » et obtient un plan complet ; l'expert bascule en mode manuel.

## Stack

Vite · React 18 · TypeScript (strict) · [React Flow](https://reactflow.dev) (`@xyflow/react`) ·
Zustand · Tailwind CSS v4 · **glpk.js** (GLPK WASM, optimisation linéaire) · Dexie (IndexedDB) ·
Vitest.

## Démarrer

```bash
npm install
npm run dev        # serveur de dev Vite
npm run build      # build statique (dist/)
npm run preview    # prévisualise le build
npm run test       # suite Vitest (une fois)
npm run test:watch # Vitest en watch
npm run typecheck  # vérification de types
```

Aucune configuration, aucun compte : les données du jeu sont déjà là.

## Structure des dossiers

```
public/data/mock/        Données mockées (fer + cuivre + béton + alternatives), au format final
src/
  data/                  Schéma + frontière de chargement unique loadGameData() (lecture seule)
  solver/                Moteur LP pur et déterministe (glpk.js) — sans dépendance UI
  graph/                 Graphe React Flow depuis une solution + couche logistique (belts/splitters)
  store/                 État global Zustand
  ui/                    Composants React (panneaux, nœuds custom)
  persistence/           Dexie + export/import JSON + partage par URL compressée
  test/                  Helpers de test (chargement du mock, setup)
scripts/extraction/      Pipeline d'extraction des vraies données 1.0 (préparé, non branché)
```

## Données — mock-first

Le MVP tourne sur des **données mockées** au format du schéma **final**, derrière la frontière
unique `loadGameData()`. Tout le reste de l'appli (solveur, graphe, UI) ignore d'où viennent les
données. L'extraction des vraies données 1.0 (depuis `Docs.json`) est **préparée mais pas
implémentée** — voir `scripts/extraction/README.md`. Le jour venu, on ne touchera qu'au chargeur.

## Le moteur de calcul

C'est un problème de **programmation linéaire** (pas un parcours d'arbre) : variables = taux
d'exécution des recettes ; contraintes de demande + bilans matière ; objectif sélectionnable
(min ressources brutes / machines / énergie). Le solveur est une **fonction pure et déterministe**,
testée en isolation. La couche logistique (tiering convoyeurs, splitters/mergers) est **découplée**
du LP et calculée sur le graphe.

## État d'avancement

- [x] Initialisation stack + structure de dossiers
- [x] Schéma de données + `loadGameData()` + validation
- [x] Jeu de données mocké (fer + cuivre + béton + 3 alternatives)
- [x] Dossier d'extraction préparé (README + stub `extract.ts`)
- [x] Éditeur de nœuds manuel (palette par catégorie, drag & drop, inspecteur, multiplicateur)
- [x] Couche de calcul du graphe (machines, énergie, bilan matière, tiering convoyeur) + tests
- [x] Solveur LP (glpk.js) au service de l'assistance et du score (tests 1-7)
- [x] Splitters/mergers réels (arbres 3-voies), propagation de flux, insertion sur arête (+/drop)
- [x] Optimisation assistée : « Compléter l'usine » (comble les déficits, greffe + branche l'amont)
- [x] Couche jeu : progression (AP, milestones, déblocages), tick live + gains offline, panneau
      d'objectifs + pop-up de déblocage
- [ ] Score d'efficacité affiché · audit bottleneck · prestige · persistance graphe + partage URL

> **Note** : l'auto-génération « tape X/min → usine complète » a été retirée — NodeFactory devient un
> jeu de construction : tu poses ton usine, le solveur t'assiste (« Compléter ») et te note.

## Licence

Open source. (À préciser.)
