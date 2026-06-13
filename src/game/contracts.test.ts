import { describe, expect, it } from 'vitest';
import {
  RISK_PROFILES,
  REWARD_PER_UNIT,
  REPUTATION_MIN,
  REPUTATION_MAX,
  clampReputation,
  reputationPayoutMult,
  generateOffers,
  advanceContracts,
  acceptOffer,
  contractProgress,
  LAUNCH_CONTRACT,
  CONTRACT_OFFER_COUNT,
  CONTRACT_OFFER_TTL_GAME_MIN,
  type ContractSlice,
  type ProducibleItem,
} from './contracts';

const PRODUCIBLE: ProducibleItem[] = [
  { itemId: 'iron-ingot', itemName: 'Iron Ingot', throughputPerMin: 30 },
  { itemId: 'iron-plate', itemName: 'Iron Plate', throughputPerMin: 20 },
];

function freshSlice(overrides: Partial<ContractSlice> = {}): ContractSlice {
  return {
    reputation: 0,
    contractsCompleted: 0,
    activeContract: null,
    contractOffers: [],
    contractSeed: 42,
    offersGeneratedAtGameMin: 0,
    ...overrides,
  };
}

describe('réputation', () => {
  it('clampReputation borne à [−3, +3] et arrondit', () => {
    expect(clampReputation(5)).toBe(REPUTATION_MAX);
    expect(clampReputation(-5)).toBe(REPUTATION_MIN);
    expect(clampReputation(1.4)).toBe(1);
  });

  it('reputationPayoutMult : 0.8× à mauvaise réputation, 1.3× à excellente, 1.0× à neutre', () => {
    expect(reputationPayoutMult(0)).toBeCloseTo(1.0, 6);
    expect(reputationPayoutMult(REPUTATION_MAX)).toBeCloseTo(1.3, 6);
    expect(reputationPayoutMult(REPUTATION_MIN)).toBeCloseTo(0.8, 6); // 1−0.3 = 0.7 clampé à 0.8
  });
});

describe('generateOffers', () => {
  it('déterministe : même graine ⇒ mêmes offres', () => {
    const a = generateOffers(7, 0, PRODUCIBLE);
    const b = generateOffers(7, 0, PRODUCIBLE);
    expect(a).toEqual(b);
  });

  it('présente 3 offres, une de chaque risque (standard/tight/hard)', () => {
    const offers = generateOffers(7, 0, PRODUCIBLE);
    expect(offers).toHaveLength(CONTRACT_OFFER_COUNT);
    expect(offers.map((o) => o.risk)).toEqual(['standard', 'tight', 'hard']);
  });

  it('quantité dérivée du débit réel = débit × durée × qtyFactor (toujours réalisable)', () => {
    // Usine à un seul item pour rendre la cible déterministe.
    const single: ProducibleItem[] = [{ itemId: 'iron-ingot', itemName: 'Iron Ingot', throughputPerMin: 30 }];
    const offers = generateOffers(1, 0, single);
    const std = offers.find((o) => o.risk === 'standard')!;
    const p = RISK_PROFILES.standard;
    expect(std.quantity).toBe(Math.round(30 * p.durationMin * p.qtyFactor)); // 30×8×0.8 = 192
  });

  it('le risque « serré » exige plus que la capacité sur le délai (il faut pousser)', () => {
    const single: ProducibleItem[] = [{ itemId: 'iron-ingot', itemName: 'Iron Ingot', throughputPerMin: 30 }];
    const tight = generateOffers(1, 0, single).find((o) => o.risk === 'tight')!;
    // À 30/min sur 6 min on produit 180 ; la demande (198) dépasse → améliorer/étendre.
    expect(tight.quantity).toBeGreaterThan(30 * RISK_PROFILES.tight.durationMin);
  });

  it('récompense croissante avec le risque', () => {
    const offers = generateOffers(7, 0, PRODUCIBLE);
    const std = offers.find((o) => o.risk === 'standard')!;
    const hard = offers.find((o) => o.risk === 'hard')!;
    expect(hard.reward).toBeGreaterThan(std.reward);
  });

  it('une meilleure réputation augmente la récompense', () => {
    const low = generateOffers(7, -3, PRODUCIBLE)[0];
    const high = generateOffers(7, 3, PRODUCIBLE)[0];
    expect(high.reward).toBeGreaterThan(low.reward);
  });

  it('usine qui ne produit rien → aucune offre procédurale', () => {
    expect(generateOffers(7, 0, [])).toEqual([]);
    expect(generateOffers(7, 0, [{ itemId: 'x', itemName: 'X', throughputPerMin: 0 }])).toEqual([]);
  });

  it('récompense ≈ quantité × REWARD_PER_UNIT × rewardMult à réputation neutre', () => {
    const single: ProducibleItem[] = [{ itemId: 'iron-ingot', itemName: 'Iron Ingot', throughputPerMin: 30 }];
    const std = generateOffers(1, 0, single).find((o) => o.risk === 'standard')!;
    expect(std.reward).toBe(Math.round(std.quantity * REWARD_PER_UNIT * 1.0 * 1.0));
  });
});

