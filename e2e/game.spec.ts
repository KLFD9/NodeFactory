import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E du parcours joueur NodeFactory (boucle de jeu réelle, navigateur).
 *
 * Couvre ce que les tests unitaires ne peuvent pas voir : le câblage complet
 * data → stores → UI (accueil, tutoriel, palette gatée, pose payée en AP, récap
 * offline, milestones, persistance de l'usine). Chaque scénario seed l'état
 * persisté (localStorage) AVANT le chargement — comme un joueur qui revient.
 */

const PALETTE_MIME = 'application/nodefactory-building';
const STORAGE_KEY = 'nf-progression';
const WORLD_KEY = 'nf-world';

/** État de progression par défaut (joueur déjà accueilli, tutoriel passé). */
function progressionState(partial: Record<string, unknown> = {}) {
  return {
    automationPoints: 50,
    cumulativeProduced: {},
    nodeCumulativeProduced: {},
    reachedMilestones: [],
    unlockedBuildings: [],
    unlockedRecipes: [],
    lastSeenMs: Date.now(),
    lastApRatePerMin: 0,
    prestigeCount: 0,
    welcomeSeen: true,
    tutorialDismissed: true,
    ...partial,
  };
}

/**
 * Écrit l'état persisté AVANT que l'app ne se charge (format zustand/persist).
 * Idempotent : `addInitScript` rejoue à CHAQUE navigation (reload compris) — le
 * marqueur évite d'écraser ce que le jeu a persisté depuis (tests de persistance).
 */
async function seedProgression(page: Page, partial: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ key, state }) => {
      if (localStorage.getItem(`${key}:seeded`)) return;
      localStorage.setItem(`${key}:seeded`, '1');
      localStorage.setItem(key, JSON.stringify({ state, version: 1 }));
    },
    { key: STORAGE_KEY, state: progressionState(partial) },
  );
}

/** Monde déterministe : un gisement de charbon (cible du tutoriel) + un de fer. */
async function seedWorld(page: Page) {
  const blob = 'M -1 0 A 1 1 0 1 0 1 0 A 1 1 0 1 0 -1 0 Z';
  const deposits = [
    {
      id: 'dep-coal',
      resourceId: 'coal',
      purity: 'normal',
      x: 200,
      y: 200,
      radius: 220,
      blobPath: blob,
      pins: [{ x: 200, y: 200 }],
    },
    {
      id: 'dep-iron',
      resourceId: 'iron-ore',
      purity: 'normal',
      x: 1100,
      y: 200,
      radius: 220,
      blobPath: blob,
      pins: [{ x: 1100, y: 200 }],
    },
  ];
  await page.addInitScript(
    ({ key, state }) => {
      if (localStorage.getItem(`${key}:seeded`)) return;
      localStorage.setItem(`${key}:seeded`, '1');
      localStorage.setItem(key, JSON.stringify({ state, version: 2 }));
    },
    { key: WORLD_KEY, state: { seed: 1, deposits } },
  );
}

/** Attend que les données du jeu soient chargées (frontière loadGameData). */
async function gotoReady(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Données prêtes')).toBeVisible();
}

/** Pose un bâtiment sur le canvas en rejouant le drop HTML5 de la palette. */
async function dropBuilding(page: Page, buildingId: string, category: string, x = 600, y = 350) {
  const dataTransfer = await page.evaluateHandle(
    ({ mime, payload }) => {
      const dt = new DataTransfer();
      dt.setData(mime, payload);
      return dt;
    },
    { mime: PALETTE_MIME, payload: JSON.stringify({ buildingId, category }) },
  );
  await page.dispatchEvent('.react-flow', 'drop', { dataTransfer, clientX: x, clientY: y });
}

/** Item de palette (seuls éléments [draggable] de l'app). */
function paletteItem(page: Page, name: string) {
  return page.locator('[draggable="true"]').filter({ hasText: name });
}

/** Ouvre le panneau latéral Composants (la toolbar gauche est fermée par défaut). */
async function openPalette(page: Page) {
  await page.getByTestId('palette-toggle-btn').click();
  await expect(page.getByTestId('left-panel')).toBeVisible();
}

/** Ouvre le panneau latéral Objectifs. */
async function openMilestones(page: Page) {
  await page.getByTestId('milestones-toggle-btn').click();
  await expect(page.getByTestId('left-panel')).toBeVisible();
}

