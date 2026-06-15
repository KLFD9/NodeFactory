/**
 * tycoon.ts — La couche méta « startup IA » (Game Dev Tycoon → labo ML), logique PURE.
 *
 * C'est « LE BUREAU » du jeu : par-dessus la salle des machines (l'usine idle qui produit
 * du COMPUTE et des DATASETS), le joueur lance un PROJET DE MODÈLE, répartit son effort sur
 * les phases d'entraînement, laisse un RUN tourner (sa vitesse = le débit de compute de
 * l'usine), puis SHIPPE le modèle : benchmark + réception communauté → revenus, renommée, RP.
 *
 * Architecture (cf. Docs/design/2026-06-14-pivot-theme-startup-ia.md §4) :
 *   - Le RUN consomme le compute EN DÉBIT (Q6) : progression = compute accumulé / requis.
 *     Optimiser/agrandir l'usine accélère donc directement le méta-jeu.
 *   - La QUALITÉ du modèle est un AXE SÉPARÉ du score d'efficience LP (Q3). Elle dépend des
 *     INTRANTS du run : dosage des phases × volume de dataset × compute investi (+ recherche
 *     et staff plus tard, P2). L'efficience ne fait pas la qualité, elle la rend moins chère.
 *
 * DÉCOUPLAGE (comme contracts.ts / le solveur) : aucune dépendance React/store/GameData.
 * Module déterministe, testable en isolation. Les ids d'items référencés sont ceux du dataset
 * (le compute = item `electricity`, les datasets = items curatés produits par l'usine).
 *
 * [À VALIDER game-balance : tous les nombres ci-dessous sont un premier jet calibré sur la
 *  physique du dataset v1 (compute ≈ 30/min par Datacenter). Ils passeront par l'agent
 *  `game-balance` quand le feel de la boucle sera jugé en vrai.]
 */

// ---------------------------------------------------------------------------
// PRNG déterministe (mulberry32) — même graine ⇒ même tendance de marché.
// (Local au module pour rester indépendant, comme dans contracts.ts.)
// ---------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// 1. PHASES D'ENTRAÎNEMENT — l'équivalent des « sliders » de Game Dev Tycoon.
//    Le bon dosage DÉPEND du type de modèle ; un mauvais mix = modèle médiocre.
// ---------------------------------------------------------------------------

export type TrainingPhase = 'pretraining' | 'finetuning' | 'alignment' | 'evaluation';

export const TRAINING_PHASES: readonly TrainingPhase[] = [
  'pretraining',
  'finetuning',
  'alignment',
  'evaluation',
] as const;

/** Répartition de l'effort sur les 4 phases. Les valeurs doivent sommer à 1. */
export type PhaseAllocation = Record<TrainingPhase, number>;

/** Glose néophyte d'une phase (règle « vocabulaire authentique mais accessible »). */
export const PHASE_INFO: Record<TrainingPhase, { name: string; blurb: string }> = {
  pretraining: {
    name: 'Pré-entraînement',
    blurb: 'Le modèle apprend les bases sur d’énormes volumes de données. Cher, mais fondateur.',
  },
  finetuning: {
    name: 'Fine-tuning',
    blurb: 'Spécialise un modèle généraliste sur ta tâche — bien moins cher que repartir de zéro.',
  },
  alignment: {
    name: 'Alignement',
    blurb: 'Rend le modèle utile et sûr (suit les consignes, évite les dérapages).',
  },
  evaluation: {
    name: 'Évaluation',
    blurb: 'Teste et red-team le modèle. Trop peu = défauts (hallucinations, biais) à la sortie.',
  },
};

/** Somme des composantes d'une répartition. */
export function allocationSum(a: PhaseAllocation): number {
  return TRAINING_PHASES.reduce((s, p) => s + (a[p] ?? 0), 0);
}

/**
 * Normalise une répartition pour qu'elle somme à 1 (défensif : l'UI passe des curseurs
 * bruts). Une répartition entièrement nulle retombe sur un mix uniforme.
 */
export function normalizeAllocation(a: PhaseAllocation): PhaseAllocation {
  const total = allocationSum(a);
  if (total <= 0) {
    const u = 1 / TRAINING_PHASES.length;
    return { pretraining: u, finetuning: u, alignment: u, evaluation: u };
  }
  return {
    pretraining: (a.pretraining ?? 0) / total,
    finetuning: (a.finetuning ?? 0) / total,
    alignment: (a.alignment ?? 0) / total,
    evaluation: (a.evaluation ?? 0) / total,
  };
}

