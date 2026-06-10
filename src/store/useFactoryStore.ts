import { create } from 'zustand';
import { loadGameData } from '@/data';
import type { GameData } from '@/data/types';
import type { Objective } from '@/solver';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface FactoryState {
  /** Données du jeu (lecture seule), chargées via la frontière unique. */
  gameData: GameData | null;
  dataStatus: Status;
  dataError: string | null;

  /**
   * Critère d'optimisation de l'assistance LP (« Compléter l'usine »).
   * Défaut : minimiser les ressources brutes.
   */
  objective: Objective;

  loadData: () => Promise<void>;
  setObjective: (objective: Objective) => void;
}

export const useFactoryStore = create<FactoryState>((set) => ({
  gameData: null,
  dataStatus: 'idle',
  dataError: null,

  objective: 'raw-resources',

  loadData: async () => {
    set({ dataStatus: 'loading', dataError: null });
    try {
      const gameData = await loadGameData();
      set({ gameData, dataStatus: 'ready' });
    } catch (err) {
      set({ dataStatus: 'error', dataError: err instanceof Error ? err.message : String(err) });
    }
  },

  setObjective: (objective) => set({ objective }),
}));
