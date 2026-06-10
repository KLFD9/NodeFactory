import { useEffect } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { computeFactory } from '@/graph/computeFactory';
import { milestoneProgress, nextMilestone } from '@/game/progression';
import { Palette } from './Palette';
import { MilestonePanel } from './MilestonePanel';
import { GraphCanvas } from './GraphCanvas';
import { Inspector } from './Inspector';
import { FactorySummaryPanel } from './FactorySummaryPanel';
import { UnlockToast } from './UnlockToast';
import { useProgressionTick } from './useProgressionTick';

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
  const loadData = useFactoryStore((s) => s.loadData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

  // Pilote la couche jeu : gains hors-ligne au démarrage + tick de progression live.
  useProgressionTick();

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
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

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 p-4">
          {selectedNodeId ? <Inspector /> : <FactorySummaryPanel />}
        </aside>
      </div>

      <StatusBar />
      <UnlockToast />
    </div>
  );
}
