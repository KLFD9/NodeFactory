import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore, type MachineNode } from '@/store/useGraphStore';
import type { GameData } from '@/data/types';
import { useProgressionStore } from '@/store/useProgressionStore';
import { allowedAlternateRecipeIds } from '@/game/progression';
import type { EfficiencyScore } from '@/game/balance';
import { computeFactory, type ItemRate } from '@/graph/computeFactory';
import { computePowerNetworks, type PowerNetwork } from '@/graph/power';
import type { Objective } from '@/solver';
import { BottleneckPanel } from './BottleneckPanel';
import { computeNodeInfo } from '@/graph/nodeInfo';
import { ItemIcon } from '@/ui/assets';

// ── Icônes HUD ───────────────────────────────────────────────────────────────

export function DashboardIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  );
}

export function PowerGridIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function TelemetryIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </svg>
  );
}

export function ConveyorIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 11h10M5 15h14M3 19h18" />
      <circle cx="5" cy="7" r="1.5" />
      <circle cx="12" cy="7" r="1.5" />
      <circle cx="19" cy="7" r="1.5" />
    </svg>
  );
}

export function WarningIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

// ── Formatage ────────────────────────────────────────────────────────────────

function fmtAcc(n: number): string {
  if (n < 1_000) return Math.floor(n).toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** Durée (en s) de l'animation du ticker pour `rate` items/min. */
function tickSpeed(rate: number): string {
  return `${Math.max(0.25, Math.min(5, 60 / Math.max(rate, 0.1))).toFixed(2)}s`;
}

function scoreColor(p: number): string {
  if (p >= 0.9) return '#10b981'; // Vert
  if (p >= 0.7) return '#f59e0b'; // Ambre
  return '#ef4444'; // Rouge
}

const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: 'raw-resources', label: 'Min. ressources' },
  { value: 'machines', label: 'Min. machines' },
  { value: 'energy', label: 'Min. énergie' },
];

// ── Section Pliable Communes (Exportée pour BottleneckPanel) ──────────────────

export interface CollapsibleSectionProps {
  title: string;
  badge?: string | number;
  badgeColor?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function CollapsibleSection({
  title,
  badge,
  badgeColor,
  defaultOpen = true,
  children,
  icon,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="border border-zinc-800/80 bg-zinc-900/35 rounded-lg overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-zinc-900/60 hover:bg-zinc-900/85 text-left font-mono text-zinc-300 font-semibold border-b border-zinc-800/60 hover:text-orange-400 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {icon && <span className="text-zinc-400 shrink-0">{icon}</span>}
          <span className="text-[10px] uppercase tracking-wider truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge !== undefined && badge !== 0 && badge !== '0' && (
            <span
              className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold leading-tight"
              style={{
                backgroundColor: badgeColor ? `${badgeColor}15` : '#27272a',
                color: badgeColor || '#a1a1aa',
                border: `1px solid ${badgeColor ? `${badgeColor}30` : '#3f3f46'}`,
              }}
            >
              {badge}
            </span>
          )}
          <span
            className="text-zinc-400 text-[9px] transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
        </div>
      </button>
      {isOpen && <div className="p-3 flex flex-col gap-2.5 bg-zinc-950/20">{children}</div>}
    </div>
  );
}

// ── Sous-composants ───────────────────────────────────────────────────────────

interface FlowRowProps {
  flow: ItemRate;
  /** Total cumulé produit (depuis le store de progression). Omis = pas de compteur. */
  accumulated?: number;
  color: string;
  dimColor: string;
}

function FlowRow({ flow, accumulated, color, dimColor }: FlowRowProps) {
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          <ItemIcon itemId={flow.itemId} size={14} />
          <span className="truncate text-zinc-200 font-medium text-[11px]">{flow.itemName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-semibold text-[11px]" style={{ color }}>
            {flow.ratePerMin}/min
          </span>
          {accumulated !== undefined && (
            <span className="text-[10px] font-mono text-zinc-400 w-14 text-right tabular-nums">
              Σ {fmtAcc(accumulated)}
            </span>
          )}
        </div>
      </div>
      <div
        className="nf-bilan-ticker ml-3"
        style={
          {
            '--nf-tick-color': dimColor,
            '--nf-tick-speed': tickSpeed(flow.ratePerMin),
          } as React.CSSProperties
        }
      />
    </li>
  );
}

