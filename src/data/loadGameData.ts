import type { Belt, Building, GameData, GameItem, Generator, Recipe } from './types';
import { validateGameData } from './validate';

/**
 * FRONTIÈRE DE CHARGEMENT UNIQUE.
 *
 * Tout l'accès aux données du jeu passe par ici. Le reste de l'appli consomme le
 * `GameData` typé et ignore d'où il vient. Aujourd'hui : mock dans /public/data/mock/.
 * Demain : vraies données 1.0 extraites de Docs.json dans /public/data/{version}/.
 * Le remplacement ne touchera QUE ce module.
 */

/** Version de données actuellement servie. `mock` tant que l'extraction n'est pas branchée. */
export const GAME_DATA_VERSION = 'mock';

/** Les 5 fichiers bruts, déjà parsés en tableaux typés. */
interface RawBundle {
  items: GameItem[];
  buildings: Building[];
  recipes: Recipe[];
  belts: Belt[];
  generators: Generator[];
}

/**
 * Assemble + valide un bundle déjà parsé. Point commun entre le chargement
 * navigateur (fetch) et le chargement tests (lecture disque) : une seule
 * implémentation de validation, une seule forme de sortie.
 */
export function assembleGameData(raw: RawBundle): GameData {
  return validateGameData({
    items: raw.items,
    buildings: raw.buildings,
    recipes: raw.recipes,
    belts: raw.belts,
    generators: raw.generators,
  });
}

const DATA_FILES = ['items', 'buildings', 'recipes', 'belts', 'generators'] as const;

/** Chargement navigateur : récupère les JSON statiques puis assemble. */
export async function loadGameData(version: string = GAME_DATA_VERSION): Promise<GameData> {
  const base = `/data/${version}`;
  const [items, buildings, recipes, belts, generators] = await Promise.all(
    DATA_FILES.map(async (file) => {
      const res = await fetch(`${base}/${file}.json`);
      if (!res.ok) {
        throw new Error(`Échec du chargement de ${base}/${file}.json (${res.status}).`);
      }
      return res.json();
    }),
  );
  return assembleGameData({ items, buildings, recipes, belts, generators });
}
