import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateResourceMap, type ResourceDeposit } from '@/game/resourceMap';
import { useGraphStore } from '@/store/useGraphStore';

/**
 * useWorldStore — la « carte du monde » de NodeFactory : les gisements de ressources.
 *
 * Mince enveloppe Zustand persistée (localStorage, comme `useProgressionStore`) au-dessus du
 * générateur PUR `generateResourceMap`. On ne mémorise que la graine + les gisements générés
 * → carte stable d'une session à l'autre, régénérable à la demande.
 *
 * Découplage : ce store lit `src/game` (générateur pur). Sa seule dépendance croisée est
 * `useGraphStore.unbindAllMiners()` lors d'une régénération (sinon des mineurs pointeraient
 * vers des gisements disparus) — même pattern de cross-store que la couche progression.
 */
interface WorldState {
  seed: number;
  deposits: ResourceDeposit[];

  /** Génère la carte au premier lancement (si elle est encore vide). */
  ensureGenerated: (rawItemIds: string[]) => void;
  /** Régénère une carte aléatoire (nouvelle graine) et détache tous les mineurs liés. */
  regenerate: (rawItemIds: string[]) => void;
}

const randomSeed = () => Math.floor(Math.random() * 0xffffffff);

export const useWorldStore = create<WorldState>()(
  persist(
    (set, get) => ({
      seed: 0,
      deposits: [],

      ensureGenerated: (rawItemIds) => {
        if (get().deposits.length > 0) return;
        const seed = get().seed || randomSeed();
        set({ seed, deposits: generateResourceMap(rawItemIds, seed) });
      },

      regenerate: (rawItemIds) => {
        const seed = randomSeed();
        useGraphStore.getState().unbindAllMiners();
        set({ seed, deposits: generateResourceMap(rawItemIds, seed) });
      },
    }),
    {
      // v2 : nouvel espacement des gisements/pins → on invalide les cartes v1 trop serrées
      // (persist sans `migrate` repart de l'état initial, donc `ensureGenerated` régénère).
      name: 'nf-world',
      version: 2,
      partialize: (s) => ({ seed: s.seed, deposits: s.deposits }),
    },
  ),
);
