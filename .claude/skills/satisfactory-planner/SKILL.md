---
name: satisfactory-planner
description: Domain knowledge and working rules for NodeFactory — the Satisfactory 1.0 factory planner (Vite/React/TS, glpk.js LP solver, React Flow node editor). Use whenever working on this project's solver, game data, graph/logistics layer, store, UI, or persistence.
---

# Satisfactory Factory Planner (NodeFactory)

Web app, open source, gratuit, 100% client. L'utilisateur fixe une production cible
(« 60 plaques de fer renforcées/min ») et l'appli calcule automatiquement machines,
recettes (y compris alternatives), convoyeurs, énergie et matières premières — le tout
dans un éditeur de nœuds React Flow.

## Vision produit (non négociable)
**Extrêmement simple pour le débutant, puissant pour l'expert.** DEUX modes co-égaux, **un seul
solveur LP** derrière les deux :
- **Mode auto (débutant)** : tape « X par minute » → l'appli pose tout le schéma seule (plan complet,
  zéro jargon, zéro config, zéro fichier).
- **Mode assisté (expert)** : l'utilisateur a déjà commencé son graphe (ex. extracteur → split → 2
  fonderies → merge → plaques de fer) et veut le pousser plus loin (ajouter un fabricateur pour des
  plaques renforcées). Il peut éditer à la main **ou** demander à l'appli d'optimiser son graphe existant.
  - Mécanique LP : les nodes déjà posés deviennent des **contraintes fixées** (recettes forcées,
    machines imposées = bornes) ; le LP optimise *le reste* pour atteindre la cible en minimisant le
    gaspillage. « Aide-moi à optimiser » = relancer le LP avec ces choix forcés et montrer le delta
    (moins de minerai / machines / énergie).
- Minimalisme visuel : progressive disclosure, la puissance est cachée derrière un mode avancé.
- Zéro friction : pas de compte, pas d'installation, la donnée du jeu est déjà là.
- Arbitrage par défaut : si une feature rend l'appli plus puissante mais plus intimidante au
  premier contact, choisir le contact simple et planquer la puissance.

