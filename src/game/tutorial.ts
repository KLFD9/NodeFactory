/**
 * tutorial.ts — Logique PURE du tutoriel de premier lancement (Hook).
 *
 * Le tutoriel n'est PAS un script : c'est une checklist dérivée de l'état RÉEL du
 * graphe et de la progression. Le joueur peut faire les étapes dans le désordre,
 * revenir en arrière (supprimer son Smelter ramène à l'étape 2) — l'affichage suit.
 * Il guide vers le premier moment magique : la chaîne mineur → fonderie qui tourne
 * toute seule jusqu'au premier milestone (60 Iron Ingot → Constructor).
 *
 * Découplage : aucune dépendance React/store. L'UI construit un `TutorialSnapshot`
 * depuis les stores et appelle `currentTutorialStep`.
 */

/** Photographie minimale de l'état du jeu, suffisante pour piloter le tutoriel. */
export interface TutorialSnapshot {
  /** Un extracteur lié à un gisement de fer existe (pin cliqué ou miner aimanté). */
  hasIronMiner: boolean;
  /** Un Smelter est posé sur le canvas. */
  hasSmelter: boolean;
  /** Un Smelter reçoit du minerai de fer (arête mineur → smelter). */
  smelterFed: boolean;
  /** La chaîne est sous tension : le Smelter nourri appartient à un réseau alimenté. */
  chainPowered: boolean;
  /** Le premier milestone (60 Iron Ingot) est franchi. */
  m1Reached: boolean;
}

export interface TutorialStep {
  id: string;
  /** Consigne courte (titre de l'étape). */
  title: string;
  /** Détail actionnable — dit exactement QUOI faire, sans jargon. */
  detail: string;
}

/** Les 4 étapes du tutoriel — la plus courte route vers « ça tourne tout seul ». */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'mine',
    title: 'Extrais le fer',
    detail: 'Clique un pin « Iron Ore » sur la carte : un mineur s’y installe (10 AP).',
  },
  {
    id: 'smelt',
    title: 'Fonds le minerai',
    detail: 'Glisse un Smelter depuis la palette, près du mineur (10 AP).',
  },
  {
    id: 'connect',
    title: 'Relie-les',
    detail: 'Tire un lien du rond vert du mineur vers le rond orange du Smelter.',
  },
  {
    id: 'power',
    title: 'Branche le courant',
    detail:
      'Sans électricité, rien ne tourne ! Pose un Coal Generator (15 AP) et câble son pin ⚡ vers ceux du mineur et du Smelter.',
  },
  {
    id: 'produce',
    title: 'Laisse tourner',
    detail: 'Ton usine produit toute seule. Objectif : 60 Iron Ingot → Constructor.',
  },
];

/**
 * Index de l'étape courante dans TUTORIAL_STEPS, ou -1 si le tutoriel est terminé
 * (premier milestone atteint). Dérivé : retirer un élément fait reculer l'étape.
 */
export function currentTutorialStep(s: TutorialSnapshot): number {
  if (s.m1Reached) return -1;
  if (!s.hasIronMiner) return 0;
  if (!s.hasSmelter) return 1;
  if (!s.smelterFed) return 2;
  if (!s.chainPowered) return 3;
  return 4;
}
