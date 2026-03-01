import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  getActiveScene,
  waitForScene,
  getCanvas,
  clickCanvas,
  pressKey,
  takeScreenshot,
  getSceneKeys,
} from './helpers';

test.describe('Game Boot & Title', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('game canvas is created and Phaser boots', async ({ page }) => {
    const canvas = getCanvas(page);
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await waitForGameReady(page);

    // Canvas should have the configured dimensions
    const size = await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      return { width: game.config.width, height: game.config.height };
    });
    expect(size.width).toBe(1024);
    expect(size.height).toBe(768);
  });

  test('all scenes are registered', async ({ page }) => {
    await waitForGameReady(page);
    const keys = await getSceneKeys(page);

    const expectedScenes = [
      'BootScene', 'TitleScene', 'NameInputScene', 'WorldMapScene',
      'FieldScene', 'TownScene', 'BattleScene', 'MenuScene',
      'DialogueScene', 'ShopScene', 'GameOverScene', 'CutsceneScene',
      'EndingScene',
    ];
    for (const scene of expectedScenes) {
      expect(keys).toContain(scene);
    }
  });

  test('BootScene loads assets and transitions to TitleScene', async ({ page }) => {
    await waitForGameReady(page);
    // BootScene generates procedural art, then transitions to TitleScene
    await waitForScene(page, 'TitleScene', 30_000);
    const active = await getActiveScene(page);
    expect(active).toBe('TitleScene');
  });

  test('TitleScene displays menu and responds to input', async ({ page }) => {
    await waitForGameReady(page);
    await waitForScene(page, 'TitleScene', 30_000);

    // Wait a bit for title animations and menu rendering
    await page.waitForTimeout(500);
    await takeScreenshot(page, 'title-screen');

    // Title scene should be the active scene
    const active = await getActiveScene(page);
    expect(active).toBe('TitleScene');

    // Canvas should have rendered content (not just black)
    const hasContent = await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      return game.scene.getScene('TitleScene')?.children?.length > 0;
    });
    expect(hasContent).toBe(true);
  });
});

test.describe('New Game Flow', () => {
  test('can start new game and reach NameInputScene', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await waitForScene(page, 'TitleScene', 30_000);

    // Wait for keyboard listener delay (200ms) + a bit extra
    await page.waitForTimeout(400);

    // Click canvas to ensure focus + trigger BGM init
    await clickCanvas(page);
    await page.waitForTimeout(100);

    // Press Enter to select "New Game" (first menu item, selected by default)
    await pressKey(page, 'Enter');

    // Wait for transition (400ms fade) and NameInputScene
    await waitForScene(page, 'NameInputScene', 10_000);
    const active = await getActiveScene(page);
    expect(active).toBe('NameInputScene');

    await takeScreenshot(page, 'name-input');
  });

  test('can enter name and reach WorldMapScene', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await waitForScene(page, 'TitleScene', 30_000);

    // Navigate to NameInputScene
    await page.waitForTimeout(400);
    await clickCanvas(page);
    await page.waitForTimeout(100);
    await pressKey(page, 'Enter');
    await waitForScene(page, 'NameInputScene', 10_000);

    // Wait for HTML input to appear
    const input = page.locator('input');
    await expect(input).toBeVisible({ timeout: 5_000 });

    // Clear default and type a test name
    await input.fill('');
    await input.fill('測試勇者');
    await page.waitForTimeout(200);

    // Press Enter to confirm the name
    await input.press('Enter');

    // Wait for transition to WorldMapScene
    await waitForScene(page, 'WorldMapScene', 15_000);
    const active = await getActiveScene(page);
    expect(active).toBe('WorldMapScene');

    await page.waitForTimeout(500);
    await takeScreenshot(page, 'world-map');
  });
});

test.describe('Game Configuration', () => {
  test('game resolution is 1024x768', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);

    const config = await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      return {
        width: game.config.width,
        height: game.config.height,
      };
    });
    expect(config.width).toBe(1024);
    expect(config.height).toBe(768);
  });

  test('game boots with correct scene count', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);

    const sceneCount = await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      return game.scene.getScenes(false).length;
    });
    expect(sceneCount).toBe(13);
  });
});