**Séquencement** : implémenter d'abord le solveur + auto-génération (validés sur cas connus), PUIS
poser l'édition manuelle et l'optimisation assistée *par-dessus le même solveur* (le brief rangeait
l'édition manuelle en v2 ; la vision affinée la fait remonter dans le MVP comme second mode, mais on
ne la construit qu'une fois le moteur vérifié).

## Stack imposée (ne pas dévier)
Vite + React 18 + TypeScript (SPA statique) · React Flow `@xyflow/react` · Zustand ·
Tailwind CSS · **glpk.js** (GLPK WASM) pour le LP · Dexie (IndexedDB).
**Pas de backend, pas de DB serveur, pas de Next.js.** Tout tourne dans le navigateur.
Déployable sur Cloudflare Pages / Vercel / GitHub Pages.

## Architecture (découplage strict)
- `src/data` — chargement + typage des données du jeu (lecture seule). Frontière unique
  `loadGameData()` qui renvoie des objets typés. **Tout le reste ignore d'où viennent les données.**
- `src/solver` — moteur LP **pur, déterministe, sans dépendance React**. Testable en isolation.
- `src/graph` — construction du graphe React Flow depuis une solution + couche logistique.
- `src/store` — état Zustand.
- `src/ui` — composants React, nœuds custom React Flow, panneaux.
- `src/persistence` — Dexie + export/import JSON + état → URL compressée pour le partage.

**Pas de logique métier dans les composants React.** Le solveur ne dépend jamais de l'UI.

## Données — approche mock-first
MVP = données **mockées** au format du schéma **final** (pas un raccourci jetable, même forme
que les vraies données). Le jour où l'extraction produit le vrai JSON, il remplace le mock
**sans changer une ligne de type** — on ne touche qu'au chargeur.

Mock dans `/public/data/mock/` : `recipes.json`, `items.json`, `buildings.json`, `belts.json`,
`generators.json`. Sous-ensemble cohérent vérifiable à la main : chaîne fer complète
(minerai → lingot → plaque/tige → vis → plaque de fer renforcée → cadre modulaire), cuivre
(minerai → lingot → fil → câble), béton. **2-3 recettes alternatives** (Cast Screw, Bolted Iron
Plate, Iron Wire) pour donner de vrais arbitrages au solveur. Valeurs correctes = elles valident
les tests.

Extraction réelle : **préparée mais PAS branchée**. `/scripts/extraction/` = README (sources :
`Docs.json` du jeu le plus fiable, wiki satisfactory.wiki.gg, sheets communautaires ; cible =
même schéma normalisé, versionné par patch dans `/public/data/{version}/`) + stub `extract.ts`
commenté non implémenté (signature + étapes parser→normaliser→valider→écrire + TODO).
**Ne pas parser Docs.json maintenant.**

**Agent dédié `satisfactory-data`** (`.claude/agents/`) : récupère/recoupe les vraies données depuis
les sources autoritatives et écrit du JSON versionné dans `/public/data/{version}/`. Garde-fous :
source canonique = `Docs.json` (le wiki en recoupement, ≥ 2 sources sinon « à vérifier ») ; il écrit
UNIQUEMENT dans `/public/data/{version}/`, jamais le solveur/UI/schéma ; **porte de vérification
obligatoire** `npm run validate:data -- <version>` (réutilise `validateGameData`). Le défaut reste
`mock` tant qu'une version réelle n'est pas validée ET relue — changer `GAME_DATA_VERSION` est une
décision humaine. L'agent prépare les données en parallèle sans rien casser ni bloquer le MVP.

### Schéma (référence)
Recette : `id`, `name`, `alternate` (bool), `time` (s), `producedIn` (bâtiment),
`ingredients[]` ({item, amountPerCycle}), `products[]` ({item, amountPerCycle}).
Débit/min = `amountPerCycle * 60 / time`.

Tables connues (valeurs 1.0 à vérifier) :
- Convoyeurs (items/min) : Mk1=60, Mk2=120, Mk3=270, Mk4=480, Mk5=780, Mk6=1200.
- Énergie machines (MW) : Smelter 4, Constructor 4, Foundry 16, Assembler 15, Manufacturer 55,
  Refinery 30, Oil Extractor 40, Miner Mk1/2/3 = 5/12/30.
- Pureté nœud : Impure ×0.5, Normal ×1, Pure ×2.

## Le cœur : moteur LP (glpk.js)
**C'est un problème de programmation linéaire, pas un parcours d'arbre.** C'est ce qui distingue
l'outil des calculateurs Excel naïfs.
- Variables : taux d'exécution de chaque recette candidate.
- Contrainte de demande : production nette de l'item cible ≥ quantité demandée.
- Bilans : pour chaque item intermédiaire, production ≥ consommation.
- Objectif (sélectionnable) : min ressources brutes (défaut) | min machines | min énergie.
- Recettes alternatives = colonnes supplémentaires, activables globalement/individuellement.

Après résolution : machines = `ceil(taux_requis / taux_machine)` ; énergie = Σ machines ×
conso unitaire.

**Couche logistique découplée du LP** (calculée sur le graphe au MVP, pas dans le LP) :
par arête débit→tier de convoyeur minimal ; si > 1200/min insérer splitter et paralléliser sur
`ceil(débit/1200)` lignes ; mergers pour regrouper ; colorer les arêtes par tier ; signaler
surcharge. **Ne pas mettre le coût des belts dans le LP au MVP (v2).**

Avant d'écrire le solveur : **analyser l'API glpk.js et proposer la formulation LP au user pour
validation**, puis implémenter.

## Tests (Vitest — dès le départ, priorité absolue)
Aucune fonctionnalité du solveur n'est terminée sans son test. Écrire le test en même temps que
(ou avant) le code, sur les cas dont on connaît la réponse à la main.

Solveur : (1) mono-machine 30 lingots/min→1 Smelter ; (2) chaîne 2 étages 60 plaques→3 Constructors
+ Smelters amont ; (3) choix recette alternative selon objectif ; (4) changement d'objectif donne
solutions différentes ; (5) conservation matière (prod≥conso à epsilon) ; (6) sous-produits jamais
ignorés ; (7) infaisabilité → erreur explicite, pas de crash.
Logistique : (8) tiering (60→Mk1, 61→Mk2, 1200→Mk6, 1500→2 lignes Mk6+splitter) ; (9) splitter
(Σ sorties = entrée) ; (10) merger (Σ entrées = sortie, détection surcharge).
Persistance : (11) round-trip save→load identique ; (12) partage URL identique.
Données : (13) tout item/producedIn référencé existe, aucun débit négatif, aucune recette sans produit.

## Périmètre — MVP vs v2
**MVP maintenant** : données mockées · extraction préparée non implémentée · solveur LP 3 objectifs
+ toggle alternatives · génération graphe + tiering + splitters/mergers auto · saisie cible ultra-simple ·
panneau résultats (machines, énergie, ressources brutes) · persistance locale + partage URL · tests verts.

**v2+ (NE PAS commencer)** : extraction/intégration vraies données 1.0 · données complètes (fluides,
nucléaire, sloops) · overclock/power shards/somersloops · coût logistique dans le LP · suggestion de
patterns de build (manifold vs load-balanced, bus, footprint) — la feature différenciante mais après
un MVP solide · mode édition manuelle avancée.

**Idées à garder (backlog)** :
- *Suggestions contextuelles de connexion* : quand l'utilisateur tire une arête depuis un node existant
  (ou pose un node), proposer les bâtiments/recettes **pertinents par rapport au graphe** — typiquement
  ceux qui consomment l'item produit par le node source (ex. node Smelter→Iron Ingot ⇒ proposer Iron
  Plate / Iron Rod / Cast Screw…). Réduit la friction du mode manuel sans imposer de jargon. Réutilise
  `computeNodeInfo` (sorties du node) + un index « item → recettes qui le consomment ».