/** Carte du score d'efficacité (le méta-jeu : à quel point l'usine approche l'optimum LP). */
function ScoreCard({ score }: { score: EfficiencyScore }) {
  const dims = [
    { label: 'Ressources', s: score.resources.score },
    { label: 'Machines', s: score.machines.score },
    { label: 'Énergie', s: score.energy.score },
  ];
  const pct = (p: number) => `${Math.round(p * 100)}%`;
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3 shadow-inner relative overflow-hidden">
      {/* Petit badge d'angle décoratif Satisfactory-like - Déplacé pour éviter tout chevauchement */}
      <div className="absolute top-0 right-0 px-2 py-0.5 bg-orange-500/10 border-b border-l border-orange-500/20 rounded-bl text-[8px] font-extrabold text-orange-500/60 font-mono">
        SYS.OK
      </div>
      
      <div className="mb-2.5 flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">Score Global</span>
        {/* pr-14 évite le chevauchement avec le badge en haut à droite */}
        <span className="font-mono text-xl font-black tracking-tight animate-pulse pr-14" style={{ color: scoreColor(score.global) }}>
          {pct(score.global)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {dims.map((d) => (
          <div key={d.label} className="flex items-center gap-2.5">
            <span className="w-16 shrink-0 text-[10px] font-mono text-zinc-400">{d.label}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-sm bg-zinc-900 border border-zinc-800">
              <span
                className="block h-full transition-[width] duration-500 nf-segmented-bar"
                style={{
                  width: pct(d.s),
                  '--bar-color': scoreColor(d.s),
                } as React.CSSProperties}
              />
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-[10px] font-semibold tabular-nums text-zinc-300">
              {pct(d.s)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Diagnostics réseau (télémétrie sans sparklines par ressource) ──────────────

/** Une ligne « Diagnostics réseau » : production brute d'un item + sa consommation aval. */
interface NetworkFlow {
  itemId: string;
  itemName: string;
  /** Débit BRUT produit (toutes machines). */
  produced: number;
  /** Débit consommé en aval (0 si rien ne le consomme). */
  consumed: number;
}

/** Couleur selon le bilan produit/consommé : surplus (vert), déficit/brut requis (ambre), équilibré (gris). */
function netColor(produced: number, consumed: number): string {
  const net = produced - consumed;
  if (net > 0.01) return '#10b981'; // surplus
  if (net < -0.01) return '#f59e0b'; // manque (item brut à importer)
  return '#71717a'; // entièrement consommé (circuit interne équilibré)
}

/**
 * Graphique de télémétrie électrique en temps réel (oscillant avec micro-fluctuations).
 */
function PowerTelemetryChart({ genMW, demandMW }: { genMW: number; demandMW: number }) {
  const [history, setHistory] = useState<{ gen: number; demand: number }[]>([]);

  useEffect(() => {
    const initial = Array.from({ length: 30 }, () => ({
      gen: genMW,
      demand: demandMW,
    }));
    setHistory(initial);
  }, [genMW, demandMW]);

  useEffect(() => {
    const interval = setInterval(() => {
      setHistory((prev) => {
        // Micro-fluctuation organique plus marquée pour donner vie à la courbe
        const drift = Math.sin(Date.now() / 2500) * 0.035;
        const noise = (Math.random() - 0.5) * 0.012;
        const factor = demandMW > 0 ? (1 + drift + noise) : 0;
        const nextDemand = Math.max(0, demandMW * factor);
        
        return [...prev.slice(1), { gen: genMW, demand: nextDemand }];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [genMW, demandMW]);

  if (history.length < 2) return null;

  const width = 264;
  const height = 50;
  
  const maxVal = Math.max(...history.map(h => Math.max(h.gen, h.demand)), 10);
  const minVal = 0;
  const range = maxVal - minVal;

  const scaleY = (v: number) => height - ((v - minVal) / range) * (height - 6) - 3;
  const scaleX = (i: number) => (i / (history.length - 1)) * width;

  const genPoints = history.map((h, i) => `${scaleX(i).toFixed(1)},${scaleY(h.gen).toFixed(1)}`).join(' ');
  const demandPoints = history.map((h, i) => `${scaleX(i).toFixed(1)},${scaleY(h.demand).toFixed(1)}`).join(' ');

  const genArea = `${genPoints} ${width},${height} 0,${height}`;
  const demandArea = `${demandPoints} ${width},${height} 0,${height}`;

  return (
    <div className="relative rounded border border-zinc-800/60 bg-zinc-950/70 p-1.5 font-mono">
      <div className="absolute inset-0 opacity-20 pointer-events-none nf-telemetry-grid rounded overflow-hidden" />
      
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible select-none">
        <defs>
          <filter id="glow-orange" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <filter id="glow-blue" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke="#27272a" strokeWidth={0.5} strokeDasharray="2 2" />
        
        <polygon points={genArea} fill="rgba(96, 165, 250, 0.02)" />
        <polyline points={genPoints} fill="none" stroke="#60a5fa" strokeWidth={1} strokeDasharray="3 2" opacity={0.6} filter="url(#glow-blue)" />

        <polygon points={demandArea} fill="rgba(249, 115, 22, 0.05)" />
        <polyline points={demandPoints} fill="none" stroke="#f97316" strokeWidth={1.5} className="nf-telemetry-flow" filter="url(#glow-orange)" />
      </svg>
      
      <div className="flex justify-between items-center text-[7.5px] mt-1 px-1 text-zinc-400 uppercase tracking-widest">
        <span className="flex items-center gap-1">
          <span className="h-1 w-2 bg-orange-500 rounded-sm" /> Consommation
        </span>
        <span className="flex items-center gap-1">
          <span className="h-0.5 w-2 border-t border-dashed border-blue-400" /> Capacité
        </span>
      </div>
    </div>
  );
}

/**
 * Onde de tension animée simplifiée de type oscilloscope (affichée dans l'en-tête).
 */
export function PowerTelemetryWave({ powered }: { powered: boolean }) {
  const color = powered ? '#10b981' : '#ef4444';
  const stablePath = "M 0 12 Q 6 4, 12 12 T 24 12 T 48 12 T 72 12 T 96 12 T 120 12";
  const erraticPath = "M 0 12 L 4 2 L 8 22 L 12 4 L 16 20 L 20 2 L 24 12 L 28 2 L 32 22 L 36 4 L 40 20 L 44 2 L 48 12 L 52 2 L 56 22 L 60 4 L 64 20 L 68 2 L 72 12 L 76 2 L 80 22 L 84 4 L 88 20 L 92 2 L 96 12 L 100 2 L 104 22 L 108 4 L 112 20 L 116 2 L 120 12";
  
  return (
    <div className="shrink-0 relative overflow-hidden rounded border border-zinc-800 bg-zinc-950/80 nf-telemetry-grid h-[24px] w-[64px]">
      <svg width={64} height={24} viewBox="0 0 64 24" className="absolute inset-0">
        <path
          d={powered ? stablePath : erraticPath}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="nf-wave-animate"
          style={{ '--wave-speed': powered ? '1.5s' : '0.6s' } as React.CSSProperties}
        />
      </svg>
    </div>
  );
}

interface PowerNetworkCardProps {
  net: PowerNetwork;
  idx: number;
  relevantLength: number;
  nodes: MachineNode[];
  gameData: GameData;
  handleTargetNode: (nodeId: string) => void;
}

/**
 * Carte individuelle pliable pour un réseau électrique, affichant le résumé des
 * générateurs en en-tête et déroulant les détails du réseau (graphique live + machines) au clic.
 */
function PowerNetworkCard({
  net,
  idx,
  relevantLength,
  nodes,
  gameData,
  handleTargetNode,
}: PowerNetworkCardProps) {
  const [isOpen, setIsOpen] = useState(net.nodeIds.length === 1 && net.totalGenMW === 0);
  const color = net.powered ? '#10b981' : '#ef4444';
  const pct = net.totalGenMW > 0 ? Math.min(1, net.totalDemandMW / net.totalGenMW) : 1;

  // Calculer le résumé textuel des générateurs (ex: "x2 Coal Generator")
  const generators: Record<string, number> = {};
  for (const id of net.nodeIds) {
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    const building = gameData.buildings.find((b) => b.id === node.data.buildingId);
    if (building && building.category === 'power') {
      generators[building.name] = (generators[building.name] ?? 0) + (node.data.count ?? 1);
    }
  }
  const genStrings = Object.entries(generators).map(([name, qty]) => `x${qty} ${name}`);
  const genSummary = genStrings.length > 0 ? genStrings.join(', ') : 'Aucun générateur';

  return (
    <div className="flex flex-col rounded bg-zinc-950/20 border border-zinc-800/50 overflow-hidden transition-all duration-200">
      {/* En-tête + Graphique cliquables */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            setIsOpen(!isOpen);
            e.preventDefault();
          }
        }}
        className="w-full flex flex-col gap-2.5 p-2.5 hover:bg-zinc-900/10 transition-colors text-left select-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-orange-500/50"
      >
        <div className="flex items-center justify-between gap-2">
          {/* Nom du réseau et statut */}
          <span className="flex items-center gap-1.5 text-[10px] font-semibold text-zinc-200 font-mono">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{
                background: color,
                animation: net.powered ? undefined : 'nf-activity-dot 0.8s ease-in-out infinite',
              }}
            />
            RÉSEAU ÉLECTRIQUE {relevantLength > 1 ? `#${idx + 1}` : ''}
            {net.nodeIds.length === 1 && net.totalGenMW === 0 && (
              <span className="text-[8.5px] text-red-400 font-normal ml-1">non câblé</span>
            )}
          </span>
          {/* MW Totaux */}
          <span className="font-mono text-[9.5px] tabular-nums text-zinc-300">
            <span style={{ color }} className="font-bold">{net.totalDemandMW}</span>
            <span className="text-zinc-400"> / {net.totalGenMW} MW</span>
          </span>
        </div>

        {/* Info générateurs & Icône d'ouverture */}
        <div className="flex items-center justify-between gap-2 text-[8.5px] font-mono text-zinc-300">
          <span className="truncate flex-1 max-w-[210px] font-medium" title={genSummary}>{genSummary}</span>
          <span className="text-zinc-400 font-bold shrink-0">{isOpen ? '▼' : '▶'}</span>
        </div>

        {/* Barre LED segments de consommation */}
        <div className="w-full">
          <span className="h-1.5 w-full block overflow-hidden rounded-sm bg-zinc-900 border border-zinc-800/50">
            <span
              className="block h-full transition-[width] duration-500 nf-segmented-bar"
              style={{
                width: `${Math.round(pct * 100)}%`,
                '--bar-color': color,
              } as React.CSSProperties}
            />
          </span>
        </div>
      </div>

      {/* Accordéon déroulé : Bâtiments Connectés */}
      {isOpen && (
        <div className="px-2.5 pb-2.5 pt-1.5 border-t border-zinc-800/20 bg-zinc-950/45 flex flex-col gap-2 font-mono text-[10px]">
          <div className="flex flex-col gap-1">
            <div className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider mb-0.5">Bâtiments Connectés</div>
            <ul className="flex flex-col gap-1.5">
              {net.nodeIds.map((id) => {
                const node = nodes.find((n) => n.id === id);
                if (!node) return null;
                const building = gameData.buildings.find((b) => b.id === node.data.buildingId);
                if (!building) return null;
                const count = Math.max(1, node.data.count ?? 1);
                const isGen = building.category === 'power';
                const pwr = building.powerMW * count;

                return (
                  <li key={id} className="flex items-center justify-between gap-1.5 hover:bg-zinc-900/35 px-1.5 py-0.5 rounded transition-colors text-zinc-300">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTargetNode(id);
                      }}
                      className="flex items-center gap-1 hover:text-orange-400 cursor-pointer text-left truncate font-semibold focus-visible:outline-2 focus-visible:outline-[#c4956a]"
                      title="Cliquer pour cibler cette machine et zoomer"
                    >
                      <span className={isGen ? 'text-emerald-500/80' : 'text-zinc-400/60'}>⚡</span>
                      <span className="truncate">{building.name}{count > 1 ? ` (×${count})` : ''}</span>
                      <span className="text-[8px] text-zinc-400 font-normal ml-0.5">#{id}</span>
                    </button>
                    <div className="border-b border-dotted border-zinc-800/80 flex-1 min-w-[8px] mx-1 h-2" />
                    <span className={`font-bold shrink-0 ${isGen ? 'text-emerald-400' : 'text-zinc-300'}`}>
                      {isGen ? '+' : '-'}{pwr} MW
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Carte « Diagnostics réseau » : pour chaque ressource du réseau, le débit RÉEL produit
 * ainsi que ce qui en est consommé en aval, alignés proprement dans un tableau HUD.
 * Le clic permet de dérouler la liste détaillée des machines associées avec ciblage et zoom.
 */
function NetworkDiagnosticsPanel({
  flows,
  cumulativeProduced,
  totalOutputRate,
}: {
  flows: NetworkFlow[];
  cumulativeProduced: Record<string, number>;
  totalOutputRate: number;
}) {
  const nodes = useGraphStore((s) => s.nodes);
  const gameData = useFactoryStore((s) => s.gameData);
  const selectNode = useGraphStore((s) => s.selectNode);
  const nodeCumulativeProduced = useProgressionStore((s) => s.nodeCumulativeProduced);
  const reactFlow = useReactFlow();
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const handleTargetNode = (nodeId: string) => {
    selectNode(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      reactFlow.setCenter(node.position.x + 60, node.position.y + 40, { zoom: 1.5, duration: 400 });
    }
  };

  if (flows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      {totalOutputRate > 0 && (
        <div className="mb-1.5 p-2.5 rounded bg-zinc-950/45 border border-zinc-800/80 font-mono">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-wider text-zinc-400">Débit Total Sorties</span>
            <span className="font-bold text-emerald-400 text-xs">{totalOutputRate}</span>
          </div>
          <div
            className="nf-bilan-ticker"
            style={
              {
                '--nf-tick-color': '#10b981',
                '--nf-tick-speed': tickSpeed(totalOutputRate),
              } as React.CSSProperties
            }
          />
        </div>
      )}

      {/* En-tête des colonnes du tableau */}
      <div className="grid grid-cols-[1fr_55px_60px] gap-x-2 px-2.5 mb-1 text-[8px] font-mono uppercase tracking-wider text-zinc-400">
        <span>Ressource</span>
        <span className="text-right">Débit</span>
        <span className="text-right">Total</span>
      </div>
      
      <ul className="flex flex-col gap-1.5">
        {flows.map((f) => {
          const color = netColor(f.produced, f.consumed);
          const accumulated = cumulativeProduced[f.itemId];
          const isExpanded = expandedItemId === f.itemId;

          // Extraire les producteurs/consommateurs pour cette ressource
          const producers: { nodeId: string; label: string; rate: number; total: number }[] = [];
          const consumers: { nodeId: string; label: string; rate: number }[] = [];

          if (gameData) {
            for (const node of nodes) {
              const info = computeNodeInfo(node.data, gameData);
              if (!info.building || info.building.category === 'logistics' || !info.configured) continue;
              const count = Math.max(1, node.data.count ?? 1);

              const outMatch = info.outputs.find((o) => o.itemId === f.itemId);
              if (outMatch) {
                producers.push({
                  nodeId: node.id,
                  label: info.building.name,
                  rate: outMatch.ratePerMin * count,
                  total: nodeCumulativeProduced?.[node.id]?.[f.itemId] ?? 0,
                });
              }

              const inMatch = info.inputs.find((i) => i.itemId === f.itemId);
              if (inMatch) {
                consumers.push({
                  nodeId: node.id,
                  label: info.building.name,
                  rate: inMatch.ratePerMin * count,
                });
              }
            }
          }

          return (
            <li
              key={f.itemId}
              className="flex flex-col rounded bg-zinc-950/20 border border-zinc-800/50 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => setExpandedItemId(isExpanded ? null : f.itemId)}
                className="w-full grid grid-cols-[1fr_55px_60px] items-center gap-x-2 px-2.5 py-1.5 hover:bg-zinc-900/10 transition-colors text-left font-mono select-none cursor-pointer"
              >
                {/* Nom du produit */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                  <ItemIcon itemId={f.itemId} size={14} />
                  <span className="truncate text-zinc-200 font-semibold text-[11px] tracking-tight">{f.itemName}</span>
                  <span className="text-zinc-400 text-[8px] font-bold shrink-0">{isExpanded ? '▼' : '▶'}</span>
                </div>
                
                {/* Valeurs : Débit instantané */}
                <div className="font-mono text-[11px] font-bold text-zinc-100 text-right whitespace-nowrap">
                  {f.produced}
                  {f.consumed > 0 && <span className="text-zinc-400 font-normal">/{f.consumed}</span>}
                </div>

                {/* Cumul */}
                <div className="font-mono text-[10px] text-zinc-400 font-semibold text-right tabular-nums">
                  {accumulated !== undefined && accumulated > 0.1 ? `Σ ${fmtAcc(accumulated)}` : '—'}
                </div>
              </button>

              {isExpanded && (producers.length > 0 || consumers.length > 0) && (
                <div className="px-2.5 pb-2.5 pt-1.5 border-t border-zinc-800/20 bg-zinc-950/45 flex flex-col gap-2 font-mono text-[10px]">
                  {producers.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <div className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider mb-0.5">Producteurs</div>
                      <ul className="flex flex-col gap-1">
                        {producers.map((p) => (
                          <li key={p.nodeId} className="flex items-center justify-between gap-1.5 hover:bg-zinc-900/35 px-1.5 py-0.5 rounded transition-colors text-zinc-300">
                            <button
                              type="button"
                              onClick={() => handleTargetNode(p.nodeId)}
                              className="flex items-center gap-1 hover:text-orange-400 cursor-pointer text-left truncate font-semibold focus-visible:outline-2 focus-visible:outline-[#c4956a]"
                              title="Cliquer pour cibler cette machine et zoomer"
                            >
                              <span className="text-orange-500/70">⚙</span>
                              <span className="truncate">{p.label}</span>
                              <span className="text-[8px] text-zinc-400 font-normal ml-0.5">#{p.nodeId}</span>
                            </button>
                            <div className="border-b border-dotted border-zinc-800/80 flex-1 min-w-[8px] mx-1 h-2" />
                            <div className="flex items-center gap-2 text-right shrink-0">
                              <span className="text-zinc-300 font-bold">{p.rate}/m</span>
                              {p.total > 0.1 ? (
                                <span className="text-[9px] text-orange-400/80 tabular-nums min-w-[40px] text-right font-medium">
                                  Σ {fmtAcc(p.total)}
                                </span>
                              ) : (
                                <span className="text-[9px] text-zinc-400 tabular-nums min-w-[40px] text-right">—</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {consumers.length > 0 && (
                    <div className={`flex flex-col gap-1 ${producers.length > 0 ? 'mt-1 border-t border-zinc-800/20 pt-1.5' : ''}`}>
                      <div className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider mb-0.5">Consommateurs</div>
                      <ul className="flex flex-col gap-1">
                        {consumers.map((c) => (
                          <li key={c.nodeId} className="flex items-center justify-between gap-1.5 hover:bg-zinc-900/35 px-1.5 py-0.5 rounded transition-colors text-zinc-300">
                            <button
                              type="button"
                              onClick={() => handleTargetNode(c.nodeId)}
                              className="flex items-center gap-1 hover:text-orange-400 cursor-pointer text-left truncate font-semibold focus-visible:outline-2 focus-visible:outline-[#c4956a]"
                              title="Cliquer pour cibler cette machine et zoomer"
                            >
                              <span className="text-zinc-400/60">⚙</span>
                              <span className="truncate">{c.label}</span>
                              <span className="text-[8px] text-zinc-400 font-normal ml-0.5">#{c.nodeId}</span>
                            </button>
                            <div className="border-b border-dotted border-zinc-800/80 flex-1 min-w-[8px] mx-1 h-2" />
                            <div className="text-right shrink-0">
                              <span className="text-zinc-300 font-bold">{c.rate}/m</span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Carte globale des réseaux électriques : gère le rendu de chaque carte réseau pliable
 * avec les alertes de sous-alimentation.
 */
function PowerNetworksPanel({ networks }: { networks: PowerNetwork[] }) {
  const nodes = useGraphStore((s) => s.nodes);
  const gameData = useFactoryStore((s) => s.gameData);
  const reactFlow = useReactFlow();
  const selectNode = useGraphStore((s) => s.selectNode);

  const handleTargetNode = (nodeId: string) => {
    selectNode(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      reactFlow.setCenter(node.position.x + 60, node.position.y + 40, { zoom: 1.5, duration: 400 });
    }
  };

  const relevant = networks.filter((n) => n.totalGenMW > 0 || n.totalDemandMW > 0);
  if (relevant.length === 0) return null;
  if (!gameData) return null;

  const anyDeficit = relevant.some((n) => !n.powered);

  // Sommes cumulées globales pour l'oscilloscope global
  const globalGenMW = relevant.reduce((sum, n) => sum + n.totalGenMW, 0);
  const globalDemandMW = relevant.reduce((sum, n) => sum + n.totalDemandMW, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Télémétrie de charge électrique globale */}
      <div className="flex flex-col gap-1 font-mono">
        <div className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider mb-0.5">Télémétrie Énergétique Globale</div>
        <PowerTelemetryChart genMW={globalGenMW} demandMW={globalDemandMW} />
      </div>

      {/* Liste des sous-réseaux compacts */}
      <div className="flex flex-col gap-1.5">
        <div className="text-zinc-400 uppercase text-[8px] font-bold tracking-wider mb-0.5">Réseaux Actifs</div>
        <div className="flex flex-col gap-2">
          {relevant.map((net, idx) => (
            <PowerNetworkCard
              key={net.id}
              net={net}
              idx={idx}
              relevantLength={relevant.length}
              nodes={nodes}
              gameData={gameData}
              handleTargetNode={handleTargetNode}
            />
          ))}
        </div>
      </div>

      {anyDeficit && (
        <p className="text-[10px] text-red-400 leading-tight font-mono">
          ⚠ RÉSEAU SOUS-ALIMENTÉ : Certaines machines sont à l'arrêt.
        </p>
      )}
    </div>
  );
}


// ── Panneau principal ─────────────────────────────────────────────────────────

/** Bilan global de l'usine construite sur le canvas. Affiché quand rien n'est sélectionné. */
export function FactorySummaryPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const objective = useFactoryStore((s) => s.objective);
  const setObjective = useFactoryStore((s) => s.setObjective);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const setGraph = useGraphStore((s) => s.setGraph);
  // Production cumulée PERSISTANTE (ne se réinitialise jamais, même en changeant de panneau).
  const cumulativeProduced = useProgressionStore((s) => s.cumulativeProduced);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<EfficiencyScore | null>(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const [scoreError, setScoreError] = useState<string | null>(null);

  // Le score se périme dès que le graphe change : on le vide.
  useEffect(() => {
    setScore(null);
    setScoreError(null);
  }, [nodes, edges]);

  const onComplete = async () => {
    if (!gameData) return;
    setBusy(true);
    setError(null);
    try {
      const { completeFactory } = await import('@/graph/assist');
      const allowedAlternates = allowedAlternateRecipeIds(
        useProgressionStore.getState(),
        gameData.recipes,
      );
      const res = await completeFactory(nodes, edges, gameData, objective, allowedAlternates);
      if (!res) return;
      const { layoutGraph } = await import('@/graph/layout');
      const laidOut = await layoutGraph(res.nodes, res.edges);
      setGraph(laidOut, res.edges);
    } catch (err) {
      setError(`Échec : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const onEvaluate = async () => {
    if (!gameData) return;
    setScoreBusy(true);
    setScoreError(null);
    try {
      const { evaluateEfficiency } = await import('@/game/score');
      const allowedAlternates = allowedAlternateRecipeIds(
        useProgressionStore.getState(),
        gameData.recipes,
      );
      const res = await evaluateEfficiency(nodes, edges, gameData, allowedAlternates);
      if (!res) setScoreError('Aucune sortie finale à évaluer.');
      setScore(res);
    } catch (err) {
      setScoreError(`Échec : ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setScoreBusy(false);
    }
  };

  if (!gameData) return null;

  if (nodes.length === 0) {
    return (
      <div className="text-xs text-zinc-400">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Bilan</h2>
        <p>Glisse des bâtiments depuis la palette pour construire ton usine.</p>
      </div>
    );
  }

  const summary = computeFactory(nodes, edges, gameData);
  const { networks: powerNetworks } = computePowerNetworks(nodes, edges, gameData);

  // Débit total de sortie (surplus + bruts extraits).
  const totalOutputRate =
    summary.surplus.reduce((s, f) => s + f.ratePerMin, 0) +
    summary.rawInputs.reduce((s, f) => s + f.ratePerMin, 0);

  // Diagnostics réseau : production BRUTE par item (toutes machines confondues) +
  // consommation aval correspondante — reflète la production réelle, pas seulement
  // le surplus (qui est déjà détaillé plus bas dans son propre panneau).
  const consumedById = new Map(summary.consumption.map((f) => [f.itemId, f.ratePerMin]));
  const networkFlows: NetworkFlow[] = summary.production.map((f) => ({
    itemId: f.itemId,
    itemName: f.itemName,
    produced: f.ratePerMin,
    consumed: consumedById.get(f.itemId) ?? 0,
  }));

  const powerGridCount = powerNetworks.filter((n) => n.totalGenMW > 0 || n.totalDemandMW > 0).length;

  return (
    <div className="flex flex-col gap-3 text-xs pb-10">
      
      {/* SECTION 1: TABLEAU DE BORD (Machines, Énergie, Score d'Efficacité) */}
      <CollapsibleSection
        title="Moniteur Système"
        defaultOpen={true}
        icon={<DashboardIcon />}
      >
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-zinc-800 bg-zinc-950/45 p-2 font-mono">
            <div className="text-[9px] uppercase tracking-wider text-zinc-400">Machines</div>
            <div className="text-lg font-black text-zinc-100">{summary.totalMachines}</div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/45 p-2 font-mono">
            <div className="text-[9px] uppercase tracking-wider text-zinc-400">Énergie</div>
            <div className="text-lg font-black text-zinc-100">
              {summary.totalPowerMW} <span className="text-[9px] font-normal text-zinc-400">MW</span>
            </div>
          </div>
        </div>

        {score ? (
          <div className="flex flex-col gap-1">
            <ScoreCard score={score} />
            {summary.deficits.length > 0 && (
              <p className="text-[9px] text-amber-500/70 font-mono">
                * Usine incomplète : score basé sur la prod actuelle.
              </p>
            )}
            <button
              type="button"
              onClick={onEvaluate}
              disabled={scoreBusy}
              className="self-start text-[10px] text-zinc-400 underline hover:text-orange-500 disabled:opacity-40 cursor-pointer"
            >
              {scoreBusy ? 'Calcul…' : 'Recalculer'}
            </button>
          </div>
        ) : (
          <div>
            <button
              type="button"
              onClick={onEvaluate}
              disabled={scoreBusy}
              className="w-full rounded border border-zinc-700 bg-zinc-900/40 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:border-emerald-600/60 hover:text-emerald-400 hover:bg-emerald-950/10 disabled:opacity-40 transition-colors cursor-pointer"
              title="Comparer ton usine à l'optimum LP"
            >
              {scoreBusy ? 'Évaluation…' : '⚖ Évaluer l’efficacité'}
            </button>
            {scoreError && <p className="mt-1 text-[9px] text-amber-400 font-mono">{scoreError}</p>}
          </div>
        )}
      </CollapsibleSection>

      {/* SECTION 2: RÉSEAU ÉLECTRIQUE */}
      {powerGridCount > 0 && (
        <CollapsibleSection
          title={`Réseaux Électriques (${powerNetworks.reduce((s, n) => s + (n.totalGenMW - n.totalDemandMW), 0) >= 0 ? '+' : ''}${(Math.round(powerNetworks.reduce((s, n) => s + (n.totalGenMW - n.totalDemandMW), 0) * 10) / 10)} MW)`}
          badge={powerGridCount}
          badgeColor={powerNetworks.some((n) => !n.powered) ? '#ef4444' : '#10b981'}
          defaultOpen={powerNetworks.some((n) => !n.powered)}
          icon={<PowerGridIcon />}
        >
          <PowerNetworksPanel networks={powerNetworks} />
        </CollapsibleSection>
      )}

      {/* SECTION 3: BOTTLENECKS (Audit des goulots) */}
      <BottleneckPanel />

      {/* SECTION 4: TELEMETRY (Diagnostics réseau + Surplus) */}
      {networkFlows.length > 0 && (
        <CollapsibleSection
          title="Diagnostics Production (u/m)"
          badge={networkFlows.length}
          defaultOpen={true}
          icon={<TelemetryIcon />}
        >
          <NetworkDiagnosticsPanel
            flows={networkFlows}
            cumulativeProduced={cumulativeProduced}
            totalOutputRate={totalOutputRate}
          />
        </CollapsibleSection>
      )}

      {/* SECTION 5: DÉFICITS ET ASSISTANCE */}
      {summary.deficits.length > 0 && (
        <div className="border border-red-900/50 bg-red-950/15 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-red-950/25 border-b border-red-900/40">
            <span className="flex items-center gap-1.5 font-mono font-bold text-red-400 text-[10px] uppercase tracking-wider">
              <span
                className="h-1.5 w-1.5 rounded-full bg-red-500"
                style={{ animation: 'nf-activity-dot 0.8s ease-in-out infinite' }}
              />
              Déficits de production
            </span>
            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono font-bold leading-tight bg-red-950/30 text-red-400 border border-red-900/40">
              {summary.deficits.length}
            </span>
          </div>
          <div className="p-3 flex flex-col gap-2.5">
            <ul className="space-y-2.5">
              {summary.deficits.map((f) => (
                <FlowRow key={f.itemId} flow={f} color="#ef4444" dimColor="#ef444466" />
              ))}
            </ul>
            <div className="mt-1 border-t border-red-900/20 pt-2 flex flex-col gap-1.5">
              <select
                value={objective}
                onChange={(e) => setObjective(e.target.value as Objective)}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] text-zinc-300 font-mono focus:border-orange-500/50 outline-none"
                title="Critère d'optimisation de l'assistance"
              >
                {OBJECTIVES.map((o) => (
                  <option key={o.value} value={o.value}>
                    Optimiser : {o.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={onComplete}
                disabled={busy}
                className="w-full rounded bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-500 disabled:opacity-40 transition-colors cursor-pointer shadow-md shadow-orange-600/10"
              >
                {busy ? 'Optimisation…' : "Compléter l'usine"}
              </button>
              {error && <p className="text-[9px] text-red-400 font-mono leading-tight">{error}</p>}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: RESSOURCES BRUTES */}
      {summary.rawInputs.length > 0 && (
        <CollapsibleSection
          title="Ressources Brutes"
          badge={summary.rawInputs.length}
          badgeColor="#f59e0b"
          defaultOpen={false}
          icon={<ConveyorIcon />}
        >
          <ul className="space-y-2.5">
            {summary.rawInputs.map((f) => (
              <FlowRow key={f.itemId} flow={f} color="#f59e0b" dimColor="#f59e0b55" />
            ))}
          </ul>
        </CollapsibleSection>
      )}

    </div>
  );
}

