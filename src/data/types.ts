/**
 * Schéma des données du jeu — SOURCE DE VÉRITÉ UNIQUE pour le format.
 *
 * Tout le reste de l'appli (solveur, graphe, UI) consomme ces types et ignore
 * totalement d'où viennent les données. Le mock et les futures données réelles
 * extraites de Docs.json partagent EXACTEMENT cette forme : remplacer le mock
 * ne doit toucher qu'au chargeur (`loadGameData`), jamais ces types.
 */

/** Identifiant stable d'un item, bâtiment, etc. (kebab-case). */
export type Id = string;

/**
 * Catégorie logique d'un item — guide l'UI et le solveur (raw = importable brut).
 * 'energy' : sortie virtuelle non consommable (ex. "Electricity"), utilisée comme
 * `products` factice pour les recettes de générateurs (satisfait le validateur
 * « toute recette a un produit » sans introduire un item physique transportable).
 */
export type ItemCategory = 'raw' | 'ingot' | 'part' | 'fluid' | 'energy';

export interface GameItem {
  id: Id;
  name: string;
  category: ItemCategory;
  /** true si l'item est une ressource brute extractible (minerai, calcaire…). */
  raw: boolean;
}

/**
 * Catégorie d'un bâtiment — structure la palette de l'éditeur de nœuds.
 * 'power' : générateur électrique (Coal Generator, etc.).
 */
export type BuildingCategory = 'extraction' | 'smelting' | 'manufacturing' | 'logistics' | 'power';

/** Encombrement au sol (en mètres), tel qu'affiché sur les fiches du jeu. */
export interface BuildingDimensions {
  width: number;
  length: number;
  height: number;
}

export interface Building {
  id: Id;
  name: string;
  category: BuildingCategory;
  /**
   * Puissance électrique nominale, en MW.
   * CONVENTION : pour `category === 'power'`, `powerMW` représente la
   * GÉNÉRATION (MW produits par le générateur). Pour toute autre catégorie,
   * `powerMW` représente la CONSOMMATION (MW tirés du réseau).
   */
  powerMW: number;
  /** Nombre de ports d'entrée / de sortie (façade logistique). */
  inputs?: number;
  outputs?: number;
  dimensions?: BuildingDimensions;
  /**
   * Extracteurs uniquement : débit de base à pureté Normale (items/min).
   * Débit réel = extractionBasePerMin × multiplicateur de pureté.
   */
  extractionBasePerMin?: number;
}

/** Pureté d'un nœud de ressource. */
export type Purity = 'impure' | 'normal' | 'pure';

/** Multiplicateur de débit d'extraction par pureté (brief §3). */
export const PURITY_MULTIPLIER: Record<Purity, number> = {
  impure: 0.5,
  normal: 1,
  pure: 2,
};

/** Une entrée ou sortie de recette, exprimée par CYCLE (pas par minute). */
export interface RecipeIO {
  item: Id;
  amountPerCycle: number;
}

export interface Recipe {
  id: Id;
  name: string;
  /** Recette alternative (déverrouillée par disques durs) vs recette standard. */
  alternate: boolean;
  /** Durée d'un cycle, en secondes. */
  time: number;
  /** Bâtiment dans lequel la recette s'exécute. */
  producedIn: Id;
  ingredients: RecipeIO[];
  products: RecipeIO[];
}

/** Convoyeur — un tier de transport avec sa capacité. */
export interface Belt {
  id: Id;
  name: string;
  /** Mk1..Mk6 → 1..6. */
  tier: number;
  /** Capacité en items/minute. */
  capacityPerMin: number;
}

export interface Generator {
  id: Id;
  name: string;
  /** Carburant consommé (id d'item), si applicable. */
  fuel?: Id;
  /** Puissance produite, en MW. */
  powerMW: number;
}

/** Le bundle complet renvoyé par `loadGameData()`. */
export interface GameData {
  items: GameItem[];
  buildings: Building[];
  recipes: Recipe[];
  belts: Belt[];
  generators: Generator[];
}

/** Débit d'un produit/ingrédient en items/minute : amountPerCycle * 60 / time. */
export function ratePerMinute(amountPerCycle: number, timeSeconds: number): number {
  return (amountPerCycle * 60) / timeSeconds;
}
