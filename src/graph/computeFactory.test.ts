import { describe, expect, it } from 'vitest';
import type { Edge } from '@xyflow/react';
import { loadMockGameData } from '@/test/loadMock';
import type { GameData } from '@/data/types';
import type { MachineNode, MachineNodeData } from '@/store/useGraphStore';
import { computeFactory, planBelt } from './computeFactory';

const game = loadMockGameData();

/** Neutralise le gating électrique — ces tests valident le bilan matière/logistique pur. */
const NO_POWER = () => new Map<string, boolean>();

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
    const summary = computeFactory(nodes, [], game, NO_POWER());

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
    const summary = computeFactory(nodes, [], game, NO_POWER());
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
    const summary = computeFactory(nodes, edges, game, NO_POWER());
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
    const summary = computeFactory(nodes, edges, game, NO_POWER());
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
    const summary = computeFactory(nodes, edges, twoOut, NO_POWER());
    const m = summary.edges.find((e) => e.edgeId === 'em')!;
    const rsd = summary.edges.find((e) => e.edgeId === 'er')!;
    expect(m.itemId).toBe('main');
    expect(m.ratePerMin).toBe(2); // 2/cycle, 60s → 2/min
    expect(rsd.itemId).toBe('residue');
    expect(rsd.ratePerMin).toBe(1);
  });
});

describe('computeFactory — capacité physique des convoyeurs (plafonnement du flux)', () => {
  const bigOutput: GameData = {
    items: [
      { id: 'ore', name: 'Ore', category: 'raw', raw: true },
      { id: 'part', name: 'Part', category: 'part', raw: false },
    ],
    buildings: [
      { id: 'source', name: 'Source', category: 'manufacturing', powerMW: 0 },
      { id: 'sink', name: 'Sink', category: 'manufacturing', powerMW: 0 },
      { id: 'splitter', name: 'Splitter', category: 'logistics', powerMW: 0 },
    ],
    recipes: [
      {
        id: 'produce',
        name: 'Produce',
        alternate: false,
        time: 1,
        producedIn: 'source',
        ingredients: [],
        products: [{ item: 'part', amountPerCycle: 25 }], // 25/cycle, 1s → 1500/min
      },
      {
        id: 'consume',
        name: 'Consume',
        alternate: false,
        time: 1,
        producedIn: 'sink',
        ingredients: [{ item: 'part', amountPerCycle: 100 }], // demande énorme, jamais le goulot
        products: [],
      },
    ],
    belts: game.belts, // capacité max = Mk6 = 1200/min
    generators: [],
  };

  it('un débit > capacité du meilleur convoyeur (1200/min) est plafonné, surcharge signalée', () => {
    const nodes = [
      machine('src', { buildingId: 'source', recipeId: 'produce' }),
      machine('snk', { buildingId: 'sink', recipeId: 'consume' }),
    ];
    const edges: Edge[] = [{ id: 'e1', source: 'src', target: 'snk' }];
    const summary = computeFactory(nodes, edges, bigOutput, NO_POWER());
    const plan = summary.edges[0];
    expect(plan.demandPerMin).toBe(1500);
    expect(plan.ratePerMin).toBe(1200); // plafonné au Mk6
    expect(plan.belt.overloaded).toBe(true);
    expect(plan.belt.lines).toBe(2);
  });

  it('le plafonnement se propage en aval à travers un splitter', () => {
    const nodes = [
      machine('src', { buildingId: 'source', recipeId: 'produce' }), // 1500/min
      machine('split', { buildingId: 'splitter' }),
      machine('a', { buildingId: 'sink', recipeId: 'consume' }),
      machine('b', { buildingId: 'sink', recipeId: 'consume' }),
    ];
    const edges: Edge[] = [
      { id: 'e1', source: 'src', target: 'split' },
      { id: 'e2', source: 'split', target: 'a' },
      { id: 'e3', source: 'split', target: 'b' },
    ];
    const summary = computeFactory(nodes, edges, bigOutput, NO_POWER());
    const e1 = summary.edges.find((p) => p.edgeId === 'e1')!;
    const e2 = summary.edges.find((p) => p.edgeId === 'e2')!;
    // e1 : 1500/min demandés, plafonnés à 1200/min (Mk6).
    expect(e1.demandPerMin).toBe(1500);
    expect(e1.ratePerMin).toBe(1200);
    // Le splitter répartit le flux RÉELLEMENT reçu (1200), pas le débit théorique (1500).
    expect(e2.demandPerMin).toBe(600);
    expect(e2.ratePerMin).toBe(600);
  });
});

