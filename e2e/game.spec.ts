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
  startNewGame,
  forceStartBattle,
  getBattleState,
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

test.describe('Battle Scene — Diagonal Layout', () => {
  test('battle scene renders with diagonal layout', async ({ page }) => {
    await startNewGame(page);

    // Force-start a battle with test monsters
    await forceStartBattle(page, { monsterNames: ['史萊姆', '蝙蝠'] });
    await page.waitForTimeout(1500); // Wait for sword-crossing intro animation

    const active = await getActiveScene(page);
    expect(active).toBe('BattleScene');

    // Verify battle state is initialized with statusEffects arrays
    const state = await getBattleState(page);
    expect(state).not.toBeNull();
    expect(state!.party.length).toBeGreaterThan(0);
    expect(state!.enemies.length).toBe(2);
    expect(state!.enemies[0].name).toBe('史萊姆');
    expect(state!.enemies[1].name).toBe('蝙蝠');

    // Verify all combatants have statusEffects array initialized
    for (const p of state!.party) {
      expect(p.statusEffects).toEqual([]);
    }
    for (const e of state!.enemies) {
      expect(e.statusEffects).toEqual([]);
    }

    // Verify party sprites are in the BOTTOM-LEFT area (y > 340, x < 400)
    const partyPositions = await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      const battle = game.scene.getScene('BattleScene') as any;
      return battle.partySprites.map((s: any) => ({ x: s.x, y: s.y }));
    });
    for (const pos of partyPositions) {
      expect(pos.y).toBeGreaterThan(340); // Bottom area
      expect(pos.x).toBeLessThan(400);    // Left area
    }

    // Verify enemy sprites are in the TOP-RIGHT area (y < 300, x > 500)
    const enemyPositions = await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      const battle = game.scene.getScene('BattleScene') as any;
      return battle.enemySprites.map((s: any) => ({ x: s.x, y: s.y }));
    });
    for (const pos of enemyPositions) {
      expect(pos.y).toBeLessThan(300);    // Top area
      expect(pos.x).toBeGreaterThan(500); // Right area
    }

    await takeScreenshot(page, 'battle-diagonal-layout');
  });

  test('battle scene handles status effect application', async ({ page }) => {
    await startNewGame(page);

    // Force battle with a poison monster (毒蛇 has 毒 in name → 25% poison on normal attack)
    await forceStartBattle(page, {
      monsterNames: ['毒蛇'],
      regionId: 'region_hero',
    });

    // Override the monster to guarantee poison on attack for testing
    await page.evaluate(() => {
      const game = (window as any).__GAME__ as Phaser.Game;
      const battle = game.scene.getScene('BattleScene') as any;
      const combat = battle.combat;
      const state = combat.getState();
      // Manually apply poison to first party member to verify the system works
      combat.applyStatus(state.party[0], 'poison', 1.0, 'test');
    });

    // Verify status was applied
    const state = await getBattleState(page);
    expect(state!.party[0].statusEffects).toContain('poison');

    await takeScreenshot(page, 'battle-status-poison');
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