test.describe('Accueil (premier lancement)', () => {
  test('première visite : écran d’accueil, « Commencer » lance le tutoriel', async ({ page }) => {
    // AUCUN seed : profil totalement vierge.
    await gotoReady(page);

    const welcome = page.getByTestId('welcome-modal');
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText('Extrais');
    await expect(welcome).toContainText('Automatise');
    await expect(welcome).toContainText('Optimise');

    await page.getByTestId('welcome-start').click();
    await expect(welcome).toHaveCount(0);
    // Le tutoriel prend le relais, section Électricité (1/3) — l'électricité se
    // construit AVANT la chaîne de fer (pas de charbon, pas de courant).
    await expect(page.getByTestId('tutorial-panel')).toBeVisible();
    await expect(page.getByTestId('tutorial-panel')).toContainText('ÉLECTRICITÉ — 1/3');
    await expect(page.getByTestId('tutorial-panel')).toContainText('Extrais le charbon');
  });

  test('joueur qui revient (welcomeSeen) : pas d’écran d’accueil', async ({ page }) => {
    await seedProgression(page);
    await gotoReady(page);
    await expect(page.getByTestId('welcome-modal')).toHaveCount(0);
  });
});

test.describe('Tutoriel (dérivé de l’état réel)', () => {
  test('pin Coal → mineur → suggestion « + Coal Generator relié » → étape « Boucle le réseau »', async ({ page }) => {
    await seedWorld(page);
    await seedProgression(page, { tutorialDismissed: false });
    await gotoReady(page);

    const panel = page.getByTestId('tutorial-panel');
    await expect(panel).toContainText('ÉLECTRICITÉ — 1/3');
    await expect(panel).toContainText('Extrais le charbon');

    // Étape 1 : le cadrage initial centre le gisement de charbon → le pin est cliquable.
    await page.locator('button[title*="Coal"]').first().click();
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(panel).toContainText('Pose un générateur');

    // Suggestion contextuelle : le mineur de charbon propose le Coal Generator relié.
    await page.getByTestId('suggest-downstream').click();
    await expect(page.locator('.react-flow__node')).toHaveCount(2);

    // Générateur posé + nourri (belt charbon) mais boucle électrique non câblée →
    // étape « Boucle le réseau », et la physique suit : rien ne produit encore.
    await expect(panel).toContainText('Boucle le réseau');
    await expect(page.getByText(/hors tension/)).toBeVisible();
    await expect(page.getByText('0 machines actives')).toBeVisible();
  });

  test('« Passer » masque le tutoriel définitivement (persiste au reload)', async ({ page }) => {
    await seedProgression(page, { tutorialDismissed: false });
    await gotoReady(page);

    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('tutorial-panel')).toHaveCount(0);

    await page.reload();
    await expect(page.getByText('Données prêtes')).toBeVisible();
    await expect(page.getByTestId('tutorial-panel')).toHaveCount(0);
  });
});

test.describe('Premier contact (Hook)', () => {
  test('l’app charge : header, palette, objectifs', async ({ page }) => {
    await seedProgression(page);
    await gotoReady(page);

    await expect(page.getByRole('heading', { name: /NodeFactory/ })).toBeVisible();
    // Les panneaux gauche vivent derrière la toolbar flottante (fermés par défaut).
    await openPalette(page);
    await expect(page.getByRole('heading', { name: 'Composants' })).toBeVisible();
    await expect(paletteItem(page, 'Miner Mk.1')).toBeVisible();
    await expect(paletteItem(page, 'Smelter')).toBeVisible();
    await openMilestones(page);
    await expect(page.getByRole('heading', { name: 'Objectifs' })).toBeVisible();
  });

  test('gating : les bâtiments de milestone sont absents de la palette au départ', async ({ page }) => {
    await seedProgression(page);
    await gotoReady(page);

    await openPalette(page);
    await expect(paletteItem(page, 'Coal Generator')).toBeVisible();
    for (const locked of ['Constructor', 'Miner Mk.2', 'Miner Mk.3', 'Assembler', 'Foundry', 'Manufacturer']) {
      await expect(paletteItem(page, locked)).toHaveCount(0);
    }
  });
});

