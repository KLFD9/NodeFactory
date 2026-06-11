import { describe, expect, it } from 'vitest';
import { TUTORIAL_STEPS, currentTutorialStep, type TutorialSnapshot } from './tutorial';

const snap = (partial: Partial<TutorialSnapshot> = {}): TutorialSnapshot => ({
  hasIronMiner: false,
  hasSmelter: false,
  smelterFed: false,
  m1Reached: false,
  ...partial,
});

describe('tutorial', () => {
  it('4 étapes définies, ids uniques', () => {
    expect(TUTORIAL_STEPS).toHaveLength(4);
    expect(new Set(TUTORIAL_STEPS.map((s) => s.id)).size).toBe(4);
  });

  it('départ à zéro → étape 0 (extraire)', () => {
    expect(currentTutorialStep(snap())).toBe(0);
  });

  it('mineur lié → étape 1 (fondre)', () => {
    expect(currentTutorialStep(snap({ hasIronMiner: true }))).toBe(1);
  });

  it('mineur + smelter → étape 2 (relier)', () => {
    expect(currentTutorialStep(snap({ hasIronMiner: true, hasSmelter: true }))).toBe(2);
  });

  it('chaîne reliée → étape 3 (laisser tourner)', () => {
    expect(
      currentTutorialStep(snap({ hasIronMiner: true, hasSmelter: true, smelterFed: true })),
    ).toBe(3);
  });

  it('M1 atteint → terminé (-1), quel que soit le reste', () => {
    expect(currentTutorialStep(snap({ m1Reached: true }))).toBe(-1);
    expect(
      currentTutorialStep(
        snap({ hasIronMiner: true, hasSmelter: true, smelterFed: true, m1Reached: true }),
      ),
    ).toBe(-1);
  });

  it('dérivé, pas scripté : supprimer le smelter fait reculer à l’étape 1', () => {
    const before = snap({ hasIronMiner: true, hasSmelter: true, smelterFed: true });
    expect(currentTutorialStep(before)).toBe(3);
    const after = snap({ hasIronMiner: true, hasSmelter: false, smelterFed: false });
    expect(currentTutorialStep(after)).toBe(1);
  });
});
