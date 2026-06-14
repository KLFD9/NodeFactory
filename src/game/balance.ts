/**
 * balance.ts — Tables de configuration d'équilibrage de la couche jeu NodeFactory.
 *
 * PRINCIPES :
 *   - Tous les nombres sont JUSTIFIÉS par la physique du dataset (débit réel = amountPerCycle*60/time).
 *   - La monnaie méta ne gonfle JAMAIS les débits d'items ; elle dérive du débit réel.
 *   - Logique PURE, sans dépendance React, testable en isolation.
 *
 * PHYSIQUE DE RÉFÉRENCE (dataset v1) :
 *   Iron Ingot    : 1*60/2  =  30/min  (Smelter)
 *   Iron Rod      : 1*60/4  =  15/min  (Constructor)
 *   Iron Plate    : 2*60/6  =  20/min  (Constructor)
 *   Screw         : 4*60/6  =  40/min  (Constructor)
 *   Reinf. Plate  : 1*60/12 =   5/min  (Assembler)
 *   Modular Frame : 2*60/60 =   2/min  (Assembler)
 *   Wire          : 2*60/4  =  30/min  (Constructor)
 *   Cable         : 1*60/2  =  30/min  (Constructor)
 *   Concrete      : 1*60/4  =  15/min  (Constructor)
 */

// ---------------------------------------------------------------------------
// 1. MONNAIES — deux flux distincts (design progression v2, 2026-06-12) :
//    - RP (Points de Recherche) : dérivés de la PRODUCTION réelle → arbre de connaissances.
//    - Bolts : gagnés par les CONTRATS → pose des bâtiments + améliorations par machine.
//    Renommage des anciens « Automation Points » : la production génère désormais des RP.
// ---------------------------------------------------------------------------

/**
 * Taux de base de génération de Points de Recherche (RP) par item/min de débit.
 *
 * Calibration : une usine à 30 Reinforced Iron Plates/min (efficacité 1.0)
 * génère 30 * 1.0 * RP_RATE_PER_ITEM_PER_MIN = ~10 RP/min (confortable pour la phase Habit).
 */
export const RP_RATE_PER_ITEM_PER_MIN = 1 / 3;

/**
 * Calcule le taux de génération de RP/min pour une usine donnée.
 *
 * @param totalItemsPerMin  Débit total de production de tous les items (sum des outputs finaux),
 *                          en items/min. NE PAS inclure les intermédiaires pour éviter le double-
 *                          comptage — seuls les "flux de sortie" de l'usine comptent.
 * @param efficiency        Efficacité globale de l'usine, entre 0 et 1.
 *                          1.0 = toutes les machines à 100 % ; 0 = usine à l'arrêt.
 * @returns RP/min générés (≥ 0).
 */
export function computeRpRate(totalItemsPerMin: number, efficiency: number): number {
  if (totalItemsPerMin <= 0 || efficiency <= 0) return 0;
  const clampedEfficiency = Math.min(1, Math.max(0, efficiency));
  return totalItemsPerMin * clampedEfficiency * RP_RATE_PER_ITEM_PER_MIN;
}

// ---------------------------------------------------------------------------
// 2. DEUX HORLOGES DE RÉENGAGEMENT (pattern Eric Guan)
//    Court = sessions actives, Long = retour quotidien/hors-ligne
// ---------------------------------------------------------------------------

/** Plafond de la collecte courte (session active) : 20 minutes de production, en minutes. */
export const SHORT_CLOCK_CAP_MIN = 20;

/**
 * Plafond de la collecte longue (offline / retour quotidien) : 4 heures, en minutes.
 * [À VALIDER avec l'humain — 4 h est le choix conservateur du skill game-design.]
 */
export const LONG_CLOCK_CAP_MIN = 240; // 4 h = 240 min

/** Plafond de la collecte longue exprimé en millisecondes (pour les calculs delta-time). */
export const LONG_CLOCK_CAP_MS = LONG_CLOCK_CAP_MIN * 60 * 1000;

/**
 * Calcule les RP gagnés en delta-time depuis `lastSeenMs` jusqu'à `nowMs`.
 * Plafonne à LONG_CLOCK_CAP_MIN de production.
 * Résultat ≥ 0 même si l'horloge système recule (garde-fou).
 *
 * @param ratePerMin        Taux RP/min au moment de la déconnexion.
 * @param lastSeenMs        Timestamp (Date.now()) du dernier instant actif.
 * @param nowMs             Timestamp actuel.
 */
export function computeOfflineGains(
  ratePerMin: number,
  lastSeenMs: number,
  nowMs: number,
): number {
  if (ratePerMin <= 0) return 0;
  const elapsedMs = Math.max(0, nowMs - lastSeenMs);
  const cappedMs = Math.min(elapsedMs, LONG_CLOCK_CAP_MS);
  const elapsedMin = cappedMs / 60_000;
  return ratePerMin * elapsedMin;
}

/**
 * Seuils d'affichage de la popup récap offline à la reconnexion.
 * En-dessous, on crédite silencieusement : un simple reload d'onglet (quelques
 * secondes) ne doit JAMAIS interrompre le joueur avec une modale.
 * [À VALIDER : 1 min / 1 AP — volontairement bas, la popup est une récompense.]
 */
export const OFFLINE_RECAP_MIN_MINUTES = 1;
export const OFFLINE_RECAP_MIN_RP = 1;

/**
 * La popup récap offline doit-elle être affichée pour ces gains ?
 *
 * @param rpGained         RP crédités pour la période hors-ligne.
 * @param minutesCredited  Durée hors-ligne créditée (déjà plafonnée), en minutes.
 */
export function shouldShowOfflineRecap(rpGained: number, minutesCredited: number): boolean {
  return rpGained >= OFFLINE_RECAP_MIN_RP && minutesCredited >= OFFLINE_RECAP_MIN_MINUTES;
}

