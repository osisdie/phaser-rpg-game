import { Page, expect } from '@playwright/test';

/** Wait for Phaser game instance to be ready */
export async function waitForGameReady(page: Page) {
  await page.waitForFunction(
    () => (window as any).__GAME__?.isBooted === true,
    { timeout: 15_000 },
  );
}

/** Get the currently active scene key from Phaser */
export async function getActiveScene(page: Page): Promise<string> {
  return page.evaluate(() => {
    const game = (window as any).__GAME__ as Phaser.Game;
    const active = game.scene.getScenes(true);
    return active.length > 0 ? active[0].scene.key : '';
  });
}

/** Wait until a specific Phaser scene is active */
export async function waitForScene(page: Page, sceneKey: string, timeout = 15_000) {
  await page.waitForFunction(
    (key) => {
      const game = (window as any).__GAME__ as Phaser.Game;
      const active = game.scene.getScenes(true);
      return active.some((s: any) => s.scene.key === key);
    },
    sceneKey,
    { timeout },
  );
}

/** Get the canvas element locator */
export function getCanvas(page: Page) {
  return page.locator('canvas');
}

/** Click the center of the game canvas */
export async function clickCanvas(page: Page) {
  const canvas = getCanvas(page);
  await canvas.click();
}

/** Press a key on the game canvas (ensures focus first) */
export async function pressKey(page: Page, key: string) {
  const canvas = getCanvas(page);
  await canvas.focus();
  await page.keyboard.press(key);
}

/** Take a labeled screenshot and save to .playwright-mcp/ */
export async function takeScreenshot(page: Page, name: string) {
  await page.screenshot({ path: `.playwright-mcp/${name}.png` });
}

/** Get all registered scene keys */
export async function getSceneKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const game = (window as any).__GAME__ as Phaser.Game;
    return game.scene.getScenes(false).map((s: any) => s.scene.key);
  });
}

/** Navigate new game flow: Title → NameInput → WorldMap, returns when WorldMapScene is active */
export async function startNewGame(page: Page) {
  await page.goto('/');
  await waitForGameReady(page);
  await waitForScene(page, 'TitleScene', 60_000);
  await page.waitForTimeout(400);
  await clickCanvas(page);
  await page.waitForTimeout(100);
  await pressKey(page, 'Enter');
  await waitForScene(page, 'NameInputScene', 10_000);
  const input = page.locator('input');
  await input.fill('');
  await input.fill('測試勇者');
  await page.waitForTimeout(200);
  await input.press('Enter');
  await waitForScene(page, 'WorldMapScene', 15_000);
}

/** Force-start a battle with specific monsters via the Phaser scene manager */
export async function forceStartBattle(page: Page, options?: {
  monsterNames?: string[];
  /** For boss battles: use actual boss ID (e.g. r1_boss) so AI_BOSS_MAP resolves correct sprite */
  bossId?: string;
  bossName?: string;
  regionId?: string;
  isBoss?: boolean;
}) {
  await page.evaluate((opts) => {
    const game = (window as any).__GAME__ as Phaser.Game;
    const activeScenes = game.scene.getScenes(true);
    const currentScene = activeScenes[0];
    if (!currentScene) throw new Error('No active scene');

    const regionId = opts?.regionId ?? 'region_hero';
    let monsters: Array<{
      id: string;
      name: string;
      stats: { maxHP: number; hp: number; maxMP: number; mp: number; atk: number; def: number; agi: number; luck: number };
      ai: 'normal';
      exp: number;
      gold: number;
      drops: never[];
      skills: string[];
      element: 'none';
      isBoss: boolean;
      spriteColor: number;
    }>;

    if (opts?.bossId && opts?.bossName) {
      // Boss battle: use real boss ID so MonsterRenderer AI_BOSS_MAP resolves correct sprite
      monsters = [{
        id: opts.bossId,
        name: opts.bossName,
        stats: { maxHP: 250, hp: 250, maxMP: 40, mp: 40, atk: 35, def: 20, agi: 12, luck: 5 },
        ai: 'normal',
        exp: 200,
        gold: 150,
        drops: [],
        skills: ['skill_monster_bite', 'skill_monster_fire'],
        element: 'dark',
        isBoss: true,
        spriteColor: 0x880000,
      }];
    } else {
      const monsterNames = opts?.monsterNames ?? ['史萊姆'];
      monsters = monsterNames.map((name, i) => ({
        id: `test_monster_${i}`,
        name,
        stats: { maxHP: 50, hp: 50, maxMP: 20, mp: 20, atk: 15, def: 8, agi: 10, luck: 3 },
        ai: 'normal' as const,
        exp: 30,
        gold: 20,
        drops: [],
        skills: [],
        element: 'none' as const,
        isBoss: opts?.isBoss ?? false,
        spriteColor: 0x44aa44,
      }));
    }

    currentScene.scene.start('BattleScene', {
      monsters,
      regionId,
      isBoss: !!opts?.isBoss || !!opts?.bossId,
      returnScene: currentScene.scene.key,
      returnData: {},
    });
  }, options);

  await waitForScene(page, 'BattleScene', 10_000);
}

/** Force-start a scene (e.g. TownScene, FieldScene) from current scene. Used for screenshot capture. */
export async function forceStartScene(page: Page, sceneKey: string, data?: Record<string, unknown>) {
  await page.evaluate(
    ({ key, d }) => {
      const game = (window as any).__GAME__ as Phaser.Game;
      const activeScenes = game.scene.getScenes(true);
      const currentScene = activeScenes[0];
      if (!currentScene) throw new Error('No active scene');
      currentScene.scene.start(key, d ?? {});
    },
    { key: sceneKey, d: data ?? {} },
  );
  await waitForScene(page, sceneKey, 10_000);
}

/** Get battle combatant data from the CombatSystem in BattleScene */
export async function getBattleState(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).__GAME__ as Phaser.Game;
    const battle = game.scene.getScene('BattleScene') as any;
    if (!battle?.combat) return null;
    const state = battle.combat.getState();
    return {
      party: state.party.map((p: any) => ({
        name: p.name, hp: p.stats.hp, maxHP: p.stats.maxHP,
        statusEffects: p.statusEffects.map((s: any) => s.type),
      })),
      enemies: state.enemies.map((e: any) => ({
        name: e.name, hp: e.stats.hp, maxHP: e.stats.maxHP,
        statusEffects: e.statusEffects.map((s: any) => s.type),
      })),
      turn: state.turn,
      phase: state.phase,
    };
  });
}

/** Check if the game canvas has rendered content (non-black) */
export async function canvasHasContent(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return false;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    // Check if any non-black pixel exists
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 10 || data[i + 1] > 10 || data[i + 2] > 10) {
        return true;
      }
    }
    return false;
  });
}
