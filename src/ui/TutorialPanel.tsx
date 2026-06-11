import { useMemo } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { TUTORIAL_STEPS, currentTutorialStep, type TutorialSnapshot } from '@/game/tutorial';

/**
 * Checklist de premier lancement — guide la route la plus courte vers « ça tourne
 * tout seul » (mineur → smelter → 60 Iron Ingot). Pas un script : l'étape courante
 * est DÉRIVÉE de l'état réel du graphe (src/game/tutorial.ts), donc le panneau suit
 * le joueur même s'il fait les choses dans le désordre. Disparaît de lui-même à M1,
 * ou via « Passer » (persisté).
 */
export function TutorialPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const welcomeSeen = useProgressionStore((s) => s.welcomeSeen);
  const tutorialDismissed = useProgressionStore((s) => s.tutorialDismissed);
  const reachedMilestones = useProgressionStore((s) => s.reachedMilestones);
  const dismissTutorial = useProgressionStore((s) => s.dismissTutorial);

  const stepIndex = useMemo(() => {
    if (!gameData) return -1;
    const isExtractor = (id: string) =>
      gameData.buildings.find((b) => b.id === id)?.category === 'extraction';
    const ironMiners = nodes.filter(
      (n) => isExtractor(n.data.buildingId) && n.data.resourceId === 'iron-ore',
    );
    const smelters = nodes.filter((n) => n.data.buildingId === 'smelter');
    const minerIds = new Set(ironMiners.map((n) => n.id));
    const smelterIds = new Set(smelters.map((n) => n.id));
    const snapshot: TutorialSnapshot = {
      hasIronMiner: ironMiners.length > 0,
      hasSmelter: smelters.length > 0,
      smelterFed: edges.some((e) => minerIds.has(e.source) && smelterIds.has(e.target)),
      m1Reached: reachedMilestones.includes('ms-iron-ingot-60'),
    };
    return currentTutorialStep(snapshot);
  }, [gameData, nodes, edges, reachedMilestones]);

  // Caché tant que l'accueil n'est pas passé, si passé manuellement, ou une fois M1 atteint.
  if (!gameData || !welcomeSeen || tutorialDismissed || stepIndex === -1) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-12 left-1/2 z-40 -translate-x-1/2"
      data-testid="tutorial-panel"
    >
      <div className="pointer-events-auto w-[420px] max-w-[90vw] rounded-2xl border border-sky-700/40 bg-zinc-900/95 px-4 py-3 shadow-xl shadow-sky-950/30 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
            Premiers pas · {stepIndex + 1}/{TUTORIAL_STEPS.length}
          </span>
          <button
            onClick={dismissTutorial}
            className="cursor-pointer rounded px-1.5 text-[10px] text-zinc-500 transition-colors hover:text-zinc-300"
            title="Passer le tutoriel"
            data-testid="tutorial-skip"
          >
            Passer ✕
          </button>
        </div>

        <ol className="flex flex-col gap-1.5">
          {TUTORIAL_STEPS.map((step, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <li key={step.id} className="flex items-start gap-2.5">
                <span
                  className={[
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                    done
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : active
                        ? 'bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/50'
                        : 'border border-zinc-700 text-zinc-600',
                  ].join(' ')}
                >
                  {done ? '✓' : i + 1}
                </span>
                <div className={done ? 'opacity-50' : active ? '' : 'opacity-40'}>
                  <div
                    className={`text-xs font-bold ${active ? 'text-sky-200' : 'text-zinc-300'} ${done ? 'line-through' : ''}`}
                  >
                    {step.title}
                  </div>
                  {active && <div className="text-[11px] text-zinc-400">{step.detail}</div>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