// ---------------------------------------------------------------------------
// 2bis. ENTREPÔT — stock par item, alimenté par la production BRUTE (même source
//    que les milestones), y compris les intermédiaires entièrement consommés en
//    aval. Permet aux contrats de livrer instantanément depuis ce qui est déjà
//    accumulé, au lieu d'exiger de la production future.
//
//    Plafonné, pour garder un sens à « stock » (≠ compteur infini), mais le
//    plafond SCALE avec le débit courant de l'item (« pas de faux nombres ») :
//    ~ la taille d'un contrat sur ce débit (STOCK_BUFFER_MINUTES ≈ durée d'un
//    contrat « serré »). Un plancher protège l'early game où les débits sont
//    encore faibles (30/min × 6 ≈ 180 < plancher 200).
// ---------------------------------------------------------------------------

/** Plancher de stock par item (unités) — garantit une réserve minimale en early game. */
export const STOCK_CAP_PER_ITEM = 200;

/** Durée (minutes de production) que la réserve peut contenir, au-delà du plancher. */
export const STOCK_BUFFER_MINUTES = 6;

/** Capacité de stock pour un item produit à `ratePerMin` : scale avec le débit, jamais sous le plancher. */
export function stockCapForRate(ratePerMin: number): number {
  return Math.max(STOCK_CAP_PER_ITEM, ratePerMin * STOCK_BUFFER_MINUTES);
}

// ---------------------------------------------------------------------------
// 3. COURBES IDLE
//    coût(N)  = baseCost × COST_RATIO^N  (×1.15/niveau — pacing contrôlé)
//    prod(N)  = baseProd × PROD_RATIO^N  (×1.10/niveau — perceptible)
//
//    [À VALIDER avec l'humain : COST_RATIO et PROD_RATIO peuvent être affinés
//     pour ajuster la vitesse de progression — ±0.02 sur chaque ratio.]
// ---------------------------------------------------------------------------

/** Ratio de croissance du coût par niveau d'upgrade (+15 %/niveau). */
export const UPGRADE_COST_RATIO = 1.15;

/** Ratio de croissance de la production par niveau d'upgrade (+10 %/niveau). */
export const UPGRADE_PROD_RATIO = 1.1;

/**
 * Coût en AP du N-ième niveau d'un upgrade.
 * coût(0) = baseCost (premier achat)
 * coût(N) = baseCost × 1.15^N
 *
 * @param baseCost  Coût du premier niveau (AP).
 * @param level     Niveau actuel (0 = pas encore acheté).
 */
export function upgradeCost(baseCost: number, level: number): number {
  if (level < 0) throw new RangeError('level must be >= 0');
  return baseCost * Math.pow(UPGRADE_COST_RATIO, level);
}

/**
 * Bonus de production du N-ième niveau d'un upgrade.
 * prod(0) = baseProd (valeur au niveau 0, avant tout achat)
 * prod(N) = baseProd × 1.1^N
 *
 * @param baseProd  Valeur de production au niveau 0.
 * @param level     Niveau actuel (nombre de fois acheté).
 */
export function upgradeProduction(baseProd: number, level: number): number {
  if (level < 0) throw new RangeError('level must be >= 0');
  return baseProd * Math.pow(UPGRADE_PROD_RATIO, level);
}

/**
 * Base de coût de l'upgrade AP-Generator (premier niveau = 50 AP).
 * Calibration : à 10 AP/min, le premier upgrade coûte 5 minutes de production.
 * [À VALIDER : doit être ≤ 2× le temps de session typique pour rester atteignable en Hook.]
 */
export const AP_GENERATOR_BASE_COST = 50;

/** Base de production de l'upgrade AP-Generator (multiplicateur sans dimension). */
export const AP_GENERATOR_BASE_PROD = 1.0;

// ---------------------------------------------------------------------------
// 3bis. COÛTS DE POSE EN AUTOMATION POINTS (AP) — par bâtiment
//
//    OBJECTIF DE FEEL : les 3 toutes premières poses du joueur (Miner Mk.1,
//    Smelter, Coal Generator — le strict nécessaire pour démarrer la chaîne
//    Iron Ingot ET alimenter ces deux machines en électricité dès le début,
//    cf. réseau électrique actif sans gating) doivent être atteignables en
//    ~2-3 min de jeu (Hook). Les paliers suivants montent en coût mais restent
//    accessibles au rythme normal (AP_RATE_PER_ITEM_PER_MIN = 1/3).
//
//    HYPOTHÈSE DE BOOTSTRAP : [À VALIDER avec l'humain] le joueur démarre avec
//    un capital initial de ~50 AP (don de bienvenue, hors balance.ts — géré par
//    useProgressionStore). Sans ce capital, impossible de poser la toute
//    première machine puisqu'aucune production n'a encore généré d'AP
//    (chicken-and-egg). 50 AP couvre exactement les 3 premières poses
//    (10 + 10 + 15 = 35 AP), avec 15 AP de marge pour une erreur de placement
//    ou un 2e Miner.
//
//    PALIERS DE RÉFÉRENCE (AP/min approximatifs, à débit nominal 1.0) :
//      - Démarrage (avant M1)  : 0 AP/min produit (bootstrap par capital initial)
//      - Après M1 (Iron Ingot 30/min, 1 Smelter)      : ~10 AP/min
//      - Après M2 (Iron Rod 15/min, +Constructor)     : ~5  AP/min/machine, 2-3 machines → ~15-25 AP/min
//      - Après M5/M6 (Reinf. Plate, Miner Mk.3)       : usine multi-étages   → ~30-50 AP/min
//      - Après M7+ (Manufacturer, Cable 30/min)       : usine mature          → ~50-80 AP/min
// ---------------------------------------------------------------------------

