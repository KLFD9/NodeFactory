---
name: game-design
description: Direction de jeu, boucle de gameplay, progression, longévité et équilibrage pour NodeFactory — le planificateur Satisfactory devenu jeu factory-builder + idle/automation web. À charger pour toute tâche touchant les systèmes de jeu (milestones, déblocages, idle/offline, prestige, score d'efficacité, réengagement, économie). Complète le skill `satisfactory-planner` (qui porte le solveur/données/graphe).
---

# Game Design — NodeFactory (factory-builder + idle/automation, web)

## Identité du produit (intention finale — révisée 2026-06-09)

NodeFactory est né comme planificateur Satisfactory et **devient son PROPRE jeu web** d'automatisation
+ idle. **Virage assumé : on ne cherche plus la fidélité à Satisfactory 1.0.** Satisfactory / Factorio /
shapez sont des **inspirations de genre**, pas un cahier des charges. Les items, recettes, débits et
toute l'économie sont **NOTRE design**, conçus et calculés **pour le feel** — pas copiés.

Une seule base de code, **deux faces servies par un même moteur** :
- **Le moteur d'optimisation** (solveur LP) reste **irréprochable et pur** : c'est lui qui assiste et
  qui *note*. Il est agnostique des données — il optimise quelle que soit l'économie qu'on lui donne.
- **Le jeu** : la boucle dopaminergique de l'automatisation (construire → automatiser → optimiser →
  débloquer → étendre) + le réengagement d'un idle/clicker.

> **Conséquence sur les données** : le « mock » n'est plus un placeholder en attendant les vraies
> données Satisfactory — c'est la **v1 de l'économie de NOTRE jeu**, à faire évoluer par le game
> balance pour le feel. Importer des valeurs Satisfactory réelles (agent `satisfactory-data`) devient
> une **source d'inspiration optionnelle**, plus l'objectif. Le **game balance est une discipline
> centrale** (« essentiel pour le feel » — décision user).

> **Le différenciateur.** Shapez.io, Mindustry, Factorio te font optimiser **à la main**, sans filet.
> NodeFactory garde le plaisir de **construire soi-même**, mais ajoute un **solveur LP** qui
> **t'assiste** (« Compléter l'usine » : comble les déficits en minimisant le gaspillage) et **te
> note** (score d'efficacité = à quel point ton usine approche l'optimum LP). On transforme ainsi
> « l'efficacité » en **mécanique de score et de progression**. Le solveur n'est pas une plomberie
> cachée : c'est le **système d'assistance et de notation du jeu**. C'est ça qui n'existe nulle part
> ailleurs. Ne jamais le diluer.
>
> **NB (2026-06-09)** : l'ancienne **auto-génération** (« tape X/min → l'appli pose toute l'usine
> seule ») a été **retirée** — elle court-circuitait le cœur du plaisir (construire). Le LP subsiste
> en **assistance** (compléter un graphe existant) et en **score**, jamais en « fais tout à ma place ».

## La règle d'or du game design ici : cohérence interne, jamais de faux nombres

Notre économie est *fabriquée*, mais elle doit être **cohérente et honnête envers le joueur**. Une
fois qu'un bâtiment a un débit, il le respecte (pas de gonflage caché). La couche idle/incrémentale ne
triche JAMAIS sur les débits d'items : le réengagement passe par une **monnaie méta** (Automation
Points) **dérivée du débit réel de l'usine**, pas par des nombres truqués. La simulation est la vérité ;
le jeu se construit *autour* d'elle. Différence avec avant : cette « vérité » est désormais **notre
design tuné pour le feel**, pas la donnée Satisfactory. La crédibilité vient de la **cohérence**, pas
de la fidélité à un autre jeu.

## La boucle de gameplay (core loop)

