import { describe, expect, it } from 'vitest';
import { generateResourceMap } from './resourceMap';
import { PURITY_MULTIPLIER } from '@/data/types';

const RAW = ['iron-ore', 'copper-ore', 'limestone', 'coal'];

describe('generateResourceMap', () => {
  it('est déterministe : même graine ⇒ même carte', () => {
    const a = generateResourceMap(RAW, 42);
    const b = generateResourceMap(RAW, 42);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('produit des gisements valides (ressource, pureté, 1-3 pins dans le rayon)', () => {
    const deposits = generateResourceMap(RAW, 7);
    for (const d of deposits) {
      expect(RAW).toContain(d.resourceId);
      expect(Object.keys(PURITY_MULTIPLIER)).toContain(d.purity);
      expect(d.pins.length).toBeGreaterThanOrEqual(1);
      expect(d.pins.length).toBeLessThanOrEqual(3);
      expect(d.radius).toBeGreaterThan(0);
      for (const pin of d.pins) {
        expect(Math.hypot(pin.x - d.x, pin.y - d.y)).toBeLessThanOrEqual(d.radius);
      }
      // Plusieurs pins d'un même gisement doivent être assez espacés pour des cards Miner.
      if (d.pins.length >= 2) {
        for (let i = 0; i < d.pins.length; i++) {
          for (let j = i + 1; j < d.pins.length; j++) {
            const gap = Math.hypot(d.pins[i].x - d.pins[j].x, d.pins[i].y - d.pins[j].y);
            expect(gap).toBeGreaterThanOrEqual(360);
          }
        }
      }
    }
  });

  it('garantit au moins un gisement par ressource brute', () => {
    for (const seed of [1, 7, 42, 123, 999]) {
      const deposits = generateResourceMap(RAW, seed);
      const resourceIds = new Set(deposits.map((d) => d.resourceId));
      for (const raw of RAW) {
        expect(resourceIds).toContain(raw);
      }
    }
  });

  it('respecte une distance minimale entre les centres', () => {
    const deposits = generateResourceMap(RAW, 123);
    for (let i = 0; i < deposits.length; i++) {
      for (let j = i + 1; j < deposits.length; j++) {
        const dist = Math.hypot(deposits[i].x - deposits[j].x, deposits[i].y - deposits[j].y);
        expect(dist).toBeGreaterThanOrEqual(500);
      }
    }
  });

  it('des graines différentes donnent des dispositions différentes', () => {
    const a = generateResourceMap(RAW, 1);
    const b = generateResourceMap(RAW, 2);
    expect(a).not.toEqual(b);
  });

  it('renvoie une carte vide si aucun item brut', () => {
    expect(generateResourceMap([], 5)).toEqual([]);
  });
});
