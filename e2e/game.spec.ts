import { test, expect, type Page } from '@playwright/test';

/**
 * Tests E2E du parcours joueur NodeFactory (boucle de jeu réelle, navigateur).
 *
 * Couvre ce que les tests unitaires ne peuvent pas voir : le câblage complet
 * data → stores → UI (palette gatée, pose payée en AP, récap offline, milestones).
 * Chaque scénario seed l'état persisté (localStorage `nf-progression`) AVANT le
 * chargement de la page — exactement ce que verrait un joueur qui revient.
 */

const PALETTE_MIME = 'application/nodefactory-building';
const STORAGE_KEY = 'nf-progression';

/** État de progression par défaut (miroir de initialProgression). */
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
    ...partial,
  };
}

/** Écrit l'état persisté AVANT que l'app ne se charge (format zustand/persist). */
async function seedProgression(page: Page, partial: Record<string, unknown> = {}) {
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify({ state, version: 1 }));
    },
    { key: STORAGE_KEY, state: progressionState(partial) },
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

test.describe('Premier contact (Hook)', () => {
  test('l’app charge : header, palette, objectifs', async ({ page }) => {
    await gotoReady(page);

    await expect(page.getByRole('heading', { name: /NodeFactory/ })).toBeVisible();
    // Palette : kit de base disponible.
    await expect(page.getByRole('heading', { name: 'Composants' })).toBeVisible();
    await expect(paletteItem(page, 'Miner Mk.1')).toBeVisible();
    await expect(paletteItem(page, 'Smelter')).toBeVisible();
    // Échelle d'objectifs (milestones) visible dès le départ.
    await expect(page.getByRole('heading', { name: 'Objectifs' })).toBeVisible();
  });

  test('gating : les bâtiments de milestone sont absents de la palette au départ', async ({ page }) => {
    await gotoReady(page);

    // Kit de base présent…
    await expect(paletteItem(page, 'Coal Generator')).toBeVisible();
    // …mais les récompenses de milestones M1-M7 sont verrouillées.
    for (const locked of ['Constructor', 'Miner Mk.2', 'Miner Mk.3', 'Assembler', 'Foundry', 'Manufacturer']) {
      await expect(paletteItem(page, locked)).toHaveCount(0);
    }
  });
});

test.describe('Pose de bâtiments (coût AP)', () => {
  test('poser un Miner Mk.1 crée le node et débite 10 AP (50 → 40)', async ({ page }) => {
    await gotoReady(page);

    await dropBuilding(page, 'miner-mk1', 'extraction');

    await expect(page.locator('.react-flow__node')).toHaveCount(1);
    // La status bar apparaît avec le solde débité.
    await expect(page.getByText('⚡ 40 AP')).toBeVisible();
  });

  test('solde insuffisant : pose refusée + avertissement, aucun node créé', async ({ page }) => {
    await seedProgression(page, { automationPoints: 3 });
    await gotoReady(page);

    await dropBuilding(page, 'miner-mk1', 'extraction');

    await expect(page.getByRole('alert')).toContainText('AP insuffisants');
    await expect(page.locator('.react-flow__node')).toHaveCount(0);
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
    await expect(page.getByTestId('offline-recap')).toContainText('plafond 4 h atteint');
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

    await expect(paletteItem(page, 'Constructor')).toBeVisible();
    // Les paliers suivants restent verrouillés.
    await expect(paletteItem(page, 'Assembler')).toHaveCount(0);
  });
});
