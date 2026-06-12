import { describe, expect, it } from 'vitest';
import {
  RP_RATE_PER_ITEM_PER_MIN,
  LONG_CLOCK_CAP_MIN,
  MILESTONES,
} from './balance';
import {
  allowedAlternateRecipeIds,
  applyOfflineGains,
  applyProductionTick,
  initialProgression,
  isBuildingUnlocked,
  isRecipeUnlocked,
  milestoneProgress,
  nextMilestone,
  trySpendBolts,
  type ProgressionState,
} from './progression';

/** Recettes mock minimales pour tester le filtrage des alternatives. */
const MOCK_RECIPES = [
  { id: 'iron-plate', alternate: false },
  { id: 'screw', alternate: false },
  { id: 'alt-cast-screw', alternate: true },
  { id: 'alt-iron-wire', alternate: true },
  { id: 'alt-bolted-iron-plate', alternate: true },
];

const NOW = 1_000_000;

function freshState(overrides: Partial<ProgressionState> = {}): ProgressionState {
  return { ...initialProgression(NOW), ...overrides };
}

describe('initialProgression', () => {
  it('démarre vide, horloge calée sur nowMs', () => {
    const s = initialProgression(NOW);
    expect(s.researchPoints).toBe(0);
    expect(s.bolts).toBe(50);
    expect(s.cumulativeProduced).toEqual({});
    expect(s.reachedMilestones).toEqual([]);
    expect(s.unlockedBuildings).toEqual([]);
    expect(s.unlockedRecipes).toEqual([]);
    expect(s.lastSeenMs).toBe(NOW);
    expect(s.prestigeCount).toBe(0);
  });
});

describe('applyProductionTick — accumulation', () => {
  it('accumule la production brute et accrue les AP au prorata de dt', () => {
    const s = freshState();
    const { state, rpGained } = applyProductionTick(s, {
      grossProduction: [{ itemId: 'iron-ingot', ratePerMin: 30 }],
      totalOutputPerMin: 30,
      efficiency: 1,
      dtMin: 2,
      nowMs: NOW + 120_000,
    });

    // 30/min × 2 min = 60 lingots cumulés.
    expect(state.cumulativeProduced['iron-ingot']).toBeCloseTo(60, 6);
    // AP = 30 × 1.0 × (1/3) × 2 min = 20 AP.
    expect(rpGained).toBeCloseTo(30 * RP_RATE_PER_ITEM_PER_MIN * 2, 6);
    expect(state.researchPoints).toBeCloseTo(0 + rpGained, 6);
    expect(state.lastSeenMs).toBe(NOW + 120_000);
  });

  it('dt ≤ 0 (horloge figée) : pas de gain, lastSeen actualisé', () => {
    const s = freshState({ researchPoints: 5 });
    const { state, rpGained } = applyProductionTick(s, {
      grossProduction: [{ itemId: 'iron-ingot', ratePerMin: 30 }],
      totalOutputPerMin: 30,
      efficiency: 1,
      dtMin: -1,
      nowMs: NOW + 1000,
    });
    expect(rpGained).toBe(0);
    expect(state.researchPoints).toBe(5);
    expect(state.cumulativeProduced['iron-ingot'] ?? 0).toBe(0);
    expect(state.lastSeenMs).toBe(NOW + 1000);
  });

  it('efficacité < 1 réduit proportionnellement le taux d’AP (jamais la production d’items)', () => {
    const s = freshState();
    const { state, rpGained } = applyProductionTick(s, {
      grossProduction: [{ itemId: 'iron-ingot', ratePerMin: 30 }],
      totalOutputPerMin: 30,
      efficiency: 0.5,
      dtMin: 1,
      nowMs: NOW + 60_000,
    });
    // AP réduits de moitié…
    expect(rpGained).toBeCloseTo(30 * RP_RATE_PER_ITEM_PER_MIN * 0.5, 6);
    // …mais la production d'items reste la vérité physique (30/min × 1 min).
    expect(state.cumulativeProduced['iron-ingot']).toBeCloseTo(30, 6);
  });
});

