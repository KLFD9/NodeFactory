import { describe, expect, it } from 'vitest';
import { BOUNDS, FIELD, generateBiomeMap, pointInPolygon } from './biomeMap';

const RAW = ['iron-ore', 'copper-ore', 'limestone', 'coal'];

describe('generateBiomeMap', () => {
  it('est déterministe : même graine ⇒ même pavage', () => {
    const a = generateBiomeMap(RAW, 42);
    const b = generateBiomeMap(RAW, 42);
    expect(a).toEqual(b);
  });

  it('renvoie un pavage vide si aucun item brut', () => {
    expect(generateBiomeMap([], 5)).toEqual([]);
  });

  it('produit une région par ressource brute (affinité unique) + des régions neutres', () => {
    const biomes = generateBiomeMap(RAW, 7);
    const affinities = biomes.map((b) => b.affinity).filter((a): a is string => a !== null);
    expect(new Set(affinities)).toEqual(new Set(RAW));
    expect(affinities.length).toBe(RAW.length);
    expect(biomes.some((b) => b.affinity === null)).toBe(true);
  });

  it('chaque région est un polygone valide contenu dans BOUNDS, avec un rayon de dégradé positif', () => {
    const biomes = generateBiomeMap(RAW, 123);
    for (const b of biomes) {
      expect(b.polygon.length).toBeGreaterThanOrEqual(3);
      for (const [x, y] of b.polygon) {
        expect(Math.abs(x)).toBeLessThanOrEqual(BOUNDS + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(BOUNDS + 1e-6);
      }
      expect(b.radius).toBeGreaterThan(0);
      expect(b.center.length).toBe(2);
    }
  });

  it('le pavage recouvre le centre de la carte (un polygone contient (0,0))', () => {
    const biomes = generateBiomeMap(RAW, 99);
    expect(biomes.some((b) => pointInPolygon([0, 0], b.polygon))).toBe(true);
  });

  it('recouvre tout le champ jouable : les coins de FIELD appartiennent à une région', () => {
    const biomes = generateBiomeMap(RAW, 1);
    const corners: Array<[number, number]> = [
      [-FIELD, -FIELD],
      [FIELD, -FIELD],
      [-FIELD, FIELD],
      [FIELD, FIELD],
    ];
    for (const corner of corners) {
      expect(biomes.some((b) => pointInPolygon(corner, b.polygon))).toBe(true);
    }
  });
});
