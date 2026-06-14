import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useProgressionStore } from '@/store/useProgressionStore';
import type { ProductionMicroMilestone } from '@/game/balance';

/** Durée d'affichage d'un micro-jalon avant auto-fermeture (ms) — court, c'est un flash. */
const MICRO_TTL = 2600;

function SparkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5 19 19M19 5l-2.5 2.5M7.5 16.5 5 19" />
    </svg>
  );
}

/**
 * Micro-jalons (sous M1) — petits toasts de « juice » qui densifient le hook.
 *
 * Entre le premier démarrage et M1 (60 Iron Ingot), il s'écoulait ~2 min sans aucun
 * retour positif. Ces seuils de lecture (1, 10, 30 lingots — cf.
 * EARLY_PRODUCTION_MICRO_MILESTONES) déclenchent un flash discret en haut de l'écran
 * pour confirmer que « ça avance », AVANT la grande récompense du milestone.
 *
 * Distinct de UnlockToast (déblocage, en bas à droite) : ici c'est plus léger, centré
 * en haut sous la bannière de ressources, et s'efface vite.
 */
export function MicroMilestoneToast() {
  const recent = useProgressionStore((s) => s.recentMicroMilestones);
  const dismiss = useProgressionStore((s) => s.dismissMicroMilestones);

  useEffect(() => {
    if (recent.length === 0) return;
    const id = setTimeout(() => dismiss(), MICRO_TTL);
    return () => clearTimeout(id);
  }, [recent, dismiss]);

  if (recent.length === 0) return null;

  // On ne montre que le plus récent : un seul flash à la fois reste lisible.
  const latest = recent[recent.length - 1];
  return (
    <div className="pointer-events-none fixed top-24 left-1/2 z-50 -translate-x-1/2">
      <MicroMilestoneItem key={latest.id} milestone={latest} />
    </div>
  );
}

function MicroMilestoneItem({ milestone }: { milestone: ProductionMicroMilestone }) {
  const ref = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(
      ref.current,
      { y: -16, opacity: 0, scale: 0.9 },
      { y: 0, opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(2)' },
    );
    tl.to(ref.current, { y: -8, opacity: 0, duration: 0.35, ease: 'power1.in' }, MICRO_TTL / 1000 - 0.35);
    gsap.fromTo(
      iconRef.current,
      { rotate: -120, scale: 0 },
      { rotate: 0, scale: 1, duration: 0.5, ease: 'back.out(2.5)' },
    );
    return () => {
      tl.kill();
      gsap.killTweensOf(iconRef.current);
    };
  }, [milestone.id]);

  return (
    <div
      ref={ref}
      className="flex items-center gap-2.5 rounded-full border border-cyan-500/30 bg-zinc-950/85 px-4 py-2 shadow-2xl backdrop-blur-xl nf-glow-box-cyan"
      data-testid="micro-milestone-toast"
    >
      <div ref={iconRef} className="text-cyan-300">
        <SparkIcon className="h-4 w-4" />
      </div>
      <span className="text-xs font-bold text-zinc-100 font-sans">{milestone.label}</span>
    </div>
  );
}
