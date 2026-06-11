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
      <li className="flex items-center gap-2 text-[11px] text-zinc-500">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          ✓
        </span>
        <span className="truncate">{reward}</span>
      </li>
    );
  }

  if (phase === 'active') {
    return (
      <li className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2.5">
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-[11px] font-semibold text-zinc-200">
            Produis {m.target} {item}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-zinc-400">
            {Math.floor(produced)}/{m.target}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <span
            className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-300/90">
          <span className="text-zinc-500">Débloque</span>
          <span className="font-medium">{reward}</span>
        </div>
      </li>
    );
  }

  // upcoming : visible mais grisé (REC-01 — on voit la suite de l'objectif).
  return (
    <li className="flex items-center gap-2 text-[11px] text-zinc-600">
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-[9px]">
        🔒
      </span>
      <span className="truncate">{reward}</span>
      <span className="ml-auto shrink-0 text-[10px] text-zinc-700">
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
    <div className="flex flex-col gap-2.5">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-zinc-100">Objectifs</h2>
        <p className="text-[11px] text-zinc-500">
          {allDone
            ? 'Tous les paliers franchis — optimise et prestige.'
            : 'Produis pour débloquer ton usine.'}
        </p>
      </div>

      {reachedList.length > 0 && (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              ✓
            </span>
            <span>
              {reachedList.length} palier{reachedList.length > 1 ? 's' : ''} franchi
              {reachedList.length > 1 ? 's' : ''}
            </span>
            <span className="ml-auto text-zinc-700 transition-transform group-open:rotate-90">›</span>
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1 pl-1">
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

      <ul className="flex flex-col gap-1.5">
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
          <li className="flex items-center gap-2 pl-0.5 text-[11px] text-zinc-700">
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-800 text-[9px]">
              ?
            </span>
            <span>
              +{hiddenCount} palier{hiddenCount > 1 ? 's' : ''} à découvrir…
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
