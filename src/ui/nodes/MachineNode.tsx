import { useContext, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Handle, NodeToolbar, Position, useViewport, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import type { Building } from '@/data/types';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import type { MachineNode as MachineNodeType, MachineNodeData } from '@/store/useGraphStore';
import { computeNodeInfo, MACHINE_UPGRADE_MAX_LEVEL } from '@/graph/nodeInfo';
import { machineUpgradeCost } from '@/game/balance';
import { useProgressionStore } from '@/store/useProgressionStore';
import { computeMachineStatus, type MachineState } from '@/graph/machineStatus';
import { ExtractionIcon, SmeltingIcon, ManufacturingIcon, LogisticsIcon, PowerIcon } from '@/ui/icons';
import { DatacenterIllustration } from '@/ui/nodes/illustrations/DatacenterIllustration';
import { HarvesterIllustration } from '@/ui/nodes/illustrations/HarvesterIllustration';
import { ItemIcon } from '@/ui/assets';
import { NodeFlowContext, PowerContext, PowerConnectionsContext, PowerNetworkContext, ActivePowerNodesContext, AnyPowerNetworkActiveContext } from '@/ui/NodeFlowContext';

/**
 * Silhouettes personnalisées (Scrappy AI Lab) :
 * - extraction (crawler) : coins asymétriques lourds, bordure verte terminal
 * - smelting (tokenizer) : dôme biseauté pour le lavage/centrifugation
 * - manufacturing (training) : biseauté cyber-punk
 * - power (datacenter) : monolithe élancé et angulaire violet
 * - logistics (network interconnect) : losange parfait en rotation interne
 */
const CATEGORY_SILHOUETTE: Record<string, string> = {
  extraction: 'rounded-tr-[2rem] rounded-bl-[2rem] rounded-tl-lg rounded-br-lg border-l-4 border-l-green-500 border-zinc-800/80',
  smelting: 'rounded-t-[2.2rem] rounded-b-lg border-t-4 border-t-orange-500 border-zinc-800/80',
  manufacturing: 'rounded-tl-[2rem] rounded-br-[2rem] rounded-tr-lg rounded-bl-lg border-l-4 border-l-sky-500 border-zinc-800/80',
  power: 'rounded-xl border-t-4 border-t-purple-500 border-zinc-800/80',
};

/** Couleur hex par catégorie. */
const CATEGORY_COLOR: Record<string, string> = {
  extraction:    '#22c55e', // green-500 (crawler terminal)
  smelting:      '#f97316', // orange-500 (cleaner)
  manufacturing: '#38bdf8', // sky-400 (training units)
  logistics:     '#71717a', // zinc-500 (interconnect)
  power:         '#a855f7', // purple-500 (compute datacenter)
};

/** Couleurs de glow par catégorie. */
const CATEGORY_GLOW: Record<string, string> = {
  extraction:    'rgba(34, 197, 94, 0.25)',
  smelting:      'rgba(249, 115, 22, 0.25)',
  manufacturing: 'rgba(56, 189, 248, 0.25)',
  logistics:     'rgba(113, 113, 122, 0.25)',
  power:         'rgba(168, 85, 247, 0.25)',
};

const CATEGORY_GLOW_SOFT: Record<string, string> = {
  extraction:    'rgba(34, 197, 94, 0.08)',
  smelting:      'rgba(249, 117, 22, 0.08)',
  manufacturing: 'rgba(56, 189, 248, 0.08)',
  logistics:     'rgba(113, 113, 122, 0.08)',
  power:         'rgba(168, 85, 247, 0.08)',
};

/** Styles du badge d'état. */
const STATE_STYLE: Record<MachineState, { color: string; label: string }> = {
  nominal: { color: '#10b981', label: 'RUNNING' },
  starved: { color: '#f59e0b', label: 'THROTTLED' },
  blocked: { color: '#ef4444', label: 'BLOCKED' },
  unpowered: { color: '#64748b', label: 'OFFLINE' },
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
  extraction: 'bg-green-500/10 text-green-400 border border-green-500/20',
  smelting: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  manufacturing: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
  logistics: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20',
  power: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
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

/** Rangs affichés par niveau d'amélioration (0 = base, pas de badge). */
export const UPGRADE_RANK_LABEL = ['', 'MK.II', 'MK.III', 'MK.IV'];

/**
 * Bouton « AMÉLIORER » sous la machine (design progression v2) : +10 % de cadence
 * par niveau, payé en Bolts — la demande électrique suit, le réseau doit tenir.
 */
function UpgradeAction({ id, data, category }: { id: string; data: MachineNodeData; category: string }) {
  const upgradeNode = useGraphStore((s) => s.upgradeNode);
  const bolts = useProgressionStore((s) => s.bolts);
  if (category === 'logistics' || category === 'power') return null;

  const level = data.upgradeLevel ?? 0;
  if (level >= MACHINE_UPGRADE_MAX_LEVEL) return null;
  const cost = machineUpgradeCost(data.buildingId, level);
  if (cost <= 0) return null;
  const affordable = bolts >= cost;

  return (
    <NodeToolbar position={Position.Bottom} className="pt-2">
      <button
        type="button"
        disabled={!affordable}
        onClick={() => upgradeNode(id)}
        title={
          affordable
            ? `+10 % de cadence (la consommation électrique suit) → ${UPGRADE_RANK_LABEL[level + 1]}`
            : `Nécessite ${cost} Bolts (solde : ${Math.floor(bolts)})`
        }
        data-testid="upgrade-node"
        className="flex items-center gap-1.5 rounded-lg border border-amber-600/50 bg-zinc-950/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 shadow-[0_4px_16px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-all hover:border-amber-400 hover:bg-amber-500/10 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
      >
        AMÉLIORER · {cost}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
          <path d="M12 2 20.66 7v10L12 22 3.34 17V7L12 2Z" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </button>
    </NodeToolbar>
  );
}

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

  const category = gameData?.buildings.find((b) => b.id === data.buildingId)?.category ?? '';

  return (
    <>
    <UpgradeAction id={id} data={data} category={category} />
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
    </>
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
  const activePowerNodes = useContext(ActivePowerNodesContext);
  const anyPowerNetworkActive = useContext(AnyPowerNetworkActiveContext);
  const { zoom } = useViewport();
  const updateNodeInternals = useUpdateNodeInternals();

  const particleContainerRef = useRef<HTMLDivElement>(null);

  // Game Dev Tycoon inspired floating Research Point (RP) bubbles
  useEffect(() => {
    if (!gameData) return;
    const info = computeNodeInfo(data, gameData);
    const building = info.building;
    if (!building) return;

    // Filter categories that produce resources (and hence generate RP)
    const canProduce = building.category === 'extraction' || 
                        building.category === 'smelting' || 
                        building.category === 'manufacturing';

    const actualFlow = flowMap.get(id);
    const powered = poweredMap.get(id) ?? true;
    const status = computeMachineStatus(data, actualFlow, gameData, powered);
    const isActive = canProduce && status.state === 'nominal';

    if (!isActive) return;

    const spawnRPBubble = () => {
      const container = particleContainerRef.current;
      if (!container) return;

      const bubble = document.createElement('div');
      bubble.className = 'absolute pointer-events-none flex items-center justify-center rounded-full bg-cyan-950/90 border border-cyan-400/80 shadow-[0_0_10px_rgba(34,211,238,0.5)] z-40';
      bubble.style.width = '16px';
      bubble.style.height = '16px';
      bubble.style.left = `${10 + Math.random() * (container.clientWidth - 20)}px`;
      bubble.style.top = `${container.clientHeight / 2}px`;

      // Tiny white/cyan SVG flask icon
      bubble.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" style="width: 9px; height: 9px;">
          <path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V2" />
          <path d="M8.5 2h7" />
        </svg>
      `;

      container.appendChild(bubble);

      // Float bubble upwards, drift left/right, scale up then fade out
      gsap.fromTo(
        bubble,
        {
          y: 0,
          x: 0,
          scale: 0.6,
          opacity: 0,
        },
        {
          y: -80 - Math.random() * 40,
          x: (Math.random() - 0.5) * 24,
          scale: 1.1,
          opacity: 1,
          duration: 1.4 + Math.random() * 0.6,
          ease: 'power1.out',
          onComplete: () => {
            gsap.to(bubble, {
              opacity: 0,
              scale: 0.8,
              y: '-=15',
              duration: 0.3,
              onComplete: () => {
                bubble.remove();
              },
            });
          },
        }
      );
    };

    // Spawn first bubble with a slight random delay, then spawn on interval
    const initialDelay = setTimeout(() => {
      spawnRPBubble();
    }, Math.random() * 2000);

    const interval = setInterval(() => {
      spawnRPBubble();
    }, 2500 + Math.random() * 1500);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [id, gameData, data, flowMap, poweredMap]);

  // Recalcule les ancrages d'arêtes côté React Flow quand l'orientation change,
  // sinon les connexions restent attachées à la position d'origine du pin.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.rotation, updateNodeInternals]);

  // Calculs nécessaires aux hooks GSAP du smelter, dispo MÊME si gameData n'est pas
  // encore chargé (valeurs par défaut neutres) — les Hooks ne peuvent JAMAIS être
  // conditionnels : déclarés une fois pour toutes, ici, avant le `return null` ci-dessous.
  const earlyInfo = gameData ? computeNodeInfo(data, gameData) : undefined;
  const earlyBuilding = earlyInfo?.building;
  const earlyPowered = poweredMap.get(id) ?? true;
  const earlyMachineState = gameData
    ? computeMachineStatus(data, flowMap.get(id), gameData, earlyPowered).state
    : null;
  const isSmelterNode = earlyBuilding?.category === 'smelting';

  // GSAP DOM Element references (smelter uniquement, mais déclarées pour tous les nodes).
  const fanRef = useRef<SVGSVGElement | null>(null);
  const coreRef = useRef<HTMLDivElement | null>(null);
  const leftChimneyRef = useRef<HTMLDivElement | null>(null);
  const rightChimneyRef = useRef<HTMLDivElement | null>(null);
  const fanTweenRef = useRef<gsap.core.Tween | null>(null);

  // GSAP Effect 1: Fan Rotation with smooth speed scale and decay halts
  useEffect(() => {
    if (!isSmelterNode || !fanRef.current) return;

    if (!fanTweenRef.current) {
      fanTweenRef.current = gsap.to(fanRef.current, {
        rotation: 360,
        duration: 1.5,
        repeat: -1,
        ease: 'none',
        paused: true,
      });
    }

    const tween = fanTweenRef.current;
    const isFanActive = earlyPowered && earlyMachineState !== 'blocked' && earlyMachineState !== 'unpowered';

    if (isFanActive) {
      if (tween.paused()) {
        tween.play();
      }
      const targetSpeed = earlyMachineState === 'starved' ? 0.25 : 1.0;
      gsap.to(tween, { timeScale: targetSpeed, duration: 1.5, ease: 'power1.out' });
    } else {
      // Decay speed smoothly to 0 (physics halt feel)
      gsap.to(tween, {
        timeScale: 0,
        duration: 2.0,
        ease: 'power2.out',
        onComplete: () => {
          if (!isFanActive && tween.timeScale() === 0) {
            tween.pause();
          }
        },
      });
    }
  }, [isSmelterNode, earlyPowered, earlyMachineState]);

  // GSAP Effect 2: Molten core glow pulsing & color transitions
  useEffect(() => {
    if (!isSmelterNode || !coreRef.current) return;

    gsap.killTweensOf(coreRef.current);

    if (!earlyPowered) {
      gsap.to(coreRef.current, { opacity: 0, filter: 'brightness(0.2)', duration: 1.2, ease: 'power2.out' });
    } else if (earlyMachineState === 'starved') {
      gsap.to(coreRef.current, { opacity: 0.35, duration: 0.8 });
      gsap.fromTo(
        coreRef.current,
        { filter: 'brightness(0.6) contrast(1.0)' },
        {
          filter: 'brightness(0.85) contrast(1.1)',
          duration: 2.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        },
      );
    } else if (earlyMachineState === 'blocked') {
      gsap.to(coreRef.current, {
        opacity: 0.95,
        filter: 'brightness(1.15) contrast(1.2)',
        duration: 0.8,
        ease: 'power1.out',
      });
    } else {
      // Nominal
      gsap.to(coreRef.current, { opacity: 0.9, duration: 0.5 });
      gsap.fromTo(
        coreRef.current,
        { filter: 'brightness(0.9) contrast(1.1)' },
        {
          filter: 'brightness(1.25) contrast(1.25)',
          duration: 1.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        },
      );
    }
  }, [isSmelterNode, earlyPowered, earlyMachineState]);

  // GSAP Effect 3: Dynamic chimney sparks particle emitter (random physics)
  useEffect(() => {
    const isActive = isSmelterNode && earlyPowered && earlyMachineState === 'nominal';
    if (!isActive) return;

    const spawnSpark = (container: HTMLDivElement) => {
      if (!container) return;
      const spark = document.createElement('div');
      spark.className = 'nf-smelter-chimney-spark-live';

      const randomX = (Math.random() - 0.5) * 12; // -6px to +6px
      const scale = 0.5 + Math.random() * 0.5;

      container.appendChild(spark);

      gsap.fromTo(
        spark,
        {
          x: randomX,
          y: 0,
          scale: scale,
          opacity: 1,
        },
        {
          x: randomX * 2.5,
          y: -25 - Math.random() * 15,
          scale: 0.1,
          opacity: 0,
          duration: 1.2 + Math.random() * 0.6,
          ease: 'power1.out',
          onComplete: () => {
            spark.remove();
          },
        },
      );
    };

    const interval = setInterval(() => {
      if (leftChimneyRef.current) spawnSpark(leftChimneyRef.current);
      if (rightChimneyRef.current) spawnSpark(rightChimneyRef.current);
    }, 400);

    return () => {
      clearInterval(interval);
    };
  }, [isSmelterNode, earlyPowered, earlyMachineState]);

  // Recalcule les ancrages d'arêtes côté React Flow quand l'orientation change,
  // sinon les connexions restent attachées à la position d'origine du pin.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, data.rotation, updateNodeInternals]);

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
    const isActive = anyPowerNetworkActive && activePowerNodes.has(id);
    const poleOpacity = anyPowerNetworkActive ? (activePowerNodes.has(id) ? 1.0 : 0.08) : 0.45;
    return (
      <div
        title="Poteau électrique — 1 entrée + 3 sorties de dispatch"
        style={{ opacity: poleOpacity }}
        className={[
          'relative flex h-14 w-14 items-center justify-center rounded-full bg-zinc-950/90 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all duration-300',
          selected ? 'border-amber-400 ring-2 ring-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.5)]' : '',
          isActive && !selected ? 'border-amber-400 shadow-[0_0_22px_rgba(245,158,11,0.65)]' : '',
        ].join(' ')}
      >
        {selected && <HudBrackets color="#f59e0b" />}

        {/* Gyroscope */}
        <div 
          className="absolute inset-0.5 rounded-full border border-dashed border-amber-500/35 nf-energy-ring-rotate" 
          style={{ animationDuration: isActive ? '3.5s' : '10s' }}
        />
        <div 
          className="absolute inset-2 rounded-full border border-dashed border-amber-500/20 nf-energy-ring-reverse" 
          style={{ animationDuration: isActive ? '2.5s' : '7s' }}
        />
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
  const isNodeActive = anyPowerNetworkActive && activePowerNodes.has(id);
  const cardOpacity = anyPowerNetworkActive
    ? (activePowerNodes.has(id) ? 1.0 : 0.35)
    : 1.0;
  const handleOpacity = anyPowerNetworkActive ? (activePowerNodes.has(id) ? 1.0 : 0.15) : 1.0;

  // ── Custom layout for Datacenters ──
  if (building?.id === 'coal-generator') {
    const perItem = info.configured;
    const isNominal = machineState === 'nominal';
    const isEnergyItem = (itemId: string) => gameData.items.find((i) => i.id === itemId)?.category === 'energy';

    const inPorts: PortDef[] = perItem
      ? info.inputs
          .filter((p) => !isEnergyItem(p.itemId))
          .map((p) => ({ id: `in-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
      : Array.from({ length: genericPorts(building, data, 'inputs') }, (_, i) => ({
          id: `in-${i}`,
        }));

    const isNodeActive = anyPowerNetworkActive && activePowerNodes.has(id);
    const cardOpacity = anyPowerNetworkActive
      ? (activePowerNodes.has(id) ? 1.0 : 0.35)
      : 1.0;
    const handleOpacity = anyPowerNetworkActive ? (activePowerNodes.has(id) ? 1.0 : 0.15) : 1.0;

    const styleVariables = {
      '--category-color': '#a855f7',
      '--category-glow': isNodeActive ? 'rgba(168, 85, 247, 0.55)' : 'rgba(168, 85, 247, 0.25)',
      '--category-glow-soft': 'rgba(168, 85, 247, 0.08)',
      opacity: cardOpacity,
    } as React.CSSProperties;

    const net = powerNetworkMap.get(id);
    const demand = net?.totalDemandMW ?? 0;
    const capacity = net?.totalGenMW ?? info.powerMW;

    const loadRatio = capacity > 0 ? Math.min(demand / capacity, 1) : 0;
    const loadPercent = Math.round(loadRatio * 100);

    // Grid Power input (formerly Coal)
    const coalInput = info.inputs[0];
    const actualCoalRate = coalInput ? actualFlow?.inputs.get(coalInput.itemId) : undefined;
    const coalConsumed = coalInput?.ratePerMin ?? 0;
    const coalStarved = actualCoalRate !== undefined && actualCoalRate < coalConsumed - 0.01;

    return (
      <div
        style={styleVariables}
        className="relative h-[340px] w-[220px] text-xs overflow-visible"
      >
        <div
          className={[
            'absolute inset-0 shadow-2xl transition-all duration-300 nf-datacenter-node flex flex-col overflow-hidden',
            selected ? 'nf-node-selected-glow scale-[1.01]' : '',
          ].join(' ')}
        >
          <NodeActions id={id} data={data} />

          {/* 2.5D Isometric Datacenter server rack illustration - fills the background */}
          <div className="absolute inset-0 rounded-[10px] pointer-events-none z-0">
            <DatacenterIllustration state={machineState ?? 'unpowered'} powered={powered} />
          </div>

          {/* Neon Purple Side Accent Highlight Bars (matching the Harvester green sides) */}
          <div className="absolute left-0 top-[12px] bottom-[12px] w-[2px] bg-purple-500/80 shadow-[0_0_8px_#a855f7] z-20 pointer-events-none" />
          <div className="absolute right-0 top-[12px] bottom-[12px] w-[2px] bg-purple-500/80 shadow-[0_0_8px_#a855f7] z-20 pointer-events-none" />

          {/* 1. HUD : Header (Name + Status) */}
          <div className="relative z-10 flex flex-col gap-1 p-2.5">
            <div className="flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm rounded-md px-2 py-1 border border-zinc-800/60 shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-1.5">
                <PowerIcon className="h-3 w-3 text-purple-400" />
                <span className="font-extrabold tracking-tight text-purple-400 text-[10px] uppercase font-mono leading-none">
                  Datacenter AI
                </span>
              </div>
              {(() => {
                const stateKey = machineState || 'unpowered';
                return (
                  <span className="nf-power-switch flex h-4 w-4 shrink-0 items-center justify-center rounded-full">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full relative z-10 nf-diode-glow"
                      style={{
                        '--state-color': STATE_STYLE[stateKey].color,
                        background: STATE_STYLE[stateKey].color,
                        boxShadow: `0 0 5px ${STATE_STYLE[stateKey].color}`,
                      } as React.CSSProperties}
                    />
                  </span>
                );
              })()}
            </div>
            <span className="text-[6.5px] font-mono text-purple-400 bg-zinc-950/80 backdrop-blur-sm px-1.5 py-0.5 rounded border border-zinc-850/60 uppercase tracking-widest text-center select-none leading-none shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
              {isNominal && powered ? 'SYS_OK · TEMP: 38°C' : machineState === 'starved' ? 'ERR_POWER · TEMP: 18°C' : !powered ? 'ERR_OFFLINE · STANDBY' : 'ERR_THROTTLED · COOLANT'}
            </span>
          </div>

          {/* 2. HUD : Telemetry readouts stacked vertically over illustration */}
          <div className="relative z-10 flex-1 flex flex-col gap-2.5 px-2.5 justify-center pb-2">
            
            {/* Compute output block */}
            <div className="flex flex-col gap-1 bg-zinc-950/80 backdrop-blur-sm rounded-md p-2 border border-zinc-800/60 shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between font-bold text-purple-400">
                <div className="flex items-center gap-1">
                  <PowerIcon className="h-2.5 w-2.5 animate-pulse" />
                  <span className="text-[9px] font-mono font-extrabold">{info.powerMW} FLOPs</span>
                </div>
                <span className="text-[7.5px] font-mono text-zinc-400 font-bold bg-purple-500/10 px-1 rounded border border-purple-500/20">GRID SYS</span>
              </div>
              
              <div className="w-full h-1 bg-zinc-950 border border-zinc-850 rounded-sm overflow-hidden relative my-0.5">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${loadPercent}%`,
                    background: loadRatio > 0.85 ? 'linear-gradient(90deg, #ef4444, #f97316)' : 'linear-gradient(90deg, #a855f7, #c084fc)'
                  }}
                />
              </div>

              <div className="text-[7px] font-mono text-zinc-400 flex justify-between tracking-tight leading-none mt-0.5">
                <span>LOAD_FACTOR:</span>
                <span className="font-extrabold text-zinc-200">{round(demand)}/{round(capacity)} FL</span>
              </div>
            </div>

            {/* Grid Power Input */}
            <div className="flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm rounded-md p-2 border border-zinc-800/60 shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              <div className="flex flex-col">
                <span className="text-[6px] text-zinc-500 uppercase tracking-widest font-mono leading-none">Stream In</span>
                <span className="text-[8.5px] text-purple-300 font-bold font-mono uppercase mt-0.5">Grid Power</span>
              </div>
              <div className="flex flex-col items-end">
                {coalConsumed > 0 ? (
                  coalStarved ? (
                    <span className="font-mono flex items-baseline gap-0.5 text-[9px] font-bold">
                      <span className="font-extrabold text-amber-450 animate-pulse">{round(actualCoalRate!)}</span>
                      <span className="text-[7px] text-zinc-500">/{round(coalConsumed)}</span>
                    </span>
                  ) : (
                    <span className="text-[9.5px] text-purple-400 font-mono font-bold bg-purple-500/5 px-1.5 py-0.5 rounded border border-purple-500/10">{round(coalConsumed)}/m</span>
                  )
                ) : (
                  <span className="text-[8.5px] text-zinc-500 font-mono uppercase">Offline</span>
                )}
              </div>
            </div>

            {/* Core operation + progress */}
            <div className="flex items-center justify-between bg-zinc-950/80 backdrop-blur-sm rounded-md p-2 border border-zinc-800/60 shadow-[0_2px_6px_rgba(0,0,0,0.5)]">
              <span className="text-[7.5px] font-mono text-purple-400 font-extrabold select-none tracking-wider">
                {isNominal && powered ? 'CORE_ACTIVE' : 'CORE_STANDBY'}
              </span>
              {cycleTime > 0 ? (
                <div className="w-[56px] h-1.5 relative rounded bg-zinc-950/90 border border-zinc-800/80 overflow-hidden shadow-inner">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(90deg, #6366f1, #a855f7 80%, #d8b4fe 100%)',
                      boxShadow: '0 0 6px 1px rgba(168, 85, 247, 0.6)',
                      transformOrigin: 'left center',
                      animation: `nf-cycle ${cycleTime}s linear infinite`,
                    } as React.CSSProperties}
                  />
                </div>
              ) : (
                <span className="text-[7px] font-extrabold uppercase text-zinc-500 tracking-wider font-mono">OFFLINE</span>
              )}
            </div>
          </div>
        </div>

        {/* 3. CONNECTION HANDLES (Left conveyor input, Right power output) */}
        <Handle
          key="power-out"
          id="power-out"
          type="source"
          position={getRotatedPosition(Position.Right, rotation)}
          title="Sortie d'énergie"
          style={{
            ...getHandleStyle(getRotatedPosition(Position.Right, rotation), 'rgba(168, 85, 247, 0.6)'),
            opacity: handleOpacity,
            transition: 'opacity 0.22s ease-in-out',
          }}
          className={HANDLE_POWER_OUT}
        />

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
      </div>
    );
  }

  // ── Custom layout for Data Harvesters ──
  if (building?.category === 'extraction') {
    const perItem = info.configured;
    const isNominal = machineState === 'nominal';
    const isStarved = machineState === 'starved';
    const active = powered && isNominal;
    const isEnergyItem = (itemId: string) => gameData.items.find((i) => i.id === itemId)?.category === 'energy';

    const outPorts: PortDef[] = perItem
      ? info.outputs
          .filter((p) => !isEnergyItem(p.itemId))
          .map((p) => ({ id: `out-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
      : Array.from({ length: genericPorts(building, data, 'outputs') }, (_, i) => ({
          id: `out-${i}`,
        }));

    const isNodeActive = anyPowerNetworkActive && activePowerNodes.has(id);
    const cardOpacity = anyPowerNetworkActive
      ? (activePowerNodes.has(id) ? 1.0 : 0.35)
      : 1.0;
    const handleOpacity = anyPowerNetworkActive ? (activePowerNodes.has(id) ? 1.0 : 0.15) : 1.0;

    const styleVariables = {
      '--category-color': '#22c55e',
      '--category-glow': isNodeActive ? 'rgba(34, 197, 94, 0.55)' : 'rgba(34, 197, 94, 0.25)',
      '--category-glow-soft': 'rgba(34, 197, 94, 0.08)',
      opacity: cardOpacity,
    } as React.CSSProperties;

    // Signal ping speed based on machine state
    let signalSpeedVar = '0s';
    if (machineState === 'nominal') {
      signalSpeedVar = '1.5s';
    } else if (machineState === 'starved') {
      signalSpeedVar = '4s';
    }

    return (
      <div
        style={styleVariables}
        className="relative h-[180px] w-[440px] text-xs overflow-visible"
      >
        <div
          className={[
            'absolute inset-0 shadow-2xl transition-all duration-300 nf-harvester-node flex flex-col overflow-hidden',
            selected ? 'nf-node-selected-glow scale-[1.01]' : '',
          ].join(' ')}
        >
          <div ref={particleContainerRef} className="absolute inset-0 pointer-events-none overflow-visible z-30" />
          
          {/* Neon Green Side Accent Highlight Bars */}
          <div className="absolute left-0 top-[12px] bottom-[12px] w-[2px] bg-green-500/80 shadow-[0_0_8px_#22c55e] z-20 pointer-events-none" />
          <div className="absolute right-0 top-[12px] bottom-[12px] w-[2px] bg-green-500/80 shadow-[0_0_8px_#22c55e] z-20 pointer-events-none" />
          
          {selected && <HudBrackets color="#22c55e" />}
          <NodeActions id={id} data={data} />

          {/* Panoramic Illustration Background (CRT & Controls) */}
          <div className="absolute inset-0 pointer-events-none z-0">
            <HarvesterIllustration state={machineState ?? 'unpowered'} powered={powered} pulseSpeed={signalSpeedVar} />
          </div>

          {/* CRT GLASS SCREEN TERMINAL LAYER */}
          <div className="absolute left-[22px] top-[22px] w-[286px] h-[136px] p-2.5 flex flex-col justify-between font-mono text-[#10b981] select-none pointer-events-none z-10">
            {/* Cathodic Reflection & Scanlines Overlays */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-white/10 rounded-lg z-20" />
            <div className="absolute inset-0 pointer-events-none opacity-[0.18] rounded-lg z-20" style={{ backgroundImage: 'repeating-linear-gradient(0deg, #000 0px, #000 2px, transparent 2px, transparent 4px)' }} />

            {/* Header row */}
            <div className="flex items-center justify-between text-[7.5px] font-extrabold tracking-wider opacity-90 z-10">
              <span>[SYS_OK // DATA_CRAWLER_V1]</span>
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                <span>ONLINE</span>
              </div>
            </div>

            {/* Telemetry info row */}
            <div className="flex justify-between items-center my-auto z-10 w-full">
              {/* Left Column: DB details */}
              <div className="flex flex-col gap-0.5 text-[8px] opacity-85">
                <div className="flex gap-2">
                  <span className="text-[#10b981]/60">DB_SRC:</span>
                  <span className="font-bold text-[#34d399]">{data.purity?.toUpperCase() || 'NORMAL'}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#10b981]/60">IP_ADR:</span>
                  <span className="text-[#34d399]">192.168.0.{id.charCodeAt(0) % 255}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-[#10b981]/60">EST_CN:</span>
                  <span className="text-[#34d399]">DB_POOL_ACTIVE</span>
                </div>
              </div>

              {/* Right Column: Crawl Output */}
              {info.configured && info.outputs.length > 0 ? (
                <div className="flex flex-col items-center bg-zinc-950/70 border border-[#10b981]/25 rounded px-2 py-1 shadow-[0_0_8px_rgba(16,185,129,0.1)]">
                  <span className="text-[6px] text-[#10b981]/50 font-black tracking-widest uppercase mb-0.5">// OUT</span>
                  {info.outputs.map((output, idx) => {
                    const actualRate = actualFlow?.outputs.get(output.itemId);
                    const produced = output.ratePerMin;
                    const connected = actualRate !== undefined;
                    const backedUp = connected && actualRate < produced - 0.01;

                    return (
                      <div key={idx} className="flex items-center gap-1.5">
                        <div className="flex h-4.5 w-4.5 items-center justify-center rounded bg-zinc-900 border border-[#10b981]/20">
                          <ItemIcon itemId={output.itemId} size={11} />
                        </div>
                        {backedUp ? (
                          <span className="font-mono text-[8px] font-black text-amber-500 tabular-nums leading-none">
                            {round(actualRate)}
                          </span>
                        ) : (
                          <span className="font-mono text-[8px] font-black text-[#34d399] tabular-nums leading-none">
                            {round(produced)}
                          </span>
                        )}
                        <span className="text-[6px] text-[#10b981]/50 font-semibold font-mono">/M</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span className="text-[6.5px] text-zinc-550 font-mono tracking-widest uppercase">No Data</span>
              )}
            </div>

            {/* Bottom row (Speed + Segmented Loader) */}
            <div className="flex items-center justify-between gap-2 border-t border-[#10b981]/25 pt-1.5 z-10">
              <span className="text-[7.5px] font-extrabold tracking-wider">
                {active ? 'CRAWLING...' : isStarved ? 'THROTTLED' : 'STANDBY'}
              </span>
              
              {cycleTime > 0 ? (
                <div className="w-[100px] h-2 relative rounded bg-zinc-950/80 border border-zinc-900 overflow-hidden shadow-inner">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l nf-segmented-bar"
                    style={{
                      width: '100%',
                      '--bar-color': '#10b981',
                      transformOrigin: 'left center',
                      animation: `nf-cycle ${cycleTime}s linear infinite`,
                    } as React.CSSProperties}
                  />
                </div>
              ) : (
                <span className="text-[7px] text-zinc-650 font-extrabold uppercase tracking-wider">OFFLINE</span>
              )}
            </div>
          </div>
        </div>

        {/* Handles */}
        <Handle
          key="power-in"
          id="power-in"
          type="target"
          position={getRotatedPosition(Position.Top, rotation)}
          title="Entrée d'énergie"
          style={{
            ...getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(168, 85, 247, 0.6)'),
            opacity: handleOpacity,
            transition: 'opacity 0.22s ease-in-out',
          }}
          className={HANDLE_POWER_IN}
        />

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
      </div>
    );
  }

  // ── Custom layout for Smelters ──
  if (building?.category === 'smelting') {
    const perItem = info.configured;
    const isNominal = machineState === 'nominal';
    const isEnergyItem = (itemId: string) => gameData.items.find((i) => i.id === itemId)?.category === 'energy';

    const inPorts: PortDef[] = perItem
      ? info.inputs
          .filter((p) => !isEnergyItem(p.itemId))
          .map((p) => ({ id: `in-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
      : Array.from({ length: genericPorts(building, data, 'inputs') }, (_, i) => ({
          id: `in-${i}`,
        }));

    const outPorts: PortDef[] = perItem
      ? info.outputs
          .filter((p) => !isEnergyItem(p.itemId))
          .map((p) => ({ id: `out-${p.itemId}`, title: `${p.itemName} · ${p.ratePerMin}/min` }))
      : Array.from({ length: genericPorts(building, data, 'outputs') }, (_, i) => ({
          id: `out-${i}`,
        }));

    const isNodeActive = anyPowerNetworkActive && activePowerNodes.has(id);
    const cardOpacity = anyPowerNetworkActive
      ? (activePowerNodes.has(id) ? 1.0 : 0.35)
      : 1.0;
    const handleOpacity = anyPowerNetworkActive ? (activePowerNodes.has(id) ? 1.0 : 0.15) : 1.0;

    // Determine core glow state class
    let coreGlowClass = 'nf-smelter-core-glow-nominal';
    let fanSpeed = '2.5s';
    if (!powered) {
      coreGlowClass = 'nf-smelter-core-glow-unpowered';
      fanSpeed = '0s'; // paused
    } else if (machineState === 'starved') {
      coreGlowClass = 'nf-smelter-core-glow-starved';
      fanSpeed = '8s'; // slow spin
    } else if (machineState === 'blocked') {
      coreGlowClass = 'nf-smelter-core-glow-blocked';
      fanSpeed = '0s'; // paused
    } else if (machineState === 'unpowered') {
      coreGlowClass = 'nf-smelter-core-glow-unpowered';
      fanSpeed = '0s'; // paused
    }

    const styleVariables = {
      '--category-color': '#f97316',
      '--category-glow': isNodeActive ? 'rgba(249, 115, 22, 0.55)' : 'rgba(249, 115, 22, 0.25)',
      '--category-glow-soft': 'rgba(249, 117, 22, 0.08)',
      '--turbine-speed': fanSpeed,
      opacity: cardOpacity,
    } as React.CSSProperties;

    return (
      <div
        style={styleVariables}
        className={[
          'relative min-h-[132px] w-[300px] text-xs shadow-2xl transition-all duration-300 nf-smelter-node flex flex-col overflow-visible',
          selected ? 'nf-node-selected-glow scale-[1.01]' : '',
        ].join(' ')}
      >
        <div ref={particleContainerRef} className="absolute inset-0 pointer-events-none overflow-visible z-30" />
        {selected && <HudBrackets color="#f97316" />}
        <NodeActions id={id} data={data} />

        {/* Physical Chimney Stacks protruding from the top (Representing clean air venting) */}
        <div ref={leftChimneyRef} className="absolute -top-[10px] left-[32px] w-6 h-[10px] bg-zinc-900 border-t-2 border-l border-r border-zinc-800 rounded-t shadow-[0_-2px_4px_rgba(0,0,0,0.5)] z-0 flex items-end justify-center">
          <div className="w-3.5 h-[6px] bg-zinc-950 rounded-t border-t border-zinc-900" />
        </div>
        <div ref={rightChimneyRef} className="absolute -top-[10px] right-[32px] w-6 h-[10px] bg-zinc-900 border-t-2 border-l border-r border-zinc-800 rounded-t shadow-[0_-2px_4px_rgba(0,0,0,0.5)] z-0 flex items-end justify-center">
          <div className="w-3.5 h-[6px] bg-zinc-950 rounded-t border-t border-zinc-900" />
        </div>

        {/* 1. TOP EXHAUST STACK & TURBINE */}
        <div className="w-full h-8 flex items-center justify-between px-3 nf-smelter-exhaust-stack relative z-10">
          <div className="w-12 h-2.5 rounded-sm nf-smelter-vent-grille border border-zinc-800/40" />
          <div className="flex items-center gap-1.5 bg-zinc-950/90 border border-zinc-800 px-2 py-0.5 rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <span className="text-[8px] font-mono text-zinc-400 uppercase tracking-wide">Deduplicator Fan</span>
            <div className="w-4 h-4 rounded-full bg-zinc-900 border border-zinc-700/60 flex items-center justify-center overflow-hidden">
              <svg 
                ref={fanRef}
                className="w-3.5 h-3.5 text-zinc-400"
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={2.5}
              >
                <path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                <path d="M12 12c-2-3-4-2-4-2s1 3 4 2M12 12c3 2 2 4 2 4s-3-1-4-2M12 12c-3-2-2-4-2-4s3 1 4 2M12 12c2 3 4 2 4 2s-1-3-4-2" />
              </svg>
            </div>
          </div>
          <div className="w-12 h-2.5 rounded-sm nf-smelter-vent-grille border border-zinc-800/40" />
        </div>

        {/* 2. LED CONTROLLER READOUT (Header) */}
        <div className="flex items-center justify-between gap-2 border-b border-zinc-900 px-3 py-2 bg-zinc-950/40 relative z-10">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 border border-orange-500/20 shrink-0 shadow-sm">
              <SmeltingIcon className="h-3.5 w-3.5" />
            </span>
            <span className="font-extrabold tracking-tight text-zinc-100 text-[12.5px] uppercase">{building?.name ?? 'Data Cleaner'}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="rounded bg-zinc-800/80 px-1 py-0.5 text-[8.5px] font-extrabold text-zinc-400 border border-zinc-700/30 flex items-center font-mono">
              <span className="text-emerald-450 drop-shadow-[0_0_2px_rgba(16,185,129,0.5)]">
                {rotation === 0 && '▶'}
                {rotation === 90 && '▼'}
                {rotation === 180 && '◀'}
                {rotation === 270 && '▲'}
              </span>
            </span>

            {info.powerMW > 0 && (
              <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[8.5px] font-extrabold text-amber-400 border border-amber-500/20 flex items-center gap-0.5 shrink-0 font-mono">
                <span>⚡</span>
                <span>{info.powerMW} MW</span>
              </span>
            )}

            {/* LED bar graph for thermal load */}
            {(() => {
              const rpm = powered ? (machineState === 'starved' ? 1800 : 9600) : 0;
              const totalBars = 6;
              const activeBars = Math.round((rpm / 10000) * totalBars);
              return (
                <span className="inline-flex gap-[1.5px] items-center bg-zinc-950/80 px-1.5 py-0.5 rounded border border-zinc-800" title={`Vitesse de filtrage: ${rpm} RPM`}>
                  {Array.from({ length: totalBars }).map((_, i) => (
                    <span 
                       key={i} 
                       className={`w-[2.5px] h-[5px] rounded-[0.5px] ${i < activeBars ? 'bg-orange-500 shadow-[0_0_2px_#f97316]' : 'bg-zinc-800'}`} 
                    />
                  ))}
                </span>
              );
            })()}

            {(() => {
              const stateKey = machineState || 'unpowered';
              return (
                <span
                  className="h-2 w-2 shrink-0 rounded-full relative z-10 nf-diode-glow"
                  style={{
                    '--state-color': STATE_STYLE[stateKey].color,
                    background: STATE_STYLE[stateKey].color,
                    animation:
                      stateKey === 'nominal' ? undefined : 'nf-activity-dot 1s ease-in-out infinite',
                  } as React.CSSProperties}
                />
              );
            })()}
          </div>
        </div>

        {/* 4. MAIN CORE CHAMBER - HORIZONTAL LAYOUT */}
        <div className="flex flex-1 p-3 gap-2 bg-[#121114] rounded-b-xl relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none nf-furnace-grid opacity-20 z-0" />

          {/* SVG Flow lines connecting ports to crucible */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" xmlns="http://www.w3.org/2000/svg">
            <line x1="88" y1="50%" x2="123" y2="50%" stroke="rgba(24, 24, 27, 0.7)" strokeWidth="6" strokeLinecap="round" />
            <line x1="177" y1="50%" x2="212" y2="50%" stroke="rgba(24, 24, 27, 0.7)" strokeWidth="6" strokeLinecap="round" />
            {isNominal && powered && (
              <>
                <line x1="88" y1="50%" x2="123" y2="50%" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round" className="nf-smelter-flowline" />
                <line x1="177" y1="50%" x2="212" y2="50%" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" className="nf-smelter-flowline" />
              </>
            )}
          </svg>

          {/* Left: Input slot (Raw Corpus) */}
          <div className="flex-1 flex flex-col justify-center items-center z-10">
            {info.configured && info.inputs.length > 0 ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[7.5px] font-black uppercase text-zinc-400 tracking-wider select-none mb-0.5">Raw Input</span>
                {info.inputs.map((input, idx) => {
                  const actualRate = actualFlow?.inputs.get(input.itemId);
                  const consumed = input.ratePerMin;
                  const connected = actualRate !== undefined;
                  const diff = connected ? actualRate - consumed : 0;
                  const starved = diff < -0.01;
                  const surplus = diff > 0.01;

                  return (
                    <div 
                      key={idx} 
                      className="flex flex-col items-center justify-center p-2 rounded-xl nf-smelter-port-box nf-smelter-port-box-in border border-zinc-800/60 w-20 shrink-0"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] mb-1.5 transition-all duration-300 hover:border-orange-500/50 hover:shadow-[0_0_8px_rgba(249,115,22,0.25),inset_0_2px_4px_rgba(0,0,0,0.9)]">
                        <ItemIcon itemId={input.itemId} size={32} />
                      </div>
                      
                      {connected && (starved || surplus) ? (
                        <span className="font-mono flex items-baseline gap-0.5 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800 text-[8.5px] font-bold">
                          <span
                            className={`font-extrabold ${starved ? 'text-amber-450 animate-pulse' : 'text-sky-450'}`}
                            title={starved ? 'Sous-alimenté' : 'Reçu en surplus'}
                          >
                            {round(actualRate)}
                          </span>
                          <span className="text-[7.5px] text-zinc-400">/{round(consumed)}</span>
                        </span>
                      ) : (
                        <span className="text-[8.5px] text-orange-400 font-mono font-bold bg-orange-500/5 px-2 py-0.5 rounded border border-orange-500/15">{round(consumed)}/m</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-2 border border-dashed border-zinc-800/40 rounded-lg text-zinc-500 text-[8px] uppercase select-none">
                No Input
              </div>
            )}
          </div>

          {/* Center: Token Scrubbing Chamber */}
          <div className="w-[88px] flex flex-col items-center justify-center gap-2 relative z-10 border-l border-r border-zinc-900/60 px-1">
            
            {/* Centrifugal washer cylinder */}
            <div 
              className="w-[54px] h-[54px] rounded-full p-[4px] shadow-[0_4px_12px_rgba(0,0,0,0.7)] flex items-center justify-center relative overflow-hidden transition-all duration-500 shrink-0"
              style={{
                background: powered 
                  ? `conic-gradient(from 180deg, #fdba74 0%, #f97316 ${machineState === 'starved' ? 20 : 60}%, #c2410c ${machineState === 'starved' ? 30 : 90}%, #222024 ${machineState === 'starved' ? 30 : 90}%)`
                  : '#222024'
              }}
            >
              {/* Inner Chamber */}
              <div className="w-[44px] h-[44px] rounded-full bg-zinc-950 flex items-center justify-center relative overflow-hidden z-10 shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.95)]">
                <div ref={coreRef} className={['absolute inset-0 rounded-full pointer-events-none transition-all duration-500', coreGlowClass].join(' ')} />
                
                {/* Visual safety indicators */}
                <div className="absolute inset-y-1 left-[21px] w-[1px] bg-zinc-950/45 z-10" />
                <div className="absolute inset-x-1 top-[21px] h-[1px] bg-zinc-950/45 z-10" />
                <div className="absolute inset-1 rounded-full border border-dashed border-zinc-950/30 pointer-events-none z-10" 
                     style={{ backgroundImage: 'radial-gradient(circle, #000 1.2px, transparent 1.2px)', backgroundSize: '3.5px 3.5px' }} />

                {/* Filter Rivets */}
                {Array.from({ length: 6 }).map((_, idx) => {
                  const angle = (idx * 360) / 6;
                  const rad = (angle * Math.PI) / 180;
                  const radius = 18;
                  const left = 20.5 + radius * Math.cos(rad) - 1.5;
                  const top = 20.5 + radius * Math.sin(rad) - 1.5;
                  return (
                    <div 
                      key={idx} 
                      className="absolute w-[3px] h-[3px] rounded-full bg-zinc-500 border border-zinc-950 shadow-[inset_0_0.5px_0.5px_rgba(255,255,255,0.25)] z-30 pointer-events-none" 
                      style={{ left: `${left}px`, top: `${top}px` }}
                    />
                  );
                })}

                <div className="relative z-20 flex flex-col items-center justify-center select-none bg-zinc-950/90 w-[26px] h-[26px] rounded-full border border-zinc-900/80 shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  <span className="text-[7px] font-black text-orange-400 font-mono tracking-tighter leading-none drop-shadow-[0_0_2px_#f97316]">
                    {powered && machineState !== 'starved' ? '9.6k' : (machineState === 'starved' ? '1.8k' : '0')}
                  </span>
                  <span className="text-[5px] text-zinc-500 font-mono uppercase tracking-widest leading-none mt-0.5">RPM</span>
                </div>
              </div>
            </div>

            {info.configured && cycleTime > 0 ? (
              <div className="w-full flex flex-col items-center gap-0.5">
                <span className="text-[7px] font-black uppercase text-zinc-400 tracking-widest select-none">Scrub Cycle</span>
                <div className="w-[64px] h-1.5 relative rounded bg-zinc-950/90 border border-zinc-800/80 overflow-hidden shadow-inner">
                  <div
                    className="absolute inset-y-0 left-0 rounded-l"
                    style={{
                      width: '100%',
                      background: 'linear-gradient(90deg, #ea580c, #f97316 80%, #ffedd5 100%)',
                      boxShadow: '0 0 6px 1px rgba(249, 115, 22, 0.6)',
                      transformOrigin: 'left center',
                      animation: `nf-cycle ${cycleTime}s linear infinite`,
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            ) : (
              <span className="text-[7px] font-extrabold uppercase text-zinc-500 tracking-wider text-center select-none">Ready</span>
            )}
          </div>

          {/* Right: Output slot (Cleaned Output) */}
          <div className="flex-1 flex flex-col justify-center items-center z-10">
            {info.configured && info.outputs.length > 0 ? (
              <div className="flex flex-col items-center gap-1">
                <span className="text-[7.5px] font-black uppercase text-zinc-400 tracking-wider mr-1 text-right select-none mb-0.5">Clean Output</span>
                {info.outputs.map((output, idx) => {
                  const actualRate = actualFlow?.outputs.get(output.itemId);
                  const produced = output.ratePerMin;
                  const connected = actualRate !== undefined;
                  const backedUp = connected && actualRate < produced - 0.01;

                  return (
                    <div 
                      key={idx} 
                      className="flex flex-col items-center justify-center p-2 rounded-xl nf-smelter-port-box nf-smelter-port-box-out border border-zinc-800/60 w-20 shrink-0"
                    >
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-950 border border-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)] mb-1.5 transition-all duration-300 hover:border-emerald-500/50 hover:shadow-[0_0_8px_rgba(16,185,129,0.25),inset_0_2px_4px_rgba(0,0,0,0.9)]">
                        <ItemIcon itemId={output.itemId} size={32} />
                      </div>
                      
                      {backedUp ? (
                        <span className="font-mono flex items-baseline gap-0.5 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800 text-[8.5px] font-bold">
                          <span className="font-extrabold text-amber-400">{round(actualRate)}</span>
                          <span className="text-[7.5px] text-zinc-400">/{round(produced)}</span>
                        </span>
                      ) : (
                        <span className="text-[8.5px] text-emerald-450 font-mono font-bold bg-emerald-500/5 px-2 py-0.5 rounded border border-emerald-500/15">{round(produced)}/m</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-2 border border-dashed border-zinc-800/40 rounded-lg text-zinc-500 text-[8px] uppercase select-none text-center">
                📟 Configure Rec.
              </div>
            )}
          </div>
        </div>

        {/* 5. CONNECTION HANDLES (Must map exactly to react-flow wiring) */}
        <Handle
          key="power-in"
          id="power-in"
          type="target"
          position={getRotatedPosition(Position.Top, rotation)}
          title="Entrée d'énergie"
          style={{
            ...getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(245, 158, 11, 0.6)'),
            opacity: handleOpacity,
            transition: 'opacity 0.22s ease-in-out',
          }}
          className={HANDLE_POWER_IN}
        />

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
      </div>
    );
  }

  const styleVariables = {
    '--category-color': accentColor,
    '--category-glow': isNodeActive
      ? (building?.category === 'power' ? 'rgba(16, 185, 129, 0.55)' : CATEGORY_GLOW[building?.category ?? ''] || 'rgba(113, 113, 122, 0.45)')
      : (CATEGORY_GLOW[building?.category ?? ''] ?? 'rgba(113, 113, 122, 0.25)'),
    '--category-glow-soft': CATEGORY_GLOW_SOFT[building?.category ?? ''] ?? 'rgba(113, 113, 122, 0.08)',
    opacity: cardOpacity,
  } as React.CSSProperties;

  return (
    <div
      style={styleVariables}
      className={[
        'relative min-h-[76px] min-w-[220px] max-w-[260px] p-4.5 text-xs shadow-xl transition-all duration-300 nf-node-glass nf-node-blueprint',
        silhouette,
        selected ? 'nf-node-selected-glow scale-[1.01]' : '',
      ].join(' ')}
    >

      {/* Visual background for Synapse Training (manufacturing) */}
      {building?.category === 'manufacturing' && (
        <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none z-0 opacity-25 flex items-center justify-around px-8">
          <div className={`w-2 h-2 rounded-full nf-synapse-node ${isNominal ? 'nf-synapse-active' : ''}`} style={{ animationDelay: '0s' }} />
          <div className={`w-2.5 h-2.5 rounded-full nf-synapse-node ${isNominal ? 'nf-synapse-active' : ''}`} style={{ animationDelay: '0.4s' }} />
          <div className={`w-2 h-2 rounded-full nf-synapse-node ${isNominal ? 'nf-synapse-active' : ''}`} style={{ animationDelay: '0.8s' }} />
        </div>
      )}

      <div ref={particleContainerRef} className="absolute inset-0 pointer-events-none overflow-visible z-30" />
      {selected && <HudBrackets color={accentColor} />}
      <NodeActions id={id} data={data} />

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
          style={{
            ...getHandleStyle(getRotatedPosition(Position.Bottom, rotation), 'rgba(168, 85, 247, 0.6)'),
            opacity: handleOpacity,
            transition: 'opacity 0.22s ease-in-out',
          }}
          className={HANDLE_POWER_OUT}
        />
      ) : (
        <Handle
          key="power-in"
          id="power-in"
          type="target"
          position={getRotatedPosition(Position.Top, rotation)}
          title="Entrée d'énergie"
          style={{
            ...getHandleStyle(getRotatedPosition(Position.Top, rotation), 'rgba(168, 85, 247, 0.6)'),
            opacity: handleOpacity,
            transition: 'opacity 0.22s ease-in-out',
          }}
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
                isNominal && building.category === 'manufacturing' ? 'nf-spin-active' : '',
              ].join(' ')} />
            </span>
          )}
          <span className="font-extrabold tracking-tight text-zinc-100 text-[13px] truncate max-w-[100px]">{building?.name ?? data.buildingId}</span>
          {(data.upgradeLevel ?? 0) > 0 && (
            <span
              className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 font-mono text-[8px] font-black tracking-wider text-amber-300"
              title={`Machine améliorée : cadence ×${Math.pow(1.1, data.upgradeLevel ?? 0).toFixed(2)}`}
              data-testid="upgrade-rank"
            >
              {UPGRADE_RANK_LABEL[data.upgradeLevel ?? 0]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0 whitespace-nowrap">
          {/* Compass direction badge showing facing angle */}
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 text-[9px] font-extrabold text-zinc-400 border border-zinc-700/30 flex items-center gap-0.5 font-mono uppercase whitespace-nowrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5">
              <circle cx="12" cy="12" r="10" />
              <path d="m16.2 7.8-2 4.2-4.2 2-2 4.2 4.2-2 2-4.2 2-2Z" />
            </svg>
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
            <span
              style={{
                opacity: handleOpacity,
                transition: 'opacity 0.22s ease-in-out',
              }}
              className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-400 border border-amber-500/20 flex items-center gap-0.5 shrink-0 whitespace-nowrap"
            >
              <span>⚡</span>
              <span>{info.powerMW} MW</span>
            </span>
          )}
        </div>
      </div>

      {/* Body Content */}
      {info.configured ? (
        <div className="flex flex-col gap-1.5 relative z-10">
          {/* Télémétrie de sous-en-tête technique unique par machine */}
          <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 border-b border-zinc-900 pb-1.5 mb-1 select-none tracking-wider">
            <span>// UNIT_NODE_{id.substring(0, 4).toUpperCase()}</span>
            {building?.category === 'manufacturing' && (
              <span className="text-sky-400/85 font-bold">RECIPE_CYCLE: {info.recipe?.time ?? 0}S</span>
            )}
            {building?.category === 'power' && (
              <span className="text-emerald-400/85 font-bold">SYS_GEN // GRID_SYS</span>
            )}
          </div>
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
                        <span className="text-[8.5px] text-zinc-500">/{round(consumed)}/m</span>
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
        <div className="mt-1 flex items-center justify-center py-2 text-center font-bold uppercase tracking-wider text-[10px] text-zinc-500 bg-zinc-950/40 rounded-xl border border-zinc-900/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.4)] relative z-10">
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

    </div>
  );
}
