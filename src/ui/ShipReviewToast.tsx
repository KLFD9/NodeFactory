import { useEffect } from 'react';
import { useProgressionStore } from '@/store/useProgressionStore';
import { MODEL_TYPES, type ModelTypeId } from '@/game/tycoon';

/** Durée d'affichage avant auto-fermeture (ms). */
const TOAST_TTL = 8000;

const nameOfType = (id: ModelTypeId) => MODEL_TYPES.find((m) => m.id === id)?.name ?? id;

/** Qualificatif de réception, façon « review /10 » de Game Dev Tycoon. */
function receptionLabel(reception: number): string {
  if (reception >= 0.85) return 'Acclamé';
  if (reception >= 0.6) return 'Bien reçu';
  if (reception >= 0.35) return 'Mitigé';
  return 'Flop';
}

/**
 * ShipReviewToast — la « review » d'un modèle shippé (benchmark + réception → revenus).
 * C'est le moment de récompense du méta-jeu Tycoon, calqué sur la note de sortie de GDT.
 */
export function ShipReviewToast() {
  const review = useProgressionStore((s) => s.shipReview);
  const dismiss = useProgressionStore((s) => s.dismissShipReview);

  useEffect(() => {
    if (!review) return;
    const id = setTimeout(() => dismiss(), TOAST_TTL);
    return () => clearTimeout(id);
  }, [review, dismiss]);

  if (!review) return null;

  return (
    <div className="pointer-events-none fixed bottom-8 right-8 z-50">
      <div
        onClick={dismiss}
        data-testid="ship-review-toast"
        className="pointer-events-auto relative w-[330px] cursor-pointer select-none overflow-hidden rounded-lg border border-cyan-500/40 bg-zinc-950/90 px-5 py-4 shadow-2xl backdrop-blur-xl animate-slide-up nf-glow-box-orange"
      >
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(34,211,238,0.6)', width: '10px', height: '10px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(34,211,238,0.6)', width: '10px', height: '10px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(34,211,238,0.6)', width: '10px', height: '10px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(34,211,238,0.6)', width: '10px', height: '10px' } as React.CSSProperties} />

        <div className="mb-3 flex items-center justify-between border-b border-zinc-900 pb-2">
          <span className="font-mono text-[9px] font-extrabold uppercase tracking-widest text-cyan-400">
            // MODEL_SHIPPED
          </span>
          <span className="font-mono text-[8px] text-zinc-500">REVIEW</span>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-extrabold text-zinc-200">
              {nameOfType(review.modelType)}
            </div>
            <div className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300">
              {receptionLabel(review.reception)}
            </div>
          </div>
          <div className="flex flex-col items-end leading-none">
            <span className="font-mono text-3xl font-black tracking-tight text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
              {review.benchmark}
            </span>
            <span className="font-mono text-[8px] font-bold uppercase text-amber-400/70">benchmark</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border border-amber-500/15 bg-amber-500/5 py-1.5">
            <div className="font-mono text-sm font-bold text-amber-400">+{review.revenue}</div>
            <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">$ revenus</div>
          </div>
          <div className="rounded border border-cyan-500/15 bg-cyan-500/5 py-1.5">
            <div className="font-mono text-sm font-bold text-cyan-300">+{review.rpReward}</div>
            <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">RP</div>
          </div>
          <div className="rounded border border-emerald-500/15 bg-emerald-500/5 py-1.5">
            <div className="font-mono text-sm font-bold text-emerald-400">+{review.renownDelta}</div>
            <div className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">renommée</div>
          </div>
        </div>

        {review.trendMatch !== 'none' && (
          <p className="mt-2 text-center text-[9px] font-mono uppercase tracking-wider text-emerald-400/80">
            Aligné sur la tendance du marché
          </p>
        )}
      </div>
    </div>
  );
}
