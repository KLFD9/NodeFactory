import { useProgressionStore } from '@/store/useProgressionStore';
import { LONG_CLOCK_CAP_MIN } from '@/game/balance';

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 backdrop-blur-sm"
      onClick={dismiss}
      data-testid="offline-recap"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="mx-4 w-full max-w-sm rounded-2xl border border-amber-500/30 bg-zinc-900 p-6 shadow-2xl shadow-amber-950/40"
        style={{ animation: 'nf-toast-in 0.35s ease-out' }}
      >
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-xl">
            🏭
          </span>
          <div>
            <h2 className="text-sm font-bold text-zinc-100">Bon retour !</h2>
            <p className="text-[11px] text-zinc-500">
              Votre usine a tourné pendant votre absence.
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 text-center">
          <div className="font-mono text-2xl font-bold text-amber-400" data-testid="offline-recap-ap">
            +{Math.floor(recap.apGained)} AP
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            accumulés en {fmtDuration(recap.minutesCredited)}
            {capped && (
              <span className="ml-1 text-amber-500/80" title="Les gains hors-ligne sont plafonnés à 4 heures de production.">
                · plafond 4 h atteint
              </span>
            )}
          </div>
        </div>

        <button
          onClick={dismiss}
          className="w-full cursor-pointer rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-sm font-bold text-amber-300 transition-colors hover:bg-amber-500/20"
          data-testid="offline-recap-dismiss"
        >
          Reprendre la production
        </button>
      </div>
    </div>
  );
}
