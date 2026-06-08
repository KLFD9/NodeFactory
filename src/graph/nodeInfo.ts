import type { Building, GameData, Recipe } from '@/data/types';
import { PURITY_MULTIPLIER, ratePerMinute } from '@/data/types';
import type { MachineNodeData } from '@/store/useGraphStore';

/** Un flux sur un port : item + débit/min. */
export interface PortFlow {
  itemId: string;
  itemName: string;
  ratePerMin: number;
}

/** Tout ce qu'on sait afficher d'un node configuré — calcul PUR, sans React. */
export interface NodeInfo {
  building: Building | undefined;
  recipe?: Recipe;
  inputs: PortFlow[];
  outputs: PortFlow[];
  powerMW: number;
  /** Résumé court (« Iron Ore — 60/min », « Iron Plate », « À configurer »). */
  summary: string;
  configured: boolean;
}

/** Calcule les flux et le libellé d'un node à partir de sa config + des données du jeu. */
export function computeNodeInfo(data: MachineNodeData, game: GameData): NodeInfo {
  const building = game.buildings.find((b) => b.id === data.buildingId);
  const itemName = (id: string) => game.items.find((i) => i.id === id)?.name ?? id;

  const base: NodeInfo = {
    building,
    inputs: [],
    outputs: [],
    powerMW: building?.powerMW ?? 0,
    summary: 'À configurer',
    configured: false,
  };

  if (!building) return base;

  // Extracteur : ressource + pureté → débit de sortie.
  if (building.category === 'extraction') {
    if (!data.resourceId) return base;
    const purity = data.purity ?? 'normal';
    const rate = (building.extractionBasePerMin ?? 0) * PURITY_MULTIPLIER[purity];
    return {
      ...base,
      outputs: [{ itemId: data.resourceId, itemName: itemName(data.resourceId), ratePerMin: rate }],
      summary: `${itemName(data.resourceId)} — ${rate}/min`,
      configured: true,
    };
  }

  // Logistique (splitter/merger) : pass-through, flux calculés par la couche graphe.
  if (building.category === 'logistics') {
    return { ...base, summary: building.name, configured: true };
  }

  // Machine à recette : recette choisie → débits in/out pour UNE machine à 100 %.
  if (!data.recipeId) return base;
  const recipe = game.recipes.find((r) => r.id === data.recipeId);
  if (!recipe) return base;

  return {
    ...base,
    recipe,
    inputs: recipe.ingredients.map((io) => ({
      itemId: io.item,
      itemName: itemName(io.item),
      ratePerMin: ratePerMinute(io.amountPerCycle, recipe.time),
    })),
    outputs: recipe.products.map((io) => ({
      itemId: io.item,
      itemName: itemName(io.item),
      ratePerMin: ratePerMinute(io.amountPerCycle, recipe.time),
    })),
    summary: recipe.name,
    configured: true,
  };
}

/** Recettes exécutables dans un bâtiment donné (pour le sélecteur de l'inspecteur). */
export function recipesForBuilding(buildingId: string, game: GameData): Recipe[] {
  return game.recipes.filter((r) => r.producedIn === buildingId);
}
