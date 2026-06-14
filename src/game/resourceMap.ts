/**
 * src/game/resourceMap.ts — Génération PURE de la carte des gisements de ressources.
 *
 * Un gisement = une zone d'extraction posée sur le canvas, porteuse d'une ressource brute et
 * d'une pureté. Il expose 1-3 « pins » (points d'extraction) sur lesquels on pose un mineur ;
 * le mineur hérite alors automatiquement de la ressource + pureté du gisement.
 *
 * Découplage : fonction déterministe, sans React/store. Prend la liste des items bruts
 * (depuis `GameData`) + une graine, renvoie des gisements en coordonnées « flow » (mêmes
 * unités que `node.position` de React Flow). La couche UE (`ResourceLayer`) ne fait que les
 * dessiner ; le store monde ne fait que les mémoriser.
 */

import type { Purity } from '@/data/types';
import { FIELD, generateBiomeMap, mulberry32, samplePointInPolygon, type BiomeRegion } from './biomeMap';

/** Un point d'extraction sur un gisement, en coordonnées flow. */
export interface ResourcePin {
  x: number;
  y: number;
}

/** Un gisement de ressource généré sur la carte. */
export interface ResourceDeposit {
  id: string;
  /** Item brut extrait (iron-ore, copper-ore, limestone, coal…). */
  resourceId: string;
  purity: Purity;
  /** Centre du gisement, en coordonnées flow. */
  x: number;
  y: number;
  /** Rayon visuel (px flow) — délimite la zone où tombent les pins. */
  radius: number;
  /** 1 à 3 pins, situés à l'intérieur du rayon. */
  pins: ResourcePin[];
}

/** Pondération des puretés : Normal majoritaire, « pure » rare (1/8). */
const PURITY_TABLE: Purity[] = [
  'impure',
  'impure',
  'normal',
  'normal',
  'normal',
  'normal',
  'normal',
  'pure',
];

/**
 * Écart minimal entre centres (coordonnées flow, cf `FIELD` dans `biomeMap`). Volontairement
 * grand pour laisser de la place AUTOUR des gisements (construire les lignes de production
 * entre eux). MIN_CENTER_GAP > 2×rayon max + marge ⇒ les zones d'extraction ne se chevauchent
 * jamais.
 */
const DEPOSIT_COUNT = 8;
const MIN_CENTER_GAP = 1100; // distance minimale entre deux centres
const PLACEMENT_ATTEMPTS = 60;
/** Écart entre les 2 pins d'un même gisement (≥ largeur d'une card Miner ~240px + marge). */
const PIN_SEPARATION = 380;

/** Probabilité de tirer le centre d'un gisement dans une région de biome affine à sa ressource. */
const BIOME_AFFINITY_CHANCE = 0.7;

/** Tire un centre candidat : dans une région affine à `resourceId` si possible, sinon uniforme sur `FIELD`. */
function rollCenter(rng: () => number, resourceId: string, biomes: BiomeRegion[]): [number, number] {
  const affineRegions = biomes.filter((b) => b.affinity === resourceId);
  if (affineRegions.length > 0 && rng() < BIOME_AFFINITY_CHANCE) {
    const region = affineRegions[Math.floor(rng() * affineRegions.length)];
    const point = samplePointInPolygon(region.polygon, rng);
    if (point) return point;
  }
  return [(rng() * 2 - 1) * FIELD, (rng() * 2 - 1) * FIELD];
}

/**
 * Génère la carte des gisements de manière déterministe.
 * @param rawItemIds ids des items bruts disponibles (au moins 1).
 * @param seed graine du PRNG (carte stable pour une graine donnée).
 */
export function generateResourceMap(rawItemIds: string[], seed: number): ResourceDeposit[] {
  if (rawItemIds.length === 0) return [];
  const biomes = generateBiomeMap(rawItemIds, seed);
  const rng = mulberry32(seed);
  const deposits: ResourceDeposit[] = [];

  // Au moins un gisement par ressource brute : on garantit les premiers slots, les suivants
  // tirent une ressource au hasard. S'il y a plus de ressources que de slots, on agrandit.
  const totalSlots = Math.max(DEPOSIT_COUNT, rawItemIds.length);
  const order = rawItemIds.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  for (let i = 0; i < totalSlots; i++) {
    const guaranteed = i < order.length;
    const resourceId = guaranteed
      ? rawItemIds[order[i]]
      : rawItemIds[Math.floor(rng() * rawItemIds.length)];

    // Place un centre en respectant une distance minimale. Pour les ressources garanties, on
    // relâche progressivement la distance minimale plutôt que de sauter ce gisement.
    let cx = 0;
    let cy = 0;
    let placed = false;
    let gap = MIN_CENTER_GAP;
    const rounds = guaranteed ? 3 : 1;
    for (let round = 0; round < rounds && !placed; round++) {
      for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
        [cx, cy] = rollCenter(rng, resourceId, biomes);
        if (deposits.every((d) => Math.hypot(d.x - cx, d.y - cy) >= gap)) {
          placed = true;
          break;
        }
      }
      gap /= 2;
    }
    if (!placed) {
      if (!guaranteed) continue;
      // Dernier recours : on place quand même, position déjà tirée au sort.
    }

    const purity = PURITY_TABLE[Math.floor(rng() * PURITY_TABLE.length)];
    // 1 à 3 pins par gisement.
    const roll = rng();
    const pinCount = roll < 0.3 ? 1 : roll < 0.7 ? 2 : 3;
    // Plus de pins ⇒ blob plus grand pour contenir tous les mineurs sans chevauchement.
    const radius = (pinCount === 3 ? 360 : pinCount === 2 ? 280 : 200) + rng() * 80;

    const pins: ResourcePin[] = [];
    if (pinCount === 1) {
      pins.push({ x: cx, y: cy });
    } else if (pinCount === 2) {
      // Deux pins symétriques par rapport au centre, séparés d'au moins une card Miner.
      const angle = rng() * Math.PI * 2;
      const dx = (Math.cos(angle) * PIN_SEPARATION) / 2;
      const dy = (Math.sin(angle) * PIN_SEPARATION) / 2;
      pins.push({ x: cx + dx, y: cy + dy });
      pins.push({ x: cx - dx, y: cy - dy });
    } else {
      // Trois pins en triangle équilatéral, côté ≥ PIN_SEPARATION.
      const baseAngle = rng() * Math.PI * 2;
      const r = PIN_SEPARATION / Math.sqrt(3);
      for (let k = 0; k < 3; k++) {
        const angle = baseAngle + (k * Math.PI * 2) / 3;
        pins.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
      }
    }

    deposits.push({
      id: `dep-${i}`,
      resourceId,
      purity,
      x: cx,
      y: cy,
      radius,
      pins,
    });
  }

  return deposits;
}