describe('advanceContracts — bootstrap (contrat de lancement)', () => {
  it('aucun contrat réussi → présente le contrat de lancement', () => {
    const { slice } = advanceContracts(freshSlice(), {}, 0, []);
    expect(slice.contractOffers).toHaveLength(1);
    expect(slice.contractOffers[0].id).toBe(LAUNCH_CONTRACT.id);
  });

  it('contrat de lancement déjà présenté → pas de régénération en boucle', () => {
    const s1 = advanceContracts(freshSlice(), {}, 0, []).slice;
    const s2 = advanceContracts(s1, {}, 1, []).slice;
    expect(s2.contractOffers).toBe(s1.contractOffers); // référence inchangée
  });
});

describe('advanceContracts — livraison depuis le stock', () => {
  it('stock suffisant → livraison instantanée, Bolts crédités, réputation +1, contrat clos', () => {
    const active = {
      offer: LAUNCH_CONTRACT,
      delivered: 0,
      acceptedAtGameMin: 0,
      deadlineGameMin: Infinity,
    };
    const slice = freshSlice({ activeContract: active });
    const { slice: next, itemStock, events } = advanceContracts(slice, { 'iron-ingot': 60 }, 5, []);

    expect(events.completed?.id).toBe(LAUNCH_CONTRACT.id);
    expect(events.boltsAwarded).toBe(LAUNCH_CONTRACT.reward);
    expect(events.unlock).toEqual({ type: 'building', id: 'constructor' });
    expect(next.contractsCompleted).toBe(1);
    expect(next.reputation).toBe(1);
    expect(next.activeContract).toBeNull();
    expect(itemStock['iron-ingot']).toBe(0); // stock entièrement prélevé
  });

  it('stock partiel → prélèvement partiel, contrat conservé avec sa progression', () => {
    const active = {
      offer: { ...LAUNCH_CONTRACT, quantity: 60 },
      delivered: 10,
      acceptedAtGameMin: 0,
      deadlineGameMin: Infinity,
    };
    const slice = freshSlice({ activeContract: active });
    // 40 en stock, il manquait 50 → prélève 40, reste 50 à livrer.
    const { slice: next, itemStock, events } = advanceContracts(slice, { 'iron-ingot': 40 }, 3, []);
    expect(events.completed).toBeNull();
    expect(next.activeContract?.delivered).toBe(50);
    expect(itemStock['iron-ingot']).toBe(0);
  });
});