/** Distance L1 entre deux répartitions (∈ [0, 2] pour deux distributions normalisées). */
function l1Distance(a: PhaseAllocation, b: PhaseAllocation): number {
  return TRAINING_PHASES.reduce((s, p) => s + Math.abs((a[p] ?? 0) - (b[p] ?? 0)), 0);
}

// ---------------------------------------------------------------------------
// 2. TYPES DE MODÈLES — chacun récompense un dosage idéal différent et consomme
//    un DATASET CLÉ différent (lien direct avec l'usine : chaque type pousse à
//    développer une branche de production).
// ---------------------------------------------------------------------------

export type ModelTypeId = 'language' | 'vision' | 'code' | 'multimodal';

export interface ModelTypeDef {
  id: ModelTypeId;
  name: string;
  blurb: string;
  /** Dosage idéal des phases pour ce type (somme = 1). */
  idealEffort: PhaseAllocation;
  /** Compute-units à accumuler pour terminer un run (≈ minutes × débit de compute). */
  computeRequired: number;
  /** Item-dataset dont le VOLUME produit pendant le run nourrit le plus la qualité. */
  keyDatasetItemId: string;
}

/**
 * Catalogue des types de modèles (économie v1 de la couche Tycoon).
 *
 * computeRequired : calibré pour qu'un PREMIER run soit satisfaisant (≈ 8 min à 30
 * compute/min = 1 Datacenter, ~3 min avec 2-3). Croîtra par génération (prestige, P2).
 * keyDatasetItemId : pointe vers un item RÉEL du dataset (langage = tokens accessibles ;
 * les autres types poussent vers des branches plus avancées).
 */
export const MODEL_TYPES: readonly ModelTypeDef[] = [
  {
    id: 'language',
    name: 'Modèle de langage',
    blurb: 'Comprend et génère du texte. La porte d’entrée — peu d’intrants, gros usages.',
    idealEffort: { pretraining: 0.5, finetuning: 0.2, alignment: 0.2, evaluation: 0.1 },
    computeRequired: 240,
    keyDatasetItemId: 'iron-ingot', // Clean Tokens
  },
  {
    id: 'code',
    name: 'Modèle de code',
    blurb: 'Assiste les développeurs. Le fine-tuning et l’évaluation comptent beaucoup.',
    idealEffort: { pretraining: 0.35, finetuning: 0.35, alignment: 0.1, evaluation: 0.2 },
    computeRequired: 300,
    keyDatasetItemId: 'steel', // Curated Dataset
  },
  {
    id: 'vision',
    name: 'Modèle de vision',
    blurb: 'Analyse et génère des images. Gourmand en pré-entraînement et données image.',
    idealEffort: { pretraining: 0.5, finetuning: 0.3, alignment: 0.1, evaluation: 0.1 },
    computeRequired: 330,
    keyDatasetItemId: 'copper-ingot', // Image Tensors
  },
  {
    id: 'multimodal',
    name: 'Modèle multimodal',
    blurb: 'Texte + image + plus. Le plus ambitieux : équilibré et coûteux en compute.',
    idealEffort: { pretraining: 0.4, finetuning: 0.25, alignment: 0.2, evaluation: 0.15 },
    computeRequired: 480,
    keyDatasetItemId: 'circuit-board', // Inference Engine
  },
] as const;

export function modelTypeDef(id: ModelTypeId): ModelTypeDef {
  const def = MODEL_TYPES.find((m) => m.id === id);
  if (!def) throw new Error(`Type de modèle inconnu : ${id}`);
  return def;
}

// ---------------------------------------------------------------------------
// 3. DOMAINES D'APPLICATION — surtout la cible de la TENDANCE marché (bonus de
//    réception si le projet est « hot »).
// ---------------------------------------------------------------------------

export type DomainId = 'assistant' | 'image-gen' | 'dev-copilot' | 'research';

export interface DomainDef {
  id: DomainId;
  name: string;
  blurb: string;
}

