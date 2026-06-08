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

  it('propage les flux à travers le merger/splitter (débits corrects par arête)', async () => {
    const result = await solveFactory({
      data: game,
      targetItem: 'iron-plate',
      targetRate: 60,
      objective: 'raw-resources',
    });
    const { nodes, edges } = buildGraphFromSolution(result, game);
    const summary = computeFactory(nodes, edges, game);
    const plans = summary.edges;

    // Lingot → merger : 30/min chacun (Mk1).
    const toMerger = plans.filter((p) => /^e-m-\d/.test(p.edgeId));
    expect(toMerger.length).toBe(3);
    expect(toMerger.every((p) => p.ratePerMin === 30 && p.itemId === 'iron-ingot')).toBe(true);

    // merger → splitter : 90/min agrégés (Mk2).
    const bus = plans.find((p) => p.edgeId.startsWith('e-mg-'));
    expect(bus?.ratePerMin).toBe(90);
    expect(bus?.belt.tier).toBe(2);

    // splitter → plaques : 30/min chacun (Mk1).
    const fromSplitter = plans.filter((p) => p.edgeId.startsWith('e-sp-'));
    expect(fromSplitter.length).toBe(3);
    expect(fromSplitter.every((p) => p.ratePerMin === 30)).toBe(true);
  });
});
