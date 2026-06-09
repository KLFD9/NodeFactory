import { createContext } from 'react';

/** Flux réellement mesuré sur les arêtes connectées à un node. */
export interface NodeActualFlow {
  /** Somme des débits entrants par item (arêtes → target). */
  inputs: Map<string, number>;
  /** Somme des débits sortants par item (arêtes source →). */
  outputs: Map<string, number>;
}

/** Map nodeId → flux réel mesuré. Vide = aucune arête connectée ou gameData absent. */
export type NodeFlowMap = Map<string, NodeActualFlow>;

export const NodeFlowContext = createContext<NodeFlowMap>(new Map());
