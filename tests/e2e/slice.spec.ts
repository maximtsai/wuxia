import { test, expect, type Page } from '@playwright/test';
import { newSession, type Player } from '../../src/core/session';
import { selectClass, skillRank } from '../../src/core/progression';
import {
  interactables,
  newWorld,
  rooms,
  type RoomId,
  type WorldState,
} from '../../src/content/world';
import { activeSkills } from '../../src/content/phase2';
test.use({ hasTouch: true });
async function seed(
  page: Page,
  player: Player,
  world: WorldState = newWorld(),
) {
  await page.goto('./');
  await page.evaluate(
    (data) => localStorage.setItem('rpg.phase1.save', JSON.stringify(data)),
    { version: 4, player, world },
  );
  await page
    .getByRole('button', { name: 'Continue saved game ↗', exact: true })
    .click();
}
// Room objects only show their card up close: click one to walk over to it.
async function approach(page: Page, name: string) {
  const title = await page.locator('.room-title').textContent();
  const id = (Object.keys(rooms) as RoomId[]).find(
    (r) => rooms[r].name === title,
  )!;
  const o = interactables[id].find((i) => i.name === name)!;
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(
    box.x + (box.width * o.x) / 1600,
    box.y + (box.height * o.y) / 900,
  );
  // Up close only a prompt shows; E opens the object's card.
  await expect(page.locator('.interact-hint')).toHaveText(
    'Press E to interact with ' + name,
    { timeout: 10_000 },
  );
  await page.keyboard.press('e');
  await expect(page.getByRole('complementary', { name })).toBeVisible();
}
async function use(page: Page, name: string) {
  await expect(
    page.getByRole('heading', { name: 'Your turn', exact: true }),
  ).toBeVisible();
  // Clicking an action uses it immediately; there is no confirm step.
  await page.getByRole('button', { name, exact: true }).click();
}
function profile() {
  const p = newSession().player;
  selectClass(p, 'warrior');
  return p;
}
async function portal(page: Page, name: string) {
  const title = await page.locator('.room-title').textContent();
  const id = (Object.keys(rooms) as RoomId[]).find(
    (r) => rooms[r].name === title,
  )!;
  await approach(
    page,
    interactables[id].find((i) => i.actions.includes('encounters'))!.name,
  );
  await page.getByRole('button', { name: /^(Enter trials|Train)$/ }).click();
  await page
    .getByRole('button', { name: 'Enter ' + name, exact: true })
    .click();
}

// Browser-only concerns. Game rules (deliveries, shops, respec, retries,
// potions, portal gating) are covered by the unit tests.
test('touch combat: target, act, and fit a phone screen', async ({ page }) => {
  const p = profile();
  const w = newWorld();
  w.room = 'human';
  w.cleared.human = 3;
  await seed(page, p, w);
  await portal(page, 'Human Gateway 4');
  await expect(
    page.getByRole('heading', { name: 'Your turn', exact: true }),
  ).toBeVisible();
  // Only owned actions are offered: learned skills, no empty potion slots.
  const learned = activeSkills.filter((id) => skillRank(p, id) > 0);
  await expect(page.locator('.skill-grid .skill-button')).toHaveCount(
    learned.length,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Bandit', exact: true }).tap();
  await expect(
    page.getByRole('button', { name: 'Attack', exact: true }),
  ).toContainText('→ Bandit');
  const logged = await page.locator('.combat-log li').count();
  await use(page, 'Attack');
  await expect
    .poll(() => page.locator('.combat-log li').count())
    .toBeGreaterThan(logged);
  // Through the enemy's turn too, only learned skills are offered.
  await expect(page.locator('.skill-grid .skill-button')).toHaveCount(
    learned.length,
  );
});
