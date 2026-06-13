/**
 * progression.ts — Logique PURE de l'état de progression de la couche jeu.
 *
 * Aucune dépendance React/Zustand : c'est un ensemble de réducteurs (state → state)
 * testables en isolation, comme le solveur. Le store `useProgressionStore` n'en est
 * qu'une fine enveloppe Zustand + persistance.
 *
 * DÉPENDANCES : lit uniquement `./balance` (config chiffrée) et les types de données.
 * Le sens des dépendances est respecté : `game` lit `data`/`solver`/`graph`, jamais l'inverse.
 */

import {
  MILESTONES,
  STARTING_BOLTS,
  STARTING_RP,
  computeRpRate,
  computeOfflineGains,
  checkNewlyReachedMilestones,
  prestigeMultiplier,
  type MilestoneDefinition,
} from './balance';
import {
  advanceContracts,
  acceptOffer,
  type ActiveContract,
  type ContractOffer,
  type ContractSlice,
  type ProducibleItem,
} from './contracts';

// ---------------------------------------------------------------------------
// État sérialisable de la progression
// ---------------------------------------------------------------------------

export interface ProgressionState {
  /** Points de Recherche (RP) — dérivés de la production, dépensés dans l'arbre de connaissances. */
  researchPoints: number;
  /** Bolts — l'argent du jeu (contrats), dépensé en pose de bâtiments et améliorations. */
  bolts: number;
  /** Quantité cumulée produite par item (clé = itemId) — base des milestones. */
  cumulativeProduced: Record<string, number>;
  /** Quantité cumulée produite par nœud et par item (nodeId -> itemId -> total). */
  nodeCumulativeProduced: Record<string, Record<string, number>>;
  /** Ids des milestones déjà franchis (idempotence). */
  reachedMilestones: string[];
  /** Bâtiments débloqués par les milestones (filtre futur de la palette). */
  unlockedBuildings: string[];
  /** Recettes alternatives débloquées (futures colonnes activables du LP). */
  unlockedRecipes: string[];
  /** Timestamp (ms) du dernier instant actif — base du calcul offline. */
  lastSeenMs: number;
  /** Dernier taux AP/min observé — sert au calcul des gains offline à la reconnexion. */
  lastRpRatePerMin: number;
  /** Nombre de prestiges effectués (multiplicateur permanent). */
  prestigeCount: number;
  /** L'écran d'accueil (premier lancement) a été vu. */
  welcomeSeen: boolean;
  /** Le tutoriel a été passé manuellement (il disparaît de lui-même après M1). */
  tutorialDismissed: boolean;

  // --- Contrats (l'objectif vivant + source de Bolts) ---
  /** Minutes de JEU ACTIF écoulées — l'horloge des deadlines de contrat (n'avance qu'en jeu). */
  gameMinutesElapsed: number;
  /** Réputation client [−3, +3]. */
  reputation: number;
  /** Nombre de contrats réussis (le 1er fait basculer du contrat de lancement au procédural). */
  contractsCompleted: number;
  /** Contrat en cours (1 max), ou null. */
  activeContract: ActiveContract | null;
  /** Offres actuellement présentées. */
  contractOffers: ContractOffer[];
  /** Graine du prochain lot d'offres. */
  contractSeed: number;
  /** `gameMinutesElapsed` à la génération du lot d'offres courant. */
  offersGeneratedAtGameMin: number;
}

/** État de départ : tout à zéro, horloge calée sur maintenant. */
export function initialProgression(nowMs: number = Date.now()): ProgressionState {
  return {
    researchPoints: STARTING_RP,
    bolts: STARTING_BOLTS,
    cumulativeProduced: {},
    nodeCumulativeProduced: {},
    reachedMilestones: [],
    unlockedBuildings: [],
    unlockedRecipes: [],
    lastSeenMs: nowMs,
    lastRpRatePerMin: 0,
    prestigeCount: 0,
    welcomeSeen: false,
    tutorialDismissed: false,
    gameMinutesElapsed: 0,
    reputation: 0,
    contractsCompleted: 0,
    activeContract: null,
    contractOffers: [],
    // Graine dérivée de l'horloge de création : carte de contrats variée d'une partie à l'autre.
    contractSeed: (nowMs >>> 0) || 1,
    offersGeneratedAtGameMin: 0,
  };
}

