import { useContext } from 'react';
import { Handle, NodeToolbar, Position, useViewport, type NodeProps } from '@xyflow/react';
import type { Building } from '@/data/types';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import type { MachineNode as MachineNodeType, MachineNodeData } from '@/store/useGraphStore';
import { computeNodeInfo } from '@/graph/nodeInfo';
import { computeMachineStatus, type MachineState } from '@/graph/machineStatus';
import { ExtractionIcon, SmeltingIcon, ManufacturingIcon, LogisticsIcon, PowerIcon } from '@/ui/icons';
import { ItemIcon } from '@/ui/assets';
import { NodeFlowContext, PowerContext, PowerConnectionsContext, PowerNetworkContext } from '@/ui/NodeFlowContext';

/**
 * Silhouettes personnalisées :
 * - extraction : coins asymétriques lourds, bordure orange/ambre latérale
 * - smelting : toit en dôme (haut biseauté) pour canaliser le flux de chaleur
 * - manufacturing : biseauté cyber-punk
 * - power : monolithe élancé et angulaire
 * - logistics : losange parfait en rotation interne
 */
const CATEGORY_SILHOUETTE: Record<string, string> = {
  extraction: 'rounded-tr-[2rem] rounded-bl-[2rem] rounded-tl-lg rounded-br-lg border-l-4 border-l-amber-500 border-zinc-800/80',
  smelting: 'rounded-t-[2.2rem] rounded-b-lg border-t-4 border-t-orange-500 border-zinc-800/80',
  manufacturing: 'rounded-tl-[2rem] rounded-br-[2rem] rounded-tr-lg rounded-bl-lg border-l-4 border-l-sky-500 border-zinc-800/80',
  power: 'rounded-xl border-t-4 border-t-emerald-500 border-zinc-800/80',
};

/** Couleur hex par catégorie. */
const CATEGORY_COLOR: Record<string, string> = {
  extraction:    '#f59e0b', // amber-500
  smelting:      '#f97316', // orange-500
  manufacturing: '#38bdf8', // sky-400
  logistics:     '#71717a', // zinc-500
  power:         '#10b981', // emerald-500
};

/** Couleurs de glow par catégorie. */
const CATEGORY_GLOW: Record<string, string> = {
  extraction:    'rgba(245, 158, 11, 0.25)',
  smelting:      'rgba(249, 115, 22, 0.25)',
  manufacturing: 'rgba(56, 189, 248, 0.25)',
  logistics:     'rgba(113, 113, 122, 0.25)',
  power:         'rgba(16, 185, 129, 0.25)',
};

const CATEGORY_GLOW_SOFT: Record<string, string> = {
  extraction:    'rgba(245, 158, 11, 0.08)',
  smelting:      'rgba(249, 117, 22, 0.08)',
  manufacturing: 'rgba(56, 189, 248, 0.08)',
  logistics:     'rgba(113, 113, 122, 0.08)',
  power:         'rgba(16, 185, 129, 0.08)',
};

/** Styles du badge d'état. */
const STATE_STYLE: Record<MachineState, { color: string; label: string }> = {
  nominal: { color: '#10b981', label: 'Nominal' },
  starved: { color: '#f59e0b', label: 'Sous-alim.' },
  blocked: { color: '#ef4444', label: 'En attente' },
  unpowered: { color: '#ef4444', label: 'Non alimenté' },
};

/** Pins « énergie » : ambre, distincts des handles convoyeur (orange/vert). */
const HANDLE_POWER_IN = 'nf-handle-style !bg-zinc-900 !border-amber-500';
const HANDLE_POWER_OUT = 'nf-handle-style !bg-amber-500 !border-zinc-950';

/** Positions cardinales pour la rotation horaire. */
const POSITIONS = [Position.Top, Position.Right, Position.Bottom, Position.Left];

/** Calcule la position cardinale après rotation horaire. */
function getRotatedPosition(basePosition: Position, rotation: number): Position {
  const k = Math.round((rotation % 360) / 90);
  if (k === 0) return basePosition;
  const baseIndex = POSITIONS.indexOf(basePosition);
  if (baseIndex === -1) return basePosition;
  return POSITIONS[(baseIndex + k) % 4];
}

