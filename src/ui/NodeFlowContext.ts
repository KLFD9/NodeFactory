import { createContext } from 'react';
import type { NodeActualFlow, NodeFlowMap } from '@/graph/machineStatus';

// Les types vivent dans la couche graph (pure) ; on les réexporte pour compat.
export type { NodeActualFlow, NodeFlowMap };

export const NodeFlowContext = createContext<NodeFlowMap>(new Map());
