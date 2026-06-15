# Pivot thématique — « Scrappy AI Lab » (factory idle × Game Dev Tycoon)

> Statut : **proposition de design à valider**. Aucune mécanique du moteur n'est touchée tant
> que ce doc n'est pas arbitré. Décisions ouvertes listées en fin de doc.
> Contexte : le *genre* (factory-builder + idle + solveur LP qui note l'efficience) est conservé —
> c'est le socle prouvé. Seul le **thème** change, et on **ajoute une couche méta « tycoon »**.

## 1. Vision

Tu diriges une **startup IA scrappy** : tu démarres dans un garage avec deux personnes et un GPU
grand public, tu montes une infra de calcul, tu transformes de la donnée brute en datasets, tu
entraînes des modèles, tu les *shippes*, tu te fais juger par les benchmarks et la communauté, et
tu réinvestis tes revenus pour passer du garage au labo qui compte.

- **Ton** : sérieux et crédible (vrai vocabulaire ML), mais **lisible par un néophyte** — chaque
  terme technique est expliqué en une phrase au survol (progressive disclosure, déjà dans l'ADN
  du projet). On n'explique pas « ce qu'est un Transformer » ; on dit *ce qu'il fait pour toi*.
- **Pas de buzzword bingo.** Authenticité = les mécaniques *sont* les vraies contraintes du
  domaine (le compute est rare, la donnée sale coûte cher, les benchmarks sont impitoyables),
  pas un vernis « IA ».
- **Le différenciateur LP devient une histoire** : « optimise ton labo comme un vrai ingé ML —
  minimise le coût par run, maximise la capacité livrée ». Le score d'efficience = tes marges.

## 2. Architecture en deux couches

Tout l'enjeu : les deux couches se **nourrissent mutuellement**, aucune ne rend l'autre inutile.

```
  SALLE DES MACHINES (usine idle, moteur ACTUEL)        LE BUREAU (couche tycoon, NOUVEAU)
  ────────────────────────────────────────────         ──────────────────────────────────
  Sources de données ─▶ Pipeline ─▶ Datasets propres    Projet de modèle (type × domaine)
  Datacenters       ─▶ Compute (= l'« électricité »)    + répartition d'effort sur les phases
            │                  │                                    │
            └──── consommés par un RUN d'entraînement ◀────────────┘
                               │  (durée pilotée par le débit de COMPUTE → timer idle)
                               ▼
                         MODÈLE (score de qualité)
                               │  ship (API / open weights / produit)
                               ▼
              Benchmarks + réception communauté ─▶ Adoption ─▶ Revenus (€) + Réputation + RP
                               │
                               └──▶ réinvestis : + compute, + staff, + recherche  (boucle)
                               └──▶ Prestige = nouvelle génération de modèle (run from scratch)
```

- **Salle des machines** = ce qui existe déjà (graphe React Flow, flux, power-gating, belts,
  offline, score LP). Reskinné, pas réécrit.
- **Le compute remplace l'électricité** : clé de voûte. « Pas de compute, pas d'entraînement »
  (le `coal-generator` devient un datacenter qui produit du compute ; la réserve de charbon du
  hook devient une réserve de crédits cloud de démarrage).
- **Le run d'entraînement est le pont** : il consomme du compute *dans le temps*. Sa vitesse =
  ton débit de compute. Donc agrandir/optimiser l'usine accélère directement le méta-jeu.

## 3. Mapping thématique (reskin — Phase 0)

| Actuel | Scrappy AI Lab | Note |
|---|---|---|
| Gisements / biomes | Sources de données (web crawl, open data, données users, capteurs) ; biomes = domaines (texte / image / code / audio) | l'exploration de carte = ratisser la donnée |
| Mineur (extracteur) | Crawler / ingesteur de données | extrait de la donnée brute d'une source |
| Minerais bruts | Données brutes (corpus texte, images non taggées…) | |
| Charbon | Données « sales » / signal brut alimentant le datacenter | (mapping à trancher, cf. Q2) |
| **Électricité (power)** | **Compute** (GPU-heures / FLOPs) | le vrai goulot de l'IA |
| Coal Generator | **Datacenter** (produit du compute) | réserve charbon → crédits cloud de démarrage |
| Câbles électriques | Interconnect (réseau / bus) | |
| Smelter | Nettoyage / dédup / tokenisation | data brute → tokens propres |
| Constructor / Assembler | Embeddings → fine-tuning datasets | étapes intermédiaires du pipeline |
| Manufacturer / Refinery | Pipeline d'entraînement haut de gamme | |
| Tiers Mk1/2/3 | GPU grand public → A100 → cluster | montée en puissance lisible |
| Items intermédiaires | tokens, embeddings, datasets étiquetés, checkpoints | |
| Produit final | une **Capacité** (brique réutilisable : compréhension, vision…) | alimente les projets de modèle |
| **Points de Recherche** (déjà nommés) | Recherche fondamentale → débloque architectures/techniques | mapping gratuit |
| **Bolts** (monnaie) | **Budget / € de financement** (revenus produit + levées) | |
| Contrats clients | Demandes d'API / clients entreprise / deals B2B | |
| Milestones | Jalons de capacités (déblocage Vision, Code, Agents, Raisonnement…) | |
| **Score d'efficience LP** | **Efficience compute/coût du labo** | vraie métrique (coût/token, FLOP-eff.) |
| Offline / idle | Les runs tournent la nuit | un training prend des heures = idle naturel |
| Prestige | Nouvelle **génération** de modèle (reset, multiplicateur) | |

## 4. La boucle Tycoon (Phase 1) — Game Dev Tycoon → startup IA

Cœur du méta-jeu, calqué sur Game Dev Tycoon mais avec des contraintes IA authentiques.

1. **Choix du projet** : *Type de modèle* (langage / vision / code / multimodal…) × *Domaine
   d'application* (assistant, génération d'images, copilote dev…). Certaines combos sont
   « hot » selon la **tendance du marché** du moment (bonus de réception) ; d'autres flopent.
