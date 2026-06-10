import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import {
  buildNodeFlowMap,
  computeMachineStatus,
  type MachineState,
} from '@/graph/machineStatus';
import { computeNodeInfo } from '@/graph/nodeInfo';

const STATE_META: Record<
  Exclude<MachineState, 'nominal'>,
  { label: string; color: string; bg: string; border: string }
> = {
  blocked: { label: 'En attente', color: '#f87171', bg: 'bg-red-950/30', border: 'border-red-900/50' },
  starved: { label: 'Sous-alim.', color: '#fbbf24', bg: 'bg-amber-950/20', border: 'border-amber-900/40' },
};

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * Panneau d'audit des goulots (REC-04, 2e moitié).
 *
 * Liste les machines qui ne tournent pas à plein régime — « en attente » (aucune matière) ou
 * « sous-alimentées » — avec leur CAUSE (quel input manque, reçu/requis). Cliquer une ligne
 * sélectionne la machine pour la corriger. S'appuie sur la même source de vérité que les badges
 * (`computeMachineStatus`). N'affiche rien tant qu'aucune machine n'est configurée.
 */
export function BottleneckPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const selectNode = useGraphStore((s) => s.selectNode);
  if (!gameData) return null;

  const flowMap = buildNodeFlowMap(nodes, edges, gameData);

  let configuredCount = 0;
  const issues = nodes.flatMap((n) => {
    const status = computeMachineStatus(n.data, flowMap.get(n.id), gameData);
    if (!status.configured) return [];
    configuredCount += 1;
    if (status.state === null || status.state === 'nominal') return [];
    const info = computeNodeInfo(n.data, gameData);
    return [
      {
        id: n.id,
        name: info.building?.name ?? n.data.buildingId,
        product: info.outputs[0]?.itemName ?? null,
        status,
      },
    ];
  });

  if (configuredCount === 0) return null;

  // « En attente » (bloqué) d'abord, puis du plus sous-alimenté au moins.
  issues.sort((a, b) => {
    const rank = (s: MachineState | null) => (s === 'blocked' ? 0 : 1);
    return rank(a.status.state) - rank(b.status.state) || a.status.efficiency - b.status.efficiency;
  });

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">Audit des goulots</span>
        {issues.length > 0 && (
          <span className="rounded-full bg-zinc-800 px-1.5 text-[9px] font-bold text-zinc-300">
            {issues.length}
          </span>
        )}
      </div>

      {issues.length === 0 ? (
        <p className="text-[11px] text-emerald-400/80">✓ Toutes les machines tournent à plein régime.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {issues.map((iss) => {
            const meta = STATE_META[iss.status.state as Exclude<MachineState, 'nominal'>];
            return (
              <li key={iss.id}>
                <button
                  type="button"
                  onClick={() => selectNode(iss.id)}
                  className={`w-full rounded-lg border ${meta.border} ${meta.bg} p-2 text-left transition-colors hover:brightness-125`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 min-w-0">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                      <span className="truncate font-semibold text-zinc-200">
                        {iss.name}
                        {iss.product && <span className="text-zinc-500"> → {iss.product}</span>}
                      </span>
                    </span>
                    <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide" style={{ color: meta.color }}>
                      {meta.label} {Math.round(iss.status.efficiency * 100)}%
                    </span>
                  </div>
                  {iss.status.missing.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5 pl-3">
                      {iss.status.missing.map((m) => (
                        <div key={m.itemId} className="flex items-center justify-between text-[10px] text-zinc-400">
                          <span className="truncate">
                            {iss.status.state === 'blocked' ? 'Manque' : 'Insuffisant'} : {m.itemName}
                          </span>
                          <span className="shrink-0 font-mono text-zinc-500">
                            <span style={{ color: meta.color }}>{round(m.actual)}</span>/{round(m.required)}/m
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
