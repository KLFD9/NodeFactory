import ELK, { type ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Edge } from '@xyflow/react';
import type { MachineNode } from '@/store/useGraphStore';

const elk = new ELK();

const isLogistics = (n: MachineNode) =>
  n.data.buildingId === 'merger' || n.data.buildingId === 'splitter';

/**
 * Dispose le graphe en couches gauche→droite (bruts → cible) via ELK (`layered`),
 * en minimisant les croisements. Remplace le placement grille de l'auto-génération.
 * Renvoie les nodes repositionnés (PUR vis-à-vis de React, async car ELK l'est).
 */
export async function layoutGraph(
  nodes: MachineNode[],
  edges: Edge[],
): Promise<MachineNode[]> {
  if (nodes.length === 0) return nodes;

  const graph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.spacing.nodeNode': '48',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    },
    children: nodes.map((n) => ({
      id: n.id,
      width: isLogistics(n) ? 60 : 190,
      height: isLogistics(n) ? 60 : 80,
    })),
    edges: edges.map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  };

  const res = await elk.layout(graph);
  const pos = new Map((res.children ?? []).map((c) => [c.id, c]));
  return nodes.map((n) => {
    const p = pos.get(n.id);
    return p ? { ...n, position: { x: p.x ?? 0, y: p.y ?? 0 } } : n;
  });
}
