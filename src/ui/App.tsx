import { useEffect, useState } from 'react';
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
import { useProgressionTick } from './useProgressionTick';
import { ReactFlowProvider } from '@xyflow/react';

function fmtAp(n: number): string {
  if (n < 1_000) return Math.floor(n).toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

/** Solde d'AP + progression vers le prochain milestone. Toujours visible. */
function ProgressionStatus() {
  const ap = useProgressionStore((s) => s.automationPoints);
  // S'abonne au cumul pour recalculer la barre du prochain milestone à chaque tick.
  const progression = useProgressionStore((s) => s);
  const next = nextMilestone(progression);

  return (
    <div className="ml-auto flex items-center gap-3">
      <span className="font-mono text-amber-400" title="Automation Points">
        ⚡ {fmtAp(ap)} AP
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
  return (
    <footer className="flex items-center gap-4 border-t border-zinc-800 px-4 py-1.5 text-xs text-zinc-400">
      <span>{summary.totalMachines} machines</span>
      <span>{summary.totalPowerMW} MW</span>
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
            NodeFactory <span className="text-zinc-500">— Satisfactory Planner</span>
          </h1>
          <span className="text-xs text-zinc-500">
            {dataStatus === 'loading' && 'Chargement des données…'}
            {dataStatus === 'ready' && 'Données prêtes'}
            {dataStatus === 'error' && `Erreur : ${dataError}`}
          </span>
        </header>

        <div className="flex min-h-0 flex-1">
          <aside className="flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-r border-zinc-800 p-4">
            <MilestonePanel />
            <div className="border-t border-zinc-800 pt-4">
              <Palette />
            </div>
          </aside>

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
      </div>
    </ReactFlowProvider>
  );
}
