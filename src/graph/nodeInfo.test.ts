import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import { computeNodeInfo, machineSpeedMult, MACHINE_UPGRADE_MAX_LEVEL } from './nodeInfo';

const game = loadMockGameData();

describe('computeNodeInfo', () => {
  it('extracteur : débit = base × pureté', () => {
    const normal = computeNodeInfo(
      { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'normal' },
      game,
    );
    expect(normal.outputs).toEqual([
      { itemId: 'iron-ore', itemName: 'Text Corpus', ratePerMin: 60 },
    ]);

    const pure = computeNodeInfo(
      { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'pure' },
      game,
    );
    expect(pure.outputs[0].ratePerMin).toBe(120);

    const impure = computeNodeInfo(
      { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'impure' },
      game,
    );
    expect(impure.outputs[0].ratePerMin).toBe(30);
  });

  it('machine à recette : débits in/out pour une machine (Iron Plate)', () => {
    const info = computeNodeInfo({ buildingId: 'constructor', recipeId: 'iron-plate' }, game);
    // 3 lingots → 2 plaques en 6 s : 30 lingots/min in, 20 plaques/min out.
    expect(info.inputs).toEqual([
      { itemId: 'iron-ingot', itemName: 'Clean Tokens', ratePerMin: 30 },
    ]);
    expect(info.outputs).toEqual([
      { itemId: 'iron-plate', itemName: 'Embeddings', ratePerMin: 20 },
    ]);
    expect(info.powerMW).toBe(4);
  });

  it('node non configuré : « À configurer », aucun flux', () => {
    const info = computeNodeInfo({ buildingId: 'smelter' }, game);
    expect(info.configured).toBe(false);
    expect(info.outputs).toHaveLength(0);
    expect(info.summary).toBe('À configurer');
  });
});

describe('améliorations par machine (+10 % cadence/niveau, MW qui suivent)', () => {
  it('machineSpeedMult : 1.0 / 1.1 / 1.21, clampé au cap et à 0', () => {
    expect(machineSpeedMult(0)).toBeCloseTo(1.0, 6);
    expect(machineSpeedMult(1)).toBeCloseTo(1.1, 6);
    expect(machineSpeedMult(2)).toBeCloseTo(1.21, 6);
    expect(machineSpeedMult(-3)).toBeCloseTo(1.0, 6);
    expect(machineSpeedMult(99)).toBeCloseTo(Math.pow(1.1, MACHINE_UPGRADE_MAX_LEVEL), 6);
  });

  it('recette améliorée niv.2 : débits ET MW ×1.21 (Iron Plate : 20 → 24.2/min, 4 → 4.84 MW)', () => {
    const info = computeNodeInfo(
      { buildingId: 'constructor', recipeId: 'iron-plate', upgradeLevel: 2 },
      game,
    );
    expect(info.outputs[0].ratePerMin).toBeCloseTo(24.2, 3);
    expect(info.inputs[0].ratePerMin).toBeCloseTo(36.3, 3);
    expect(info.powerMW).toBeCloseTo(4.84, 3);
  });

  it('extracteur amélioré niv.1 : 60 → 66/min', () => {
    const info = computeNodeInfo(
      { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'normal', upgradeLevel: 1 },
      game,
    );
    expect(info.outputs[0].ratePerMin).toBeCloseTo(66, 3);
  });
});
