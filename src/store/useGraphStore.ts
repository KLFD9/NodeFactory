import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
import type { GameData, Purity } from '@/data/types';
import { reconcileEdgesForNode } from '@/graph/connection';
import { BUILDING_COSTS } from '@/game/balance';
import { useProgressionStore } from '@/store/useProgressionStore';
import { useFactoryStore } from '@/store/useFactoryStore';

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
  /** Extracteurs liés à un gisement : gisement + pin occupé (ressource/pureté en sont dérivés). */
  depositId?: string;
  pinIndex?: number;
  /** Nombre de machines représentées par ce node (×1 par défaut). */
  count?: number;
  /** Hubs logistiques (splitter/merger) : nombre de ports d'entrée/sortie dynamiques. */
  portsIn?: number;
  portsOut?: number;
  /** Rotation du bâtiment en degrés (0, 90, 180, 270). */
  rotation?: number;
}

export type MachineNode = Node<MachineNodeData, 'machine'>;

let nodeCounter = 0;
const nextId = () => `node-${++nodeCounter}`;

/** Recale le compteur d'ids sur les nodes restaurés (évite toute collision après reload). */
function syncNodeCounter(nodes: MachineNode[]): void {
  for (const n of nodes) {
    const m = /^node-(\d+)$/.exec(n.id);
    if (m) nodeCounter = Math.max(nodeCounter, Number(m[1]));
  }
}

/**
 * Données initiales d'un node fraîchement posé.
 *  - extracteur → pureté Normale par défaut (la ressource viendra du gisement).
 *  - bâtiment MONO-RECETTE (ex. Coal Generator) → recette auto-assignée : inutile de la choisir
 *    à la main, et ça évite que le choix ultérieur ne casse une connexion déjà posée (le port
 *    générique `in-0` devient directement `in-<item>`).
 */
function initialNodeData(buildingId: string, category: string): MachineNodeData {
  const data: MachineNodeData = { buildingId };
  if (category === 'extraction') data.purity = 'normal';
  const game = useFactoryStore.getState().gameData;
  if (game) {
    const std = game.recipes.filter((r) => r.producedIn === buildingId && !r.alternate);
    if (std.length === 1) data.recipeId = std[0].id;
  }
  return data;
}

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
  /** Pose un nouveau node de bâtiment et divise éventuellement une arête existante. */
  dropBuildingNode: (buildingId: string, position: XYPosition, category: string, splitEdgeId?: string | null) => void;
  /**
   * Met à jour la config d'un node (recette, ressource, pureté…).
   * Si `gameData` est fourni, les arêtes connectées sont remappées/supprimées en cas de
   * changement des ports `in-<item>`/`out-<item>` (voir `reconcileEdgesForNode`).
   */
  updateNodeData: (id: string, patch: Partial<MachineNodeData>, gameData?: GameData) => void;
  /** Supprime un node et ses arêtes connectées. */
  deleteNode: (id: string) => void;
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

  /** Dernière pose refusée faute d'AP suffisants (transitoire, pour notification UI). */
  placementDenied: { buildingId: string; cost: number; available: number } | null;
  /** Efface la notification de pose refusée. */
  dismissPlacementDenied: () => void;

  /** Lie un extracteur existant à un pin de gisement (drag-snap) : le pose dessus et dénormalise
   *  ressource + pureté sur le node (`computeNodeInfo` reste inchangé). */
  snapMinerToPin: (nodeId: string, binding: MinerBinding) => void;
  /** Détache un extracteur de son gisement (redevient libre/inactif). */
  unbindMiner: (nodeId: string) => void;
  /** Crée un nouvel extracteur `miner-mk1` déjà lié à un pin (clic-sur-pin). Respecte le coût AP. */
  placeMinerOnPin: (binding: MinerBinding) => void;
  /** Détache tous les extracteurs (utilisé quand la carte est régénérée). */
  unbindAllMiners: () => void;
}

/** Données de liaison d'un mineur à un pin (passées en primitifs pour découpler du module monde). */
export interface MinerBinding {
  depositId: string;
  pinIndex: number;
  resourceId: string;
  purity: Purity;
  /** Coordonnées flow du pin (centre visé pour la pose). */
  x: number;
  y: number;
}

/** Demi-dimensions approximatives d'une carte mineur, pour centrer la pose sur le pin. */
const MINER_HALF_W = 110;
const MINER_HALF_H = 40;