/** Calcule le style css de centrage et de glow pour un handle rotatif simple. */
function getHandleStyle(pos: Position, colorGlow: string, percent?: string): React.CSSProperties {
  const style: React.CSSProperties = {
    '--handle-color-glow': colorGlow,
  } as React.CSSProperties;
  if (pos === Position.Left || pos === Position.Right) {
    style.top = percent ?? '50%';
    style.left = undefined;
  } else {
    style.left = percent ?? '50%';
    style.top = undefined;
  }
  return style;
}

/** Répartit n handles sur la largeur ou la hauteur selon le bord. */
function handleTop(i: number, n: number): string {
  return `${((i + 1) / (n + 1)) * 100}%`;
}

/** Calcule le style pour plusieurs handles répartis (inputs/outputs de machine). */
function getMultiHandleStyle(pos: Position, i: number, n: number, colorGlow: string): React.CSSProperties {
  const percent = handleTop(i, n);
  return getHandleStyle(pos, colorGlow, percent);
}

/** Composant de ciblage style HUD (Targeting Brackets) */
function HudBrackets({ color, isDiamond = false }: { color: string; isDiamond?: boolean }) {
  const offset = isDiamond ? '-inset-[7px]' : '-inset-[5px]';
  const rotation = isDiamond ? 'rotate-45' : '';
  return (
    <div 
      className={`absolute ${offset} ${rotation} pointer-events-none nf-hud-bracket z-20`}
      style={{ '--category-color': color } as React.CSSProperties}
    >
      <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2" style={{ borderColor: color }} />
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2" style={{ borderColor: color }} />
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2" style={{ borderColor: color }} />
    </div>
  );
}

