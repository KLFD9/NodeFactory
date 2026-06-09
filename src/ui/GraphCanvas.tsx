import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  ConnectionLineType,
  type Connection,
  type NodeTypes,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import type { IsValidConnection } from '@xyflow/react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { computeFactory } from '@/graph/computeFactory';
import { computeNodeInfo } from '@/graph/nodeInfo';
import { isValidGraphConnection } from '@/graph/connection';
import { MachineNode } from './nodes/MachineNode';
import { BeltEdge } from './edges/BeltEdge';
import { PALETTE_MIME } from './Palette';
import { NodeFlowContext, type NodeActualFlow } from './NodeFlowContext';

/** Couleur d'arête par tier de convoyeur (Mk1..Mk6). */
const TIER_COLOR: Record<number, string> = {
  1: '#9ca3af',
  2: '#60a5fa',
  3: '#34d399',
  4: '#fbbf24',
  5: '#f472b6',
  6: '#fb923c',
};

function Flow() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const storeOnConnect = useGraphStore((s) => s.onConnect);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const dropBuildingNode = useGraphStore((s) => s.dropBuildingNode);
  const selectNode = useGraphStore((s) => s.selectNode);

  const generation = useGraphStore((s) => s.generation);
  const copySelection = useGraphStore((s) => s.copySelection);
  const paste = useGraphStore((s) => s.paste);
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodeTypes = useMemo<NodeTypes>(() => ({ machine: MachineNode }), []);
  const edgeTypes = useMemo(() => ({ belt: BeltEdge }), []);

  // Recentre le canvas après chaque auto-génération.
  useEffect(() => {
    if (generation > 0) window.requestAnimationFrame(() => fitView({ duration: 300 }));
  }, [generation, fitView]);

  // Copié-collé (Cmd/Ctrl + C / V / D).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.isContentEditable) return;
      const k = e.key.toLowerCase();
      if (k === 'c') copySelection();
      else if (k === 'v') paste();
      else if (k === 'd') {
        e.preventDefault();
        duplicateSelection();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [copySelection, paste, duplicateSelection]);

  // Connexion avec auto-détection de recette : si le target n'a pas de recette et qu'une seule
  // recette standard accepte l'item entrant dans ce bâtiment, on l'assigne automatiquement.
  const onConnect = useCallback((connection: Connection) => {
    storeOnConnect(connection);
    if (!gameData || !connection.target) return;
    const { nodes } = useGraphStore.getState();
    const target = nodes.find((n) => n.id === connection.target);
    if (!target || target.data.recipeId) return; // déjà configuré
    const source = nodes.find((n) => n.id === connection.source);
    if (!source) return;
    const srcInfo = computeNodeInfo(source.data, gameData);
    // L'item porté par ce handle (ex. "out-iron-ore" → "iron-ore"), sinon premier output.
    const itemId = connection.sourceHandle?.startsWith('out-')
      ? connection.sourceHandle.slice(4)
      : srcInfo.outputs[0]?.itemId;
    if (!itemId) return;
    const candidates = gameData.recipes.filter(
      (r) =>
        r.producedIn === target.data.buildingId &&
        !r.alternate &&
        r.ingredients.some((ing) => ing.item === itemId),
    );
    if (candidates.length === 1) updateNodeData(target.id, { recipeId: candidates[0].id });
  }, [storeOnConnect, updateNodeData, gameData]);

  // Calcule en un seul pass : styles d'arêtes + flux réels par node (pour les indicateurs dans MachineNode).
  const { styledEdges, nodeFlowMap } = useMemo(() => {
    const domAttributes = (id: string) =>
      ({ 'data-edge-id': id }) as unknown as React.SVGAttributes<SVGGElement>;

    if (!gameData) {
      return {
        styledEdges: edges.map((e) => ({ ...e, type: 'belt', domAttributes: domAttributes(e.id) })),
        nodeFlowMap: new Map<string, NodeActualFlow>(),
      };
    }

    const summary = computeFactory(nodes, edges, gameData);
    const plans = new Map(summary.edges.map((p) => [p.edgeId, p]));

    // Styles d'arêtes (logique existante).
    const styledEdges = edges.map((e) => {
      const plan = plans.get(e.id);
      if (!plan || plan.itemId == null) {
        return { ...e, type: 'belt', domAttributes: domAttributes(e.id) };
      }
      const overloaded = plan.belt.overloaded;
      const color = overloaded ? '#ef4444' : (TIER_COLOR[plan.belt.tier ?? 1] ?? '#9ca3af');
      const tierLabel = overloaded ? `${plan.belt.lines}×Mk${plan.belt.tier}` : `Mk${plan.belt.tier}`;
      return {
        ...e,
        type: 'belt',
        domAttributes: domAttributes(e.id),
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 10, height: 10 },
        style: { stroke: color, strokeWidth: 3 },
        data: { itemName: plan.itemName, rate: plan.ratePerMin, tierLabel, color, overloaded },
      };
    });

    // Flux réels par node : somme des débits arêtes entrantes/sortantes par item.
    const nodeFlowMap = new Map<string, NodeActualFlow>();
    const getFlow = (nodeId: string): NodeActualFlow => {
      if (!nodeFlowMap.has(nodeId))
        nodeFlowMap.set(nodeId, { inputs: new Map(), outputs: new Map() });
      return nodeFlowMap.get(nodeId)!;
    };
    for (const e of edges) {
      const plan = plans.get(e.id);
      if (!plan?.itemId) continue;
      const { itemId, ratePerMin } = plan;
      const tgt = getFlow(e.target);
      tgt.inputs.set(itemId, (tgt.inputs.get(itemId) ?? 0) + ratePerMin);
      const src = getFlow(e.source);
      src.outputs.set(itemId, (src.outputs.get(itemId) ?? 0) + ratePerMin);
    }

    return { styledEdges, nodeFlowMap };
  }, [nodes, edges, gameData]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(PALETTE_MIME);
      if (!raw) return;
      const { buildingId, category } = JSON.parse(raw) as { buildingId: string; category: string };
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      // Détection de l'arête sous le curseur au moment du drop
      const element = document.elementFromPoint(e.clientX, e.clientY);
      let edgeEl = element;
      while (edgeEl && !edgeEl.getAttribute('data-edge-id') && edgeEl !== document.body) {
        edgeEl = edgeEl.parentElement;
      }
      const droppedEdgeId = edgeEl ? edgeEl.getAttribute('data-edge-id') : null;

      dropBuildingNode(buildingId, position, category, droppedEdgeId);
    },
    [dropBuildingNode, screenToFlowPosition],
  );

  const onSelectionChange = useCallback(
    ({ nodes: sel }: OnSelectionChangeParams) => selectNode(sel[0]?.id ?? null),
    [selectNode],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      const state = useGraphStore.getState();
      return gameData ? isValidGraphConnection(c, state.edges, state.nodes, gameData) : true;
    },
    [gameData],
  );

  return (
    <NodeFlowContext.Provider value={nodeFlowMap}>
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onSelectionChange={onSelectionChange}
        isValidConnection={isValidConnection}
        connectionLineType={ConnectionLineType.SmoothStep}
        selectionOnDrag={true}
        panOnDrag={[1, 2]}
        snapToGrid={true}
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'belt',
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
          style: { strokeWidth: 3 },
        }}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor="#3f3f46"
          maskColor="rgba(9,9,11,0.7)"
          className="!bg-zinc-900"
        />
      </ReactFlow>
    </div>
    </NodeFlowContext.Provider>
  );
}

export function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <Flow />
    </ReactFlowProvider>
  );
}