- *Améliorations React Flow* (issues d'une recherche dédiée, par priorité) :
  - **Fait** : handles par item (`out-<item>`/`in-<item>`), routage des arêtes par handle dans
    `computeFactory`, flèches `markerEnd`, MiniMap, badge ×N, lazy-load glpk.
  - **Effort moyen** : arête custom `BeltEdge` + `EdgeLabelRenderer` (label HTML riche : icône item +
    débit + tier coloré) ; `isValidConnection` (anti self-loop, port d'entrée déjà occupé, item
    compatible) ; `NodeToolbar` pour +/− machines et suppression contextuelle ; titre du node = item
    produit + icône (façon satisfactory-calculator).
  - **Plus tard** : auto-layout **ELK (`elkjs`, algo `layered`, direction RIGHT)** en remplacement du
    placement grille de `buildGraphFromSolution` ; helper lines au drag ; cross-highlight récap↔node ;
    propagation de flux à travers splitters/mergers (logistique implicite sur les liens) ;
    **copié-collé de nodes** (Ctrl/Cmd+C/V, duplication) — demandé, bon pour l'interaction.
  - *Représentation N machines* : tension entre node agrégé (×N, un belt = total) et fidélité physique
    (1 node = 1 machine, belts + splitters/mergers réels). La fidélité complète (manifold/load-balanced)
    est la feature différenciante **rangée en v2** par le brief car elle exige la **propagation de flux
    à travers la logistique**. Décision de modèle à arbitrer avec le user.
- *Données réelles* : l'agent d'extraction nécessite un accès **WebFetch/WebSearch (et Bash pour
  `validate:data`)** OU un `Docs.json` déposé dans le projet. Sans ça, ne rien inventer — rester sur le mock.

**Ne pas déborder sur la v2. Un MVP simple et correct d'abord.**

## Méthode de travail
- Analyse d'abord, code ensuite. Incrémental et testé : chaque tranche livrable avec ses tests verts
  avant la suivante, lancer les tests après chaque tranche.
- TypeScript strict, types explicites aux frontières (données du jeu, I/O solveur).
- Commits atomiques, messages clairs. Pas d'over-engineering (la donnée tient en mémoire).
- README à jour : ce que fait l'appli, `dev`/`build`/`test`, structure des dossiers.
