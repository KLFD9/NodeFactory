import { useEffect } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import type { MilestoneDefinition } from '@/game/balance';
import type { GameData } from '@/data/types';

/** Durée d'affichage d'un toast avant auto-fermeture (ms). */
const TOAST_TTL = 5000;

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
          <div
            key={m.id}
            onClick={() => dismissUnlocks()}
            className="pointer-events-auto flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-600/50 bg-zinc-900/95 px-4 py-3 shadow-xl shadow-emerald-950/30 backdrop-blur"
            style={{ animation: 'nf-toast-in 0.35s ease-out' }}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-lg">
              🔓
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                {kind} débloqué
              </div>
              <div className="truncate text-sm font-bold text-zinc-100">{name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