describe('applyProductionTick — milestones', () => {
  const m1 = MILESTONES[0]; // ms-iron-ingot-60 → débloque constructor

  it('franchit le premier milestone au bon seuil et débloque le bâtiment', () => {
    const s = freshState();
    // 30/min × 2 min = 60 lingots = seuil exact de M1 (target=60).
    const { state, newlyReached } = applyProductionTick(s, {
      grossProduction: [{ itemId: m1.itemId, ratePerMin: 30 }],
      totalOutputPerMin: 0,
      efficiency: 1,
      dtMin: 2,
      nowMs: NOW + 120_000,
    });

    expect(newlyReached.map((m) => m.id)).toContain(m1.id);
    expect(state.reachedMilestones).toContain(m1.id);
    expect(state.unlockedBuildings).toContain('constructor');
  });

  it('idempotent : un milestone déjà franchi ne se redéclenche pas', () => {
    let s = freshState();
    ({ state: s } = applyProductionTick(s, {
      grossProduction: [{ itemId: m1.itemId, ratePerMin: 30 }],
      totalOutputPerMin: 0,
      efficiency: 1,
      dtMin: 6, // 180 > 60, franchi
      nowMs: NOW + 360_000,
    }));
    expect(s.reachedMilestones).toContain(m1.id);

    // Deuxième tick : on continue de produire, le milestone ne réapparaît pas.
    const { newlyReached, state } = applyProductionTick(s, {
      grossProduction: [{ itemId: m1.itemId, ratePerMin: 30 }],
      totalOutputPerMin: 0,
      efficiency: 1,
      dtMin: 6,
      nowMs: NOW + 720_000,
    });
    expect(newlyReached.map((m) => m.id)).not.toContain(m1.id);
    // Pas de doublon de déblocage.
    expect(state.unlockedBuildings.filter((b) => b === 'constructor')).toHaveLength(1);
  });

  it('un seul tick peut franchir plusieurs milestones du même item', () => {
    // Construisons deux milestones consécutifs sur le même item via gros dt.
    // M1 = iron-ingot 60. Aucun autre milestone iron-ingot dans la table →
    // on vérifie au moins que le franchissement large ne casse rien.
    const s = freshState();
    const { state, newlyReached } = applyProductionTick(s, {
      grossProduction: [{ itemId: m1.itemId, ratePerMin: 30 }],
      totalOutputPerMin: 0,
      efficiency: 1,
      dtMin: 100, // 3000 lingots, très au-delà
      nowMs: NOW + 6_000_000,
    });
    expect(newlyReached.map((m) => m.id)).toContain(m1.id);
    expect(state.reachedMilestones).toContain(m1.id);
  });
});

describe('applyOfflineGains', () => {
  it('attribue les AP hors-ligne plafonnés à 4 h', () => {
    const s = freshState({ lastRpRatePerMin: 10, lastSeenMs: NOW });
    // 5 h écoulées → plafonné à 4 h (240 min).
    const fiveHoursLater = NOW + 5 * 60 * 60 * 1000;
    const { state, rpGained, minutesCredited } = applyOfflineGains(s, fiveHoursLater);

    expect(rpGained).toBeCloseTo(10 * LONG_CLOCK_CAP_MIN, 6); // 10 × 240 = 2400
    expect(minutesCredited).toBeCloseTo(LONG_CLOCK_CAP_MIN, 6);
    expect(state.researchPoints).toBeCloseTo(0 + 2400, 6);
    expect(state.lastSeenMs).toBe(fiveHoursLater);
  });

  it('aucun gain si aucun taux AP connu', () => {
    const s = freshState({ lastRpRatePerMin: 0, lastSeenMs: NOW });
    const { rpGained } = applyOfflineGains(s, NOW + 60 * 60 * 1000);
    expect(rpGained).toBe(0);
  });

  it('aucun gain négatif si l’horloge recule', () => {
    const s = freshState({ lastRpRatePerMin: 10, lastSeenMs: NOW });
    const { rpGained } = applyOfflineGains(s, NOW - 10_000);
    expect(rpGained).toBe(0);
  });
});

