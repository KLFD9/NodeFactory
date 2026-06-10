import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ViewportPortal,
  useReactFlow,
  ConnectionLineType,
  type Connection,
  type NodeTypes,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import type { IsValidConnection } from '@xyflow/react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore, type MachineNode as MachineNodeType } from '@/store/useGraphStore';
import { useWorldStore } from '@/store/useWorldStore';
import { ResourceLayer } from './world/ResourceLayer';
import { computeFactory } from '@/graph/computeFactory';
import { computeNodeInfo } from '@/graph/nodeInfo';
import { isValidGraphConnection } from '@/graph/connection';
import { computePowerNetworks, isPowerSourceHandle, isPowerTargetHandle } from '@/graph/power';
import { MachineNode } from './nodes/MachineNode';
import { BeltEdge } from './edges/BeltEdge';
import { PowerEdge } from './edges/PowerEdge';
import { PALETTE_MIME } from './Palette';
import {
  NodeFlowContext,
  PowerContext,
  PowerConnectionsContext,
  PowerNetworkContext,
  type NodeActualFlow,
  type PowerNetworkInfo,
} from './NodeFlowContext';

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
  const snapMinerToPin = useGraphStore((s) => s.snapMinerToPin);
  const unbindMiner = useGraphStore((s) => s.unbindMiner);
  const deposits = useWorldStore((s) => s.deposits);
  const regenerate = useWorldStore((s) => s.regenerate);

  const generation = useGraphStore((s) => s.generation);
  const copySelection = useGraphStore((s) => s.copySelection);
  const paste = useGraphStore((s) => s.paste);
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const nodeTypes = useMemo<NodeTypes>(() => ({ machine: MachineNode }), []);
  const edgeTypes = useMemo(() => ({ belt: BeltEdge, power: PowerEdge }), []);

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
    if (candidates.length === 1) updateNodeData(target.id, { recipeId: candidates[0].id }, gameData);
  }, [storeOnConnect, updateNodeData, gameData]);

  // Calcule en un seul pass : styles d'arêtes + flux réels par node (pour les indicateurs dans MachineNode).
  const { styledEdges, nodeFlowMap, poweredByNode, powerConnections, powerNetworkByNode } = useMemo(() => {
    const domAttributes = (id: string) =>
      ({ 'data-edge-id': id }) as unknown as React.SVGAttributes<SVGGElement>;

    if (!gameData) {
      return {
        styledEdges: edges.map((e) => ({ ...e, type: 'belt', domAttributes: domAttributes(e.id) })),
        nodeFlowMap: new Map<string, NodeActualFlow>(),
        poweredByNode: new Map<string, boolean>(),
        powerConnections: new Map<string, number>(),
        powerNetworkByNode: new Map<string, PowerNetworkInfo>(),
      };
    }

    const summary = computeFactory(nodes, edges, gameData);
    const plans = new Map(summary.edges.map((p) => [p.edgeId, p]));
    const { poweredByNode, networks } = computePowerNetworks(nodes, edges, gameData);

    // Totaux du réseau (gen/demande) par node — pour la carte générateur.
    const powerNetworkByNode = new Map<string, PowerNetworkInfo>();
    for (const net of networks) {
      for (const id of net.nodeIds) {
        powerNetworkByNode.set(id, { totalGenMW: net.totalGenMW, totalDemandMW: net.totalDemandMW });
      }
    }

    // Nombre de câbles énergie connectés par node (badge "x/4" du poteau électrique).
    const powerConnections = new Map<string, number>();
    for (const e of edges) {
      if (!isPowerSourceHandle(e.sourceHandle) || !isPowerTargetHandle(e.targetHandle)) continue;
      powerConnections.set(e.source, (powerConnections.get(e.source) ?? 0) + 1);
      powerConnections.set(e.target, (powerConnections.get(e.target) ?? 0) + 1);
    }

    // Styles d'arêtes (logique existante).
    const styledEdges = edges.map((e) => {
      // Câble énergie : type d'arête dédié, coloré selon l'état du réseau (déficitaire = rouge).
      if (isPowerSourceHandle(e.sourceHandle) && isPowerTargetHandle(e.targetHandle)) {
        const powered = poweredByNode.get(e.source) ?? poweredByNode.get(e.target) ?? true;
        return { ...e, type: 'power', domAttributes: domAttributes(e.id), data: { powered } };
      }
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

    return { styledEdges, nodeFlowMap, poweredByNode, powerConnections, powerNetworkByNode };
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

  // Drag-snap : à la fin d'un déplacement d'extracteur, on l'aimante au pin LIBRE le plus proche
  // (ou on le détache s'il a quitté son pin). Le centre estimé du node (position + demi-taille)
  // est comparé aux pins en coordonnées flow.
  const SNAP_RADIUS = 130;
  const onNodeDragStop = useCallback(
    (_e: MouseEvent | TouchEvent, node: MachineNodeType) => {
      if (!gameData) return;
      const data = node.data;
      const building = gameData.buildings.find((b) => b.id === data.buildingId);
      if (!building || building.category !== 'extraction') return;

      const cx = node.position.x + 110;
      const cy = node.position.y + 40;
      const all = useGraphStore.getState().nodes;
      const isFree = (depId: string, pinIdx: number) =>
        !all.some((n) => n.id !== node.id && n.data.depositId === depId && n.data.pinIndex === pinIdx);

      let best: { depId: string; pinIdx: number; x: number; y: number; dist: number } | null = null;
      for (const dep of deposits) {
        for (let i = 0; i < dep.pins.length; i++) {
          if (!isFree(dep.id, i)) continue;
          const pin = dep.pins[i];
          const dist = Math.hypot(pin.x - cx, pin.y - cy);
          if (dist <= SNAP_RADIUS && (!best || dist < best.dist)) {
            best = { depId: dep.id, pinIdx: i, x: pin.x, y: pin.y, dist };
          }
        }
      }

      if (best) {
        const dep = deposits.find((d) => d.id === best!.depId)!;
        snapMinerToPin(node.id, {
          depositId: best.depId,
          pinIndex: best.pinIdx,
          resourceId: dep.resourceId,
          purity: dep.purity,
          x: best.x,
          y: best.y,
        });
      } else if (data.depositId != null) {
        unbindMiner(node.id);
      }
    },
    [gameData, deposits, snapMinerToPin, unbindMiner],
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => {
      const state = useGraphStore.getState();
      return gameData ? isValidGraphConnection(c, state.edges, state.nodes, gameData) : true;
    },
    [gameData],
  );

  const rawItemIds = useMemo(
    () => (gameData ? gameData.items.filter((i) => i.raw).map((i) => i.id) : []),
    [gameData],
  );
  const getMiniMapNodeColor = useCallback((node: MachineNodeType) => {
    const category = node.data?.category;
    if (category === 'extraction') return '#f59e0b';
    if (category === 'smelting') return '#f97316';
    if (category === 'manufacturing') return '#38bdf8';
    if (category === 'logistics') return '#71717a';
    if (category === 'power') return '#10b981';
    return '#3f3f46';
  }, []);

  const onRegenerate = useCallback(() => {
    if (window.confirm('Régénérer la carte ? Les mineurs posés seront détachés de leur gisement.')) {
      regenerate(rawItemIds);
    }
  }, [regenerate, rawItemIds]);

  return (
    <NodeFlowContext.Provider value={nodeFlowMap}>
    <PowerContext.Provider value={poweredByNode}>
    <PowerConnectionsContext.Provider value={powerConnections}>
    <PowerNetworkContext.Provider value={powerNetworkByNode}>
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
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
        <ViewportPortal>
          <ResourceLayer />
        </ViewportPortal>
        <Panel position="top-right">
          <button
            type="button"
            onClick={onRegenerate}
            title="Génère une nouvelle disposition de gisements (détache les mineurs)"
            className="rounded-md border border-zinc-700 bg-zinc-900/90 px-2.5 py-1.5 text-xs font-medium text-zinc-200 shadow-md hover:border-amber-500 hover:text-amber-300 transition-colors"
          >
            🗺 Nouvelle carte
          </button>
        </Panel>
        <Background />
        <Controls />
        <MiniMap
          pannable
          zoomable
          nodeColor={getMiniMapNodeColor}
          maskColor="transparent"
          className="react-flow__minimap"
        />
      </ReactFlow>
    </div>
    </PowerNetworkContext.Provider>
    </PowerConnectionsContext.Provider>
    </PowerContext.Provider>
    </NodeFlowContext.Provider>
  );
}

export function GraphCanvas() {
  return <Flow />;
}
