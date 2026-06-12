/**
 * balance.test.ts — Verrou Vitest sur toutes les formules d'équilibrage.
 *
 * Chaque valeur attendue est calculée à la main, dérivée directement de la
 * physique du dataset (débit réel) ou des formules de balance.ts.
 *
 * Règle : un test qui PASSE prouve qu'un nombre de design est juste.
 *         Un test qui ÉCHOUE expose un bug ou un changement de design non assumé.
 */

import { describe, expect, it } from 'vitest';
import {
  // AP
  RP_RATE_PER_ITEM_PER_MIN,
  computeRpRate,
  // Horloges
  SHORT_CLOCK_CAP_MIN,
  LONG_CLOCK_CAP_MIN,
  LONG_CLOCK_CAP_MS,
  computeOfflineGains,
  OFFLINE_RECAP_MIN_MINUTES,
  OFFLINE_RECAP_MIN_RP,
  shouldShowOfflineRecap,
  // Courbes idle
  UPGRADE_COST_RATIO,
  UPGRADE_PROD_RATIO,
  upgradeCost,
  upgradeProduction,
  AP_GENERATOR_BASE_COST,
  // Milestones
  MILESTONES,
  isMilestoneReached,
  checkNewlyReachedMilestones,
  // Score d'efficacité
  EFFICIENCY_WEIGHTS,
  computeEfficiencyScore,
  // Prestige
  BASE_PRESTIGE_MULT,
  PRESTIGE_MIN_EFFICIENCY,
  isPrestigeAvailable,
  prestigeMultiplier,
} from './balance';

// Tolérance pour les comparaisons flottantes (erreur maximale acceptable : 0.001 %)
const EPSILON = 1e-5;

// ---------------------------------------------------------------------------
// 1. Monnaie méta — Automation Points
// ---------------------------------------------------------------------------

describe('Monnaie méta (AP)', () => {
  it('constante RP_RATE_PER_ITEM_PER_MIN ≈ 0.3333', () => {
    expect(RP_RATE_PER_ITEM_PER_MIN).toBeCloseTo(1 / 3, 5);
  });

  it('taux nominal : 30 items/min, efficacité 1.0 → 10 AP/min', () => {
    // 30 * 1.0 * (1/3) = 10.0
    expect(computeRpRate(30, 1.0)).toBeCloseTo(10.0, 5);
  });

  it('taux nominal : 30 items/min, efficacité 0.5 → 5 AP/min', () => {
    // 30 * 0.5 * (1/3) = 5.0
    expect(computeRpRate(30, 0.5)).toBeCloseTo(5.0, 5);
  });

  it('usine vide : 0 items/min → 0 AP/min', () => {
    expect(computeRpRate(0, 1.0)).toBe(0);
  });

  it('efficacité nulle : → 0 AP/min', () => {
    expect(computeRpRate(30, 0)).toBe(0);
  });

  it('efficacité > 1 est clampée à 1 : 30 items/min, efficacité 1.5 → 10 AP/min', () => {
    // efficacité clampée à 1.0 : 30 * 1.0 * (1/3) = 10.0
    expect(computeRpRate(30, 1.5)).toBeCloseTo(10.0, 5);
  });

  it('efficacité négative → 0 AP/min', () => {
    expect(computeRpRate(30, -0.5)).toBe(0);
  });

  it('calibration design : usine 30 Reinforced Iron Plate/min → ~10 AP/min', () => {
    // 30 items_sortie/min × 1.0 × (1/3) = 10 AP/min
    // Note : on passe le débit de sortie final (30 RIP/min), pas les intermédiaires.
    expect(computeRpRate(30, 1.0)).toBeCloseTo(10.0, 5);
  });
});

// ---------------------------------------------------------------------------
// 2. Horloges de réengagement et offline
// ---------------------------------------------------------------------------

