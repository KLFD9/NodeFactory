import { create } from 'zustand';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type XYPosition,
} from '@xyflow/react';
import type { Purity } from '@/data/types';

/**
 * Données portées par un node de l'éditeur. Un node = une instance de bâtiment posée
 * par l'utilisateur (mode manuel) ou par l'auto-génération.
 */
export interface MachineNodeData extends Record<string, unknown> {
  buildingId: string;
  /** Machines à recette (smelter, constructor…) : recette choisie. */
  recipeId?: string;
  /** Extracteurs : ressource extraite + pureté du nœud. */
  resourceId?: string;
  purity?: Purity;
  /** Nombre de machines représentées par ce node (×1 par défaut). */
  count?: number;
  /** Hubs logistiques (splitter/merger) : nombre de ports d'entrée/sortie dynamiques. */
  portsIn?: number;
  portsOut?: number;
}

export type MachineNode = Node<MachineNodeData, 'machine'>;

let nodeCounter = 0;
const nextId = () => `node-${++nodeCounter}`;

interface GraphState {
  nodes: MachineNode[];
  edges: Edge[];
  selectedNodeId: string | null;
  /** Incrémenté à chaque remplacement de graphe — déclenche un recentrage du canvas. */
  generation: number;

  onNodesChange: (changes: NodeChange<MachineNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  /** Pose un nouveau node de bâtiment à la position donnée (drop palette). */
  addBuildingNode: (buildingId: string, position: XYPosition, category: string) => void;
  /** Met à jour la config d'un node (recette, ressource, pureté…). */
  updateNodeData: (id: string, patch: Partial<MachineNodeData>) => void;
  selectNode: (id: string | null) => void;
  /** Remplace tout le graphe (utilisé par l'auto-génération depuis le solveur). */
  setGraph: (nodes: MachineNode[], edges: Edge[]) => void;

  /** Presse-papier de nodes (copié-collé). */
  clipboard: { nodes: MachineNode[]; edges: Edge[] } | null;
  /** Copie les nodes sélectionnés (+ leurs arêtes internes). */
  copySelection: () => void;
  /** Colle le presse-papier décalé, et sélectionne les copies. */
  paste: () => void;
  /** Copie puis colle immédiatement la sélection (duplication). */
  duplicateSelection: () => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  generation: 0,

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) => set((state) => ({ edges: addEdge(connection, state.edges) })),

  addBuildingNode: (buildingId, position, category) =>
    set((state) => {
      const id = nextId();
      const node: MachineNode = {
        id,
        type: 'machine',
        position,
        // Pré-règle la pureté Normale pour un extracteur ; les machines choisiront leur recette.
        data: { buildingId, ...(category === 'extraction' ? { purity: 'normal' as Purity } : {}) },
      };
      return { nodes: [...state.nodes, node], selectedNodeId: id };
    }),

  updateNodeData: (id, patch) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    })),

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  setGraph: (nodes, edges) =>
    set((state) => ({ nodes, edges, selectedNodeId: null, generation: state.generation + 1 })),

  clipboard: null,

  copySelection: () =>
    set((state) => {
      const selected = state.nodes.filter((n) => n.selected);
      if (selected.length === 0) return {};
      const ids = new Set(selected.map((n) => n.id));
      const internalEdges = state.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
      return { clipboard: { nodes: selected, edges: internalEdges } };
    }),

  paste: () =>
    set((state) => {
      const cb = state.clipboard;
      if (!cb || cb.nodes.length === 0) return {};
      const idMap = new Map<string, string>();
      const clones: MachineNode[] = cb.nodes.map((n) => {
        const id = nextId();
        idMap.set(n.id, id);
        return {
          ...n,
          id,
          selected: true,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          data: { ...n.data },
        };
      });
      const clonedEdges: Edge[] = cb.edges.map((e) => ({
        ...e,
        id: `${nextId()}-edge`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));
      const deselected = state.nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
      return {
        nodes: [...deselected, ...clones],
        edges: [...state.edges, ...clonedEdges],
        selectedNodeId: clones[0]?.id ?? null,
      };
    }),

  duplicateSelection: () => {
    get().copySelection();
    get().paste();
  },
}));
