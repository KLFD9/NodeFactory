import { useEffect } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { computeFactory } from '@/graph/computeFactory';
import { Palette } from './Palette';
import { TargetPanel } from './TargetPanel';
import { GraphCanvas } from './GraphCanvas';
import { Inspector } from './Inspector';
import { FactorySummaryPanel } from './FactorySummaryPanel';

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
    </footer>
  );
}

export function App() {
  const dataStatus = useFactoryStore((s) => s.dataStatus);
  const dataError = useFactoryStore((s) => s.dataError);
  const loadData = useFactoryStore((s) => s.loadData);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);

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
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-zinc-800 p-4">
          <Palette />

          <details className="mt-6 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
            <summary className="cursor-pointer select-none font-medium text-zinc-500">
              Génération automatique
            </summary>
            <div className="mt-3">
              <TargetPanel />
            </div>
          </details>
        </aside>

        <main className="min-w-0 flex-1">
          <GraphCanvas />
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l border-zinc-800 p-4">
          {selectedNodeId ? <Inspector /> : <FactorySummaryPanel />}
        </aside>
      </div>

      <StatusBar />
    </div>
  );
}
