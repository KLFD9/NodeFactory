import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyOfflineGains,
  applyProductionTick,
  initialProgression,
  type ProgressionState,
  type TickInput,
} from '@/game/progression';
import type { MilestoneDefinition } from '@/game/balance';

/**
 * useProgressionStore — état de jeu (progression) de NodeFactory.
 *
 * Fine enveloppe Zustand par-dessus la logique PURE de `src/game/progression.ts` :
 * le store ne contient aucune règle métier, il délègue aux réducteurs purs.
 *
 * Persistance : middleware `persist` → localStorage. Le blob de progression est petit
 * et sérialisable ; Dexie reste réservé aux sauvegardes lourdes (graphe d'usine).
 * Seuls les champs de `ProgressionState` sont persistés (pas les actions ni les
 * notifications transitoires).
 */
interface ProgressionStore extends ProgressionState {
  /** Milestones franchis récemment, en attente d'affichage (transitoire, non persisté). */
  recentUnlocks: MilestoneDefinition[];

  /** Avance la progression d'un tick depuis l'usine live. */
  tick: (input: TickInput) => void;
  /** Applique les gains hors-ligne depuis la dernière session. Renvoie les AP gagnés. */
  applyOffline: (nowMs?: number) => number;
  /** Vide la file des déblocages récents (après affichage de la notification). */
  dismissUnlocks: () => void;
  /** Réinitialise toute la progression (debug / futur prestige). */
  reset: () => void;
}

export const useProgressionStore = create<ProgressionStore>()(
  persist(
    (set, get) => ({
      ...initialProgression(),
      recentUnlocks: [],

      tick: (input) =>
        set((state) => {
          const { state: next, newlyReached } = applyProductionTick(state, input);
          return {
            ...next,
            recentUnlocks:
              newlyReached.length > 0
                ? [...state.recentUnlocks, ...newlyReached]
                : state.recentUnlocks,
          };
        }),

      applyOffline: (nowMs = Date.now()) => {
        const { state: next, apGained } = applyOfflineGains(get(), nowMs);
        set(next);
        return apGained;
      },

      dismissUnlocks: () => set({ recentUnlocks: [] }),

      reset: () => set({ ...initialProgression(), recentUnlocks: [] }),
    }),
    {
      name: 'nf-progression',
      version: 1,
      // On ne persiste QUE l'état sérialisable, pas les actions ni recentUnlocks.
      partialize: (s): ProgressionState => ({
        automationPoints: s.automationPoints,
        cumulativeProduced: s.cumulativeProduced,
        reachedMilestones: s.reachedMilestones,
        unlockedBuildings: s.unlockedBuildings,
        unlockedRecipes: s.unlockedRecipes,
        lastSeenMs: s.lastSeenMs,
        lastApRatePerMin: s.lastApRatePerMin,
        prestigeCount: s.prestigeCount,
      }),
    },
  ),
);
