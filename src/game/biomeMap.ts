/**
 * src/game/biomeMap.ts — Génération PURE des biomes couvrant la carte.
 *
 * Un biome = une région polygonale (diagramme de Voronoï) recouvrant TOUT le champ de jeu
 * (`[-FIELD, FIELD]²`, avec marge `BOUNDS`). Chaque région porte soit une affinité vers une
 * ressource brute (les gisements de cette ressource sont préférentiellement placés dedans,
 * cf `resourceMap.ts`), soit aucune (zone « neutre »).
 *
 * Découplage : fonction déterministe, sans React/store. `useWorldStore` mémorise le résultat ;
 * `BiomeLayer` ne fait que le dessiner.
 */

/** Un point [x, y] en coordonnées flow. */
type Point = [number, number];

/** Une région de biome : polygone fermé (placement) + dégradé radial (rendu) + affinité. */
export interface BiomeRegion {
  id: string;
  /** Ressource brute pour laquelle cette région a une affinité de placement, ou `null` = zone neutre. */
  affinity: string | null;
  color: string;
  /** Centre du dégradé radial (= graine Voronoï), coordonnées flow. */
  center: Point;
  /** Rayon du dégradé radial (px flow) — chevauche les régions voisines pour un fondu continu. */
  radius: number;
  /** Polygone fermé (sans point de fermeture dupliqué), coordonnées flow — utilisé pour le biais de placement. */
  polygon: Point[];
}

/** PRNG déterministe minimal (mulberry32) — même graine ⇒ même suite. Partagé avec `resourceMap`. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Zone de génération des gisements (coordonnées flow), partagée avec `resourceMap`. */
export const FIELD = 2600; // x,y ∈ [-FIELD, FIELD]

/** Étendue des biomes : déborde légèrement de `FIELD` pour couvrir tout le champ jouable sans bord visible. */
export const BOUNDS = FIELD * 1.25;

/** Couleurs de biome par ressource brute — miroir de `RESOURCE_COLOR` (ResourceLayer), en très faible opacité au rendu. */
const BIOME_COLOR: Record<string, string> = {
  'iron-ore': '#f59e0b',
  'copper-ore': '#fb7185',
  limestone: '#d6c39a',
  coal: '#71717a',
};
const NEUTRAL_COLOR = '#3f3f46';

/** Nombre de régions neutres ajoutées en plus d'une région par ressource brute. */
const NEUTRAL_COUNT = 2;

/** Clippe un polygone par le demi-plan « plus proche de `a` que de `b` » (Sutherland-Hodgman). */
function clipByBisector(poly: Point[], a: Point, b: Point): Point[] {
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dir: Point = [b[0] - a[0], b[1] - a[1]];
  const side = (p: Point) => (p[0] - mid[0]) * dir[0] + (p[1] - mid[1]) * dir[1];

  const result: Point[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i];
    const next = poly[(i + 1) % poly.length];
    const curSide = side(cur);
    const nextSide = side(next);
    if (curSide <= 0) result.push(cur);
    if ((curSide <= 0) !== (nextSide <= 0)) {
      const t = curSide / (curSide - nextSide);
      result.push([cur[0] + t * (next[0] - cur[0]), cur[1] + t * (next[1] - cur[1])]);
    }
  }
  return result;
}

/** Test point-dans-polygone (ray casting). */
export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi !== yj && p[1] >= Math.min(yi, yj) && p[1] < Math.max(yi, yj)) {
      const x = xi + ((p[1] - yi) / (yj - yi)) * (xj - xi);
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}

/**
 * Tire un point uniforme dans le polygone par rejet (boîte englobante), borné à `FIELD`.
 * Renvoie `null` si aucun point valide n'est trouvé après `attempts` essais.
 */
export function samplePointInPolygon(poly: Point[], rng: () => number, attempts = 20): Point | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of poly) {
    minX = Math.min(minX, x, -FIELD);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y, -FIELD);
    maxY = Math.max(maxY, y);
  }
  minX = Math.max(minX, -FIELD);
  maxX = Math.min(maxX, FIELD);
  minY = Math.max(minY, -FIELD);
  maxY = Math.min(maxY, FIELD);
  if (minX >= maxX || minY >= maxY) return null;

  for (let i = 0; i < attempts; i++) {
    const p: Point = [minX + rng() * (maxX - minX), minY + rng() * (maxY - minY)];
    if (pointInPolygon(p, poly)) return p;
  }
  return null;
}

/**
 * Génère le pavage de biomes recouvrant `[-FIELD, FIELD]²` (déborde jusqu'à `BOUNDS`).
 *
 * Les graines sont placées sur une grille grossière + bruit (jamais de cellule géante ni
 * minuscule), puis le diagramme de Voronoï est obtenu par clipping demi-plan successif.
 * Une région par ressource brute reçoit une affinité ; le reste est neutre.
 */
export function generateBiomeMap(rawItemIds: string[], seed: number): BiomeRegion[] {
  if (rawItemIds.length === 0) return [];
  const rng = mulberry32(seed);

  const n = rawItemIds.length + NEUTRAL_COUNT;
  const cols = Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const cellW = (2 * FIELD) / cols;
  const cellH = (2 * FIELD) / rows;

  const seeds: Point[] = [];
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = -FIELD + cellW * (col + 0.5) + (rng() - 0.5) * cellW * 0.5;
    const cy = -FIELD + cellH * (row + 0.5) + (rng() - 0.5) * cellH * 0.5;
    seeds.push([cx, cy]);
  }

  // Affecte une affinité par ressource brute à des cellules distinctes tirées au hasard.
  const affinities: Array<string | null> = new Array(n).fill(null);
  const slots = seeds.map((_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  rawItemIds.forEach((resourceId, k) => {
    affinities[slots[k]] = resourceId;
  });

  const boundingBox: Point[] = [
    [-BOUNDS, -BOUNDS],
    [BOUNDS, -BOUNDS],
    [BOUNDS, BOUNDS],
    [-BOUNDS, BOUNDS],
  ];

  return seeds.map((seedPoint, i) => {
    let poly = boundingBox;
    for (let j = 0; j < seeds.length; j++) {
      if (j === i) continue;
      poly = clipByBisector(poly, seedPoint, seeds[j]);
    }
    const affinity = affinities[i];
    // Rayon = distance moyenne graine → sommets de sa cellule, avec chevauchement généreux pour
    // un fondu continu entre régions voisines (pas de bord net, ni de trou entre elles).
    const avgVertexDist =
      poly.reduce((sum, [x, y]) => sum + Math.hypot(x - seedPoint[0], y - seedPoint[1]), 0) / poly.length;
    return {
      id: `biome-${i}`,
      affinity,
      color: affinity ? BIOME_COLOR[affinity] ?? NEUTRAL_COLOR : NEUTRAL_COLOR,
      center: seedPoint,
      radius: avgVertexDist * 1.9,
      polygon: poly,
    };
  });
}
