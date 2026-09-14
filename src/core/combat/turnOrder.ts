import type { Fighter } from '../types';

export const PLAYER_ID = 'player';
export const SHADOW_ID = 'shadow';

/**
 * Speed only chooses which side opens combat. It never grants extra turns or
 * changes a combatant's position after the encounter begins. Enemies win ties.
 */
export function createOpeningOrder(playerSpeed: number, enemies: Fighter[]) {
  const enemyIds = enemies.map((enemy) => enemy.id);
  const fastestEnemy = Math.max(...enemies.map((enemy) => enemy.speed));
  return playerSpeed > fastestEnemy
    ? [PLAYER_ID, ...enemyIds]
    : [...enemyIds, PLAYER_ID];
}

/** A summon joins the next cycle directly after its owner. */
export function addShadowToOrder(order: string[]) {
  if (order.includes(SHADOW_ID)) return order;
  const next = [...order];
  const player = next.indexOf(PLAYER_ID);
  next.splice(player < 0 ? next.length : player + 1, 0, SHADOW_ID);
  return next;
}

export function livingCycle(
  openingOrder: string[],
  alive: (id: string) => boolean,
) {
  return openingOrder.filter(alive);
}
