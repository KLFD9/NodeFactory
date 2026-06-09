import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import { solveDemands, type Objective } from '@/solver';
import { computeFactory } from './computeFactory';
import { computeNodeInfo } from './nodeInfo';
import { buildGraphFromSolution } from './buildGraphFromSolution';
import { connectFlow, type Endpoint, type LogisticsSink } from './logistics';

export interface CompleteResult {
  nodes: MachineNode[];
  edges: Edge[];
  /** Ce qui a été ajouté pour combler les déficits. */
  addedMachines: number;
  addedPowerMW: number;
  filled: { item: string; rate: number }[];
}

/**
 * Optimisation assistée — « Compléter l'usine ».
 *
 * Lit les **déficits** du graphe manuel (items consommés mais pas assez produits, hors bruts),
 * résout l'amont manquant en une passe (objectif + alternatives au choix), puis **greffe** ce
 * sous-graphe et le **branche** sur les consommateurs existants via des arbres splitter/merger.
 * Les nodes existants sont conservés tels quels. Renvoie `null` si aucun déficit.
 */
export async function completeFactory(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
  objective: Objective,
  allowedAlternates?: string[],
): Promise<CompleteResult | null> {
  const summary = computeFactory(nodes, edges, game);
  if (summary.deficits.length === 0) return null;

  const demands = new Map(summary.deficits.map((d) => [d.itemId, d.ratePerMin]));
  const result = await solveDemands(game, demands, objective, allowedAlternates);
  const sub = buildGraphFromSolution(result, game, 'opt-');

  const mergedNodes = [...nodes, ...sub.nodes];
  const mergedEdges = [...edges, ...sub.edges];
  let hub = 0;
  let eid = 0;
  const bridge: LogisticsSink = {
    pushNode: (n) => mergedNodes.push(n),
    pushEdge: (s, d) =>
      mergedEdges.push({ id: `br-e${eid++}`, source: s.node, sourceHandle: s.handle, target: d.node, targetHandle: d.handle }),
    hubId: () => `br-hub-${hub++}`,
    hubPosition: () => ({ x: 0, y: 0 }),
  };

  // Ports d'entrée déjà alimentés (ne pas re-brancher dessus).
  const fed = new Set(edges.filter((e) => e.targetHandle).map((e) => `${e.target}|${e.targetHandle}`));

  for (const d of summary.deficits) {
    const producers = sub.openOutputs.get(d.itemId) ?? [];
    if (producers.length === 0) continue;
    const consumers: Endpoint[] = nodes.flatMap((n) => {
      const info = computeNodeInfo(n.data, game);
      if (!info.inputs.some((inp) => inp.itemId === d.itemId)) return [];
      const handle = `in-${d.itemId}`;
      return fed.has(`${n.id}|${handle}`) ? [] : [{ node: n.id, handle }];
    });
    if (consumers.length === 0) continue;
    connectFlow(producers, consumers, bridge);
  }

  return {
    nodes: mergedNodes,
    edges: mergedEdges,
    addedMachines: result.totalMachines,
    addedPowerMW: result.totalPowerMW,
    filled: summary.deficits.map((d) => ({ item: d.itemId, rate: d.ratePerMin })),
  };
}
