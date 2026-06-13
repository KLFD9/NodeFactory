import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import { useGraphStore } from '@/store/useGraphStore';

/** Données décoratives portées par une arête (calculées dans GraphCanvas). */
export interface BeltEdgeData extends Record<string, unknown> {
  itemId?: string;
  itemName?: string;
  rate?: number;
  tierLabel?: string;
  color?: string;
  overloaded?: boolean;
}

/** Durée d'animation en secondes proportionnelle au débit (2.5s @ 60/min → 0.35s @ 1200/min). */
function beltFlowDuration(rate: number): number {
  const speed = Math.max(rate, 1) / 60;
  return Math.max(0.35, Math.min(3.0, 2.5 / speed));
}

/** Rendu graphique unique pour chaque minerai et lingot. */
function renderItemGraphic(itemId: string) {
  switch (itemId) {
    case 'iron-ingot':
      return (
        <g>
          {/* Top face */}
          <polygon points="-5,-2.5 0,-5 5,-2.5 0,0" fill="#e4e4e7" stroke="#a1a1aa" strokeWidth="0.5" />
          {/* Left face */}
          <polygon points="-5,-2.5 0,0 0,5 -5,2.5" fill="#a1a1aa" stroke="#71717a" strokeWidth="0.5" />
          {/* Right face */}
          <polygon points="0,0 5,-2.5 5,2.5 0,5" fill="#71717a" stroke="#52525b" strokeWidth="0.5" />
        </g>
      );
    case 'copper-ingot':
      return (
        <g>
          {/* Top face */}
          <polygon points="-5,-2.5 0,-5 5,-2.5 0,0" fill="#fdba74" stroke="#f97316" strokeWidth="0.5" />
          {/* Left face */}
          <polygon points="-5,-2.5 0,0 0,5 -5,2.5" fill="#ea580c" stroke="#c2410c" strokeWidth="0.5" />
          {/* Right face */}
          <polygon points="0,0 5,-2.5 5,2.5 0,5" fill="#c2410c" stroke="#9a3412" strokeWidth="0.5" />
        </g>
      );
    case 'steel':
      return (
        <g>
          {/* Top face */}
          <polygon points="-5,-2.5 0,-5 5,-2.5 0,0" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.5" />
          {/* Left face */}
          <polygon points="-5,-2.5 0,0 0,5 -5,2.5" fill="#64748b" stroke="#475569" strokeWidth="0.5" />
          {/* Right face */}
          <polygon points="0,0 5,-2.5 5,2.5 0,5" fill="#475569" stroke="#334155" strokeWidth="0.5" />
        </g>
      );
    case 'iron-ore':
      return (
        <g>
          <ellipse cx="0" cy="2" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.5)" />
          <polygon points="-3.5,-1.5 0,-4.5 3.5,-2.5 4.5,1.5 1,3.5 -2.5,2.5" fill="#3f3f46" />
          <polygon points="-3.5,-1.5 0,-4.5 1,1 -2.5,2.5" fill="#52525b" />
          <polygon points="0,-4.5 3.5,-2.5 2.5,0 1,1" fill="#78350f" />
          <polygon points="1,1 2.5,0 4.5,1.5 1,3.5" fill="#9a3412" />
        </g>
      );
    case 'copper-ore':
      return (
        <g>
          <ellipse cx="0" cy="2" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.5)" />
          <polygon points="-3.5,-2.5 -1,-4.5 2.5,-3.5 4.5,1 2,3.5 -2,2.5" fill="#047857" />
          <polygon points="-3.5,-2.5 -1,-4.5 0,1 -2,2.5" fill="#065f46" />
          <polygon points="-1,-4.5 2.5,-3.5 1.5,0 0,1" fill="#ea580c" />
          <polygon points="0,1 1.5,0 4.5,1 2,3.5" fill="#fb923c" />
        </g>
      );
    case 'limestone':
      return (
        <g>
          <ellipse cx="0" cy="2" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.5)" />
          <polygon points="-3.5,-1.5 0,-4.5 3.5,-2.5 4.5,1 1.8,3.5 -1.8,2.5" fill="#e4e4e7" />
          <polygon points="-3.5,-1.5 0,-4.5 1,1 -1.8,2.5" fill="#d4d4d8" />
          <polygon points="0,-4.5 3.5,-2.5 2.5,0 1,1" fill="#fafafa" />
          <polygon points="1,1 2.5,0 4.5,1 1.8,3.5" fill="#a1a1aa" />
        </g>
      );
    case 'coal':
      return (
        <g>
          <ellipse cx="0" cy="2" rx="4.5" ry="1.8" fill="rgba(0,0,0,0.5)" />
          <polygon points="-3.5,-2.5 -1,-4.5 2.5,-3.5 4.5,1 2,3.5 -2,2.5" fill="#18181b" />
          <polygon points="-3.5,-2.5 -1,-4.5 0,1 -2,2.5" fill="#09090b" />
          <polygon points="-1,-4.5 2.5,-3.5 1.5,0 0,1" fill="#27272a" />
          <polygon points="0,1 1.5,0 4.5,1 2,3.5" fill="#52525b" />
        </g>
      );
    default:
      // Crate
      return (
        <g>
          {/* Top face */}
          <polygon points="-4.5,-2.2 0,-4.5 4.5,-2.2 0,0" fill="#d97706" stroke="#92400e" strokeWidth="0.5" />
          {/* Left face */}
          <polygon points="-4.5,-2.2 0,0 0,4.5 -4.5,2.2" fill="#b45309" stroke="#78350f" strokeWidth="0.5" />
          {/* Right face */}
          <polygon points="0,0 4.5,-2.2 4.5,2.2 0,4.5" fill="#78350f" stroke="#451a03" strokeWidth="0.5" />
          {/* Straps */}
          <line x1="0" y1="-4.5" x2="0" y2="4.5" stroke="#18181b" strokeWidth="0.5" opacity="0.6" />
          <line x1="-4.5" y1="0" x2="4.5" y2="0" stroke="#18181b" strokeWidth="0.5" opacity="0.6" />
        </g>
      );
  }
}

