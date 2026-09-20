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
  newSession,
} from '../../src/core/session';

function cutDownBattle(learned = true) {
  const s = newSession();
  selectClass(s.player, 'warrior');
  if (learned) s.player.ranks.split = 1;
  s.player.speed = 100;
  return s;
}

describe('Cut Down', () => {
  it('costs 30 Qi, hits once for 20% of the target current Life, and never crits', () => {
    const s = cutDownBattle();
    expect(skills.split).toMatchObject({
      name: 'Cut Down',
      cost: 30,
      hits: 1,
      effect: 'enemyLife',
      percent: 20,
      noCrit: true,
    });
    expect(beginBattle(s)).toBe(true);
    const enemy = s.battle!.enemies[0];
    enemy.life = enemy.maxLife = 1000;
    enemy.shield = 0;
    const info = actionInfo(s, 'split');
    expect(info.name).toBe('Cut Down');
    expect(info.detail).toContain('Base power 200 ');
    expect(info.detail).toContain('Cannot critically strike');

    const mana = s.player.mana;
    // A roll of 0 would critically strike with any other action.
    expect(act(s, 'split', s.battle!.token, () => 0, 'enemy0')).toBe(true);
    expect(s.player.mana).toBe(mana - 30);
    expect(1000 - enemy.life).toBe(200 - enemy.defense);
    expect(s.log.some((line) => line.includes('Critical'))).toBe(false);
  });

  it('the Cut Down tree node grants the skill and its child raises damage to 25%', () => {
    const s = cutDownBattle(false);
    addExperience(s.player, 50 + 100 + 150);
    expect(s.player.level).toBe(4);
    expect(allocateNode(s.player, 'cut-down-deeper')).toBe(false);
    expect(allocateNode(s.player, 'outer-warrior')).toBe(true);
    expect(allocateNode(s.player, 'technique-cut-down')).toBe(true);
    expect(skillRank(s.player, 'split')).toBe(1);
    expect(effectiveSkill(s.player, 'split').percent).toBe(20);
    expect(allocateNode(s.player, 'cut-down-deeper')).toBe(true);
    expect(effectiveSkill(s.player, 'split').percent).toBe(25);

    expect(beginBattle(s)).toBe(true);
    const enemy = s.battle!.enemies[0];
    enemy.life = enemy.maxLife = 1000;
    expect(actionInfo(s, 'split').detail).toContain('Base power 250 ');
  });
});