describe('application des déblocages', () => {
  it('kit de base : bâtiment non gaté toujours disponible ; bâtiment gaté verrouillé puis débloqué', () => {
    const s = freshState();
    // Smelter / miner / logistique ne sont gatés par aucun milestone → toujours dispo.
    expect(isBuildingUnlocked(s, 'smelter')).toBe(true);
    expect(isBuildingUnlocked(s, 'miner-mk1')).toBe(true);
    expect(isBuildingUnlocked(s, 'splitter')).toBe(true);
    // Constructor est la récompense de M1 → verrouillé au départ.
    expect(isBuildingUnlocked(s, 'constructor')).toBe(false);

    const unlocked = freshState({ unlockedBuildings: ['constructor'] });
    expect(isBuildingUnlocked(unlocked, 'constructor')).toBe(true);
  });

  it('recettes : standard toujours dispo ; alternative gatée verrouillée puis débloquée', () => {
    const s = freshState();
    expect(isRecipeUnlocked(s, 'iron-plate')).toBe(true); // standard
    expect(isRecipeUnlocked(s, 'alt-cast-screw')).toBe(false); // gatée par M4

    const unlocked = freshState({ unlockedRecipes: ['alt-cast-screw'] });
    expect(isRecipeUnlocked(unlocked, 'alt-cast-screw')).toBe(true);
  });

  it('allowedAlternateRecipeIds : vide au départ, contient les alternatives débloquées ensuite', () => {
    const s = freshState();
    expect(allowedAlternateRecipeIds(s, MOCK_RECIPES)).toEqual([]);

    const unlocked = freshState({ unlockedRecipes: ['alt-iron-wire'] });
    expect(allowedAlternateRecipeIds(unlocked, MOCK_RECIPES)).toEqual(['alt-iron-wire']);
  });
});

describe('helpers UI', () => {
  it('nextMilestone renvoie le premier non franchi, puis null une fois tout atteint', () => {
    const s = freshState();
    expect(nextMilestone(s)?.id).toBe(MILESTONES[0].id);

    const allReached = freshState({ reachedMilestones: MILESTONES.map((m) => m.id) });
    expect(nextMilestone(allReached)).toBeNull();
  });

  it('milestoneProgress est borné à [0, 1]', () => {
    const m1 = MILESTONES[0];
    const half = freshState({ cumulativeProduced: { [m1.itemId]: m1.target / 2 } });
    expect(milestoneProgress(half, m1)).toBeCloseTo(0.5, 6);

    const over = freshState({ cumulativeProduced: { [m1.itemId]: m1.target * 10 } });
    expect(milestoneProgress(over, m1)).toBe(1);

    const none = freshState();
    expect(milestoneProgress(none, m1)).toBe(0);
  });
});

describe('trySpendBolts', () => {
  it('déduit le coût si le solde est suffisant', () => {
    const s = freshState({ bolts: 50 });
    const { state, spent } = trySpendBolts(s, 10);
    expect(spent).toBe(true);
    expect(state.bolts).toBe(40);
  });

  it('refuse et laisse l\'état inchangé si le solde est insuffisant', () => {
    const s = freshState({ bolts: 5 });
    const { state, spent } = trySpendBolts(s, 10);
    expect(spent).toBe(false);
    expect(state.bolts).toBe(5);
  });

  it('coût nul ou négatif : toujours accepté, état inchangé', () => {
    const s = freshState({ bolts: 5 });
    const { state, spent } = trySpendBolts(s, 0);
    expect(spent).toBe(true);
    expect(state.bolts).toBe(5);
  });
});
