import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { computeFactory, type ItemRate } from '@/graph/computeFactory';

function FlowList({ flows }: { flows: ItemRate[] }) {
  return (
    <ul className="mt-1 space-y-0.5">
      {flows.map((f) => (
        <li key={f.itemId} className="flex justify-between">
          <span>{f.itemName}</span>
          <span>{f.ratePerMin}/min</span>
        </li>
      ))}
    </ul>
  );
}

/** Bilan global de l'usine construite sur le canvas. Affiché quand rien n'est sélectionné. */
export function FactorySummaryPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);

  if (!gameData) return null;

  if (nodes.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Bilan</h2>
        <p>Glisse des bâtiments depuis la palette pour construire ton usine.</p>
      </div>
    );
  }

  const summary = computeFactory(nodes, edges, gameData);

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-sm font-semibold text-zinc-300">Bilan de l'usine</h2>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-zinc-800 p-2">
          <div className="text-[11px] text-zinc-500">Machines</div>
          <div className="text-lg font-semibold">{summary.totalMachines}</div>
        </div>
        <div className="rounded-md border border-zinc-800 p-2">
          <div className="text-[11px] text-zinc-500">Énergie</div>
          <div className="text-lg font-semibold">{summary.totalPowerMW} MW</div>
        </div>
      </div>

      {summary.deficits.length > 0 && (
        <div className="rounded-md border border-red-900/60 bg-red-950/30 p-2 text-xs">
          <div className="font-medium text-red-300">⚠ Production manquante</div>
          <FlowList flows={summary.deficits} />
        </div>
      )}

      {summary.rawInputs.length > 0 && (
        <div className="text-xs">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Ressources brutes</div>
          <FlowList flows={summary.rawInputs} />
        </div>
      )}

      {summary.surplus.length > 0 && (
        <div className="text-xs">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">Surplus</div>
          <FlowList flows={summary.surplus} />
        </div>
      )}
    </div>
  );
}