/**
 * Coût en BOLTS pour poser UNE instance d'un bâtiment donné.
 * (Montants historiquement calibrés en « AP » — les valeurs restent identiques,
 * seule la monnaie de pose a changé : Bolts = argent des contrats.)
 *
 * Justifications (temps d'attente à débit AP du palier correspondant) :
 *
 *  - `miner-mk1`   = 10 AP : starter, couvert par le capital initial (bootstrap).
 *  - `smelter`     = 10 AP : starter, couvert par le capital initial (bootstrap).
 *  - `coal-generator` = 15 AP : starter "infra" (réseau électrique dès le début),
 *      légèrement plus cher car bâtiment de soutien (pas de production directe
 *      d'items comptés dans l'AP) ; couvert par le capital initial (35/50 AP).
 *      Sous-total 3 premières poses = 35 AP ≤ 50 AP (capital initial).
 *
 *  - `constructor` = 40 AP : débloqué à M1 (~2 min). À 10 AP/min (1 Smelter
 *      tournant), ≈ 4 min pour se l'offrir → tombe pile dans la fenêtre Hook
 *      (objectif "premier milestone ~5 min" du skill game-design : 2 min pour
 *      M1 + 4 min d'épargne ≈ 6 min, acceptable car le joueur peut accélérer en
 *      ajoutant un 2e Smelter entretemps).
 *
 *  - `miner-mk2`   = 120 AP : débloqué à M2 (~10 min cumulés). Avec 2-3 machines
 *      tournant (Smelter + Constructor), AP/min ≈ 15-20 → ≈ 6-8 min d'épargne.
 *      Gate de capacité valorisée (×2 extraction) : coût "premium" volontaire.
 *
 *  - `assembler`   = 150 AP : débloqué à M3 (~15 min cumulés). Même palier
 *      d'AP/min (~15-20) → ≈ 8-10 min d'épargne. Le saut vers les recettes
 *      2-ingrédients justifie un coût similaire au Miner Mk.2.
 *
 *  - `foundry`     = 250 AP : débloqué à M5 (~15 min après M4, usine plus
 *      large). AP/min ≈ 30-40 (3-4 machines) → ≈ 6-8 min d'épargne. Ouvre les
 *      alliages (Steel) — bâtiment "porte d'entrée" d'une nouvelle branche.
 *
 *  - `miner-mk3`   = 400 AP : débloqué à M6 (~17 min après M5). AP/min ≈ 30-40
 *      → ≈ 10-13 min d'épargne. Deuxième gate de capacité (×4 extraction),
 *      coût premium cohérent avec Miner Mk.2 (×3.3 le coût pour ×2 le saut
 *      d'extraction relatif : Mk.2→Mk.3 double encore la capacité de Mk.2).
 *
 *  - `manufacturer` = 500 AP : débloqué à M7 (~10 min après M6). Usine mature,
 *      AP/min ≈ 50-80 (multi-branches) → ≈ 6-10 min d'épargne. Bâtiment 4
 *      entrées = pivot vers les produits complexes (Hobby).
 *
 *  - `refinery`    = 600 AP : pas encore gaté par un milestone dédié (réservé
 *      pour une future branche pétrole/plastique) ; calé légèrement au-dessus
 *      du Manufacturer (consommation 30 MW, la plus élevée après Manufacturer
 *      55 MW) → ≈ 8-12 min d'épargne au palier M7+.
 *
 *  - `splitter` / `merger` = 5 AP : bâtiments logistiques passifs (0 MW,
 *      0 production), coût symbolique pour éviter le spam gratuit sans freiner
 *      le joueur — accessible dès le bootstrap (5 AP << 50 AP initiaux).
 *
 * [À VALIDER avec l'humain : montants exacts ±20 % possibles sans casser la
 *  cohérence des paliers tant que l'ordre relatif est préservé.]
 */
/**
 * Capital initial de Bolts au démarrage (don de bienvenue, hors contrats).
 * Couvre exactement les 3 premières poses (miner-mk1 + smelter + coal-generator =
 * 10 + 10 + 15 = 35 Bolts), avec 15 de marge — cf. justification ci-dessus.
 * Les montants de BUILDING_COSTS sont désormais exprimés en BOLTS (pose = argent,
 * RP = savoir → arbre de connaissances).
 */
export const STARTING_BOLTS = 50;

/** Points de Recherche au démarrage : zéro — le premier flux vient de la production. */
export const STARTING_RP = 0;

// ---------------------------------------------------------------------------
// 3quater. RÉSERVE DE CHARBON INITIALE — levier #1 « le premier flux est visible »
//
//    PROBLÈME : le Coal Generator ne produit du courant QUE s'il reçoit du charbon
//    via une belt `in-coal` (cf. CLAUDE.md, "pas de charbon, pas de courant"). Sans
//    réserve initiale, la chaîne fer (Miner → Smelter) reste à l'arrêt tant que le
//    joueur n'a pas câblé : Miner-coal → Coal Generator → câbles d'alimentation
//    → Miner-fer/Smelter. Cela ajoute ~4 étapes avant le premier flux visible.
//
//    SOLUTION : le Coal Generator démarre avec une petite réserve de charbon déjà
//    "dans la trémie" (consommée par la physique réelle — cf. src/graph — au même
//    rythme que le charbon livré par belt). Le temps que cette réserve s'épuise,
//    le réseau électrique est `powered`, donc Miner-fer + Smelter tournent et
//    produisent un flux d'Iron Ingot VISIBLE pendant que le joueur câble la boucle
//    charbon en parallèle.
//
//    CALCUL : recette `coal-generator-power` = 1 coal / 2s → 1*60/2 = 30 coal/min
//    par générateur (1 instance, niveau 0, machineSpeedMult = 1).
//    Cible : couvrir 1 à 2 minutes de consommation à débit nominal.
//      - 1 min  → 30 coal
//      - 2 min  → 60 coal
//    On retient le HAUT de la fourchette (2 min) : assez long pour que le joueur
//    ait le temps de poser ET câbler Miner-coal + Coal Generator sans paniquer
//    (le tutoriel guide ~4 étapes électriques), mais pas assez pour qu'il oublie
//    la dépendance au charbon — la réserve s'épuise visiblement si la boucle
//    charbon n'est pas câblée à temps (coupure de courant = signal pédagogique,
//    pas une punition : le joueur a déjà vu 2 min de production).
//
//    [À VALIDER avec l'humain : 60 = 2 min. Si le tutoriel guide plus vite que
//     prévu, 30 (1 min) suffirait et laisserait moins de "filet de sécurité".]
// ---------------------------------------------------------------------------

