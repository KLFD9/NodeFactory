import type { Belt } from '@/data/types';

/**
 * Couche graphe + logistique — DÉCOUPLÉE du solveur.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  STUB — à implémenter après le solveur (brief §9.6, tests 8-10).           │
 * │  Le solveur décide QUOI/COMBIEN produire ; cette couche décide COMMENT     │
 * │  router. Aucun coût de convoyeur dans le LP au MVP (v2).                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Responsabilités :
 *  - construire les nœuds/arêtes React Flow depuis une `SolveResult` ;
 *  - tiering convoyeur : débit d'arête → tier minimal ;
 *  - si débit > capacité max (1200/min) : splitter + `ceil(débit/1200)` lignes ;
 *  - mergers pour regrouper les sources ; colorer les arêtes par tier ; signaler surcharge.
 */

/** Tier de convoyeur minimal couvrant `ratePerMin`, ou null si > capacité max. */
export function minBeltTier(belts: Belt[], ratePerMin: number): Belt | null {
  const sorted = [...belts].sort((a, b) => a.capacityPerMin - b.capacityPerMin);
  return sorted.find((b) => b.capacityPerMin >= ratePerMin) ?? null;
}
