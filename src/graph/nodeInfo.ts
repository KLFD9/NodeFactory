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

// --- Améliorations par machine (design progression v2) -----------------------
// Chaque niveau accélère le cycle de +10 % : production ET consommation suivent,
// et la machine tire proportionnellement plus de courant (la physique reste vraie —
// pousser la cadence sans étendre le réseau électrique fait disjoncter).

export const MACHINE_UPGRADE_SPEED_RATIO = 1.1;
export const MACHINE_UPGRADE_MAX_LEVEL = 3;

/** Multiplicateur de vitesse (et de MW) d'une machine au niveau N. 1.0 au niveau 0. */
export function machineSpeedMult(level: number): number {
  return Math.pow(MACHINE_UPGRADE_SPEED_RATIO, Math.max(0, Math.min(level, MACHINE_UPGRADE_MAX_LEVEL)));
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Calcule les flux et le libellé d'un node à partir de sa config + des données du jeu. */
export function computeNodeInfo(data: MachineNodeData, game: GameData): NodeInfo {
  const building = game.buildings.find((b) => b.id === data.buildingId);
  const itemName = (id: string) => game.items.find((i) => i.id === id)?.name ?? id;
  const mult = machineSpeedMult(data.upgradeLevel ?? 0);

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
    const rate = round3((building.extractionBasePerMin ?? 0) * PURITY_MULTIPLIER[purity] * mult);
    return {
      ...base,
      powerMW: round3(base.powerMW * mult),
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
    powerMW: round3(base.powerMW * mult),
    inputs: recipe.ingredients.map((io) => ({
      itemId: io.item,
      itemName: itemName(io.item),
      ratePerMin: round3(ratePerMinute(io.amountPerCycle, recipe.time) * mult),
    })),
    outputs: recipe.products.map((io) => ({
      itemId: io.item,
      itemName: itemName(io.item),
      ratePerMin: round3(ratePerMinute(io.amountPerCycle, recipe.time) * mult),
    })),
    summary: recipe.name,
    configured: true,
  };
}

/** Recettes exécutables dans un bâtiment donné (pour le sélecteur de l'inspecteur). */
export function recipesForBuilding(buildingId: string, game: GameData): Recipe[] {
  return game.recipes.filter((r) => r.producedIn === buildingId);
}
