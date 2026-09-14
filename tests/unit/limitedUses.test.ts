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
  it('Avenger costs no Qi, deals 250% of missing Life, and has two uses per encounter', () => {
    const s = avengerBattle(),
      p = s.player,
      enemy = s.battle!.enemies[0];
    expect(skills.avenger.uses).toBe(2);
    expect(unavailable(s, 'avenger', 'enemy0')).toBe('No missing Life');

    p.life = p.maxLife - 40;
    expect(actionInfo(s, 'avenger')).toMatchObject({
      cost: 0,
      uses: { left: 2, max: 2 },
    });
    expect(actionInfo(s, 'avenger').detail).toContain('Base power 100 ');
    const mana = p.mana,
      lifeBefore = enemy.life;
    expect(act(s, 'avenger', s.battle!.token, () => 0.99, 'enemy0')).toBe(true);
    expect(p.mana).toBe(mana);
    expect(lifeBefore - enemy.life).toBe(100 - enemy.defense);

    untilPlayerTurn(s);
    expect(actionInfo(s, 'avenger').uses).toEqual({ left: 1, max: 2 });
    expect(act(s, 'avenger', s.battle!.token, () => 0.99, 'enemy0')).toBe(true);
    untilPlayerTurn(s);
    expect(unavailable(s, 'avenger', 'enemy0')).toBe('No uses left');
    expect(act(s, 'avenger', s.battle!.token, () => 0.99, 'enemy0')).toBe(
      false,
    );
    expect(s.battle!.usesSpent.avenger).toBe(2);

    expect(returnToRoom(s)).toBe(true);
    expect(beginBattle(s)).toBe(true);
    expect(actionInfo(s, 'avenger').uses).toEqual({ left: 2, max: 2 });
  });

  it('the Avenger tree node grants the skill and its child node adds a third use', () => {
    const s = newSession();
    selectClass(s.player, 'warrior');
    addExperience(s.player, 50 + 100 + 150);
    expect(s.player.level).toBe(4);
    expect(skillRank(s.player, 'avenger')).toBe(0);
    expect(allocateNode(s.player, 'avenger-third-use')).toBe(false);
    expect(allocateNode(s.player, 'outer-warrior')).toBe(true);
    expect(allocateNode(s.player, 'technique-avenger')).toBe(true);
    expect(skillRank(s.player, 'avenger')).toBe(1);
    expect(effectiveSkill(s.player, 'avenger').uses).toBe(2);
    expect(allocateNode(s.player, 'avenger-third-use')).toBe(true);
    expect(effectiveSkill(s.player, 'avenger').uses).toBe(3);
    expect(effectiveSkill(s.player, 'stab').uses).toBeUndefined();
  });
});