/** Extrait la tranche « contrats » de l'état (pour les fonctions pures de contracts.ts). */
function contractSliceOf(s: ProgressionState): ContractSlice {
  return {
    reputation: s.reputation,
    contractsCompleted: s.contractsCompleted,
    activeContract: s.activeContract,
    contractOffers: s.contractOffers,
    contractSeed: s.contractSeed,
    offersGeneratedAtGameMin: s.offersGeneratedAtGameMin,
  };
}

// ---------------------------------------------------------------------------
// Tick de production (appelé périodiquement par le store depuis le graphe live)
// ---------------------------------------------------------------------------

/** Débit brut d'un item (items/min). */
export interface ProductionRate {
  itemId: string;
  ratePerMin: number;
}

export interface NodeProductionRate {
  nodeId: string;
  itemId: string;
  ratePerMin: number;
}

export interface TickInput {
  /** Production brute par item (summary.production) — accumulée pour les milestones. */
  grossProduction: ProductionRate[];
  /** Production brute par machine ID et par item. */
  nodeProductions?: NodeProductionRate[];
  /** Débit total des sorties finales (items/min) — base du taux d'AP. */
  totalOutputPerMin: number;
  /** Efficacité globale de l'usine [0, 1] — module le taux d'AP. */
  efficiency: number;
  /** Durée écoulée depuis le dernier tick, en minutes. */
  dtMin: number;
  /** Timestamp courant (ms). */
  nowMs: number;
  /** Items réellement produits (débit > 0), avec leur nom — base des contrats procéduraux. */
  producibleItems?: ProducibleItem[];
}

export interface TickResult {
  state: ProgressionState;
  /** Milestones franchis pendant CE tick (pour la notification UI). */
  newlyReached: MilestoneDefinition[];
  /** RP gagnés pendant ce tick. */
  rpGained: number;
  /** Contrat réussi ce tick (notification + Bolts déjà crédités). */
  contractCompleted: ContractOffer | null;
  /** Contrat échoué ce tick (deadline dépassée). */
  contractFailed: ContractOffer | null;
}

/** Applique un débloquage à l'état (immuable, dédupliqué). */
function applyUnlock(state: ProgressionState, m: MilestoneDefinition): ProgressionState {
  const { type, id } = m.unlocks;
  if (type === 'building' && !state.unlockedBuildings.includes(id)) {
    return { ...state, unlockedBuildings: [...state.unlockedBuildings, id] };
  }
  if (type === 'recipe' && !state.unlockedRecipes.includes(id)) {
    return { ...state, unlockedRecipes: [...state.unlockedRecipes, id] };
  }
  // type === 'hint' : pas d'effet sur l'état, seulement une notification.
  return state;
}

/**
 * Avance la progression d'un tick : accumule la production, accrue les AP, et
 * déclenche les milestones nouvellement atteints (avec leurs déblocages).
 *
 * Pur et idempotent au niveau milestone : un milestone déjà dans `reachedMilestones`
 * ne se redéclenche jamais.
 */
