# Brief projet — Satisfactory Factory Planner (open source)

> À coller dans Claude Code au démarrage du projet. Crée le squelette en même temps que tu lis ce brief.

---

## 1. Ce qu'on construit

Un **planificateur d'usines pour Satisfactory 1.0** (PC/console), web, open source, gratuit.

L'utilisateur fixe une **production cible** (ex. « 60 plaques de fer renforcées / minute ») et l'appli calcule **automatiquement** :
- le nombre de machines de chaque type,
- les recettes à utiliser (y compris les recettes alternatives), de façon à **minimiser le gaspillage de ressources brutes**,
- le tier et le nombre de convoyeurs nécessaires sur chaque liaison,
- la consommation d'énergie totale et les flux de matières premières.

Le tout dans un **éditeur de nœuds** : l'utilisateur (ou l'appli) place des nœuds (machines, splitters, mergers, sources, sorties) et les relie par des « convoyeurs » (les arêtes).

## 2. La vision produit — non négociable

**Extrêmement simple pour le débutant, puissant pour l'expert.** C'est la tension centrale du projet, garde-la en tête à chaque décision d'UX.

- **Le débutant** tape « je veux X par minute » et obtient un plan complet sans rien comprendre aux ratios. Aucun jargon imposé, aucune config initiale, zéro fichier à importer.
- **L'expert** peut basculer en mode manuel : éditer le graphe à la main, forcer des recettes, ajuster les overclocks, choisir le critère d'optimisation (ressources / machines / énergie).
- **Minimalisme visuel.** Interface épurée, pas de murs d'options. Les fonctions avancées sont accessibles mais cachées par défaut (progressive disclosure). Inspiration : la sobriété d'un bon éditeur de nœuds, pas un tableur.
- **Zéro friction d'entrée.** On ouvre l'appli, la donnée du jeu est déjà là, on commence immédiatement. Pas de compte, pas d'installation.

Si une décision rend l'appli plus puissante mais plus intimidante au premier contact, choisis le contact simple et planque la puissance derrière un mode avancé.

## 3. Stack imposée

- **Vite + React 18 + TypeScript** (SPA, build 100% statique, déployable gratuitement sur Cloudflare Pages / Vercel / GitHub Pages)
- **React Flow (`@xyflow/react`)** pour l'éditeur de nœuds
- **Zustand** pour l'état global (graphe, sélection, paramètres)
- **Tailwind CSS** pour le style
- **glpk.js** (GLPK compilé en WebAssembly) pour l'optimisation linéaire
- **Dexie** (IndexedDB) pour la persistance locale des usines de l'utilisateur

**Pas de backend. Pas de base de données serveur. Pas de Next.js.** Tout tourne dans le navigateur.

### Données du jeu — approche mock-first

**Décision pour ce MVP : on travaille avec des données mockées.** L'extraction des vraies données 1.0 est **préparée mais pas branchée**. On applique d'abord ce qu'on sait, on connecte les vraies données ensuite.

Deux principes qui guident tout le travail sur les données :

1. **Une seule source de vérité pour le format.** Définis un schéma TypeScript clair pour les données du jeu et une **frontière de chargement unique** (un module `loadGameData()` qui renvoie des objets typés). Tout le reste de l'appli — solveur, graphe, UI — consomme ces types et **ignore totalement d'où viennent les données**. C'est ce qui rend le remplacement du mock par les vraies données indolore : on ne touchera qu'au chargeur, jamais au solveur ni à l'UI.

2. **Le mock respecte exactement le schéma final.** Les données mockées ne sont pas un raccourci jetable : elles ont la même forme que les données réelles. Le jour où l'extraction produit le vrai JSON, il se substitue au mock sans changer une ligne de type.

**Jeu de données mocké à générer maintenant** (`recipes.json`, `items.json`, `buildings.json`, `belts.json`, `generators.json` dans `/public/data/mock/`) : un sous-ensemble cohérent et vérifiable à la main — la chaîne du fer complète (minerai → lingot → plaque / tige → vis → plaque de fer renforcée → cadre modulaire), plus le cuivre (minerai → lingot → fil → câble) et le béton. Inclus au moins **2-3 recettes alternatives** (ex. « Cast Screw », « Bolted Iron Plate », « Iron Wire ») pour que le solveur ait de vrais arbitrages à faire. Les valeurs doivent être correctes pour ce sous-ensemble, car ce sont elles qui valident les tests du solveur.

### Préparer (sans brancher) l'extraction des vraies données

