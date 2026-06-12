/**
 * suggest.ts — Suggestion contextuelle PURE : « quelle machine en aval de ce flux ? »
 *
 * Quand un extracteur est posé sur un gisement, on propose la machine qui consomme
 * naturellement sa ressource (iron-ore → Smelter, limestone → Constructor/Concrete…).
 * Dérivé des DONNÉES (première recette standard mono-ingrédient qui consomme l'item),
 * donc automatiquement à jour quand l'économie évolue. Aucune dépendance React.
 */

import type { GameData } from '@/data/types';

export interface DownstreamSuggestion {
  buildingId: string;
  recipeId: string;
  /** Item transporté par le belt à créer (la ressource du gisement). */
  itemId: string;
}

/**
 * Machine aval suggérée pour une ressource extraite, ou null si aucune recette
 * standard mono-ingrédient ne la consomme (ex. coal : brûlé par les générateurs,
 * pas transformé seul — pas de suggestion).
 */
export function suggestDownstream(resourceId: string, game: GameData): DownstreamSuggestion | null {
  const recipe = game.recipes.find(
    (r) => !r.alternate && r.ingredients.length === 1 && r.ingredients[0].item === resourceId,
  );
  if (!recipe) return null;
  return { buildingId: recipe.producedIn, recipeId: recipe.id, itemId: resourceId };
}
