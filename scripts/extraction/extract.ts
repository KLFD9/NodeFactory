/**
 * Extraction des vraies données Satisfactory 1.0 → schéma normalisé.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  STUB NON IMPLÉMENTÉ — point d'ancrage pour la v2.                        │
 * │  Ne PAS implémenter tant que le MVP n'est pas solide.                     │
 * │  Le MVP tourne sur le mock (/public/data/mock/). Voir le README.         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Pipeline visé : Docs.json → parse → normalize → validate → write JSON.
 * La sortie respecte EXACTEMENT `src/data/types.ts` (GameData), de sorte que
 * brancher les vraies données ne touche que `loadGameData`, jamais le solveur ni l'UI.
 *
 * Usage prévu (plus tard) :
 *   npx tsx scripts/extraction/extract.ts --docs <Docs.json> --version 1.0
 */

import type { GameData } from '../../src/data/types';

interface ExtractOptions {
  /** Chemin vers le Docs.json livré avec le jeu. */
  docsPath: string;
  /** Version de patch cible (ex. "1.0") → /public/data/{version}/. */
  version: string;
}

/** Étape 1 — parser le Docs.json brut. TODO. */
function parseDocs(_docsPath: string): unknown {
  // TODO: lire le fichier (attention à l'encodage UTF-16), JSON.parse.
  throw new Error('extract.ts: parseDocs non implémenté (v2).');
}

/** Étape 2 — normaliser l'AST natif vers notre schéma `GameData`. TODO. */
function normalize(_raw: unknown): GameData {
  // TODO: mapper FGRecipe / FGBuildingDescriptor / FGItemDescriptor → Recipe/Building/GameItem.
  //       Convertir durées (s) et quantités par cycle ; déduire `raw` et `category`.
  throw new Error('extract.ts: normalize non implémenté (v2).');
}

/** Étape 4 — écrire les 5 fichiers JSON dans /public/data/{version}/. TODO. */
function writeBundle(_data: GameData, _version: string): void {
  // TODO: écrire items/buildings/recipes/belts/generators.json.
  throw new Error('extract.ts: writeBundle non implémenté (v2).');
}

export function extract(_opts: ExtractOptions): void {
  // Pipeline (étape 3 = validateGameData, à réutiliser depuis src/data/validate.ts) :
  //   const raw = parseDocs(opts.docsPath);
  //   const data = validateGameData(normalize(raw));
  //   writeBundle(data, opts.version);
  throw new Error('extract.ts: pipeline non implémenté (v2). Voir scripts/extraction/README.md.');
}

// Garde les helpers "utilisés" pour le typecheck tant que le pipeline est en stub.
void parseDocs;
void normalize;
void writeBundle;
