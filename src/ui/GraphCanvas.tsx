import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ControlButton,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  ViewportPortal,
  useReactFlow,
  useViewport,
  ConnectionLineType,
  type Connection,
  type NodeTypes,
  type OnSelectionChangeParams,
  type XYPosition,
} from '@xyflow/react';
import type { IsValidConnection, OnConnectEnd } from '@xyflow/react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore, type MachineNode as MachineNodeType } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { useWorldStore } from '@/store/useWorldStore';
import { contractProgress } from '@/game/contracts';
import { BiomeLayer } from './world/BiomeLayer';
import { ResourceLayer } from './world/ResourceLayer';
import { MiniMapDeposits } from './world/MiniMapDeposits';
import { computeFactory } from '@/graph/computeFactory';
import { computeNodeInfo } from '@/graph/nodeInfo';
import { isValidGraphConnection } from '@/graph/connection';
import { computePowerNetworks, isPowerSourceHandle, isPowerTargetHandle } from '@/graph/power';
import { SafeMachineNode } from './nodes/SafeMachineNode';
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
import { ProgressionStatus } from './App';

/** Couleur d'arête par tier de convoyeur (Mk1..Mk6). */
const TIER_COLOR: Record<number, string> = {
  1: '#9ca3af',
  2: '#60a5fa',
  3: '#34d399',
  4: '#fbbf24',
  5: '#f472b6',
  6: '#fb923c',
};



function ResetIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      {...props}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}

