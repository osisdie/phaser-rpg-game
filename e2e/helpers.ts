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
