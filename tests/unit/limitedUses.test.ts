import { describe, expect, it } from 'vitest';
import { skills } from '../../src/content/phase2';
import {
  addExperience,
  allocateNode,
  effectiveSkill,
  selectClass,
  skillRank,
} from '../../src/core/progression';
import {
  act,
  actionInfo,
  beginBattle,
  enemyAct,
  newSession,
  returnToRoom,
  unavailable,
  type Session,
} from '../../src/core/session';

function avengerBattle() {
  const s = newSession();
  selectClass(s.player, 'warrior');
  s.player.ranks.avenger = 1;
  s.player.speed = 100;
  expect(beginBattle(s)).toBe(true);
  for (const enemy of s.battle!.enemies) {
    enemy.life = enemy.maxLife = 10_000;
    enemy.damage = 1;
  }
  return s;
}

function untilPlayerTurn(s: Session) {
  while (s.battle!.turn !== 'player')
    expect(enemyAct(s, () => 0.99)).toBe(true);
}

describe('limited-use techniques', () => {
  it('uses run out within an encounter and reset for the next one', () => {
    const s = avengerBattle(),
      p = s.player,
      max = skills.avenger.uses!;
    expect(max).toBeGreaterThan(0);
    expect(unavailable(s, 'avenger', 'enemy0')).toBe('No missing Life');
    p.life = Math.ceil(p.maxLife / 2);
    expect(actionInfo(s, 'avenger').uses).toEqual({ left: max, max });
    for (let used = 1; used <= max; used++) {
      expect(act(s, 'avenger', s.battle!.token, () => 0.99, 'enemy0')).toBe(
        true,
      );
      untilPlayerTurn(s);
      expect(actionInfo(s, 'avenger').uses).toEqual({
        left: max - used,
        max,
      });
    }
    expect(unavailable(s, 'avenger', 'enemy0')).toBe('No uses left');
    expect(act(s, 'avenger', s.battle!.token, () => 0.99, 'enemy0')).toBe(
      false,
    );
    expect(returnToRoom(s)).toBe(true);
    expect(beginBattle(s)).toBe(true);
    expect(actionInfo(s, 'avenger').uses).toEqual({ left: max, max });
  });

  it('the Avenger tree node grants the skill and its child node adds a use', () => {
    const s = newSession();
    selectClass(s.player, 'warrior');
    addExperience(s.player, 50 + 100 + 150);
    expect(skillRank(s.player, 'avenger')).toBe(0);
    expect(allocateNode(s.player, 'avenger-third-use')).toBe(false);
    expect(allocateNode(s.player, 'outer-warrior')).toBe(true);
    expect(allocateNode(s.player, 'technique-avenger')).toBe(true);
    expect(skillRank(s.player, 'avenger')).toBe(1);
    const base = effectiveSkill(s.player, 'avenger').uses!;
    expect(allocateNode(s.player, 'avenger-third-use')).toBe(true);
    expect(effectiveSkill(s.player, 'avenger').uses).toBe(base + 1);
    expect(effectiveSkill(s.player, 'stab').uses).toBeUndefined();
  });
});
