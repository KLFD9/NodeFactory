/**
 * src/game/resourceMap.ts — Génération PURE de la carte des gisements de ressources.
 *
 * Un gisement = une tache organique colorée posée sur le canvas, porteuse d'une ressource
 * brute et d'une pureté. Il expose 1-2 « pins » (points d'extraction) sur lesquels on pose
 * un mineur ; le mineur hérite alors automatiquement de la ressource + pureté du gisement.
 *
 * Découplage : fonction déterministe, sans React/store. Prend la liste des items bruts
 * (depuis `GameData`) + une graine, renvoie des gisements en coordonnées « flow » (mêmes
 * unités que `node.position` de React Flow). La couche UE (`ResourceLayer`) ne fait que les
 * dessiner ; le store monde ne fait que les mémoriser.
 */

import type { Purity } from '@/data/types';

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
  /** Centre du blob, en coordonnées flow. */
  x: number;
  y: number;
  /** Rayon visuel (px flow). */
  radius: number;
  /** Path SVG d'une forme organique, dans un viewBox normalisé `-1 -1 2 2` (rayon ≈ 1). */
  blobPath: string;
  /** 1 à 2 pins, situés à l'intérieur du blob. */
  pins: ResourcePin[];
}

/** PRNG déterministe minimal (mulberry32) — même graine ⇒ même suite. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pondération des puretés : Normal majoritaire, extrêmes plus rares. */
const PURITY_TABLE: Purity[] = [
  'impure',
  'normal',
  'normal',
  'normal',
  'pure',
];

/**
 * Zone de génération (coordonnées flow). Volontairement large + grand écart minimal entre
 * centres pour laisser de la place AUTOUR des gisements (construire les lignes de production
 * entre eux). MIN_CENTER_GAP > 2×rayon max + marge ⇒ les blobs ne se chevauchent jamais.
 */
const FIELD = 2600; // x,y ∈ [-FIELD, FIELD]
const DEPOSIT_COUNT = 8;
const MIN_CENTER_GAP = 1100; // distance minimale entre deux centres
const PLACEMENT_ATTEMPTS = 60;
/** Écart entre les 2 pins d'un même gisement (≥ largeur d'une card Miner ~240px + marge). */
const PIN_SEPARATION = 380;

/** Construit un path SVG organique (rayon ≈ 1) à partir du PRNG. */
function blobPath(rng: () => number): string {
  const points = 9;
  const coords: Array<[number, number]> = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = 0.78 + rng() * 0.22; // rayon bruité entre 0.78 et 1.0
    coords.push([Math.cos(angle) * r, Math.sin(angle) * r]);
  }
  // Courbe fermée lissée (Catmull-Rom → cubic Bézier approx via points milieux).
  let d = '';
  for (let i = 0; i < coords.length; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[(i + 1) % coords.length];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    if (i === 0) d += `M ${mx.toFixed(3)} ${my.toFixed(3)} `;
    d += `Q ${x1.toFixed(3)} ${y1.toFixed(3)} ${((x1 + coords[(i + 2) % coords.length][0]) / 2).toFixed(3)} ${((y1 + coords[(i + 2) % coords.length][1]) / 2).toFixed(3)} `;
  }
  return d + 'Z';
}

/**
 * Génère la carte des gisements de manière déterministe.
 * @param rawItemIds ids des items bruts disponibles (au moins 1).
 * @param seed graine du PRNG (carte stable pour une graine donnée).
 */
export function generateResourceMap(rawItemIds: string[], seed: number): ResourceDeposit[] {
  if (rawItemIds.length === 0) return [];
  const rng = mulberry32(seed);
  const deposits: ResourceDeposit[] = [];

  for (let i = 0; i < DEPOSIT_COUNT; i++) {
    // Place un centre en respectant une distance minimale (échec → on saute ce gisement).
    let cx = 0;
    let cy = 0;
    let placed = false;
    for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt++) {
      cx = (rng() * 2 - 1) * FIELD;
      cy = (rng() * 2 - 1) * FIELD;
      if (deposits.every((d) => Math.hypot(d.x - cx, d.y - cy) >= MIN_CENTER_GAP)) {
        placed = true;
        break;
      }
    }
    if (!placed) continue;

    const resourceId = rawItemIds[Math.floor(rng() * rawItemIds.length)];
    const purity = PURITY_TABLE[Math.floor(rng() * PURITY_TABLE.length)];
    const pinCount = rng() < 0.5 ? 1 : 2;
    // Gisement à 2 pins → plus grand pour contenir les deux mineurs sans chevauchement.
    const radius = (pinCount === 2 ? 280 : 200) + rng() * 80;

    const pins: ResourcePin[] = [];
    if (pinCount === 1) {
      pins.push({ x: cx, y: cy });
    } else {
      // Deux pins symétriques par rapport au centre, séparés d'au moins une card Miner.
      const angle = rng() * Math.PI * 2;
      const dx = (Math.cos(angle) * PIN_SEPARATION) / 2;
      const dy = (Math.sin(angle) * PIN_SEPARATION) / 2;
      pins.push({ x: cx + dx, y: cy + dy });
      pins.push({ x: cx - dx, y: cy - dy });
    }

    deposits.push({
      id: `dep-${i}`,
      resourceId,
      purity,
      x: cx,
      y: cy,
      radius,
      blobPath: blobPath(rng),
      pins,
    });
  }

  return deposits;
}
