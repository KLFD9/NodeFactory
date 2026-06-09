import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import type { SolveResult } from '@/solver';
import { connectFlow, type Endpoint, type LogisticsSink } from './logistics';

const COL_WIDTH = 320;
const ROW_HEIGHT = 120;

export interface BuiltGraph {
  nodes: MachineNode[];
  edges: Edge[];
  /** Producteurs des items cibles non consommés en interne (à brancher sur l'existant). */
  openOutputs: Map<string, Endpoint[]>;
}

/**
 * Transforme une solution du solveur en graphe React Flow **fidèle** : un node par machine
 * physique, reliées par des **arbres de splitters (1→3) / mergers (3→1)** réels. `prefix`
 * permet d'éviter les collisions d'ids quand on greffe le résultat sur un graphe existant
 * (optimisation assistée). Calcul PUR. ELK affine ensuite la disposition.
 */
export function buildGraphFromSolution(
  result: SolveResult,
  game: GameData,
  prefix = '',
): BuiltGraph {
  const recipeById = new Map(game.recipes.map((r) => [r.id, r]));
  const isRaw = (id: string) => game.items.find((i) => i.id === id)?.raw ?? false;
  const nodes: MachineNode[] = [];
  const edges: Edge[] = [];
  let eid = 0;
  let hub = 0;
  let hubX = 0;
  const edge = (src: Endpoint, dst: Endpoint) =>
    edges.push({ id: `${prefix}e${eid++}`, source: src.node, sourceHandle: src.handle, target: dst.node, targetHandle: dst.handle });
  const sink: LogisticsSink = {
    pushNode: (n) => nodes.push(n),
    pushEdge: edge,
    hubId: () => `${prefix}hub-${hub++}`,
    hubPosition: () => ({ x: hubX, y: 0 }),
  };

  // Profondeur (couche) de chaque sélection selon ses ingrédients non bruts.
  const producersOfSel = new Map<string, number[]>();
  result.selections.forEach((s, idx) => {
    recipeById.get(s.recipeId)?.products.forEach((p) => {
      const list = producersOfSel.get(p.item) ?? [];
      list.push(idx);
      producersOfSel.set(p.item, list);
    });
  });
  const layerCache = new Map<number, number>();
  const computing = new Set<number>();
  const layerOf = (idx: number): number => {
    if (layerCache.has(idx)) return layerCache.get(idx)!;
    if (computing.has(idx)) return 0;
    computing.add(idx);
    let layer = 0;
    for (const ing of recipeById.get(result.selections[idx].recipeId)?.ingredients ?? []) {
      if (isRaw(ing.item)) continue;
      for (const prod of producersOfSel.get(ing.item) ?? []) {
        if (prod !== idx) layer = Math.max(layer, layerOf(prod) + 1);
      }
    }
    computing.delete(idx);
    layerCache.set(idx, layer);
    return layer;
  };

  // Un node par machine ; mémorise par item les machines productrices/consommatrices.
  const producersByItem = new Map<string, string[]>();
  const consumersByItem = new Map<string, string[]>();
  const selLayer: number[] = [];
  const pushTo = (map: Map<string, string[]>, item: string, id: string) =>
    map.set(item, [...(map.get(item) ?? []), id]);

  result.selections.forEach((s, idx) => {
    const recipe = recipeById.get(s.recipeId);
    const layer = layerOf(idx);
    selLayer[idx] = layer;
    for (let k = 0; k < s.machineCount; k++) {
      const id = `${prefix}m-${idx}-${k}`;
      nodes.push({
        id,
        type: 'machine',
        position: { x: layer * COL_WIDTH, y: 0 },
        data: { buildingId: s.building, recipeId: recipe ? s.recipeId : undefined, count: 1 },
      });
      recipe?.products.forEach((p) => pushTo(producersByItem, p.item, id));
      recipe?.ingredients.forEach((ing) => {
        if (!isRaw(ing.item)) pushTo(consumersByItem, ing.item, id);
      });
    }
  });

  // Relie producteurs → consommateurs par item (arbres de hubs). Les items sans
  // consommateur interne (cibles) restent en sorties ouvertes.
  const openOutputs = new Map<string, Endpoint[]>();
  for (const [item, producers] of producersByItem) {
    const consumers = consumersByItem.get(item);
    const producerEndpoints = producers.map((p) => ({ node: p, handle: `out-${item}` }));
    if (!consumers || consumers.length === 0) {
      openOutputs.set(item, producerEndpoints);
      continue;
    }
    const prodLayer = Math.max(
      ...producers.map((id) => selLayer[Number(id.replace(prefix, '').split('-')[1])] ?? 0),
    );
    hubX = (prodLayer + 0.5) * COL_WIDTH;
    connectFlow(
      producerEndpoints,
      consumers.map((c) => ({ node: c, handle: `in-${item}` })),
      sink,
    );
  }

  // Disposition verticale de repli : empile par colonne (x arrondi). ELK affine ensuite.
  const colRows = new Map<number, number>();
  for (const n of nodes) {
    const col = Math.round(n.position.x / 40);
    const row = colRows.get(col) ?? 0;
    colRows.set(col, row + 1);
    n.position = { x: n.position.x, y: row * ROW_HEIGHT };
  }

  return { nodes, edges, openOutputs };
}
