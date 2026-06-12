import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import { solveFactory } from '@/solver';
import { buildGraphFromSolution } from './buildGraphFromSolution';
import { computeFactory } from './computeFactory';

const game = loadMockGameData();

describe('buildGraphFromSolution (1 node = 1 machine + logistique)', () => {
  it('émet un node par machine et insère merger/splitter entre les groupes', async () => {
    const result = await solveFactory({
      data: game,
      targetItem: 'iron-plate',
      targetRate: 60,
      objective: 'raw-resources',
    });
    const { nodes } = buildGraphFromSolution(result, game);

    const machineNodes = nodes.filter((n) => n.data.recipeId);
    const plateMachines = machineNodes.filter((n) => n.data.recipeId === 'iron-plate');
    const ingotMachines = machineNodes.filter((n) => n.data.recipeId === 'iron-ingot');
    expect(plateMachines).toHaveLength(3); // 3 Constructors
    expect(ingotMachines).toHaveLength(3); // 3 Smelters

    // Hubs logistiques entre les lingots (3) et les plaques (3).
    expect(nodes.some((n) => n.data.buildingId === 'merger')).toBe(true);
    expect(nodes.some((n) => n.data.buildingId === 'splitter')).toBe(true);

    // Les lingots (amont) sont à gauche des plaques (aval).
    expect(ingotMachines[0].position.x).toBeLessThan(plateMachines[0].position.x);
  });

  it('propage les flux à travers merger(3→1)/splitter(1→3) (débits par arête)', async () => {
    const result = await solveFactory({
      data: game,
      targetItem: 'iron-plate',
      targetRate: 60,
      objective: 'raw-resources',
    });
    const { nodes, edges } = buildGraphFromSolution(result, game);
    const plans = computeFactory(nodes, edges, game, new Map()).edges;

    // 3 lingots → merger (3×30/min) + splitter → 3 plaques (3×30/min) = 6 arêtes à 30/min.
    const at30 = plans.filter((p) => p.ratePerMin === 30 && p.itemId === 'iron-ingot');
    expect(at30.length).toBe(6);

    // Le bus merger → splitter agrège 90/min (Mk2).
    const bus = plans.filter((p) => p.ratePerMin === 90 && p.itemId === 'iron-ingot');
    expect(bus.length).toBe(1);
    expect(bus[0].belt.tier).toBe(2);
  });

  it('respecte les capacités : merger ≤ 3 entrées, splitter ≤ 3 sorties', async () => {
    // 60 vis/min via Cast Screw : agrège beaucoup de machines → arbres de hubs.
    const result = await solveFactory({
      data: game,
      targetItem: 'reinforced-iron-plate',
      targetRate: 30,
      objective: 'machines',
    });
    const { nodes } = buildGraphFromSolution(result, game);
    for (const n of nodes) {
      if (n.data.buildingId === 'merger') expect(n.data.portsIn ?? 0).toBeLessThanOrEqual(3);
      if (n.data.buildingId === 'splitter') expect(n.data.portsOut ?? 0).toBeLessThanOrEqual(3);
    }
  });
});