/** Débit de consommation du Coal Generator à débit nominal (1 machine, niveau 0), en coal/min. */
export const COAL_GENERATOR_CONSUMPTION_PER_MIN = 30; // 1 coal / 2s (recette coal-generator-power)

/** Durée visée de couverture de la réserve initiale, en minutes (haut de la fourchette 1-2 min). */
export const STARTING_COAL_RESERVE_MINUTES = 2;

/**
 * Réserve de charbon initiale du Coal Generator (unités), déjà "dans la trémie" au
 * démarrage. Consommée par la physique réelle (src/graph) au même rythme que le
 * charbon livré par belt — fournie ici comme donnée de départ, pas comme un bonus
 * de production fictif (le débit de consommation reste 30 coal/min, inchangé).
 *
 * 30 coal/min × 2 min = 60 coal.
 */
export const STARTING_COAL_RESERVE = COAL_GENERATOR_CONSUMPTION_PER_MIN * STARTING_COAL_RESERVE_MINUTES; // 60

export const BUILDING_COSTS: Record<string, number> = {
  'miner-mk1': 10,
  'miner-mk2': 120,
  'miner-mk3': 400,
  smelter: 10,
  foundry: 250,
  constructor: 40,
  assembler: 150,
  manufacturer: 500,
  refinery: 600,
  'coal-generator': 15,
  splitter: 5,
  merger: 5,
  // `power-pole` = 5 AP : hub de dispatch électrique passif (0 MW), même tarif que les hubs
  // logistiques (splitter/merger) — accessible dès le bootstrap (réseau électrique actif
  // dès le début, cf. coal-generator).
  'power-pole': 5,
};

// ---------------------------------------------------------------------------
// 3ter. AMÉLIORATIONS PAR MACHINE (Bolts) — design progression v2
//    coût(type, N) = 2.5 × coût_de_pose × 1.6^N  (ratio agressif : l'amélioration
//    est PAR NODE — un ratio doux inciterait à tout maxer sans réfléchir).
//    L'effet (+10 % cadence/niveau, MW qui suivent) vit dans src/graph/nodeInfo.ts
//    (machineSpeedMult) : c'est de la physique d'usine, le jeu n'en fixe que le prix.
// ---------------------------------------------------------------------------

export const MACHINE_UPGRADE_COST_RATIO = 1.6;
export const MACHINE_UPGRADE_COST_BASE_MULT = 2.5;

/**
 * Coût en Bolts du passage du niveau `level` au niveau `level + 1` pour une machine
 * du bâtiment donné. 0 si le bâtiment n'a pas de coût de pose (rien à améliorer).
 * Ex. Smelter (pose 10) : 25 → 40 → 64. Manufacturer (pose 500) : 1250 → 2000 → 3200.
 */
export function machineUpgradeCost(buildingId: string, level: number): number {
  const base = BUILDING_COSTS[buildingId] ?? 0;
  if (base <= 0 || level < 0) return 0;
  return Math.round(MACHINE_UPGRADE_COST_BASE_MULT * base * Math.pow(MACHINE_UPGRADE_COST_RATIO, level));
}

// ---------------------------------------------------------------------------
// 4. MILESTONES DE PRODUCTION — 10 paliers
//    Conçus pour le FEEL : Hook rapide, deux gates de capacité (Miner Mk.2 / Mk.3),
//    interleave bâtiments / recettes-alternatives.
//
//    HYPOTHÈSE DE TAUX EFFECTIF : le joueur utilise l'assistance LP (compléter),
//    qui dimensionne typiquement 2-4 machines. Le temps indiqué est calculé au
//    taux nominal d'UNE machine (borne supérieure conservative).
//
//    DÉBITS DE RÉFÉRENCE (1 machine) :
//      Iron Ingot    30/min   Iron Rod     15/min   Iron Plate   20/min
//      Screw         40/min   Reinf. Plate  5/min   Wire         30/min
//      Cable         30/min   Concrete     15/min   Modular Frame 2/min
//
//    PROGRESSION HOOK → HABIT → HOBBY :
//      MICRO-MILESTONES (avant M1) : feedback à 2s/20s/60s dans les 2 premières
//                       minutes — cf. EARLY_PRODUCTION_MICRO_MILESTONES ci-dessous.
//      M1  (2 min)   : victoire immédiate en session de découverte (Hook).
//      M2  (4 min)   : gate Miner Mk.2 — 2e grande récompense rapprochée (était 10 min,
//                       rééquilibré 2026-06-14 — cf. justification sous la table).
//      M3-M5         : 10-15 min chacun — une session de jeu détendue (Habit early).
//      M6  (17 min)  : gate Miner Mk.3 — deuxième saut de capacité, récompense la persévérance.
//      M7-M9         : 10-25 min chacun — rythme quotidien (Habit late).
//      M10 (75 min)  : horizon long terme ; prestige débloqué pour le joueur expert (Hobby).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3quinquies. MICRO-MILESTONES SOUS M1 — levier #2 « densifier le hook »
//
//    PROBLÈME : entre le premier démarrage et M1 (60 Iron Ingot @ 30/min = 2 min),
//    il n'existe AUCUNE récompense intermédiaire → ~125s de "vide" perçu (le joueur
//    regarde la barre de progression de M1 monter sans signal positif).
//
//    SOLUTION : seuils de LECTURE sur `cumulativeProduced['iron-ingot']` (la même
//    donnée que M1, pas une nouvelle monnaie). L'UI peut afficher un toast/badge
//    "Premier lingot !" / "10 lingots produits" dès que le seuil est franchi —
//    AVANT que M1 (60) ne soit atteint.
//
//    CADENCE (débit nominal 30/min = 1 ingot / 2s, 1 Smelter) :
//      - 1er lingot   : 1  / 30 =  2s   → confirmation immédiate "ça marche"
//      - 10 lingots   : 10 / 30 = 20s   → 1ère traction régulière
//      - 30 lingots   : 30 / 30 = 60s   → mi-parcours vers M1, "à mi-chemin"
//      - M1 (60)      : 60 / 30 = 120s  → grande récompense (déblocage Constructor)
//
//    Espacements : 2s → 20s (18s) → 60s (40s) → 120s (60s). Les 2 premiers seuils
//    tombent dans la fenêtre "feedback toutes les 10-30s" du skill game-design ; les
//    seuils suivants s'espacent naturellement car l'anticipation de M1 (déblocage
//    de bâtiment, récompense plus "lourde") tolère un intervalle plus long.
//
//    Avec 2 machines en parallèle (joueur qui pose un 2e Smelter tôt), tous ces
//    seuils sont atteints en ~moitié du temps — cohérent avec le reste de la table.
// ---------------------------------------------------------------------------