export const DOMAINS: readonly DomainDef[] = [
  { id: 'assistant', name: 'Assistant', blurb: 'Un assistant conversationnel grand public.' },
  { id: 'image-gen', name: 'Génération d’images', blurb: 'Crée des images à la demande.' },
  { id: 'dev-copilot', name: 'Copilote dev', blurb: 'Complète et explique du code dans l’éditeur.' },
  { id: 'research', name: 'Recherche', blurb: 'Outils pour chercheurs et analystes — niche exigeante.' },
] as const;

// ---------------------------------------------------------------------------
// 4. TENDANCE DE MARCHÉ — (type × domaine) « hot » du moment. S'aligner dessus
//    booste la réception ; viser à contre-courant est neutre (P1 ; le « pari »
//    contre-tendance viendra en P2).
// ---------------------------------------------------------------------------

export interface MarketTrend {
  modelType: ModelTypeId;
  domain: DomainId;
}

/** Tire une tendance déterministe à partir d'une graine. */
export function rollMarketTrend(seed: number): MarketTrend {
  const rng = mulberry32(seed);
  const modelType = MODEL_TYPES[Math.floor(rng() * MODEL_TYPES.length)].id;
  const domain = DOMAINS[Math.floor(rng() * DOMAINS.length)].id;
  return { modelType, domain };
}

/** Durée de vie d'une tendance, en minutes de jeu, avant rafraîchissement. */
export const TREND_TTL_GAME_MIN = 15;

/** Bonus de réception : tendance pleinement alignée vs type seul vs rien. */
export const TREND_FULL_MATCH_MULT = 1.3;
export const TREND_TYPE_MATCH_MULT = 1.12;
export const TREND_NO_MATCH_MULT = 1.0;

/** Niveau d'alignement d'un projet avec la tendance courante. */
export type TrendMatch = 'full' | 'type' | 'none';

export function trendMatchOf(trend: MarketTrend, modelType: ModelTypeId, domain: DomainId): TrendMatch {
  if (trend.modelType === modelType && trend.domain === domain) return 'full';
  if (trend.modelType === modelType) return 'type';
  return 'none';
}

function trendMultiplier(match: TrendMatch): number {
  if (match === 'full') return TREND_FULL_MATCH_MULT;
  if (match === 'type') return TREND_TYPE_MATCH_MULT;
  return TREND_NO_MATCH_MULT;
}

// ---------------------------------------------------------------------------
// 5. PROJET / RUN — l'état d'un entraînement en cours.
// ---------------------------------------------------------------------------

export interface ActiveProject {
  id: string;
  modelType: ModelTypeId;
  domain: DomainId;
  /** Répartition d'effort choisie (normalisée à 1). */
  effort: PhaseAllocation;
  /** Compute-units à accumuler pour terminer (copie de computeRequired du type). */
  computeRequired: number;
  /** Compute-units accumulés (avance au débit de compute de l'usine). */
  computeInvested: number;
  /** Item-dataset clé suivi pour la qualité. */
  datasetKeyItemId: string;
  /** Volume de dataset clé produit depuis le lancement (nourrit la qualité). */
  datasetAccumulated: number;
  /** Minutes de jeu actif au lancement. */
  startedAtGameMin: number;
  /**
   * Hype pré-lancement (≥ 1) : amplifie la réception au ship (demo day, waitlist…). Monté
   * par des poussées marketing payantes (cf. applyMarketing). 1 = aucune campagne.
   */
  hype: number;
}

/** Avancement [0, 1] du run (compute accumulé / requis). */
export function runProgress(p: ActiveProject): number {
  if (p.computeRequired <= 0) return 1;
  return Math.min(1, p.computeInvested / p.computeRequired);
}

/** Le run a-t-il accumulé assez de compute pour être shippé ? */
export function isRunComplete(p: ActiveProject): boolean {
  return p.computeInvested >= p.computeRequired;
}

// ---------------------------------------------------------------------------
// 6. QUALITÉ DU MODÈLE — axe SÉPARÉ du score LP (Q3). Calculée depuis les intrants.
// ---------------------------------------------------------------------------

/** Poids des composantes de qualité (somment à 1). */
export const QUALITY_WEIGHTS = { phaseMix: 0.45, dataset: 0.35, compute: 0.2 } as const;

/** Cible de dataset (volume) rapportée au compute requis : datasetTarget = required × ce facteur. */
export const DATASET_PER_COMPUTE = 0.5;