/** Barre fine animée de progression de cycle. */
function CycleBar({ seconds, color }: { seconds: number; color: string }) {
  return (
    <div className="mt-3 relative h-[4px] w-full overflow-hidden rounded-full bg-zinc-950/80 border border-zinc-800/30">
      <div
        className="absolute inset-y-0 left-0 w-full rounded-full nf-cycle-bar-glow"
        style={{
          '--bar-color': color,
          '--bar-color-glow': `${color}66`,
          transformOrigin: 'left center',
          animation: `nf-cycle ${seconds}s linear infinite`,
        } as React.CSSProperties}
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
  power: PowerIcon,
};

interface PortDef {
  id: string;
  title?: string;
}

/** Nombre de ports génériques. */
function genericPorts(building: Building, data: MachineNodeData, side: 'inputs' | 'outputs'): number {
  if (side === 'inputs') {
    return data.portsIn ?? building.inputs ?? (building.category === 'extraction' ? 0 : 1);
  }
  return data.portsOut ?? building.outputs ?? 1;
}

const HANDLE_IN = 'nf-handle-style !bg-orange-500 !border-zinc-950';
const HANDLE_OUT = 'nf-handle-style !bg-emerald-500 !border-zinc-950';

/** Barre d'outils contextuelle unifiée sous forme de capsule HUD vitrée. */
function NodeActions({ id, data }: { id: string; data: MachineNodeData }) {
  const duplicate = useGraphStore((s) => s.duplicateSelection);
  const remove = useGraphStore((s) => s.deleteNode);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const gameData = useFactoryStore((s) => s.gameData);

  const onRotate = () => {
    const nextRot = ((data.rotation ?? 0) + 90) % 360;
    updateNodeData(id, { rotation: nextRot }, gameData || undefined);
  };

  return (
    <NodeToolbar position={Position.Top} className="pb-2">
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-950/90 border border-zinc-800/80 shadow-[0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-sm">
        {/* Bouton de rotation (Glow ambre) */}
        <button
          type="button"
          onClick={onRotate}
          title="Pivoter de 90° (sens horaire)"
          className="rounded-lg p-1.5 text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
        >
          <svg 
            className="w-3.5 h-3.5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2.5} 
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
        </button>

        {/* Bouton de duplication (Glow bleu céleste) */}
        <button
          type="button"
          onClick={() => duplicate()}
          title="Dupliquer le bâtiment"
          className="rounded-lg p-1.5 text-zinc-400 hover:text-sky-400 hover:bg-sky-500/10 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
        >
          <svg 
            className="w-3.5 h-3.5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
          </svg>
        </button>

        {/* Séparateur discret */}
        <div className="w-px h-3.5 bg-zinc-800" />

        {/* Bouton de suppression (Glow rouge) */}
        <button
          type="button"
          onClick={() => remove(id)}
          title="Supprimer le bâtiment"
          className="rounded-lg p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/15 active:scale-90 transition-all cursor-pointer flex items-center justify-center"
        >
          <svg 
            className="w-3.5 h-3.5" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor" 
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </NodeToolbar>
  );
}

/**
 * Node custom modernisé avec rotation.
 */
export function MachineNode({ id, data, selected }: NodeProps<MachineNodeType>) {
  const gameData = useFactoryStore((s) => s.gameData);
  const flowMap = useContext(NodeFlowContext);
  const poweredMap = useContext(PowerContext);
  const powerConnections = useContext(PowerConnectionsContext);
  const powerNetworkMap = useContext(PowerNetworkContext);
  const { zoom } = useViewport();
  if (!gameData) return null;

  const info = computeNodeInfo(data, gameData);
  const building = info.building;
  const silhouette = building ? CATEGORY_SILHOUETTE[building.category] ?? 'rounded-xl border border-zinc-800/80' : 'rounded-xl border border-zinc-800/80';

  // Récupération de l'orientation du node (0, 90, 180, 270)
  const rotation = data.rotation ?? 0;

  // Flux mesuré.
  const actualFlow = flowMap.get(id);

  // Réseau électrique.
  const powered = poweredMap.get(id) ?? true;

  // État opérationnel.
  const status = computeMachineStatus(data, actualFlow, gameData, powered);
  const efficiency = status.efficiency;

  // Durée cycle.
  const cycleTime = (() => {
    if (!info.configured || !building) return 0;
    if (building.category === 'extraction') {
      const rate = info.outputs[0]?.ratePerMin ?? 0;
      return rate > 0 ? 60 / rate : 0;
    }
    const base = info.recipe?.time ?? 0;
    return efficiency > 0.01 ? base / efficiency : 0;
  })();

  const machineState = status.state;
  const accentColor = building ? (CATEGORY_COLOR[building.category] ?? '#71717a') : '#71717a';
  const isGenerator = building?.category === 'power' && building.id !== 'power-pole';

  // ── Poteau électrique : noyau d'énergie sphérique gyroscopique rotatif ──
  if (building?.id === 'power-pole') {
    const connections = powerConnections.get(id) ?? 0;
    const showLabel = zoom > 0.7;
    return (
      <div
        title="Poteau électrique — 1 entrée + 3 sorties de dispatch"
        className={[
          'relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950/90 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all duration-300',
          selected ? 'border-amber-400 ring-2 ring-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : '',
        ].join(' ')}
      >
        {selected && <HudBrackets color="#f59e0b" />}

        {/* Gyroscope */}
        <div className="absolute inset-0.5 rounded-full border border-dashed border-amber-500/35 nf-energy-ring-rotate" />
        <div className="absolute inset-2 rounded-full border border-dashed border-amber-500/20 nf-energy-ring-reverse" />
        <div className="absolute inset-2 rounded-full bg-amber-500/5 animate-pulse" />

        <NodeActions id={id} data={data} />
        
        {/* Handles rotatifs */}
        <Handle
          key="power-in"
          id="power-in"
          type="target"
          position={getRotatedPosition(Position.Left, rotation)}
          title="Entrée"
          style={getHandleStyle(getRotatedPosition(Position.Left, rotation), 'rgba(245, 158, 11, 0.6)')}
          className={HANDLE_POWER_IN}
        />
        <Handle
          key="power-out-0"
          id="power-out-0"
          type="source"
          position={getRotatedPosition(Position.Right, rotation)}
          title="Sortie de dispatch"
          style={getHandleStyle(getRotatedPosition(Position.Right, rotation), 'rgba(245, 158, 11, 0.6)')}
          className={HANDLE_POWER_OUT}
        />
        <Handle
          key="power-out-1"
          id="power-out-1"
          type="source"
          position={getRotatedPosition(Position.Top, rotation)}
          title="Sortie de dispatch"
          style={getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(245, 158, 11, 0.6)')}
          className={HANDLE_POWER_OUT}
        />
        <Handle
          key="power-out-2"
          id="power-out-2"
          type="source"
          position={getRotatedPosition(Position.Bottom, rotation)}
          title="Sortie de dispatch"
          style={getHandleStyle(getRotatedPosition(Position.Bottom, rotation), 'rgba(245, 158, 11, 0.6)')}
          className={HANDLE_POWER_OUT}
        />

        <div className="relative z-10 flex flex-col items-center">
          <PowerIcon className="h-5 w-5 text-amber-400 drop-shadow-[0_0_4px_rgba(245,158,11,0.6)] animate-pulse" />
        </div>
        {showLabel && (
          <span className="absolute -bottom-5.5 bg-zinc-950/90 px-2 py-0.5 rounded-full border border-amber-500/30 text-[9px] font-mono font-extrabold tracking-wide text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
            {connections}/4
          </span>
        )}
      </div>
    );
  }

  // ── Splitter / Merger : Dispatcher Logistique en losange pivoté ──
  if (building?.category === 'logistics') {
    const ins = genericPorts(building, data, 'inputs');
    const outs = genericPorts(building, data, 'outputs');
    const isSplit = building.name.toLowerCase().includes('split');
    const abbr = isSplit ? 'SPL' : 'MRG';
    const color = isSplit ? '#f97316' : '#10b981';
    const IconComponent = CATEGORY_ICON.logistics;
    return (
      <div
        title={building.name}
        className="relative h-14 w-14 flex items-center justify-center"
      >
        {selected && <HudBrackets color={color} isDiamond={true} />}
        
        {/* Conteneur rotatif interne */}
        <div 
          className={[
            'absolute inset-0.5 bg-zinc-950 border border-zinc-800/80 shadow-xl transition-all duration-300 rotate-45',
            selected ? 'border-zinc-500 shadow-[0_0_15px_rgba(113,113,122,0.3)]' : '',
            isSplit ? 'border-l-orange-500 border-b-orange-500' : 'border-r-emerald-500 border-t-emerald-500'
          ].join(' ')} 
          style={{ borderRadius: '10px' }} 
        />

        {/* Grille fine décorative dans le diamant */}
        <div className="absolute inset-2 rotate-45 opacity-20 pointer-events-none" 
             style={{ backgroundImage: 'radial-gradient(circle, #71717a 1px, transparent 1px)', backgroundSize: '4px 4px' }} />

        <NodeActions id={id} data={data} />
        
        {/* Handles rotatifs sur les bords cardinaux */}
        {isSplit ? (
          <>
            <Handle key="in-0" id="in-0" type="target" position={getRotatedPosition(Position.Left, rotation)} style={getHandleStyle(getRotatedPosition(Position.Left, rotation), 'rgba(249, 115, 22, 0.6)')} className={HANDLE_IN} />
            {outs > 0 && <Handle key="out-0" id="out-0" type="source" position={getRotatedPosition(Position.Right, rotation)} style={getHandleStyle(getRotatedPosition(Position.Right, rotation), 'rgba(16, 185, 129, 0.6)')} className={HANDLE_OUT} />}
            {outs > 1 && <Handle key="out-1" id="out-1" type="source" position={getRotatedPosition(Position.Top, rotation)} style={getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(16, 185, 129, 0.6)')} className={HANDLE_OUT} />}
            {outs > 2 && <Handle key="out-2" id="out-2" type="source" position={getRotatedPosition(Position.Bottom, rotation)} style={getHandleStyle(getRotatedPosition(Position.Bottom, rotation), 'rgba(16, 185, 129, 0.6)')} className={HANDLE_OUT} />}
          </>
        ) : (
          <>
            <Handle key="out-0" id="out-0" type="source" position={getRotatedPosition(Position.Right, rotation)} style={getHandleStyle(getRotatedPosition(Position.Right, rotation), 'rgba(16, 185, 129, 0.6)')} className={HANDLE_OUT} />
            {ins > 0 && <Handle key="in-0" id="in-0" type="target" position={getRotatedPosition(Position.Left, rotation)} style={getHandleStyle(getRotatedPosition(Position.Left, rotation), 'rgba(249, 115, 22, 0.6)')} className={HANDLE_IN} />}
            {ins > 1 && <Handle key="in-1" id="in-1" type="target" position={getRotatedPosition(Position.Top, rotation)} style={getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(249, 115, 22, 0.6)')} className={HANDLE_IN} />}
            {ins > 2 && <Handle key="in-2" id="in-2" type="target" position={getRotatedPosition(Position.Bottom, rotation)} style={getHandleStyle(getRotatedPosition(Position.Bottom, rotation), 'rgba(249, 115, 22, 0.6)')} className={HANDLE_IN} />}
          </>
        )}
        
        {/* Contenu contre-pivoté de base + icône pivotée selon l'orientation */}
        <div className="flex flex-col items-center justify-center -rotate-45 relative z-10">
          <IconComponent 
            className="h-4.5 w-4.5 text-zinc-400 animate-pulse transition-transform duration-300" 
            style={{ transform: `rotate(${rotation}deg)` }}
          />
          <span className="text-[7.5px] font-extrabold tracking-wider text-zinc-300 bg-zinc-900/80 px-1 py-0.2 rounded border border-zinc-800/80 shadow mt-0.5">{abbr}</span>
        </div>
      </div>
    );
  }

  // ── Machine / extracteur : silhouettes game design typées ──
  const perItem = !!building && info.configured;
  const isNominal = machineState === 'nominal';
  const isEnergyItem = (id: string) => gameData.items.find((i) => i.id === id)?.category === 'energy';

  // On calcule les ports d'entrée/sortie cardinalement rotatifs
  const inPorts: PortDef[] = perItem
    ? info.inputs
        .filter((p) => !isEnergyItem(p.itemId))
        .map((p) => ({ id: `in-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
    : Array.from({ length: building ? genericPorts(building, data, 'inputs') : 1 }, (_, i) => ({
        id: `in-${i}`,
      }));

  const outPorts: PortDef[] = perItem
    ? info.outputs
        .filter((p) => !isEnergyItem(p.itemId))
        .map((p) => ({ id: `out-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
    : Array.from({ length: building ? genericPorts(building, data, 'outputs') : 1 }, (_, i) => ({
        id: `out-${i}`,
      }));

  const IconComponent = building ? CATEGORY_ICON[building.category] : null;
  const round = (n: number) => Math.round(n * 100) / 100;

  const styleVariables = {
    '--category-color': accentColor,
    '--category-glow': CATEGORY_GLOW[building?.category ?? ''] ?? 'rgba(113, 113, 122, 0.25)',
    '--category-glow-soft': CATEGORY_GLOW_SOFT[building?.category ?? ''] ?? 'rgba(113, 113, 122, 0.08)',
  } as React.CSSProperties;

  return (
    <div
      style={styleVariables}
      className={[
        'relative min-h-[76px] min-w-[220px] max-w-[260px] p-4.5 text-xs shadow-xl transition-all duration-300 nf-node-glass overflow-hidden',
        silhouette,
        selected ? 'nf-node-selected-glow scale-[1.01]' : '',
      ].join(' ')}
    >
      {selected && <HudBrackets color={accentColor} />}
      <NodeActions id={id} data={data} />

      {/* Grille de braises pour les fonderies */}
      {building?.category === 'smelting' && (
        <div className="absolute inset-0 rounded-t-[2.2rem] rounded-b-lg pointer-events-none nf-furnace-grid opacity-30 z-0" />
      )}

      {/* Lueur de cœur thermique pour les fonderies */}
      {building?.category === 'smelting' && isNominal && (
        <div className="absolute inset-0 rounded-t-[2.2rem] rounded-b-lg pointer-events-none nf-thermal-pulse z-0" />
      )}

      {/* Balayage laser pour le manufacturing */}
      {building?.category === 'manufacturing' && isNominal && (
        <div className="absolute inset-0 rounded-tl-[2rem] rounded-br-[2rem] rounded-tr-lg rounded-bl-lg overflow-hidden pointer-events-none z-0">
          <div className="absolute inset-x-0 nf-laser-scanner" />
        </div>
      )}

      {/* Raccordements électriques rotatifs */}
      {building?.category === 'power' ? (
        <Handle
          key="power-out"
          id="power-out"
          type="source"
          position={getRotatedPosition(Position.Bottom, rotation)}
          title="Sortie d'énergie"
          style={getHandleStyle(getRotatedPosition(Position.Bottom, rotation), 'rgba(245, 158, 11, 0.6)')}
          className={HANDLE_POWER_OUT}
        />
      ) : (
        <Handle
          key="power-in"
          id="power-in"
          type="target"
          position={getRotatedPosition(Position.Top, rotation)}
          title="Entrée d'énergie"
          style={getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(245, 158, 11, 0.6)')}
          className={HANDLE_POWER_IN}
        />
      )}

      {/* Raccordements convoyeurs rotatifs multiples (Inputs) */}
      {inPorts.map((p, i) => {
        const rotPos = getRotatedPosition(Position.Left, rotation);
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={rotPos}
            style={getMultiHandleStyle(rotPos, i, inPorts.length, 'rgba(249, 115, 22, 0.6)')}
            title={p.title}
            className={HANDLE_IN}
          />
        );
      })}

      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 -mx-4.5 px-4.5 rounded-t-2xl nf-node-header-glow relative z-10">
        <div className="flex items-center gap-2.5 min-w-0">
          {IconComponent && building && (
            <span className={`flex h-6.5 w-6.5 items-center justify-center rounded-lg ${CATEGORY_CHIP[building.category]} shrink-0`}>
              <IconComponent className={[
                'h-4 w-4',
                isNominal && building.category === 'extraction' ? 'nf-vibe-active' : '',
                isNominal && building.category === 'manufacturing' ? 'nf-spin-active' : '',
              ].join(' ')} />
            </span>
          )}
          <span className="font-extrabold tracking-tight text-zinc-100 text-[13px] truncate max-w-[100px]">{building?.name ?? data.buildingId}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* Compass direction badge showing facing angle */}
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-extrabold text-zinc-400 border border-zinc-700/30 flex items-center gap-0.5 font-mono uppercase whitespace-nowrap">
            <span>🧭</span>
            <span className="text-emerald-450 drop-shadow-[0_0_2px_rgba(16,185,129,0.5)]">
              {rotation === 0 && '▶'}
              {rotation === 90 && '▼'}
              {rotation === 180 && '◀'}
              {rotation === 270 && '▲'}
            </span>
          </span>

          {machineState && (
            <span
              title={`${STATE_STYLE[machineState].label} · ${Math.round(efficiency * 100)} %`}
              className="flex items-center gap-1.5 rounded-full px-2 py-0.5 relative"
              style={{
                background:
                  machineState === 'nominal' ? 'transparent' : `${STATE_STYLE[machineState].color}1a`,
              }}
            >
              {machineState !== 'nominal' && (
                <span
                  className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full nf-activity-ring"
                  style={{ background: STATE_STYLE[machineState].color }}
                />
              )}
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full relative z-10 nf-diode-glow"
                style={{
                  '--state-color': STATE_STYLE[machineState].color,
                  background: STATE_STYLE[machineState].color,
                  animation:
                    machineState === 'nominal' ? undefined : 'nf-activity-dot 1s ease-in-out infinite',
                } as React.CSSProperties}
              />
              {machineState !== 'nominal' && (
                <span
                  className="text-[8px] font-black uppercase tracking-wider relative z-10"
                  style={{ color: STATE_STYLE[machineState].color }}
                >
                  {STATE_STYLE[machineState].label}
                </span>
              )}
            </span>
          )}
          {info.powerMW > 0 && !isGenerator && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-400 border border-amber-500/20 flex items-center gap-0.5 shrink-0 whitespace-nowrap">
              <span>⚡</span>
              <span>{info.powerMW} MW</span>
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      {info.configured ? (
        <div className="flex flex-col gap-1.5 relative z-10">
          {isGenerator && (() => {
            const net = powerNetworkMap.get(id);
            const demand = net?.totalDemandMW ?? 0;
            const capacity = net?.totalGenMW ?? info.powerMW;
            return (
              <div className="flex flex-col gap-1.5 bg-zinc-950/40 p-2 rounded-xl border border-zinc-800/30">
                <div className="flex items-center gap-1.5 font-bold text-emerald-450">
                  <span className="text-[10px]">⚡</span>
                  <span className="text-[11px]">Capacité</span>
                  <span className="ml-auto text-[11px] font-mono font-extrabold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{info.powerMW} MW max</span>
                </div>
                <div
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: powered ? '#a1a1aa' : '#ef4444' }}
                >
                  <span className="text-[10px] text-zinc-500">⚙</span>
                  <span>Charge réseau</span>
                  <span className="ml-auto font-mono font-extrabold text-zinc-300">
                    {round(demand)}/{round(capacity)} MW
                  </span>
                </div>
              </div>
            );
          })()}
          {!isGenerator && info.outputs.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {info.outputs.map((output, idx) => {
                const actualRate = actualFlow?.outputs.get(output.itemId);
                const produced = output.ratePerMin;
                const connected = actualRate !== undefined;
                const backedUp = connected && actualRate < produced - 0.01;
                return (
                  <div key={idx} className="flex items-center gap-2 font-semibold text-emerald-400 bg-zinc-950/50 p-2 rounded-xl border border-zinc-850 hover:border-emerald-500/30 transition-all duration-200 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_4px_rgba(16,185,129,0.8)]" />
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                      <ItemIcon itemId={output.itemId} size={18} />
                    </div>
                    <span className="truncate text-zinc-100 text-[11.5px] font-semibold">{output.itemName}</span>
                    {backedUp ? (
                      <span className="ml-auto font-mono flex items-baseline gap-0.5 bg-amber-500/10 px-2 py-0.5 rounded-lg border border-amber-500/25">
                        <span className="text-[10.5px] font-extrabold text-amber-400">{round(actualRate)}</span>
                        <span className="text-[8.5px] text-zinc-500">/{round(produced)}/m</span>
                      </span>
                    ) : (
                      <span className="ml-auto text-[10.5px] text-emerald-450 font-mono font-extrabold bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/25">{round(produced)}/m</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {info.inputs.length > 0 && (
            <div className="flex flex-col gap-1.5 mt-2 border-t border-zinc-800/30 pt-2">
              {info.inputs.map((input, idx) => {
                const actualRate = actualFlow?.inputs.get(input.itemId);
                const consumed = input.ratePerMin;
                const connected = actualRate !== undefined;
                const diff = connected ? actualRate - consumed : 0;
                const starved = diff < -0.01;
                const surplus = diff > 0.01;
                return (
                  <div key={idx} className="flex items-center gap-2 text-[10px] text-zinc-400 bg-zinc-950/30 p-2 rounded-xl border border-zinc-900/60 hover:border-orange-500/20 transition-all duration-200 shadow-sm">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0 shadow-[0_0_4px_rgba(249,115,22,0.8)]" />
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                      <ItemIcon itemId={input.itemId} size={18} />
                    </div>
                    <span className="truncate text-zinc-300 font-semibold text-[11px]">{input.itemName}</span>
                    {connected && (starved || surplus) ? (
                      <span className="ml-auto font-mono flex items-baseline gap-0.5 bg-zinc-900/60 px-2 py-0.5 rounded-lg border border-zinc-800">
                        <span
                          className={`text-[10.5px] font-extrabold ${starved ? 'text-amber-450 animate-pulse' : 'text-sky-400'}`}
                          title={starved ? 'Sous-alimenté' : 'Reçu en surplus'}
                        >
                          {round(actualRate)}
                        </span>
                        <span className="text-[8.5px] text-zinc-555">/{round(consumed)}/m</span>
                      </span>
                    ) : (
                      <span className="ml-auto text-[10px] text-orange-400/80 font-mono font-semibold bg-zinc-900/40 px-2 py-0.5 rounded-lg border border-zinc-800/40">{round(consumed)}/m</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {cycleTime > 0 && <CycleBar seconds={cycleTime} color={accentColor} />}
        </div>
      ) : (
        <div className="mt-1 flex items-center justify-center py-2 text-center font-bold uppercase tracking-wider text-[10px] text-zinc-550 bg-zinc-950/40 rounded-xl border border-zinc-900/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] relative z-10">
          📟 À configurer
        </div>
      )}

      {/* Raccordements convoyeurs rotatifs multiples (Outputs) */}
      {outPorts.map((p, i) => {
        const rotPos = getRotatedPosition(Position.Right, rotation);
        return (
          <Handle
            key={p.id}
            id={p.id}
            type="source"
            position={rotPos}
            style={getMultiHandleStyle(rotPos, i, outPorts.length, 'rgba(16, 185, 129, 0.6)')}
            title={p.title}
            className={HANDLE_OUT}
          />
        );
      })}

      {/* Bande de signalisation industrielle pour les mineurs */}
      {building?.category === 'extraction' && (
        <div className="absolute bottom-0 inset-x-0 h-1.5 nf-hazard-stripes opacity-70 z-0" />
      )}
    </div>
  );
}
