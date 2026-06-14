import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { useWorldStore } from '@/store/useWorldStore';
import { computeFactory } from '@/graph/computeFactory';
import { Palette } from './Palette';
import { ContractPanel } from './ContractPanel';
import { ContractToast } from './ContractToast';
import { GraphCanvas } from './GraphCanvas';
import { Inspector } from './Inspector';
import { FactorySummaryPanel } from './FactorySummaryPanel';
import { UnlockToast } from './UnlockToast';
import { MicroMilestoneToast } from './MicroMilestoneToast';
import { PlacementDeniedToast } from './PlacementDeniedToast';
import { OfflineRecapModal } from './OfflineRecapModal';
import { WelcomeModal } from './WelcomeModal';
import { TutorialPanel } from './TutorialPanel';
import { useProgressionTick } from './useProgressionTick';
import { ResourceBanner } from './ResourceBanner';
import { ReactFlowProvider } from '@xyflow/react';

function TargetIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  );
}

function CogIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function fmtAp(n: number): string {
  if (n < 1_000) return Math.floor(n).toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

export function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M12 2 20.66 7v10L12 22 3.34 17V7L12 2Z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

/** Icône fiole — les Points de Recherche. */
export function FlaskIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V2" />
      <path d="M8.5 2h7" />
      <path d="M7 15h10" />
    </svg>
  );
}

