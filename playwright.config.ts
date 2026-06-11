import { defineConfig, devices } from '@playwright/test';

/**
 * Config Playwright — tests E2E du parcours joueur NodeFactory.
 *
 * Lancement : `npm run test:e2e` (démarre le serveur Vite dev automatiquement).
 * Les tests vivent dans /e2e ; Vitest (tests unitaires) reste cantonné à /src.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
