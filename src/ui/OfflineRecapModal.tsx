import { useProgressionStore } from '@/store/useProgressionStore';
import { LONG_CLOCK_CAP_MIN } from '@/game/balance';
import { ManufacturingIcon } from '@/ui/icons';

/** Formate une durée en minutes → « 2 h 05 » / « 12 min ». */
function fmtDuration(minutes: number): string {
  const totalMin = Math.floor(minutes);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/**
 * Popup récap des gains hors-ligne (boucle idle, REC offline).
 *
 * S'affiche une seule fois à la reconnexion quand l'absence a rapporté quelque
 * chose (cf. shouldShowOfflineRecap — jamais pour un simple reload). C'est le
 * moment « bon retour, ton usine a travaillé pour toi » qui récompense le retour
 * du joueur, sans jamais gonfler les nombres : les AP affichés sont exactement
 * ceux crédités par le delta-time plafonné à 4 h.
 */
export function OfflineRecapModal() {
  const recap = useProgressionStore((s) => s.offlineRecap);
  const dismiss = useProgressionStore((s) => s.dismissOfflineRecap);

  if (!recap) return null;

  const capped = recap.minutesCredited >= LONG_CLOCK_CAP_MIN;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm animate-fade-in"
      onClick={dismiss}
      data-testid="offline-recap"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative mx-4 w-full max-w-sm rounded-lg border border-zinc-800/80 bg-zinc-950/85 p-6 shadow-2xl backdrop-blur-xl nf-glow-box-orange animate-slide-up"
      >
        {/* Coins HUD Industriels */}
        <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />
        <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(249, 115, 22, 0.5)' } as React.CSSProperties} />

        {/* Télémétrie supérieure */}
        <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 tracking-wider mb-4 border-b border-zinc-900 pb-2">
          <span>SYS_STATUS: ONLINE</span>
          <span>// ENGINE_RESTORED</span>
        </div>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-orange-500/20 bg-zinc-950 text-orange-400 shadow-inner">
            <ManufacturingIcon className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-zinc-100 font-sans">Bon retour !</h2>
            <p className="text-[11px] text-zinc-400 font-sans leading-relaxed">
              Votre usine a tourné pendant votre absence.
            </p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-center">
          <div className="font-mono text-2xl font-black text-orange-500 nf-glow-text-orange" data-testid="offline-recap-ap">
            +{Math.floor(recap.rpGained)} RP
          </div>
          <div className="mt-1 text-[11px] font-mono text-zinc-500">
            accumulés en {fmtDuration(recap.minutesCredited)}
            {capped && (
              <span className="ml-1 text-orange-500/80 font-bold" title="Les gains hors-ligne sont plafonnés à 4 heures de production.">
                · PLAFOND_4H
              </span>
            )}
          </div>
        </div>

        <button
          onClick={dismiss}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-black tracking-widest text-zinc-950 uppercase nf-cta-btn cursor-pointer"
          data-testid="offline-recap-dismiss"
        >
          Reprendre la production
        </button>
      </div>
    </div>
  );
}