/** En dessous de ce niveau d'effort d'évaluation, le modèle accumule des défauts. */
export const MIN_EVALUATION_EFFORT = 0.1;
/** Ampleur de la pénalité de défauts (par unité de déficit d'évaluation). */
export const DEFECT_PENALTY_FACTOR = 1.5;

export interface QualityBreakdown {
  /** Adéquation du dosage des phases au mix idéal du type [0, 1]. */
  phaseMixScore: number;
  /** Couverture du volume de dataset clé [0, 1]. */
  datasetScore: number;
  /** Compute investi / requis, plafonné à 1. */
  computeScore: number;
  /** Pénalité retirée pour manque d'évaluation (défauts) [0, ~]. */
  defectPenalty: number;
  /** Bonus additif apporté par les chercheurs (staff), déjà plafonné. */
  staffBonus: number;
  /** Qualité finale [0, 1]. */
  quality: number;
}

/**
 * Calcule la qualité d'un modèle à partir de l'état du run (PUR). Combine le dosage des
 * phases (le « skill » du joueur, comme les sliders GDT), le volume de dataset produit
 * (lien avec l'usine) et le compute investi, moins une pénalité de défauts si l'évaluation
 * a été négligée, plus un bonus additif (staff/recherche) passé par l'appelant.
 *
 * @param qualityBonus  Bonus additif [0, ~] (chercheurs, recherche plus tard). Défaut 0.
 */
export function computeModelQuality(p: ActiveProject, qualityBonus = 0): QualityBreakdown {
  const ideal = modelTypeDef(p.modelType).idealEffort;
  const effort = normalizeAllocation(p.effort);

  // 1 - distance/2 ∈ [0,1] : 1 = dosage parfait, 0 = dosage diamétralement opposé.
  const phaseMixScore = Math.max(0, 1 - l1Distance(effort, ideal) / 2);

  const datasetTarget = p.computeRequired * DATASET_PER_COMPUTE;
  const datasetScore = datasetTarget <= 0 ? 1 : Math.min(1, p.datasetAccumulated / datasetTarget);

  const computeScore = p.computeRequired <= 0 ? 1 : Math.min(1, p.computeInvested / p.computeRequired);

  const base =
    QUALITY_WEIGHTS.phaseMix * phaseMixScore +
    QUALITY_WEIGHTS.dataset * datasetScore +
    QUALITY_WEIGHTS.compute * computeScore;

  const evalDeficit = Math.max(0, MIN_EVALUATION_EFFORT - effort.evaluation);
  const defectPenalty = evalDeficit * DEFECT_PENALTY_FACTOR;

  const staffBonus = Math.max(0, qualityBonus);
  const quality = Math.max(0, Math.min(1, base - defectPenalty + staffBonus));
  return { phaseMixScore, datasetScore, computeScore, defectPenalty, staffBonus, quality };
}

// ---------------------------------------------------------------------------
// 7. SHIP & REVIEW — benchmark + réception → revenus, renommée, RP.
// ---------------------------------------------------------------------------

/** Revenu de base d'un modèle à réception parfaite, en $ (avant renommée). */
export const BASE_REVENUE = 250;
/** Chaque point de renommée majore le revenu de ce facteur (base d'utilisateurs). */
export const RENOWN_REVENUE_FACTOR = 0.02;
/** RP de base accordés au ship (×qualité). */
export const BASE_RP_REWARD = 50;
/** Renommée de base gagnée au ship (×réception). */
export const RENOWN_PER_SHIP = 10;

export interface ModelReview {
  modelType: ModelTypeId;
  domain: DomainId;
  /** Qualité brute [0, 1]. */
  quality: number;
  /** Note de benchmark 0-100 (suite de tests « objective »). */
  benchmark: number;
  /** Réception communauté [0, 1] (qualité × tendance × hype). */
  reception: number;
  /** Revenus en $ (crédités en Bolts par l'appelant). */
  revenue: number;
  /** RP accordés. */
  rpReward: number;
  /** Renommée gagnée. */
  renownDelta: number;
  /** Alignement avec la tendance du moment. */
  trendMatch: TrendMatch;
  /** Hype appliqué (≥ 1) au moment du ship (poussées marketing). */
  hype: number;
}

/**
 * Évalue un modèle terminé (PUR) : benchmark (objectif) + réception (tendance × hype du
 * projet) → revenus / RP / renommée. Ne mute rien ; `shipModel` applique le résultat.
 *
 * @param qualityBonus  Bonus de qualité (staff/recherche) ajouté avant la review. Défaut 0.
 */
