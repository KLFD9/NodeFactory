/**
 * machineStatus.ts — État opérationnel d'une machine, PUR et partagé.
 *
 * Source de vérité unique pour : le flux réel reçu/émis par node, et l'état qui en découle
 * (nominal / sous-alimenté / en attente). Consommé par MachineNode (badges) ET le panneau
 * d'audit bottleneck. Aucune dépendance React.
 */

import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode, MachineNodeData } from '@/store/useGraphStore';
import { computeFactory, type FactorySummary } from './computeFactory';
import { computeNodeInfo } from './nodeInfo';

/** Flux réellement mesuré sur les arêtes connectées à un node. */
export interface NodeActualFlow {
  /** Somme des débits entrants par item (arêtes → target). */
  inputs: Map<string, number>;
  /** Somme des débits sortants par item (arêtes source →). */
  outputs: Map<string, number>;
}

/** Map nodeId → flux réel mesuré. Vide = aucune arête connectée ou gameData absent. */
export type NodeFlowMap = Map<string, NodeActualFlow>;

/**
 * Construit la map des flux réels par node à partir du graphe : pour chaque arête résolue
 * (item + débit via `computeFactory`), additionne le débit côté entrée (target) et sortie (source).
 */
export function buildNodeFlowMap(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
  poweredOverride?: Map<string, boolean>,
): NodeFlowMap {
  const summary = computeFactory(nodes, edges, game, poweredOverride);
  return buildNodeFlowMapFromSummary(edges, summary);
}

/** Variante de `buildNodeFlowMap` à partir d'un `FactorySummary` déjà calculé (évite un recalcul). */
export function buildNodeFlowMapFromSummary(edges: Edge[], summary: FactorySummary): NodeFlowMap {
  const plans = new Map(summary.edges.map((p) => [p.edgeId, p]));
  const map: NodeFlowMap = new Map();
  const getFlow = (id: string): NodeActualFlow => {
    let f = map.get(id);
    if (!f) {
      f = { inputs: new Map(), outputs: new Map() };
      map.set(id, f);
    }
    return f;
  };
  for (const e of edges) {
    const plan = plans.get(e.id);
    if (!plan?.itemId) continue;
    const tgt = getFlow(e.target);
    tgt.inputs.set(plan.itemId, (tgt.inputs.get(plan.itemId) ?? 0) + plan.ratePerMin);
    const src = getFlow(e.source);
    src.outputs.set(plan.itemId, (src.outputs.get(plan.itemId) ?? 0) + plan.ratePerMin);
  }
  return map;
}

/** État opérationnel d'une machine configurée. */
export type MachineState = 'nominal' | 'starved' | 'blocked' | 'unpowered';

/** Un input requis mais insuffisamment alimenté (la cause d'un goulot). */
export interface MissingInput {
  itemId: string;
  itemName: string;
  /** Débit requis pour tourner à pleine capacité (items/min). */
  required: number;
  /** Débit réellement reçu (items/min). */
  actual: number;
}

export interface MachineStatus {
  /** true si le node porte une recette/ressource exploitable. */
  configured: boolean;
  /** État opérationnel, ou null si non configuré. */
  state: MachineState | null;
  /** Efficacité [0, 1] = min(actual/required) sur les inputs (extraction = 1). */
  efficiency: number;
  /** Inputs sous-alimentés (vide si nominal). */
  missing: MissingInput[];
}

/**
 * Calcule l'état d'une machine.
 *
 * Règle FEEL : un input requis mais NON alimenté compte comme 0 reçu → une machine configurée
 * mais non branchée est « en attente » (rouge), pas « nominale ». Les extracteurs sont toujours
 * nominaux (ils produisent depuis le gisement).
 *
 * @param data     Données du node.
 * @param flow     Flux réel mesuré pour ce node (depuis `buildNodeFlowMap`), ou undefined si isolé.
 * @param game     Données du jeu.
 * @param powered  Le réseau électrique de ce node couvre-t-il sa demande ?
 *                  (depuis `computePowerNetworks`). Par défaut `true` (rétro-compatible :
 *                  un node hors-jeu/non câblé est traité comme alimenté tant que l'appelant
 *                  ne fournit pas l'info réseau).
 */
export function computeMachineStatus(
  data: MachineNodeData,
  flow: NodeActualFlow | undefined,
  game: GameData,
  powered = true,
): MachineStatus {
  const info = computeNodeInfo(data, game);
  const building = info.building;
  if (!building || !info.configured) {
    return { configured: false, state: null, efficiency: 1, missing: [] };
  }
  // Priorité absolue : un bâtiment consommateur (powerMW > 0) non alimenté ne tourne pas
  // du tout, quel que soit son approvisionnement en matières.
  if (building.category !== 'power' && building.powerMW > 0 && !powered) {
    return { configured: true, state: 'unpowered', efficiency: 0, missing: [] };
  }
  if (building.category === 'extraction' || info.inputs.length === 0) {
    return { configured: true, state: 'nominal', efficiency: 1, missing: [] };
  }

  let minEff = 1;
  const missing: MissingInput[] = [];
  for (const inp of info.inputs) {
    if (inp.ratePerMin > 0) {
      const actual = flow?.inputs.get(inp.itemId) ?? 0;
      minEff = Math.min(minEff, actual / inp.ratePerMin);
      if (actual < inp.ratePerMin - 0.01) {
        missing.push({
          itemId: inp.itemId,
          itemName: inp.itemName,
          required: inp.ratePerMin,
          actual,
        });
      }
    }
  }
  const efficiency = Math.max(0, Math.min(1, minEff));
  const state: MachineState =
    efficiency < 0.01 ? 'blocked' : efficiency < 0.99 ? 'starved' : 'nominal';
  return { configured: true, state, efficiency, missing };
}