test.describe('Objectifs (progressive disclosure)', () => {
  test('au départ : objectif actif + 1 teaser, le reste masqué (pas de spoil)', async ({ page }) => {
    await seedProgression(page);
    await gotoReady(page);

    await openMilestones(page);
    const sidebar = page.getByTestId('left-panel');
    // Actif : M1.
    await expect(sidebar).toContainText('Produis 60 Iron Ingot');
    // Teaser : M2 (Miner Mk.2) visible.
    await expect(sidebar).toContainText('Miner Mk.2');
    // Le reste est caché : 13 paliers − actif − teaser = 11 à découvrir.
    await expect(sidebar).toContainText('+11 PALIERS_A_DECOUVRIR');
    // Pas de spoil du end-game.
    await expect(sidebar).not.toContainText('Prestige');
    await expect(sidebar).not.toContainText('Automated Motor');
  });

  test('paliers franchis : repliés dans un compteur compact', async ({ page }) => {
    await seedProgression(page, {
      cumulativeProduced: { 'iron-ingot': 100 },
      reachedMilestones: ['ms-iron-ingot-60'],
      unlockedBuildings: ['constructor'],
    });
    await gotoReady(page);

    await openMilestones(page);
    const sidebar = page.getByTestId('left-panel');
    await expect(sidebar).toContainText('1 PALIERS_FRANCHIS');
    // L'objectif actif est passé à M2.
    await expect(sidebar).toContainText('Produis 150 Iron Rod');
  });
});

test.describe('Pose de bâtiments (coût AP)', () => {
  test('poser un Miner Mk.1 crée le node et débite 10 AP (50 → 40)', async ({ page }) => {
    await seedProgression(page);
    await gotoReady(page);

    await dropBuilding(page, 'miner-mk1', 'extraction');

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.getByText('⚡ 40 AP')).toBeVisible();
  });

  test('solde insuffisant : pose refusée + avertissement, aucun node créé', async ({ page }) => {
    await seedProgression(page, { automationPoints: 3 });
    await gotoReady(page);

    await dropBuilding(page, 'miner-mk1', 'extraction');

    await expect(page.getByRole('alert')).toContainText('AP_INSUFFICIENT');
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
  });
});

test.describe('Persistance de l’usine', () => {
  test('l’usine et le solde survivent au reload', async ({ page }) => {
    await seedProgression(page);
    await gotoReady(page);

    await dropBuilding(page, 'miner-mk1', 'extraction');
    await expect(page.locator('.react-flow__node')).toHaveCount(1);

    await page.reload();
    await expect(page.getByText('Données prêtes')).toBeVisible();
    // Le node restauré ET le solde débité (40 = 50 − 10) sont toujours là.
    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    await expect(page.getByText('⚡ 40 AP')).toBeVisible();
  });
});

test.describe('Récap offline (idle)', () => {
  test('30 min d’absence à 10 AP/min → popup « +300 AP », fermable', async ({ page }) => {
    await seedProgression(page, {
      automationPoints: 100,
      lastApRatePerMin: 10,
      lastSeenMs: Date.now() - 30 * 60_000,
    });
    await gotoReady(page);

    const recap = page.getByTestId('offline-recap');
    await expect(recap).toBeVisible();
    await expect(page.getByTestId('offline-recap-ap')).toHaveText('+300 AP');
    await expect(recap).toContainText('30 min');

    await page.getByTestId('offline-recap-dismiss').click();
    await expect(recap).toHaveCount(0);
  });

  test('10 h d’absence → gains plafonnés à 4 h (+2400 AP) et mention du plafond', async ({ page }) => {
    await seedProgression(page, {
      lastApRatePerMin: 10,
      lastSeenMs: Date.now() - 10 * 60 * 60_000,
    });
    await gotoReady(page);

    await expect(page.getByTestId('offline-recap-ap')).toHaveText('+2400 AP');
    await expect(page.getByTestId('offline-recap')).toContainText('PLAFOND_4H');
    await expect(page.getByTestId('offline-recap')).toContainText('4 h');
  });

  test('simple reload (quelques secondes) → PAS de popup', async ({ page }) => {
    await seedProgression(page, {
      lastApRatePerMin: 10,
      lastSeenMs: Date.now() - 5_000,
    });
    await gotoReady(page);

    await expect(page.getByTestId('offline-recap')).toHaveCount(0);
  });
});

test.describe('Progression (milestones)', () => {
  test('M1 franchi : le Constructor apparaît dans la palette', async ({ page }) => {
    await seedProgression(page, {
      cumulativeProduced: { 'iron-ingot': 80 },
      reachedMilestones: ['ms-iron-ingot-60'],
      unlockedBuildings: ['constructor'],
    });
    await gotoReady(page);

    await openPalette(page);
    await expect(paletteItem(page, 'Constructor')).toBeVisible();
    await expect(paletteItem(page, 'Assembler')).toHaveCount(0);
  });
});
