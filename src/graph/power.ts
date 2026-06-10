/**
 * power.ts — Réseaux électriques, calcul PUR (composantes connexes).
 *
 * Chaque node de machine (hors logistique) porte deux pins « énergie » (top = `power-in`,
 * bottom = `power-out`) reliés par des arêtes dédiées (handles `power-in`/`power-out`).
 * Un réseau = une composante connexe de ce graphe de câbles. Un réseau est `powered` si sa
 * génération (bâtiments `category === 'power'`) couvre sa demande (tous les autres bâtiments,
 * convention `Building.powerMW` = consommation pour ces catégories).
 *
 * Un node isolé (aucune arête `power-*`) forme son propre réseau d'un seul élément :
 * un générateur seul est `powered` (pas de demande à couvrir) ; un consommateur seul et
 * non câblé est `unpowered` dès qu'il a une demande > 0.
 */

import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';

const EPS = 0.001;
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Un handle source porte-t-il de l'énergie ? `power-out` (générateurs, consommateurs en
 * sortie — non utilisé) ou `power-out-0/1/2` (poteau électrique : 3 sorties de dispatch).
 */
export function isPowerSourceHandle(h: string | null | undefined): boolean {
  return h === 'power-out' || (!!h && h.startsWith('power-out-'));
}

/** Un handle cible porte-t-il de l'énergie ? Un seul id générique : `power-in`. */
export function isPowerTargetHandle(h: string | null | undefined): boolean {
  return h === 'power-in';
}

/** Un réseau électrique = une composante connexe du graphe de câbles « énergie ». */
export interface PowerNetwork {
  /** Identifiant stable (id du premier node du réseau, par ordre de découverte). */
  id: string;
  nodeIds: string[];
  /** Génération totale du réseau, en MW (somme des `powerMW` des bâtiments `category === 'power'`). */
  totalGenMW: number;
  /** Demande totale du réseau, en MW (somme des `powerMW` des autres bâtiments). */
  totalDemandMW: number;
  /** true si `totalGenMW >= totalDemandMW` (à epsilon près). */
  powered: boolean;
}

export interface PowerNetworksResult {
  networks: PowerNetwork[];
  /** Map nodeId → réseau alimenté ? (absent = node hors-jeu, ex. logistique). */
  poweredByNode: Map<string, boolean>;
}

/**
 * Calcule les réseaux électriques du graphe par union-find sur les arêtes
 * `sourceHandle === 'power-out'` / `targetHandle === 'power-in'`.
 */
export function computePowerNetworks(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
): PowerNetworksResult {
  const buildingOf = (n: MachineNode) => game.buildings.find((b) => b.id === n.data.buildingId);

  // Seuls les bâtiments non logistiques portent des pins d'énergie.
  const eligible = nodes.filter((n) => {
    const b = buildingOf(n);
    return !!b && b.category !== 'logistics';
  });
  const eligibleIds = new Set(eligible.map((n) => n.id));

  const parent = new Map<string, string>();
  for (const n of eligible) parent.set(n.id, n.id);

  const find = (x: string): string => {
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root)!;
    // Path compression
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur)!;
      parent.set(cur, root);
      cur = next;
    }
    return root;
  };

  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const e of edges) {
    if (
      isPowerSourceHandle(e.sourceHandle) &&
      isPowerTargetHandle(e.targetHandle) &&
      eligibleIds.has(e.source) &&
      eligibleIds.has(e.target)
    ) {
      union(e.source, e.target);
    }
  }

  const groups = new Map<string, string[]>();
  for (const n of eligible) {
    const root = find(n.id);
    const list = groups.get(root);
    if (list) list.push(n.id);
    else groups.set(root, [n.id]);
  }

  const networks: PowerNetwork[] = [];
  const poweredByNode = new Map<string, boolean>();

  for (const [root, nodeIds] of groups) {
    let totalGenMW = 0;
    let totalDemandMW = 0;
    for (const id of nodeIds) {
      const node = eligible.find((n) => n.id === id)!;
      const building = buildingOf(node)!;
      const count = Math.max(1, node.data.count ?? 1);
      if (building.category === 'power') {
        totalGenMW += building.powerMW * count;
      } else {
        totalDemandMW += building.powerMW * count;
      }
    }
    const powered = totalDemandMW <= totalGenMW + EPS;
    networks.push({
      id: root,
      nodeIds,
      totalGenMW: round(totalGenMW),
      totalDemandMW: round(totalDemandMW),
      powered,
    });
    for (const id of nodeIds) poweredByNode.set(id, powered);
  }

  return { networks, poweredByNode };
}
