# Progression v2 — Arbre de connaissances, Contrats, Améliorations par machine

**Date** : 2026-06-12 · **Statut** : DESIGN VALIDÉ DANS SES GRANDES LIGNES par le user
(retours sur `2026-06-12-refonte-monnaies.md`, qui est **remplacé** par ce document).
**Décisions user actées** : arbre de connaissances façon **Icarus** (il aime le concept) ·
RP (anciens AP) = monnaie de DÉBLOCAGE · Coins = monnaie d'UPGRADE (et d'achat) · objectifs =
**contrats** de faux clients (textes procéduraux, deadlines, retombées en cas d'échec) ·
amélioration **par machine individuelle** (bouton sous le node « Améliorer — X coins ») ·
**zéro emoji** dans l'UI (SVG/bibliothèque uniquement, identité HUD industriel).

**Objectif de feel** : que le joueur ait toujours quelque chose à FAIRE pendant que l'usine
tourne — choisir un contrat, planifier l'arbre, améliorer une machine — sans jamais s'ennuyer
à regarder les machines fonctionner.

---

## 1. L'économie à deux monnaies (rôle clarifié)

| | **RP — Points de Recherche** | **Coins** (nom final à valider : Credits ?) |
|---|---|---|
| Source | production réelle de l'usine × efficacité (le moteur actuel des AP, offline ≤ 4 h compris) | **contrats livrés** (+ éventuelle vente passive de surplus, v2) |
| Puits | **l'arbre de connaissances** (déblocages) | pose des bâtiments + **améliorations par machine** |
| Horloge | continue, lente — récompense le débit | par paquets, événementielle — récompense l'engagement |
| Tension | « qu'est-ce que je débloque ENSUITE ? » | « j'accepte ce contrat risqué ou pas ? » |

**Bootstrap** : capital initial 50 Coins (pose mineur + générateur + smelter ≈ 35) + un
« contrat de lancement » tutoriel très simple (livrer 60 Iron Ingot, sans deadline) qui paie
les premiers Coins. Le flux RP démarre dès que l'usine produit.

> Référence genre : Icarus sépare exactement ces deux axes — le **tech tree** débloque le
> contenu (points par niveau, prérequis entre nœuds, un arbre par tier), les **talents**
> n'apportent que des bonus de performance. La séparation rend la progression lisible et la
> spécialisation stratégique.

## 2. L'arbre de connaissances (RP)

**Remplace le gating automatique des milestones** : aujourd'hui « produis 300 Iron Plate →
Assembler débloqué tout seul » ; demain le joueur GAGNE des RP en produisant et **choisit** ce
qu'il débloque. La liberté de route est le cœur du plaisir Icarus.

### Structure : 3 tiers calés sur les paliers de l'économie v1

```
TIER 1 — Fondations (dès le départ)
  [Constructor 15 RP] ──► [Assembler 40 RP] ─────────► (Tier 2)
  [Miner Mk.2 30 RP]
  [Belt Mk.2 10 RP] ──► [Belt Mk.3 25 RP]
  [Alt: Cast Screw 20 RP]   (préreq : Constructor)

TIER 2 — Industrie (préreq : Assembler + 120 RP cumulés dépensés)
  [Foundry 60 RP] ──► [Alt: Steel Cast 50 RP]
  [Refinery 80 RP]
  [Miner Mk.3 70 RP]      [Belt Mk.4 50 RP]
  [Alt: Bolted Iron Plate 40 RP]  [Alt: Iron Wire 40 RP]

TIER 3 — Haute technologie (préreq : Foundry + Refinery)
  [Manufacturer 120 RP] ──► [Alt: Automated Motor 80 RP]
  [Alt: Fused Circuit 70 RP]   [Belt Mk.5 90 RP] ──► [Belt Mk.6 140 RP]
  [Prestige 200 RP]  (le « sommet » de l'arbre v1)
```

- **Kit de base gratuit** (inchangé) : Miner Mk.1, Smelter, Coal Generator, splitter/merger,
  power pole, Belt Mk.1, recettes standard.
- **Prérequis simples** (flèches) : 1 parent max par nœud + un seuil de RP dépensés pour
  changer de tier (à la Icarus « unlock Tier 2 at level 10 »). Pas de graphe complexe en v1.
- **Coûts** : calibrés pour que le taux RP actuel (≈ 10 RP/min avec une usine M1) donne le
  même pacing que les milestones actuels (M1 ≈ 2 min, Assembler ≈ 15 min cumulées). Total
  arbre v1 ≈ 1 300 RP. Équilibrage fin → agent `game-balance`.
- **UI** : panneau « ARBRE » (3e bouton de la toolbar gauche, icône SVG circuit). Vue en
  colonnes par tier, nœuds = cartes HUD (état : verrouillé / achetable / acquis), lignes de
  prérequis en SVG. Progressive disclosure : le Tier suivant est grisé avec teaser, pas caché.
- **Les milestones actuels** deviennent des **jalons d'accomplissement** silencieux (stats,
  futur système d'achievements) — la table `MILESTONES` et `cumulativeProduced` restent, seuls
  les `unlocks` migrent vers l'arbre.

## 3. Les contrats (Coins) — l'objectif vivant

Le `MilestonePanel` « Objectifs » devient le **panneau Contrats** : des clients fictifs
demandent des livraisons. C'est la principale source de Coins ET la direction de jeu.

### Génération procédurale (pure, testée, seedée)
- **Client** : nom composé de banques de fragments (`[Vortex|Helios|Drax|Kappa|Meridian…] +
  [Industries|Syndicate|Labs|Logistics|Corp…]`) + une phrase d'ambiance par gabarit
  (« Notre chaîne de %item% est à l'arrêt. Sauvez notre trimestre. ») — léger, drôle, jamais
  bloquant. Générateur **mulberry32** (déjà dans le projet, resourceMap).
- **Demande** : item parmi ceux que le joueur SAIT produire (recettes débloquées), quantité =
  `débit_actuel_de_cet_item × durée_cible × difficulté`. **Toujours dérivée de l'usine réelle**
  (jamais un contrat impossible) — c'est la règle « pas de faux nombres » appliquée au quest
  design.
- **3 niveaux de risque affichés** :
  - **Standard** : quantité ≈ 80 % de la capacité, deadline confortable, paie 1×.
  - **Serré** : ≈ 110 % de la capacité (il FAUT améliorer/étendre), paie 2×.
  - **Cornélien** : gros volume, deadline courte, paie 3.5× — mais pénalité d'échec réelle.
- **Slots** : 3 offres visibles, 1 contrat actif maximum en v1 (lisibilité). Refuser est
  gratuit ; une offre expire et se renouvelle (~10 min).

### Deadline et retombées
- La deadline court en **temps de jeu effectif** (sessions + offline plafonné) — pas de
  punition pour avoir dormi au-delà du cap des 4 h (cohérent avec l'idle).
- **Livraison** : automatique — le cumul de production de l'item depuis l'acceptation sert de
  compteur (réutilise la mécanique `cumulativeProduced` des milestones : déjà testée).
- **Échec** : pas de perte de Coins (pas de spirale punitive), mais **réputation −1** ; la
  réputation (de −3 à +3) module la qualité des offres (multiplicateurs de paie de 0.8× à
  1.3×) et le ton des textes clients. Réussite : réputation +1. C'est la « retombée » demandée,
  sans frustration destructrice.

## 4. Améliorations PAR MACHINE (Coins)

**Décision user : par node individuel** — un bouton sous la machine sélectionnée :

```
┌──────────────────────────┐
│  [icône] Smelter  MK.II  │   ← badge de niveau sur la carte du node
│  ...                     │
└──────────────────────────┘
     [ AMÉLIORER — 25 c ]      ← bouton NodeToolbar sous le node
```

- **Effet par niveau** : +10 % de vitesse de cycle (production ET consommation suivent — la
  physique reste vraie ; le réseau électrique encaisse +10 % de MW : la tension avec
  l'électricité est volontaire).
- **Coût** : `2.5 × BUILDING_COSTS[type] × 1.6^niveau` (par machine, donc ratio plus agressif
  que le 1.15 « par type » du design v1 — sinon l'expert spamme). Smelter : 25 → 40 → 64 c…
- **Cap : niveau 3** en v1 (MK.I → MK.IV), extensible plus tard via l'arbre.
- La machine améliorée affiche son rang (MK.II…) sur la carte du node — la fierté visible.
- À la suppression du node, les Coins investis sont perdus (physique assumée) ; au prestige,
  tout est remis à zéro contre le multiplicateur permanent.
- **Implémentation** : `data.upgradeLevel` sur le node → `computeNodeInfo` applique
  `1.1^level` au débit et aux MW. Le LP/score restent sur les recettes de base (l'optimum
  théorique ne « voit » pas les upgrades en v1 — un score > 1.0 est clampé ; à raffiner en v2).

## 5. Règle d'identité visuelle (gravée dans CLAUDE.md)

**Zéro emoji.** Icônes = SVG inline ou `src/ui/icons.tsx` (bibliothèque interne à enrichir :
compass, research/flask, coin, contract/clipboard, tree). Caractères techniques monochromes
(✓ ▶ ▼) tolérés dans les badges façon terminal. Tout nouveau composant suit l'identité HUD
industriel (zinc + orange/cyan, coins HUD, glow, font mono pour les données).

## 6. Plan d'implémentation (tranches testées, ordre de valeur)

1. **T1 — Renommage et plomberie monnaies** (M) : `automationPoints` → `researchPoints`,
   nouveau `coins` (capital 50), pose des bâtiments payée en **Coins**, migration persist v2
   (+ RP rétroactifs sur la production cumulée). StatusBar : 2 compteurs avec icônes SVG.
2. **T2 — Améliorations par machine** (M) : `upgradeLevel` + bouton NodeToolbar + badge MK +
   tests (coût 1.6^N, effet 1.1^N, MW qui suivent, cap 3, réseau qui disjoncte si on pousse).
3. **T3 — Contrats** (L) : générateur procédural pur (`src/game/contracts.ts`, seedé, testé :
   quantités dérivées du débit réel, 3 risques, expiration) + store + panneau Contrats
   (remplace Objectifs) + réputation + paiement Coins. Le « contrat de lancement » remplace
   la dernière étape du tutoriel.
4. **T4 — Arbre de connaissances** (XL) : data pure (`src/game/knowledge.ts` : nœuds, coûts,
   prérequis, tiers) + migration des `unlocks` de MILESTONES + panneau ARBRE + RP dépensés +
   tests (prérequis, idempotence, gating LP/palette inchangés dans leur mécanique
   `isBuildingUnlocked`/`allowedAlternateRecipeIds` — seule la SOURCE du déblocage change).
5. **T5 — Équilibrage global** (M) : passe `game-balance` sur les coûts RP/Coins/contrats
   avec courbes vérifiées, + E2E du nouveau parcours.

Chaque tranche laisse le jeu jouable et les suites vertes. T1+T2 = la « montée en gamme »
ressentie immédiatement ; T3 = le contenu actif ; T4 = la liberté stratégique.

## 7. Questions ouvertes (à trancher avant T1)

- **Q1 — Nom des Coins** : « Coins » tel quel ? « Credits » ? (l'icône sera un SVG pièce/hexagone).
- **Q2 — Pose des bâtiments** : en Coins (recommandé : l'argent achète le matériel, les RP
  restent purs « savoir ») — ou garder la pose en RP ?
- **Q3 — Contrats simultanés** : 1 actif max (recommandé v1) ou 2-3 dès le départ ?
- **Q4 — L'arbre remplace-t-il TOTALEMENT les milestones-déblocages** (recommandé), ou
  garde-t-on 2-3 déblocages automatiques au tout début pour le Hook (Constructor offert au
  premier contrat livré) ?

---

### Sources (recherche 2026-06-12)
- [Icarus Tech Tree & Talents Guide (HubPages)](https://discover.hubpages.com/games-hobbies/Icarus-Tech-Tree-Talents-Guide) — séparation tech tree / talents, points par niveau.
- [Icarus Wiki — Talents](https://icarus.fandom.com/wiki/Talents) · [Tech Tree](https://icarus.fandom.com/wiki/Category:Tech_Tree) — tiers, prérequis, seuils de dépense.
- [Procedural Quest Generation (Game Developer)](https://www.gamedeveloper.com/design/procedural-quest-generation-current-and-future-industry-outlook) — gabarits + contraintes dérivées de l'état du joueur.
- Veilles internes : `Docs/veille/2026-06-09-veille-game-design.md`, backlog 2026-06-12.
