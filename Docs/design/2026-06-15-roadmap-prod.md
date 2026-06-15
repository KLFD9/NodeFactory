# Roadmap NodeFactory — de l'état actuel à la production

> **Doc maître « où on en est / ce qu'il reste / comment on vérifie ».** Tenu à jour avec la
> section « État du jeu » de `CLAUDE.md`. Dernière révision : **2026-06-15**.
>
> Contexte produit : `Docs/Brief_project.md` · Pivot thème : `Docs/design/2026-06-14-pivot-theme-startup-ia.md`
> · Économie v1 : `Docs/design/2026-06-10-economie-maison-v1.md` · Progression v2 :
> `Docs/design/2026-06-12-progression-v2-arbre-contrats.md` · Backlog historique :
> `Docs/design/2026-06-12-backlog-gameplay.md`.

---

## 1. Étapes établies (DONE)

### Moteur (salle des machines) — solide, testé
- [x] **Solveur LP** pur et déterministe (glpk.js), sans état de jeu (`src/solver`).
- [x] **Données** : frontière unique `loadGameData()` + `validate.ts` (`src/data`). Dataset v1.
- [x] **Physique d'usine** (`src/graph`) : flux matière (prod/conso/surplus/déficits), **électricité**
  (réseaux union-find, « pas de courant, pas de prod »), **combustible 2 passes** (« pas de charbon,
  pas de courant »), **belts plafonnés**, logistique (splitter/merger), `machineStatus`, `assist` (LP),
  réserve de démarrage des générateurs.
- [x] **Score d'efficacité** 3 dimensions (ressources/machines/énergie) = le différenciateur LP.

### Couche jeu — complète pour la boucle de base
- [x] **Progression** (`src/game/progression.ts`) + `useProgressionStore` persisté.
- [x] **Économie/équilibrage** (`balance.ts`) : 13 milestones, micro-jalons hook, courbes idle
  ×1.1/×1.15, offline (plafond 4 h), capital initial, coûts de pose.
- [x] **Deux monnaies** : RP (production → savoir) + Bolts (contrats → pose/améliorations).
- [x] **Contrats** clients procéduraux (`contracts.ts`) : objectif vivant + source de Bolts, réputation.
- [x] **Améliorations par machine** (cadence +10 %/niv, coût 1.6^N).
- [x] **Monde** : carte en biomes (Voronoï), gisements biaisés par biome, minimap.
- [x] **Onboarding** : WelcomeModal + tutoriel 9 étapes / 3 sections dérivé du graphe.
- [x] **Persistance** versionnée (localStorage, **v7**), migrations testées ; E2E Playwright.

### P0 — Reskin « Scrappy AI Lab » (committé)
- [x] Dataset re-thématisé IA (`public/data/mock/`), copy tutoriel/UI, HUD, icônes/illustrations
  (Harvester, Datacenter, BeltEdge data-themed). **Mécaniques identiques** (chiffres figés, ids inchangés).

### P1 — Boucle Tycoon « Le Bureau » (livré, non committé)
- [x] **Moteur** `src/game/tycoon.ts` (PUR, 33 tests) : types de modèles (langage/vision/code/multimodal)
  × domaines × dosage des phases ; **run piloté par le débit de compute** (item `electricity`) ;
  **qualité** = axe séparé du LP (dosage × dataset × compute − défauts éval) ; **review** (benchmark +
  réception × tendance × hype) → revenus $ + RP + renommée ; tendance de marché seedée.
- [x] **Hype / marketing** pré-lancement (décision $ → réception).
- [x] **Staff** : 3 rôles (ingénieur → vitesse run, chercheur → qualité, data scientist → dataset),
  coût d'embauche + **masse salariale** récurrente (débitée des Bolts).
- [x] **Intégration** progression/store (advance au tick depuis la prod, salaire, migration **v6→v7**) ;
  **UI** `TycoonPanel` (bouton LAB gaté au compute) + `ShipReviewToast`.

---

## 2. Tâches jusqu'à la production (TODO, priorisé)

### P1.1 — Finir/polir la boucle Tycoon (gameplay)
- [ ] **Onboarding du Bureau** : étape de tutoriel « lance ton 1er modèle » + glose à l'ouverture du LAB.
- [ ] **Cohérence monnaie $ ↔ Bolts** : aujourd'hui la StatusBar affiche « Bolts », le Bureau affiche
  « $ » pour la même valeur. Trancher (afficher « $ » partout, ou garder « Bolts ») et harmoniser
  l'UI (la décision Q4 = « $ »). Rename du champ `bolts` = refactor séparé optionnel.
- [ ] **Gloses néophytes** : champ `description` (1 phrase « effet de jeu ») sur items/bâtiments/recettes
  + survol dans l'UI (règle « vocabulaire authentique mais accessible »).
- [ ] **Feedback run terminé** : petit toast « run prêt à shipper » (le flash du bouton LAB existe déjà).

### P2 — Profondeur méta (le « hobby »)
- [ ] **Arbre de recherche** (RP) côté Bureau : puits de RP, débloque types de modèles / techniques
  (quantization, distillation…) / bonus de qualité. Réutilise le design Icarus (progression v2).
- [ ] **Pari contre-tendance** : viser à contre-courant = risqué mais peut créer la tendance.
- [ ] **Prestige = nouvelle génération de modèle** : reset partiel, multiplicateur permanent,
  `computeRequired` qui croît par génération (base déjà dans `balance.ts`, non câblée).
