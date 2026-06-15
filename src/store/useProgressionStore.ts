import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  acceptContract,
  applyOfflineGains,
  applyProductionTick,
  initialProgression,
  trySpendBolts,
  startModelProject,
  shipModelProject,
  runMarketingPush,
  hireStaffMember,
  type ProgressionState,
  type TickInput,
} from '@/game/progression';
import {
  STARTING_BOLTS,
  STARTING_RP,
  shouldShowOfflineRecap,
  EARLY_PRODUCTION_MICRO_MILESTONES,
  type MilestoneDefinition,
  type ProductionMicroMilestone,
} from '@/game/balance';
import type { ContractOffer } from '@/game/contracts';
import { initialTycoon, type ProjectConfig, type ModelReview, type StaffRole } from '@/game/tycoon';

/** Récapitulatif des gains hors-ligne, en attente d'affichage (transitoire). */
export interface OfflineRecap {
  /** RP crédités pour la période hors-ligne (déjà plafonnés à 4 h). */
  rpGained: number;
  /** Durée hors-ligne créditée, en minutes (≤ plafond 240). */
  minutesCredited: number;
}

/** Résultat de contrat à notifier (réussite ou échec), transitoire. */
export interface ContractResult {
  offer: ContractOffer;
  outcome: 'completed' | 'failed';
}

/**
 * useProgressionStore — état de jeu (progression) de NodeFactory.
 *
 * Fine enveloppe Zustand par-dessus la logique PURE de `src/game/progression.ts` :
 * le store ne contient aucune règle métier, il délègue aux réducteurs purs.
 *
 * Persistance : middleware `persist` → localStorage. Le blob de progression est petit
 * et sérialisable ; Dexie reste réservé aux sauvegardes lourdes (graphe d'usine).
 * Seuls les champs de `ProgressionState` sont persistés (pas les actions ni les
 * notifications transitoires).
 */
interface ProgressionStore extends ProgressionState {
  /** Milestones franchis récemment, en attente d'affichage (transitoire, non persisté). */
  recentUnlocks: MilestoneDefinition[];
  /** Micro-jalons (sous M1) franchis récemment, en attente d'affichage (transitoire, non persisté). */
  recentMicroMilestones: ProductionMicroMilestone[];
  /** Récap offline à afficher à la reconnexion (null = rien à montrer ; non persisté). */
  offlineRecap: OfflineRecap | null;
  /** Résultat de contrat à notifier (réussite/échec), transitoire. */
  contractResult: ContractResult | null;
  /** Le run d'entraînement vient de se terminer (toast « prêt à shipper »), transitoire. */
  runCompletedFlash: boolean;
  /** Review du dernier modèle shippé, en attente d'affichage (modale), transitoire. */
  shipReview: ModelReview | null;

  /** Avance la progression d'un tick depuis l'usine live. */
  tick: (input: TickInput) => void;
  /** Applique les gains hors-ligne depuis la dernière session. Renvoie les RP gagnés. */
  applyOffline: (nowMs?: number) => number;
  /** Accepte une offre de contrat (1 actif max). */
  acceptContract: (offerId: string) => void;
  /** Vide la file des déblocages récents (après affichage de la notification). */
  dismissUnlocks: () => void;
  /** Vide la file des micro-jalons récents (après affichage du toast). */
  dismissMicroMilestones: () => void;
  /** Ferme la popup récap offline. */
  dismissOfflineRecap: () => void;
  /** Ferme la notification de résultat de contrat. */
  dismissContractResult: () => void;
  /** Démarre un projet de modèle (couche Tycoon). */
  startProject: (config: ProjectConfig) => void;
  /** Shippe le projet actif (run terminé requis). Renvoie la review, ou null si non prêt. */
  shipModel: () => ModelReview | null;
  /** Lance une poussée marketing sur le projet actif (monte le hype). true si payé. */
  runMarketing: () => boolean;
  /** Embauche un membre du staff. true si payé (solde suffisant). */
  hireStaff: (role: StaffRole) => boolean;
  /** Ferme le flash « run terminé ». */
  dismissRunCompleted: () => void;
  /** Ferme la modale de review de modèle shippé. */
  dismissShipReview: () => void;
  /** Marque l'écran d'accueil comme vu (premier lancement). */
  markWelcomeSeen: () => void;
  /** Passe le tutoriel manuellement. */
  dismissTutorial: () => void;
  /** Tente de dépenser `cost` Bolts (pose, améliorations). true si débité, false sinon. */
  spendBolts: (cost: number) => boolean;
  /** Réinitialise toute la progression (debug / futur prestige). */
  reset: () => void;
}

