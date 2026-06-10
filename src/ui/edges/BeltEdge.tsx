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

/**
 * Arête « convoyeur » : trace le path, affiche le label (item · débit · tier), et expose
 * au survol un bouton **+** qui ouvre une mini context-box pour insérer directement un
 * Splitter ou un Merger sur la ligne (coupe l'arête et intercale le hub).
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
    // Place le hub au milieu de l'arête (coords du graphe = celles du label).
    dropBuildingNode(buildingId, { x: labelX - 28, y: labelY - 28 }, 'logistics', id);
    setOpen(false);
  };

  const hasFlow = (data?.rate ?? 0) > 0;
  const flowColor = data?.color ?? '#9ca3af';
  const flowDuration = hasFlow ? beltFlowDuration(data!.rate!) : 0;
  // Légère atténuation de la piste de base quand les items circulent dessus.
  const baseStyle = hasFlow ? { ...style, opacity: 0.45 } : style;

  return (
    <>
      {/* Corps du convoyeur : bande large sous la ligne de flux, donne l'épaisseur physique. */}
      <path
        d={edgePath}
        fill="none"
        stroke="#1c2127"
        strokeWidth={9}
        strokeLinecap="round"
        opacity={0.85}
        style={{ pointerEvents: 'none' }}
      />
      {/* Teinte par item : léger lavis de la couleur du flux sur le corps du convoyeur. */}
      {hasFlow && (
        <path
          d={edgePath}
          fill="none"
          stroke={flowColor}
          strokeWidth={9}
          strokeLinecap="round"
          opacity={0.12}
          style={{ pointerEvents: 'none' }}
        />
      )}
      {/* Texture « rouleaux » : segments clairs qui défilent le long du corps du convoyeur. */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={9}
        strokeLinecap="butt"
        strokeDasharray="1 7"
        style={{
          animation: hasFlow ? `belt-ridge-flow ${flowDuration}s linear infinite` : undefined,
          pointerEvents: 'none',
        }}
      />
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={baseStyle} />
      {hasFlow && (
        <path
          className="nf-belt-flow"
          d={edgePath}
          fill="none"
          stroke={flowColor}
          strokeWidth={3}
          strokeDasharray="3 12"
          strokeLinecap="round"
          style={{
            strokeDashoffset: 0,
            animation: `belt-flow ${flowDuration}s linear infinite`,
            filter: data?.overloaded
              ? 'brightness(1.2) drop-shadow(0 0 3px #ef4444)'
              : 'brightness(1.35)',
            opacity: 0.9,
            pointerEvents: 'none',
          }}
        />
      )}
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
                {/* Default minimal view */}
                <span className="font-mono font-bold group-hover:hidden">
                  {data.rate}/m
                </span>
                {/* Expanded hover view */}
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
