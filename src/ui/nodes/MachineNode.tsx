import { useContext } from 'react';
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import type { Building } from '@/data/types';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import type { MachineNode as MachineNodeType, MachineNodeData } from '@/store/useGraphStore';
import { computeNodeInfo } from '@/graph/nodeInfo';
import { ExtractionIcon, SmeltingIcon, ManufacturingIcon, LogisticsIcon } from '@/ui/icons';
import { NodeFlowContext } from '@/ui/NodeFlowContext';

const CATEGORY_ACCENT: Record<string, string> = {
  extraction: 'border-l-4 border-l-amber-500 border-zinc-800',
  smelting: 'border-l-4 border-l-orange-500 border-zinc-800',
  manufacturing: 'border-l-4 border-l-sky-500 border-zinc-800',
  logistics: 'border-l-4 border-l-zinc-500 border-zinc-800',
};

/** Couleur hex par catégorie — utilisée pour la barre de cycle et le point d'activité. */
const CATEGORY_COLOR: Record<string, string> = {
  extraction:    '#f59e0b', // amber-500
  smelting:      '#f97316', // orange-500
  manufacturing: '#38bdf8', // sky-400
  logistics:     '#71717a', // zinc-500
};

/** Barre fine animée montrant la progression du cycle de production. */
function CycleBar({ seconds, color }: { seconds: number; color: string }) {
  return (
    <div className="mt-2.5 relative h-[3px] w-full overflow-hidden rounded-full bg-zinc-800/70">
      <div
        className="absolute inset-0 w-full rounded-full"
        style={{
          background: `linear-gradient(to right, ${color}55, ${color})`,
          transformOrigin: 'left center',
          animation: `nf-cycle ${seconds}s linear infinite`,
        }}
      />
    </div>
  );
}

const CATEGORY_CHIP: Record<string, string> = {
  extraction: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  smelting: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  manufacturing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  logistics: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
};