export function applyProductionTick(state: ProgressionState, input: TickInput): TickResult {
  const { grossProduction, nodeProductions, totalOutputPerMin, efficiency, dtMin, nowMs } = input;

  // dt non positif (horloge figée/recule) : on ne fait qu'actualiser lastSeen, sans gain.
  const safeDtMin = Math.max(0, dtMin);

  // 1. Accumulation de la production brute (pour les milestones).
  const cumulativeProduced = { ...state.cumulativeProduced };
  const nodeCumulativeProduced: Record<string, Record<string, number>> = {};
  if (state.nodeCumulativeProduced) {
    for (const [nodeId, items] of Object.entries(state.nodeCumulativeProduced)) {
      nodeCumulativeProduced[nodeId] = { ...items };
    }
  }

  if (safeDtMin > 0) {
    for (const { itemId, ratePerMin } of grossProduction) {
      if (ratePerMin > 0) {
        cumulativeProduced[itemId] = (cumulativeProduced[itemId] ?? 0) + ratePerMin * safeDtMin;
      }
    }
    if (nodeProductions) {
      for (const { nodeId, itemId, ratePerMin } of nodeProductions) {
        if (ratePerMin > 0) {
          if (!nodeCumulativeProduced[nodeId]) {
            nodeCumulativeProduced[nodeId] = {};
          }
          nodeCumulativeProduced[nodeId][itemId] = (nodeCumulativeProduced[nodeId][itemId] ?? 0) + ratePerMin * safeDtMin;
        }
      }
    }
  }

  // 2. Accrual d'AP (taux dérivé du débit réel × efficacité × multiplicateur de prestige).
  const baseRpRate = computeRpRate(totalOutputPerMin, efficiency);
  const rpRatePerMin = baseRpRate * prestigeMultiplier(state.prestigeCount);
  const rpGained = rpRatePerMin * safeDtMin;

  // L'horloge des contrats n'avance qu'en jeu actif (cohérent avec le compteur de livraison
  // qui ne progresse que pendant la production — pas de punition pendant l'absence).
  const gameMinutesElapsed = state.gameMinutesElapsed + safeDtMin;

  let next: ProgressionState = {
    ...state,
    cumulativeProduced,
    nodeCumulativeProduced,
    researchPoints: state.researchPoints + rpGained,
    lastSeenMs: nowMs,
    lastRpRatePerMin: rpRatePerMin,
    gameMinutesElapsed,
  };

  // 3. Milestones nouvellement franchis → déblocages.
  const reachedSet = new Set(next.reachedMilestones);
  const producedMap = new Map(Object.entries(next.cumulativeProduced));
  const newlyReached = checkNewlyReachedMilestones(MILESTONES, reachedSet, producedMap);

  if (newlyReached.length > 0) {
    let withUnlocks = next;
    const reached = [...next.reachedMilestones];
    for (const m of newlyReached) {
      reached.push(m.id);
      withUnlocks = applyUnlock(withUnlocks, m);
    }
    next = { ...withUnlocks, reachedMilestones: reached };
  }

  // 4. Contrats : complétion (Bolts + réputation + déblocage), échec, ou rafraîchissement des offres.
  const { slice, events } = advanceContracts(
    contractSliceOf(next),
    next.cumulativeProduced,
    gameMinutesElapsed,
    input.producibleItems ?? [],
  );
  next = {
    ...next,
    reputation: slice.reputation,
    contractsCompleted: slice.contractsCompleted,
    activeContract: slice.activeContract,
    contractOffers: slice.contractOffers,
    contractSeed: slice.contractSeed,
    offersGeneratedAtGameMin: slice.offersGeneratedAtGameMin,
    bolts: next.bolts + events.boltsAwarded,
  };
  if (events.unlock?.type === 'building' && !next.unlockedBuildings.includes(events.unlock.id)) {
    next = { ...next, unlockedBuildings: [...next.unlockedBuildings, events.unlock.id] };
  }

  return {
    state: next,
    newlyReached,
    rpGained,
    contractCompleted: events.completed,
    contractFailed: events.failed,
  };
}

// ---------------------------------------------------------------------------
// Dépense d'AP (coût de pose des bâtiments)
// ---------------------------------------------------------------------------

export interface SpendResult {
  state: ProgressionState;
  /** true si la dépense a été effectuée (solde suffisant), false sinon (état inchangé). */
  spent: boolean;
}

/**
 * Tente de dépenser `cost` Bolts (pose de bâtiments, améliorations). Refuse (état
 * inchangé, `spent: false`) si le solde est insuffisant — jamais de solde négatif.
 */
export function trySpendBolts(state: ProgressionState, cost: number): SpendResult {
  if (cost <= 0) return { state, spent: true };
  if (state.bolts < cost) return { state, spent: false };
  return { state: { ...state, bolts: state.bolts - cost }, spent: true };
}

// ---------------------------------------------------------------------------
// Contrats — acceptation (le reste du cycle de vie vit dans le tick)
// ---------------------------------------------------------------------------

/**
 * Accepte une offre de contrat (1 max). Fige le compteur de livraison sur la production
 * cumulée actuelle et calcule la deadline en minutes de jeu. État inchangé si l'offre est
 * introuvable ou si un contrat est déjà actif.
 */
export function acceptContract(state: ProgressionState, offerId: string): ProgressionState {
  const slice = acceptOffer(
    contractSliceOf(state),
    offerId,
    state.cumulativeProduced,
    state.gameMinutesElapsed,
  );
  return { ...state, activeContract: slice.activeContract, contractOffers: slice.contractOffers };
}

// ---------------------------------------------------------------------------
// Gains offline (à la reconnexion)
// ---------------------------------------------------------------------------

export interface OfflineResult {
  state: ProgressionState;
  /** RP attribués pour la période hors-ligne (déjà plafonnés à 4 h). */
  rpGained: number;
  /** Durée hors-ligne réelle prise en compte, en minutes (≤ plafond). */
  minutesCredited: number;
}

