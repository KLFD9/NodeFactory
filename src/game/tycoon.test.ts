import { describe, it, expect } from 'vitest';
import {
  MODEL_TYPES,
  DOMAINS,
  TRAINING_PHASES,
  modelTypeDef,
  normalizeAllocation,
  allocationSum,
  rollMarketTrend,
  trendMatchOf,
  initialTycoon,
  startProject,
  advanceTycoon,
  shipModel,
  reviewModel,
  computeModelQuality,
  runProgress,
  isRunComplete,
  TREND_TTL_GAME_MIN,
  BASE_REVENUE,
  HYPE_BASE,
  HYPE_MAX,
  marketingCost,
  applyMarketing,
  canMarket,
  initialStaff,
  hireStaffState,
  labSpeedMult,
  labDatasetMult,
  labQualityBonus,
  totalSalaryPerMin,
  STAFF_ROLES,
  RESEARCHER_QUALITY_CAP,
  type PhaseAllocation,
  type ActiveProject,
  type ProjectConfig,
} from './tycoon';

/** Fabrique un ActiveProject de test (champs requis, surchargés au besoin). */
function makeProject(over: Partial<ActiveProject> = {}): ActiveProject {
  const def = modelTypeDef('language');
  return {
    id: 'm1',
    modelType: 'language',
    domain: 'assistant',
    effort: def.idealEffort,
    computeRequired: def.computeRequired,
    computeInvested: def.computeRequired,
    datasetKeyItemId: def.keyDatasetItemId,
    datasetAccumulated: def.computeRequired * 0.5,
    startedAtGameMin: 0,
    hype: HYPE_BASE,
    ...over,
  };
}

const uniform: PhaseAllocation = {
  pretraining: 0.25,
  finetuning: 0.25,
  alignment: 0.25,
  evaluation: 0.25,
};

function languageIdealConfig(): ProjectConfig {
  return {
    modelType: 'language',
    domain: 'assistant',
    effort: modelTypeDef('language').idealEffort,
  };
}

describe('catalogue de données', () => {
  it('chaque type de modèle a un dosage idéal qui somme à 1', () => {
    for (const t of MODEL_TYPES) {
      expect(allocationSum(t.idealEffort)).toBeCloseTo(1, 6);
    }
  });

  it('chaque type a un compute requis positif et un item-dataset clé', () => {
    for (const t of MODEL_TYPES) {
      expect(t.computeRequired).toBeGreaterThan(0);
      expect(t.keyDatasetItemId.length).toBeGreaterThan(0);
    }
  });

  it('il y a 4 phases et au moins 2 domaines', () => {
    expect(TRAINING_PHASES).toHaveLength(4);
    expect(DOMAINS.length).toBeGreaterThanOrEqual(2);
  });
});

describe('normalizeAllocation', () => {
  it('normalise une répartition non normalisée à une somme de 1', () => {
    const a = normalizeAllocation({ pretraining: 2, finetuning: 2, alignment: 0, evaluation: 0 });
    expect(allocationSum(a)).toBeCloseTo(1, 6);
    expect(a.pretraining).toBeCloseTo(0.5, 6);
  });

  it('une répartition nulle retombe sur un mix uniforme', () => {
    const a = normalizeAllocation({ pretraining: 0, finetuning: 0, alignment: 0, evaluation: 0 });
    expect(a).toEqual(uniform);
  });
});

describe('tendance de marché', () => {
  it('rollMarketTrend est déterministe', () => {
    expect(rollMarketTrend(123)).toEqual(rollMarketTrend(123));
  });

  it('trendMatchOf détecte alignement complet / type seul / aucun', () => {
    const trend = { modelType: 'language' as const, domain: 'assistant' as const };
    expect(trendMatchOf(trend, 'language', 'assistant')).toBe('full');
    expect(trendMatchOf(trend, 'language', 'research')).toBe('type');
    expect(trendMatchOf(trend, 'vision', 'assistant')).toBe('none');
  });
});

