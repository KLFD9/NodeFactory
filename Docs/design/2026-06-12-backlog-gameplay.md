# Backlog Gameplay — fonctions identifiées, utiles, plus longues à implémenter

**Date** : 2026-06-12 · **Auteur** : Claude (passe « nodes, gameplay, connectiques »)
**Statut** : backlog priorisé — chaque item a été identifié pendant les audits/implémentations
des 11-12 juin. Les items sont triés par valeur/effort. Aucun n'est commencé.

Légende effort : S < 1 h · M = 1-3 h · L = 3-8 h · XL > 8 h.

---

## P1 — Cœur de jeu (à faire en premier)

### 1. ✅ FAIT (2026-06-12) — Fuel des générateurs (le courant se MÉRITE) — effort M
Le dataset a déjà la recette `coal-generator-power` (1 coal → 1 electricity / 2 s) mais elle
est **décorative** : un Coal Generator produit ses 75 MW sans être alimenté en charbon.
- À faire : un générateur sans flux de coal entrant (belt `in-coal`) ne génère **0 MW** ;
  `computePowerNetworks` doit recevoir l'info « générateur nourri » (calculée par
  `computeFactory` — attention à l'ordre des dépendances : flux → fuel → power → flux ;
  itérer une fois suffit si on interdit les boucles électricité→fuel).
- Boucle de gameplay créée : extraire du coal devient un BESOIN permanent (drain réel),
  le gisement de charbon devient stratégique, la suggestion « coal → Coal Generator »
  (déjà en place) prend tout son sens.
- Tests : générateur nourri → réseau OK ; coal coupé → réseau down → usine down (cascade).
- Garde-fou : le tutoriel devra inclure « mine du charbon » AVANT « branche le courant »
  (ou un capital de démarrage de fuel pour ne pas alourdir le Hook).

### 2. Prestige / REC-07 (rejouabilité Hobby) — effort L
La base chiffrée existe dans `balance.ts` (mult ×1.5^N, seuil efficacité globale ≥ 0.75)
et `prestigeCount` est déjà persisté/multiplie le taux d'AP.
- À faire : bouton Prestige (visible si `isPrestigeAvailable(score.global)`), modale de
  confirmation (récap : ce qui est perdu/gardé), reset graphe + progression SAUF
  `prestigeCount`/déblocages choisis, écran « nouveau départ ×1.5 ».
- Décision design à trancher avant : que garde-t-on ? (proposition : milestones M1-M4
  re-franchis vite grâce au mult ; alts débloquées CONSERVÉES = le savoir reste).

### 3. ✅ FAIT (2026-06-12) — Capacité physique des belts (la logistique devient un puzzle) — effort L
`planBelt` calcule tier/surcharge mais le flux n'est PAS limité : une arête « surchargée »
transporte quand même tout. Brancher la limite dans la propagation de flux de
`computeFactory` (rate effectif = min(rate, capacité tier choisi)) transforme les
splitters/mergers en vraies décisions. Gros impact sur le feel expert, à équilibrer
avec `game-balance` (les milestones M2/M6 gatent déjà les débits via les miners).

---

## P2 — Rétention / confort

### 4. Pondération AP par palier (Q6, différée) — effort M
`computeApRate` est uniforme (1/3 AP par item/min) : une usine de screws (40/min) rapporte
16× plus qu'une usine de computers (2.5/min). Pondérer par « valeur » d'item (dérivée de la
profondeur de chaîne : Σ bruts + Σ temps machine, calculable automatiquement depuis les
recettes — pas de table à la main). À faire AVEC le prestige (même notion de valeur).

### 5. Statistiques de production (dashboard Hobby) — effort L
Graphes temporels (production/min par item, AP/min, efficacité) sur les 60 dernières
minutes. Stockage léger en ring-buffer dans `useProgressionStore` (échantillon/10 s).
Référence genre : Factorio production graphs — LA feature de rétention des experts.

### 6. Partage d'usine par URL (viralité) — effort M
`src/persistence` a la base Dexie ; le plan d'origine (test 12) prévoit l'état → URL
compressée (lz-string). Avec la persistance graphe (faite), sérialiser `nodes+edges+seed
monde` suffit. Bouton « Partager » → presse-papier.

### 7. Efficacité machine exacte dans le tick — effort M
Le tick AP utilise le proxy `surplus/(surplus+déficits)` ; remplacer par la moyenne des
efficacités réelles par machine (déjà calculées par `machineStatus`/NodeFlowContext pour
les badges). Cohérence badge ↔ AP. Attention au coût CPU (1 Hz, OK).

### 8. Minimap monde complète — effort M
Les gisements sont désormais dessinés dans la MiniMap (portal SVG) mais **clippés au
viewBox** que React Flow calcule sur nodes+viewport. Pour une vraie carte du monde :
minimap custom (canvas 2D, bounds = gisements ∪ nodes), clic = recentrage. Le bouton
« 🧭 Vue d'ensemble » couvre le besoin en attendant.

---

## P3 — Polish / juice

### 9. Audio discret (feedback) — effort M
Sons courts : milestone atteint, pose de machine, premier item produit, alerte hors
tension. Web Audio, volume bas, toggle dans un menu réglages (à créer). Jamais de son
en boucle (fatigue).

### 10. Achievements légers — effort M
~15 succès dérivés de l'état (1er computer, 100 % efficacité, usine 50 machines,
prestige ×3…). Pur (`src/game/achievements.ts`), toast réutilisable (UnlockToast).

### 11. Tutoriel niveau 2 (enseigner le splitter/merger) — effort S-M
Après M1, une 2e checklist optionnelle : « ajoute un 2e Smelter, partage le minerai avec
un Splitter ». Enseigne la logistique — le saut conceptuel le plus dur du genre.

### 12. Palette : noms tronqués — effort S
À 256 px, « Miner Mk.1 » devient « Miner … » à cause des badges AP/MW. Réduire la taille
des badges ou passer le nom sur 2 lignes.

### 13. Onboarding « reprise » — effort S
Au retour d'un joueur avec usine, un toast « Ton usine a produit X pendant ton absence »
existe (recap offline) mais pas de « où j'en étais » : re-centrer automatiquement sur
l'usine au chargement (fitView) — aujourd'hui le viewport repart du gisement de fer.

---

## Notes d'architecture (contraintes à respecter)
- Tout calcul de jeu reste PUR (`src/game`, `src/graph`) et testé sur cas connus.
- Le LP ne bouge pas : assistance + score uniquement (calculs « théoriques » : ils
  neutralisent le gating électrique via `computeFactory(..., new Map())` — convention posée
  le 2026-06-12, à conserver).
- L'électricité est physique depuis le 2026-06-12 : `computeFactory` coupe les machines
  des réseaux absents/en déficit (`unpoweredMachines`). Toute nouvelle mécanique qui
  produit des items DOIT passer par `computeFactory` pour hériter de cette règle.
