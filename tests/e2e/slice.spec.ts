import { test, expect, type Page } from '@playwright/test';
import { newSession, type Player } from '../../src/core/session';
import {
  selectClass,
  addExperience,
  chooseStat,
  respecPreview,
} from '../../src/core/progression';
import { newWorld, type WorldState } from '../../src/content/world';
import { encounters } from '../../src/content/phase2';
import { weapons, potions } from '../../src/content/catalog';
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
    .getByRole('button', { name: 'Load saved progress', exact: true })
    .click();
}
async function go(page: Page, room: string) {
  await page
    .getByRole('navigation', { name: 'Room exits' })
    .getByRole('button', { name: new RegExp(' · ' + room + '$') })
    .click();
  await expect(page.locator('.room-title')).toHaveText(room);
}
async function use(page: Page, name: string) {
  await expect(
    page.getByRole('heading', { name: 'Your turn', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name, exact: true }).click();
  await page
    .getByRole('button', { name: 'Confirm ' + name, exact: true })
    .click();
}
function profile() {
  const p = newSession().player;
  selectClass(p, 'warrior');
  return p;
}
async function portal(page: Page, name: string) {
  await page
    .getByRole('button', { name: 'Encounters / Training', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Enter ' + name, exact: true })
    .click();
}
test('keyboard class choice, connected gateway and saved world', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await page
    .getByRole('button', { name: 'Choose Warrior', exact: true })
    .press('Enter');
  await expect(
    page.getByRole('button', { name: 'down · Beyond the Temple', exact: true }),
  ).toBeDisabled();
  await go(page, 'Potions & Food');
  await go(page, 'Human Gateway');
  await page
    .getByRole('button', { name: 'Encounters / Training', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Enter Human Gateway 1', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Enter Human Gateway 2', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Close encounters' }).click();
  await page
    .getByRole('button', { name: 'Save progress', exact: true })
    .click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Load saved progress', exact: true })
    .click();
  await expect(page.locator('.room-title')).toHaveText('Human Gateway');
  await expect(page.locator('.equipped-summary')).toContainText(
    'Human seals 0/20',
  );
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('.map-room')).toHaveCount(13);
  await page.screenshot({
    path: info.outputPath('temple-map.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test('merchant delivery route, library payout, shop ownership and save', async ({
  page,
}, info) => {
  const p = profile();
  p.gold = weapons.earned.price;
  await seed(page, p);
  await go(page, 'Potions & Food');
  await go(page, 'Weapons & Merchant');
  await page.getByRole('button', { name: /^Accept delivery/ }).click();
  await expect(page.getByRole('status')).toContainText('Parcel accepted');
  await go(page, 'Upstairs');
  await go(page, 'Advanced Equipment');
  await go(page, 'Library');
  await page
    .getByRole('button', { name: 'Read library / Deliver', exact: true })
    .click();
  await page.getByRole('button', { name: /^Deliver parcel/ }).click();
  await expect(
    page.getByRole('button', { name: 'No parcel to deliver' }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Close library' }).click();
  await go(page, 'Advanced Equipment');
  await go(page, 'Upstairs');
  await go(page, 'Weapons & Merchant');
  await page
    .getByRole('button', { name: 'Equipment shop', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Buy Balanced blade', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Owned', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Close shop' }).click();
  await page
    .getByRole('button', { name: 'Save progress', exact: true })
    .click();
  await page.screenshot({
    path: info.outputPath('merchant.png'),
    fullPage: true,
  });
});
test('stat allocation and Mentor respec cancellation and confirmation', async ({
  page,
}) => {
  const p = profile();
  addExperience(p, 500);
  p.gold = respecPreview(p).price * 2;
  const w = newWorld();
  w.room = 'upstairs';
  await seed(page, p, w);
  await page.getByRole('button', { name: 'Progression', exact: true }).click();
  await page.getByRole('button', { name: 'Increase strength' }).click();
  await page.getByRole('button', { name: 'Close progression' }).click();
  await page.getByRole('button', { name: 'Progression', exact: true }).click();
  await page.getByRole('button', { name: 'Preview respec' }).click();
  chooseStat(p, 'strength');
  const preview = respecPreview(p);
  await expect(page.locator('.world-modal')).toContainText(
    `Strength ${p.strength} → ${preview.strength}`,
  );
  await page.getByRole('button', { name: 'Cancel respec' }).click();
  await expect(page.locator('.world-tools')).toContainText(`Gold ${p.gold}`);
  await page.getByRole('button', { name: 'Preview respec' }).click();
  await page.getByRole('button', { name: 'Confirm respec' }).click();
  await expect(page.locator('.world-tools')).toContainText(
    `Gold ${p.gold - preview.price}`,
  );
});
test('responsive touch targeting without resolving combat', async ({
  page,
}, info) => {
  const p = profile();
  const w = newWorld();
  w.room = 'human';
  w.cleared.human = 2;
  await seed(page, p, w);
  await portal(page, 'Human Gateway 3');
  await expect(
    page.getByRole('heading', { name: 'Your turn', exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath('combat-desktop.png'),
    fullPage: true,
  });
  for (const size of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(size);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Attack', exact: true }).tap();
  await page
    .getByRole('button', { name: 'Captain · Select target', exact: true })
    .tap();
  await expect(page.locator('.action-preview')).toContainText(
    'Target: Captain',
  );
  await page.screenshot({
    path: info.outputPath('combat-phone.png'),
    fullPage: true,
  });
});
test('Training Energy and prepared retry preserve campaign progress', async ({
  page,
}) => {
  const p = profile();
  p.energy = encounters.basicWard.training!.cost;
  const w = newWorld();
  w.room = 'training';
  await seed(page, p, w);
  await portal(page, 'Basic Training');
  await use(page, 'Attack');
  await expect(
    page.getByRole('heading', { name: 'Training ended' }),
  ).toBeVisible();
  await expect(page.locator('.stats')).toContainText(`Energy 0/${p.maxEnergy}`);
  const low = profile();
  low.life = 1;
  w.room = 'human';
  await seed(page, low, w);
  await portal(page, 'Human Gateway 1');
  await use(page, 'Attack');
  await expect(
    page.getByRole('heading', { name: 'Defeat', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Retry prepared' }).click();
  await expect(page.locator('.stats')).toContainText(
    `Energy ${low.energy - 10}/${low.maxEnergy}`,
  );
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Confirm Attack' }),
  ).toHaveCount(0);
});
test('potion stand and neighboring well, mobile room services', async ({
  page,
}, info) => {
  const p = profile();
  p.gold = potions.hybrid.price;
  p.mana = 1;
  const w = newWorld();
  w.room = 'potions';
  await seed(page, p, w);
  await page
    .getByRole('button', { name: 'Potion seller', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Buy Twin draught', exact: true })
    .click();
  const offer = page
    .locator('.potion-offer')
    .filter({ has: page.locator('strong', { hasText: 'Twin draught' }) });
  await offer.getByRole('button', { name: 'Slot 1', exact: true }).click();
  await page.getByRole('button', { name: 'Close seller' }).click();
  await go(page, 'Human Gateway');
  await portal(page, 'Human Gateway 1');
  await use(page, 'Slot 1: Twin draught');
  await expect(
    page.getByRole('heading', { name: 'Your turn', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Return to room', exact: true })
    .click();
  await go(page, 'Potions & Food');
  await page.getByRole('button', { name: 'Meal · recover free' }).click();
  await expect(page.getByRole('status')).toContainText('restored');
  await expect(page.locator('.potions')).toContainText(
    `${potions.hybrid.charges - 1}/${potions.hybrid.charges}`,
  );
  await page.getByRole('button', { name: 'Refill at well · free' }).click();
  await expect(page.locator('.potions')).toContainText(
    `${potions.hybrid.charges}/${potions.hybrid.charges}`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('potions-phone.png'),
    fullPage: true,
  });
});
test('completed campaign exposes ending and optional Rift, persists after reload', async ({
  page,
}, info) => {
  const p = profile();
  const w = newWorld();
  w.room = 'human';
  w.cleared.human = 20;
  await seed(page, p, w);
  await go(page, 'Potions & Food');
  await go(page, 'Entry');
  await go(page, 'Beyond the Temple');
  await expect(page.locator('.room-services')).toContainText(
    'journey through the temple is complete',
  );
  await page
    .getByRole('button', { name: 'Save progress', exact: true })
    .click();
  await page.reload();
  await page
    .getByRole('button', { name: 'Load saved progress', exact: true })
    .click();
  await expect(page.locator('.room-title')).toHaveText('Beyond the Temple');
  await go(page, 'Entry');
  await go(page, 'Potions & Food');
  await go(page, 'Weapons & Merchant');
  await go(page, 'Upstairs');
  await go(page, 'Advanced Equipment');
  await go(page, 'Statue Room');
  await go(page, 'High-difficulty Entryway');
  await go(page, 'High-difficulty Room');
  await page
    .getByRole('button', { name: 'Encounters / Training', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Enter Dark Rift 1', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('button', { name: 'Enter Dark Rift 2', exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: info.outputPath('rift.png'), fullPage: true });
});

test('standalone class portraits, hover/focus tooltips and Wanderer compatibility', async ({
  page,
}, info) => {
  await page.goto('./');
  await expect(page.locator('#game')).toBeHidden();
  await expect(page.locator('.room-exits')).toHaveCount(0);
  await expect(page.locator('.class-column')).toHaveCount(4);
  await expect(page.locator('.class-column h2')).toHaveText([
    'Warrior',
    'Qi Adept',
    'Swiftblade',
    'Wanderer',
  ]);
  await expect(page.locator('.class-columns')).not.toContainText('Mana');
  await expect
    .poll(() =>
      page
        .locator('.class-column img')
        .evaluateAll((images) =>
          images.every(
            (img) =>
              (img as HTMLImageElement).complete &&
              (img as HTMLImageElement).naturalWidth > 0,
          ),
        ),
    )
    .toBe(true);
  const card = page.getByLabel('Wanderer class preview', { exact: true });
  await card.hover();
  await expect(page.locator('#class-tip-balanced')).toHaveCSS('opacity', '1');
  await expect(page.locator('#class-tip-balanced')).toBeVisible();
  await expect(page.locator('#class-tip-balanced')).toContainText(
    'born with no specialty',
  );
  await page.screenshot({
    path: info.outputPath('classes-desktop.png'),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('Qi Adept class preview', { exact: true }).tap();
  await expect(page.locator('#class-tip-caster')).toHaveCSS('opacity', '1');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath('classes-phone.png'),
    fullPage: true,
  });
  await page
    .getByRole('button', { name: 'Choose Wanderer', exact: true })
    .click();
  await expect(page.locator('.room-title')).toHaveText('Entry');
  await expect(page.locator('.player-hud')).toContainText('Wanderer');
  await expect(page.locator('#game')).toBeVisible();
  await page
    .getByRole('button', { name: 'Save progress', exact: true })
    .click();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('rpg.phase1.save')!).player.classId,
    ),
  ).toBe('balanced');
  await page.reload();
  await page
    .getByRole('button', { name: 'Load saved progress', exact: true })
    .click();
  await expect(page.locator('.player-hud')).toContainText('Wanderer');
});

test('walking through doorways changes rooms and stops at the connecting entrance', async ({
  page,
}) => {
  await seed(page, profile());
  await page.keyboard.down('ArrowUp');
  try {
    await expect(page.locator('.room-title')).toHaveText('Potions & Food');
  } finally {
    await page.keyboard.up('ArrowUp');
  }
  // Arrival must remain in this room until the player walks back into the exit.
  await page.getByRole('button', { name: 'Map', exact: true }).click();
  await expect(page.locator('.room-title')).toHaveText('Potions & Food');
  await page.getByRole('button', { name: 'Close map', exact: true }).click();
  await page.keyboard.down('ArrowDown');
  try {
    await expect(page.locator('.room-title')).toHaveText('Entry', {
      timeout: 2000,
    });
  } finally {
    await page.keyboard.up('ArrowDown');
  }
});