/**
 * Attribue les RP accumulés hors-ligne depuis `state.lastSeenMs` jusqu'à `nowMs`,
 * en delta-time plafonné (cf. balance.computeOfflineGains). Utilise le dernier taux
 * RP/min connu (persisté). Actualise `lastSeenMs`.
 */
export function applyOfflineGains(state: ProgressionState, nowMs: number): OfflineResult {
  const rpGained = computeOfflineGains(state.lastRpRatePerMin, state.lastSeenMs, nowMs);
  const minutesCredited =
    state.lastRpRatePerMin > 0 ? rpGained / state.lastRpRatePerMin : 0;
  return {
    state: { ...state, researchPoints: state.researchPoints + rpGained, lastSeenMs: nowMs },
    rpGained,
    minutesCredited,
  };
}

// ---------------------------------------------------------------------------
// Application des déblocages — quels bâtiments/recettes sont disponibles
// ---------------------------------------------------------------------------
//
// PRINCIPE DU KIT DE BASE : un bâtiment/recette n'est verrouillé QUE s'il est la
// récompense d'un milestone. Tout le reste est disponible d'emblée (miner, smelter,
// logistique, recettes standard). Le set verrouillé est dérivé de MILESTONES — il
// reste donc automatiquement synchrone avec la table d'équilibrage.

/** Bâtiments verrouillés tant que leur milestone n'est pas franchi. */
const MILESTONE_GATED_BUILDINGS: ReadonlySet<string> = new Set(
  MILESTONES.filter((m) => m.unlocks.type === 'building').map((m) => m.unlocks.id),
);

/** Recettes (alternatives) verrouillées tant que leur milestone n'est pas franchi. */
const MILESTONE_GATED_RECIPES: ReadonlySet<string> = new Set(
  MILESTONES.filter((m) => m.unlocks.type === 'recipe').map((m) => m.unlocks.id),
);

/**
 * Un bâtiment est-il disponible ? Vrai s'il fait partie du kit de base (non gaté par un
 * milestone) ou s'il a été débloqué. Pilote la palette manuelle.
 */
export function isBuildingUnlocked(
  state: Pick<ProgressionState, 'unlockedBuildings'>,
  buildingId: string,
): boolean {
  if (!MILESTONE_GATED_BUILDINGS.has(buildingId)) return true;
  return state.unlockedBuildings.includes(buildingId);
}

/**
 * Une recette est-elle disponible ? Vrai pour toute recette standard ou alternative non
 * gatée, ou pour une alternative débloquée. Pilote la liste de recettes (inspecteur) et,
 * pour les alternatives, les colonnes candidates du LP.
 */
export function isRecipeUnlocked(
  state: Pick<ProgressionState, 'unlockedRecipes'>,
  recipeId: string,
): boolean {
  if (!MILESTONE_GATED_RECIPES.has(recipeId)) return true;
  return state.unlockedRecipes.includes(recipeId);
}

/**
 * Liste des ids de recettes alternatives autorisées dans le LP = alternatives débloquées.
 * À passer en `allowedAlternates` au solveur. Un tableau vide signifie « recettes standard
 * uniquement » (état de départ). Les recettes standard ne sont jamais filtrées par le LP.
 */
export function allowedAlternateRecipeIds(
  state: Pick<ProgressionState, 'unlockedRecipes'>,
  recipes: ReadonlyArray<{ id: string; alternate: boolean }>,
): string[] {
  return recipes
    .filter((r) => r.alternate && isRecipeUnlocked(state, r.id))
    .map((r) => r.id);
}

// ---------------------------------------------------------------------------
// Helpers d'affichage (UI) — purs
// ---------------------------------------------------------------------------

/** Premier milestone non encore franchi (dans l'ordre), ou null si tous atteints. */
export function nextMilestone(state: ProgressionState): MilestoneDefinition | null {
  const reached = new Set(state.reachedMilestones);
  return MILESTONES.find((m) => !reached.has(m.id)) ?? null;
}

/**
 * Progression [0, 1] vers un milestone donné selon la production cumulée actuelle.
 * 1.0 = atteint ou dépassé.
 */
export function milestoneProgress(
  state: Pick<ProgressionState, 'cumulativeProduced'>,
  m: MilestoneDefinition,
): number {
  const produced = state.cumulativeProduced[m.itemId] ?? 0;
  if (m.target <= 0) return 1;
  return Math.min(1, produced / m.target);
}