export function reviewModel(
  tycoon: TycoonState,
  project: ActiveProject,
  qualityBonus = 0,
): ModelReview {
  const { quality } = computeModelQuality(project, qualityBonus);
  const match = trendMatchOf(tycoon.trend, project.modelType, project.domain);
  const hype = Math.max(1, project.hype);
  const reception = Math.max(0, Math.min(1, quality * trendMultiplier(match) * hype));

  const benchmark = Math.round(quality * 100);
  const revenue = Math.round(BASE_REVENUE * reception * (1 + tycoon.renown * RENOWN_REVENUE_FACTOR));
  const rpReward = Math.round(BASE_RP_REWARD * quality);
  const renownDelta = Math.round(RENOWN_PER_SHIP * reception);

  return {
    modelType: project.modelType,
    domain: project.domain,
    quality,
    benchmark,
    reception,
    revenue,
    rpReward,
    renownDelta,
    trendMatch: match,
    hype,
  };
}

// ---------------------------------------------------------------------------
// 8. ÉTAT TYCOON — sérialisable, intégré à ProgressionState.
// ---------------------------------------------------------------------------

export interface TycoonState {
  /** Projet/run en cours (1 max, focus façon GDT early — décision Q5), ou null. */
  activeProject: ActiveProject | null;
  /** Nombre de modèles shippés (base de la génération / prestige futur). */
  shippedModels: number;
  /** Renommée cumulée du labo (majore les revenus). */
  renown: number;
  /** Meilleur score de benchmark atteint (vitrine). */
  bestBenchmark: number;
  /** Tendance de marché courante. */
  trend: MarketTrend;
  /** Graine de la prochaine tendance. */
  trendSeed: number;
  /** Minutes de jeu à laquelle la tendance courante a été fixée (base du TTL). */
  trendSetAtGameMin: number;
  /** Dernière review (affichage du dernier ship). */
  lastReview: ModelReview | null;
  /** Compteur d'ids de projets (ids stables, déterministes). */
  projectCounter: number;
  /** Effectifs du labo par rôle (multiplicateurs de run + masse salariale). */
  staff: StaffState;
}

/** État Tycoon de départ : aucun projet, tendance dérivée de la graine. */
export function initialTycoon(seed: number): TycoonState {
  const trendSeed = (seed >>> 0) || 1;
  return {
    activeProject: null,
    shippedModels: 0,
    renown: 0,
    bestBenchmark: 0,
    trend: rollMarketTrend(trendSeed),
    trendSeed: (trendSeed + 1) >>> 0,
    trendSetAtGameMin: 0,
    lastReview: null,
    projectCounter: 0,
    staff: initialStaff(),
  };
}

// ---------------------------------------------------------------------------
// 9. RÉDUCTEURS — démarrer un projet, avancer le run, shipper.
// ---------------------------------------------------------------------------

export interface ProjectConfig {
  modelType: ModelTypeId;
  domain: DomainId;
  effort: PhaseAllocation;
}

/**
 * Démarre un projet de modèle (PUR). Sans effet si un run est déjà actif (1 max).
 * La répartition d'effort est normalisée à 1.
 */
export function startProject(
  tycoon: TycoonState,
  config: ProjectConfig,
  gameMinutesElapsed: number,
): TycoonState {
  if (tycoon.activeProject) return tycoon;
  const def = modelTypeDef(config.modelType);
  const counter = tycoon.projectCounter + 1;
  const project: ActiveProject = {
    id: `model-${counter}`,
    modelType: config.modelType,
    domain: config.domain,
    effort: normalizeAllocation(config.effort),
    computeRequired: def.computeRequired,
    computeInvested: 0,
    datasetKeyItemId: def.keyDatasetItemId,
    datasetAccumulated: 0,
    startedAtGameMin: gameMinutesElapsed,
    hype: HYPE_BASE,
  };
  return { ...tycoon, activeProject: project, projectCounter: counter };
}

export interface TycoonTickInput {
  /** Débit de compute de l'usine (production de l'item `electricity`), items/min. */
  computeThroughputPerMin: number;
  /** Débit de production de l'item-dataset clé du projet actif, items/min. */
  keyItemProductionPerMin: number;
  /** Durée écoulée, en minutes. */
  dtMin: number;
  /** Minutes de jeu actif totales (base du TTL de tendance). */
  gameMinutesElapsed: number;
}

