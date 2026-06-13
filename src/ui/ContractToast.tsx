import { useEffect } from 'react';
import { useProgressionStore } from '@/store/useProgressionStore';

/** Durée d'affichage avant auto-fermeture (ms). */
const TOAST_TTL = 5000;

/**
 * Notification de résultat de contrat — punch de récompense (réussite) ou alerte (échec).
 * Consomme `contractResult` du store ; auto-disparaît. La réputation, elle, est déjà
 * appliquée dans l'état (cf. advanceContracts).
 */
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
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <div
        onClick={dismiss}
        data-testid="contract-toast"
        className={[
          'pointer-events-auto flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 shadow-xl backdrop-blur',
          won
            ? 'border-amber-600/50 bg-zinc-900/95 shadow-amber-950/30'
            : 'border-red-700/50 bg-zinc-900/95 shadow-red-950/30',
        ].join(' ')}
        style={{ animation: 'nf-toast-in 0.35s ease-out' }}
      >
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${won ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            {won ? <path d="M20 6 9 17l-5-5" /> : <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>}
          </svg>
        </span>
        <div className="min-w-0">
          <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${won ? 'text-amber-400' : 'text-red-400'}`}>
            {won ? 'Contrat livré' : 'Contrat échoué'}
          </div>
          <div className="truncate text-sm font-bold text-zinc-100">
            {result.offer.clientName}
            {won && <span className="ml-2 font-mono text-amber-400">+{result.offer.reward} Bolts</span>}
            {!won && <span className="ml-2 font-mono text-red-400">Réputation −</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