describe('cycle de vie du projet', () => {
  it('startProject crée un run vide normalisé', () => {
    const t = initialTycoon(1);
    const next = startProject(t, languageIdealConfig(), 0);
    expect(next.activeProject).not.toBeNull();
    expect(next.activeProject!.computeInvested).toBe(0);
    expect(next.activeProject!.computeRequired).toBe(modelTypeDef('language').computeRequired);
    expect(allocationSum(next.activeProject!.effort)).toBeCloseTo(1, 6);
    expect(next.activeProject!.datasetKeyItemId).toBe('iron-ingot');
  });

  it('startProject refuse un 2e projet si un run est déjà actif', () => {
    const t = startProject(initialTycoon(1), languageIdealConfig(), 0);
    const again = startProject(t, { ...languageIdealConfig(), modelType: 'vision' }, 5);
    expect(again.activeProject!.modelType).toBe('language');
  });

  it('advanceTycoon accumule compute et dataset au débit fourni', () => {
    const t = startProject(initialTycoon(1), languageIdealConfig(), 0);
    const { tycoon } = advanceTycoon(t, {
      computeThroughputPerMin: 30,
      keyItemProductionPerMin: 20,
      dtMin: 2,
      gameMinutesElapsed: 2,
    });
    expect(tycoon.activeProject!.computeInvested).toBe(60);
    expect(tycoon.activeProject!.datasetAccumulated).toBe(40);
  });

  it('runProgress et isRunComplete reflètent le compute accumulé', () => {
    const p = makeProject({ computeRequired: 100, computeInvested: 50, datasetAccumulated: 0 });
    expect(runProgress(p)).toBeCloseTo(0.5, 6);
    expect(isRunComplete(p)).toBe(false);
    expect(isRunComplete({ ...p, computeInvested: 100 })).toBe(true);
  });

  it('advanceTycoon signale runJustCompleted une seule fois', () => {
    let t = startProject(initialTycoon(1), languageIdealConfig(), 0);
    const required = t.activeProject!.computeRequired;
    // Tick qui termine le run.
    const r1 = advanceTycoon(t, {
      computeThroughputPerMin: required,
      keyItemProductionPerMin: 0,
      dtMin: 1,
      gameMinutesElapsed: 1,
    });
    expect(r1.runJustCompleted).toBe(true);
    t = r1.tycoon;
    // Tick suivant : déjà terminé, plus de signal.
    const r2 = advanceTycoon(t, {
      computeThroughputPerMin: required,
      keyItemProductionPerMin: 0,
      dtMin: 1,
      gameMinutesElapsed: 2,
    });
    expect(r2.runJustCompleted).toBe(false);
  });
});

describe('qualité du modèle', () => {
  const completedProject = makeProject;

  it('dosage idéal + dataset complet → qualité quasi parfaite', () => {
    const q = computeModelQuality(completedProject());
    expect(q.phaseMixScore).toBeCloseTo(1, 6);
    expect(q.datasetScore).toBeCloseTo(1, 6);
    expect(q.computeScore).toBeCloseTo(1, 6);
    expect(q.quality).toBeGreaterThan(0.95);
  });

  it('mauvais dosage des phases réduit la qualité', () => {
    const bad = completedProject({
      effort: { pretraining: 0, finetuning: 0, alignment: 0, evaluation: 1 },
    });
    const good = completedProject();
    expect(computeModelQuality(bad).quality).toBeLessThan(computeModelQuality(good).quality);
  });

  it('dataset insuffisant réduit la qualité (lien avec l’usine)', () => {
    const starved = completedProject({ datasetAccumulated: 0 });
    expect(computeModelQuality(starved).datasetScore).toBe(0);
    expect(computeModelQuality(starved).quality).toBeLessThan(
      computeModelQuality(completedProject()).quality,
    );
  });

  it('évaluation négligée applique une pénalité de défauts', () => {
    // Dosage sans évaluation du tout (eval = 0) → defectPenalty > 0.
    const noEval = completedProject({
      effort: { pretraining: 0.6, finetuning: 0.3, alignment: 0.1, evaluation: 0 },
    });
    expect(computeModelQuality(noEval).defectPenalty).toBeGreaterThan(0);
  });
});

