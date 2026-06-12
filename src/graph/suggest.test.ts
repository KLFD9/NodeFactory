import { describe, expect, it } from 'vitest';
import { loadMockGameData } from '@/test/loadMock';
import { suggestDownstream } from './suggest';

const game = loadMockGameData();

describe('suggestDownstream', () => {
  it('iron-ore → Smelter (recette iron-ingot)', () => {
    expect(suggestDownstream('iron-ore', game)).toEqual({
      buildingId: 'smelter',
      recipeId: 'iron-ingot',
      itemId: 'iron-ore',
    });
  });

  it('copper-ore → Smelter (recette copper-ingot)', () => {
    expect(suggestDownstream('copper-ore', game)).toEqual({
      buildingId: 'smelter',
      recipeId: 'copper-ingot',
      itemId: 'copper-ore',
    });
  });

  it('limestone → Constructor (recette concrete)', () => {
    expect(suggestDownstream('limestone', game)).toEqual({
      buildingId: 'constructor',
      recipeId: 'concrete',
      itemId: 'limestone',
    });
  });

  it('coal → Coal Generator (le charbon se brûle sur place)', () => {
    expect(suggestDownstream('coal', game)).toEqual({
      buildingId: 'coal-generator',
      recipeId: 'coal-generator-power',
      itemId: 'coal',
    });
  });

  it('item inconnu → aucune suggestion', () => {
    expect(suggestDownstream('ghost-item', game)).toBeNull();
  });
});
