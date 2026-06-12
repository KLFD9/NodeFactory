import { useEffect, useRef, useState } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { useWorldStore } from '@/store/useWorldStore';
import { computeFactory } from '@/graph/computeFactory';
import { milestoneProgress, nextMilestone } from '@/game/progression';
import { Palette } from './Palette';
import { MilestonePanel } from './MilestonePanel';
import { GraphCanvas } from './GraphCanvas';
import { Inspector } from './Inspector';
import { FactorySummaryPanel } from './FactorySummaryPanel';
import { UnlockToast } from './UnlockToast';
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

function fmtAp(n: number): string {
  if (n < 1_000) return Math.floor(n).toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** Icône boulon hexagonal — la monnaie Bolts. */
function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M12 2 20.66 7v10L12 22 3.34 17V7L12 2Z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

/** Icône fiole — les Points de Recherche. */
function FlaskIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M10 2v6.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 8.5V2" />
      <path d="M8.5 2h7" />
      <path d="M7 15h10" />
    </svg>
  );
}

/** Soldes Bolts + RP + progression vers le prochain milestone. Toujours visible. */
function ProgressionStatus() {
  const bolts = useProgressionStore((s) => s.bolts);
  const rp = useProgressionStore((s) => s.researchPoints);
  // S'abonne au cumul pour recalculer la barre du prochain milestone à chaque tick.
  const progression = useProgressionStore((s) => s);
  const next = nextMilestone(progression);

  return (
    <div className="ml-auto flex items-center gap-3">
      <span
        className="flex items-center gap-1 font-mono text-amber-400"
        title="Bolts — l'argent de l'usine (contrats) : pose et améliorations"
        data-testid="bolts-balance"
      >
        <BoltIcon className="h-3 w-3" /> {fmtAp(bolts)}
      </span>
      <span
        className="flex items-center gap-1 font-mono text-cyan-400"
        title="Points de Recherche — dérivés de la production : arbre de connaissances"
        data-testid="rp-balance"
      >
        <FlaskIcon className="h-3 w-3" /> {fmtAp(rp)}
      </span>
      {next && (
        <span className="flex items-center gap-1.5 text-zinc-400" title={`Prochain palier : ${next.target} ${next.itemId}`}>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-zinc-800">
            <span
              className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500"
              style={{ width: `${Math.round(milestoneProgress(progression, next) * 100)}%` }}
            />
          </span>
          <span className="text-[10px] tabular-nums">
            {Math.floor(progression.cumulativeProduced[next.itemId] ?? 0)}/{next.target}
          </span>
        </span>
      )}
    </div>
  );
}

function StatusBar() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  if (!gameData || nodes.length === 0) return null;

  const summary = computeFactory(nodes, edges, gameData);
  // Machines posées mais sans recette/gisement : invisibles dans totalMachines (qui ne
  // compte que les actives) → badge dédié, sinon « 0 machines » avec des nodes posés.
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
      <ProgressionStatus />
    </footer>
  );
}