export interface ProductionMicroMilestone {
  /** Identifiant unique (UI : clé de toast/badge). */
  id: string;
  /** Item suivi — même clé que `cumulativeProduced` et que M1 (iron-ingot). */
  itemId: string;
  /** Quantité cumulée à atteindre. */
  target: number;
  /** Libellé court affichable (FR). */
  label: string;
  /** Justification : temps à débit nominal (1 machine), en secondes. */
  estimatedSecondsNominal: number;
}

/**
 * Micro-milestones sous M1 (ms-iron-ingot-60) — seuils de LECTURE sur la production
 * cumulée d'Iron Ingot, déjà accumulée pour M1. Pas de monnaie/état supplémentaire :
 * l'UI compare `cumulativeProduced['iron-ingot']` à ces `target` pour déclencher un
 * toast, en plus (et avant) du milestone M1 lui-même.
 *
 * Débit de référence : Iron Ingot 30/min (1 Smelter, 1*60/2) → 1 ingot / 2s.
 */
export const EARLY_PRODUCTION_MICRO_MILESTONES: ProductionMicroMilestone[] = [
  {
    id: 'micro-first-ingot',
    itemId: 'iron-ingot',
    target: 1,
    label: 'Premiers tokens produits !',
    // 1 / 30 × 60 = 2s.
    estimatedSecondsNominal: 2,
  },
  {
    id: 'micro-ten-ingots',
    itemId: 'iron-ingot',
    target: 10,
    label: '10 tokens nettoyés',
    // 10 / 30 × 60 = 20s.
    estimatedSecondsNominal: 20,
  },
  {
    id: 'micro-thirty-ingots',
    itemId: 'iron-ingot',
    target: 30,
    label: 'Mi-parcours vers le premier déblocage (30 tokens)',
    // 30 / 30 × 60 = 60s.
    estimatedSecondsNominal: 60,
  },
];

export interface MilestoneDefinition {
  /** Identifiant unique du milestone. */
  id: string;
  /** Item suivi (doit exister dans items.json). */
  itemId: string;
  /** Quantité cumulée à atteindre pour déclencher le milestone. */
  target: number;
  /**
   * Ce qui est débloqué à l'atteinte.
   * buildingId : rend visible le bâtiment dans la palette (filtre UI).
   * recipeId   : active une recette alternative dans le LP.
   * hint       : juste un message/notification (prestige, etc.).
   */
  unlocks: { type: 'building' | 'recipe' | 'hint'; id: string };
  /**
   * Justification humaine : durée estimée en minutes à débit nominal (1 machine).
   * Calcul : target / ratePerMin(1 machine).
   * Le joueur avec 2 machines atteint le seuil en ~moitié du temps.
   */
  estimatedMinutesNominal: number;
}

/**
 * Table des 13 milestones — économie NodeFactory v1 (M1-M10) + paliers 2/3 (M11-M13).
 *
 * Chaque valeur est vérifiée à la main :
 *   M1  : 60  / 30/min = 2.0 min  → unlock constructor (Hook)
 *   M2  : 60  / 15/min = 4.0 min  → unlock miner-mk2  (Gate capacité ×2)
 *      [rééquilibré 2026-06-14, était 150/10.0min — cf. justification ci-dessous]
 *   M3  : 300 / 20/min = 15.0 min → unlock assembler
 *   M4  : 400 / 40/min = 10.0 min → unlock alt-cast-screw
 *   M5  : 75  /  5/min = 15.0 min → unlock foundry
 *   M6  : 500 / 30/min = 16.7 min → unlock miner-mk3  (Gate capacité ×4)
 *   M7  : 300 / 30/min = 10.0 min → unlock manufacturer
 *   M8  : 375 / 15/min = 25.0 min → unlock alt-bolted-iron-plate
 *   M9  : 50  /  2/min = 25.0 min → unlock alt-iron-wire
 *   M10 : 150 /  2/min = 75.0 min → hint prestige-available
 *   M11 : 200 / 10/min = 20.0 min → unlock alt-steel-cast      (Hobby, branche acier)
 *   M12 : 75  /7.5/min = 10.0 min → unlock alt-fused-circuit   (Hobby, branche électronique)
 *   M13 : 50  /  5/min = 10.0 min → unlock alt-automated-motor (Hobby, optimisation max)
 */
