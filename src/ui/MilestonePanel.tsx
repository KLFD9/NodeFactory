import { useFactoryStore } from '@/store/useFactoryStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { MILESTONES, type MilestoneDefinition } from '@/game/balance';
import { milestoneProgress } from '@/game/progression';
import type { GameData } from '@/data/types';

/** Libellé lisible de la récompense d'un milestone. */
function rewardLabel(m: MilestoneDefinition, game: GameData): string {
  const { type, id } = m.unlocks;
  if (type === 'building') return game.buildings.find((b) => b.id === id)?.name ?? id;
  if (type === 'recipe') return game.recipes.find((r) => r.id === id)?.name ?? id;
  if (id === 'prestige-available') return 'Prestige disponible';
  return id;
}

/** Nom lisible de l'item suivi par un milestone. */
function itemLabel(itemId: string, game: GameData): string {
  return game.items.find((i) => i.id === itemId)?.name ?? itemId;
}

type Phase = 'reached' | 'active' | 'upcoming';

function MilestoneRow({
  m,
  phase,
  produced,
  progress,
  game,
}: {
  m: MilestoneDefinition;
  phase: Phase;
  produced: number;
  progress: number;
  game: GameData;
}) {
  const reward = rewardLabel(m, game);
  const item = itemLabel(m.itemId, game);

  if (phase === 'reached') {
    return (
      <li className="flex items-center gap-2.5 px-2 py-1 text-[11px] text-zinc-500">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 font-mono text-[9px] font-bold">
          ✓
        </span>
        <span className="truncate font-sans font-medium">{reward}</span>
      </li>
    );
  }

  if (phase === 'active') {
    return (
      <li className="relative rounded border border-emerald-500/25 bg-emerald-950/10 p-3 shadow-md">
        {/* Coins HUD */}
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />

        <div className="mb-2 flex items-baseline justify-between gap-2">
          <span className="text-xs font-bold text-zinc-100 font-sans">
            Produis {m.target} {item}
          </span>
          <span className="font-mono text-[10px] font-bold tabular-nums text-emerald-400">
            {Math.floor(produced)}/{m.target}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded bg-zinc-900 border border-zinc-800">
          <span
            className="block h-full rounded bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-wider text-emerald-400">
          <span className="text-zinc-500">// UNLOCKS:</span>
          <span className="font-bold">{reward}</span>
        </div>
      </li>
    );
  }

  // upcoming : visible mais grisé (REC-01 — on voit la suite de l'objectif).
  return (
    <li className="flex items-center gap-2.5 rounded border border-zinc-900 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-500">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-850 bg-zinc-900 text-[9px]">
        🔒
      </span>
      <span className="truncate font-sans font-medium">{reward}</span>
      <span className="ml-auto shrink-0 font-mono text-[9px] text-zinc-600">
        {m.target} {item}
      </span>
    </li>
  );
}

/**
 * Panneau des objectifs (milestones) — le « but » du jeu rendu visible.
 *
 * Montre l'échelle de progression : paliers franchis (✓), palier actif (barre de
 * progression + récompense), paliers à venir (verrouillés mais lisibles). C'est la
 * colonne vertébrale de la boucle : produire → débloquer → produire plus.
 */
/**
 * Progressive disclosure : on ne montre JAMAIS toute l'échelle d'un coup.
 *   - paliers franchis : repliés dans un <details> compact (consultables au clic) ;
 *   - palier ACTIF : carte avec barre de progression (le « but » du moment) ;
 *   - palier SUIVANT : seul teaser visible (on sait ce qui vient, pas plus) ;
 *   - le reste : simple compteur « +N paliers à découvrir » — récompenses cachées,
 *     la surprise fait partie de la récompense (pas de spoil du end-game).
 */
export function MilestonePanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const cumulativeProduced = useProgressionStore((s) => s.cumulativeProduced);
  const reachedMilestones = useProgressionStore((s) => s.reachedMilestones);
  if (!gameData) return null;

  const reached = new Set(reachedMilestones);
  const activeIndex = MILESTONES.findIndex((m) => !reached.has(m.id));
  const allDone = activeIndex === -1;

  const reachedList = MILESTONES.filter((m) => reached.has(m.id));
  const active = allDone ? null : MILESTONES[activeIndex];
  const next = !allDone && activeIndex + 1 < MILESTONES.length ? MILESTONES[activeIndex + 1] : null;
  const hiddenCount = allDone ? 0 : Math.max(0, MILESTONES.length - activeIndex - 2);

  return (
    <div className="flex flex-col gap-4">
      <div className="border-b border-zinc-900 pb-2">
        <h2 className="text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase">// SYSTEM_OBJECTIFS</h2>
        <p className="mt-1 text-[11px] text-zinc-400 font-sans leading-relaxed">
          {allDone
            ? 'Tous les paliers franchis — simulation complétée.'
            : 'Produis pour débloquer de nouveaux composants.'}
        </p>
      </div>

      {reachedList.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 transition-colors hover:text-zinc-300">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px]">
              ✓
            </span>
            <span>
              {reachedList.length} PALIERS_FRANCHIS
            </span>
            <span className="ml-auto text-zinc-600 transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1.5 pl-1.5 border-l border-zinc-900 ml-2">
            {reachedList.map((m) => (
              <MilestoneRow
                key={m.id}
                m={m}
                phase="reached"
                produced={cumulativeProduced[m.itemId] ?? 0}
                progress={1}
                game={gameData}
              />
            ))}
          </ul>
        </details>
      )}

      <ul className="flex flex-col gap-2.5">
        {active && (
          <MilestoneRow
            m={active}
            phase="active"
            produced={cumulativeProduced[active.itemId] ?? 0}
            progress={milestoneProgress({ cumulativeProduced }, active)}
            game={gameData}
          />
        )}
        {next && (
          <MilestoneRow
            m={next}
            phase="upcoming"
            produced={cumulativeProduced[next.itemId] ?? 0}
            progress={milestoneProgress({ cumulativeProduced }, next)}
            game={gameData}
          />
        )}
        {hiddenCount > 0 && (
          <li className="flex items-center gap-2.5 rounded border border-zinc-950 bg-zinc-950/20 px-3 py-2 text-[11px] text-zinc-650">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-zinc-900 bg-zinc-950/40 text-[9px] font-mono">
              ?
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider">
              +{hiddenCount} PALIERS_A_DECOUVRIR…
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