export const useGraphStore = create<GraphState>()(
  persist(
    (set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  generation: 0,

  onNodesChange: (changes) =>
    set((state) => ({ nodes: applyNodeChanges(changes, state.nodes) })),

  onEdgesChange: (changes) =>
    set((state) => ({ edges: applyEdgeChanges(changes, state.edges) })),

  onConnect: (connection) => set((state) => ({ edges: addEdge(connection, state.edges) })),

  placementDenied: null,
  dismissPlacementDenied: () => set({ placementDenied: null }),

  addBuildingNode: (buildingId, position, category) =>
    set((state) => {
      const cost = BUILDING_COSTS[buildingId] ?? 0;
      if (cost > 0 && !useProgressionStore.getState().spendAP(cost)) {
        return {
          placementDenied: { buildingId, cost, available: useProgressionStore.getState().automationPoints },
        };
      }
      const id = nextId();
      const node: MachineNode = {
        id,
        type: 'machine',
        position,
        data: initialNodeData(buildingId, category),
      };
      return { nodes: [...state.nodes, node], selectedNodeId: id };
    }),

  dropBuildingNode: (buildingId, position, category, splitEdgeId) =>
    set((state) => {
      const cost = BUILDING_COSTS[buildingId] ?? 0;
      if (cost > 0 && !useProgressionStore.getState().spendAP(cost)) {
        return {
          placementDenied: { buildingId, cost, available: useProgressionStore.getState().automationPoints },
        };
      }
      const id = nextId();
      const node: MachineNode = {
        id,
        type: 'machine',
        position,
        data: initialNodeData(buildingId, category),
      };

      let newEdges = [...state.edges];
      // Seuls les hubs logistiques (splitter/merger) coupent l'arête : eux gardent des
      // handles in-0/out-0 stables. Une machine se configure ensuite en handles par item.
      if (splitEdgeId && category === 'logistics') {
        const edgeToSplit = state.edges.find((e) => e.id === splitEdgeId);
        if (edgeToSplit) {
          // Remove the split edge
          newEdges = newEdges.filter((e) => e.id !== splitEdgeId);

          // Add edge from source to new node input (in-0)
          const edge1Id = `e-${nextId()}`;
          newEdges.push({
            id: edge1Id,
            source: edgeToSplit.source,
            sourceHandle: edgeToSplit.sourceHandle,
            target: id,
            targetHandle: 'in-0',
          });

          // Add edge from new node output (out-0) to target
          const edge2Id = `e-${nextId()}`;
          newEdges.push({
            id: edge2Id,
            source: id,
            sourceHandle: 'out-0',
            target: edgeToSplit.target,
            targetHandle: edgeToSplit.targetHandle,
          });
        }
      }

      return {
        nodes: [...state.nodes, node],
        edges: newEdges,
        selectedNodeId: id,
      };
    }),

  updateNodeData: (id, patch, gameData) =>
    set((state) => {
      const nodes = state.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
      const edges = gameData ? reconcileEdgesForNode(id, nodes, state.edges, gameData) : state.edges;
      return { nodes, edges };
    }),

  deleteNode: (id) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== id),
      edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
    })),

  selectNode: (selectedNodeId) =>
    set((state) => ({
      selectedNodeId,
      nodes: state.nodes.map((n) => ({
        ...n,
        selected: n.id === selectedNodeId,
      })),
    })),

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

  snapMinerToPin: (nodeId, b) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              position: { x: b.x - MINER_HALF_W, y: b.y - MINER_HALF_H },
              data: {
                ...n.data,
                depositId: b.depositId,
                pinIndex: b.pinIndex,
                resourceId: b.resourceId,
                purity: b.purity,
              },
            }
          : n,
      ),
    })),

  unbindMiner: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              data: {
                ...n.data,
                depositId: undefined,
                pinIndex: undefined,
                resourceId: undefined,
                purity: undefined,
              },
            }
          : n,
      ),
    })),

  placeMinerOnPin: (b) =>
    set((state) => {
      const buildingId = 'miner-mk1';
      const cost = BUILDING_COSTS[buildingId] ?? 0;
      if (cost > 0 && !useProgressionStore.getState().spendAP(cost)) {
        return {
          placementDenied: { buildingId, cost, available: useProgressionStore.getState().automationPoints },
        };
      }
      const id = nextId();
      const node: MachineNode = {
        id,
        type: 'machine',
        position: { x: b.x - MINER_HALF_W, y: b.y - MINER_HALF_H },
        data: {
          buildingId,
          depositId: b.depositId,
          pinIndex: b.pinIndex,
          resourceId: b.resourceId,
          purity: b.purity,
        },
      };
      return { nodes: [...state.nodes, node], selectedNodeId: id };
    }),

  unbindAllMiners: () =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.data.depositId != null
          ? {
              ...n,
              data: {
                ...n.data,
                depositId: undefined,
                pinIndex: undefined,
                resourceId: undefined,
                purity: undefined,
              },
            }
          : n,
      ),
    })),
    }),
    {
      // L'usine EST la sauvegarde du joueur : sans elle, un reload détruirait toute la
      // production (et le taux d'AP retomberait à zéro) alors que la progression survit.
      name: 'nf-graph',
      version: 1,
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
      onRehydrateStorage: () => (state) => {
        if (state) syncNodeCounter(state.nodes);
      },
    },
  ),
);
