import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import { computeNodeInfo, type PortFlow } from './nodeInfo';
import { isPowerSourceHandle, isPowerTargetHandle } from './power';

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

  // Câbles « énergie » : pins dédiés (power-out(-N) → power-in), réseau séparé des convoyeurs.
  // Pas de notion de port unique : un node peut être câblé à plusieurs voisins (réseau).
  const srcIsPower = isPowerSourceHandle(c.sourceHandle);
  const dstIsPower = isPowerTargetHandle(c.targetHandle);
  if (srcIsPower || dstIsPower) {
    return srcIsPower && dstIsPower;
  }

  // Port d'entrée déjà occupé ?
  const occupied = edges.some((e) => e.target === c.target && e.targetHandle === c.targetHandle);
  if (occupied) return false;

  // Compatibilité d'item (ignorée si l'un des deux côtés est un port logistique générique).
  const srcItem = handleItem(c.sourceHandle, 'out-');
  const dstItem = handleItem(c.targetHandle, 'in-');
  if (srcItem && dstItem && srcItem !== dstItem) return false;

  return true;
}

/**
 * Remappe ou supprime une arête d'un côté (`source` ou `target`) après que le node de
 * ce côté a changé de configuration (recette/ressource → nouveau jeu de ports `in-<item>`/
 * `out-<item>`). Renvoie `null` si l'arête n'a plus aucun port compatible côté `nodeId`.
 */
function remapHandle(
  edge: Edge,
  handleKey: 'sourceHandle' | 'targetHandle',
  prefix: 'in-' | 'out-',
  ports: PortFlow[],
  configured: boolean,
): Edge | null {
  if (!configured) {
    // Pas de recette : un seul port générique.
    return { ...edge, [handleKey]: `${prefix}0` };
  }

  const currentItem = handleItem(edge[handleKey], prefix);
  if (currentItem && ports.some((p) => p.itemId === currentItem)) return edge; // toujours valide

  // Port générique précédent (`in-0`/`out-0`) ou item disparu : déduit l'item depuis l'autre
  // extrémité de l'arête, sinon retombe sur le premier port disponible.
  const otherHandleKey = handleKey === 'sourceHandle' ? 'targetHandle' : 'sourceHandle';
  const otherPrefix = prefix === 'in-' ? 'out-' : 'in-';
  const otherItem = handleItem(edge[otherHandleKey], otherPrefix);
  const guess = otherItem ?? ports[0]?.itemId;

  if (guess && ports.some((p) => p.itemId === guess)) {
    return { ...edge, [handleKey]: `${prefix}${guess}` };
  }
  return null; // plus aucun port compatible → l'arête doit être supprimée
}

/**
 * Recalcule les arêtes connectées à `nodeId` après un changement de configuration
 * (recette / ressource extraite) qui modifie son jeu de ports `in-<item>`/`out-<item>`.
 *
 * Sans ce recalcul, une arête posée alors que le node était « À configurer » (ports
 * génériques `in-0`/`out-0`) référence des handles qui disparaissent dès que le node
 * passe en mode « par item » : l'arête devient invisible (handle introuvable côté React
 * Flow) et bloque toute nouvelle connexion sur ce port (`isValidGraphConnection` la
 * considère encore comme occupant le port générique).
 */
export function reconcileEdgesForNode(
  nodeId: string,
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
): Edge[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return edges;
  const info = computeNodeInfo(node.data, game);

  const result: Edge[] = [];
  for (const edge of edges) {
    let next: Edge | null = edge;
    // Câbles « énergie » : pins fixes, jamais remappés/supprimés par un changement de recette.
    if (isPowerSourceHandle(edge.sourceHandle) || isPowerTargetHandle(edge.targetHandle)) {
      result.push(edge);
      continue;
    }
    if (edge.target === nodeId) {
      next = remapHandle(edge, 'targetHandle', 'in-', info.inputs, info.configured);
    } else if (edge.source === nodeId) {
      next = remapHandle(edge, 'sourceHandle', 'out-', info.outputs, info.configured);
    }
    if (next) result.push(next);
  }
  return result;
}
