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

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan group absolute flex flex-col items-center"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: 'all',
          }}
        >
          <div className="flex items-center gap-1">
            {data?.itemName && (
              <span className="whitespace-nowrap rounded bg-zinc-950/90 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-100 ring-1 ring-zinc-700">
                {data.itemName} · {data.rate}/min · {data.tierLabel}
              </span>
            )}
            <button
              type="button"
              title="Insérer un Splitter / Merger"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((o) => !o);
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-600 text-sm font-bold leading-none text-white opacity-0 shadow transition-opacity group-hover:opacity-100 data-[open=true]:opacity-100"
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
