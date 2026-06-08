import type { GameData, Id } from '@/data/types';

/** Critère d'optimisation choisi par l'utilisateur. Défaut : minimiser les ressources brutes. */
export type Objective = 'raw-resources' | 'machines' | 'energy';

/** Entrée du solveur — pure, sérialisable, sans dépendance React. */
export interface SolveRequest {
  data: GameData;
  /** Item à produire. */
  targetItem: Id;
  /** Débit cible, en items/minute. */
  targetRate: number;
  objective: Objective;
  /**
   * Recettes alternatives autorisées. Si absent, toutes les alternatives sont autorisées.
   * Permet le toggle global/individuel demandé par le brief.
   */
  allowedAlternates?: Id[];
}

/** Une recette retenue par le solveur, avec son taux résolu. */
export interface RecipeSelection {
  recipeId: Id;
  /** Taux d'exécution résolu, en cycles/minute. */
  runsPerMinute: number;
  /** Débit de la recette, en exécutions/minute rapporté à une machine. */
  machineCount: number;
  building: Id;
  powerMW: number;
}

/** Flux d'un item (production ou consommation), en items/minute. */
export interface ItemFlow {
  item: Id;
  rate: number;
}

/** Sortie du solveur — déterministe pour une entrée donnée. */
export interface SolveResult {
  selections: RecipeSelection[];
  /** Ressources brutes importées, en items/minute. */
  rawInputs: ItemFlow[];
  /** Sous-produits/surplus non consommés, en items/minute. */
  surplus: ItemFlow[];
  totalPowerMW: number;
  totalMachines: number;
}

export class SolverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolverError';
  }
}