describe('ship & review', () => {
  it('shipModel refuse un run non terminé', () => {
    const t = startProject(initialTycoon(1), languageIdealConfig(), 0);
    expect(shipModel(t, 1)).toBeNull();
  });

  it('shipModel finalise le projet et met à jour renommée / benchmark', () => {
    // Tendance forcée pour un alignement complet (revenu non nul garanti).
    const base = initialTycoon(1);
    const t0: typeof base = { ...base, trend: { modelType: 'language', domain: 'assistant' } };
    let t = startProject(t0, languageIdealConfig(), 0);
    t = { ...t, activeProject: { ...t.activeProject!, computeInvested: t.activeProject!.computeRequired, datasetAccumulated: t.activeProject!.computeRequired * 0.5 } };

    const result = shipModel(t, 10);
    expect(result).not.toBeNull();
    const { tycoon, review } = result!;
    expect(tycoon.activeProject).toBeNull();
    expect(tycoon.shippedModels).toBe(1);
    expect(review.benchmark).toBeGreaterThan(90);
    expect(review.trendMatch).toBe('full');
    expect(review.revenue).toBeGreaterThan(0);
    expect(review.rpReward).toBeGreaterThan(0);
    expect(tycoon.renown).toBe(review.renownDelta);
    expect(tycoon.bestBenchmark).toBe(review.benchmark);
    expect(tycoon.lastReview).toEqual(review);
  });

  it('un modèle aligné sur la tendance reçoit une meilleure réception qu’à contre-courant', () => {
    const base = initialTycoon(1);
    // Dataset volontairement faible → qualité < 1 pour que le multiplicateur de tendance
    // ne soit pas absorbé par le plafond de réception.
    const project = makeProject({ computeRequired: 100, computeInvested: 100, datasetAccumulated: 0 });
    const aligned = reviewModel(
      { ...base, trend: { modelType: 'language', domain: 'assistant' } },
      project,
    );
    const off = reviewModel(
      { ...base, trend: { modelType: 'vision', domain: 'image-gen' } },
      project,
    );
    expect(aligned.reception).toBeGreaterThan(off.reception);
    expect(aligned.revenue).toBeGreaterThan(off.revenue);
  });

  it('la renommée majore les revenus (base d’utilisateurs)', () => {
    const project = makeProject({ computeRequired: 100, computeInvested: 100, datasetAccumulated: 50 });
    const trend = { modelType: 'language' as const, domain: 'assistant' as const };
    const rookie = reviewModel({ ...initialTycoon(1), trend, renown: 0 }, project);
    const famous = reviewModel({ ...initialTycoon(1), trend, renown: 50 }, project);
    expect(famous.revenue).toBeGreaterThan(rookie.revenue);
    expect(rookie.revenue).toBeLessThanOrEqual(BASE_REVENUE);
  });
});

describe('tendance — rafraîchissement', () => {
  it('la tendance change quand elle est périmée et qu’aucun run n’est actif', () => {
    const t = initialTycoon(1);
    const { tycoon } = advanceTycoon(t, {
      computeThroughputPerMin: 0,
      keyItemProductionPerMin: 0,
      dtMin: 0,
      gameMinutesElapsed: TREND_TTL_GAME_MIN + 1,
    });
    expect(tycoon.trendSetAtGameMin).toBe(TREND_TTL_GAME_MIN + 1);
  });

  it('la tendance ne change pas pendant un run actif', () => {
    const t = startProject(initialTycoon(1), languageIdealConfig(), 0);
    const { tycoon } = advanceTycoon(t, {
      computeThroughputPerMin: 10,
      keyItemProductionPerMin: 0,
      dtMin: 1,
      gameMinutesElapsed: TREND_TTL_GAME_MIN + 100,
    });
    expect(tycoon.trend).toEqual(t.trend);
  });
});

