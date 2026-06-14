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
 * RELAIS POST-M1 (audit early-game 2026-06-14) : le tutoriel ne s'efface PLUS brutalement
 * à M1. Une dernière étape « Étends ton usine » prend le relais (poser le Constructor
 * fraîchement débloqué → produire les premiers Iron Rod) pour éviter le « cliff » où le
 * joueur, privé de guide juste après sa première récompense, ne sait plus quoi faire.
 * Le tutoriel ne se termine (-1) qu'une fois M2 atteint.
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
  /** Le deuxième milestone (60 Iron Rod) est franchi — fin du relais, fin du tutoriel. */
  m2Reached: boolean;
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
export const TUTORIAL_SECTIONS = ['Compute', 'Pipeline de données', 'Automatisation'] as const;

/** Les 10 étapes du tutoriel — la plus courte route vers « ça tourne tout seul », relais inclus. */
export const TUTORIAL_STEPS: TutorialStep[] = [
  // — Compute : une boucle auto-alimentée (énergie → datacenter → compute), posée AVANT le pipeline.
  {
    id: 'mine-coal',
    section: 'Compute',
    title: 'Capte de l’énergie',
    detail: 'Clique un pin « Grid Power » sur la carte : un Data Harvester s’y installe (10 $).',
  },
  {
    id: 'place-generator',
    section: 'Compute',
    title: 'Déploie un datacenter',
    detail: 'Glisse un Datacenter depuis la palette : il convertit l’énergie en Compute (15 $).',
  },
  {
    id: 'fuel-generator',
    section: 'Compute',
    title: 'Alimente le datacenter',
    detail: 'Tire un data bus du harvester d’énergie vers l’entrée du datacenter.',
  },
  {
    id: 'power-loop',
    section: 'Compute',
    title: 'Boucle le compute',
    detail: 'Câble le Compute (sortie) du datacenter vers le harvester d’énergie : le réseau s’auto-alimente.',
  },
  // — Pipeline de données : maintenant que le compute existe, on peut câbler dessus.
  {
    id: 'mine-iron',
    section: 'Pipeline de données',
    title: 'Collecte des données',
    detail: 'Clique un pin « Text Corpus » sur la carte : un Data Harvester s’y installe (10 $).',
  },
  {
    id: 'smelt',
    section: 'Pipeline de données',
    title: 'Nettoie les données',
    detail: 'Glisse un Data Cleaner depuis la palette, près du harvester (10 $).',
  },
  {
    id: 'connect-iron',
    section: 'Pipeline de données',
    title: 'Relie-les',
    detail: 'Tire un lien du rond vert du harvester vers le rond orange du Data Cleaner.',
  },
  {
    id: 'power-iron',
    section: 'Pipeline de données',
    title: 'Branche le compute',
    detail: 'Câble le Compute du datacenter vers le Data Cleaner : sans compute, rien ne tourne.',
  },
  // — Automatisation
  {
    id: 'produce',
    section: 'Automatisation',
    title: 'Laisse tourner',
    detail: 'Ton pipeline tourne tout seul. Objectif : 60 Clean Tokens → débloque le Training Unit.',
  },
  // — Relais post-M1 : on garde le joueur en main juste après sa première récompense.
  {
    id: 'automate-next',
    section: 'Automatisation',
    title: 'Étends ton pipeline',
    detail:
      'M1 atteint, le Training Unit est débloqué (palette, badge NEW). Pose-le, relie-le au Data Cleaner et branche le Compute : 60 Token Sequences ouvrent le palier suivant.',
  },
];

/**
 * Index de l'étape courante dans TUTORIAL_STEPS, ou -1 si le tutoriel est terminé
 * (premier milestone atteint). Dérivé : retirer un élément fait reculer l'étape.
 */
export function currentTutorialStep(s: TutorialSnapshot): number {
  // Le tutoriel ne se termine qu'au 2e milestone : M1 enchaîne sur le relais d'extension.
  if (s.m2Reached) return -1;
  if (s.m1Reached) return 9; // relais « Étends ton usine » (Constructor → Iron Rod)
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
