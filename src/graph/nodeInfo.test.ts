import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import { computeNodeInfo } from './nodeInfo';

const game = loadMockGameData();

describe('computeNodeInfo', () => {
  it('extracteur : débit = base × pureté', () => {
    const normal = computeNodeInfo(
      { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'normal' },
      game,
    );
    expect(normal.outputs).toEqual([
      { itemId: 'iron-ore', itemName: 'Iron Ore', ratePerMin: 60 },
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
      { itemId: 'iron-ingot', itemName: 'Iron Ingot', ratePerMin: 30 },
    ]);
    expect(info.outputs).toEqual([
      { itemId: 'iron-plate', itemName: 'Iron Plate', ratePerMin: 20 },
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
