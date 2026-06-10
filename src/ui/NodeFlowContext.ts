import { createContext } from 'react';
import type { NodeActualFlow, NodeFlowMap } from '@/graph/machineStatus';

// Les types vivent dans la couche graph (pure) ; on les réexporte pour compat.
export type { NodeActualFlow, NodeFlowMap };

export const NodeFlowContext = createContext<NodeFlowMap>(new Map());

/** Map nodeId → réseau électrique alimenté ? (depuis `computePowerNetworks`). */
export const PowerContext = createContext<Map<string, boolean>>(new Map());

/** Map nodeId → nombre de câbles énergie connectés (pour le badge "x/4" du poteau électrique). */
export const PowerConnectionsContext = createContext<Map<string, number>>(new Map());

/** Totaux du réseau électrique (gen/demande) auquel appartient un node — pour la carte générateur. */
export interface PowerNetworkInfo {
  totalGenMW: number;
  totalDemandMW: number;
}

/** Map nodeId → totaux du réseau électrique auquel il appartient. */
export const PowerNetworkContext = createContext<Map<string, PowerNetworkInfo>>(new Map());
