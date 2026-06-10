import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import type { MachineNode, MachineNodeData } from '@/store/useGraphStore';
import { evaluateEfficiency } from './score';

const game = loadMockGameData();

const machine = (id: string, data: MachineNodeData): MachineNode => ({
  id,
  type: 'machine',
  position: { x: 0, y: 0 },
  data,
});

describe('evaluateEfficiency (score d’efficacité)', () => {
  it('usine optimale → score global 1.0 sur les 3 dimensions', async () => {
    // 3 Constructors de plaques (60/min) + 3 Smelters de lingots (90/min) = optimum exact
    // pour livrer 60 plaques/min (cf. computeFactory.test). Aucun gaspillage.
    const nodes = [
      machine('c', { buildingId: 'constructor', recipeId: 'iron-plate', count: 3 }),
      machine('s', { buildingId: 'smelter', recipeId: 'iron-ingot', count: 3 }),
    ];
    const score = await evaluateEfficiency(nodes, [], game, []);
    expect(score).not.toBeNull();
    expect(score!.resources.score).toBeCloseTo(1, 5);
    expect(score!.machines.score).toBeCloseTo(1, 5);
    expect(score!.energy.score).toBeCloseTo(1, 5);
    expect(score!.global).toBeCloseTo(1, 5);
  });

  it('score borné à [0, 1] et déterministe pour une usine donnée', async () => {
    const nodes = [
      machine('c', { buildingId: 'constructor', recipeId: 'iron-plate', count: 3 }),
      machine('s', { buildingId: 'smelter', recipeId: 'iron-ingot', count: 3 }),
    ];
    const a = await evaluateEfficiency(nodes, [], game, []);
    const b = await evaluateEfficiency(nodes, [], game, []);
    expect(a!.global).toBeGreaterThanOrEqual(0);
    expect(a!.global).toBeLessThanOrEqual(1);
    expect(a!.global).toBe(b!.global); // pur/déterministe
  });

  it('usine vide → null (rien à noter)', async () => {
    expect(await evaluateEfficiency([], [], game, [])).toBeNull();
  });
});
