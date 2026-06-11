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
// 1. MONNAIE MÉTA — "Automation Points" (AP)
//    [À VALIDER avec l'humain : le nom, et AP_RATE_PER_ITEM_PER_MIN]
// ---------------------------------------------------------------------------

/**
 * Taux de base de génération d'Automation Points (AP) par item/min de débit.
 *
 * Calibration : une usine à 30 Reinforced Iron Plates/min (Assembler × 6, efficacité 1.0)
 * génère 30 * 1.0 * AP_RATE_PER_ITEM_PER_MIN = ~10 AP/min (confortable pour la phase Habit).
 * → AP_RATE_PER_ITEM_PER_MIN = 10 / 30 ≈ 0.333
 *
 * [À VALIDER : ratio 0.333 est une proposition — peut être ajusté ±50 % sans casser les tests
 *  tant que la formule reste cohérente.]
 */
export const AP_RATE_PER_ITEM_PER_MIN = 1 / 3;

/**
 * Calcule le taux de génération d'AP/min pour une usine donnée.
 *
 * @param totalItemsPerMin  Débit total de production de tous les items (sum des outputs finaux),
 *                          en items/min. NE PAS inclure les intermédiaires pour éviter le double-
 *                          comptage — seuls les "flux de sortie" de l'usine comptent.
 * @param efficiency        Efficacité globale de l'usine, entre 0 et 1.
 *                          1.0 = toutes les machines à 100 % ; 0 = usine à l'arrêt.
 * @returns AP/min générés (≥ 0).
 */
export function computeApRate(totalItemsPerMin: number, efficiency: number): number {
  if (totalItemsPerMin <= 0 || efficiency <= 0) return 0;
  const clampedEfficiency = Math.min(1, Math.max(0, efficiency));
  return totalItemsPerMin * clampedEfficiency * AP_RATE_PER_ITEM_PER_MIN;
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
 * Calcule les AP gagnés en delta-time depuis `lastSeenMs` jusqu'à `nowMs`.
 * Plafonne à LONG_CLOCK_CAP_MIN de production.
 * Résultat ≥ 0 même si l'horloge système recule (garde-fou).
 *
 * @param apPerMin          Taux AP/min au moment de la déconnexion.
 * @param lastSeenMs        Timestamp (Date.now()) du dernier instant actif.
 * @param nowMs             Timestamp actuel.
 */
export function computeOfflineGains(
  apPerMin: number,
  lastSeenMs: number,
  nowMs: number,
): number {
  if (apPerMin <= 0) return 0;
  const elapsedMs = Math.max(0, nowMs - lastSeenMs);
  const cappedMs = Math.min(elapsedMs, LONG_CLOCK_CAP_MS);
  const elapsedMin = cappedMs / 60_000;
  return apPerMin * elapsedMin;
}

/**
 * Seuils d'affichage de la popup récap offline à la reconnexion.
 * En-dessous, on crédite silencieusement : un simple reload d'onglet (quelques
 * secondes) ne doit JAMAIS interrompre le joueur avec une modale.
 * [À VALIDER : 1 min / 1 AP — volontairement bas, la popup est une récompense.]
 */
export const OFFLINE_RECAP_MIN_MINUTES = 1;
export const OFFLINE_RECAP_MIN_AP = 1;

/**
 * La popup récap offline doit-elle être affichée pour ces gains ?
 *
 * @param apGained         AP crédités pour la période hors-ligne.
 * @param minutesCredited  Durée hors-ligne créditée (déjà plafonnée), en minutes.
 */
export function shouldShowOfflineRecap(apGained: number, minutesCredited: number): boolean {
  return apGained >= OFFLINE_RECAP_MIN_AP && minutesCredited >= OFFLINE_RECAP_MIN_MINUTES;
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
 * Coût en AP pour poser UNE instance d'un bâtiment donné.
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
 * Capital initial d'AP au démarrage (don de bienvenue, hors production).
 * Couvre exactement les 3 premières poses (miner-mk1 + smelter + coal-generator =
 * 10 + 10 + 15 = 35 AP), avec 15 AP de marge — cf. justification ci-dessus.
 */
export const STARTING_AP = 50;

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
//      M1  (2 min)   : victoire immédiate en session de découverte (Hook).
//      M2  (10 min)  : gate Miner Mk.2 — premier saut de capacité satisfaisant.
//      M3-M5         : 10-15 min chacun — une session de jeu détendue (Habit early).
//      M6  (17 min)  : gate Miner Mk.3 — deuxième saut de capacité, récompense la persévérance.
//      M7-M9         : 10-25 min chacun — rythme quotidien (Habit late).
//      M10 (75 min)  : horizon long terme ; prestige débloqué pour le joueur expert (Hobby).
// ---------------------------------------------------------------------------

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
 *   M2  : 150 / 15/min = 10.0 min → unlock miner-mk2  (Gate capacité ×2)
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
    id: 'ms-iron-rod-150',
    itemId: 'iron-rod',
    target: 150,
    unlocks: { type: 'building', id: 'miner-mk2' },
    // 150 / 15 = 10.0 min (1 Constructor). Gate de capacité : Miner Mk.2 double l'extraction.
    estimatedMinutesNominal: 10.0,
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