2. **Répartition de l'effort sur les phases d'entraînement** (l'équivalent des sliders GDT) :
   *Pré-entraînement / Fine-tuning (SFT) / Alignement (RLHF) / Évaluation*. Le bon dosage
   **dépend du type de modèle** — mauvais mix = modèle médiocre. (Pédagogie : chaque phase a une
   tooltip « à quoi ça sert ».)
3. **Le run s'exécute dans le temps** : barre de progression dont la vitesse = ton débit de
   **compute** (lien direct avec l'usine) et la quantité de **dataset** disponible. C'est le
   timer idle : tu peux laisser tourner, revenir, le run a avancé.
4. **Qualité du modèle** = f(compute investi, qualité+volume du dataset, dosage des phases,
   niveau de recherche débloqué, staff assigné). Les **défauts** (hallucinations, biais,
   incidents de sûreté) = les « bugs » de GDT : ils plombent la review si tu n'as pas mis assez
   d'**Évaluation / red-teaming**.
5. **Ship** : API / open weights / produit. **Hype** pré-lancement (demo day, waitlist,
   marketing) amplifie l'adoption initiale.
6. **Réception** : note de **benchmark** (suite de tests) + **réception communauté** (façon
   classement type arène) → c'est la « review /10 » de GDT, ici totalement crédible (les modèles
   IA *sont* jugés par des leaderboards et le bouche-à-oreille).
7. **Revenus** ∝ réception × hype × base d'utilisateurs → € + Réputation + Points de Recherche.
8. **Réinvestir** : plus de compute (agrandir l'usine), staff, recherche. Boucle.

### Lien avec le différenciateur LP
Le LP note l'efficience de la **salle des machines** : à capacité égale, un labo qui produit son
compute/ses datasets près de l'optimum a un **coût par run plus bas** → meilleures marges → la
startup scrappy survit et double ses concurrents. Le score n'est plus abstrait : c'est ta runway.

## 5. Staff, recherche, tendances (Phase 2)

- **Staff** : embaucher chercheurs/ingés (stats : recherche / ingénierie / spécialité de domaine),
  les former. Ils accélèrent les runs et augmentent la qualité. Masse salariale = coût récurrent
  (tension scrappy).
- **Arbre de recherche** (réutilise les RP, déjà conçu façon Icarus dans le backlog progression v2) :
  architectures (attention, MoE, RAG…), techniques (quantization, distillation…), nouveaux
  domaines. Débloque types de projets et bonus de qualité.
- **Tendances du marché** : « le raisonnement est hot », « les agents trendent » — t'aligner sur
  la tendance donne un bonus de réception ; viser à contre-courant est risqué mais peut créer la
  tendance (gros pari).

## 6. Vocabulaire authentique mais accessible (règle transverse)

- Terme réel affiché + **glose d'une phrase au survol** : ex. *« Fine-tuning — spécialise un
  modèle généraliste sur ta tâche, bien moins cher que repartir de zéro. »*
- Jamais d'explication théorique ; toujours **l'effet de jeu**. Le néophyte apprend le vrai
  vocabulaire *par l'usage*, ce qui est un argument de rétention (« j'ai appris un truc »).
- HUD : la « console de labo ML » remplace le HUD industriel orange/cyan — même langage visuel
  (terminal, glow), thème graphe = déjà celui des outils IA (ComfyUI / LangGraph / n8n).

## 7. Phasage proposé (du moins risqué au plus ambitieux)

- **P0 — Reskin de la salle des machines** : data (`public/data/`), copy, icônes, HUD.
  Mécaniques *identiques*. Valide si le thème « prend » sans rien risquer du moteur prouvé.
  *Livrable de validation : une chaîne verticale re-thématisée jouable (crawler → nettoyage →
  datacenter/compute → une Capacité), pour juger le feel en vrai.*
- **P1 — Boucle Tycoon minimale** : projets de modèle, run = timer piloté par le compute, ship,
  review (benchmark + réception), revenus, réinvestissement. C'est *le* hook méta.
- **P2 — Profondeur** : staff, arbre de recherche (RP), tendances de marché, prestige = génération.

## 8. Risques & garde-fous

- **Les deux couches doivent se nourrir** : si l'usine devient un simple « robinet à compute »
  qu'on ignore, on a perdu le genre. Garde-fou : l'optimisation LP de l'usine doit avoir un
  impact *lisible* sur les marges/vitesse de run.
- **Scope** : la couche tycoon est un vrai jeu en soi. D'où le phasage strict ; ne pas coder P1
  avant d'avoir validé le feel de P0.
- **Hype fatigue / crédibilité** : rester du côté « contraintes réelles » (compute rare, data
  sale, benchmarks durs), pas « 🤖 AI magique ».
- **Équilibrage** : la boucle revenus/coût (P1) devra repasser par l'agent `game-balance` — c'est
  une nouvelle économie, pas un simple rename.

## 9. Décisions arbitrées (2026-06-14)

1. **Q1 — Granularité du pipeline → INCHANGÉE pour P0.** On garde la profondeur de chaîne
   actuelle (~3 niveaux), simplement reskinnée. On ne redessine le nombre d'étapes qu'après
   avoir validé le feel.
2. **Q2 — Mapping du « charbon » → on GARDE la boucle combustible.** Donnée brute « sale »
   alimente le datacenter → produit du **compute**. La mécanique fuel⇄énergie (calcul 2 passes)
   est conservée. **La réserve du hook survit**, renommée « **crédits cloud de démarrage** ».
3. **Q3 — Qualité du modèle → AXE SÉPARÉ du score LP.** Le score LP reste pur (efficience =
   coût par unité de compute/dataset = marges, le différenciateur). La **qualité du modèle** est
   une jauge distincte (note de benchmark/réception, façon review GDT), calculée depuis les
   intrants du run (qualité+volume des données × compute × dosage des phases × recherche × staff).
   **Lien** : l'efficience ne fait pas la qualité, elle la rend *moins chère* → un labo lean
   itère plus vite vers la même qualité. Deux jauges lisibles qui se renforcent sans se confondre.
4. **Q4 — Monnaie → « $ » / financement** (franc, lisible pour le thème startup ; remplace « Bolts »).
5. **Q5 — Ship → un produit phare à la fois** en P0/P1 (focus façon GDT early) ; modèles/API en
   parallèle = déblocage P2.
6. **Q6 — Le run consomme le compute en DÉBIT (flux), avec petit buffer.** La vitesse du run =
   débit de compute soutenu → optimiser l'usine = itérer plus vite (sert la boucle « itérer vers
   un meilleur produit »). Réutilise les sémantiques du moteur (consommation au flux,
   ralentissement si flux insuffisant, buffer = la réserve). Pas de modèle stock/batch (qui
   découplerait l'usine du run).
```

## 10. État d'avancement

- **P0 — Reskin** : ✅ livré et commité (dataset, copy, HUD, icônes). Voir l'historique git.
- **P1 — Boucle Tycoon minimale** : ✅ **première tranche livrée (2026-06-15)**.
  - **Moteur pur** `src/game/tycoon.ts` (déterministe, testé, façon `contracts.ts`) : 4 types
    de modèles (langage/vision/code/multimodal) avec dosage idéal + dataset clé + compute requis ;
    4 domaines ; phases d'effort (pré-entraînement / fine-tuning / alignement / évaluation) ;
    `ActiveProject`/run piloté par le **débit de compute** (item `electricity`) ; **qualité**
    (axe séparé du LP, Q3) = dosage × volume de dataset × compute, **−pénalité de défauts** si
    l'évaluation est négligée ; **review** (benchmark 0-100 + réception communauté × tendance ×
    hype) → **revenus $ + RP + renommée** ; **tendance de marché** seedée avec TTL.
  - **Intégration** `src/game/progression.ts` + `useProgressionStore` : slice `tycoon`, run
    avancé au tick depuis `grossProduction` (compute = `electricity`, dataset clé suivi),
    `startModelProject` / `shipModelProject` (revenus → Bolts, RP crédités), **migration persist
    v5→v6**, `isTycoonUnlocked` (gaté : il faut avoir produit du compute).
  - **UI** : `TycoonPanel` (« Le Bureau » — setup type/domaine/dosage avec gloses néophytes,
    barre de run compute, qualité estimée en direct, bouton Ship, vitrine renommée/benchmark) +
    bouton toolbar **LAB** (gaté, pulse « run prêt ») + `ShipReviewToast` (la review GDT-like).
  - **Monnaie** : Q4 (« $ ») rendue côté revenus, mais le **champ reste `bolts`** dans le code
    (pas de rename pour éviter le churn ; l'UI Tycoon affiche « $ »). Rename éventuel = passe
    séparée si le thème tient.
- **P1 — 2e tranche livrée (2026-06-15) : hype/marketing + staff (début P2)**.
  - **Hype / marketing** (termine §4.5) : `ActiveProject.hype` (≥ 1), `applyMarketing` (rendements
    décroissants vers `HYPE_MAX`), `marketingCost` (× hype) ; réducteur `runMarketingPush` (dépense $) ;
    le hype amplifie la réception au ship (`reviewModel` lit `project.hype`). UI : bloc « Hype » +
    bouton Campagne dans le run.
  - **Staff** (cœur P2) : 3 rôles (Ingénieur infra → **vitesse de run**, Chercheur → **qualité**,
    Data scientist → **efficacité dataset**) avec coût d'embauche + **masse salariale récurrente**
    (`totalSalaryPerMin`, débitée des Bolts au tick, jamais < 0 — tension scrappy). Multiplicateurs
    `labSpeedMult`/`labDatasetMult`/`labQualityBonus` appliqués au tick (compute × vitesse, dataset ×
    eff., qualité + bonus chercheurs plafonné). Réducteur `hireStaffMember`. UI : section « ÉQUIPE »
    (embauche, effectifs, masse salariale). Lien : agrandir l'usine ET embaucher accélèrent le run.
  - **Persistance** : migration **v6→v7** (garantit `staff` + `hype` sur sauvegardes v6).
  - **Tests** : moteur 33 unitaires + intégration progression (salaire/embauche/marketing/vitesse) +
    3 E2E Tycoon. **341 unitaires + 19 E2E verts** (1 E2E `AMÉLIORER` cassé AVANT le pivot, sans
    rapport), typecheck + build OK.
- **RESTE P1 / P2** : arbre de recherche (RP) ; pari contre-tendance ; prestige = génération de modèle
  (computeRequired qui croît) ; formation/niveaux de staff ; **passe `game-balance`** sur l'économie
  Tycoon (revenus/RP/renommée/computeRequired/coûts staff/hype — tous les nombres de `tycoon.ts` sont
  un premier jet marqué `[À VALIDER game-balance]`).
