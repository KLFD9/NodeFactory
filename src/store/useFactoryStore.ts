import { create } from 'zustand';
import { loadGameData } from '@/data';
import type { GameData } from '@/data/types';
import type { Objective, SolveResult } from '@/solver';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface FactoryState {
  /** Données du jeu (lecture seule), chargées via la frontière unique. */
  gameData: GameData | null;
  dataStatus: Status;
  dataError: string | null;

  /** Saisie de la cible — façade ultra-simple. */
  targetItem: string;
  targetRate: number;
  objective: Objective;
  /** Recettes alternatives activées (toggle global/individuel). */
  enabledAlternates: Set<string>;

  /** Dernière solution calculée. */
  solution: SolveResult | null;
  solveError: string | null;

  loadData: () => Promise<void>;
  setTargetItem: (item: string) => void;
  setTargetRate: (rate: number) => void;
  setObjective: (objective: Objective) => void;
  toggleAlternate: (recipeId: string) => void;
}

export const useFactoryStore = create<FactoryState>((set) => ({
  gameData: null,
  dataStatus: 'idle',
  dataError: null,

  targetItem: '',
  targetRate: 60,
  objective: 'raw-resources',
  enabledAlternates: new Set<string>(),

  solution: null,
  solveError: null,

  loadData: async () => {
    set({ dataStatus: 'loading', dataError: null });
    try {
      const gameData = await loadGameData();
      set({ gameData, dataStatus: 'ready' });
    } catch (err) {
      set({ dataStatus: 'error', dataError: err instanceof Error ? err.message : String(err) });
    }
  },

  setTargetItem: (targetItem) => set({ targetItem }),
  setTargetRate: (targetRate) => set({ targetRate }),
  setObjective: (objective) => set({ objective }),
  toggleAlternate: (recipeId) =>
    set((state) => {
      const next = new Set(state.enabledAlternates);
      if (next.has(recipeId)) next.delete(recipeId);
      else next.add(recipeId);
      return { enabledAlternates: next };
    }),
}));
