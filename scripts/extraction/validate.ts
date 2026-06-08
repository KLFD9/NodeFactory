/**
 * Valide une version de données (/public/data/{version}/) contre le schéma du projet.
 *
 * Réutilise `assembleGameData` → `validateGameData` : la MÊME validation que la frontière
 * de chargement navigateur. Pas de logique dupliquée. Sert de porte de vérification à
 * l'agent `satisfactory-data` et à toute mise à jour manuelle des données.
 *
 * Usage : npm run validate:data -- <version>     (ex. npm run validate:data -- 1.0)
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assembleGameData } from '../../src/data/loadGameData';

const version = process.argv[2];
if (!version) {
  console.error('Usage : npm run validate:data -- <version>   (ex. mock, 1.0)');
  process.exit(1);
}

const base = resolve(process.cwd(), 'public/data', version);
const read = (file: string) => JSON.parse(readFileSync(resolve(base, `${file}.json`), 'utf-8'));

try {
  const data = assembleGameData({
    items: read('items'),
    buildings: read('buildings'),
    recipes: read('recipes'),
    belts: read('belts'),
    generators: read('generators'),
  });
  console.log(
    `✓ ${version} : valide — ${data.items.length} items, ${data.buildings.length} bâtiments, ` +
      `${data.recipes.length} recettes (${data.recipes.filter((r) => r.alternate).length} alternatives).`,
  );
} catch (err) {
  console.error(`✗ ${version} : VALIDATION ÉCHOUÉE —`, err instanceof Error ? err.message : err);
  process.exit(1);
}
