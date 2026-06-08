import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import type { GameData } from '@/data/types';
import { solveFactory, SolverError } from './index';

const game = loadMockGameData();
const sel = (r: Awaited<ReturnType<typeof solveFactory>>, id: string) =>
  r.selections.find((s) => s.recipeId === id);

describe('solveFactory', () => {
  it('1. mono-machine : 30 Iron Ingot/min → 1 Smelter, 30 minerai, 4 MW', async () => {
    const r = await solveFactory({
      data: game,
      targetItem: 'iron-ingot',
      targetRate: 30,
      objective: 'raw-resources',
    });
    expect(sel(r, 'iron-ingot')?.machineCount).toBe(1);
    expect(r.totalMachines).toBe(1);
    expect(r.totalPowerMW).toBe(4);
    expect(r.rawInputs).toEqual([{ item: 'iron-ore', rate: 30 }]);
  });

  it('2. chaîne deux étages : 60 Iron Plate/min → 3 Constructors + 3 Smelters', async () => {
    const r = await solveFactory({
      data: game,
      targetItem: 'iron-plate',
      targetRate: 60,
      objective: 'raw-resources',
    });
    expect(sel(r, 'iron-plate')?.machineCount).toBe(3);
    expect(sel(r, 'iron-ingot')?.machineCount).toBe(3);
    expect(r.rawInputs).toEqual([{ item: 'iron-ore', rate: 90 }]);
  });

  it('3. recette alternative : Cast Screw réduit les machines, le toggle la retire', async () => {
    const withAlt = await solveFactory({
      data: game,
      targetItem: 'screw',
      targetRate: 200,
      objective: 'machines',
    });
    // min machines préfère Cast Screw (saute l'étape Iron Rod).
    expect(sel(withAlt, 'alt-cast-screw')).toBeDefined();
    expect(sel(withAlt, 'screw')).toBeUndefined();

    const noAlt = await solveFactory({
      data: game,
      targetItem: 'screw',
      targetRate: 200,
      objective: 'machines',
      allowedAlternates: [], // aucune alternative
    });
    expect(sel(noAlt, 'alt-cast-screw')).toBeUndefined();
    expect(sel(noAlt, 'screw')).toBeDefined();
    expect(sel(noAlt, 'iron-rod')).toBeDefined();
    // Sans l'alternative il faut strictement plus de machines.
    expect(noAlt.totalMachines).toBeGreaterThan(withAlt.totalMachines);
  });

  it('4. changement d’objectif : min-ressources et min-machines divergent', async () => {
    const minRaw = await solveFactory({
      data: game,
      targetItem: 'reinforced-iron-plate',
      targetRate: 30,
      objective: 'raw-resources',
    });
    const minMachines = await solveFactory({
      data: game,
      targetItem: 'reinforced-iron-plate',
      targetRate: 30,
      objective: 'machines',
    });
    // Invariants d'optimalité (toujours vrais) : chaque objectif est le meilleur sur son critère.
    const rawTotal = (r: typeof minRaw) => r.rawInputs.reduce((s, f) => s + f.rate, 0);
    expect(rawTotal(minRaw)).toBeLessThanOrEqual(rawTotal(minMachines) + 1e-6);
    expect(minMachines.totalMachines).toBeLessThanOrEqual(minRaw.totalMachines);
    // Les deux solutions ne sont pas identiques (arbitrage réel via Bolted Iron Plate).
    const recipeSet = (r: typeof minRaw) => r.selections.map((s) => s.recipeId).sort().join(',');
    expect(recipeSet(minRaw)).not.toBe(recipeSet(minMachines));
  });

  it('5. conservation de la matière : production ≥ consommation pour chaque item', async () => {
    const r = await solveFactory({
      data: game,
      targetItem: 'modular-frame',
      targetRate: 10,
      objective: 'raw-resources',
    });
    const production = new Map<string, number>();
    const consumption = new Map<string, number>();
    const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
    for (const s of r.selections) {
      const recipe = game.recipes.find((x) => x.id === s.recipeId)!;
      const cyclesPerMin = s.runsPerMinute;
      for (const p of recipe.products) add(production, p.item, p.amountPerCycle * cyclesPerMin);
      for (const ing of recipe.ingredients) add(consumption, ing.item, ing.amountPerCycle * cyclesPerMin);
    }
    for (const item of game.items) {
      if (item.raw) continue; // les bruts sont importés
      const net = (production.get(item.id) ?? 0) - (consumption.get(item.id) ?? 0);
      expect(net).toBeGreaterThanOrEqual(-1e-6);
    }
  });

  it('6. sous-produit : le surplus est reporté, jamais ignoré', async () => {
    // Dataset minimal : une recette produit un produit principal + un résidu.
    const byproductGame: GameData = {
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
            { item: 'main', amountPerCycle: 1 },
            { item: 'residue', amountPerCycle: 1 },
          ],
        },
      ],
      belts: [],
      generators: [],
    };
    const r = await solveFactory({
      data: byproductGame,
      targetItem: 'main',
      targetRate: 1,
      objective: 'raw-resources',
    });
    // 1 main/min → 1 cycle/min → 1 résidu/min en surplus, reporté explicitement.
    expect(r.surplus).toEqual([{ item: 'residue', rate: 1 }]);
  });

  it('7. infaisabilité : item sans recette → erreur explicite, pas de crash', async () => {
    const game2: GameData = {
      ...game,
      items: [...game.items, { id: 'ghost', name: 'Ghost', category: 'part', raw: false }],
    };
    await expect(
      solveFactory({ data: game2, targetItem: 'ghost', targetRate: 10, objective: 'raw-resources' }),
    ).rejects.toBeInstanceOf(SolverError);
  });
});
