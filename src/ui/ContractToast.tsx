import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useProgressionStore } from '@/store/useProgressionStore';

/** Durée d'affichage avant auto-fermeture (ms). */
const TOAST_TTL = 6000;

function BoltIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="M12 2 20.66 7v10L12 22 3.34 17V7L12 2Z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

function AlertTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={props.className} {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function ContractToast() {
  const result = useProgressionStore((s) => s.contractResult);
  const dismiss = useProgressionStore((s) => s.dismissContractResult);

  useEffect(() => {
    if (!result) return;
    const id = setTimeout(() => dismiss(), TOAST_TTL);
    return () => clearTimeout(id);
  }, [result, dismiss]);

  if (!result) return null;
  const won = result.outcome === 'completed';

  return (
    <div className="pointer-events-none fixed bottom-8 right-8 z-50 flex flex-col gap-2">
      <ContractToastItem result={result} won={won} onDismiss={dismiss} />
    </div>
  );
}

function ContractToastItem({
  result,
  won,
  onDismiss,
}: {
  result: any;
  won: boolean;
  onDismiss: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const [displayedReward, setDisplayedReward] = useState(0);

  useEffect(() => {
    const tl = gsap.timeline();
    // Entrée avec impact physique (overshoot back)
    tl.fromTo(
      cardRef.current,
      { x: 150, opacity: 0, scale: 0.8, rotate: won ? 2 : -2 },
      { x: 0, opacity: 1, scale: 1, rotate: 0, duration: 0.6, ease: 'back.out(1.5)' }
    );

    if (won) {
      // Rebond du gros chiffre de récompense
      tl.fromTo(
        numRef.current,
        { scale: 0.5, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.4, ease: 'back.out(2)' },
        0.2
      );
      // Pulsation infinie du halo lumineux
      gsap.to(glowRef.current, {
        boxShadow: '0 0 25px 5px rgba(245, 158, 11, 0.45)',
        repeat: -1,
        yoyo: true,
        duration: 1.2,
        ease: 'sine.inOut',
      });

      // Compteur progressif de Bolts
      const rewardObj = { value: 0 };
      gsap.to(rewardObj, {
        value: result.offer.reward,
        duration: 0.8,
        ease: 'power2.out',
        delay: 0.25,
        onUpdate: () => setDisplayedReward(Math.round(rewardObj.value)),
      });
    } else {
      // Clignotement d'alarme pour l'échec
      gsap.fromTo(
        cardRef.current,
        { borderColor: 'rgba(239, 68, 68, 0.4)' },
        { borderColor: 'rgba(239, 68, 68, 0.9)', repeat: 5, yoyo: true, duration: 0.3 }
      );
    }

    return () => {
      tl.kill();
      if (won) {
        gsap.killTweensOf(glowRef.current);
      } else {
        gsap.killTweensOf(cardRef.current);
      }
    };
  }, [won, result.offer.reward]);

  const handleDismiss = () => {
    gsap.to(cardRef.current, {
      x: 100,
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
      data-testid="contract-toast"
      className={[
        'pointer-events-auto relative flex cursor-pointer flex-col w-[350px] rounded-lg border bg-zinc-950/90 pl-6 pr-4 py-4 shadow-2xl backdrop-blur-xl transition-all select-none overflow-hidden',
        won
          ? 'border-amber-500/40 nf-glow-box-orange'
          : 'border-red-500/40 nf-glow-box-red',
      ].join(' ')}
    >
      {/* Decorative safety hazard stripes on the left edge */}
      <div 
        className="absolute left-0 inset-y-0 w-2 shrink-0 z-20" 
        style={{
          background: won
            ? 'repeating-linear-gradient(-45deg, #f59e0b, #f59e0b 6px, #18181b 6px, #18181b 12px)'
            : 'repeating-linear-gradient(-45deg, #ef4444, #ef4444 6px, #18181b 6px, #18181b 12px)'
        }}
      />

      {/* HUD Industrial Corners */}
      <div 
        className="nf-hud-corner nf-hud-corner-tl" 
        style={{ '--hud-border-color': won ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)', width: '10px', height: '10px', left: '10px' } as React.CSSProperties} 
      />
      <div 
        className="nf-hud-corner nf-hud-corner-tr" 
        style={{ '--hud-border-color': won ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)', width: '10px', height: '10px' } as React.CSSProperties} 
      />
      <div 
        className="nf-hud-corner nf-hud-corner-bl" 
        style={{ '--hud-border-color': won ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)', width: '10px', height: '10px', left: '10px' } as React.CSSProperties} 
      />
      <div 
        className="nf-hud-corner nf-hud-corner-br" 
        style={{ '--hud-border-color': won ? 'rgba(245, 158, 11, 0.6)' : 'rgba(239, 68, 68, 0.6)', width: '10px', height: '10px' } as React.CSSProperties} 
      />

      {/* Decorative Scanlines */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,19,0)_95%,rgba(0,0,0,0.2)_95%)] bg-[length:100%_4px] pointer-events-none opacity-20" />

      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-2 mb-3 relative z-10">
        <span className={`font-mono text-[9px] font-extrabold uppercase tracking-widest ${won ? 'text-amber-400' : 'text-red-400'}`}>
          {won ? '// CONTRACT_ACCREDITED' : '// DEADLINE_BREACHED'}
        </span>
        <span className="text-[8px] font-mono text-zinc-500 font-medium">SYS_MSG_v2.0</span>
      </div>

      {/* Body content */}
      <div className="flex items-start gap-4 relative z-10">
        <div
          ref={glowRef}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded border transition-all ${
            won 
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.2)]' 
              : 'bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
          }`}
        >
          {won ? <BoltIcon className="h-6 w-6 animate-pulse" /> : <AlertTriangleIcon className="h-6 w-6 animate-pulse" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[9px] font-mono text-zinc-500 uppercase font-semibold">Client</div>
          <div className="text-[13px] font-extrabold text-zinc-200 truncate mb-2">
            {result.offer.clientName}
          </div>
          
          <div className="text-[9px] font-mono text-zinc-500 uppercase font-semibold mb-0.5">Mandat</div>
          <div className="text-xs font-semibold text-zinc-400 leading-normal mb-3">
            {won ? 'LIVRÉ' : 'ÉCHOUÉ'} : <span className="text-zinc-200 font-bold">{result.offer.quantity} {result.offer.itemName}</span>
          </div>

          {won ? (
            <div className="flex items-center justify-between mt-3 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5">
              <div className="flex flex-col">
                <span className="text-[8.5px] font-mono text-zinc-500 uppercase font-bold leading-none">Récompense</span>
                <div ref={numRef} className="flex items-baseline gap-1 mt-1 leading-none">
                  <span className="text-2xl font-mono font-black tracking-tight text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                    +{displayedReward}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-amber-400/80 uppercase">Bolts</span>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[8.5px] font-mono text-zinc-500 uppercase font-bold leading-none">Réputation</span>
                <span className="text-[9.5px] font-mono font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded mt-1.5 animate-pulse uppercase leading-none">
                  +1 Réputation
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 mt-3 bg-red-950/25 border border-red-500/20 rounded-lg p-2.5">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <div className="flex flex-col">
                <span className="text-[10px] font-mono font-black text-red-400 uppercase tracking-wide leading-none">Réputation dégradée</span>
                <span className="text-[8px] font-mono text-red-500/80 uppercase font-bold mt-1.5 leading-none">-1 Point Client</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Subtle status footer inside toast */}
      <div className="mt-4 pt-2 border-t border-zinc-900 text-right relative z-10">
        <span className="text-[9px] font-mono text-zinc-600">
          {won ? 'Crédits alloués au profil.' : 'Avertissement envoyé.'}
        </span>
      </div>
    </div>
  );
}
