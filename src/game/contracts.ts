/**
 * contracts.ts — Contrats clients, logique PURE (génération procédurale + cycle de vie).
 *
 * Les contrats sont l'objectif vivant du jeu et la source des Bolts. Un client fictif
 * (nom + texte générés, seedés) demande la livraison d'un item. La quantité est TOUJOURS
 * dérivée du débit réel de l'usine (jamais un contrat impossible) — règle « pas de faux
 * nombres » appliquée au quest design. La livraison est automatique : on compte la
 * production cumulée de l'item depuis l'acceptation.
 *
 * Découplage : aucune dépendance React/store/GameData. Le module reçoit en entrée la liste
 * des items que l'usine produit réellement (avec leur nom d'affichage et leur débit) ; il
 * ne connaît rien du reste. Comme le solveur, il est déterministe et testable en isolation.
 */

// ---------------------------------------------------------------------------
// PRNG déterministe (mulberry32) — même graine ⇒ mêmes offres.
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
// Niveaux de risque — l'arbitrage cornélien (plus c'est risqué, plus ça paie/coûte).
// ---------------------------------------------------------------------------

export type ContractRisk = 'standard' | 'tight' | 'hard';

export interface ContractRiskProfile {
  /** Quantité demandée = débit × durée × qtyFactor. <1 = confortable, >1 = il faut pousser. */
  qtyFactor: number;
  /** Délai accordé, en minutes de jeu (le compteur n'avance qu'en jeu actif). */
  durationMin: number;
  /** Multiplicateur de récompense (Bolts). */
  rewardMult: number;
  /** Réputation gagnée à la réussite. */
  repWin: number;
  /** Réputation perdue à l'échec (valeur négative). */
  repLoss: number;
  /** Libellé court affiché. */
  label: string;
}

export const RISK_PROFILES: Record<ContractRisk, ContractRiskProfile> = {
  // Standard : on livre tranquillement à débit constant, peu de gain de réputation.
  standard: { qtyFactor: 0.8, durationMin: 8, rewardMult: 1.0, repWin: 1, repLoss: -1, label: 'Standard' },
  // Serré : ~110 % de la capacité sur un délai court → il FAUT améliorer/étendre.
  tight: { qtyFactor: 1.1, durationMin: 6, rewardMult: 2.0, repWin: 1, repLoss: -1, label: 'Serré' },
  // Cornélien : gros volume, délai court, paie 3.5× — mais l'échec coûte cher.
  hard: { qtyFactor: 1.6, durationMin: 5, rewardMult: 3.5, repWin: 2, repLoss: -2, label: 'Cornélien' },
};

const RISK_ORDER: ContractRisk[] = ['standard', 'tight', 'hard'];

/** Bolts gagnés par unité livrée (avant multiplicateurs). [À affiner en T5/Q6 par valeur d'item.] */
export const REWARD_PER_UNIT = 0.5;

// ---------------------------------------------------------------------------
// Réputation — module la qualité des offres (de −3 à +3).
// ---------------------------------------------------------------------------

export const REPUTATION_MIN = -3;
export const REPUTATION_MAX = 3;

/** Borne la réputation dans [REPUTATION_MIN, REPUTATION_MAX]. */
export function clampReputation(rep: number): number {
  return Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, Math.round(rep)));
}

/** Multiplicateur de paie selon la réputation : 0.8× (mauvaise) à 1.3× (excellente). */
export function reputationPayoutMult(rep: number): number {
  return Math.max(0.8, Math.min(1.3, 1 + clampReputation(rep) * 0.1));
}

// ---------------------------------------------------------------------------
// Banques de fragments procéduraux (légers, jamais bloquants).
// ---------------------------------------------------------------------------

const CLIENT_PREFIX = ['Vortex', 'Helios', 'Drax', 'Kappa', 'Meridian', 'Orion', 'Cobalt', 'Atlas', 'Nyx', 'Pyra'];
const CLIENT_SUFFIX = ['Industries', 'Syndicate', 'Labs', 'Logistics', 'Corp', 'Dynamics', 'Foundries', 'Collective'];

