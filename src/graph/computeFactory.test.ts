import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { loadMockGameData } from '@/test/loadMock';
import type { GameData } from '@/data/types';
import type { MachineNode, MachineNodeData } from '@/store/useGraphStore';
import { computeFactory, planBelt } from './computeFactory';

const game = loadMockGameData();

const machine = (id: string, data: MachineNodeData): MachineNode => ({
  id,
  type: 'machine',
  position: { x: 0, y: 0 },
  data,
});

describe('planBelt (tiering convoyeur — test 8 du brief)', () => {
  it('60/min → Mk1, 61/min → Mk2, 1200/min → Mk6', () => {
    expect(planBelt(60, game.belts).tier).toBe(1);
    expect(planBelt(61, game.belts).tier).toBe(2);
    expect(planBelt(1200, game.belts).tier).toBe(6);
  });

  it('1500/min → 2 lignes Mk6 (surcharge)', () => {
    const plan = planBelt(1500, game.belts);
    expect(plan.tier).toBe(6);
    expect(plan.lines).toBe(2);
    expect(plan.overloaded).toBe(true);
  });
});

describe('computeFactory (bilan matière + énergie)', () => {
  it('chaîne lingots → plaques : machines, énergie, déficits, ressources brutes', () => {
    // 3 Constructors de plaques (60/min, consomment 90 lingots/min)
    // + 3 Smelters de lingots (90/min, consomment 90 minerai/min).
    const nodes = [
      machine('c', { buildingId: 'constructor', recipeId: 'iron-plate', count: 3 }),
      machine('s', { buildingId: 'smelter', recipeId: 'iron-ingot', count: 3 }),
    ];
    const summary = computeFactory(nodes, [], game);

    expect(summary.totalMachines).toBe(6);
    expect(summary.totalPowerMW).toBe(24); // 3×4 (constructor) + 3×4 (smelter)

    // Lingots équilibrés (90 produits, 90 consommés) → pas de déficit lingot.
    expect(summary.deficits.find((d) => d.itemId === 'iron-ingot')).toBeUndefined();
    // Minerai brut à importer : 90/min.
    expect(summary.rawInputs).toEqual([
      { itemId: 'iron-ore', itemName: 'Iron Ore', ratePerMin: 90 },
    ]);
    // Surplus de plaques : 60/min.
    expect(summary.surplus).toEqual([
      { itemId: 'iron-plate', itemName: 'Iron Plate', ratePerMin: 60 },
    ]);
  });

  it('machine sans amont : le manque d’intermédiaire est un déficit (pas une ressource brute)', () => {
    const nodes = [machine('c', { buildingId: 'constructor', recipeId: 'iron-plate', count: 3 })];
    const summary = computeFactory(nodes, [], game);
    expect(summary.deficits).toEqual([
      { itemId: 'iron-ingot', itemName: 'Iron Ingot', ratePerMin: 90 },
    ]);
  });

  it('un câble énergie (power-out → power-in) ne porte aucun flux d’item', () => {
    const nodes = [
      machine('miner', { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'normal' }),
      machine('smelter', { buildingId: 'smelter', recipeId: 'iron-ingot' }),
    ];
    const edges: Edge[] = [
      { id: 'belt', source: 'miner', target: 'smelter', sourceHandle: 'out-iron-ore', targetHandle: 'in-iron-ore' },
      { id: 'power', source: 'smelter', target: 'miner', sourceHandle: 'power-out', targetHandle: 'power-in' },
    ];
    const summary = computeFactory(nodes, edges, game);
    const beltPlan = summary.edges.find((p) => p.edgeId === 'belt')!;
    const powerPlan = summary.edges.find((p) => p.edgeId === 'power')!;
    expect(beltPlan.itemId).toBe('iron-ore');
    expect(beltPlan.ratePerMin).toBe(60);
    expect(powerPlan.itemId).toBeNull();
    expect(powerPlan.ratePerMin).toBe(0);
  });

  it('plan d’arête : débit du node source réparti, tier de convoyeur calculé', () => {
    const nodes = [
      machine('s', { buildingId: 'smelter', recipeId: 'iron-ingot', count: 3 }), // 90/min
      machine('c', { buildingId: 'constructor', recipeId: 'iron-plate' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 's', target: 'c' }];
    const summary = computeFactory(nodes, edges, game);
    const plan = summary.edges[0];
    expect(plan.itemId).toBe('iron-ingot');
    expect(plan.ratePerMin).toBe(90);
    expect(plan.belt.tier).toBe(2); // 90/min → Mk2 (120)
  });

  it('routage par handle : chaque arête porte l’item de son handle source', () => {
    // Node à 2 sorties (produit + sous-produit), 2 arêtes via out-<item> distincts.
    const twoOut: GameData = {
      items: [
        { id: 'ore', name: 'Ore', category: 'raw', raw: true },
        { id: 'main', name: 'Main', category: 'part', raw: false },
        { id: 'residue', name: 'Residue', category: 'part', raw: false },
      ],
      buildings: [{ id: 'refinery', name: 'Refinery', category: 'manufacturing', powerMW: 30 }],
      recipes: [
        {
          id: 'refine',
          name: 'Refine',
          alternate: false,
          time: 60,
          producedIn: 'refinery',
          ingredients: [{ item: 'ore', amountPerCycle: 2 }],
          products: [
            { item: 'main', amountPerCycle: 2 },
            { item: 'residue', amountPerCycle: 1 },
          ],
        },
      ],
      belts: game.belts,
      generators: [],
    };
    const nodes = [
      machine('r', { buildingId: 'refinery', recipeId: 'refine' }),
      machine('a', { buildingId: 'refinery', recipeId: 'refine' }),
      machine('b', { buildingId: 'refinery', recipeId: 'refine' }),
    ];
    const edges: Edge[] = [
      { id: 'em', source: 'r', target: 'a', sourceHandle: 'out-main' },
      { id: 'er', source: 'r', target: 'b', sourceHandle: 'out-residue' },
    ];
    const summary = computeFactory(nodes, edges, twoOut);
    const m = summary.edges.find((e) => e.edgeId === 'em')!;
    const rsd = summary.edges.find((e) => e.edgeId === 'er')!;
    expect(m.itemId).toBe('main');
    expect(m.ratePerMin).toBe(2); // 2/cycle, 60s → 2/min
    expect(rsd.itemId).toBe('residue');
    expect(rsd.ratePerMin).toBe(1);
  });
});