describe('hype / marketing', () => {
  it('un nouveau projet démarre à hype de base', () => {
    const t = startProject(initialTycoon(1), languageIdealConfig(), 0);
    expect(t.activeProject!.hype).toBe(HYPE_BASE);
  });

  it('applyMarketing monte le hype vers le plafond, avec rendements décroissants', () => {
    let p = makeProject({ hype: HYPE_BASE });
    const h1 = applyMarketing(p).hype;
    p = applyMarketing(p);
    const gain1 = h1 - HYPE_BASE;
    const gain2 = applyMarketing(p).hype - p.hype;
    expect(h1).toBeGreaterThan(HYPE_BASE);
    expect(h1).toBeLessThan(HYPE_MAX);
    // Chaque poussée rapporte moins que la précédente (approche du plafond).
    expect(gain2).toBeLessThan(gain1);
  });

  it('le coût marketing augmente avec le hype', () => {
    expect(marketingCost(HYPE_MAX)).toBeGreaterThan(marketingCost(HYPE_BASE));
  });

  it('canMarket est faux une fois le plafond atteint', () => {
    expect(canMarket(makeProject({ hype: HYPE_MAX }))).toBe(false);
    expect(canMarket(makeProject({ hype: HYPE_BASE }))).toBe(true);
  });

  it('le hype amplifie la réception (et donc les revenus) au ship', () => {
    const trend = { modelType: 'language' as const, domain: 'assistant' as const };
    const tycoon = { ...initialTycoon(1), trend };
    // Qualité < 1 pour que le hype ne soit pas absorbé par le plafond de réception.
    const lowHype = reviewModel(tycoon, makeProject({ datasetAccumulated: 0, hype: HYPE_BASE }));
    const highHype = reviewModel(tycoon, makeProject({ datasetAccumulated: 0, hype: HYPE_MAX }));
    expect(highHype.reception).toBeGreaterThan(lowHype.reception);
    expect(highHype.revenue).toBeGreaterThan(lowHype.revenue);
  });
});

describe('staff', () => {
  it('effectifs de départ à zéro, masse salariale nulle', () => {
    const staff = initialStaff();
    expect(totalSalaryPerMin(staff)).toBe(0);
    expect(labSpeedMult(staff)).toBe(1);
    expect(labDatasetMult(staff)).toBe(1);
    expect(labQualityBonus(staff)).toBe(0);
  });

  it('embaucher un ingénieur accélère le run (speedMult > 1)', () => {
    const staff = hireStaffState(initialStaff(), 'engineer');
    expect(labSpeedMult(staff)).toBeGreaterThan(1);
    expect(totalSalaryPerMin(staff)).toBe(STAFF_ROLES.find((r) => r.id === 'engineer')!.salaryPerMin);
  });

  it('embaucher un data scientist améliore l’efficacité du dataset', () => {
    expect(labDatasetMult(hireStaffState(initialStaff(), 'data-scientist'))).toBeGreaterThan(1);
  });

  it('les chercheurs ajoutent un bonus de qualité plafonné', () => {
    let staff = initialStaff();
    for (let i = 0; i < 50; i++) staff = hireStaffState(staff, 'researcher');
    expect(labQualityBonus(staff)).toBe(RESEARCHER_QUALITY_CAP);
  });

  it('le bonus chercheur relève la qualité d’un modèle', () => {
    const p = makeProject({ datasetAccumulated: 0 }); // qualité < 1, marge pour le bonus
    const without = computeModelQuality(p).quality;
    const withBonus = computeModelQuality(p, labQualityBonus(hireStaffState(initialStaff(), 'researcher'))).quality;
    expect(withBonus).toBeGreaterThan(without);
  });

  it('la masse salariale cumule les rôles', () => {
    let staff = initialStaff();
    staff = hireStaffState(staff, 'engineer');
    staff = hireStaffState(staff, 'researcher');
    const expected =
      STAFF_ROLES.find((r) => r.id === 'engineer')!.salaryPerMin +
      STAFF_ROLES.find((r) => r.id === 'researcher')!.salaryPerMin;
    expect(totalSalaryPerMin(staff)).toBeCloseTo(expected, 6);
  });
});