const FLAVOR_TEMPLATES = [
  'Notre chaîne de %item% est à l’arrêt. Sauvez notre trimestre.',
  'Rupture de stock critique sur le %item%. On compte sur vous.',
  'Commande urgente : il nous faut du %item%, et vite.',
  'Nos actionnaires réclament du %item%. Beaucoup de %item%.',
  'Un concurrent nous a lâchés. Livrez-nous le %item% promis.',
];

// ---------------------------------------------------------------------------
// Types de contrats
// ---------------------------------------------------------------------------

export interface ContractUnlock {
  type: 'building';
  id: string;
}

export interface ContractOffer {
  /** Identifiant stable (dérivé de la graine). */
  id: string;
  clientName: string;
  flavor: string;
  itemId: string;
  itemName: string;
  quantity: number;
  risk: ContractRisk;
  /** Récompense en Bolts (réputation déjà intégrée au moment de la génération). */
  reward: number;
  /** Délai en minutes de jeu, ou null si pas de deadline (contrat de lancement). */
  durationMin: number | null;
  /** Déblocage accordé à la réussite (contrat de lancement → Constructor). */
  unlocks?: ContractUnlock;
}

export interface ActiveContract {
  offer: ContractOffer;
  /** Quantité déjà livrée (prélevée sur le stock), 0 à l'acceptation. */
  delivered: number;
  /** `gameMinutesElapsed` à l'acceptation. */
  acceptedAtGameMin: number;
  /** `gameMinutesElapsed` au-delà duquel le contrat échoue (Infinity si pas de deadline). */
  deadlineGameMin: number;
}

// ---------------------------------------------------------------------------
// Contrat de lancement (bootstrap) — la toute première commande, sans délai.
// Remplace le rôle de « premier objectif » : livrer 60 Iron Ingot débloque le Constructor.
// ---------------------------------------------------------------------------

export const LAUNCH_CONTRACT: ContractOffer = {
  id: 'contract-launch',
  clientName: 'FICSIT Bootstrap',
  flavor: 'Bienvenue, ingénieur. Premier mandat : produisez-nous 60 lingots de fer.',
  itemId: 'iron-ingot',
  itemName: 'Iron Ingot',
  quantity: 60,
  risk: 'standard',
  reward: 80,
  durationMin: null,
  unlocks: { type: 'building', id: 'constructor' },
};

// ---------------------------------------------------------------------------
// Génération d'offres
// ---------------------------------------------------------------------------

/** Un item que l'usine produit réellement (base de la demande d'un contrat). */
export interface ProducibleItem {
  itemId: string;
  itemName: string;
  throughputPerMin: number;
}

/** Nombre d'offres présentées simultanément. */
export const CONTRACT_OFFER_COUNT = 3;
/** Durée de vie d'un lot d'offres avant rafraîchissement, en minutes de jeu. */
export const CONTRACT_OFFER_TTL_GAME_MIN = 10;

function clientName(rng: () => number): string {
  const p = CLIENT_PREFIX[Math.floor(rng() * CLIENT_PREFIX.length)];
  const s = CLIENT_SUFFIX[Math.floor(rng() * CLIENT_SUFFIX.length)];
  return `${p} ${s}`;
}

function flavorFor(rng: () => number, itemName: string): string {
  const t = FLAVOR_TEMPLATES[Math.floor(rng() * FLAVOR_TEMPLATES.length)];
  return t.replaceAll('%item%', itemName);
}

/**
 * Génère un lot d'offres déterministes. Chaque offre vise un item RÉELLEMENT produit
 * (débit > 0), avec une quantité dérivée du débit → toujours réalisable. Un risque est
 * tiré par offre (idéalement un de chaque). Renvoie `[]` si l'usine ne produit rien
 * (le contrat de lancement gère alors le bootstrap, hors de cette fonction).
 */
