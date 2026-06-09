import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import type { SolveResult } from '@/solver';

const COL_WIDTH = 320;
const ROW_HEIGHT = 120;

/** Capacités réelles des hubs logistiques Satisfactory. */
const SPLITTER_OUTPUTS = 3; // 1 entrée → 3 sorties max
const MERGER_INPUTS = 3; // 3 entrées max → 1 sortie

interface Endpoint {
  node: string;
  handle: string;
}

/**
 * Transforme une solution du solveur en graphe React Flow **fidèle** : un node par
 * machine physique, reliées par des **arbres de splitters (1→3) / mergers (3→1)** réels.
 * Pour un fan-in/out > 3, les hubs sont chaînés. Calcul PUR. (La disposition fine est
 * ensuite confiée à ELK dans l'auto-génération ; les positions ici servent de repli/tests.)
 */
export function buildGraphFromSolution(
  result: SolveResult,
  game: GameData,
): { nodes: MachineNode[]; edges: Edge[] } {
  const recipeById = new Map(game.recipes.map((r) => [r.id, r]));
  const isRaw = (id: string) => game.items.find((i) => i.id === id)?.raw ?? false;
  const nodes: MachineNode[] = [];
  const edges: Edge[] = [];
  let eid = 0;
  const edge = (src: Endpoint, dst: Endpoint) =>
    edges.push({ id: `e${eid++}`, source: src.node, sourceHandle: src.handle, target: dst.node, targetHandle: dst.handle });

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
      const id = `m-${idx}-${k}`;
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

  // Découpe un tableau en `k` groupes contigus à peu près égaux.
  const partition = <T,>(arr: T[], k: number): T[][] => {
    const groups: T[][] = [];
    const size = Math.ceil(arr.length / k);
    for (let i = 0; i < arr.length; i += size) groups.push(arr.slice(i, i + size));
    return groups;
  };

  // Arbre de mergers (3 entrées max) : combine N sources en une seule sortie.
  let hubId = 0;
  const hubX = new Map<string, number>(); // x indicatif par item
  const mergeInputs = (item: string, sources: Endpoint[]): Endpoint => {
    let level = sources;
    while (level.length > 1) {
      const next: Endpoint[] = [];
      for (let i = 0; i < level.length; i += MERGER_INPUTS) {
        const chunk = level.slice(i, i + MERGER_INPUTS);
        if (chunk.length === 1) {
          next.push(chunk[0]);
          continue;
        }
        const mg = `mg-${item}-${hubId++}`;
        nodes.push({
          id: mg,
          type: 'machine',
          position: { x: hubX.get(item) ?? 0, y: 0 },
          data: { buildingId: 'merger', portsIn: chunk.length, portsOut: 1 },
        });
        chunk.forEach((src, k) => edge(src, { node: mg, handle: `in-${k}` }));
        next.push({ node: mg, handle: 'out-0' });
      }
      level = next;
    }
    return level[0];
  };

  // Arbre de splitters (3 sorties max) : distribue une source vers N consommateurs.
  const splitOutput = (item: string, src: Endpoint, consumers: Endpoint[]) => {
    if (consumers.length === 1) {
      edge(src, consumers[0]);
      return;
    }
    const branches = Math.min(SPLITTER_OUTPUTS, consumers.length);
    const sp = `sp-${item}-${hubId++}`;
    nodes.push({
      id: sp,
      type: 'machine',
      position: { x: (hubX.get(item) ?? 0) + COL_WIDTH * 0.4, y: 0 },
      data: { buildingId: 'splitter', portsIn: 1, portsOut: branches },
    });
    edge(src, { node: sp, handle: 'in-0' });
    partition(consumers, branches).forEach((group, i) =>
      splitOutput(item, { node: sp, handle: `out-${i}` }, group),
    );
  };

  for (const [item, producers] of producersByItem) {
    const consumers = consumersByItem.get(item);
    if (!consumers || consumers.length === 0) continue;
    const prodLayer = Math.max(...producers.map((id) => selLayer[Number(id.split('-')[1])] ?? 0));
    hubX.set(item, (prodLayer + 0.5) * COL_WIDTH);

    const bus = mergeInputs(
      item,
      producers.map((p) => ({ node: p, handle: `out-${item}` })),
    );
    splitOutput(
      item,
      bus,
      consumers.map((c) => ({ node: c, handle: `in-${item}` })),
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

  return { nodes, edges };
}
