import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import { ratePerMinute } from './types';
import { GameDataError, validateGameData } from './validate';

describe('données du jeu (mock)', () => {
  const data = loadMockGameData();

  it('charge et valide le mock sans erreur (test 13)', () => {
    expect(data.items.length).toBeGreaterThan(0);
    expect(data.recipes.length).toBeGreaterThan(0);
  });

  it('toute recette référence des items et un bâtiment existants', () => {
    const itemIds = new Set(data.items.map((i) => i.id));
    const buildingIds = new Set(data.buildings.map((b) => b.id));
    for (const recipe of data.recipes) {
      expect(buildingIds.has(recipe.producedIn)).toBe(true);
      for (const io of [...recipe.ingredients, ...recipe.products]) {
        expect(itemIds.has(io.item)).toBe(true);
      }
    }
  });

  it('inclut au moins 2 recettes alternatives pour le solveur', () => {
    const alternates = data.recipes.filter((r) => r.alternate);
    expect(alternates.length).toBeGreaterThanOrEqual(2);
  });

  it('dérive correctement les débits/min (Iron Ingot = 30/min)', () => {
    const ironIngot = data.recipes.find((r) => r.id === 'iron-ingot')!;
    const product = ironIngot.products[0];
    expect(ratePerMinute(product.amountPerCycle, ironIngot.time)).toBe(30);
  });

  it('rejette une donnée invalide (item inconnu)', () => {
    expect(() =>
      validateGameData({
        items: [{ id: 'a', name: 'A', category: 'part', raw: false }],
        buildings: [{ id: 'smelter', name: 'Smelter', category: 'smelting', powerMW: 4 }],
        recipes: [
          {
            id: 'bad',
            name: 'Bad',
            alternate: false,
            time: 2,
            producedIn: 'smelter',
            ingredients: [{ item: 'ghost', amountPerCycle: 1 }],
            products: [{ item: 'a', amountPerCycle: 1 }],
          },
        ],
        belts: [],
        generators: [],
      }),
    ).toThrow(GameDataError);
  });
});