export function generateOffers(
  seed: number,
  reputation: number,
  producible: ProducibleItem[],
): ContractOffer[] {
  const items = producible.filter((p) => p.throughputPerMin > 0);
  if (items.length === 0) return [];

  const rng = mulberry32(seed);
  const payMult = reputationPayoutMult(reputation);
  const offers: ContractOffer[] = [];

  for (let i = 0; i < CONTRACT_OFFER_COUNT; i++) {
    const item = items[Math.floor(rng() * items.length)];
    // Un risque de chaque tant que possible, puis aléatoire.
    const risk = i < RISK_ORDER.length ? RISK_ORDER[i] : RISK_ORDER[Math.floor(rng() * RISK_ORDER.length)];
    const profile = RISK_PROFILES[risk];
    const quantity = Math.max(1, Math.round(item.throughputPerMin * profile.durationMin * profile.qtyFactor));
    const reward = Math.max(1, Math.round(quantity * REWARD_PER_UNIT * profile.rewardMult * payMult));
    offers.push({
      id: `contract-${seed}-${i}`,
      clientName: clientName(rng),
      flavor: flavorFor(rng, item.itemName),
      itemId: item.itemId,
      itemName: item.itemName,
      quantity,
      risk,
      reward,
      durationMin: profile.durationMin,
    });
  }
  return offers;
}

// ---------------------------------------------------------------------------
// Cycle de vie — état persisté + avancement
// ---------------------------------------------------------------------------

export interface ContractSlice {
  /** Réputation courante [−3, +3]. */
  reputation: number;
  /** Nombre de contrats réussis (le 1er bascule du bootstrap vers le procédural). */
  contractsCompleted: number;
  /** Contrat en cours (1 max), ou null. */
  activeContract: ActiveContract | null;
  /** Offres actuellement présentées. */
  contractOffers: ContractOffer[];
  /** Graine du prochain lot d'offres (avance à chaque régénération). */
  contractSeed: number;
  /** `gameMinutesElapsed` à la génération du lot courant (base du TTL). */
  offersGeneratedAtGameMin: number;
}

export interface ContractEvents {
  /** Contrat réussi ce tick (notification + récompense déjà intégrée au slice). */
  completed: ContractOffer | null;
  /** Contrat échoué ce tick (deadline dépassée). */
  failed: ContractOffer | null;
  /** Bolts à créditer (réussite). */
  boltsAwarded: number;
  /** Déblocage à appliquer (réussite d'un contrat porteur, ex. lancement → Constructor). */
  unlock: ContractUnlock | null;
}

const NO_EVENTS: ContractEvents = { completed: null, failed: null, boltsAwarded: 0, unlock: null };

/** Progression de livraison d'un contrat actif (items livrés depuis l'acceptation, ≥ 0). */
export function contractProgress(active: ActiveContract): number {
  return active.delivered;
}

/**
 * Avance le système de contrats d'un tick (PUR). Gère, dans l'ordre :
 *  0. la livraison du contrat actif depuis le STOCK disponible (entrepôt) — instantanée
 *     dans la limite de ce qui est déjà accumulé, le reste suit le débit de production ;
 *  1. la complétion du contrat actif (livraison atteinte → Bolts + réputation + déblocage),
 *  2. son échec (deadline de jeu dépassée → réputation),
 *  3. la (re)génération des offres quand aucun contrat n'est actif et que le lot est périmé.
 *
 * Le contrat de lancement est injecté tant qu'aucun contrat n'a encore été réussi
 * (`contractsCompleted === 0`) : c'est le premier objectif, toujours proposé.
 *
 * `itemStock` est consommé au fil de la livraison et renvoyé mis à jour.
 */