export interface TycoonTickResult {
  tycoon: TycoonState;
  /** true si le run vient de passer à « terminé » pendant ce tick (notification UI). */
  runJustCompleted: boolean;
}

/**
 * Avance la couche Tycoon d'un tick (PUR) :
 *  - accumule le compute (débit de l'usine) et le volume de dataset clé dans le run actif ;
 *  - rafraîchit la tendance de marché quand elle est périmée (et qu'aucun projet n'est en
 *    cours — on ne change pas la cible sous les pieds du joueur en plein run).
 */
export function advanceTycoon(tycoon: TycoonState, input: TycoonTickInput): TycoonTickResult {
  const dt = Math.max(0, input.dtMin);
  let next = tycoon;
  let runJustCompleted = false;

  if (next.activeProject && dt > 0) {
    const p = next.activeProject;
    const wasComplete = isRunComplete(p);
    const computeInvested = p.computeInvested + Math.max(0, input.computeThroughputPerMin) * dt;
    const datasetAccumulated =
      p.datasetAccumulated + Math.max(0, input.keyItemProductionPerMin) * dt;
    const updated: ActiveProject = { ...p, computeInvested, datasetAccumulated };
    next = { ...next, activeProject: updated };
    runJustCompleted = !wasComplete && isRunComplete(updated);
  }

  // Rafraîchissement de la tendance (jamais pendant un run actif).
  if (
    !next.activeProject &&
    input.gameMinutesElapsed >= next.trendSetAtGameMin + TREND_TTL_GAME_MIN
  ) {
    next = {
      ...next,
      trend: rollMarketTrend(next.trendSeed),
      trendSeed: (next.trendSeed + 1) >>> 0,
      trendSetAtGameMin: input.gameMinutesElapsed,
    };
  }

  return { tycoon: next, runJustCompleted };
}

export interface ShipResult {
  tycoon: TycoonState;
  review: ModelReview;
}

/**
 * Shippe le projet actif (PUR). Exige un run TERMINÉ — renvoie null sinon (l'appelant
 * ne crédite rien). Met à jour renommée / meilleur benchmark / dernière review, remet le
 * slot de projet à null, et rafraîchit la tendance (nouveau cycle de marché).
 *
 * Les revenus ($) et RP de la review sont à créditer par l'appelant (progression.ts), pour
 * garder ce module sans connaissance des monnaies.
 */
export function shipModel(
  tycoon: TycoonState,
  gameMinutesElapsed: number,
  qualityBonus = 0,
): ShipResult | null {
  const project = tycoon.activeProject;
  if (!project || !isRunComplete(project)) return null;

  const review = reviewModel(tycoon, project, qualityBonus);
  const next: TycoonState = {
    ...tycoon,
    activeProject: null,
    shippedModels: tycoon.shippedModels + 1,
    renown: tycoon.renown + review.renownDelta,
    bestBenchmark: Math.max(tycoon.bestBenchmark, review.benchmark),
    lastReview: review,
    // Nouveau cycle de marché après chaque sortie.
    trend: rollMarketTrend(tycoon.trendSeed),
    trendSeed: (tycoon.trendSeed + 1) >>> 0,
    trendSetAtGameMin: gameMinutesElapsed,
  };
  return { tycoon: next, review };
}

// ---------------------------------------------------------------------------
// 10. HYPE / MARKETING — décision $ pré-lancement (« demo day », waitlist).
//     Amplifie la réception (Q4.5). Rendements décroissants vers un plafond :
//     chaque poussée comble une fraction de l'écart au cap, et coûte plus cher à
//     mesure que le hype monte (on ne « farm » pas le hype gratuitement).
// ---------------------------------------------------------------------------

export const HYPE_BASE = 1;
export const HYPE_MAX = 2;
/** Coût $ de base d'une poussée marketing (×hype courant). */
export const MARKETING_BASE_COST = 60;
/** Fraction de l'écart au plafond comblée par une poussée. */
export const MARKETING_GAP_CLOSE = 0.4;

/** Coût $ de la prochaine poussée marketing au niveau de hype donné. */
export function marketingCost(hype: number): number {
  return Math.round(MARKETING_BASE_COST * Math.max(1, hype));
}