export const useProgressionStore = create<ProgressionStore>()(
  persist(
    (set, get) => ({
      ...initialProgression(),
      recentUnlocks: [],
      recentMicroMilestones: [],
      offlineRecap: null,
      contractResult: null,
      runCompletedFlash: false,
      shipReview: null,

      tick: (input) =>
        set((state) => {
          const {
            state: next,
            newlyReached,
            newlyReachedMicro,
            contractCompleted,
            contractFailed,
            runJustCompleted,
          } = applyProductionTick(state, input);
          const result: ContractResult | null = contractCompleted
            ? { offer: contractCompleted, outcome: 'completed' }
            : contractFailed
              ? { offer: contractFailed, outcome: 'failed' }
              : state.contractResult;
          return {
            ...next,
            contractResult: result,
            runCompletedFlash: runJustCompleted ? true : state.runCompletedFlash,
            recentUnlocks:
              newlyReached.length > 0
                ? [...state.recentUnlocks, ...newlyReached]
                : state.recentUnlocks,
            recentMicroMilestones:
              newlyReachedMicro.length > 0
                ? [...state.recentMicroMilestones, ...newlyReachedMicro]
                : state.recentMicroMilestones,
          };
        }),

      applyOffline: (nowMs = Date.now()) => {
        const { state: next, rpGained, minutesCredited } = applyOfflineGains(get(), nowMs);
        set({
          ...next,
          // Récap visible seulement si l'absence vaut la peine d'être racontée
          // (jamais de modale pour un simple reload de quelques secondes).
          offlineRecap: shouldShowOfflineRecap(rpGained, minutesCredited)
            ? { rpGained, minutesCredited }
            : get().offlineRecap,
        });
        return rpGained;
      },

      acceptContract: (offerId) => set((state) => acceptContract(state, offerId)),

      dismissUnlocks: () => set({ recentUnlocks: [] }),

      dismissMicroMilestones: () => set({ recentMicroMilestones: [] }),

      dismissOfflineRecap: () => set({ offlineRecap: null }),

      dismissContractResult: () => set({ contractResult: null }),

      startProject: (config) => set((state) => startModelProject(state, config)),

      shipModel: () => {
        const { state: next, review } = shipModelProject(get());
        if (review) set({ ...next, shipReview: review, runCompletedFlash: false });
        return review;
      },

      runMarketing: () => {
        const { state: next, spent } = runMarketingPush(get());
        if (spent) set(next);
        return spent;
      },

      hireStaff: (role) => {
        const { state: next, spent } = hireStaffMember(get(), role);
        if (spent) set(next);
        return spent;
      },

      dismissRunCompleted: () => set({ runCompletedFlash: false }),

      dismissShipReview: () => set({ shipReview: null }),

      markWelcomeSeen: () => set({ welcomeSeen: true }),

      dismissTutorial: () => set({ tutorialDismissed: true }),

      spendBolts: (cost) => {
        const { state: next, spent } = trySpendBolts(get(), cost);
        if (spent) set(next);
        return spent;
      },

      reset: () =>
        set({
          ...initialProgression(),
          recentUnlocks: [],
          recentMicroMilestones: [],
          offlineRecap: null,
          contractResult: null,
          runCompletedFlash: false,
          shipReview: null,
        }),
    }),
    {
      name: 'nf-progression',
      version: 7,
      migrate: (persisted, version) => {
        const s = persisted as Record<string, unknown>;
        // v1 → v2 (refonte monnaies) : les anciens AP deviennent des Points de Recherche
        // (même origine : la production) ; le joueur reçoit le capital initial de Bolts.
        if (version < 2) {
          s.researchPoints = (s.automationPoints as number) ?? 0;
          s.bolts = STARTING_BOLTS;
          s.lastRpRatePerMin = (s.lastApRatePerMin as number) ?? 0;
          delete s.automationPoints;
          delete s.lastApRatePerMin;
        }
        // v2 → v3 (contrats) : champs par défaut, le cycle de contrats redémarre proprement.
        if (version < 3) {
          s.gameMinutesElapsed = 0;
          s.reputation = 0;
          s.contractsCompleted = 0;
          s.activeContract = null;
          s.contractOffers = [];
          s.contractSeed = (Date.now() >>> 0) || 1;
          s.offersGeneratedAtGameMin = 0;
          if (s.researchPoints == null) s.researchPoints = STARTING_RP;
        }
        // v3 → v4 (stock d'entrepôt) : nouveau champ `itemStock`, et `activeContract` change
        // de forme (`acceptedAtProduced` → `delivered`) → on relance le contrat en cours
        // proprement (le joueur le voit revenir dans les offres).
        if (version < 4) {
          s.itemStock = {};
          s.activeContract = null;
          s.contractOffers = [];
          s.offersGeneratedAtGameMin = 0;
        }
        // v4 → v5 (micro-jalons hook) : nouveau champ. Une partie déjà avancée (M1 franchi)
        // a typiquement dépassé les seuils — on les marque tous vus pour ne pas spammer au
        // retour ; une partie neuve (aucun lingot) repart à [] et verra les toasts normalement.
        if (version < 5) {
          const ingots = ((s.cumulativeProduced as Record<string, number>) ?? {})['iron-ingot'] ?? 0;
          s.reachedMicroMilestones = ingots > 0
            ? EARLY_PRODUCTION_MICRO_MILESTONES.filter((mm) => ingots >= mm.target).map((mm) => mm.id)
            : [];
        }
        // v5 → v6 (couche Tycoon « Le Bureau ») : nouvel état tycoon. Une partie existante
        // repart avec aucun projet et une tendance fraîche — rien à reconstruire (le run
        // n'existait pas avant). Graine dérivée de l'horloge pour varier la tendance.
        if (version < 6) {
          s.tycoon = initialTycoon(((Date.now() >>> 0) ^ 0x9e3779b9) || 7);
        }
        // v6 → v7 (staff + hype) : garantit les champs ajoutés à l'état tycoon (staff,
        // hype d'un projet en cours) sur une sauvegarde v6 antérieure.
        if (version < 7) {
          const ty = (s.tycoon ?? initialTycoon(((Date.now() >>> 0) ^ 0x9e3779b9) || 7)) as Record<
            string,
            unknown
          >;
          if (ty.staff == null) ty.staff = { engineer: 0, researcher: 0, 'data-scientist': 0 };
          const proj = ty.activeProject as Record<string, unknown> | null;
          if (proj && proj.hype == null) proj.hype = 1;
          s.tycoon = ty;
        }
        return s as unknown as ProgressionState;
      },
      // On ne persiste QUE l'état sérialisable, pas les actions ni les notifications transitoires.
      partialize: (s): ProgressionState => ({
        researchPoints: s.researchPoints,
        bolts: s.bolts,
        cumulativeProduced: s.cumulativeProduced,
        itemStock: s.itemStock,
        nodeCumulativeProduced: s.nodeCumulativeProduced,
        reachedMilestones: s.reachedMilestones,
        reachedMicroMilestones: s.reachedMicroMilestones,
        unlockedBuildings: s.unlockedBuildings,
        unlockedRecipes: s.unlockedRecipes,
        lastSeenMs: s.lastSeenMs,
        lastRpRatePerMin: s.lastRpRatePerMin,
        prestigeCount: s.prestigeCount,
        welcomeSeen: s.welcomeSeen,
        tutorialDismissed: s.tutorialDismissed,
        gameMinutesElapsed: s.gameMinutesElapsed,
        reputation: s.reputation,
        contractsCompleted: s.contractsCompleted,
        activeContract: s.activeContract,
        contractOffers: s.contractOffers,
        contractSeed: s.contractSeed,
        offersGeneratedAtGameMin: s.offersGeneratedAtGameMin,
        tycoon: s.tycoon,
      }),
    },
  ),
);
