import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assembleGameData } from '@/data/loadGameData';
import type { GameData } from '@/data/types';

/**
 * Charge le mock depuis le disque pour les tests Node (pas de fetch dispo).
 * Passe par le MÊME `assembleGameData` que la frontière navigateur : une seule
 * validation, une seule forme de sortie. `public/data/mock/` reste la source unique.
 * (Vitest tourne avec cwd = racine du projet.)
 */
export function loadMockGameData(): GameData {
  const base = resolve(process.cwd(), 'public/data/mock');
  const read = (file: string) => JSON.parse(readFileSync(resolve(base, `${file}.json`), 'utf-8'));
  return assembleGameData({
    items: read('items'),
    buildings: read('buildings'),
    recipes: read('recipes'),
    belts: read('belts'),
    generators: read('generators'),
  });
}