export const MILESTONES: MilestoneDefinition[] = [
  {
    id: 'ms-iron-ingot-60',
    itemId: 'iron-ingot',
    target: 60,
    unlocks: { type: 'building', id: 'constructor' },
    // 60 / 30 = 2.0 min à débit nominal (1 Smelter). Victoire rapide pour la session Hook.
    estimatedMinutesNominal: 2.0,
  },
  {
    id: 'ms-iron-rod-60',
    itemId: 'iron-rod',
    target: 60,
    unlocks: { type: 'building', id: 'miner-mk2' },
    // 60 / 15 = 4.0 min (1 Constructor). Gate de capacité : Miner Mk.2 double l'extraction.
    // Rééquilibré 2026-06-14 (était 150 / 10.0 min) : la 2e grande récompense doit
    // tomber à ~3-4 min après M1 (2 min), pas à 10 min — cf. doc de design
    // 2026-06-14-early-game-hook.md pour la justification complète.
    estimatedMinutesNominal: 4.0,
  },
  {
    id: 'ms-iron-plate-300',
    itemId: 'iron-plate',
    target: 300,
    unlocks: { type: 'building', id: 'assembler' },
    // 300 / 20 = 15.0 min (1 Constructor). L'Assembler ouvre les recettes à 2 ingrédients.
    estimatedMinutesNominal: 15.0,
  },
  {
    id: 'ms-screw-400',
    itemId: 'screw',
    target: 400,
    unlocks: { type: 'recipe', id: 'alt-cast-screw' },
    // 400 / 40 = 10.0 min (1 Constructor). Première alternative — raccourci industriel.
    estimatedMinutesNominal: 10.0,
  },
  {
    id: 'ms-reinforced-iron-plate-75',
    itemId: 'reinforced-iron-plate',
    target: 75,
    unlocks: { type: 'building', id: 'foundry' },
    // 75 / 5 = 15.0 min (1 Assembler). La Foundry ouvre les alliages (recettes 2-ingrédients fonderie).
    estimatedMinutesNominal: 15.0,
  },
  {
    id: 'ms-wire-500',
    itemId: 'wire',
    target: 500,
    unlocks: { type: 'building', id: 'miner-mk3' },
    // 500 / 30 ≈ 16.7 min (1 Constructor). Gate de capacité : Miner Mk.3 ×4 l'extraction.
    estimatedMinutesNominal: 16.7,
  },
  {
    id: 'ms-cable-300',
    itemId: 'cable',
    target: 300,
    unlocks: { type: 'building', id: 'manufacturer' },
    // 300 / 30 = 10.0 min (1 Constructor). Le Manufacturer débloque les produits complexes.
    estimatedMinutesNominal: 10.0,
  },
  {
    id: 'ms-concrete-375',
    itemId: 'concrete',
    target: 375,
    unlocks: { type: 'recipe', id: 'alt-bolted-iron-plate' },
    // 375 / 15 = 25.0 min (1 Constructor). Alternative à haut débit pour Reinforced Iron Plate.
    estimatedMinutesNominal: 25.0,
  },
  {
    id: 'ms-modular-frame-50',
    itemId: 'modular-frame',
    target: 50,
    unlocks: { type: 'recipe', id: 'alt-iron-wire' },
    // 50 / 2 = 25.0 min (1 Assembler). Iron Wire : raccourci lingot→fil sans Copper.
    estimatedMinutesNominal: 25.0,
  },
  {
    id: 'ms-modular-frame-150',
    itemId: 'modular-frame',
    target: 150,
    unlocks: { type: 'hint', id: 'prestige-available' },
    // 150 / 2 = 75.0 min (1 Assembler). Horizon Hobby — prestige débloqué pour l'expert.
    estimatedMinutesNominal: 75.0,
  },
  // --- Paliers 2/3 (économie maison v1, spec 2026-06-10 §7) : les 3 alts avancées
  //     sont gatées par la production de l'item qu'elles raccourcissent. Phase Hobby.
  {
    id: 'ms-steel-200',
    itemId: 'steel',
    target: 200,
    unlocks: { type: 'recipe', id: 'alt-steel-cast' },
    // 200 / 10 (Foundry : 1*60/6 = 10/min) = 20.0 min. Récompense la branche acier.
    estimatedMinutesNominal: 20.0,
  },
  {
    id: 'ms-circuit-board-75',
    itemId: 'circuit-board',
    target: 75,
    unlocks: { type: 'recipe', id: 'alt-fused-circuit' },
    // 75 / 7.5 (Assembler : 1*60/8 = 7.5/min) = 10.0 min. Récompense la branche électronique.
    estimatedMinutesNominal: 10.0,
  },
  {
    id: 'ms-motor-50',
    itemId: 'motor',
    target: 50,
    unlocks: { type: 'recipe', id: 'alt-automated-motor' },
    // 50 / 5 (Assembler : 1*60/12 = 5/min) = 10.0 min. Défi d'optimisation max (Hobby).
    estimatedMinutesNominal: 10.0,
  },
];

// ---------------------------------------------------------------------------
// 5. LOGIQUE DE MILESTONE — vérification et application
// ---------------------------------------------------------------------------

/**
 * Vérifie si un milestone est atteint pour un état de production donné.
 *
 * @param milestone           Définition du milestone à vérifier.
 * @param cumulativeProduced  Map item → quantité cumulée produite depuis le début.
 */
export function isMilestoneReached(
  milestone: MilestoneDefinition,
  cumulativeProduced: Map<string, number>,
): boolean {
  const produced = cumulativeProduced.get(milestone.itemId) ?? 0;
  return produced >= milestone.target;
}

