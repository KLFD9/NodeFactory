# Refonte des monnaies — Cogs + Points de Recherche

> ⛔ **REMPLACÉ le 2026-06-12** par `2026-06-12-progression-v2-arbre-contrats.md` après retours
> user : arbre de connaissances façon Icarus retenu (et non de simples bonus globaux),
> améliorations PAR MACHINE (et non par type), objectifs → CONTRATS procéduraux, zéro emoji.
> Conservé pour l'historique du raisonnement.

**Date** : 2026-06-12 · **Statut** : OBSOLÈTE — voir ci-dessus.

---

## 1. Le problème avec la monnaie unique

Aujourd'hui les **AP** servent uniquement à poser des bâtiments. Une fois l'usine stabilisée,
ils s'accumulent **sans puits de dépense** : plus de tension économique, plus de décision.
Les courbes idle de `balance.ts` (`upgradeCost` ×1.15/niveau, `upgradeProduction` ×1.1/niveau,
`AP_GENERATOR_BASE_COST`) sont codées et testées **mais câblées à rien**. Et le taux uniforme
(1/3 AP par item/min) rend les items avancés économiquement absurdes (Q6 : 40 screws/min
rapportent 16× plus qu'un computer à 2.5/min).

Le cadre idle de référence (veille 2026-06-09 + Missions Zanx / GameAnalytics) : **deux monnaies
à horloges différentes** — une opérationnelle qui circule vite (gagner/dépenser en continu,
satisfaction immédiate) et une stratégique rare (décisions d'investissement long terme). C'est
exactement la proposition user.

## 2. Les deux monnaies

### ⚙ Cogs (« rouages ») — la monnaie OPÉRATIONNELLE
*Renommage des AP actuels — même génération, nouveaux puits de dépense.*

- **Gagnés** : débit réel de l'usine × efficacité × taux (mécanique actuelle inchangée,
  y compris offline ≤ 4 h et multiplicateur de prestige). Jamais de faux nombres.
- **Dépensés** :
  1. **Pose de bâtiments** (`BUILDING_COSTS`, inchangé).
  2. **NOUVEAU — Améliorations par TYPE de machine** (le cœur de la demande, voir §3).
- Horloge courte : ça rentre et ça sort pendant la session. Le solde ne doit jamais stagner.

> Nom : **Cogs** recommandé (thème industriel, court, ⚙ déjà dans l'UI, aucune confusion avec
> la Recherche). Alternatives considérées : Scrap (connoté déchet), Crédits (générique, froid).

### 🔬 Points de Recherche (RP) — la monnaie STRATÉGIQUE
- **Gagnés** : à chaque **milestone franchi** (récompense fixe, croissante avec le palier —
  table §5). Plus tard (avec Q6) : bonus RP pour la production d'items de palier 2/3.
- **Dépensés** : **améliorations GLOBALES** à choix (voir §4). Rares, réfléchis, permanents.
- Horloge longue : quelques RP par session — chaque dépense est une décision.

**Garde-fou (décision user antérieure)** : pas d'arbre de compétences qui GATE le contenu.
Les bâtiments/recettes restent débloqués par les **milestones** (gratuits, automatiques). La
Recherche n'achète que des **bonus optionnels** — deux joueurs avec les mêmes milestones ont le
même contenu, pas la même usine. Pas de double-gate frustrant.

## 3. Améliorations de machines (Cogs) — la « montée en gamme »

**Par TYPE de bâtiment, pas par node individuel.** (Un upgrade par node = micro-management,
perte à la suppression, UI par machine ; un upgrade par type = « MES Smelters sont niveau 3 »,
fierté de flotte, zéro friction. Cohérent avec 1 node = 1 machine.)

Deux pistes par type, achetables indépendamment — et en **tension** :

| Piste | Effet par niveau | Conséquence systémique |
|---|---|---|
| **Cadence** | vitesse de cycle ×1.1 (débit +10 %) | consomme PLUS de MW en proportion (+10 %) → il faut étendre le réseau électrique et le charbon |
| **Sobriété** | conso électrique −7 % (plancher 50 % de la base) | libère des MW → plus de machines sur le même générateur |

C'est l'arbitrage qui rend l'électricité physique intéressante : booster la cadence sans
investir dans le courant fait DISJONCTER le réseau (déficit → tout s'arrête). Le joueur ressent
la montée en gamme ET ses conséquences.

**Coûts** (réutilise `upgradeCost` existant, ratio 1.15 — déjà testé) :
`coût(type, piste, N) = 5 × BUILDING_COSTS[type] × 1.15^N`
- Smelter (pose 10) : Cadence niv.1 = 50 Cogs (~5 min de jeu early), niv.5 ≈ 100, niv.10 ≈ 202.
- Manufacturer (pose 500) : niv.1 = 2 500 Cogs — réservé au late game. Échelle naturelle.
- **Cap de niveau initial : 5**, étendu par la Recherche (§4) — crée le lien entre monnaies.

**Vérité de simulation** : les multiplicateurs s'appliquent dans `computeNodeInfo`/`computeFactory`
via une map `buildingId → {speedMult, powerMult}` passée EN ENTRÉE (même sens de dépendance que
`allowedAlternates` pour le LP : le jeu configure le moteur). Pour le LP/score : pré-transformer
les recettes (`time / speedMult`, `powerMW × powerMult`) avant le solve — le solveur reste
agnostique. Le score d'efficacité reflète donc l'usine améliorée vs l'optimum amélioré : équitable.

## 4. Recherches globales (RP) — catalogue v1 (8 entrées)

| Recherche | Coût | Effet |
|---|---|---|
| Logistique I / II | 2 / 4 RP | capacité de TOUS les belts +10 % / +20 % |
| Combustion optimisée | 3 RP | générateurs : −20 % de consommation de charbon |
| Maîtrise industrielle I / II | 3 / 6 RP | cap d'amélioration des machines 5→8 / 8→12 |
| Veille automatique | 4 RP | plafond des gains hors-ligne 4 h → 8 h |
| Prospection | 2 RP | révèle les gisements sur toute la minimap (vue monde complète) |
| Cartographie | 1 RP | +1 pin sur chaque gisement à pin unique |

Tous des **bonus**, aucun contenu gaté. 25 RP au total ≈ budget des 13 milestones (§5) :
tout est achetable à terme, mais l'ORDRE est la décision stratégique (Hobby).

## 5. Récompenses RP par milestone

M1-M3 : 1 RP · M4-M7 : 2 RP · M8-M10 : 3 RP · M11-M13 : 3 RP. **Total : 25 RP.**
(Équilibre exact à valider par l'agent `game-balance` — contrainte : le joueur doit pouvoir
acheter sa première recherche à ~M2-M3, pendant la phase Hook tardive.)

## 6. Boucle finale

produire → **Cogs** → poser + améliorer les types → produire plus (mais réseau sous tension !)
→ milestones → **RP** → bonus stratégiques → … → prestige (reset, multiplicateur permanent —
les niveaux d'amélioration sont REMIS À ZÉRO au prestige : c'est le « coût » du reset, le
multiplicateur ×1.5^N compense — à confirmer au design du prestige).

## 7. Plan d'implémentation (3 tranches testées)

1. **T1 — Renommage + RP** (S) : `automationPoints` → `cogs` (migration persist v2),
   `researchPoints` + récompense par milestone, affichage StatusBar (⚙ + 🔬). Tests : migration,
   attribution RP idempotente.
2. **T2 — Améliorations machines** (L) : `upgrades: Record<buildingId, {cadence, sobriety}>`
   dans la progression ; multiplicateurs injectés dans `computeNodeInfo`/`computeFactory` + LP ;
   UI (section « Améliorer » dans l'inspecteur + palette) ; tests (coûts ×1.15^N, effets ×1.1^N,
   plancher sobriété, cap, le réseau disjoncte si cadence sans MW).
3. **T3 — Recherche** (M) : catalogue pur dans `balance.ts` + panneau Recherche (onglet toolbar
   gauche) ; effets câblés (belts, offline cap, fuel, caps d'upgrade) ; tests par recherche.

## 8. Questions ouvertes pour l'humain

- **Q1 — Nom** : « Cogs » te va ? (sinon : Scrap, Crédits, Parts…)
- **Q2 — Prestige** : reset des niveaux d'amélioration au prestige (recommandé) ou conservés ?
- **Q3 — Sobriété** : −7 %/niveau plancher 50 %, ou piste unique Cadence pour la v1 (plus simple) ?
- **Q4 — RP rétroactifs** : un joueur existant avec 8 milestones franchis reçoit-il ses RP à la
  migration ? (Recommandé : oui — sinon frustration.)