export function App() {
  const dataStatus = useFactoryStore((s) => s.dataStatus);
  const dataError = useFactoryStore((s) => s.dataError);
  const gameData = useFactoryStore((s) => s.gameData);
  const loadData = useFactoryStore((s) => s.loadData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [leftPanel, setLeftPanel] = useState<'milestones' | 'palette' | null>(null);
  const leftMenuRef = useRef<HTMLDivElement>(null);

  // Détecteur de clic extérieur pour fermer le menu de gauche
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (leftMenuRef.current && !leftMenuRef.current.contains(e.target as Node)) {
        setLeftPanel(null);
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
      setIsRightPanelOpen(true);
    }
  }, [selectedNodeId]);

  return (
    <ReactFlowProvider>
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h1 className="text-sm font-semibold tracking-tight">
            Node<span className="text-amber-400">Factory</span>{' '}
            <span className="text-zinc-500">— Construis · Automatise · Optimise</span>
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

          {/* Wrapper pour gérer le hover (Toolbar + Panneau) */}
          <div
            ref={leftMenuRef}
            onMouseLeave={() => setLeftPanel(null)}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-40 flex items-center pointer-events-auto"
          >
            {/* Barre d'outils flottante (Left Toolbar) */}
            <div className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 p-2 shadow-2xl backdrop-blur-md nf-glow-box-orange">
              {/* Coins HUD Industriels */}
              <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
              <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
              <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
              <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />

              <button
                onClick={() => setLeftPanel(leftPanel === 'milestones' ? null : 'milestones')}
                onMouseEnter={() => setLeftPanel('milestones')}
                className={`relative flex h-14 w-12 flex-col gap-1 items-center justify-center cursor-pointer rounded border transition-all duration-200 ${
                  leftPanel === 'milestones'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
                title="Objectifs de progression"
                data-testid="milestones-toggle-btn"
              >
                {leftPanel === 'milestones' && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
                )}
                <TargetIcon className="h-5 w-5" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase select-none">OBJ</span>
              </button>

              <button
                onClick={() => setLeftPanel(leftPanel === 'palette' ? null : 'palette')}
                onMouseEnter={() => setLeftPanel('palette')}
                className={`relative flex h-14 w-12 flex-col gap-1 items-center justify-center cursor-pointer rounded border transition-all duration-200 ${
                  leftPanel === 'palette'
                    ? 'border-orange-500 bg-orange-500/10 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.25)]'
                    : 'border-zinc-800 bg-zinc-900/30 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
                }`}
                title="Composants et Bâtiments"
                data-testid="palette-toggle-btn"
              >
                {leftPanel === 'palette' && (
                  <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.8)] animate-pulse" />
                )}
                <GridIcon className="h-5 w-5" />
                <span className="text-[7.5px] font-mono font-bold tracking-wider uppercase select-none">COMP</span>
              </button>
            </div>

            {/* Panneau de sélection flottant */}
            {leftPanel && (
              <div
                className="ml-[12px] w-80 max-h-[80vh] flex flex-col rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-5 shadow-2xl backdrop-blur-xl nf-glow-box-orange animate-slide-up"
                data-testid="left-panel"
              >
                {/* Coins HUD Industriels */}
                <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
                <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
                <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
                <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />

                <div className="overflow-y-auto flex-1 pr-1">
                  {leftPanel === 'milestones' ? <MilestonePanel /> : <Palette />}
                </div>
              </div>
            )}
          </div>

          <main className="min-w-0 flex-1">
            <GraphCanvas />
          </main>

          <aside
            className={`relative shrink-0 bg-zinc-950 border-l transition-all duration-300 z-30 ${
              isRightPanelOpen ? 'w-80 border-zinc-800' : 'w-0 border-transparent'
            }`}
          >
            {/* Onglet rétractable FICSIT style - Agrandi et contrasté pour accessibilité */}
            <button
              onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
              className={`absolute top-1/2 -translate-y-1/2 z-40 flex h-36 w-8 flex-col items-center justify-center rounded-l-lg border-y border-l transition-all cursor-pointer shadow-md select-none ${
                isRightPanelOpen
                  ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-orange-400 hover:bg-zinc-800/90'
                  : 'border-orange-500 bg-orange-600 text-white hover:bg-orange-500 hover:scale-105 shadow-lg shadow-orange-500/25'
              }`}
              style={{ left: '-32px' }}
              title={isRightPanelOpen ? "Masquer le volet" : "Afficher le volet"}
            >
              <span className="text-sm font-black mb-2 leading-none">{isRightPanelOpen ? '▶' : '◀'}</span>
              <span className="text-[9px] font-black tracking-widest vertical-text leading-none">
                {selectedNodeId ? 'INSPECTEUR' : 'BILAN USINE'}
              </span>
            </button>

            {/* Container masquant les éléments durant la transition de largeur */}
            <div className="h-full w-full overflow-hidden">
              <div className={`h-full w-80 overflow-y-auto p-4 transition-opacity duration-200 ${
                isRightPanelOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}>
                {selectedNodeId ? <Inspector /> : <FactorySummaryPanel />}
              </div>
            </div>
          </aside>
        </div>

        <StatusBar />
        <UnlockToast />
        <PlacementDeniedToast />
        <OfflineRecapModal />
        <WelcomeModal />
        <TutorialPanel />
      </div>
    </ReactFlowProvider>
  );
}
