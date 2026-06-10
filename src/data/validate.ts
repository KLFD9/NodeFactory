import type { BuildingCategory, GameData } from './types';

const BUILDING_CATEGORIES: readonly BuildingCategory[] = [
  'extraction',
  'smelting',
  'manufacturing',
  'logistics',
  'power',
];

export class GameDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GameDataError';
  }
}

/**
 * Validation des données du jeu (cf. test 13). Lève `GameDataError` au moindre
 * problème — appelée à la frontière de chargement, jamais en plein cœur du solveur.
 *
 * Invariants vérifiés :
 *  - tout `item` référencé dans une recette existe ;
 *  - tout `producedIn` existe ;
 *  - aucun `amountPerCycle` négatif ou nul, aucun `time` négatif ou nul ;
 *  - aucune recette sans produit.
 */
export function validateGameData(data: GameData): GameData {
  const itemIds = new Set(data.items.map((i) => i.id));
  const buildingIds = new Set(data.buildings.map((b) => b.id));

  for (const building of data.buildings) {
    if (!BUILDING_CATEGORIES.includes(building.category)) {
      throw new GameDataError(
        `Bâtiment "${building.id}" : catégorie inconnue "${building.category}".`,
      );
    }
    if (building.category === 'extraction' && !building.extractionBasePerMin) {
      throw new GameDataError(
        `Bâtiment "${building.id}" : un extracteur doit définir extractionBasePerMin.`,
      );
    }
  }

  for (const recipe of data.recipes) {
    if (!buildingIds.has(recipe.producedIn)) {
      throw new GameDataError(
        `Recette "${recipe.id}" : bâtiment producedIn inconnu "${recipe.producedIn}".`,
      );
    }
    if (recipe.time <= 0) {
      throw new GameDataError(`Recette "${recipe.id}" : time doit être > 0 (reçu ${recipe.time}).`);
    }
    if (recipe.products.length === 0) {
      throw new GameDataError(`Recette "${recipe.id}" : aucune sortie (products vide).`);
    }
    for (const io of [...recipe.ingredients, ...recipe.products]) {
      if (!itemIds.has(io.item)) {
        throw new GameDataError(`Recette "${recipe.id}" : item inconnu "${io.item}".`);
      }
      if (io.amountPerCycle <= 0) {
        throw new GameDataError(
          `Recette "${recipe.id}" : amountPerCycle doit être > 0 pour "${io.item}".`,
        );
      }
    }
  }

  return data;
}
