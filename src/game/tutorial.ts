/**
 * tutorial.ts — Logique PURE du tutoriel de premier lancement (Hook).
 *
 * Le tutoriel n'est PAS un script : c'est une checklist dérivée de l'état RÉEL du
 * graphe et de la progression. Le joueur peut faire les étapes dans le désordre,
 * revenir en arrière (supprimer son Smelter ramène à l'étape « Fonds le minerai ») —
 * l'affichage suit.
 *
 * ORDRE (révisé) : « pas de courant, pas de production » (cf. computeFactoryAndPower)
 * impose de construire le réseau électrique AVANT la chaîne de fer — sinon le joueur
 * pose un générateur décoratif qui ne produit rien tant qu'il n'a pas de charbon.
 * Section ÉLECTRICITÉ (boucle auto-alimentée : mineur de charbon → générateur → courant
 * du mineur) puis section FER (mineur → smelter → courant), puis AUTOMATISATION.
 *
 * Découplage : aucune dépendance React/store. L'UI construit un `TutorialSnapshot`
 * depuis les stores et appelle `currentTutorialStep`.
 */

/** Photographie minimale de l'état du jeu, suffisante pour piloter le tutoriel. */
export interface TutorialSnapshot {
  /** Un extracteur lié à un gisement de charbon existe. */
  hasCoalMiner: boolean;
  /** Un Coal Generator est posé ET configuré (recette charbon → électricité). */
  hasCoalGenerator: boolean;
  /** Le générateur reçoit le charbon du mineur (convoyeur mineur → générateur). */
  coalGenFed: boolean;
  /** Le mineur de charbon est câblé au générateur ET le réseau est sous tension (boucle bouclée). */
  coalLoopPowered: boolean;
  /** Un extracteur lié à un gisement de fer existe. */
  hasIronMiner: boolean;
  /** Un Smelter est posé sur le canvas. */
  hasSmelter: boolean;
  /** Un Smelter reçoit du minerai de fer (arête mineur → smelter). */
  smelterFed: boolean;
  /** La chaîne fer est sous tension : le Smelter nourri appartient à un réseau alimenté. */
  chainPowered: boolean;
  /** Le premier milestone (60 Iron Ingot) est franchi. */
  m1Reached: boolean;
}

export interface TutorialStep {
  id: string;
  /** Section regroupant des étapes liées (affichage par bloc). */
  section: string;
  /** Consigne courte (titre de l'étape). */
  title: string;
  /** Détail actionnable — dit exactement QUOI faire, sans jargon. */
  detail: string;
}

/** Les 3 sections, dans l'ordre d'apparition. */
export const TUTORIAL_SECTIONS = ['Électricité', 'Production de fer', 'Automatisation'] as const;

/** Les 9 étapes du tutoriel — la plus courte route vers « ça tourne tout seul ». */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // — Électricité : une boucle auto-alimentée, posée AVANT la chaîne de fer.
  {
    id: 'mine-coal',
    section: 'Électricité',
    title: 'Extrais le charbon',
    detail: 'Clique un pin « Coal » sur la carte : un mineur s’y installe (10 AP).',
  },
  {
    id: 'place-generator',
    section: 'Électricité',
    title: 'Pose un générateur',
    detail: 'Glisse un Coal Generator depuis la palette et choisis sa recette charbon → électricité (15 AP).',
  },
  {
    id: 'fuel-generator',
    section: 'Électricité',
    title: 'Alimente-le en charbon',
    detail: 'Tire un convoyeur du mineur de charbon vers l’entrée du générateur.',
  },
  {
    id: 'power-loop',
    section: 'Électricité',
    title: 'Boucle le réseau',
    detail: 'Câble le ⚡ (sortie) du générateur vers le ⚡ (entrée) du mineur de charbon : le réseau s’auto-alimente.',
  },
  // — Production de fer : maintenant que le courant existe, on peut câbler dessus.
  {
    id: 'mine-iron',
    section: 'Production de fer',
    title: 'Extrais le fer',
    detail: 'Clique un pin « Iron Ore » sur la carte : un mineur s’y installe (10 AP).',
  },
  {
    id: 'smelt',
    section: 'Production de fer',
    title: 'Fonds le minerai',
    detail: 'Glisse un Smelter depuis la palette, près du mineur (10 AP).',
  },
  {
    id: 'connect-iron',
    section: 'Production de fer',
    title: 'Relie-les',
    detail: 'Tire un lien du rond vert du mineur vers le rond orange du Smelter.',
  },
  {
    id: 'power-iron',
    section: 'Production de fer',
    title: 'Branche le courant',
    detail: 'Câble le ⚡ du générateur vers le ⚡ du Smelter : sans électricité, rien ne tourne.',
  },
  // — Automatisation
  {
    id: 'produce',
    section: 'Automatisation',
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
  if (!s.hasCoalMiner) return 0;
  if (!s.hasCoalGenerator) return 1;
  if (!s.coalGenFed) return 2;
  if (!s.coalLoopPowered) return 3;
  if (!s.hasIronMiner) return 4;
  if (!s.hasSmelter) return 5;
  if (!s.smelterFed) return 6;
  if (!s.chainPowered) return 7;
  return 8;
}
