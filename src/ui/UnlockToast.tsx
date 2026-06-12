import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import type { MilestoneDefinition } from '@/game/balance';
import type { GameData } from '@/data/types';

/** Durée d'affichage d'un toast avant auto-fermeture (ms). */
const TOAST_TTL = 5000;

function LockOpenIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      {...props}
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function unlockText(m: MilestoneDefinition, game: GameData): { kind: string; name: string } {
  const { type, id } = m.unlocks;
  if (type === 'building') {
    return { kind: 'Nouveau bâtiment', name: game.buildings.find((b) => b.id === id)?.name ?? id };
  }
  if (type === 'recipe') {
    return { kind: 'Nouvelle recette', name: game.recipes.find((r) => r.id === id)?.name ?? id };
  }
  return { kind: 'Étape', name: id === 'prestige-available' ? 'Prestige disponible' : id };
}

/**
 * Notifications de déblocage — pop-up de récompense (REC-06).
 *
 * Consomme la file `recentUnlocks` du store de progression : chaque milestone franchi
 * apparaît en bas à droite, puis se referme automatiquement. C'est le « punch » de
 * récompense qui rend la progression gratifiante.
 */
export function UnlockToast() {
  const gameData = useFactoryStore((s) => s.gameData);
  const recentUnlocks = useProgressionStore((s) => s.recentUnlocks);
  const dismissUnlocks = useProgressionStore((s) => s.dismissUnlocks);

  useEffect(() => {
    if (recentUnlocks.length === 0) return;
    const id = setTimeout(() => dismissUnlocks(), TOAST_TTL);
    return () => clearTimeout(id);
  }, [recentUnlocks, dismissUnlocks]);

  if (!gameData || recentUnlocks.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {recentUnlocks.map((m) => {
        const { kind, name } = unlockText(m, gameData);
        return (
          <UnlockToastItem key={m.id} kind={kind} name={name} onDismiss={dismissUnlocks} />
        );
      })}
    </div>
  );
}

/**
 * Une carte de déblocage individuelle, animée en GSAP : entrée avec overshoot
 * (le « punch » de récompense), icône qui pivote/pop, et halo qui pulse en boucle
 * jusqu'à la fermeture.
 */
function UnlockToastItem({
  kind,
  name,
  onDismiss,
}: {
  kind: string;
  name: string;
  onDismiss: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tl = gsap.timeline();
    tl.fromTo(
      cardRef.current,
      { x: 80, opacity: 0, scale: 0.85 },
      { x: 0, opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' },
    );
    tl.fromTo(
      iconRef.current,
      { rotate: -90, scale: 0 },
      { rotate: 0, scale: 1, duration: 0.4, ease: 'back.out(2)' },
      0.1,
    );
    gsap.to(iconRef.current, {
      boxShadow: '0 0 0 6px rgba(16, 185, 129, 0.25)',
      repeat: -1,
      yoyo: true,
      duration: 0.9,
      ease: 'sine.inOut',
      delay: 0.5,
    });
    return () => {
      tl.kill();
      gsap.killTweensOf(iconRef.current);
    };
  }, []);

  const handleDismiss = () => {
    gsap.to(cardRef.current, {
      x: 80,
      opacity: 0,
      scale: 0.9,
      duration: 0.25,
      ease: 'power1.in',
      onComplete: onDismiss,
    });
  };

  return (
    <div
      ref={cardRef}
      onClick={handleDismiss}
      className="pointer-events-auto relative flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800/80 bg-zinc-950/85 px-4 py-3 shadow-2xl backdrop-blur-xl nf-glow-box-emerald"
    >
      {/* Coins HUD Industriels */}
      <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(16, 185, 129, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />

      <div
        ref={iconRef}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
      >
        <LockOpenIcon className="h-4 w-4 text-emerald-400" />
      </div>

      <div className="min-w-0">
        <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-emerald-400">
          // UNLOCKED_{kind.toUpperCase().replace(' ', '_')}
        </div>
        <div className="truncate text-xs font-bold text-zinc-100 font-sans">{name}</div>
      </div>
    </div>
  );
}