describe('advanceContracts — échec sur deadline', () => {
  it('deadline de jeu dépassée → réputation −1, pas de Bolts, contrat clos', () => {
    const offer = generateOffers(1, 0, PRODUCIBLE).find((o) => o.risk === 'tight')!;
    const active = { offer, delivered: 0, acceptedAtGameMin: 0, deadlineGameMin: 6 };
    const slice = freshSlice({ contractsCompleted: 1, activeContract: active });
    // gameMin 7 > deadline 6, livraison nulle.
    const { slice: next, events } = advanceContracts(slice, {}, 7, PRODUCIBLE);
    expect(events.failed?.id).toBe(offer.id);
    expect(events.boltsAwarded).toBe(0);
    expect(next.reputation).toBe(RISK_PROFILES.tight.repLoss); // −1
    expect(next.activeContract).toBeNull();
  });

  it('le cornélien échoué coûte plus de réputation (−2)', () => {
    const offer = generateOffers(1, 0, PRODUCIBLE).find((o) => o.risk === 'hard')!;
    const active = { offer, delivered: 0, acceptedAtGameMin: 0, deadlineGameMin: 5 };
    const slice = freshSlice({ contractsCompleted: 1, activeContract: active, reputation: 2 });
    const { slice: next } = advanceContracts(slice, {}, 6, PRODUCIBLE);
    expect(next.reputation).toBe(0); // 2 + (−2)
  });
});

describe('advanceContracts — régénération procédurale', () => {
  it('après 1 contrat réussi, sans actif et lot périmé → offres procédurales', () => {
    const slice = freshSlice({ contractsCompleted: 1, offersGeneratedAtGameMin: 0 });
    const { slice: next } = advanceContracts(slice, {}, CONTRACT_OFFER_TTL_GAME_MIN, PRODUCIBLE);
    expect(next.contractOffers).toHaveLength(CONTRACT_OFFER_COUNT);
    expect(next.contractSeed).toBe(43); // graine avancée
  });

  it('lot encore valide (non périmé) → pas de régénération', () => {
    const offers = generateOffers(42, 0, PRODUCIBLE);
    const slice = freshSlice({ contractsCompleted: 1, contractOffers: offers, offersGeneratedAtGameMin: 0 });
    const { slice: next } = advanceContracts(slice, {}, 3, PRODUCIBLE);
    expect(next.contractOffers).toBe(offers);
  });
});

describe('acceptOffer', () => {
  it('transforme une offre en contrat actif (livraison à 0) et calcule la deadline', () => {
    const offers = generateOffers(42, 0, PRODUCIBLE);
    const slice = freshSlice({ contractsCompleted: 1, contractOffers: offers });
    const target = offers[1]; // tight, durationMin 6
    const next = acceptOffer(slice, target.id, 12);

    expect(next.activeContract?.offer.id).toBe(target.id);
    expect(next.activeContract?.delivered).toBe(0);
    expect(next.activeContract?.deadlineGameMin).toBe(12 + 6);
    expect(next.contractOffers).toEqual([]); // les autres offres disparaissent
  });

  it('contrat de lancement (sans délai) → deadline = Infinity', () => {
    const slice = advanceContracts(freshSlice(), {}, 0, []).slice;
    const next = acceptOffer(slice, LAUNCH_CONTRACT.id, 0);
    expect(next.activeContract?.deadlineGameMin).toBe(Infinity);
  });

  it('refuse une 2e acceptation tant qu’un contrat est actif (1 max)', () => {
    const offers = generateOffers(42, 0, PRODUCIBLE);
    const slice = freshSlice({ contractsCompleted: 1, contractOffers: offers });
    const once = acceptOffer(slice, offers[0].id, 0);
    const twice = acceptOffer(once, offers[1].id, 0);
    expect(twice).toBe(once);
  });

  it('offre introuvable → slice inchangé', () => {
    const slice = freshSlice({ contractsCompleted: 1, contractOffers: generateOffers(42, 0, PRODUCIBLE) });
    expect(acceptOffer(slice, 'inconnu', 0)).toBe(slice);
  });
});

describe('contractProgress', () => {
  it('= quantité déjà livrée', () => {
    const active = { offer: LAUNCH_CONTRACT, delivered: 30, acceptedAtGameMin: 0, deadlineGameMin: Infinity };
    expect(contractProgress(active)).toBe(30);
  });
});