export function advanceContracts(
  slice: ContractSlice,
  itemStock: Record<string, number>,
  gameMinutesElapsed: number,
  producible: ProducibleItem[],
): { slice: ContractSlice; itemStock: Record<string, number>; events: ContractEvents } {
  // 0 + 1 + 2. Contrat actif : prélèvement sur le stock, puis complétion ou échec.
  if (slice.activeContract) {
    let active = slice.activeContract;
    let stock = itemStock;

    const remaining = active.offer.quantity - active.delivered;
    const available = stock[active.offer.itemId] ?? 0;
    if (remaining > 0 && available > 0) {
      const take = Math.min(remaining, available);
      stock = { ...stock, [active.offer.itemId]: available - take };
      active = { ...active, delivered: active.delivered + take };
    }

    if (active.delivered >= active.offer.quantity) {
      const reputation = clampReputation(slice.reputation + RISK_PROFILES[active.offer.risk].repWin);
      return {
        slice: {
          ...slice,
          reputation,
          contractsCompleted: slice.contractsCompleted + 1,
          activeContract: null,
          contractOffers: [],
        },
        itemStock: stock,
        events: {
          completed: active.offer,
          failed: null,
          boltsAwarded: active.offer.reward,
          unlock: active.offer.unlocks ?? null,
        },
      };
    }
    if (gameMinutesElapsed > active.deadlineGameMin) {
      const reputation = clampReputation(slice.reputation + RISK_PROFILES[active.offer.risk].repLoss);
      return {
        slice: { ...slice, reputation, activeContract: null, contractOffers: [] },
        itemStock: stock,
        events: { completed: null, failed: active.offer, boltsAwarded: 0, unlock: null },
      };
    }
    return { slice: { ...slice, activeContract: active }, itemStock: stock, events: NO_EVENTS };
  }

  // 3. Aucun contrat actif : régénérer le lot si vide ou périmé.
  const stale =
    slice.contractOffers.length === 0 ||
    gameMinutesElapsed >= slice.offersGeneratedAtGameMin + CONTRACT_OFFER_TTL_GAME_MIN;
  if (!stale) return { slice, itemStock, events: NO_EVENTS };

  // Bootstrap : tant qu'aucun contrat n'a été réussi, on présente le contrat de lancement.
  if (slice.contractsCompleted === 0) {
    if (slice.contractOffers.length === 1 && slice.contractOffers[0].id === LAUNCH_CONTRACT.id) {
      return { slice, itemStock, events: NO_EVENTS };
    }
    return {
      slice: { ...slice, contractOffers: [LAUNCH_CONTRACT], offersGeneratedAtGameMin: gameMinutesElapsed },
      itemStock,
      events: NO_EVENTS,
    };
  }

  const offers = generateOffers(slice.contractSeed, slice.reputation, producible);
  if (offers.length === 0) return { slice, itemStock, events: NO_EVENTS }; // rien à produire encore
  return {
    slice: {
      ...slice,
      contractOffers: offers,
      contractSeed: (slice.contractSeed + 1) >>> 0,
      offersGeneratedAtGameMin: gameMinutesElapsed,
    },
    itemStock,
    events: NO_EVENTS,
  };
}

/**
 * Accepte une offre (PUR) : la transforme en contrat actif (livraison à 0) et calcule
 * la deadline. Renvoie le slice inchangé si l'offre est introuvable ou si un contrat
 * est déjà actif (1 max).
 */
export function acceptOffer(
  slice: ContractSlice,
  offerId: string,
  gameMinutesElapsed: number,
): ContractSlice {
  if (slice.activeContract) return slice;
  const offer = slice.contractOffers.find((o) => o.id === offerId);
  if (!offer) return slice;
  const active: ActiveContract = {
    offer,
    delivered: 0,
    acceptedAtGameMin: gameMinutesElapsed,
    deadlineGameMin: offer.durationMin == null ? Infinity : gameMinutesElapsed + offer.durationMin,
  };
  return { ...slice, activeContract: active, contractOffers: [] };
}
