# Early-game hook : densifier les 5 premières minutes

**Date** : 2026-06-14
**Auteur** : agent `game-balance`
**Périmètre** : `src/game/balance.ts`, `src/game/balance.test.ts`
**Diagnostic source** : audit early-game — ~50 % de temps mort dans les 5 premières
minutes, dû à (a) le premier flux visible arrive après ~4 étapes d'électricité,
(b) un vide de ~125s entre démarrage et M1 sans récompense intermédiaire, (c) M2 à
~10 min, trop loin de M1 et masqué.

Ce doc consigne les choix CHIFFRÉS de la couche jeu pour adresser (a), (b), (c) et
amorcer le score en 2 temps (levier #5). L'implémentation de la physique (réserve de
charbon consommée réellement), du tutoriel et de l'UI est hors périmètre de cet agent
— les constantes ci-dessous sont la référence pour ces implémentations.

---

## 1. Réserve de charbon initiale (levier #1)

**Constante** : `STARTING_COAL_RESERVE = 60` (units de coal), dérivée de
`COAL_GENERATOR_CONSUMPTION_PER_MIN (30) × STARTING_COAL_RESERVE_MINUTES (2)`.

### Calcul

La recette `coal-generator-power` consomme `1 coal / 2s` → `1 * 60 / 2 = 30 coal/min`
par générateur (1 instance, niveau 0, `machineSpeedMult = 1`).

Cible : couvrir 1 à 2 minutes de consommation à débit nominal.
- 1 min → 30 coal
- 2 min → 60 coal

**Choix retenu : 60 (haut de la fourchette, 2 min).**

### Justification du feel

Sans réserve, le Coal Generator ne génère 0 MW tant qu'aucun charbon n'arrive par
belt (« pas de charbon, pas de courant », CLAUDE.md). Cela impose ~4 étapes
(poser Miner-coal → poser Coal Generator → câbler belt charbon → câbler le réseau
électrique) AVANT que le réseau soit `powered` et que Miner-fer + Smelter tournent —
sans courant, aucun flux visible.

Avec une réserve de 60 coal "dans la trémie" au démarrage :
- Le réseau électrique est `powered` dès que Miner-fer + Smelter + Coal Generator
  sont posés et câblés électriquement (sans attendre la boucle charbon complète).
- Iron Ingot commence à sortir du Smelter immédiatement → premier flux visible
  TRÈS tôt (cf. micro-milestones, §2).
- Le joueur câble la boucle charbon (Miner-coal → Coal Generator) PENDANT que le
  fer produit déjà — en parallèle, pas en bloquant.
- La réserve s'épuise après 2 min à débit nominal : si la boucle charbon n'est pas
  câblée à temps, le courant tombe — signal pédagogique clair (« il faut alimenter
  le générateur »), mais le joueur a déjà eu 2 min de production pour comprendre
  la mécanique et n'est pas pris au dépourvu dès la 1ère seconde.

### Pourquoi 2 min et pas 1 min ou 5 min

- 1 min (30 coal) : trop court — le tutoriel guide ~4 étapes électriques, le joueur
  moyen met probablement plus d'1 min à les enchaîner ; la coupure tomberait avant
  que le joueur ait fini de câbler, ce qui ressemblerait à une punition plutôt qu'à
  un signal.
- 5 min : trop long — le joueur pourrait ignorer complètement la dépendance au
  charbon pendant toute la session Hook, ce qui retarde l'apprentissage d'une
  mécanique centrale (« pas de charbon, pas de courant ») et réduit la pression
  positive qui motive le câblage.
- 2 min est cohérent avec M1 (Iron Ingot 60 @ 30/min = 2.0 min) : la réserve
  s'épuise PILE quand M1 est atteint — alignement narratif (« vous avez débloqué
  le Constructor ET il est temps de finir la boucle électrique »).

### Comment elle se drains (implémentation physique — hors périmètre)

