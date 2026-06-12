import { useEffect } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';

/** Durée d'affichage avant auto-fermeture (ms). */
const TOAST_TTL = 3000;

/**
 * Avertissement « AP insuffisants » : pose refusée faute de solde suffisant.
 * Consomme `placementDenied` du store de graphe, auto-disparaît après TOAST_TTL.
 */
export function PlacementDeniedToast() {
  const gameData = useFactoryStore((s) => s.gameData);
  const denied = useGraphStore((s) => s.placementDenied);
  const dismiss = useGraphStore((s) => s.dismissPlacementDenied);

  useEffect(() => {
    if (!denied) return;
    const id = setTimeout(() => dismiss(), TOAST_TTL);
    return () => clearTimeout(id);
  }, [denied, dismiss]);

  if (!gameData || !denied) return null;
  const name = gameData.buildings.find((b) => b.id === denied.buildingId)?.name ?? denied.buildingId;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <div
        role="alert"
        className="pointer-events-auto relative rounded-lg border border-zinc-800/80 bg-zinc-950/85 px-4 py-3 text-xs text-zinc-100 shadow-2xl backdrop-blur-xl nf-glow-box-red animate-slide-up flex items-center gap-3"
      >
        {/* Coins HUD Industriels */}
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(239, 68, 68, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(239, 68, 68, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(239, 68, 68, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(239, 68, 68, 0.5)', width: '8px', height: '8px' } as React.CSSProperties} />

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-sm">
          ⚠
        </div>

        <div className="min-w-0">
          <div className="text-[9px] font-mono font-bold uppercase tracking-wider text-red-400 mb-0.5">
            // PLACEMENT_DENIED // AP_INSUFFICIENT
          </div>
          <div className="text-zinc-300 font-sans leading-relaxed text-[11px]">
            <span className="font-bold text-zinc-200">{name}</span> requiert <span className="text-red-400 font-mono font-bold">{denied.cost} AP</span> (solde : {Math.floor(denied.available)} AP)
          </div>
        </div>
      </div>
    </div>
  );
}