1. **Objectif** : un milestone actif dit quoi viser (« produire 150 lingots → débloque le Constructor »).
2. **Construire** : l'utilisateur pose les machines depuis la palette (coût en AP) et les relie —
   convoyeurs ET câbles électriques. **Règles du monde actées (2026-06-12)** : pas de courant,
   pas de production (réseaux électriques physiques) ; pas de charbon, pas de courant (les
   générateurs consomment du combustible réel) ; belts plafonnés par tier. La première usine est
   une **boucle auto-alimentée** mineur-charbon ⇄ générateur — c'est la 1re section du tutoriel.
   Le LP **assiste** au besoin (« Compléter l'usine » comble les déficits en amont) — il
   n'auto-construit plus tout seul.
3. **Regarder tourner** : la couche « game feel » déjà construite (belts animés, barres de cycle,
   points d'activité, ticker de bilan) donne le plaisir d'automatisation immédiat.
4. **Accumuler** : la production réelle alimente une **monnaie méta** (AP) → progresse vers les milestones.
5. **Optimiser** : les objectifs LP (min ressources / machines / énergie) deviennent un **score
   d'efficacité** — le méta-jeu. C'est ici que l'expert reste des centaines d'heures.
6. **Débloquer / étendre / prestige** : milestones → bâtiments, recettes alternatives ;
   prestige = repartir sur un blueprint avec multiplicateurs permanents.

## Longévité — cadre Hook / Habit / Hobby

| Phase | Horizon | Objectif | Mécaniques |
| --- | --- | --- | --- |
| **Hook** | 0-30 min | « wow, ça tourne tout seul » | pose un Miner + un Smelter, regarde les lingots couler et la barre du **premier milestone** se remplir (~5 min → débloque le Constructor). Zéro friction, zéro compte. |
| **Habit** | 1-7 jours | revenir chaque jour | milestones qui débloquent alternates/bâtiments ; audit de bottleneck ; **horloges de réengagement exponentielles** (producteurs ~20 min / ~5 h / ~2 j) pour que le joueur réussisse *quelque chose* même en négligeant le reste. |
| **Hobby** | semaines-mois | maîtrise & rejouabilité | score d'efficacité + classements ; **prestige** vers blueprints ; saisons/objectifs ; arbre tech 1.0 complet. |

## Couche idle / offline (principes chiffrés issus de la veille)

- **Offline en delta-time** : à la reconnexion, `gains = rate_méta × (now − lastSeen)`, **plafonné à
  4 h**, avec popup récap. On ne simule rien en arrière-plan.
- **Horloges exponentielles** : plusieurs producteurs/monnaies à fenêtres de collecte croissantes
  (court = onglet ouvert, joueur actif ; long = visite occasionnelle). Évite l'échec tout-ou-rien.
- **Courbes de croissance** : prod ×~1.1 / niveau (≈ +10 %, perceptible), coût ×~1.15 / niveau
  (pacing contrôlé). Les humains *voient* 100→120, pas 100→101 — toujours rendre le progrès visible.
- **Prestige** : reset contre multiplicateurs permanents ⇒ « New Game+ » où l'early-game qui prenait
  une semaine se refait en 3 minutes. Récompense le savoir d'optimisation acquis.

## Systèmes — état réel (2026-06-12) et suite

**FAIT et testé** (~220 tests unitaires + 15 E2E) :
1. ✅ Slice d'état de jeu (`src/game/` purs + `useProgressionStore` persisté ; tick 1 s + offline).
2. ✅ 13 milestones (M1-M10 + M11-M13 gatant les alts paliers 2/3) ; palette/inspecteur/LP filtrés ;
   progressive disclosure (franchis repliés, actif + 1 teaser, reste masqué).
3. ✅ Badges d'état machine (nominal/starved/blocked/**unpowered**) + audit bottleneck.
4. ✅ Score d'efficacité 3 dims (calcul théorique : neutralise le gating électrique).
5. ✅ Idle/offline : tick + gains offline plafonnés 4 h + popup récap (seuils 1 min / 1 AP).
6. ✅ Onboarding : accueil 1er lancement + **tutoriel 9 étapes / 3 sections** dérivé de l'état réel
   (Électricité → Production de fer → Automatisation), skippable, disparaît à M1.
7. ✅ Économie de pose : capital initial 50 AP, `BUILDING_COSTS`, refus si solde insuffisant ;
   suggestion contextuelle au pin (« + Smelter relié »).
8. ✅ Électricité + combustible + belts plafonnés (voir skill `satisfactory-planner`, « Physique »).

**À FAIRE** (backlog priorisé : `Docs/design/2026-06-12-backlog-gameplay.md`) :
- **Refonte monnaie (EN DESIGN)** : scinder les AP en **Points de Recherche** (progression/
  déblocages) + monnaie d'amélioration des machines (rendement/énergie par niveau — les courbes
  ×1.1 prod / ×1.15 coût de `balance.ts` attendent ce système). Voir le doc de design dédié.
- **Prestige / blueprints** (base chiffrée prête : mult 1.5^N, seuil efficacité 0.75).
- Pondération AP par palier (Q6) · stats de production · partage URL · audio · achievements.
- **Saisons / classements** (plus tard).

## Architecture du jeu — découplage NON négociable

La couche jeu est **additive** et ne corrompt jamais le cœur planner :

- **Sens des dépendances** : `game` peut lire `data`/`solver`/`graph` ; l'inverse est **interdit**.
  `src/solver` reste un **LP pur sans état de jeu**. `src/data` reste **lecture seule**.
- Les milestones **filtrent les recettes disponibles** passées *en entrée* du solveur (déblocages =
  quelles colonnes existent / quels `enabledAlternates`). C'est le seul point de contact, et il va
  dans le bon sens (le jeu configure le moteur, le moteur n'a aucune notion de jeu).
- Nouvel emplacement : `src/game/` (logique pure : milestones, économie idle, prestige — testable en
  isolation comme le solveur) + `useProgressionStore` (Zustand) pour l'état. Persistance via Dexie
  (déjà prévu) ; le `lastSeen` pour l'offline vit là.
- **Aucune logique de jeu dans les composants React.** Même règle que le reste du projet.

## Tests (même exigence que le solveur)

Aucune mécanique de jeu n'est terminée sans test sur des cas à réponse connue :
- Milestone : atteint au bon seuil cumulé, déblocage idempotent, ne se redéclenche pas.
- Idle offline : delta-time correct, **plafond 4 h respecté**, pas de gain négatif si horloge recule.
- Courbes : coût/prod du niveau N = base × ratio^N (valeurs vérifiées à la main).
- Prestige : reset remet l'état attendu et applique le bon multiplicateur permanent.
- Score d'efficacité : déterministe pour une solution donnée (réutilise la pureté du LP).

## Garde-fous de direction

- **Simple pour le débutant, profond pour l'expert** (progressive disclosure) reste la règle suprême,
  héritée du planner. Le jeu ne doit pas intimider au premier contact.
- **Pas de monétisation prédatrice / dark patterns** : open source, 100 % client, pas de pub, pas de
  pay-to-win. Le réengagement vient du plaisir d'optimisation, pas de la culpabilité.
- **Ne pas commencer** la v2 data réelle / overclock-sloops / coût logistique LP tant que la boucle de
  jeu (milestones → déblocage → score) n'est pas solide et testée.
- **Veille continue** : le genre bouge vite. Voir l'agent `game-design-veille` pour rester à jour sur
  les concurrents (shapez 2, Mindustry, idle web) et les bonnes pratiques.