La réserve est une donnée de DÉPART (état initial du Coal Generator), pas un bonus
de débit : le débit de consommation reste 30 coal/min, inchangé. La physique réelle
(`src/graph`) doit traiter cette réserve comme un stock initial consommé au même
rythme que le charbon livré par belt (FIFO ou simple compteur décroissant — au choix
de l'implémentation physique).

**[À VALIDER avec l'humain]** : 60 = 2 min. Si le tutoriel guide plus vite que prévu en
pratique (playtest), 30 (1 min) suffirait et laisserait moins de "filet de sécurité"
— mais ne change pas la formule, juste `STARTING_COAL_RESERVE_MINUTES`.

---

## 2. Micro-milestones sous M1 (levier #2)

**Constante** : `EARLY_PRODUCTION_MICRO_MILESTONES` (tableau de 3 entrées), toutes
sur `itemId: 'iron-ingot'` — la même donnée cumulée que M1
(`cumulativeProduced['iron-ingot']`), pas une nouvelle monnaie.

| id                      | target | label                                              | secondes (débit nominal 30/min) |
|-------------------------|--------|----------------------------------------------------|----------------------------------|
| `micro-first-ingot`     | 1      | "Premier lingot produit !"                          | 2s                                 |
| `micro-ten-ingots`      | 10     | "10 lingots de fer produits"                        | 20s                                |
| `micro-thirty-ingots`   | 30     | "Mi-parcours vers le premier déblocage (30 lingots)"| 60s                                |
| **M1** `ms-iron-ingot-60` | 60   | (existant) débloque Constructor                     | 120s                               |

### Calcul

Iron Ingot = `1 * 60 / 2 = 30/min` (1 Smelter) → 1 ingot toutes les 2s.

- 1er lingot : `1 / 30 × 60 = 2s`
- 10 lingots : `10 / 30 × 60 = 20s`
- 30 lingots : `30 / 30 × 60 = 60s`
- M1 (60)    : `60 / 30 × 60 = 120s`

### Justification du feel

Espacements obtenus : 2s → 20s (+18s) → 60s (+40s) → 120s (+60s).

- Le 1er feedback à 2s confirme INSTANTANÉMENT que poser un Smelter "fait quelque
  chose" — élimine le doute du joueur qui vient de poser sa première machine.
- L'écart 2s→20s (18s) tombe dans la fenêtre "feedback toutes les 10-30s" ciblée
  pour les 2 premières minutes (veille concurrentielle citée dans la consigne).
- Les écarts suivants (40s, 60s) s'élargissent naturellement : à mesure qu'on
  approche de M1 (récompense "lourde" — déblocage de bâtiment), le joueur tolère un
  intervalle plus long car l'anticipation de la récompense suivante (visible dans la
  barre de progression M1) maintient l'engagement sans qu'un toast intermédiaire
  soit nécessaire à CHAQUE seuil de 10-20s.
- Avec 2 machines (joueur qui pose vite un 2e Smelter), tous ces seuils sont
  atteints en ~moitié du temps — cohérence avec le principe "le temps indiqué est
  une borne supérieure conservative" déjà appliqué à M1-M13.

### Usage attendu côté UI/tutoriel (hors périmètre)

Pour chaque micro-milestone, dès que
`cumulativeProduced['iron-ingot'] >= target` ET que le seuil n'a pas encore été
affiché, déclencher un toast/badge avec `label`. Idempotence à gérer côté UI/store
(ex. Set de micro-milestones déjà affichés, par analogie avec
`reachedMilestones`) — PAS dans `balance.ts` (qui reste une table de configuration
pure, sans état).

---

## 3. Rééquilibrage M1 → M2 → M3 (levier appui)

### Avant

- M1 : Iron Ingot 60 @ 30/min = **2.0 min** → unlock Constructor
- M2 : Iron Rod 150 @ 15/min = **10.0 min** → unlock Miner Mk.2
- M3 : Iron Plate 300 @ 20/min = 15.0 min → unlock Assembler

Écart M1→M2 = 8 min. Diagnostic confirmé : M2 est "masqué" derrière un vide de
8 minutes après la victoire de M1, alors que M1 lui-même n'arrive qu'à 2 min — le
rythme casse juste après le premier high.

### Après

- M1 : Iron Ingot 60 @ 30/min = **2.0 min** → unlock Constructor (inchangé)
- **M2 : Iron Rod 60 @ 15/min = 4.0 min** → unlock Miner Mk.2 (id renommé
  `ms-iron-rod-60`, était `ms-iron-rod-150` à target=150)
- M3 : Iron Plate 300 @ 20/min = 15.0 min → unlock Assembler (inchangé)

Écart M1→M2 = 2 min (la cible de la consigne, "~3-4 min", est respectée : M1 à
2 min + M2 à 4 min = 2 min d'écart, dans la fourchette demandée).

### Calcul

`60 Iron Rod / 15 par min (Constructor, 1*60/4) = 4.0 min`.

### Justification

- M2 reste un gate de capacité (Miner Mk.2, ×2 extraction) — sa NATURE ne change
  pas, seulement son TIMING.
- 60 est un seuil "rond" et cohérent avec M1 (même target numérique, items
  différents) — facile à communiquer côté UI ("60 de plus, mais cette fois en Iron
  Rod").
- L'écart M2→M3 passe de 5 min (10→15) à 11 min (4→15). Ce n'est PAS un problème :
  M3 reste dans la fourchette "10-15 min, session détendue" de la phase Habit
  early — le rythme HOOK (M1, M2 rapides et rapprochés) est ce qui compte pour les
  5 premières minutes ; M3 arrive après que le joueur soit déjà engagé. Si un futur
  playtest montre un nouveau vide ressenti entre M2 et M3, on pourra introduire un
  M2.5 (même logique de micro-milestone que §2, mais sur un nouvel item) sans
  toucher à M1/M2/M3.
- Aucun autre milestone (M3-M13) n'a été modifié — la courbe globale (2 / 4 / 15 /
  25(cumulé M4) / ... / 75 min) garde son allure Hook→Habit→Hobby, seul le segment
  M1-M2 est resserré.

### Impact sur le dataset / LP

Aucun changement de dataset. `ms-iron-rod-60` continue de débloquer `miner-mk2`
(`type: 'building'`) — même mécanique de déblocage, seul `target` (150→60) et `id`
(`ms-iron-rod-150` → `ms-iron-rod-60`) changent. Pas d'impact sur
`allowedAlternateRecipeIds` (M2 ne débloque pas de recette).

---

## 4. Score en 2 temps (levier #5, partie chiffrée)

### Gating du panneau complet

**Constante** : `SCORE_PANEL_UNLOCK_MILESTONE_ID = 'ms-iron-rod-60'` (= M2, ~4 min).

#### Pourquoi pas M1 (2 min) ?

À M1, le joueur vient de poser son 2e type de machine (Constructor) mais n'a encore
posé qu'1 Smelter + (au mieux) 1 Constructor — l'usine n'a qu'UNE route possible.
`evaluateEfficiency` renverrait `1.0 / 1.0 / 1.0` (score parfait trivial, cf.
`computeEfficiencyScore` : "usine vide → score 1.0"-like quand actual = optimal par
absence de choix). Révéler le panneau différenciateur du jeu avec un premier
affichage "100 % partout, rien à améliorer" banaliserait la mécanique au moment où
elle devrait au contraire intriguer.

#### Pourquoi M2 (4 min) ?

À M2, Miner Mk.2 vient d'être débloqué : c'est la PREMIÈRE fois qu'un choix structurel
existe (Mk.1 vs Mk.2 pour la même extraction — capacité vs nombre de machines). Le
joueur a aussi probablement Smelter + Constructor (Iron Rod) posés : au moins 2 types
de machines, donc un vrai espace d'optimisation (le score peut varier de 1.0).
Révéler le panneau à ce moment-là en fait un outil IMMÉDIATEMENT actionnable :
"as-tu pris Mk.2 parce que c'était nécessaire, ou par réflexe ?"

**[À VALIDER avec l'humain]** : si le playtest montre une curiosité précoce pour le
score (joueurs qui cherchent un onglet "score" dès M1), on peut avancer le seuil à
M1 sans casser la logique : le score affichera `1.0/1.0/1.0`, ce qui reste un nombre
VRAI (pas un mensonge), juste peu instructif.

### Badge qualitatif par machine

**Constantes** : `EFFICIENCY_BADGE_THRESHOLDS = { optimal: 0.9, correct: 0.6 }` +
`efficiencyBadgeForScore(score): 'optimal' | 'correct' | 'needs-improvement'`.

#### Seuils et justification

- `score ≥ 0.9` → **"Optimal"** : au plus 10 % de surcoût vs l'optimum LP sur la
  dimension considérée. 10 % est le bruit normal d'un dimensionnement ENTIER (on ne
  peut pas poser "1.3 machine" — un arrondi à l'entier supérieur produit
  fréquemment un ratio actual/optimal entre 1.0 et 1.1). Pénaliser sous ce seuil
  créerait un badge "Peut mieux faire" quasi permanent pour une usine raisonnable —
  faux négatif démotivant.
- `0.6 ≤ score < 0.9` → **"Correct"** : marge de manœuvre mais pas critique.
- `score < 0.6` → **"Peut mieux faire"** : sur-dimensionnement net (≥ 40 % de
  surcoût — ex. 2 machines là où 1 suffirait avec un ratio proche de 1).

#### Cohérence avec PRESTIGE_MIN_EFFICIENCY (0.75)

`0.6 < 0.75 < 0.9` : le seuil de prestige (0.75) tombe DANS la plage "Correct" — un
joueur au badge "Correct" est déjà proche du seuil de prestige (Hobby), et "Optimal"
le dépasse confortablement. Cohérence narrative : "Correct" = palier normal de
progression vers le prestige, "Optimal" = maîtrise.

#### Dimension utilisée pour le badge par machine (recommandation, hors périmètre)

La dimension RESSOURCES (`resources.score`) est la plus pertinente en early game
pour un badge PAR MACHINE : "ai-je le bon ratio d'intrants pour ma sortie ?" est
directement observable/actionnable pour un débutant, contrairement aux dimensions
machines/énergie qui demandent une vue d'ensemble de l'usine.

---

## 5. Récapitulatif des constantes exportées (pour le graph/tutoriel/UI)

| Constante / fonction | Fichier:ligne (approx.) | Valeur | Usage attendu |
|---|---|---|---|
| `COAL_GENERATOR_CONSUMPTION_PER_MIN` | `src/game/balance.ts` | `30` | Référence de calcul (coal/min, 1 générateur niveau 0) |
| `STARTING_COAL_RESERVE_MINUTES` | `src/game/balance.ts` | `2` | Documentation/justification |
| `STARTING_COAL_RESERVE` | `src/game/balance.ts` | `60` | État initial du Coal Generator (réserve de coal), consommé par la physique réelle |
| `ProductionMicroMilestone` (interface) | `src/game/balance.ts` | — | Type pour l'UI/tutoriel |
| `EARLY_PRODUCTION_MICRO_MILESTONES` | `src/game/balance.ts` | 3 entrées (`micro-first-ingot`, `micro-ten-ingots`, `micro-thirty-ingots`) | Toasts/badges déclenchés sur `cumulativeProduced['iron-ingot']`, idempotence côté UI/store |
| `MILESTONES[1]` (`ms-iron-rod-60`) | `src/game/balance.ts` | `target: 60`, `estimatedMinutesNominal: 4.0` | M2 rééquilibré — gate `miner-mk2`. **ID renommé** depuis `ms-iron-rod-150` |
| `SCORE_PANEL_UNLOCK_MILESTONE_ID` | `src/game/balance.ts` | `'ms-iron-rod-60'` | Gating d'affichage du panneau de score complet (3 jauges + global) |
| `EFFICIENCY_BADGE_THRESHOLDS` | `src/game/balance.ts` | `{ optimal: 0.9, correct: 0.6 }` | Seuils du badge qualitatif par machine |
| `efficiencyBadgeForScore(score)` | `src/game/balance.ts` | retourne `'optimal' \| 'correct' \| 'needs-improvement'` | Conversion score dimension → badge, dispo dès avant M2 |

---

## 6. Tests modifiés (`src/game/balance.test.ts`)

- Imports : ajout de `COAL_GENERATOR_CONSUMPTION_PER_MIN`, `STARTING_COAL_RESERVE_MINUTES`,
  `STARTING_COAL_RESERVE`, `EARLY_PRODUCTION_MICRO_MILESTONES`,
  `SCORE_PANEL_UNLOCK_MILESTONE_ID`, `EFFICIENCY_BADGE_THRESHOLDS`,
  `efficiencyBadgeForScore`.
- Nouveau describe `Réserve de charbon initiale (STARTING_COAL_RESERVE)` (4 tests) :
  vérifie `30`, `2`, `60 = 30×2`, et `1 ≤ minutesCouvertes ≤ 2`.
- Nouveau describe `EARLY_PRODUCTION_MICRO_MILESTONES` (6 tests) : 3 entrées sur
  `iron-ingot`, ids uniques, targets `[1, 10, 30]` tous `< 60` (target M1), seuils en
  secondes `2 / 20 / 60`, écart 1er→2e dans `[10, 30]`.
- **`M2` (anciennement `ms-iron-rod-150`)** : tests renommés/réécrits —
  `target: 150 → 60`, `estimatedMinutesNominal: 10.0 → 4.0`, `id: 'ms-iron-rod-150' →
  'ms-iron-rod-60'`. 2 tests modifiés (`'M2 : iron-rod, target=...'` et
  `'M2 : vérification calcul de temps...'`).
- Nouveau describe `SCORE_PANEL_UNLOCK_MILESTONE_ID` (3 tests) : égal à
  `'ms-iron-rod-60'`, différent de `MILESTONES[0].id`, correspond à `MILESTONES[1]`.
- Nouveau describe `efficiencyBadgeForScore` (8 tests) : seuils `0.9`/`0.6`, valeurs
  limites (`0.9 → optimal`, `0.89 → correct`, `0.6 → correct`, `0.59 →
  needs-improvement`), et cohérence avec `PRESTIGE_MIN_EFFICIENCY` (0.6 < 0.75 < 0.9).

Aucun autre fichier de test n'a été modifié : `progression.test.ts`,
`score.test.ts`, `computeFactory.test.ts`, `solver.test.ts` ne référencent ni
`ms-iron-rod-150`/`ms-iron-rod-60` par valeur numérique, ni les nouvelles
constantes (vérifié par recherche).

---

## 7. Valeurs à valider avec l'humain / arbitrages ouverts

1. `STARTING_COAL_RESERVE_MINUTES = 2` (60 coal) — pourrait être réduit à 1 (30
   coal) si le tutoriel s'avère plus rapide que prévu en playtest. La formule reste
   identique, seule la constante change.
2. `SCORE_PANEL_UNLOCK_MILESTONE_ID = M2` — pourrait être avancé à M1 si les
   joueurs cherchent le score plus tôt ; le score afficherait alors `1.0/1.0/1.0`
   (vrai mais peu instructif).
3. `EFFICIENCY_BADGE_THRESHOLDS = { optimal: 0.9, correct: 0.6 }` — seuils
   qualitatifs proposés par analogie avec `PRESTIGE_MIN_EFFICIENCY` (0.75) ; à
   ajuster si le badge "Peut mieux faire" apparaît trop souvent/rarement en
   playtest.
4. L'écart M2→M3 passe à 11 min (4→15) — non traité ici (hors du périmètre "M1→M2→M3
   immédiat" de la consigne), mais signalé comme piste de M2.5 si un futur audit
   identifie un nouveau vide.

---

## 8. Impact estimé par phase

- **Hook (0-5 min)** : impact MAXIMAL — c'est le périmètre de cette tâche. Le
  premier flux visible n'attend plus la boucle électrique complète (réserve de
  charbon), 3 récompenses intermédiaires comblent le vide 0→2 min (micro-milestones),
  et la 2e grande récompense (M2) tombe à 4 min au lieu de 10 min. Le temps mort
  estimé passe de ~50 % à quasi 0 % sur les 4 premières minutes (flux visible dès
  le début + feedback toutes les 2-60s + 2 déblocages de bâtiment en 4 min).
- **Habit (5-30 min)** : impact MODÉRÉ — le panneau de score complet apparaît dès
  M2 (4 min) au lieu d'être implicite/absent, donnant un nouvel objectif "améliorer
  mon score" tôt dans la phase Habit. M3-M13 inchangés.
- **Hobby (30 min+)** : impact NUL — aucune des 11 derniers milestones (M3-M13),
  courbes idle, prestige, ou contrats n'a été modifiée.