/**
 * Arête « convoyeur » : trace le path, affiche le label (item · débit · tier), et expose
 * au survol un bouton **+** qui ouvre une mini context-box pour insérer directement un
 * Splitter ou un Merger sur la ligne.
 */
export function BeltEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, markerEnd, style } =
    props;
  const data = props.data as BeltEdgeData | undefined;
  const [open, setOpen] = useState(false);
  const dropBuildingNode = useGraphStore((s) => s.dropBuildingNode);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  });

  const insert = (buildingId: 'splitter' | 'merger') => {
    dropBuildingNode(buildingId, { x: labelX - 28, y: labelY - 28 }, 'logistics', id);
    setOpen(false);
  };

  const hasFlow = (data?.rate ?? 0) > 0;
  const flowColor = data?.color ?? '#9ca3af';
  const flowDuration = hasFlow ? beltFlowDuration(data!.rate!) : 0;
  const baseStyle = hasFlow ? { ...style, opacity: 0.15 } : style;

  // Création d'un flux continu de ressources
  const numItems = 6;
  const items = [];
  if (hasFlow && data?.itemId) {
    for (let i = 0; i < numItems; i++) {
      const beginOffset = -((i / numItems) * flowDuration);
      items.push(
        <g key={i} style={{ pointerEvents: 'none' }}>
          {renderItemGraphic(data.itemId)}
          <animateMotion
            dur={`${flowDuration}s`}
            repeatCount="indefinite"
            path={edgePath}
            rotate="auto"
            begin={`${beginOffset}s`}
          />
        </g>
      );
    }
  }

  return (
    <>
      {/* 1. Structure métallique porteuse large */}
      <path
        d={edgePath}
        fill="none"
        stroke="#1e222b"
        strokeWidth={15}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      {/* 2. Rails de guidage latéraux sombres */}
      <path
        d={edgePath}
        fill="none"
        stroke="#0d0f12"
        strokeWidth={13}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      {/* 3. Bande LED lumineuse de couleur du flux (tier) */}
      <path
        d={edgePath}
        fill="none"
        stroke={flowColor}
        strokeWidth={11.5}
        strokeLinecap="round"
        opacity={data?.overloaded ? 1.0 : 0.8}
        style={{
          pointerEvents: 'none',
          filter: data?.overloaded ? 'drop-shadow(0 0 2px #ef4444)' : 'none',
        }}
      />
      {/* 4. Bande centrale en caoutchouc noir */}
      <path
        d={edgePath}
        fill="none"
        stroke="#0f1115"
        strokeWidth={9.5}
        strokeLinecap="round"
        style={{ pointerEvents: 'none' }}
      />
      {/* 5. Texture « rouleaux/stries » animée */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={9.5}
        strokeLinecap="butt"
        strokeDasharray="1 8"
        style={{
          animation: hasFlow ? `belt-ridge-flow ${flowDuration}s linear infinite` : undefined,
          pointerEvents: 'none',
        }}
      />
      {/* 6. Ligne centrale de liaison de base (React Flow) */}
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={baseStyle} />

      {/* 7. Ressources physiques animées en mouvement */}
      {items}

      <EdgeLabelRenderer>
        <div
          className="nodrag nopan group absolute flex flex-col items-center"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <div className="flex items-center gap-1.5">
            {data?.itemName && (
              <span className="whitespace-nowrap rounded-full bg-zinc-950/95 px-2 py-0.5 text-[10px] font-medium text-zinc-300 ring-1 ring-zinc-800/80 group-hover:ring-zinc-700 transition-all shadow-md flex items-center">
                <span className="font-mono font-bold group-hover:hidden">
                  {data.rate}/m
                </span>
                <span className="hidden group-hover:inline-flex items-center gap-1.5 animate-fadeIn">
                  <span className="font-bold text-zinc-200">{data.itemName}</span>
                  <span className="text-zinc-600">•</span>
                  <span className="font-mono text-emerald-400 font-bold">{data.rate}/min</span>
                  <span className="text-zinc-600">•</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[9px] text-zinc-400 font-semibold">{data.tierLabel}</span>
                </span>
              </span>
            )}
            <button
              type="button"
              title="Insérer un Splitter / Merger"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => !o);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 hover:bg-orange-600 text-zinc-300 hover:text-white text-xs font-bold leading-none opacity-0 shadow-lg transition-all group-hover:opacity-100 data-[open=true]:opacity-100 data-[open=true]:bg-orange-650"
              data-open={open}
            >
              +
            </button>
          </div>

          {open && (
            <div className="mt-1 flex flex-col gap-0.5 rounded-md border border-zinc-700 bg-zinc-900 p-1 text-xs shadow-lg">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  insert('splitter');
                }}
                className="rounded px-2 py-1 text-left text-zinc-200 hover:bg-zinc-700"
              >
                Insérer un Splitter
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  insert('merger');
                }}
                className="rounded px-2 py-1 text-left text-zinc-200 hover:bg-zinc-700"
              >
                Insérer un Merger
              </button>
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