describe('Horloges de réengagement', () => {
  it('SHORT_CLOCK_CAP_MIN = 20', () => {
    expect(SHORT_CLOCK_CAP_MIN).toBe(20);
  });

  it('LONG_CLOCK_CAP_MIN = 240 (4 heures)', () => {
    expect(LONG_CLOCK_CAP_MIN).toBe(240);
  });

  it('LONG_CLOCK_CAP_MS = 14_400_000 ms', () => {
    // 240 min × 60 s × 1000 ms = 14_400_000
    expect(LONG_CLOCK_CAP_MS).toBe(14_400_000);
  });
});

describe('computeOfflineGains', () => {
  it('5 min écoulées, 10 AP/min → 50 AP', () => {
    // elapsed = 5 × 60_000 ms ; < cap ; gains = 10 × 5 = 50
    expect(computeOfflineGains(10, 0, 5 * 60_000)).toBeCloseTo(50, 5);
  });

  it('300 min écoulées, plafond à 240 min → 2400 AP (pas 3000)', () => {
    // elapsed = 300 min ; cappé à 240 min ; gains = 10 × 240 = 2400
    expect(computeOfflineGains(10, 0, 300 * 60_000)).toBeCloseTo(2400, 5);
  });

  it('exactement 4 h écoulées → plein cap atteint', () => {
    // 240 min exactement = plafond exact ; gains = 10 × 240 = 2400
    expect(computeOfflineGains(10, 0, 240 * 60_000)).toBeCloseTo(2400, 5);
  });

  it('horloge qui recule (nowMs < lastSeenMs) → 0 AP (garde-fou)', () => {
    // elapsed < 0 → clampé à 0
    expect(computeOfflineGains(10, 1000, 500)).toBe(0);
  });

  it('taux AP nul → 0 AP même si temps long', () => {
    expect(computeOfflineGains(0, 0, 300 * 60_000)).toBe(0);
  });

  it('taux AP négatif → 0 AP (garde-fou)', () => {
    expect(computeOfflineGains(-5, 0, 60_000)).toBe(0);
  });

  it('1 minute écoulée, 10 AP/min → 10 AP', () => {
    expect(computeOfflineGains(10, 0, 60_000)).toBeCloseTo(10, 5);
  });
});

