import GLPK, { type GLPK as GLPKInstance, type LP } from 'glpk.js';
import type { GameData, Recipe } from '@/data/types';
import {
  SolverError,
  type ItemFlow,
  type Objective,
  type RecipeSelection,
  type SolveRequest,
  type SolveResult,
} from './types';

export * from './types';

const EPS = 1e-7;
const round = (n: number) => Math.round(n * 1e6) / 1e6;

// glpk.js charge un module WASM : on l'instancie une seule fois.
let glpkInstance: GLPKInstance | null = null;
async function getGlpk(): Promise<GLPKInstance> {
  if (!glpkInstance) glpkInstance = await Promise.resolve(GLPK());
  return glpkInstance;
}

/** Recettes candidates = standards + alternatives autorisées (toutes si non précisé). */
function candidateRecipes(data: GameData, allowedAlternates?: string[]): Recipe[] {
  const allowAll = allowedAlternates === undefined;
  const allowed = new Set(allowedAlternates ?? []);
  return data.recipes.filter((r) => !r.alternate || allowAll || allowed.has(r.id));
}

/** Production nette d'un item par cycle pour une recette (produits − ingrédients). */
function netPerCycle(recipe: Recipe, itemId: string): number {
  const produced = recipe.products
    .filter((p) => p.item === itemId)
    .reduce((s, p) => s + p.amountPerCycle, 0);
  const consumed = recipe.ingredients
    .filter((i) => i.item === itemId)
    .reduce((s, i) => s + i.amountPerCycle, 0);
  return produced - consumed;
}

/** Coefficient objectif d'une recette (par cycle/min de la variable). */
function objectiveCoef(recipe: Recipe, objective: Objective, data: GameData): number {
  const rawSet = new Set(data.items.filter((i) => i.raw).map((i) => i.id));
  switch (objective) {
    case 'raw-resources':
      // Total de ressources brutes consommées par cycle.
      return recipe.ingredients
        .filter((i) => rawSet.has(i.item))
        .reduce((s, i) => s + i.amountPerCycle, 0);
    case 'machines':
      // Fraction de machine par cycle/min : time / 60.
      return recipe.time / 60;
    case 'energy': {
      const power = data.buildings.find((b) => b.id === recipe.producedIn)?.powerMW ?? 0;
      return (recipe.time / 60) * power;
    }
  }
}

/**
 * Résout le plan de production optimal par programmation linéaire (glpk.js).
 *
 * Formulation :
 *  - Variable r_i ≥ 0 = nombre de cycles/min de la recette candidate i.
 *  - Demande : Σ_i net_i(cible) · r_i ≥ targetRate.
 *  - Bilans : pour chaque item intermédiaire J (ni brut, ni cible),
 *    Σ_i net_i(J) · r_i ≥ 0 (production ≥ consommation ; surplus autorisé).
 *  - Ressources brutes : aucune contrainte (importables librement).
 *  - Objectif : min ressources brutes (défaut) | min machines | min énergie.
 *
 * Fonction PURE et DÉTERMINISTE (hors chargement WASM), sans dépendance UI.
 */
