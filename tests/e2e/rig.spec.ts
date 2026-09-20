import { test, expect } from '@playwright/test';

test('stick rig workshop plays poses and leaves saves untouched', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./?rigPreview=1');
  await expect(
    page.getByRole('button', { name: 'attack', exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  const canvas = page.locator('canvas');
  const standing = await canvas.screenshot();
  await page.getByRole('button', { name: 'defeat', exact: true }).click();
  // Wait for the held final pose, not a particular frame or pixel-perfect image.
  await page.waitForTimeout(1100);
  const defeated = await canvas.screenshot();
  expect(defeated.equals(standing)).toBe(false);
  for (const motion of [
    'idle',
    'walk',
    'attack',
    'hit',
    'guard',
    'drink',
    'qi',
  ]) {
    await page.getByRole('button', { name: motion, exact: true }).click();
    await page.waitForTimeout(150);
  }
  await page.getByRole('button', { name: 'Front / back', exact: true }).click();
  await page.getByRole('button', { name: 'idle', exact: true }).click();
  await page.screenshot({
    path: info.outputPath('rig-back.png'),
    fullPage: true,
  });
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(saved);
  expect(errors).toEqual([]);
});