/**
 * Retourne les milestones nouvellement atteints (non encore marqués `reached`)
 * selon l'état de production courant.
 *
 * Idempotent : si called deux fois avec le même état, renvoie un tableau vide
 * la deuxième fois grâce à l'ensemble `alreadyReached`.
 *
 * @param milestones      Liste complète des milestones (dans l'ordre).
 * @param alreadyReached  Ensemble des id de milestones déjà déclenchés.
 * @param produced        Map item → quantité cumulée produite.
 * @returns Liste des milestones nouvellement franchis (dans l'ordre).
 */
export function checkNewlyReachedMilestones(
  milestones: MilestoneDefinition[],
  alreadyReached: Set<string>,
  produced: Map<string, number>,
): MilestoneDefinition[] {
  return milestones.filter(
    (m) => !alreadyReached.has(m.id) && isMilestoneReached(m, produced),
  );
}

// ---------------------------------------------------------------------------
// 6. SCORE D'EFFICACITÉ
//    Basé sur les 3 objectifs LP (ressources brutes / machines / énergie).
//    Score normalisé : 1.0 = solution LP parfaite sur cet objectif.
//    Score < 1.0 impossible (optima LP ≤ solution réelle par définition).
//    Score > 1.0 = usine sous-optimale ; 1.0 = optimum absolu.
//
//    CONVENTION : score exprimé en "ratio optimal/actuel" → 1.0 = parfait,
//    valeur proche de 0 = très mauvais.
// ---------------------------------------------------------------------------

export interface EfficiencyDimension {
  /** Valeur réelle mesurée dans l'usine courante. */
  actual: number;
  /** Valeur optimale calculée par le LP (objectif min sur cette dimension). */
  optimal: number;
  /**
   * Score normalisé : optimal / actual, clampé à [0, 1].
   * 1.0 = parfait (usine = optimal LP).
   * < 1.0 = sous-optimal (plus de ressources/machines/énergie que nécessaire).
   */
  score: number;
}

export interface EfficiencyScore {
  resources: EfficiencyDimension;
  machines: EfficiencyDimension;
  energy: EfficiencyDimension;
  /**
   * Score global pondéré : 40 % ressources + 35 % machines + 25 % énergie.
   * Pondération justifiée : les ressources brutes sont l'objectif LP par défaut
   * (priorité du joueur débutant) ; les machines viennent ensuite (empreinte) ;
   * l'énergie est importante mais secondaire pour le MVP.
   * [À VALIDER avec l'humain : pondérations 40/35/25.]
   */
  global: number;
}

/** Pondérations du score global. Doivent sommer à 1.0. */
export const EFFICIENCY_WEIGHTS = {
  resources: 0.4,
  machines: 0.35,
  energy: 0.25,
} as const;

/**
 * Calcule le score d'efficacité pour une usine donnée.
 *
 * @param actualRawRate     Débit total de ressources brutes importées (items/min).
 * @param optimalRawRate    Débit minimal calculé par LP (objectif min raw-resources).
 * @param actualMachines    Nombre total de machines dans l'usine.
 * @param optimalMachines   Nombre minimal de machines calculé par LP (objectif min machines).
 * @param actualEnergyMW    Puissance totale consommée (MW).
 * @param optimalEnergyMW   Puissance minimale calculée par LP (objectif min energy).
 */
export function computeEfficiencyScore(
  actualRawRate: number,
  optimalRawRate: number,
  actualMachines: number,
  optimalMachines: number,
  actualEnergyMW: number,
  optimalEnergyMW: number,
): EfficiencyScore {
  const dim = (actual: number, optimal: number): EfficiencyDimension => {
    if (actual <= 0 && optimal <= 0) {
      return { actual, optimal, score: 1.0 };
    }
    if (actual <= 0) {
      // Optimal > 0 mais actual ≤ 0 : usine vide ou non résolue → score 0.
      return { actual, optimal, score: 0 };
    }
    // score = optimal/actual (≤ 1.0 car LP optimal ≤ solution réelle).
    // On clampe à [0, 1] par précaution numérique.
    const score = Math.min(1, Math.max(0, optimal / actual));
    return { actual, optimal, score };
  };

  const resources = dim(actualRawRate, optimalRawRate);
  const machines = dim(actualMachines, optimalMachines);
  const energy = dim(actualEnergyMW, optimalEnergyMW);

  const global =
    resources.score * EFFICIENCY_WEIGHTS.resources +
    machines.score * EFFICIENCY_WEIGHTS.machines +
    energy.score * EFFICIENCY_WEIGHTS.energy;

  return { resources, machines, energy, global };
}

// ---------------------------------------------------------------------------
// 6bis. SCORE EN 2 TEMPS — levier #5 (partie chiffrée)
//
//    PROBLÈME : afficher le panneau de score complet (3 dimensions LP) dès le
//    début est prématuré — avec 1 seule machine (Smelter), il n'y a AUCUN choix
//    structurel possible : l'usine EST l'optimum (score toujours 1.0 sur les 3
//    dimensions, cf. evaluateEfficiency). Le panneau serait "vrai" mais vide de
//    sens : rien à optimiser, rien à apprendre.
//
//    SOLUTION : gating sur un milestone. Le panneau de score complet (3 jauges +
//    score global) ne s'affiche qu'à partir de SCORE_PANEL_UNLOCK_MILESTONE_ID.
//
//    CHOIX : M2 (ms-iron-rod-60, ~4 min), pas M1.
//      - À M1 (Constructor débloqué, ~2 min) : le joueur vient JUSTE de poser son
//        2e type de machine. L'usine a encore 1 seule "route" possible (Smelter
//        → ... rien d'autre encore) : le score serait 1.0 partout, sans variation
//        possible → pas instructif, et révéler un "1.0/1.0/1.0" comme toute
//        première impression du score banalise la mécanique différenciatrice.
//      - À M2 (Miner Mk.2 débloqué, ~4 min) : le joueur a au moins Smelter +
//        Constructor (Iron Rod) posés, ET un choix de capacité d'extraction
//        (Mk.1 vs Mk.2) vient de s'ouvrir → la première vraie occasion où
//        "construire plus" ≠ "construire mieux". Le score devient pédagogique :
//        le joueur peut voir l'effet d'un sur-dimensionnement.
//
//    Avant M2, le badge qualitatif PAR MACHINE (levier #5, partie UI) peut déjà
//    être affiché — il est dérivé de la même formule (`computeEfficiencyScore`)
//    mais lu localement par machine, ce qui reste informatif même tôt (ex. "ce
//    Smelter est sur-alimenté"). Seul le PANNEAU GLOBAL (3 jauges + score
//    pondéré) attend M2.
//
//    [À VALIDER avec l'humain : M2 vs M1 — si le playtest montre que les joueurs
//     cherchent le score dès M1 par curiosité, on peut avancer le seuil à M1 sans
//     casser la logique (le score affichera juste 1.0/1.0/1.0, ce qui reste vrai).]
// ---------------------------------------------------------------------------

