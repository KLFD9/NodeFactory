import { useEffect, useState } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { allowedAlternateRecipeIds } from '@/game/progression';
import type { EfficiencyScore } from '@/game/balance';
import { computeFactory, type ItemRate } from '@/graph/computeFactory';
import type { Objective } from '@/solver';
import { BottleneckPanel } from './BottleneckPanel';

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
  if (p >= 0.9) return '#10b981';
  if (p >= 0.7) return '#f59e0b';
  return '#f87171';
}

const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: 'raw-resources', label: 'Min. ressources' },
  { value: 'machines', label: 'Min. machines' },
  { value: 'energy', label: 'Min. énergie' },
];

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
          {accumulated !== undefined && (
            <span className="text-[10px] font-mono text-zinc-500 w-14 text-right tabular-nums">
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
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-2.5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Efficacité</span>
        <span className="font-mono text-lg font-bold" style={{ color: scoreColor(score.global) }}>
          {pct(score.global)}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {dims.map((d) => (
          <div key={d.label} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] text-zinc-400">{d.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: pct(d.s), background: scoreColor(d.s) }}
              />
            </span>
            <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-zinc-400">
              {pct(d.s)}
            </span>
          </div>
        ))}
      </div>
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
      <div className="text-xs text-zinc-500">
        <h2 className="mb-2 text-sm font-semibold text-zinc-300">Bilan</h2>
        <p>Glisse des bâtiments depuis la palette pour construire ton usine.</p>
      </div>
    );
  }

  const summary = computeFactory(nodes, edges, gameData);

  // Débit total de sortie (surplus + bruts extraits).
  const totalOutputRate =
    summary.surplus.reduce((s, f) => s + f.ratePerMin, 0) +
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

      {/* Score d'efficacité — le méta-jeu */}
      {score ? (
        <div className="flex flex-col gap-1">
          <ScoreCard score={score} />
          {summary.deficits.length > 0 && (
            <p className="text-[10px] text-amber-400/80">
              Usine incomplète : score calculé sur les sorties actuelles.
            </p>
          )}
          <button
            type="button"
            onClick={onEvaluate}
            disabled={scoreBusy}
            className="self-start text-[10px] text-zinc-500 underline hover:text-zinc-300 disabled:opacity-40"
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
            className="w-full rounded-md border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-emerald-600/60 hover:text-emerald-300 disabled:opacity-40 transition-colors"
            title="Compare ton usine à l'optimum calculé par le solveur"
          >
            {scoreBusy ? 'Évaluation…' : '⚖ Évaluer l’efficacité'}
          </button>
          {scoreError && <p className="mt-1 text-[10px] text-amber-400">{scoreError}</p>}
        </div>
      )}

      {/* Audit des goulots (REC-04) */}
      <BottleneckPanel />

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
              <FlowRow key={f.itemId} flow={f} color="#f87171" dimColor="#ef444466" />
            ))}
          </ul>
          <select
            value={objective}
            onChange={(e) => setObjective(e.target.value as Objective)}
            className="mt-2.5 w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-200"
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
            className="mt-1.5 w-full rounded-md bg-orange-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
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
              <FlowRow key={f.itemId} flow={f} color="#f59e0b" dimColor="#f59e0b55" />
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
                accumulated={cumulativeProduced[f.itemId]}
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
