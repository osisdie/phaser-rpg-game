/**
 * Capture README screenshots. Run: pnpm run capture:screenshots
 * Output: docs/screenshots/{title,worldmap,town,field,battle,boss}.png
 */
import { test } from '@playwright/test';
import {
  waitForGameReady,
  waitForScene,
  clickCanvas,
  pressKey,
  forceStartBattle,
  forceStartScene,
} from './helpers';

const SCREENSHOTS_DIR = 'docs/screenshots';

test.describe('Capture README Screenshots', () => {
  test('capture all README screenshots', async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await waitForScene(page, 'TitleScene', 60_000);
    await page.waitForTimeout(500);

    // 1. Title
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/title.png` });
    console.log('Saved docs/screenshots/title.png');

    // 2. New game → WorldMap
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
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/worldmap.png` });
    console.log('Saved docs/screenshots/worldmap.png');

    // 3. Town
    await forceStartScene(page, 'TownScene', { regionId: 'region_hero', fromWorldMap: true });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/town.png` });
    console.log('Saved docs/screenshots/town.png');

    // 4. Field
    await forceStartScene(page, 'FieldScene', { regionId: 'region_hero' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/field.png` });
    console.log('Saved docs/screenshots/field.png');

    // 5. Battle — monsters NOT in AI_CONTENT_BLACKLIST, region_elf background (not 勇者王國)
    await forceStartBattle(page, { monsterNames: ['毒蛇', '黑蜘蛛'], regionId: 'region_elf' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/battle.png` });
    console.log('Saved docs/screenshots/battle.png');

    // 6. Boss — death lord (r8_boss), region_undead background (not 勇者王國)
    await forceStartBattle(page, {
      bossId: 'r8_boss',
      bossName: '不死魔將',
      regionId: 'region_undead',
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/boss.png` });
    console.log('Saved docs/screenshots/boss.png');
  });
});
