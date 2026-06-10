import { useEffect, useRef } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { computeFactory } from '@/graph/computeFactory';
import { computeNodeInfo } from '@/graph/nodeInfo';

/** Intervalle du tick de progression (ms). 1 s = accrual fluide sans surcoût. */
const TICK_MS = 1000;

/**
 * useProgressionTick — branche la couche jeu sur l'usine live.
 *
 * 1. Au montage : crédite les gains hors-ligne accumulés depuis la dernière session.
 * 2. Puis, chaque seconde : calcule le bilan de l'usine (computeFactory) et fait
 *    avancer la progression (production cumulée → milestones, AP accrus).
 *
 * Lit les stores via getState() dans l'intervalle pour toujours voir le graphe à jour
 * sans se réabonner à chaque changement de node.
 *
 * EFFICACITÉ (proxy) : `surplus / (surplus + deficits)`. Une usine sans déficit tourne à
 * 100 % ; un goulot d'étranglement (déficit interne) réduit le taux d'AP — JAMAIS la
 * production d'items (la physique reste vraie). À remplacer plus tard par l'efficacité
 * machine exacte de NodeFlowContext.
 */
export function useProgressionTick(): void {
  const offlineAppliedRef = useRef(false);

  useEffect(() => {
    // 1. Gains hors-ligne, une seule fois au démarrage.
    if (!offlineAppliedRef.current) {
      offlineAppliedRef.current = true;
      useProgressionStore.getState().applyOffline();
    }

    let lastTime = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const dtMin = (now - lastTime) / 60_000;
      lastTime = now;

      const gameData = useFactoryStore.getState().gameData;
      const { nodes, edges } = useGraphStore.getState();
      if (!gameData || nodes.length === 0) return;

      const summary = computeFactory(nodes, edges, gameData);
      const outThroughput = summary.surplus.reduce((s, f) => s + f.ratePerMin, 0);
      const deficitThroughput = summary.deficits.reduce((s, f) => s + f.ratePerMin, 0);
      const denom = outThroughput + deficitThroughput;
      const efficiency = denom > 0 ? outThroughput / denom : 1;

      // Calcul de la production de chaque machine
      const nodeProductions: { nodeId: string; itemId: string; ratePerMin: number }[] = [];
      for (const node of nodes) {
        const info = computeNodeInfo(node.data, gameData);
        if (!info.building || info.building.category === 'logistics' || !info.configured) continue;
        const count = Math.max(1, node.data.count ?? 1);
        for (const out of info.outputs) {
          nodeProductions.push({
            nodeId: node.id,
            itemId: out.itemId,
            ratePerMin: out.ratePerMin * count,
          });
        }
      }

      useProgressionStore.getState().tick({
        grossProduction: summary.production.map((f) => ({
          itemId: f.itemId,
          ratePerMin: f.ratePerMin,
        })),
        nodeProductions,
        totalOutputPerMin: outThroughput,
        efficiency,
        dtMin,
        nowMs: now,
      });
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);
}