/**
 * Id du milestone à partir duquel le panneau de score d'efficacité COMPLET
 * (3 dimensions + score global) devient visible dans l'UI. Avant ce milestone,
 * seul le badge qualitatif par machine (cf. EFFICIENCY_BADGE_THRESHOLDS) peut
 * être affiché, le cas échéant.
 */
export const SCORE_PANEL_UNLOCK_MILESTONE_ID = 'ms-iron-rod-60'; // M2, ~4 min

// ---------------------------------------------------------------------------
// 6ter. BADGE QUALITATIF PAR MACHINE — levier #5 (lecture locale du score)
//
//    Dérivé du même `score` par dimension que computeEfficiencyScore (∈ [0,1],
//    1.0 = optimal). Pour une machine individuelle, le score le plus pertinent
//    en early game est la dimension RESSOURCES (ai-je le bon ratio d'intrants
//    pour ma sortie ?) — c'est la dimension la plus visible/actionnable pour un
//    débutant (les dimensions machines/énergie demandent une vue d'ensemble).
//
//    SEUILS (mêmes graduations que le score global, qualitatives) :
//      - score ≥ 0.9        → "Optimal"        (au plus 10 % de surcoût vs LP)
//      - 0.6 ≤ score < 0.9  → "Correct"         (marge de manœuvre, pas critique)
//      - score < 0.6        → "Peut mieux faire" (sur-dimensionnement net : ex.
//                              2 machines pour produire ce qu'1 suffirait)
//
//    Justification du seuil 0.9 : un ratio d'intrants à ±10 % de l'optimum LP est
//    le bruit normal d'un dimensionnement entier (on ne peut pas poser "1.3
//    machine") — pénaliser sous ce seuil créerait un badge "Peut mieux faire"
//    permanent même pour une usine raisonnable, ce qui serait décourageant
//    (faux négatif). Le seuil 0.6 isole les cas de sur-dimensionnement flagrant
//    (≥ 40 % de surcoût), seuils alignés sur PRESTIGE_MIN_EFFICIENCY (0.75) qui
//    se situe entre les deux — cohérence : "Correct" est le palier normal pour
//    progresser vers le prestige, "Optimal" le dépasse confortablement.
// ---------------------------------------------------------------------------

export const EFFICIENCY_BADGE_THRESHOLDS = {
  optimal: 0.9,
  correct: 0.6,
} as const;

export type EfficiencyBadge = 'optimal' | 'correct' | 'needs-improvement';

/**
 * Convertit un score de dimension (∈ [0,1], 1.0 = optimal) en badge qualitatif
 * pour affichage par machine.
 */
export function efficiencyBadgeForScore(score: number): EfficiencyBadge {
  if (score >= EFFICIENCY_BADGE_THRESHOLDS.optimal) return 'optimal';
  if (score >= EFFICIENCY_BADGE_THRESHOLDS.correct) return 'correct';
  return 'needs-improvement';
}

// ---------------------------------------------------------------------------
// 7. PRESTIGE — base seulement, marqué DIFFÉRÉ
//    [À VALIDER : ne pas implémenter avant que les systèmes 1-5 soient solides.]
// ---------------------------------------------------------------------------

/**
 * Multiplicateur permanent par prestige (empilable, jamais perdu).
 * mult(N) = BASE_PRESTIGE_MULT^N
 * [À VALIDER avec l'humain : ratio 1.5 est une proposition conservative.]
 */
export const BASE_PRESTIGE_MULT = 1.5;

/**
 * Score d'efficacité global minimum pour que le prestige soit "rentable".
 * En-dessous de ce seuil, le prestige n'est pas proposé dans l'UI.
 * Inspiré de Reactor Incremental (51 exotic particles minimum).
 * [À VALIDER : 0.75 = 75 % d'efficacité globale comme seuil d'entrée.]
 */
export const PRESTIGE_MIN_EFFICIENCY = 0.75;

/**
 * Seuil de score d'efficacité global minimum pour débloquer le prestige.
 * Renvoie true si le prestige peut être proposé.
 *
 * @param globalScore Score global [0, 1] retourné par computeEfficiencyScore.
 */
export function isPrestigeAvailable(globalScore: number): boolean {
  return globalScore >= PRESTIGE_MIN_EFFICIENCY;
}

/**
 * Calcule le multiplicateur d'AP après N prestiges.
 * mult(0) = 1.0 (aucun prestige)
 * mult(N) = BASE_PRESTIGE_MULT^N
 *
 * @param prestigeCount  Nombre de prestiges effectués (≥ 0).
 */
export function prestigeMultiplier(prestigeCount: number): number {
  if (prestigeCount < 0) throw new RangeError('prestigeCount must be >= 0');
  if (prestigeCount === 0) return 1.0;
  return Math.pow(BASE_PRESTIGE_MULT, prestigeCount);
}
