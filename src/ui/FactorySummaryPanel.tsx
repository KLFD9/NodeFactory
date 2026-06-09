import { useEffect, useMemo, useRef, useState } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { computeFactory, type ItemRate } from '@/graph/computeFactory';

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

// ── Sous-composants ───────────────────────────────────────────────────────────

interface FlowRowProps {
  flow: ItemRate;
  accumulated: number;
  color: string;
  dimColor: string;
}

function FlowRow({ flow, accumulated, color, dimColor }: FlowRowProps) {
  return (
    <li className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate text-zinc-200">{flow.itemName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono font-semibold text-[11px]" style={{ color }}>
            {flow.ratePerMin}/min
          </span>
          <span className="text-[10px] font-mono text-zinc-500 w-14 text-right tabular-nums">
            +{fmtAcc(accumulated)}
          </span>
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

// ── Panneau principal ─────────────────────────────────────────────────────────

/** Bilan global de l'usine construite sur le canvas. Affiché quand rien n'est sélectionné. */
export function FactorySummaryPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const objective = useFactoryStore((s) => s.objective);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const setGraph = useGraphStore((s) => s.setGraph);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!gameData) return null;

  const onComplete = async () => {
    setBusy(true);
    setError(null);
    try {
      const { completeFactory } = await import('@/graph/assist');
      const res = await completeFactory(nodes, edges, gameData, objective);
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

  if (nodes.length === 0) {
    return (
      <div className="text-xs text-zinc-500">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Bilan</h2>
        <p>Glisse des bâtiments depuis la palette pour construire ton usine.</p>
      </div>
    );
  }

  const summary = computeFactory(nodes, edges, gameData);

  // ── Accumulateur de production en temps réel ──────────────────────────────
  // Clé qui change uniquement si la structure du bilan change (item ou taux).
  const summaryKey = useMemo(
    () =>
      [...summary.surplus, ...summary.rawInputs, ...summary.deficits]
        .map((f) => `${f.itemId}:${f.ratePerMin}`)
        .sort()
        .join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [summary.surplus.length, summary.rawInputs.length, summary.deficits.length,
     summary.totalPowerMW, summary.totalMachines],
  );

  const accRef = useRef<Record<string, number>>({});
  const flowsRef = useRef<ItemRate[]>([]);
  flowsRef.current = [...summary.surplus, ...summary.rawInputs, ...summary.deficits];

  const [accumulated, setAccumulated] = useState<Record<string, number>>({});

  useEffect(() => {
    accRef.current = {};
    setAccumulated({});
    let lastTime = Date.now();

    const id = setInterval(() => {
      const now = Date.now();
      const dtMin = (now - lastTime) / 60_000;
      lastTime = now;
      for (const f of flowsRef.current) {
        accRef.current[f.itemId] = (accRef.current[f.itemId] ?? 0) + f.ratePerMin * dtMin;
      }
      setAccumulated({ ...accRef.current });
    }, 250);

    return () => clearInterval(id);
  }, [summaryKey]);

  // Débit total de sortie (tous les surplus + rawInputs extraits).
  const totalOutputRate = summary.surplus.reduce((s, f) => s + f.ratePerMin, 0) +
    summary.rawInputs.reduce((s, f) => s + f.ratePerMin, 0);

  return (
    <div className="flex flex-col gap-3 text-xs">
      <h2 className="text-sm font-semibold text-zinc-300">Bilan de l'usine</h2>

      {/* Métriques machine + énergie */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Machines</div>
          <div className="text-xl font-bold text-zinc-100">{summary.totalMachines}</div>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2">
          <div className="text-[10px] uppercase tracking-wide text-zinc-500">Énergie</div>
          <div className="text-xl font-bold text-zinc-100">{summary.totalPowerMW} <span className="text-sm font-normal text-zinc-400">MW</span></div>
        </div>
      </div>

      {/* Débit total — vue "clicker" */}
      {totalOutputRate > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">Débit total</span>
            <span className="font-mono font-bold text-emerald-400 text-sm">{totalOutputRate}/min</span>
          </div>
          <div
            className="nf-bilan-ticker mt-1.5"
            style={
              {
                '--nf-tick-color': '#10b981',
                '--nf-tick-speed': tickSpeed(totalOutputRate),
              } as React.CSSProperties
            }
          />
        </div>
      )}

      {/* Déficits */}
      {summary.deficits.length > 0 && (
        <div className="rounded-lg border border-red-900/60 bg-red-950/30 p-2.5">
          <div className="flex items-center gap-1.5 font-semibold text-red-300 mb-1.5">
            <span
              className="h-1.5 w-1.5 rounded-full bg-red-400"
              style={{ animation: 'nf-activity-dot 0.8s ease-in-out infinite' }}
            />
            Production manquante
          </div>
          <ul className="space-y-1.5">
            {summary.deficits.map((f) => (
              <FlowRow
                key={f.itemId}
                flow={f}
                accumulated={accumulated[f.itemId] ?? 0}
                color="#f87171"
                dimColor="#ef444466"
              />
            ))}
          </ul>
          <button
            type="button"
            onClick={onComplete}
            disabled={busy}
            className="mt-2.5 w-full rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
          >
            {busy ? 'Optimisation…' : "Compléter l'usine"}
          </button>
          {error && <p className="mt-1 text-[10px] text-red-400">{error}</p>}
        </div>
      )}

      {/* Ressources brutes consommées */}
      {summary.rawInputs.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Ressources brutes</div>
          <ul className="space-y-2">
            {summary.rawInputs.map((f) => (
              <FlowRow
                key={f.itemId}
                flow={f}
                accumulated={accumulated[f.itemId] ?? 0}
                color="#f59e0b"
                dimColor="#f59e0b55"
              />
            ))}
          </ul>
        </div>
      )}

      {/* Surplus de production */}
      {summary.surplus.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-1.5">Surplus</div>
          <ul className="space-y-2">
            {summary.surplus.map((f) => (
              <FlowRow
                key={f.itemId}
                flow={f}
                accumulated={accumulated[f.itemId] ?? 0}
                color="#10b981"
                dimColor="#10b98155"
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
