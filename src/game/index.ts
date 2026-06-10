/**
 * src/game/index.ts — Point d'entrée de la couche jeu NodeFactory.
 *
 * Exporte toutes les primitives d'équilibrage depuis balance.ts.
 * Consommé par useProgressionStore (Zustand) et d'éventuels futurs modules de jeu.
 *
 * Découplage : ce module peut lire src/data et src/solver ; jamais l'inverse.
 */

export * from './balance';
export * from './progression';
export * from './resourceMap';
