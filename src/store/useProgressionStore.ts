import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  applyOfflineGains,
  applyProductionTick,
  initialProgression,
  trySpendAP,
  type ProgressionState,
  type TickInput,
} from '@/game/progression';
import { shouldShowOfflineRecap, type MilestoneDefinition } from '@/game/balance';

/** Récapitulatif des gains hors-ligne, en attente d'affichage (transitoire). */
export interface OfflineRecap {
  /** AP crédités pour la période hors-ligne (déjà plafonnés à 4 h). */
  apGained: number;
  /** Durée hors-ligne créditée, en minutes (≤ plafond 240). */
  minutesCredited: number;
}

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
  /** Récap offline à afficher à la reconnexion (null = rien à montrer ; non persisté). */
  offlineRecap: OfflineRecap | null;

  /** Avance la progression d'un tick depuis l'usine live. */
  tick: (input: TickInput) => void;
  /** Applique les gains hors-ligne depuis la dernière session. Renvoie les AP gagnés. */
  applyOffline: (nowMs?: number) => number;
  /** Vide la file des déblocages récents (après affichage de la notification). */
  dismissUnlocks: () => void;
  /** Ferme la popup récap offline. */
  dismissOfflineRecap: () => void;
  /** Tente de dépenser `cost` AP (coût de pose). Renvoie true si débité, false si solde insuffisant. */
  spendAP: (cost: number) => boolean;
  /** Réinitialise toute la progression (debug / futur prestige). */
  reset: () => void;
}

export const useProgressionStore = create<ProgressionStore>()(
  persist(
    (set, get) => ({
      ...initialProgression(),
      recentUnlocks: [],
      offlineRecap: null,

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
        const { state: next, apGained, minutesCredited } = applyOfflineGains(get(), nowMs);
        set({
          ...next,
          // Récap visible seulement si l'absence vaut la peine d'être racontée
          // (jamais de modale pour un simple reload de quelques secondes).
          offlineRecap: shouldShowOfflineRecap(apGained, minutesCredited)
            ? { apGained, minutesCredited }
            : get().offlineRecap,
        });
        return apGained;
      },

      dismissUnlocks: () => set({ recentUnlocks: [] }),

      dismissOfflineRecap: () => set({ offlineRecap: null }),

      spendAP: (cost) => {
        const { state: next, spent } = trySpendAP(get(), cost);
        if (spent) set(next);
        return spent;
      },

      reset: () => set({ ...initialProgression(), recentUnlocks: [], offlineRecap: null }),
    }),
    {
      name: 'nf-progression',
      version: 1,
      // On ne persiste QUE l'état sérialisable, pas les actions ni recentUnlocks.
      partialize: (s): ProgressionState => ({
        automationPoints: s.automationPoints,
        cumulativeProduced: s.cumulativeProduced,
        nodeCumulativeProduced: s.nodeCumulativeProduced,
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