/** Reste-t-il de la marge de hype à acheter (sous le plafond) ? */
export function canMarket(p: ActiveProject): boolean {
  return p.hype < HYPE_MAX - 1e-6;
}

/** Applique une poussée marketing à un projet (PUR) : hype monte vers le plafond. */
export function applyMarketing(p: ActiveProject): ActiveProject {
  return { ...p, hype: Math.min(HYPE_MAX, p.hype + (HYPE_MAX - p.hype) * MARKETING_GAP_CLOSE) };
}

// ---------------------------------------------------------------------------
// 11. STAFF — embaucher l'équipe (signature Game Dev Tycoon). Coût $ initial +
//     MASSE SALARIALE récurrente (tension scrappy). Chaque rôle muscle le run :
//       - Ingénieur infra  → vitesse du run (×débit de compute effectif)
//       - Chercheur        → qualité du modèle (bonus additif, plafonné)
//       - Data scientist   → efficacité du dataset (×accumulation)
//     Les effets sont appliqués par l'appelant (progression) qui combine staff +
//     usine — ce module n'expose que les multiplicateurs dérivés (composables avec
//     la recherche plus tard).
// ---------------------------------------------------------------------------

export type StaffRole = 'engineer' | 'researcher' | 'data-scientist';

export interface StaffRoleDef {
  id: StaffRole;
  name: string;
  blurb: string;
  /** Coût $ d'embauche (one-shot). */
  hireCost: number;
  /** Masse salariale, en $ par minute de jeu. */
  salaryPerMin: number;
}

export const STAFF_ROLES: readonly StaffRoleDef[] = [
  {
    id: 'engineer',
    name: 'Ingénieur infra',
    blurb: 'Optimise le pipeline de calcul — accélère chaque run d’entraînement.',
    hireCost: 150,
    salaryPerMin: 1.0,
  },
  {
    id: 'researcher',
    name: 'Chercheur',
    blurb: 'Améliore les méthodes — relève la qualité de tes modèles.',
    hireCost: 200,
    salaryPerMin: 1.5,
  },
  {
    id: 'data-scientist',
    name: 'Data scientist',
    blurb: 'Nettoie et exploite mieux la donnée — ton dataset compte davantage.',
    hireCost: 175,
    salaryPerMin: 1.2,
  },
] as const;

export type StaffState = Record<StaffRole, number>;

/** Effectifs de départ : équipe vide (le garage). */
export function initialStaff(): StaffState {
  return { engineer: 0, researcher: 0, 'data-scientist': 0 };
}

export function staffRoleDef(id: StaffRole): StaffRoleDef {
  const def = STAFF_ROLES.find((r) => r.id === id);
  if (!def) throw new Error(`Rôle inconnu : ${id}`);
  return def;
}

// Effets unitaires par embauche [À VALIDER game-balance].
export const ENGINEER_SPEED_BONUS = 0.15; // +15 % vitesse de run / ingénieur
export const RESEARCHER_QUALITY_BONUS = 0.04; // +0.04 qualité / chercheur
export const RESEARCHER_QUALITY_CAP = 0.3; // bonus qualité staff plafonné
export const DATASCIENTIST_DATASET_BONUS = 0.2; // +20 % efficacité dataset / data scientist

/** Multiplicateur de vitesse de run apporté par les ingénieurs (≥ 1). */
export function labSpeedMult(staff: StaffState): number {
  return 1 + staff.engineer * ENGINEER_SPEED_BONUS;
}

/** Multiplicateur d'efficacité du dataset apporté par les data scientists (≥ 1). */
export function labDatasetMult(staff: StaffState): number {
  return 1 + staff['data-scientist'] * DATASCIENTIST_DATASET_BONUS;
}

/** Bonus additif de qualité apporté par les chercheurs (plafonné). */
export function labQualityBonus(staff: StaffState): number {
  return Math.min(RESEARCHER_QUALITY_CAP, staff.researcher * RESEARCHER_QUALITY_BONUS);
}

/** Masse salariale totale, en $ par minute de jeu. */
export function totalSalaryPerMin(staff: StaffState): number {
  return STAFF_ROLES.reduce((s, r) => s + staff[r.id] * r.salaryPerMin, 0);
}

/** Ajoute une embauche d'un rôle (PUR). */
export function hireStaffState(staff: StaffState, role: StaffRole): StaffState {
  return { ...staff, [role]: staff[role] + 1 };
}