describe('computeFactory — gating électrique (pas de courant, pas de production)', () => {
  const chain = () => [
    machine('miner', { buildingId: 'miner-mk1', resourceId: 'iron-ore', purity: 'normal' }),
    machine('smelter', { buildingId: 'smelter', recipeId: 'iron-ingot' }),
  ];
  const belt: Edge = {
    id: 'belt',
    source: 'miner',
    target: 'smelter',
    sourceHandle: 'out-iron-ore',
    targetHandle: 'in-iron-ore',
  };

  it('chaîne sans générateur → AUCUNE production, machines hors tension', () => {
    const summary = computeFactory(chain(), [belt], game);
    expect(summary.totalMachines).toBe(0);
    expect(summary.unpoweredMachines).toBe(2);
    expect(summary.production).toEqual([]);
    expect(summary.rawInputs).toEqual([]);
  });

  it('chaîne câblée à un Coal Generator → production nominale', () => {
    const nodes = [
      ...chain(),
      machine('gen', { buildingId: 'coal-generator' }),
      machine('coal-miner', { buildingId: 'miner-mk1', resourceId: 'coal', purity: 'normal' }),
    ];
    const edges: Edge[] = [
      belt,
      { id: 'p1', source: 'gen', target: 'miner', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'p2', source: 'gen', target: 'smelter', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'p3', source: 'gen', target: 'coal-miner', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'coal-belt', source: 'coal-miner', target: 'gen', sourceHandle: 'out-coal', targetHandle: 'in-coal' },
    ];
    const summary = computeFactory(nodes, edges, game);
    expect(summary.unpoweredMachines).toBe(0);
    expect(summary.totalMachines).toBe(3);
    // 60 ore/min extraits → 60 lingots... non : smelter = 30/min, surplus ore 30.
    expect(summary.production.find((p) => p.itemId === 'iron-ingot')?.ratePerMin).toBe(30);
  });

  it('réseau en DÉFICIT (génération < demande) → tout le réseau s’arrête', () => {
    // 20 smelters (80 MW) sur un seul Coal Generator (75 MW) → réseau en déficit.
    const nodes = [
      machine('s', { buildingId: 'smelter', recipeId: 'iron-ingot', count: 20 }),
      machine('gen', { buildingId: 'coal-generator' }),
    ];
    const edges: Edge[] = [
      { id: 'p', source: 'gen', target: 's', sourceHandle: 'power-out', targetHandle: 'power-in' },
    ];
    const summary = computeFactory(nodes, edges, game);
    expect(summary.unpoweredMachines).toBe(20);
    expect(summary.totalMachines).toBe(0);
    expect(summary.production).toEqual([]);
  });

  it('générateur câblé mais SANS charbon entrant → 0 MW généré → réseau down → cascade', () => {
    const nodes = [
      ...chain(),
      machine('gen', { buildingId: 'coal-generator', recipeId: 'coal-generator-power' }),
    ];
    const edges: Edge[] = [
      belt,
      { id: 'p1', source: 'gen', target: 'miner', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'p2', source: 'gen', target: 'smelter', sourceHandle: 'power-out', targetHandle: 'power-in' },
    ];
    const summary = computeFactory(nodes, edges, game);
    // Sans flux de charbon entrant, le générateur ne produit aucun MW : réseau en déficit,
    // donc le mineur et le smelter (et le générateur lui-même) sont hors tension.
    expect(summary.unpoweredMachines).toBe(2);
    expect(summary.totalMachines).toBe(0);
    expect(summary.production).toEqual([]);
  });

  it('générateur nourri (mineur de charbon dédié) → tout le réseau tourne', () => {
    const nodes = [
      ...chain(),
      machine('gen', { buildingId: 'coal-generator', recipeId: 'coal-generator-power' }),
      machine('coal-miner', { buildingId: 'miner-mk1', resourceId: 'coal', purity: 'normal' }),
    ];
    const edges: Edge[] = [
      belt,
      { id: 'p1', source: 'gen', target: 'miner', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'p2', source: 'gen', target: 'smelter', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'p3', source: 'gen', target: 'coal-miner', sourceHandle: 'power-out', targetHandle: 'power-in' },
      { id: 'coal-belt', source: 'coal-miner', target: 'gen', sourceHandle: 'out-coal', targetHandle: 'in-coal' },
    ];
    const summary = computeFactory(nodes, edges, game);
    expect(summary.unpoweredMachines).toBe(0);
    // miner + smelter + coal-miner + gen (configuré via recipeId)
    expect(summary.totalMachines).toBe(4);
    expect(summary.production.find((p) => p.itemId === 'iron-ingot')?.ratePerMin).toBe(30);
  });
});
