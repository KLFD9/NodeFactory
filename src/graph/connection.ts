import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';

/** Forme commune à `Connection` et `Edge` (handles éventuellement absents). */
export interface ConnectionLike {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

/** Item porté par un handle `out-<item>` / `in-<item>`, ou null si handle générique (logistique). */
function handleItem(handleId: string | null | undefined, prefix: 'in-' | 'out-'): string | null {
  if (!handleId || !handleId.startsWith(prefix)) return null;
  const rest = handleId.slice(prefix.length);
  return /^\d+$/.test(rest) ? null : rest; // `in-0` (logistique) → pas d'item
}

/**
 * Règles de connexion manuelle (calcul PUR, testable). React Flow garantit déjà
 * source→target via `connectionMode="strict"`. On ajoute les règles métier :
 *  - pas de self-loop ;
 *  - un port d'entrée n'accepte qu'un seul convoyeur ;
 *  - items compatibles (un `out-<X>` ne peut alimenter qu'un `in-<X>`).
 */
export function isValidGraphConnection(
  c: ConnectionLike,
  edges: Edge[],
  _nodes: MachineNode[],
  _game: GameData,
): boolean {
  if (c.source === c.target) return false;

  // Port d'entrée déjà occupé ?
  const occupied = edges.some((e) => e.target === c.target && e.targetHandle === c.targetHandle);
  if (occupied) return false;

  // Compatibilité d'item (ignorée si l'un des deux côtés est un port logistique générique).
  const srcItem = handleItem(c.sourceHandle, 'out-');
  const dstItem = handleItem(c.targetHandle, 'in-');
  if (srcItem && dstItem && srcItem !== dstItem) return false;

  return true;
}
