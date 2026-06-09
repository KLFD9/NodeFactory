import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Building } from '@/data/types';
import { useFactoryStore } from '@/store/useFactoryStore';
import type { MachineNode as MachineNodeType, MachineNodeData } from '@/store/useGraphStore';
import { computeNodeInfo } from '@/graph/nodeInfo';

const CATEGORY_ACCENT: Record<string, string> = {
  extraction: 'border-amber-500/70',
  smelting: 'border-orange-500/70',
  manufacturing: 'border-sky-500/70',
  logistics: 'border-zinc-500/70',
};

interface PortDef {
  id: string;
  title?: string;
}

/** Nombre de ports génériques (machine non configurée / logistique). */
function genericPorts(building: Building, data: MachineNodeData, side: 'inputs' | 'outputs'): number {
  if (side === 'inputs') {
    return data.portsIn ?? building.inputs ?? (building.category === 'extraction' ? 0 : 1);
  }
  return data.portsOut ?? building.outputs ?? 1;
}

/** Répartit n handles régulièrement sur la hauteur du node (en %). */
function handleTop(i: number, n: number): string {
  return `${((i + 1) / (n + 1)) * 100}%`;
}

const HANDLE_IN = '!h-2.5 !w-2.5 !rounded-none !border-2 !border-zinc-900 !bg-orange-500';
const HANDLE_OUT = '!h-2.5 !w-2.5 !rounded-none !border-2 !border-zinc-900 !bg-emerald-500';

/**
 * Node custom. Machines : carte avec handles PAR ITEM (`in-<item>`/`out-<item>`) dès que la
 * recette est configurée. Logistique (splitter/merger) : petit carré compact, entrées à gauche,
 * sorties à droite. Handles toujours carrés.
 */
export function MachineNode({ data, selected }: NodeProps<MachineNodeType>) {
  const gameData = useFactoryStore((s) => s.gameData);
  if (!gameData) return null;

  const info = computeNodeInfo(data, gameData);
  const building = info.building;
  const accent = building
    ? CATEGORY_ACCENT[building.category] ?? 'border-zinc-600'
    : 'border-zinc-600';

  // ── Splitter / Merger : carré compact ────────────────────────────────────
  if (building?.category === 'logistics') {
    const ins = genericPorts(building, data, 'inputs');
    const outs = genericPorts(building, data, 'outputs');
    const isSplit = building.name.toLowerCase().includes('split');
    const abbr = isSplit ? 'SPL' : 'MRG';
    return (
      <div
        title={building.name}
        className={[
          'relative flex h-14 w-14 items-center justify-center rounded-md border bg-zinc-800 shadow-md',
          accent,
          selected ? 'ring-2 ring-orange-500' : '',
        ].join(' ')}
      >
        {isSplit ? (
          <>
            {/* Splitter handles */}
            <Handle
              key="in-0"
              id="in-0"
              type="target"
              position={Position.Left}
              style={{ top: '50%' }}
              className={HANDLE_IN}
            />
            {outs > 0 && (
              <Handle
                key="out-0"
                id="out-0"
                type="source"
                position={Position.Right}
                style={{ top: '50%' }}
                className={HANDLE_OUT}
              />
            )}
            {outs > 1 && (
              <Handle
                key="out-1"
                id="out-1"
                type="source"
                position={Position.Top}
                style={{ left: '50%' }}
                className={HANDLE_OUT}
              />
            )}
            {outs > 2 && (
              <Handle
                key="out-2"
                id="out-2"
                type="source"
                position={Position.Bottom}
                style={{ left: '50%' }}
                className={HANDLE_OUT}
              />
            )}
          </>
        ) : (
          <>
            {/* Merger handles */}
            <Handle
              key="out-0"
              id="out-0"
              type="source"
              position={Position.Right}
              style={{ top: '50%' }}
              className={HANDLE_OUT}
            />
            {ins > 0 && (
              <Handle
                key="in-0"
                id="in-0"
                type="target"
                position={Position.Left}
                style={{ top: '50%' }}
                className={HANDLE_IN}
              />
            )}
            {ins > 1 && (
              <Handle
                key="in-1"
                id="in-1"
                type="target"
                position={Position.Top}
                style={{ left: '50%' }}
                className={HANDLE_IN}
              />
            )}
            {ins > 2 && (
              <Handle
                key="in-2"
                id="in-2"
                type="target"
                position={Position.Bottom}
                style={{ left: '50%' }}
                className={HANDLE_IN}
              />
            )}
          </>
        )}
        <span className="text-[10px] font-bold tracking-wide text-zinc-300">{abbr}</span>
      </div>
    );
  }

  // ── Machine / extracteur : carte ──────────────────────────────────────────
  const perItem = !!building && info.configured;

  const inPorts: PortDef[] = perItem
    ? info.inputs.map((p) => ({ id: `in-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
    : Array.from({ length: building ? genericPorts(building, data, 'inputs') : 1 }, (_, i) => ({
        id: `in-${i}`,
      }));

  const outPorts: PortDef[] = perItem
    ? info.outputs.map((p) => ({ id: `out-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
    : Array.from({ length: building ? genericPorts(building, data, 'outputs') : 1 }, (_, i) => ({
        id: `out-${i}`,
      }));

  return (
    <div
      className={[
        'relative min-h-16 min-w-44 rounded-md border bg-zinc-900 px-3 py-2 text-xs shadow-md',
        accent,
        selected ? 'ring-2 ring-orange-500' : '',
      ].join(' ')}
    >
      {inPorts.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="target"
          position={Position.Left}
          style={{ top: handleTop(i, inPorts.length) }}
          title={p.title}
          className={HANDLE_IN}
        />
      ))}

      <div className="font-semibold text-zinc-100">{building?.name ?? data.buildingId}</div>
      <div className={info.configured ? 'text-zinc-300' : 'italic text-zinc-500'}>{info.summary}</div>
      {info.powerMW > 0 && <div className="mt-1 text-[10px] text-zinc-500">{info.powerMW} MW</div>}

      {outPorts.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          style={{ top: handleTop(i, outPorts.length) }}
          title={p.title}
          className={HANDLE_OUT}
        />
      ))}
    </div>
  );
}
