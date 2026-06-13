import { useFactoryStore } from '@/store/useFactoryStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import {
  contractProgress,
  reputationPayoutMult,
  REPUTATION_MIN,
  REPUTATION_MAX,
  RISK_PROFILES,
  type ContractOffer,
  type ContractRisk,
} from '@/game/contracts';

/** Accents HUD par niveau de risque. */
const RISK_STYLE: Record<ContractRisk, { text: string; border: string; bg: string }> = {
  standard: { text: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-950/10' },
  tight: { text: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-950/10' },
  hard: { text: 'text-red-400', border: 'border-red-500/40', bg: 'bg-red-950/15' },
};

/** Petite icône boulon (réutilisée pour signifier « Bolts »). */
function BoltMini({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2 20.66 7v10L12 22 3.34 17V7L12 2Z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

/** Jauge de réputation : pips de −3 à +3, le niveau courant mis en avant. */
function ReputationGauge({ reputation }: { reputation: number }) {
  const cells: number[] = [];
  for (let r = REPUTATION_MIN; r <= REPUTATION_MAX; r++) cells.push(r);
  const mult = reputationPayoutMult(reputation);
  return (
    <div className="flex items-center justify-between border-b border-zinc-900 pb-2" data-testid="reputation-gauge">
      <div className="flex items-center gap-1">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-500">RÉPUT.</span>
        <div className="flex items-center gap-0.5">
          {cells.map((r) => {
            const active = r === reputation;
            const positive = r > 0;
            const negative = r < 0;
            return (
              <span
                key={r}
                className={[
                  'h-2.5 w-2.5 rounded-[2px] border transition-colors',
                  active
                    ? positive
                      ? 'bg-emerald-500 border-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
                      : negative
                        ? 'bg-red-500 border-red-400 shadow-[0_0_6px_rgba(239,68,68,0.6)]'
                        : 'bg-zinc-400 border-zinc-300'
                    : 'bg-zinc-900 border-zinc-800',
                ].join(' ')}
              />
            );
          })}
        </div>
      </div>
      <span className="font-mono text-[9px] text-zinc-500" title="Multiplicateur de paie selon la réputation">
        ×{mult.toFixed(1)}
      </span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: ContractRisk }) {
  const s = RISK_STYLE[risk];
  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-wider ${s.text} ${s.border} ${s.bg}`}>
      {RISK_PROFILES[risk].label}
    </span>
  );
}

/** Carte d'une offre proposée (non encore acceptée). */
function OfferCard({ offer, onAccept }: { offer: ContractOffer; onAccept: () => void }) {
  const s = RISK_STYLE[offer.risk];
  return (
    <li className={`relative rounded border ${s.border} ${s.bg} p-3`} data-testid="contract-offer">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate font-sans text-xs font-bold text-zinc-100">{offer.clientName}</span>
        <RiskBadge risk={offer.risk} />
      </div>
      <p className="mb-2 text-[10px] italic leading-snug text-zinc-500">{offer.flavor}</p>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-mono text-zinc-300">
          {offer.quantity} <span className="text-zinc-500">{offer.itemName}</span>
        </span>
        <span className="flex items-center gap-1 font-mono font-bold text-amber-400">
          +{offer.reward} <BoltMini className="h-2.5 w-2.5" />
        </span>
      </div>
      <div className="mt-1 flex items-center justify-between">
        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">
          {offer.durationMin == null ? 'Pas de délai' : `Délai ${offer.durationMin} min`}
        </span>
        <button
          type="button"
          onClick={onAccept}
          data-testid="accept-contract"
          className={`rounded border px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider transition-colors ${s.text} ${s.border} hover:bg-zinc-800/60`}
        >
          Accepter
        </button>
      </div>
    </li>
  );
}

/** Carte du contrat actif (en cours de livraison). */
function ActiveCard() {
  const active = useProgressionStore((s) => s.activeContract);
  const cumulativeProduced = useProgressionStore((s) => s.cumulativeProduced);
  const gameMin = useProgressionStore((s) => s.gameMinutesElapsed);
  if (!active) return null;

  const delivered = contractProgress(active, cumulativeProduced);
  const pct = Math.min(1, delivered / active.offer.quantity);
  const remaining =
    active.deadlineGameMin === Infinity ? null : Math.max(0, active.deadlineGameMin - gameMin);
  const urgent = remaining != null && remaining < 1.5;
  const s = RISK_STYLE[active.offer.risk];

  return (
    <li className={`relative rounded border ${s.border} ${s.bg} p-3 shadow-md`} data-testid="active-contract">
      <div className="nf-hud-corner nf-hud-corner-tl" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-tr" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-bl" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />
      <div className="nf-hud-corner nf-hud-corner-br" style={{ '--hud-border-color': 'rgba(245, 158, 11, 0.4)', width: '6px', height: '6px' } as React.CSSProperties} />

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate font-sans text-xs font-bold text-zinc-100">{active.offer.clientName}</span>
        <RiskBadge risk={active.offer.risk} />
      </div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-zinc-300">{active.offer.itemName}</span>
        <span className="font-mono text-[10px] font-bold tabular-nums text-amber-400">
          {Math.floor(delivered)}/{active.offer.quantity}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded border border-zinc-800 bg-zinc-900">
        <span
          className="block h-full rounded bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] transition-[width] duration-500"
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-[9px] font-mono uppercase tracking-wider">
        <span className={urgent ? 'text-red-400' : 'text-zinc-500'}>
          {remaining == null ? 'Pas de délai' : `${Math.ceil(remaining)} min restantes`}
        </span>
        <span className="flex items-center gap-1 font-bold text-amber-400">
          +{active.offer.reward} <BoltMini className="h-2.5 w-2.5" />
        </span>
      </div>
    </li>
  );
}

/**
 * Panneau des contrats — l'objectif vivant du jeu (remplace les objectifs statiques).
 *
 * Soit un contrat actif (1 max) avec sa barre de livraison et son compte à rebours,
 * soit les offres proposées (clients procéduraux, 3 niveaux de risque) à accepter.
 * Source principale des Bolts ; la réputation module les paies.
 */
export function ContractPanel() {
  const gameData = useFactoryStore((s) => s.gameData);
  const reputation = useProgressionStore((s) => s.reputation);
  const activeContract = useProgressionStore((s) => s.activeContract);
  const offers = useProgressionStore((s) => s.contractOffers);
  const accept = useProgressionStore((s) => s.acceptContract);
  if (!gameData) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="contract-panel">
      <div className="border-b border-zinc-900 pb-2">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-widest text-zinc-500">// CONTRATS</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
          {activeContract
            ? 'Livraison en cours. Produis pour honorer le contrat.'
            : 'Accepte une commande — c’est ta source de Bolts.'}
        </p>
      </div>

      <ReputationGauge reputation={reputation} />

      <ul className="flex flex-col gap-2">
        {activeContract ? (
          <ActiveCard />
        ) : offers.length > 0 ? (
          offers.map((o) => <OfferCard key={o.id} offer={o} onAccept={() => accept(o.id)} />)
        ) : (
          <li className="rounded border border-zinc-900 bg-zinc-950/40 px-3 py-4 text-center text-[11px] text-zinc-600">
            Lance ta production : de nouveaux clients arriveront bientôt.
          </li>
        )}
      </ul>
    </div>
  );
}