export async function solveFactory(request: SolveRequest): Promise<SolveResult> {
  const { data, targetItem, targetRate, objective } = request;

  if (!data.items.some((i) => i.id === targetItem)) {
    throw new SolverError(`Item cible inconnu : "${targetItem}".`);
  }
  if (targetRate <= 0) {
    return { selections: [], rawInputs: [], surplus: [], totalPowerMW: 0, totalMachines: 0 };
  }

  const recipes = candidateRecipes(data, request.allowedAlternates);
  const rawSet = new Set(data.items.filter((i) => i.raw).map((i) => i.id));
  const glpk = await getGlpk();

  // Nommage indexé pour éviter tout souci de caractères dans les ids.
  const varName = (i: number) => `r${i}`;

  const objVars = recipes.map((r, i) => ({
    name: varName(i),
    coef: objectiveCoef(r, objective, data),
  }));

  const subjectTo: LP['subjectTo'] = [];

  // Contrainte de demande sur l'item cible.
  const demandVars = recipes
    .map((r, i) => ({ name: varName(i), coef: netPerCycle(r, targetItem) }))
    .filter((v) => v.coef !== 0);
  if (demandVars.length === 0) {
    throw new SolverError(`Aucune recette ne produit "${targetItem}" : cible infaisable.`);
  }
  subjectTo.push({
    name: 'demand',
    vars: demandVars,
    bnds: { type: glpk.GLP_LO, lb: targetRate, ub: 0 },
  });

  // Bilans des items intermédiaires (ni bruts, ni cible).
  for (const item of data.items) {
    if (item.raw || item.id === targetItem) continue;
    const vars = recipes
      .map((r, i) => ({ name: varName(i), coef: netPerCycle(r, item.id) }))
      .filter((v) => v.coef !== 0);
    if (vars.length === 0) continue;
    subjectTo.push({ name: `bal_${item.id}`, vars, bnds: { type: glpk.GLP_LO, lb: 0, ub: 0 } });
  }

  const lp: LP = {
    name: 'factory',
    objective: { direction: glpk.GLP_MIN, name: 'cost', vars: objVars },
    subjectTo,
    bounds: recipes.map((_, i) => ({ name: varName(i), type: glpk.GLP_LO, lb: 0, ub: 0 })),
  };

  // glpk.solve est synchrone sous Node mais renvoie une Promise dans le navigateur
  // (build WASM/worker) : on couvre les deux cas.
  const res = await Promise.resolve(glpk.solve(lp, { msglev: glpk.GLP_MSG_OFF, presol: true }));
  if (!res?.result) {
    throw new SolverError('Réponse du solveur invalide (glpk.js).');
  }
  const { status, vars } = res.result;
  if (status !== glpk.GLP_OPT && status !== glpk.GLP_FEAS) {
    throw new SolverError(
      `Cible infaisable : impossible de produire ${targetRate}/min de "${targetItem}".`,
    );
  }

  // Reconstruction de la solution.
  const rates = recipes.map((_, i) => vars[varName(i)] ?? 0);

  const selections: RecipeSelection[] = [];
  let totalMachines = 0;
  let totalPowerMW = 0;
  recipes.forEach((recipe, i) => {
    const runs = rates[i];
    if (runs <= EPS) return;
    const building = data.buildings.find((b) => b.id === recipe.producedIn);
    const machineCount = Math.ceil(round(runs * (recipe.time / 60)));
    const powerMW = machineCount * (building?.powerMW ?? 0);
    totalMachines += machineCount;
    totalPowerMW += powerMW;
    selections.push({
      recipeId: recipe.id,
      runsPerMinute: round(runs),
      machineCount,
      building: recipe.producedIn,
      powerMW,
    });
  });

  // Ressources brutes importées = consommation nette des items bruts.
  const rawInputs: ItemFlow[] = [];
  for (const rawId of rawSet) {
    let consumed = 0;
    recipes.forEach((recipe, i) => {
      if (rates[i] <= EPS) return;
      consumed += recipe.ingredients
        .filter((ing) => ing.item === rawId)
        .reduce((s, ing) => s + ing.amountPerCycle, 0) * rates[i];
    });
    if (consumed > EPS) rawInputs.push({ item: rawId, rate: round(consumed) });
  }

  // Surplus = production nette au-delà du besoin (cible : au-delà de la demande).
  const surplus: ItemFlow[] = [];
  for (const item of data.items) {
    if (item.raw) continue;
    let net = 0;
    recipes.forEach((recipe, i) => {
      if (rates[i] <= EPS) return;
      net += netPerCycle(recipe, item.id) * rates[i];
    });
    const expected = item.id === targetItem ? targetRate : 0;
    const extra = round(net - expected);
    if (extra > EPS) surplus.push({ item: item.id, rate: extra });
  }

  return {
    selections,
    rawInputs: rawInputs.sort((a, b) => b.rate - a.rate),
    surplus: surplus.sort((a, b) => b.rate - a.rate),
    totalPowerMW: round(totalPowerMW),
    totalMachines,
  };
}