Crée un dossier `/scripts/extraction/` avec :
- un **README** décrivant les sources possibles (`Docs.json` fourni avec le jeu — le plus fiable ; le wiki satisfactory.wiki.gg qui s'appuie sur Docs.json ; les sheets communautaires en dépannage) et la cible (le même schéma normalisé que le mock, versionné par patch dans `/public/data/{version}/`) ;
- un **stub de script** `extract.ts` non fonctionnel mais commenté : signature, étapes prévues (parser → normaliser vers le schéma → valider → écrire le JSON), et un `TODO` clair. Ne l'implémente pas. Il sert de point d'ancrage pour plus tard.

Ainsi le chemin de mise à jour est tracé, mais on ne dépense aucun effort dessus tant que le MVP n'est pas solide. Ne va pas parser Docs.json maintenant.

### Schéma de données (référence, à raffiner par toi)
Une recette : `id`, `name`, `alternate` (bool), `time` (secondes), `producedIn` (bâtiment), `ingredients[]` ({item, amountPerCycle}), `products[]` ({item, amountPerCycle}). Le débit par minute se dérive : `amountPerCycle * 60 / time`.

Tables de référence connues (valeurs 1.0 à vérifier au build) :
- **Convoyeurs** : Mk1=60, Mk2=120, Mk3=270, Mk4=480, Mk5=780, Mk6=1200 (items/min).
- **Énergie machines** (MW) : Smelter 4, Constructor 4, Foundry 16, Assembler 15, Manufacturer 55, Refinery 30, Oil Extractor 40, Miner Mk1/2/3 = 5/12/30.
- **Modificateurs de pureté de nœud** : Impure ×0.5, Normal ×1, Pure ×2.

## 4. Le cœur : moteur de calcul

C'est la partie qui fait ou défait le produit. **C'est un problème de programmation linéaire (LP)**, pas un simple parcours d'arbre — c'est précisément ce qui distingue cet outil des calculateurs Excel naïfs.

Formulation (à toi de l'implémenter proprement avec glpk.js) :
- **Variables** : taux d'exécution de chaque recette candidate.
- **Contrainte de demande** : production nette de l'item cible ≥ quantité demandée.
- **Contraintes de bilan** : pour chaque item intermédiaire, production ≥ consommation (les sous-produits doivent être consommés ou explicitement autorisés en surplus).
- **Objectif** : sélectionnable par l'utilisateur — minimiser (a) les ressources brutes importées, (b) le nombre de machines, ou (c) l'énergie. Défaut : minimiser les ressources brutes.
- **Recettes alternatives** : simples colonnes supplémentaires du système ; l'utilisateur peut les activer/désactiver globalement ou individuellement.

Une fois les taux résolus :
- **Nombre de machines** = `ceil(taux_requis / taux_d'une_machine)` par recette.
- **Énergie** = somme des machines × consommation unitaire.
- **Couche logistique** (calculée sur le graphe, pas dans le LP au MVP) : pour chaque arête, débit connu → tier de convoyeur minimal. Si débit > 1200/min, insérer un splitter et paralléliser sur `ceil(débit/1200)` lignes. Mergers pour regrouper les sources. Colorer les arêtes par tier. Signaler toute surcharge.

Garde le LP et la couche logistique **découplés** : le solveur décide *quoi/combien produire*, la couche graphe décide *comment router*. Ne mets pas le coût des convoyeurs dans le LP au MVP (v2).

## 5. Architecture suggérée (tu décides du détail)

Sépare clairement :
- **`/data`** — chargement et typage des données du jeu (lecture seule).
- **`/solver`** — le moteur LP, totalement pur (entrées → sorties, aucune dépendance UI). Doit être testable en isolation.
- **`/graph`** — construction du graphe React Flow à partir d'une solution du solveur + couche logistique (tiering convoyeurs, splitters/mergers).
- **`/store`** — état Zustand.
- **`/ui`** — composants React, nœuds custom React Flow, panneaux.
- **`/persistence`** — Dexie + export/import JSON + sérialisation d'état vers URL compressée pour le partage.

Le **solveur doit être une fonction pure et déterministe**, indépendante de React. C'est la condition pour le tester sérieusement.

## 6. Stratégie de test — important, à mettre en place dès le départ

Mets en place **Vitest**. Le moteur de calcul DOIT être couvert par des tests, car une erreur de ratio invisible ruine la confiance dans tout l'outil.

### Tests du solveur (priorité absolue)
Pour chacun, on connaît la réponse correcte à la main — vérifie-la.

1. **Cas trivial mono-machine.** 30 lingots de fer/min → exactement 1 Smelter (1 minerai/cycle, 2s → 30/min), 30 minerai de fer/min en entrée. Vérifie machines, entrées, énergie.
2. **Chaîne à deux étages.** Plaques de fer (Constructor : 3 lingots → 2 plaques, 6s → 20 plaques/min/machine). Cible 60 plaques/min → 3 Constructors + les Smelters amont correspondants. Vérifie le chaînage des taux.
3. **Choix de recette alternative.** Active une alternative qui réduit les ressources brutes (ex. une recette de vis plus efficace) et vérifie que le solveur la préfère quand l'objectif est « minimiser les ressources ». Désactive-la et vérifie qu'il revient à la recette standard.
4. **Changement d'objectif.** Sur un même cas, vérifie que « min ressources » et « min machines » donnent des solutions différentes quand un arbitrage existe.
5. **Conservation de la matière.** Pour toute solution, vérifie le bilan : pour chaque item, production totale ≥ consommation totale (à epsilon près). Aucun item n'apparaît de nulle part.
6. **Sous-produits.** Une recette avec sous-produit (ex. raffinage produisant un résidu) : vérifie que le surplus est soit consommé, soit correctement reporté comme sortie excédentaire, jamais ignoré.
7. **Infaisabilité.** Cible impossible (item sans recette ni source) → le solveur renvoie une erreur explicite et exploitable par l'UI, pas un crash ni une solution silencieusement fausse.

### Tests de la couche logistique
8. **Tiering convoyeur.** 60/min → Mk1 ; 61/min → Mk2 ; 1200/min → Mk6 ; 1500/min → 2 lignes Mk6 + splitter.
9. **Splitter.** Débit divisé correctement sur N sorties ; somme des sorties = entrée.
10. **Merger.** Somme des entrées = sortie ; détection de surcharge si > tier max.

### Tests de persistance
11. **Round-trip.** Sauvegarde d'une usine → rechargement → graphe identique.
12. **Partage URL.** Sérialisation → URL → désérialisation → état identique.

### Validation des données
13. Au build/chargement : tout `item` référencé dans une recette existe ; tout `producedIn` existe ; aucun débit négatif ; aucune recette sans produit.

**Règle de travail : aucune fonctionnalité du solveur n'est considérée terminée sans son test. Écris le test en même temps que (ou avant) le code, sur les cas dont tu connais la réponse manuellement.**

## 7. Périmètre — MVP vs plus tard

**MVP (maintenant) :**
- Données **mockées** (chaîne fer + cuivre + béton, avec alternatives), au format du schéma final, derrière `loadGameData()`.
- Dossier d'extraction préparé (README + stub `extract.ts`), non implémenté.
- Solveur LP fonctionnel avec les 3 objectifs et le toggle des alternatives.
- Génération du graphe React Flow depuis la solution + tiering convoyeurs + splitters/mergers automatiques.
- Saisie de la cible (item + quantité/min) ultra-simple en façade.
- Panneau de résultats : liste des machines, énergie totale, ressources brutes requises.
- Persistance locale + partage URL.
- Suite de tests ci-dessus verte.

**Plus tard (v2+, ne pas commencer maintenant) :**
- **Extraction et intégration des vraies données 1.0** (implémenter le script stub : Docs.json → schéma normalisé → validation). Comme tout passe par `loadGameData()`, ça ne touchera ni le solveur ni l'UI.
- Données 1.0 complètes (toutes recettes, fluides, nucléaire, sloops).
- Overclock / power shards, somersloops.
- Optimisation du coût d'infrastructure logistique (coût des belts dans l'objectif).
- **Suggestion de patterns de build** (manifold vs load-balanced, bus principal, footprint en fondations) — la feature différenciante, mais après un MVP solide.
- Mode édition manuelle avancée du graphe.

Ne déborde pas sur la v2. Un MVP simple et correct d'abord.

## 8. Comment je veux que tu travailles

- **Analyse d'abord, code ensuite.** Avant d'implémenter le solveur, étudie l'API de glpk.js et explique brièvement comment tu formules le LP, puis implémente. Je ne t'impose ni la structure SQL ni le détail du code — tu analyses et tu décides.
- **Incrémental et testé.** Avance par tranches livrables, chacune avec ses tests verts avant de passer à la suite. Lance les tests après chaque tranche.
- **Découplage strict** entre logique pure (solveur, graphe) et UI. Pas de logique métier dans les composants React.
- **Commits atomiques** avec messages clairs.
- **TypeScript strict.** Types explicites sur les frontières (données du jeu, entrées/sorties du solveur).
- **Pas d'over-engineering.** La donnée tient en mémoire ; pas de couche d'abstraction inutile. Simplicité d'abord.
- Documente dans un `README` : ce que fait l'appli, comment lancer (`dev`, `build`, `test`), et la structure des dossiers.

## 9. Tâche immédiate

1. Initialise le projet : Vite + React + TS, Tailwind, React Flow, Zustand, glpk.js, Dexie, Vitest.
2. Mets en place la structure de dossiers (§5) et le typage des données du jeu (§3), avec la frontière de chargement unique `loadGameData()`.
3. Génère le jeu de données **mocké** (fer + cuivre + béton + alternatives), au format du schéma final.
4. Crée le dossier `/scripts/extraction/` avec son README et le stub `extract.ts` non implémenté (juste tracer le chemin).
5. Implémente le solveur LP pur et fais passer les tests 1 à 7.
6. Branche la couche logistique et les tests 8 à 10.
7. Monte une UI minimale : champ « item cible + quantité/min », bouton calculer, rendu React Flow de la solution, panneau résultats.
8. Ajoute persistance + partage URL et les tests 11-12.
9. Rédige le README.

Commence par initialiser le projet et me proposer ta formulation du LP avant d'écrire le solveur. On valide ensemble, puis tu déroules.