function Flow() {
  const { zoom } = useViewport();
  const zoomPct = Math.round(zoom * 100);
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
  const createPoleFromHandle = useGraphStore((s) => s.createPoleFromHandle);
  const splitPowerEdgeWithPole = useGraphStore((s) => s.splitPowerEdgeWithPole);
  const deposits = useWorldStore((s) => s.deposits);
  const regenerate = useWorldStore((s) => s.regenerate);

  const generation = useGraphStore((s) => s.generation);
  const copySelection = useGraphStore((s) => s.copySelection);
  const paste = useGraphStore((s) => s.paste);
  const duplicateSelection = useGraphStore((s) => s.duplicateSelection);
  const { screenToFlowPosition, fitView, setCenter } = useReactFlow();
  const nodeTypes = useMemo<NodeTypes>(() => ({ machine: SafeMachineNode }), []);
  const edgeTypes = useMemo(() => ({ belt: BeltEdge, power: PowerEdge }), []);

  // Recentre le canvas après chaque auto-génération.
  useEffect(() => {
    if (generation > 0) window.requestAnimationFrame(() => fitView({ duration: 300 }));
  }, [generation, fitView]);

  // Cadrage initial : sur un canvas vierge, le viewport (0,0) ne montre AUCUN gisement
  // (ils sont générés dans ±2600 px flow) — le nouveau joueur ne verrait qu'une grille
  // vide. On centre une seule fois sur le gisement de CHARBON le plus proche de
  // l'origine : c'est la cible de la première étape du tutoriel (« clique un pin Coal »,
  // l'électricité se construit avant la chaîne de fer).
  const initialCenterDone = useRef(false);
  useEffect(() => {
    if (initialCenterDone.current || deposits.length === 0) return;
    initialCenterDone.current = true;
    if (useGraphStore.getState().nodes.length > 0) return; // usine existante : fitView gère.
    const candidates = deposits.filter((d) => d.resourceId === 'coal');
    const pool = candidates.length > 0 ? candidates : deposits;
    const target = pool.reduce((a, b) => (Math.hypot(a.x, a.y) <= Math.hypot(b.x, b.y) ? a : b));
    void setCenter(target.x, target.y, { zoom: 0.6 });
  }, [deposits, setCenter]);

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

  // Drag-to-pole : lâcher un câble énergie dans le vide pose un poteau électrique connecté
  // au handle d'origine (coût Bolts via createPoleFromHandle).
  const onConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (connectionState.toHandle || connectionState.toNode) return;
      const handle = connectionState.fromHandle;
      if (!handle?.nodeId) return;
      const isPower = isPowerSourceHandle(handle.id) || isPowerTargetHandle(handle.id);
      if (!isPower) return;
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const position = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      createPoleFromHandle(handle.nodeId, handle.id ?? '', handle.type, position);
    },
    [screenToFlowPosition, createPoleFromHandle],
  );

  // Split de câble : clic-glisser depuis un câble énergie existant insère un poteau au
  // point cliqué et câble une nouvelle sortie vers la cible du drag (handle power-in ou,
  // dans le vide, un second poteau).
  const [cableDrag, setCableDrag] = useState<{
    edgeId: string;
    startScreen: XYPosition;
    current: XYPosition;
  } | null>(null);

  const startCableDrag = useCallback((e: React.MouseEvent, edgeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = { x: e.clientX, y: e.clientY };
    setCableDrag({ edgeId, startScreen: pos, current: pos });
  }, []);

  useEffect(() => {
    if (!cableDrag) return;

    const onMove = (e: MouseEvent) => {
      setCableDrag((d) => (d ? { ...d, current: { x: e.clientX, y: e.clientY } } : d));
    };

    const onUp = (e: MouseEvent) => {
      const current = { x: e.clientX, y: e.clientY };
      const el = document.elementFromPoint(current.x, current.y);
      let handleEl = el as HTMLElement | null;
      while (handleEl && !handleEl.dataset?.handleid && handleEl !== document.body) {
        handleEl = handleEl.parentElement;
      }
      const ds = handleEl?.dataset;
      const clickFlowPos = screenToFlowPosition(cableDrag.startScreen);

      let drop: Parameters<typeof splitPowerEdgeWithPole>[2] = null;
      if (ds?.handleid === 'power-in' && ds.nodeid) {
        drop = { kind: 'handle', nodeId: ds.nodeid, handleId: 'power-in' };
      } else if (el?.closest('.react-flow__pane')) {
        drop = { kind: 'canvas', position: screenToFlowPosition(current) };
      }
      splitPowerEdgeWithPole(cableDrag.edgeId, clickFlowPos, drop);
      setCableDrag(null);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [cableDrag, screenToFlowPosition, splitPowerEdgeWithPole]);

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
        const onCableMouseDown = (ev: React.MouseEvent) => startCableDrag(ev, e.id);
        return { ...e, type: 'power', domAttributes: domAttributes(e.id), data: { powered, onCableMouseDown } };
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
        data: { itemId: plan.itemId, itemName: plan.itemName, rate: plan.ratePerMin, tierLabel, color, overloaded },
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
  }, [nodes, edges, gameData, startCableDrag]);

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
    ({ nodes: sel }: OnSelectionChangeParams) => {
      if (sel.length > 1) {
        useGraphStore.setState({ selectedNodeId: sel[sel.length - 1]?.id ?? null });
      } else {
        selectNode(sel[0]?.id ?? null);
      }
    },
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

      const cx = node.position.x + 220;
      const cy = node.position.y + 90;
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

  const onNewGame = useCallback(() => {
    if (
      window.confirm(
        "Commencer une nouvelle partie ? Votre usine sera entièrement détruite et votre progression (Points de Recherche, Bolts, jalons débloqués) sera réinitialisée."
      )
    ) {
      useProgressionStore.getState().reset();
      useGraphStore.getState().setGraph([], []);
      regenerate(rawItemIds);
    }
  }, [regenerate, rawItemIds]);



  return (
    <NodeFlowContext.Provider value={nodeFlowMap}>
    <PowerContext.Provider value={poweredByNode}>
    <PowerConnectionsContext.Provider value={powerConnections}>
    <PowerNetworkContext.Provider value={powerNetworkByNode}>
    <div className="h-full w-full" onDragOver={onDragOver} onDrop={onDrop}>
      {cableDrag && (
        <svg className="fixed inset-0 z-50 pointer-events-none" width="100%" height="100%">
          <line
            x1={cableDrag.startScreen.x}
            y1={cableDrag.startScreen.y}
            x2={cableDrag.current.x}
            y2={cableDrag.current.y}
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
        </svg>
      )}
      <ReactFlow
        nodes={nodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        isValidConnection={isValidConnection}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionLineType={ConnectionLineType.SmoothStep}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        panOnDrag={[2]}
        snapToGrid={true}
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'belt',
          markerEnd: { type: MarkerType.ArrowClosed, width: 10, height: 10 },
          style: { strokeWidth: 3 },
        }}
        fitView
        // 0.2 ≈ la carte (biomes + gisements, ±BOUNDS dans biomeMap.ts) remplit l'écran au
        // dézoom max — au-delà, on ne verrait qu'un vide hors de la zone explorée.
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <ViewportPortal>
          <BiomeLayer />
          <ResourceLayer />
        </ViewportPortal>
        <Panel position="top-right">
          <ProgressionStatus />
        </Panel>
        <Panel position="top-left">
          <ContractHUDPanel />
        </Panel>
        <Panel position="bottom-left" className="!ml-14 !mb-4 flex flex-col gap-2 pointer-events-none">
          <div className="bg-zinc-950/80 border border-zinc-800/80 rounded px-2.5 py-1 shadow-lg text-[9px] font-mono text-zinc-400 select-none backdrop-blur-sm flex items-center gap-1.5 pointer-events-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>VPT_SCALE //</span>
            <span className="text-amber-400 font-extrabold">{zoomPct}%</span>
          </div>
        </Panel>
        <Background />
        <Controls>
          <ControlButton
            onClick={onNewGame}
            title="Commencer une nouvelle partie (réinitialise tout)"
          >
            <ResetIcon className="w-4.5 h-4.5" />
          </ControlButton>
        </Controls>
        <MiniMap
          pannable
          zoomable
          nodeColor={getMiniMapNodeColor}
          maskColor="rgba(249, 115, 22, 0.08)"
          className="react-flow__minimap"
        />
        <MiniMapDeposits />
      </ReactFlow>
    </div>
    </PowerNetworkContext.Provider>
    </PowerConnectionsContext.Provider>
    </PowerContext.Provider>
    </NodeFlowContext.Provider>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function ContractHUDPanel() {
  const activeContract = useProgressionStore((s) => s.activeContract);
  const gameMinutesElapsed = useProgressionStore((s) => s.gameMinutesElapsed);

  if (!activeContract) {
    return (
      <div className="rounded-lg border border-amber-500/35 bg-zinc-950/80 p-3 shadow-lg select-none backdrop-blur-md max-w-xs pointer-events-auto">
        {/* HUD Corners */}
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />

        <div className="flex items-center gap-2 mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
          <h3 className="text-[10px] font-mono font-bold tracking-widest text-amber-400 uppercase">// ALERTE_CONTRAT</h3>
        </div>
        <p className="text-[11px] text-zinc-300 font-medium">Aucun contrat actif en cours.</p>
        <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
          Ouvre le menu <span className="text-orange-400 font-bold uppercase">Objectifs (OBJ)</span> à droite pour accepter un contrat client et commencer à gagner des Bolts.
        </p>
      </div>
    );
  }

  const delivered = contractProgress(activeContract);
  const pct = Math.min(1, delivered / activeContract.offer.quantity);
  const percent = Math.round(pct * 100);

  const remainingSeconds = activeContract.deadlineGameMin === Infinity 
    ? Infinity 
    : Math.max(0, (activeContract.deadlineGameMin - gameMinutesElapsed) * 60);

  return (
    <div className="rounded-lg border border-zinc-800/60 bg-zinc-950/90 p-3.5 shadow-lg select-none backdrop-blur-md w-[280px] pointer-events-auto">
      {/* HUD Corners */}
      <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />

      <div className="flex items-center gap-2 mb-2 border-b border-zinc-900 pb-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <h3 className="text-[10px] font-mono font-bold tracking-widest text-zinc-400 uppercase">// DIRECTIVE_CLIENT</h3>
        <span className="ml-auto text-[8px] font-mono text-zinc-500 uppercase truncate max-w-[90px]">{activeContract.offer.clientName}</span>
      </div>

      <div className="flex justify-between items-baseline mb-2">
        <span className="text-[12px] font-bold text-zinc-100 uppercase tracking-tight truncate max-w-[170px]">{activeContract.offer.itemName}</span>
        <span className="text-[14px] font-mono font-black text-amber-450 drop-shadow-[0_0_4px_rgba(245,158,11,0.25)]">{percent}%</span>
      </div>

      {/* Progress bar */}
      <div className="h-2.5 w-full overflow-hidden rounded bg-zinc-950 border border-zinc-900 flex items-center px-[1px] mb-3.5">
        <div
          className="h-[6px] rounded bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)] transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Target quantities and countdown timer side by side */}
      <div className="flex items-center justify-between border-t border-zinc-900/60 pt-2.5">
        <div className="flex flex-col">
          <span className="text-[8.5px] font-mono font-bold tracking-wider text-zinc-500 uppercase leading-none">Livraison</span>
          <span className="text-[12.5px] font-mono font-bold text-zinc-200 tabular-nums mt-1 leading-none">
            {Math.floor(delivered)} <span className="text-zinc-500 font-medium">/ {activeContract.offer.quantity}</span>
          </span>
        </div>

        {remainingSeconds !== Infinity && (
          <div className="flex flex-col items-end">
            <span className="text-[8.5px] font-mono font-bold tracking-wider text-zinc-500 uppercase leading-none">Temps Restant</span>
            <span 
              className={`font-mono font-black text-[13px] tabular-nums mt-1 leading-none px-2 py-0.5 rounded ${
                remainingSeconds < 60 
                  ? 'text-red-400 animate-pulse bg-red-950/50 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.2)]' 
                  : 'text-amber-400 bg-amber-500/5 border border-amber-500/10'
              }`}
            >
              {formatTime(remainingSeconds)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function GraphCanvas() {
  return <Flow />;
}
