import { useState } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import type { Objective } from '@/solver';
import { buildGraphFromSolution } from '@/graph/buildGraphFromSolution';

const OBJECTIVES: { value: Objective; label: string }[] = [
  { value: 'raw-resources', label: 'Min. ressources brutes' },
  { value: 'machines', label: 'Min. machines' },
  { value: 'energy', label: 'Min. énergie' },
];

/**
 * Mode auto : « je veux X par minute » → le solveur pose le graphe optimal sur le canvas.
 * La puissance (objectif) reste discrète derrière le détail.
 */
export function TargetPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const targetItem = useFactoryStore((s) => s.targetItem);
  const targetRate = useFactoryStore((s) => s.targetRate);
  const objective = useFactoryStore((s) => s.objective);
  const setTargetItem = useFactoryStore((s) => s.setTargetItem);
  const setTargetRate = useFactoryStore((s) => s.setTargetRate);
  const setObjective = useFactoryStore((s) => s.setObjective);
  const setGraph = useGraphStore((s) => s.setGraph);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const producible = gameData?.items.filter((i) => !i.raw) ?? [];

  const onCompute = async () => {
    if (!gameData || !targetItem) return;
    setBusy(true);
    setError(null);
    try {
      // glpk.js (WASM) chargé à la demande : il reste hors du bundle initial.
      const { solveFactory } = await import('@/solver');
      const result = await solveFactory({ data: gameData, targetItem, targetRate, objective });
      const { nodes, edges } = buildGraphFromSolution(result, gameData);
      setGraph(nodes, edges);
    } catch (err) {
      const isSolverError = err instanceof Error && err.name === 'SolverError';
      setError(isSolverError ? (err as Error).message : `Échec du calcul : ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Je veux produire</label>
        <select
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          value={targetItem}
          onChange={(e) => setTargetItem(e.target.value)}
        >
          <option value="">— choisir un item —</option>
          {producible.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">par minute</label>
        <input
          type="number"
          min={0}
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          value={targetRate}
          onChange={(e) => setTargetRate(Number(e.target.value))}
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-400">Optimiser pour</label>
        <select
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm"
          value={objective}
          onChange={(e) => setObjective(e.target.value as Objective)}
        >
          {OBJECTIVES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        disabled={!targetItem || busy}
        onClick={onCompute}
        className="rounded-md bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-40"
      >
        {busy ? 'Calcul…' : 'Calculer'}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
