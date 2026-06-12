/**
 * score.ts — Score d'efficacité de l'usine (le méta-jeu, différenciateur de NodeFactory).
 *
 * Compare l'usine COURANTE à l'optimum LP pour produire EXACTEMENT les mêmes sorties finales :
 *   - ressources brutes : usine vs solve(min ressources)
 *   - machines          : usine vs solve(min machines)
 *   - énergie           : usine vs solve(min énergie)
 * Chaque dimension = optimal/actuel ∈ [0, 1] (1.0 = aussi bon que l'optimum LP).
 *
 * DÉCOUPLAGE : `game` lit `solver` + `graph` (sens autorisé). Le solveur reste un LP pur.
 * Async (3 résolutions glpk WASM) → à appeler à la demande, pas à chaque frame.
 */

import type { Edge } from '@xyflow/react';
import type { GameData } from '@/data/types';
import type { MachineNode } from '@/store/useGraphStore';
import { computeFactory } from '@/graph/computeFactory';
import { solveDemands } from '@/solver';
import { computeEfficiencyScore, type EfficiencyScore } from './balance';

/**
 * Évalue le score d'efficacité de l'usine décrite par (nodes, edges).
 * Renvoie `null` si l'usine ne livre aucune sortie finale notable (rien à noter).
 *
 * @param allowedAlternates Recettes alternatives autorisées (= débloquées). L'optimum est
 *   calculé avec les mêmes options que celles dont dispose le joueur — le score reflète donc
 *   sa progression.
 */
export async function evaluateEfficiency(
  nodes: MachineNode[],
  edges: Edge[],
  game: GameData,
  allowedAlternates?: string[],
): Promise<EfficiencyScore | null> {
  // Calcul THÉORIQUE : le score compare la STRUCTURE de l'usine à l'optimum LP ;
  // l'alimentation électrique est un problème séparé (gating neutralisé).
  const summary = computeFactory(nodes, edges, game, new Map());
  const isRaw = (id: string) => game.items.find((i) => i.id === id)?.raw ?? false;

  // Sorties finales à reproduire = surplus non bruts (ce que l'usine livre réellement).
  const demands = new Map(
    summary.surplus.filter((s) => !isRaw(s.itemId)).map((s) => [s.itemId, s.ratePerMin]),
  );
  if (demands.size === 0) return null;

  // Optimum par dimension (chaque objectif minimise son propre axe).
  const [optRaw, optMachines, optEnergy] = await Promise.all([
    solveDemands(game, demands, 'raw-resources', allowedAlternates),
    solveDemands(game, demands, 'machines', allowedAlternates),
    solveDemands(game, demands, 'energy', allowedAlternates),
  ]);

  const actualRaw = summary.rawInputs.reduce((s, r) => s + r.ratePerMin, 0);
  const optimalRaw = optRaw.rawInputs.reduce((s, r) => s + r.rate, 0);

  return computeEfficiencyScore(
    actualRaw,
    optimalRaw,
    summary.totalMachines,
    optMachines.totalMachines,
    summary.totalPowerMW,
    optEnergy.totalPowerMW,
  );
}