describe('shouldShowOfflineRecap', () => {
  it('seuils : 1 min / 1 AP', () => {
    expect(OFFLINE_RECAP_MIN_MINUTES).toBe(1);
    expect(OFFLINE_RECAP_MIN_RP).toBe(1);
  });

  it('reload rapide (10 s, 1.6 AP) → pas de popup', () => {
    // 10 s = 0.167 min < 1 min, même si les AP suffisent.
    expect(shouldShowOfflineRecap(1.6, 10 / 60)).toBe(false);
  });

  it('absence longue mais usine à l’arrêt (0 AP) → pas de popup', () => {
    expect(shouldShowOfflineRecap(0, 120)).toBe(false);
  });

  it('5 min d’absence à 10 AP/min (50 AP) → popup', () => {
    expect(shouldShowOfflineRecap(50, 5)).toBe(true);
  });

  it('exactement aux seuils (1 AP, 1 min) → popup', () => {
    expect(shouldShowOfflineRecap(1, 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Courbes idle (coût × 1.15^N, prod × 1.10^N)
// ---------------------------------------------------------------------------

describe('Courbes idle — upgradeCost', () => {
  it('UPGRADE_COST_RATIO = 1.15', () => {
    expect(UPGRADE_COST_RATIO).toBe(1.15);
  });

  it('coût(base=50, level=0) = 50 (premier achat)', () => {
    // 50 × 1.15^0 = 50 × 1 = 50
    expect(upgradeCost(50, 0)).toBeCloseTo(50, 5);
  });

  it('coût(base=50, level=1) = 57.5', () => {
    // 50 × 1.15^1 = 57.5
    expect(upgradeCost(50, 1)).toBeCloseTo(57.5, 5);
  });

  it('coût(base=50, level=5) ≈ 100.568', () => {
    // 50 × 1.15^5 = 50 × 2.01136 = 100.568
    expect(upgradeCost(50, 5)).toBeCloseTo(100.568, 2);
  });

  it('coût(base=50, level=10) ≈ 202.278', () => {
    // 50 × 1.15^10 = 50 × 4.04556 = 202.278
    expect(upgradeCost(50, 10)).toBeCloseTo(202.278, 2);
  });

  it('coût(base=50, level=20) ≈ 818.325', () => {
    // 50 × 1.15^20 = 50 × 16.3665 = 818.325
    expect(upgradeCost(50, 20)).toBeCloseTo(818.325, 1);
  });

  it('coût(base=100, level=0) = 100 (base différente)', () => {
    expect(upgradeCost(100, 0)).toBeCloseTo(100, 5);
  });

  it('level négatif → RangeError', () => {
    expect(() => upgradeCost(50, -1)).toThrow(RangeError);
  });
});

describe('Courbes idle — upgradeProduction', () => {
  it('UPGRADE_PROD_RATIO = 1.10', () => {
    expect(UPGRADE_PROD_RATIO).toBe(1.1);
  });

  it('prod(base=1.0, level=0) = 1.0', () => {
    // 1.0 × 1.1^0 = 1.0
    expect(upgradeProduction(1.0, 0)).toBeCloseTo(1.0, 5);
  });

  it('prod(base=1.0, level=1) = 1.1', () => {
    // 1.0 × 1.1^1 = 1.1
    expect(upgradeProduction(1.0, 1)).toBeCloseTo(1.1, 5);
  });

  it('prod(base=1.0, level=5) ≈ 1.61051', () => {
    // 1.0 × 1.1^5 = 1.61051
    expect(upgradeProduction(1.0, 5)).toBeCloseTo(1.61051, 4);
  });

  it('prod(base=1.0, level=10) ≈ 2.59374', () => {
    // 1.0 × 1.1^10 = 2.59374
    expect(upgradeProduction(1.0, 10)).toBeCloseTo(2.59374, 4);
  });

  it('prod(base=2.0, level=5) ≈ 3.22102', () => {
    // 2.0 × 1.1^5 = 2.0 × 1.61051 = 3.22102
    expect(upgradeProduction(2.0, 5)).toBeCloseTo(3.22102, 4);
  });

  it('level négatif → RangeError', () => {
    expect(() => upgradeProduction(1.0, -1)).toThrow(RangeError);
  });
});

describe('Cohérence des courbes', () => {
  it('AP_GENERATOR_BASE_COST = 50 AP', () => {
    expect(AP_GENERATOR_BASE_COST).toBe(50);
  });

  it('à 10 AP/min, le premier upgrade (50 AP) coûte 5 minutes exactes', () => {
    const minutesToAfford = AP_GENERATOR_BASE_COST / 10;
    expect(minutesToAfford).toBe(5);
  });

  it('chaque niveau coûte bien ×1.15 de plus que le précédent', () => {
    const base = 50;
    for (let n = 0; n < 10; n++) {
      const ratio = upgradeCost(base, n + 1) / upgradeCost(base, n);
      expect(ratio).toBeCloseTo(1.15, 5);
    }
  });

  it('chaque niveau produit bien ×1.10 de plus que le précédent', () => {
    const base = 1.0;
    for (let n = 0; n < 10; n++) {
      const ratio = upgradeProduction(base, n + 1) / upgradeProduction(base, n);
      expect(ratio).toBeCloseTo(1.1, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Milestones de production
// ---------------------------------------------------------------------------

describe('Table MILESTONES', () => {
  it('13 milestones définis', () => {
    expect(MILESTONES).toHaveLength(13);
  });

  it('tous les milestones ont un id unique', () => {
    const ids = MILESTONES.map((m) => m.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(MILESTONES.length);
  });

  it('M1 : iron-ingot, target=60, 2 min nominales, débloque constructor (Hook)', () => {
    const m = MILESTONES[0];
    expect(m.itemId).toBe('iron-ingot');
    expect(m.target).toBe(60);
    expect(m.estimatedMinutesNominal).toBeCloseTo(2.0, 1);
    // 60 / 30 (Smelter : 1*60/2 = 30/min) = 2.0 min ✓
    expect(m.unlocks.type).toBe('building');
    expect(m.unlocks.id).toBe('constructor');
  });

  it('M1 : vérification calcul de temps → 60 items / 30 per min = 2.0 min', () => {
    const ironIngotRatePerMin = 30; // Smelter : 1*60/2 = 30/min
    const expectedMin = MILESTONES[0].target / ironIngotRatePerMin;
    expect(expectedMin).toBeCloseTo(2.0, 5);
  });

  it('M2 : iron-rod, target=150, 10 min nominales, débloque miner-mk2 (Gate capacité ×2)', () => {
    const m = MILESTONES[1];
    expect(m.itemId).toBe('iron-rod');
    expect(m.target).toBe(150);
    expect(m.estimatedMinutesNominal).toBeCloseTo(10.0, 1);
    // 150 / 15 (Constructor : 1*60/4 = 15/min) = 10.0 min ✓
    expect(m.unlocks.type).toBe('building');
    expect(m.unlocks.id).toBe('miner-mk2');
  });

  it('M2 : vérification calcul de temps → 150 items / 15 per min = 10.0 min', () => {
    const ironRodRatePerMin = 15; // Constructor : 1*60/4 = 15/min
    const expectedMin = MILESTONES[1].target / ironRodRatePerMin;
    expect(expectedMin).toBeCloseTo(10.0, 5);
  });

  it('M3 : iron-plate, target=300, 15 min nominales, débloque assembler', () => {
    const m = MILESTONES[2];
    expect(m.itemId).toBe('iron-plate');
    expect(m.target).toBe(300);
    expect(m.estimatedMinutesNominal).toBeCloseTo(15.0, 1);
    // 300 / 20 (Constructor : 2*60/6 = 20/min) = 15.0 min ✓
    expect(m.unlocks.type).toBe('building');
    expect(m.unlocks.id).toBe('assembler');
  });

  it('M4 : screw, target=400, 10 min nominales, débloque alt-cast-screw', () => {
    const m = MILESTONES[3];
    expect(m.itemId).toBe('screw');
    expect(m.target).toBe(400);
    expect(m.estimatedMinutesNominal).toBeCloseTo(10.0, 1);
    // 400 / 40 (Constructor : 4*60/6 = 40/min) = 10.0 min ✓
    expect(m.unlocks.type).toBe('recipe');
    expect(m.unlocks.id).toBe('alt-cast-screw');
  });

  it('M5 : reinforced-iron-plate, target=75, 15 min nominales, débloque foundry', () => {
    const m = MILESTONES[4];
    expect(m.itemId).toBe('reinforced-iron-plate');
    expect(m.target).toBe(75);
    expect(m.estimatedMinutesNominal).toBeCloseTo(15.0, 1);
    // 75 / 5 (Assembler : 1*60/12 = 5/min) = 15.0 min ✓
    expect(m.unlocks.type).toBe('building');
    expect(m.unlocks.id).toBe('foundry');
  });

  it('M6 : wire, target=500, ~16.7 min nominales, débloque miner-mk3 (Gate capacité ×4)', () => {
    const m = MILESTONES[5];
    expect(m.itemId).toBe('wire');
    expect(m.target).toBe(500);
    expect(m.estimatedMinutesNominal).toBeCloseTo(16.7, 1);
    // 500 / 30 (Constructor : 2*60/4 = 30/min) = 16.666... min ✓
    expect(m.unlocks.type).toBe('building');
    expect(m.unlocks.id).toBe('miner-mk3');
  });

  it('M6 : vérification calcul de temps → 500 items / 30 per min ≈ 16.667 min', () => {
    const wireRatePerMin = 30; // Constructor : 2*60/4 = 30/min
    const expectedMin = MILESTONES[5].target / wireRatePerMin;
    expect(expectedMin).toBeCloseTo(500 / 30, 4);
  });

  it('M7 : cable, target=300, 10 min nominales, débloque manufacturer', () => {
    const m = MILESTONES[6];
    expect(m.itemId).toBe('cable');
    expect(m.target).toBe(300);
    expect(m.estimatedMinutesNominal).toBeCloseTo(10.0, 1);
    // 300 / 30 (Constructor : 1*60/2 = 30/min) = 10.0 min ✓
    expect(m.unlocks.type).toBe('building');
    expect(m.unlocks.id).toBe('manufacturer');
  });

  it('M8 : concrete, target=375, 25 min nominales, débloque alt-bolted-iron-plate', () => {
    const m = MILESTONES[7];
    expect(m.itemId).toBe('concrete');
    expect(m.target).toBe(375);
    expect(m.estimatedMinutesNominal).toBeCloseTo(25.0, 1);
    // 375 / 15 (Constructor : 1*60/4 = 15/min) = 25.0 min ✓
    expect(m.unlocks.type).toBe('recipe');
    expect(m.unlocks.id).toBe('alt-bolted-iron-plate');
  });

  it('M8 : vérification calcul de temps → 375 items / 15 per min = 25.0 min', () => {
    const concreteRatePerMin = 15; // Constructor : 1*60/4 = 15/min
    const expectedMin = MILESTONES[7].target / concreteRatePerMin;
    expect(expectedMin).toBeCloseTo(25.0, 5);
  });

  it('M9 : modular-frame, target=50, 25 min nominales, débloque alt-iron-wire', () => {
    const m = MILESTONES[8];
    expect(m.itemId).toBe('modular-frame');
    expect(m.target).toBe(50);
    expect(m.estimatedMinutesNominal).toBeCloseTo(25.0, 1);
    // 50 / 2 (Assembler : 2*60/60 = 2/min) = 25.0 min ✓
    expect(m.unlocks.type).toBe('recipe');
    expect(m.unlocks.id).toBe('alt-iron-wire');
  });

  it('M10 : modular-frame, target=150, 75 min nominales, hint prestige (Hobby gate)', () => {
    const m = MILESTONES[9];
    expect(m.itemId).toBe('modular-frame');
    expect(m.target).toBe(150);
    expect(m.estimatedMinutesNominal).toBeCloseTo(75.0, 1);
    // 150 / 2 (Assembler : 2*60/60 = 2/min) = 75.0 min ✓
    expect(m.unlocks.type).toBe('hint');
    expect(m.unlocks.id).toBe('prestige-available');
  });

  it('M10 : vérification calcul de temps → 150 items / 2 per min = 75.0 min', () => {
    const modularFrameRatePerMin = 2; // Assembler : 2*60/60 = 2/min
    const expectedMin = MILESTONES[9].target / modularFrameRatePerMin;
    expect(expectedMin).toBeCloseTo(75.0, 5);
  });

  it('M11 : steel, target=200, 20 min nominales, débloque alt-steel-cast (Hobby)', () => {
    const m = MILESTONES[10];
    expect(m.itemId).toBe('steel');
    expect(m.target).toBe(200);
    expect(m.estimatedMinutesNominal).toBeCloseTo(20.0, 1);
    // 200 / 10 (Foundry : 1*60/6 = 10/min) = 20.0 min ✓
    expect(m.unlocks.type).toBe('recipe');
    expect(m.unlocks.id).toBe('alt-steel-cast');
  });

  it('M12 : circuit-board, target=75, 10 min nominales, débloque alt-fused-circuit', () => {
    const m = MILESTONES[11];
    expect(m.itemId).toBe('circuit-board');
    expect(m.target).toBe(75);
    expect(m.estimatedMinutesNominal).toBeCloseTo(10.0, 1);
    // 75 / 7.5 (Assembler : 1*60/8 = 7.5/min) = 10.0 min ✓
    expect(m.unlocks.type).toBe('recipe');
    expect(m.unlocks.id).toBe('alt-fused-circuit');
  });

  it('M13 : motor, target=50, 10 min nominales, débloque alt-automated-motor', () => {
    const m = MILESTONES[12];
    expect(m.itemId).toBe('motor');
    expect(m.target).toBe(50);
    expect(m.estimatedMinutesNominal).toBeCloseTo(10.0, 1);
    // 50 / 5 (Assembler : 1*60/12 = 5/min) = 10.0 min ✓
    expect(m.unlocks.type).toBe('recipe');
    expect(m.unlocks.id).toBe('alt-automated-motor');
  });

  it('tous les estimatedMinutesNominal sont corrects par rapport à la physique du dataset', () => {
    // Débits nominaux (1 machine) issus du dataset :
    const ratePerMin: Record<string, number> = {
      'iron-ingot': 30,     // Smelter : 1*60/2 = 30/min
      'iron-rod': 15,       // Constructor : 1*60/4 = 15/min
      'iron-plate': 20,     // Constructor : 2*60/6 = 20/min
      'screw': 40,          // Constructor : 4*60/6 = 40/min
      'reinforced-iron-plate': 5,  // Assembler : 1*60/12 = 5/min
      'wire': 30,           // Constructor : 2*60/4 = 30/min
      'cable': 30,          // Constructor : 1*60/2 = 30/min
      'concrete': 15,       // Constructor : 1*60/4 = 15/min
      'modular-frame': 2,   // Assembler : 2*60/60 = 2/min
      'steel': 10,          // Foundry : 1*60/6 = 10/min
      'circuit-board': 7.5, // Assembler : 1*60/8 = 7.5/min
      'motor': 5,           // Assembler : 1*60/12 = 5/min
    };
    for (const m of MILESTONES) {
      const rate = ratePerMin[m.itemId];
      if (rate !== undefined) {
        const expectedMin = m.target / rate;
        expect(m.estimatedMinutesNominal).toBeCloseTo(expectedMin, 0);
      }
    }
  });

  it('les deux gates de capacité (miner-mk2, miner-mk3) sont bien présentes', () => {
    const buildingUnlocks = MILESTONES.filter((m) => m.unlocks.type === 'building').map(
      (m) => m.unlocks.id,
    );
    expect(buildingUnlocks).toContain('miner-mk2');
    expect(buildingUnlocks).toContain('miner-mk3');
  });

  it('miner-mk2 est débloqué avant miner-mk3 (ordre des gates)', () => {
    const mk2Idx = MILESTONES.findIndex((m) => m.unlocks.id === 'miner-mk2');
    const mk3Idx = MILESTONES.findIndex((m) => m.unlocks.id === 'miner-mk3');
    expect(mk2Idx).toBeGreaterThanOrEqual(0);
    expect(mk3Idx).toBeGreaterThanOrEqual(0);
    expect(mk2Idx).toBeLessThan(mk3Idx);
  });
});

describe('isMilestoneReached', () => {
  // M1 : iron-ingot, target=60
  const m = MILESTONES[0];

  it('non atteint si produit = 0', () => {
    expect(isMilestoneReached(m, new Map())).toBe(false);
  });

  it('non atteint si produit < target', () => {
    expect(isMilestoneReached(m, new Map([['iron-ingot', 59]]))).toBe(false);
  });

  it('atteint exactement au seuil (59 → false, 60 → true)', () => {
    expect(isMilestoneReached(m, new Map([['iron-ingot', 59]]))).toBe(false);
    expect(isMilestoneReached(m, new Map([['iron-ingot', 60]]))).toBe(true);
  });

  it('atteint si produit > target', () => {
    expect(isMilestoneReached(m, new Map([['iron-ingot', 100]]))).toBe(true);
  });

  it('item différent de celui du milestone → non atteint', () => {
    expect(isMilestoneReached(m, new Map([['iron-rod', 200]]))).toBe(false);
  });
});

describe('checkNewlyReachedMilestones', () => {
  it('retourne les milestones nouvellement franchis', () => {
    const produced = new Map([
      ['iron-ingot', 60],   // M1 target=60
      ['iron-rod', 150],    // M2 target=150
    ]);
    const alreadyReached = new Set<string>();
    const newly = checkNewlyReachedMilestones(MILESTONES, alreadyReached, produced);
    expect(newly.map((m) => m.id)).toContain('ms-iron-ingot-60');
    expect(newly.map((m) => m.id)).toContain('ms-iron-rod-150');
    expect(newly).toHaveLength(2);
  });

  it('idempotent : un milestone déjà atteint ne reparaît pas', () => {
    const produced = new Map([['iron-ingot', 100]]);
    const alreadyReached = new Set(['ms-iron-ingot-60']);
    const newly = checkNewlyReachedMilestones(MILESTONES, alreadyReached, produced);
    expect(newly.map((m) => m.id)).not.toContain('ms-iron-ingot-60');
  });

  it('aucun milestone atteint si production insuffisante', () => {
    const produced = new Map([['iron-ingot', 50]]);
    const alreadyReached = new Set<string>();
    const newly = checkNewlyReachedMilestones(MILESTONES, alreadyReached, produced);
    expect(newly).toHaveLength(0);
  });

  it('ne déclenche pas de milestone pour un autre item que celui suivi', () => {
    // M1 suit iron-ingot ; remplir copper-ingot ne le déclenche pas.
    const produced = new Map([['copper-ingot', 1000]]);
    const alreadyReached = new Set<string>();
    const newly = checkNewlyReachedMilestones(MILESTONES, alreadyReached, produced);
    expect(newly).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 5. Score d'efficacité
// ---------------------------------------------------------------------------

describe('EFFICIENCY_WEIGHTS', () => {
  it('pondérations resources+machines+energy = 1.0', () => {
    const sum = EFFICIENCY_WEIGHTS.resources + EFFICIENCY_WEIGHTS.machines + EFFICIENCY_WEIGHTS.energy;
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('resources = 0.4', () => {
    expect(EFFICIENCY_WEIGHTS.resources).toBe(0.4);
  });

  it('machines = 0.35', () => {
    expect(EFFICIENCY_WEIGHTS.machines).toBe(0.35);
  });

  it('energy = 0.25', () => {
    expect(EFFICIENCY_WEIGHTS.energy).toBe(0.25);
  });
});

describe('computeEfficiencyScore', () => {
  it('usine parfaite (actual = optimal sur les 3 dimensions) → score global 1.0', () => {
    const score = computeEfficiencyScore(30, 30, 1, 1, 4, 4);
    expect(score.resources.score).toBeCloseTo(1.0, 5);
    expect(score.machines.score).toBeCloseTo(1.0, 5);
    expect(score.energy.score).toBeCloseTo(1.0, 5);
    expect(score.global).toBeCloseTo(1.0, 5);
  });

  it('usine 2× sous-optimale (actual = 2 × optimal) → score global 0.5', () => {
    // resources: 30/60=0.5, machines: 1/2=0.5, energy: 4/8=0.5
    // global = 0.5×0.4 + 0.5×0.35 + 0.5×0.25 = 0.5
    const score = computeEfficiencyScore(60, 30, 2, 1, 8, 4);
    expect(score.resources.score).toBeCloseTo(0.5, 5);
    expect(score.machines.score).toBeCloseTo(0.5, 5);
    expect(score.energy.score).toBeCloseTo(0.5, 5);
    expect(score.global).toBeCloseTo(0.5, 5);
  });

  it('dimensions mixtes : resources 1.5×, machines 2×, energy 1.5× sous-optim', () => {
    // resources: 30/45 ≈ 0.6667, machines: 1/2 = 0.5, energy: 4/6 ≈ 0.6667
    // global = 0.6667×0.4 + 0.5×0.35 + 0.6667×0.25
    //        = 0.26668 + 0.175 + 0.16668 = 0.6083...
    const score = computeEfficiencyScore(45, 30, 2, 1, 6, 4);
    expect(score.resources.score).toBeCloseTo(30 / 45, 5);
    expect(score.machines.score).toBeCloseTo(0.5, 5);
    expect(score.energy.score).toBeCloseTo(4 / 6, 5);
    const expectedGlobal =
      (30 / 45) * 0.4 + 0.5 * 0.35 + (4 / 6) * 0.25;
    expect(score.global).toBeCloseTo(expectedGlobal, 5);
  });

  it('score ne peut pas dépasser 1.0 (si usine = optimal)', () => {
    const score = computeEfficiencyScore(30, 30, 3, 3, 12, 12);
    expect(score.global).toBeCloseTo(1.0, 5);
    expect(score.global).toBeLessThanOrEqual(1.0 + EPSILON);
  });

  it('les valeurs actual sont correctement stockées dans le résultat', () => {
    const score = computeEfficiencyScore(45, 30, 2, 1, 6, 4);
    expect(score.resources.actual).toBe(45);
    expect(score.resources.optimal).toBe(30);
    expect(score.machines.actual).toBe(2);
    expect(score.machines.optimal).toBe(1);
    expect(score.energy.actual).toBe(6);
    expect(score.energy.optimal).toBe(4);
  });

  it('usine vide (tout à 0) : les deux optima à 0 → score 1.0 (trivialmente optimal)', () => {
    const score = computeEfficiencyScore(0, 0, 0, 0, 0, 0);
    expect(score.resources.score).toBeCloseTo(1.0, 5);
    expect(score.machines.score).toBeCloseTo(1.0, 5);
    expect(score.energy.score).toBeCloseTo(1.0, 5);
    expect(score.global).toBeCloseTo(1.0, 5);
  });

  it('actual > 0, optimal = 0 : score dimension = 0 (optimal impossible, usine vide côté LP)', () => {
    // Cas pathologique (ne devrait pas arriver avec un vrai LP, mais le code doit être robuste)
    const score = computeEfficiencyScore(30, 0, 1, 0, 4, 0);
    expect(score.resources.score).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 6. Prestige (base)
// ---------------------------------------------------------------------------

describe('Prestige', () => {
  it('BASE_PRESTIGE_MULT = 1.5', () => {
    expect(BASE_PRESTIGE_MULT).toBe(1.5);
  });

  it('PRESTIGE_MIN_EFFICIENCY = 0.75', () => {
    expect(PRESTIGE_MIN_EFFICIENCY).toBe(0.75);
  });

  it('prestige disponible si score ≥ 0.75', () => {
    expect(isPrestigeAvailable(0.75)).toBe(true);
    expect(isPrestigeAvailable(0.9)).toBe(true);
    expect(isPrestigeAvailable(1.0)).toBe(true);
  });

  it('prestige NON disponible si score < 0.75', () => {
    expect(isPrestigeAvailable(0.74)).toBe(false);
    expect(isPrestigeAvailable(0.5)).toBe(false);
    expect(isPrestigeAvailable(0)).toBe(false);
  });

  it('prestigeMultiplier(0) = 1.0 (aucun prestige)', () => {
    expect(prestigeMultiplier(0)).toBeCloseTo(1.0, 5);
  });

  it('prestigeMultiplier(1) = 1.5', () => {
    expect(prestigeMultiplier(1)).toBeCloseTo(1.5, 5);
  });

  it('prestigeMultiplier(2) = 2.25', () => {
    // 1.5^2 = 2.25
    expect(prestigeMultiplier(2)).toBeCloseTo(2.25, 5);
  });

  it('prestigeMultiplier(3) = 3.375', () => {
    // 1.5^3 = 3.375
    expect(prestigeMultiplier(3)).toBeCloseTo(3.375, 5);
  });

  it('chaque prestige multiplie bien par BASE_PRESTIGE_MULT', () => {
    for (let n = 0; n < 5; n++) {
      const ratio = prestigeMultiplier(n + 1) / prestigeMultiplier(n);
      expect(ratio).toBeCloseTo(BASE_PRESTIGE_MULT, 5);
    }
  });

  it('prestigeCount négatif → RangeError', () => {
    expect(() => prestigeMultiplier(-1)).toThrow(RangeError);
  });
});