const CATEGORY_ICON = {
  extraction: ExtractionIcon,
  smelting: SmeltingIcon,
  manufacturing: ManufacturingIcon,
  logistics: LogisticsIcon,
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

const HANDLE_IN = '!h-3 !w-3 !rounded-full !border-2 !border-zinc-950 !bg-orange-500 hover:bg-orange-400 transition-all cursor-crosshair';
const HANDLE_OUT = '!h-3 !w-3 !rounded-full !border-2 !border-zinc-950 !bg-emerald-500 hover:bg-emerald-400 transition-all cursor-crosshair';

/** Barre d'outils contextuelle (visible quand le node est sélectionné). */
function NodeActions({ id }: { id: string }) {
  const duplicate = useGraphStore((s) => s.duplicateSelection);
  const remove = useGraphStore((s) => s.deleteNode);
  return (
    <NodeToolbar position={Position.Top} className="flex gap-1.5 pb-1">
      <button
        type="button"
        onClick={() => duplicate()}
        className="rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-[10px] font-semibold text-zinc-200 hover:bg-zinc-700 transition-colors shadow-md"
      >
        Dupliquer
      </button>
      <button
        type="button"
        onClick={() => remove(id)}
        className="rounded bg-red-950/80 border border-red-800/50 px-2 py-1 text-[10px] font-semibold text-red-200 hover:bg-red-900 transition-colors shadow-md"
      >
        Supprimer
      </button>
    </NodeToolbar>
  );
}

/**
 * Node custom. Machines : carte avec handles PAR ITEM (`in-<item>`/`out-<item>`) dès que la
 * recette est configurée. Logistique (splitter/merger) : petit carré compact (1→3 / 3→1).
 * Handles toujours ronds style n8n. Barre d'outils (dupliquer/supprimer) à la sélection.
 */
export function MachineNode({ id, data, selected }: NodeProps<MachineNodeType>) {
  const gameData = useFactoryStore((s) => s.gameData);
  const flowMap = useContext(NodeFlowContext);
  if (!gameData) return null;

  const info = computeNodeInfo(data, gameData);
  const building = info.building;
  const accent = building
    ? CATEGORY_ACCENT[building.category] ?? 'border-l-4 border-l-zinc-500 border-zinc-800'
    : 'border-l-4 border-l-zinc-500 border-zinc-800';

  // Flux réellement mesuré sur les arêtes de ce node.
  const actualFlow = flowMap.get(id);

  // Efficacité = fraction d'input réellement reçu / capacité théorique (extraction = 1 toujours).
  const efficiency = (() => {
    if (!building || !info.configured) return 1;
    if (building.category === 'extraction') return 1;
    if (!actualFlow || info.inputs.length === 0) return 1;
    let minEff = 1;
    for (const inp of info.inputs) {
      if (inp.ratePerMin > 0) {
        const actual = actualFlow.inputs.get(inp.itemId) ?? 0;
        minEff = Math.min(minEff, actual / inp.ratePerMin);
      }
    }
    return Math.max(0, Math.min(1, minEff));
  })();

  // Durée d'un cycle de production :
  //  • extracteur → 60 / débit de sortie (1 item = 1 cycle)
  //  • machine à recette → recipe.time / efficiency (ralentit si alimentation insuffisante)
  const cycleTime = (() => {
    if (!info.configured || !building) return 0;
    if (building.category === 'extraction') {
      const rate = info.outputs[0]?.ratePerMin ?? 0;
      return rate > 0 ? 60 / rate : 0;
    }
    const base = info.recipe?.time ?? 0;
    return efficiency > 0.01 ? base / efficiency : 0;
  })();

  // Couleur du point d'activité selon l'efficacité (indépendant de la catégorie).
  const dotColor = efficiency >= 0.99
    ? '#10b981'   // emerald-500 : à pleine capacité
    : efficiency >= 0.5
      ? '#f59e0b' // amber-500 : sous-alimenté
      : '#ef4444'; // red-500 : sévèrement sous-alimenté

  const accentColor = building ? (CATEGORY_COLOR[building.category] ?? '#71717a') : '#71717a';

  // ── Splitter / Merger : carré compact (handles sur 3 faces) ───────────────
  if (building?.category === 'logistics') {
    const ins = genericPorts(building, data, 'inputs');
    const outs = genericPorts(building, data, 'outputs');
    const isSplit = building.name.toLowerCase().includes('split');
    const abbr = isSplit ? 'SPL' : 'MRG';
    const IconComponent = CATEGORY_ICON.logistics;
    return (
      <div
        title={building.name}
        className={[
          'relative flex h-14 w-14 items-center justify-center rounded-2xl border bg-zinc-900 shadow-lg transition-all',
          accent,
          selected ? 'ring-2 ring-orange-500/80 border-transparent' : '',
        ].join(' ')}
      >
        <NodeActions id={id} />
        {isSplit ? (
          <>
            <Handle key="in-0" id="in-0" type="target" position={Position.Left} style={{ top: '50%' }} className={HANDLE_IN} />
            {outs > 0 && <Handle key="out-0" id="out-0" type="source" position={Position.Right} style={{ top: '50%' }} className={HANDLE_OUT} />}
            {outs > 1 && <Handle key="out-1" id="out-1" type="source" position={Position.Top} style={{ left: '50%' }} className={HANDLE_OUT} />}
            {outs > 2 && <Handle key="out-2" id="out-2" type="source" position={Position.Bottom} style={{ left: '50%' }} className={HANDLE_OUT} />}
          </>
        ) : (
          <>
            <Handle key="out-0" id="out-0" type="source" position={Position.Right} style={{ top: '50%' }} className={HANDLE_OUT} />
            {ins > 0 && <Handle key="in-0" id="in-0" type="target" position={Position.Left} style={{ top: '50%' }} className={HANDLE_IN} />}
            {ins > 1 && <Handle key="in-1" id="in-1" type="target" position={Position.Top} style={{ left: '50%' }} className={HANDLE_IN} />}
            {ins > 2 && <Handle key="in-2" id="in-2" type="target" position={Position.Bottom} style={{ left: '50%' }} className={HANDLE_IN} />}
          </>
        )}
        <div className="flex flex-col items-center gap-0.5">
          <IconComponent className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-[9px] font-extrabold tracking-wider text-zinc-300">{abbr}</span>
        </div>
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

  const primaryOut = info.outputs[0];
  const IconComponent = building ? CATEGORY_ICON[building.category] : null;

  return (
    <div
      className={[
        'relative min-h-[72px] min-w-[200px] max-w-[240px] rounded-2xl border bg-zinc-900/95 p-3 text-xs shadow-xl backdrop-blur-sm transition-all',
        accent,
        selected ? 'ring-2 ring-orange-500/80 border-transparent' : '',
      ].join(' ')}
    >
      <NodeActions id={id} />

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

      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2 mb-2">
        <div className="flex items-center gap-2">
          {IconComponent && building && (
            <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${CATEGORY_CHIP[building.category]}`}>
              <IconComponent className="h-3.5 w-3.5" />
            </span>
          )}
          <span className="font-bold tracking-tight text-zinc-100">{building?.name ?? data.buildingId}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {info.configured && cycleTime > 0 && (
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{
                background: dotColor,
                animation: 'nf-activity-dot 1.5s ease-in-out infinite',
              }}
            />
          )}
          {info.powerMW > 0 && (
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-400">
              {info.powerMW} MW
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      {info.configured ? (
        <div className="flex flex-col gap-1">
          {primaryOut && (
            <div className="flex items-center gap-1 font-semibold text-emerald-400">
              <span className="text-[9px] text-emerald-500/80">→</span>
              <span>{primaryOut.itemName}</span>
              <span className="ml-auto text-[10px] text-emerald-500 font-mono">{primaryOut.ratePerMin}/m</span>
            </div>
          )}
          {info.inputs.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-1 border-t border-zinc-800/30 pt-1">
              {info.inputs.map((input, idx) => {
                const actualRate = actualFlow?.inputs.get(input.itemId);
                const connected = actualRate !== undefined;
                const starved = connected && actualRate < input.ratePerMin - 0.01;
                return (
                  <div key={idx} className="flex items-center gap-1 text-[10px] text-zinc-400">
                    <span className="text-[9px] text-orange-500/80">←</span>
                    <span className="truncate">{input.itemName}</span>
                    {starved ? (
                      <span className="ml-auto font-mono flex items-baseline gap-0.5">
                        <span className="text-[9px] font-bold text-amber-400">{Math.round(actualRate)}</span>
                        <span className="text-[8px] text-zinc-600">/{input.ratePerMin}/m</span>
                      </span>
                    ) : (
                      <span className="ml-auto text-[9px] text-orange-400/80 font-mono">{input.ratePerMin}/m</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {cycleTime > 0 && <CycleBar seconds={cycleTime} color={accentColor} />}
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-center py-1 text-center font-medium italic text-zinc-500 bg-zinc-950/20 rounded-lg">
          À configurer
        </div>
      )}

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
