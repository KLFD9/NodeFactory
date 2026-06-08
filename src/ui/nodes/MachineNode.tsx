import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { Building } from '@/data/types';
import { useFactoryStore } from '@/store/useFactoryStore';
import type { MachineNode as MachineNodeType } from '@/store/useGraphStore';
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
function genericPorts(building: Building, side: 'inputs' | 'outputs'): number {
  if (side === 'inputs') return building.inputs ?? (building.category === 'extraction' ? 0 : 1);
  return building.outputs ?? 1;
}

/** Répartit n handles régulièrement sur la hauteur du node (en %). */
function handleTop(i: number, n: number): string {
  return `${((i + 1) / (n + 1)) * 100}%`;
}

/**
 * Node custom. Handles fidèles aux ports réels : un handle PAR ITEM (`in-<item>`/`out-<item>`)
 * dès que la recette est configurée — ce qui permet de router le bon produit sur la bonne
 * arête. Sinon (machine vierge ou logistique pass-through), handles génériques numérotés.
 */
export function MachineNode({ data, selected }: NodeProps<MachineNodeType>) {
  const gameData = useFactoryStore((s) => s.gameData);
  if (!gameData) return null;

  const info = computeNodeInfo(data, gameData);
  const building = info.building;
  const accent = building
    ? CATEGORY_ACCENT[building.category] ?? 'border-zinc-600'
    : 'border-zinc-600';
  const count = Math.max(1, data.count ?? 1);
  const isLogistics = building?.category === 'logistics';
  const perItem = !!building && !isLogistics && info.configured;

  const inPorts: PortDef[] =
    perItem
      ? info.inputs.map((p) => ({
          id: `in-${p.itemId}`,
          title: `${p.itemName} · ${p.ratePerMin * count}/min`,
        }))
      : Array.from(
          { length: data.portsIn ?? (building ? genericPorts(building, 'inputs') : 1) },
          (_, i) => ({ id: `in-${i}` }),
        );

  const outPorts: PortDef[] =
    perItem
      ? info.outputs.map((p) => ({
          id: `out-${p.itemId}`,
          title: `${p.itemName} · ${p.ratePerMin * count}/min`,
        }))
      : Array.from(
          { length: data.portsOut ?? (building ? genericPorts(building, 'outputs') : 1) },
          (_, i) => ({ id: `out-${i}` }),
        );

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
          className="!h-2.5 !w-2.5 !rounded-sm !border-2 !border-zinc-900 !bg-zinc-400"
        />
      ))}

      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-zinc-100">{building?.name ?? data.buildingId}</span>
        {count > 1 && (
          <span className="rounded bg-orange-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
            ×{count}
          </span>
        )}
      </div>
      <div className={info.configured ? 'text-zinc-300' : 'italic text-zinc-500'}>{info.summary}</div>
      {info.powerMW > 0 && (
        <div className="mt-1 text-[10px] text-zinc-500">{info.powerMW * count} MW</div>
      )}

      {outPorts.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={Position.Right}
          style={{ top: handleTop(i, outPorts.length) }}
          title={p.title}
          className="!h-2.5 !w-2.5 !rounded-sm !border-2 !border-zinc-900 !bg-emerald-400"
        />
      ))}
    </div>
  );
}
