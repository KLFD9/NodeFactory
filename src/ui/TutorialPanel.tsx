import { useMemo } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { TUTORIAL_SECTIONS, TUTORIAL_STEPS, currentTutorialStep, type TutorialSnapshot } from '@/game/tutorial';
import { computeFactoryAndPower } from '@/graph/computeFactory';

/**
 * Checklist de premier lancement — guide la route la plus courte vers « ça tourne
 * tout seul ». Pas un script : l'étape courante est DÉRIVÉE de l'état réel du graphe
 * (src/game/tutorial.ts), donc le panneau suit le joueur même s'il fait les choses
 * dans le désordre. Disparaît de lui-même à M1, ou via « Passer » (persisté).
 *
 * Affichage par SECTION (Électricité → Production de fer → Automatisation) : les
 * sections terminées se replient en une ligne « ✓ Titre », seule la section en
 * cours détaille ses étapes — évite de noyer le joueur sous 9 lignes d'un coup.
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

    const coalMiners = nodes.filter((n) => isExtractor(n.data.buildingId) && n.data.resourceId === 'coal');
    const coalGenerators = nodes.filter(
      (n) => n.data.buildingId === 'coal-generator' && n.data.recipeId === 'coal-generator-power',
    );
    const ironMiners = nodes.filter(
      (n) => isExtractor(n.data.buildingId) && n.data.resourceId === 'iron-ore',
    );
    const smelters = nodes.filter((n) => n.data.buildingId === 'smelter');

    const coalMinerIds = new Set(coalMiners.map((n) => n.id));
    const coalGenIds = new Set(coalGenerators.map((n) => n.id));
    const ironMinerIds = new Set(ironMiners.map((n) => n.id));
    const smelterIds = new Set(smelters.map((n) => n.id));

    // Générateur nourri = convoyeur charbon (mineur → générateur).
    const coalGenFed = edges.some(
      (e) =>
        coalMinerIds.has(e.source) &&
        coalGenIds.has(e.target) &&
        e.sourceHandle === 'out-coal' &&
        e.targetHandle === 'in-coal',
    );

    const { poweredByNode } = computeFactoryAndPower(nodes, edges, gameData);

    // Boucle bouclée = câble ⚡ générateur → mineur de charbon, ET le réseau est sous tension.
    const coalLoopWired = edges.some(
      (e) =>
        coalGenIds.has(e.source) &&
        coalMinerIds.has(e.target) &&
        e.sourceHandle === 'power-out' &&
        e.targetHandle === 'power-in',
    );
    const coalLoopPowered = coalLoopWired && coalMiners.some((n) => poweredByNode.get(n.id) === true);

    // Sous tension = un smelter NOURRI appartient à un réseau électrique alimenté.
    const fedSmelters = edges
      .filter((e) => ironMinerIds.has(e.source) && smelterIds.has(e.target))
      .map((e) => e.target);

    const snapshot: TutorialSnapshot = {
      hasCoalMiner: coalMiners.length > 0,
      hasCoalGenerator: coalGenerators.length > 0,
      coalGenFed,
      coalLoopPowered,
      hasIronMiner: ironMiners.length > 0,
      hasSmelter: smelters.length > 0,
      smelterFed: fedSmelters.length > 0,
      chainPowered: fedSmelters.some((id) => poweredByNode.get(id) === true),
      m1Reached: reachedMilestones.includes('ms-iron-ingot-60'),
    };
    return currentTutorialStep(snapshot);
  }, [gameData, nodes, edges, reachedMilestones]);

  // Caché tant que l'accueil n'est pas passé, si passé manuellement, ou une fois M1 atteint.
  if (!gameData || !welcomeSeen || tutorialDismissed || stepIndex === -1) return null;

  const activeSection = TUTORIAL_STEPS[stepIndex].section;
  const activeSectionIndex = TUTORIAL_SECTIONS.indexOf(activeSection as (typeof TUTORIAL_SECTIONS)[number]);

  return (
    <div
      className="pointer-events-none fixed bottom-12 left-1/2 z-40 -translate-x-1/2"
      data-testid="tutorial-panel"
    >
      <div className="relative pointer-events-auto w-[420px] max-w-[90vw] rounded-lg border border-zinc-800/80 bg-zinc-950/85 px-5 py-4 shadow-2xl backdrop-blur-xl nf-glow-box-cyan animate-slide-up">
        {/* Coins HUD Industriels */}
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(34, 211, 238, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(34, 211, 238, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(34, 211, 238, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(34, 211, 238, 0.5)' } as React.CSSProperties} />

        <div className="mb-3 flex items-center justify-between border-b border-zinc-900 pb-2">
          <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-cyan-400">
            // SYS_GUIDE : {activeSection.toUpperCase()} — {activeSectionIndex + 1}/{TUTORIAL_SECTIONS.length}
          </span>
          <button
            onClick={dismissTutorial}
            className="cursor-pointer font-mono rounded px-1.5 py-0.5 text-[9px] text-zinc-500 transition-colors hover:text-zinc-300 hover:bg-zinc-900"
            title="Passer le tutoriel"
            data-testid="tutorial-skip"
          >
            SKIP_✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {TUTORIAL_SECTIONS.map((section, sectionIdx) => {
            const steps = TUTORIAL_STEPS.filter((s) => s.section === section);
            const sectionDone = sectionIdx < activeSectionIndex;
            const sectionPending = sectionIdx > activeSectionIndex;

            // Section terminée ou pas encore commencée : une ligne condensée.
            if (sectionDone || sectionPending) {
              return (
                <div
                  key={section}
                  className={`flex items-center gap-2 text-[10px] font-mono uppercase tracking-wide ${
                    sectionDone ? 'text-emerald-400/70' : 'text-zinc-600'
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-current/30 text-[9px]">
                    {sectionDone ? '✓' : sectionIdx + 1}
                  </span>
                  <span className={sectionDone ? 'line-through decoration-emerald-700' : ''}>{section}</span>
                </div>
              );
            }

            // Section active : détail complet de ses étapes.
            const firstIndex = TUTORIAL_STEPS.indexOf(steps[0]);
            return (
              <ol key={section} className="flex flex-col gap-2">
                {steps.map((step, i) => {
                  const globalIndex = firstIndex + i;
                  const done = globalIndex < stepIndex;
                  const active = globalIndex === stepIndex;
                  return (
                    <li key={step.id} className="flex items-start gap-3">
                      <span
                        className={[
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-mono font-bold border',
                          done
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                            : active
                              ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                              : 'border-zinc-800 text-zinc-600 bg-zinc-950/40',
                        ].join(' ')}
                      >
                        {done ? '✓' : `0${i + 1}`}
                      </span>

                      <div className={`flex-1 ${done ? 'opacity-40' : active ? '' : 'opacity-30'}`}>
                        <div
                          className={`text-xs font-bold font-sans ${active ? 'text-zinc-100' : 'text-zinc-300'} ${done ? 'line-through decoration-zinc-600' : ''}`}
                        >
                          {step.title}
                        </div>
                        {active && (
                          <div className="mt-1 border-l-2 border-cyan-500/30 pl-2 text-[11px] text-zinc-400 leading-relaxed font-sans">
                            {step.detail}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            );
          })}
        </div>
      </div>
    </div>
  );
}