- [ ] **Staff avancé** : formation/niveaux, plafond d'effectif, conséquence si salaire impayé (morale).
- [ ] **Plusieurs produits / API en parallèle** (Q5, déblocage P2).

### Équilibrage (agent `game-balance`) — bloquant pour la prod
- [ ] **Passe chiffrée complète sur l'éco Tycoon** : `computeRequired`, revenus, RP, renommée, coûts
  d'embauche, salaires, hype, marketing — tous marqués `[À VALIDER game-balance]` dans `tycoon.ts`.
- [ ] **Pondération des contrats par valeur d'item** (Q6 backlog : un contrat de screws ne doit pas
  payer comme un de computers).
- [ ] **Non-dominance des recettes alternatives** validée par tests LP (règle CLAUDE.md).
- [ ] **Courbe de difficulté** : playtest du parcours 0 → 1er ship → boucle stable (Hook/Habit/Hobby).

### Dette technique / bugs
- [ ] **Réparer l'E2E `AMÉLIORER`** (NodeToolbar introuvable — cassé avant le pivot).
- [ ] **Code-splitting** : `dist/assets/layout-*.js` ≈ 1,44 Mo (warning > 500 kB). Lazy-load
  glpk.js (WASM) et/ou React Flow ; `manualChunks`.
- [ ] **Partage URL** (backlog) + migration du blob graphe vers Dexie s'il grossit.
- [ ] **Robustesse persistance** : garde-fou si localStorage corrompu (try/catch + reset propre).

### Production / release
- [ ] **Export / import de sauvegarde** (Dexie prévu) — filet anti-perte.
- [ ] **Hébergement statique** (Vercel / Netlify / GitHub Pages) : `base` Vite, build `dist/`.
- [ ] **PWA optionnelle** (jeu 100 % client) : manifest + service worker pour le hors-ligne réel.
- [ ] **Méta / branding** : titre, favicon, meta OG, page « à propos ».
- [ ] **Open source** : `LICENSE`, `README` public (install/build/contribuer), capture d'écran.
- [ ] **Perf** : profiler le tick (1 s) sur grande usine ; éviter recompute LP inutile.
- [ ] **Responsive / accessibilité** minimale (clavier, contrastes, zoom carte).
- [ ] **Télémétrie d'erreurs** optionnelle, sans dark pattern (ex. Sentry client-only) — à arbitrer.

---

## 3. Vérifications (check-list avant chaque release)

### Automatique (CI / local)
- [ ] `npm run typecheck` — 0 erreur.
- [ ] `npm run test` — **tous verts** (actuellement 341/341).
- [ ] `npm run test:e2e` — **0 échec** (actuellement 19 verts, **1 pré-existant à réparer**).
- [ ] `npm run build` — OK, et **aucun chunk > 500 kB non justifié** (objectif après code-splitting).
- [ ] `npm run validate:data -- mock` — dataset valide.

### Persistance (régression critique)
- [ ] Charger une sauvegarde **de chaque version** (v1 → v7) : pas de crash, état cohérent
  (migrations enchaînées). Le format est `{state, version}`.
- [ ] Reload simple (quelques secondes) → **pas** de popup offline ; usine/Bureau intacts.
- [ ] Absence longue → récap offline plafonné 4 h.

### Playtest manuel (parcours joueur)
- [ ] 1er lancement → tutoriel → 1re production visible < ~2 min (hook).
- [ ] Boucle compute : Datacenter alimenté → compute produit → **LAB apparaît**.
- [ ] Lancer un projet → run avance au débit de compute → **shipper** → review crédite $ / RP / renommée.
- [ ] **Marketing** monte le hype et la réception ; **staff** accélère/améliore et coûte du salaire.
- [ ] Contrats : accepter, livrer, réputation bouge.
- [ ] Aucune **erreur/warning** en console pendant une session.

### Cohérence produit (règles non négociables)
- [ ] **Zéro emoji** dans l'UI (SVG only) — décision 2026-06-12.
- [ ] **Pas de faux nombres** : $/RP/AP dérivés du débit réel × efficacité.
- [ ] **Monnaie cohérente** ($ vs Bolts harmonisé partout).
- [ ] **Découplage** respecté : `game` lit `data`/`solver`/`graph`, jamais l'inverse ; solveur sans état de jeu.
- [ ] Thème : vocabulaire IA authentique + **glose néophyte** présente au survol.

### Non-régression d'équilibrage
- [ ] Tests LP de **non-dominance** des alternatives toujours verts.
- [ ] Les valeurs modifiées par `game-balance` ont leurs tests chiffrés mis à jour.

---

## 4. Critères de « prêt pour la prod » (definition of done)

1. Boucle Tycoon **complète et équilibrée** (P1 fini + au moins prestige + arbre de recherche de P2),
   validée par playtest.
2. **Toutes les vérifications du §3 au vert** (y compris l'E2E `AMÉLIORER` réparé, 0 échec E2E).
3. **Équilibrage signé** par l'agent `game-balance` (plus aucun `[À VALIDER]` bloquant).
4. **Build optimisé** (code-splitting), hébergement statique configuré, export/import de save.
5. **Cohérence produit** (zéro emoji, monnaie unifiée, gloses néophytes, pas de faux nombres).
6. `README` public + `LICENSE` + branding minimal.
