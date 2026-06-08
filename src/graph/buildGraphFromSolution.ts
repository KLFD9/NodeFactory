import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import type { SolveResult } from '@/solver';

const COL_WIDTH = 320;
const ROW_HEIGHT = 120;

/**
 * Transforme une solution du solveur en graphe React Flow **fidèle** : un node par
 * machine physique (1 entrée / 1 sortie), les groupes reliés par des splitters/mergers
 * réels. Le solveur dit quoi/combien produire ; cette couche route physiquement. Calcul PUR.
 */
export function buildGraphFromSolution(
  result: SolveResult,
  game: GameData,
): { nodes: MachineNode[]; edges: Edge[] } {
  const recipeById = new Map(game.recipes.map((r) => [r.id, r]));
  const isRaw = (id: string) => game.items.find((i) => i.id === id)?.raw ?? false;
  const nodes: MachineNode[] = [];
  const edges: Edge[] = [];

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

  // Un node par machine. Mémorise, par item, les machines productrices/consommatrices.
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

  // Pour chaque item intermédiaire, relie producteurs → consommateurs via merger/splitter.
  let hubLayerX = 0;
  for (const [item, producers] of producersByItem) {
    const consumers = consumersByItem.get(item);
    if (!consumers || consumers.length === 0) continue;
    const edge = (id: string, source: string, sourceHandle: string, target: string, targetHandle: string) =>
      edges.push({ id, source, sourceHandle, target, targetHandle });

    // x indicatif d'un hub : entre la couche productrice et la couche consommatrice.
    const prodLayer = Math.max(...producers.map((id) => selLayer[Number(id.split('-')[1])] ?? 0));
    hubLayerX = (prodLayer + 0.5) * COL_WIDTH;

    let busNode = producers[0];
    let busHandle = `out-${item}`;

    if (producers.length > 1) {
      const mg = `mg-${item}`;
      nodes.push({
        id: mg,
        type: 'machine',
        position: { x: hubLayerX, y: 0 },
        data: { buildingId: 'merger', portsIn: producers.length, portsOut: 1 },
      });
      producers.forEach((p, i) => edge(`e-${p}-${mg}`, p, `out-${item}`, mg, `in-${i}`));
      busNode = mg;
      busHandle = 'out-0';
    }

    if (consumers.length > 1) {
      const sp = `sp-${item}`;
      nodes.push({
        id: sp,
        type: 'machine',
        position: { x: hubLayerX + COL_WIDTH * 0.3, y: 0 },
        data: { buildingId: 'splitter', portsIn: 1, portsOut: consumers.length },
      });
      edge(`e-${busNode}-${sp}`, busNode, busHandle, sp, 'in-0');
      consumers.forEach((c, i) => edge(`e-${sp}-${c}-${item}`, sp, `out-${i}`, c, `in-${item}`));
    } else {
      edge(`e-${busNode}-${consumers[0]}-${item}`, busNode, busHandle, consumers[0], `in-${item}`);
    }
  }

  // Disposition verticale : empile les nodes par colonne (x arrondi).
  const colRows = new Map<number, number>();
  for (const n of nodes) {
    const col = Math.round(n.position.x / 40);
    const row = colRows.get(col) ?? 0;
    colRows.set(col, row + 1);
    n.position = { x: n.position.x, y: row * ROW_HEIGHT };
  }

  return { nodes, edges };
}
