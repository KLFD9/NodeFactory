import { describe, expect, it } from 'vitest';
import { TUTORIAL_SECTIONS, TUTORIAL_STEPS, currentTutorialStep, type TutorialSnapshot } from './tutorial';

const snap = (partial: Partial<TutorialSnapshot> = {}): TutorialSnapshot => ({
  hasCoalMiner: false,
  hasCoalGenerator: false,
  coalGenFed: false,
  coalLoopPowered: false,
  hasIronMiner: false,
  hasSmelter: false,
  smelterFed: false,
  chainPowered: false,
  m1Reached: false,
  ...partial,
});

describe('tutorial', () => {
  it('9 étapes définies, ids uniques, réparties sur 3 sections (dans l’ordre)', () => {
    expect(TUTORIAL_STEPS).toHaveLength(9);
    expect(new Set(TUTORIAL_STEPS.map((s) => s.id)).size).toBe(9);
    expect(TUTORIAL_SECTIONS).toHaveLength(3);
    expect(new Set(TUTORIAL_STEPS.map((s) => s.section))).toEqual(new Set(TUTORIAL_SECTIONS));
    // Chaque section forme un bloc contigu, dans l'ordre de TUTORIAL_SECTIONS.
    const sectionSeq = TUTORIAL_STEPS.map((s) => s.section);
    const firstIndex = (section: string) => sectionSeq.indexOf(section);
    const lastIndex = (section: string) => sectionSeq.lastIndexOf(section);
    for (let i = 0; i < TUTORIAL_SECTIONS.length - 1; i++) {
      expect(lastIndex(TUTORIAL_SECTIONS[i])).toBeLessThan(firstIndex(TUTORIAL_SECTIONS[i + 1]));
    }
  });

  it('départ à zéro → étape 0 (extraire le charbon)', () => {
    expect(currentTutorialStep(snap())).toBe(0);
  });

  it('mineur de charbon → étape 1 (poser le générateur)', () => {
    expect(currentTutorialStep(snap({ hasCoalMiner: true }))).toBe(1);
  });

  it('générateur posé et configuré → étape 2 (alimenter en charbon)', () => {
    expect(currentTutorialStep(snap({ hasCoalMiner: true, hasCoalGenerator: true }))).toBe(2);
  });

  it('générateur nourri en charbon → étape 3 (boucler le réseau)', () => {
    expect(
      currentTutorialStep(snap({ hasCoalMiner: true, hasCoalGenerator: true, coalGenFed: true })),
    ).toBe(3);
  });

  it('boucle électrique bouclée → étape 4 (extraire le fer)', () => {
    expect(
      currentTutorialStep(
        snap({ hasCoalMiner: true, hasCoalGenerator: true, coalGenFed: true, coalLoopPowered: true }),
      ),
    ).toBe(4);
  });

  const electricityDone = (): Partial<TutorialSnapshot> => ({
    hasCoalMiner: true,
    hasCoalGenerator: true,
    coalGenFed: true,
    coalLoopPowered: true,
  });

  it('mineur de fer → étape 5 (fondre)', () => {
    expect(currentTutorialStep(snap({ ...electricityDone(), hasIronMiner: true }))).toBe(5);
  });

  it('mineur + smelter → étape 6 (relier)', () => {
    expect(
      currentTutorialStep(snap({ ...electricityDone(), hasIronMiner: true, hasSmelter: true })),
    ).toBe(6);
  });

  it('chaîne reliée mais hors tension → étape 7 (brancher le courant)', () => {
    expect(
      currentTutorialStep(
        snap({ ...electricityDone(), hasIronMiner: true, hasSmelter: true, smelterFed: true }),
      ),
    ).toBe(7);
  });

  it('chaîne sous tension → étape 8 (laisser tourner)', () => {
    expect(
      currentTutorialStep(
        snap({
          ...electricityDone(),
          hasIronMiner: true,
          hasSmelter: true,
          smelterFed: true,
          chainPowered: true,
        }),
      ),
    ).toBe(8);
  });

  it('M1 atteint → terminé (-1), quel que soit le reste', () => {
    expect(currentTutorialStep(snap({ m1Reached: true }))).toBe(-1);
    expect(
      currentTutorialStep(
        snap({
          ...electricityDone(),
          hasIronMiner: true,
          hasSmelter: true,
          smelterFed: true,
          chainPowered: true,
          m1Reached: true,
        }),
      ),
    ).toBe(-1);
  });

  it('dérivé, pas scripté : supprimer le smelter fait reculer à l’étape 5', () => {
    const before = snap({
      ...electricityDone(),
      hasIronMiner: true,
      hasSmelter: true,
      smelterFed: true,
      chainPowered: true,
    });
    expect(currentTutorialStep(before)).toBe(8);
    const after = snap({ ...electricityDone(), hasIronMiner: true, hasSmelter: false });
    expect(currentTutorialStep(after)).toBe(5);
  });
});