function AnimatedBalance({
  value,
  icon,
  colorClass,
  glowClass,
  title,
  testId,
  popoverContent,
  disablePulse,
}: {
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  glowClass: string;
  title: string;
  testId?: string;
  popoverContent?: React.ReactNode;
  disablePulse?: boolean;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const [hovered, setHovered] = useState(false);
  const valueRef = useRef({ v: value });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obj = valueRef.current;
    
    // Si la valeur augmente (earn), petit effet de boost (juice!)
    if (value > obj.v && containerRef.current && !disablePulse) {
      gsap.killTweensOf(containerRef.current);
      gsap.fromTo(
        containerRef.current,
        { scale: 1, filter: 'brightness(1)' },
        { scale: 1.15, filter: 'brightness(1.4)', duration: 0.15, yoyo: true, repeat: 1, ease: 'power1.out' }
      );
    }

    const tween = gsap.to(obj, {
      v: value,
      duration: 0.8,
      ease: 'power2.out',
      onUpdate: () => setDisplayValue(obj.v),
    });
    return () => {
      tween.kill();
    };
  }, [value, disablePulse]);

  return (
    <div
      ref={containerRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800/35 bg-zinc-950/80 shadow-md transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/60 cursor-help ${glowClass}`}
      title={title}
      data-testid={testId}
    >
      <span className={`${colorClass} flex items-center justify-center scale-110`}>
        {icon}
      </span>
      <span className={`font-mono text-[14px] font-bold tabular-nums tracking-wide ${colorClass} select-none`}>
        {fmtAp(displayValue)}
      </span>

      {/* Popover Explicatif Rétro-éclairé */}
      {hovered && popoverContent && (
        <div className="absolute top-12 right-0 z-[100] w-64 rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md animate-slide-up origin-top pointer-events-none">
          <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
          <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
          <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
          <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
          {popoverContent}
        </div>
      )}
    </div>
  );
}

/** Soldes Bolts + RP + progression vers le prochain milestone. Toujours visible. */
export function ProgressionStatus() {
  const bolts = useProgressionStore((s) => s.bolts);
  const rp = useProgressionStore((s) => s.researchPoints);

  const boltsPopover = (
    <div className="text-[11px] text-zinc-400 font-sans leading-relaxed pointer-events-none">
      <div className="flex items-center gap-1.5 font-bold text-amber-400 mb-1.5 uppercase font-mono text-[12px]">
        <BoltIcon className="h-3.5 w-3.5" /> Bolts
      </div>
      <p className="mb-2">L'argent de l'usine obtenu en complétant des <span className="text-zinc-200 font-semibold">contrats clients</span>.</p>
      <div className="border-t border-zinc-900 pt-1.5 mt-1.5">
        <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold block mb-1">Dépenses :</span>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Pose de nouveaux bâtiments</li>
          <li>Amélioration de cadence par machine</li>
        </ul>
      </div>
    </div>
  );

  const rpPopover = (
    <div className="text-[11px] text-zinc-400 font-sans leading-relaxed pointer-events-none">
      <div className="flex items-center gap-1.5 font-bold text-cyan-400 mb-1.5 uppercase font-mono text-[12px]">
        <FlaskIcon className="h-3.5 w-3.5" /> Research Points
      </div>
      <p className="mb-2">Générés passivement par la <span className="text-zinc-200 font-semibold">production globale</span> de vos machines.</p>
      <div className="border-t border-zinc-900 pt-1.5 mt-1.5">
        <span className="text-[9px] font-mono text-zinc-500 uppercase font-bold block mb-1">Dépenses :</span>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Recherches globales d'efficacité</li>
          <li>Déblocages de technologies</li>
        </ul>
      </div>
    </div>
  );

  return (
    <div className="flex items-center gap-2.5">
      <AnimatedBalance
        value={bolts}
        icon={<BoltIcon className="h-4.5 w-4.5" />}
        colorClass="text-amber-400"
        glowClass="hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
        title=""
        testId="bolts-balance"
        popoverContent={boltsPopover}
      />
      <AnimatedBalance
        value={rp}
        icon={<FlaskIcon className="h-4.5 w-4.5" />}
        colorClass="text-cyan-400"
        glowClass="hover:shadow-[0_0_12px_rgba(34,211,238,0.15)]"
        title=""
        testId="rp-balance"
        popoverContent={rpPopover}
        disablePulse={true}
      />
    </div>
  );
}

function StatusBar() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  if (!gameData || nodes.length === 0) return null;

  const summary = computeFactory(nodes, edges, gameData);
  const unconfigured = nodes.filter((n) => {
    const b = gameData.buildings.find((x) => x.id === n.data.buildingId);
    if (!b || b.category === 'logistics') return false;
    return b.category === 'extraction' ? !n.data.resourceId : !n.data.recipeId;
  }).length;

  return (
    <footer className="flex items-center gap-4 border-t border-zinc-800 px-4 py-1.5 text-xs text-zinc-400">
      <span>{summary.totalMachines} machines actives</span>
      <span>{summary.totalPowerMW} MW</span>
      {unconfigured > 0 && (
        <span className="text-amber-400">⚙ {unconfigured} à configurer</span>
      )}
      {summary.unpoweredMachines > 0 && (
        <span className="text-red-400" title="Machines sans réseau électrique alimenté : elles ne produisent rien.">
          ⚡ {summary.unpoweredMachines} hors tension
        </span>
      )}
      {summary.deficits.length > 0 && (
        <span className="text-red-400">⚠ {summary.deficits.length} déficit(s)</span>
      )}
      {summary.rawInputs.length > 0 && (
        <span>
          Brut : {summary.rawInputs.map((r) => `${r.itemName} ${r.ratePerMin}/min`).join(' · ')}
        </span>
      )}
    </footer>
  );
}

export function App() {
  const dataStatus = useFactoryStore((s) => s.dataStatus);
  const dataError = useFactoryStore((s) => s.dataError);
  const gameData = useFactoryStore((s) => s.gameData);
  const loadData = useFactoryStore((s) => s.loadData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const activeContract = useProgressionStore((s) => s.activeContract);
  type PanelType = 'milestones' | 'palette' | 'summary' | 'inspector' | null;
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Détecteur de clic extérieur pour fermer le menu de contrôle
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (menuRef.current && !menuRef.current.contains(target)) {
        // Si on a cliqué sur un node React Flow, on ne ferme pas l'inspecteur
        const isClickingNode = target.closest('.react-flow__node');
        if (!isClickingNode) {
          setActivePanel(null);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Pilote la couche jeu : gains hors-ligne au démarrage + tick de progression live.
  useProgressionTick();

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Génère la carte des gisements au premier chargement des données (idempotent : ne fait rien
  // si une carte est déjà en mémoire / persistée).
  useEffect(() => {
    if (gameData) {
      useWorldStore.getState().ensureGenerated(gameData.items.filter((i) => i.raw).map((i) => i.id));
    }
  }, [gameData]);

  // Ouvrir le panneau automatiquement quand un nœud est sélectionné
  useEffect(() => {
    if (selectedNodeId) {
      setActivePanel('inspector');
    }
  }, [selectedNodeId]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h1 className="text-sm font-semibold tracking-tight">
            Node<span className="text-amber-400">Factory</span>{' '}
            <span className="text-zinc-500">— Collecte · Entraîne · Optimise</span>
          </h1>
          <span className="text-xs text-zinc-500">
            {dataStatus === 'loading' && 'Chargement des données…'}
            {dataStatus === 'ready' && 'Données prêtes'}
            {dataStatus === 'error' && `Erreur : ${dataError}`}
          </span>
        </header>

        <div className="relative flex min-h-0 flex-1">
          {/* Bannière flottante des ressources cumulées (centrée en haut du canvas) */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 max-w-[min(90%,640px)]">
            <ResourceBanner />
          </div>

          <main className="min-w-0 flex-1">
            <GraphCanvas />
          </main>

          {/* Wrapper unique pour la barre d'outils et le panneau de contrôle sur la droite */}
          <div
            ref={menuRef}
            onMouseLeave={() => setActivePanel(null)}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-40 flex flex-row-reverse items-center pointer-events-auto"
          >
            {/* Barre d'outils flottante unifiée (4 boutons) */}
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 shadow-2xl backdrop-blur-md nf-glow-box-orange">
              {/* Coins HUD Industriels */}
              <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
              <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
              <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
              <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />

              {/* OBJ - Objectifs (Priorité 1) */}
              <button
                onClick={() => setActivePanel(activePanel === 'milestones' ? null : 'milestones')}
                onMouseEnter={() => setActivePanel('milestones')}
                className={`relative flex h-14 w-12 flex-col gap-1 items-center justify-center cursor-pointer rounded border transition-all duration-200 ${
                  activePanel === 'milestones'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                    : !activeContract
                    ? 'border-red-500 bg-red-500/5 text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.25)] animate-[pulse_1.5s_infinite_ease-in-out]'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-orange-500/50 hover:bg-zinc-900/50 hover:text-orange-300'
                }`}
                title="Objectifs de progression"
                data-testid="milestones-toggle-btn"
              >
                {activePanel === 'milestones' && (
                  <>
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
                    <div className="absolute left-[-9px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-orange-500 filter drop-shadow-[0_0_3px_rgba(249,115,22,0.5)] animate-pulse" />
                  </>
                )}
                {!activeContract && activePanel !== 'milestones' && (
                  <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
                  </span>
                )}
                <TargetIcon className="h-5 w-5" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase select-none">OBJ</span>
              </button>

              {/* COMP - Composants et Bâtiments (Priorité 2) */}
              <button
                onClick={() => setActivePanel(activePanel === 'palette' ? null : 'palette')}
                onMouseEnter={() => setActivePanel('palette')}
                className={`relative flex h-14 w-12 flex-col gap-1 items-center justify-center cursor-pointer rounded border transition-all duration-200 ${
                  activePanel === 'palette'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-orange-500/50 hover:bg-zinc-900/50 hover:text-orange-300'
                }`}
                title="Composants et Bâtiments"
                data-testid="palette-toggle-btn"
              >
                {activePanel === 'palette' && (
                  <>
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
                    <div className="absolute left-[-9px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-orange-500 filter drop-shadow-[0_0_3px_rgba(249,115,22,0.5)] animate-pulse" />
                  </>
                )}
                <GridIcon className="h-5 w-5" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase select-none">COMP</span>
              </button>

              {/* Séparateur technique horizontal */}
              <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-800/80 to-transparent my-0.5 mx-1" />

              {/* INSP - Inspecteur (Priorité 3) */}
              <button
                onClick={() => selectedNodeId && setActivePanel(activePanel === 'inspector' ? null : 'inspector')}
                onMouseEnter={() => selectedNodeId && setActivePanel('inspector')}
                disabled={!selectedNodeId}
                className={`relative flex h-14 w-12 flex-col gap-1 items-center justify-center rounded border transition-all duration-200 ${
                  !selectedNodeId
                    ? 'opacity-40 cursor-not-allowed border-zinc-900 text-zinc-700 bg-zinc-950/20'
                    : activePanel === 'inspector'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-orange-500/50 hover:bg-zinc-900/50 hover:text-orange-300'
                }`}
                title={selectedNodeId ? "Inspecter la machine sélectionnée" : "Sélectionnez une machine pour l'inspecter"}
                data-testid="inspector-toggle-btn"
              >
                {selectedNodeId && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
                )}
                {activePanel === 'inspector' && (
                  <div className="absolute left-[-9px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-orange-500 filter drop-shadow-[0_0_3px_rgba(249,115,22,0.5)] animate-pulse" />
                )}
                <CogIcon className="h-5 w-5" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase select-none">INSP</span>
              </button>

              {/* BILAN - Bilan global (Priorité 4) */}
              <button
                onClick={() => setActivePanel(activePanel === 'summary' ? null : 'summary')}
                onMouseEnter={() => setActivePanel('summary')}
                className={`relative flex h-14 w-12 flex-col gap-1 items-center justify-center cursor-pointer rounded border transition-all duration-200 ${
                  activePanel === 'summary'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-orange-500/50 hover:bg-zinc-900/50 hover:text-orange-300'
                }`}
                title="Bilan de production global"
                data-testid="summary-toggle-btn"
              >
                {activePanel === 'summary' && (
                  <>
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
                    <div className="absolute left-[-9px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[7px] border-r-orange-500 filter drop-shadow-[0_0_3px_rgba(249,115,22,0.5)] animate-pulse" />
                  </>
                )}
                <DashboardIcon className="h-5 w-5" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase select-none">BILAN</span>
              </button>
            </div>

            {/* Panneau de sélection flottant unique */}
            {activePanel && (
              <div
                className="mr-[12px] w-80 max-h-[80vh] flex flex-col rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-5 shadow-2xl backdrop-blur-xl nf-glow-box-orange animate-slide-up"
                data-testid="left-panel"
              >
                {/* Coins HUD Industriels */}
                <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
                <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
                <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
                <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />

                <div className="overflow-y-auto flex-1 pr-1">
                  {activePanel === 'palette' && <Palette />}
                  {activePanel === 'inspector' && <Inspector />}
                  {activePanel === 'summary' && <FactorySummaryPanel />}
                  {activePanel === 'milestones' && (
                    <div className="flex flex-col gap-5">
                      <ContractPanel />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <StatusBar />
        <UnlockToast />
        <MicroMilestoneToast />
        <ContractToast />
        <PlacementDeniedToast />
        <OfflineRecapModal />
        <WelcomeModal />
        <TutorialPanel />
      </div>
    </ReactFlowProvider>
  );
}
