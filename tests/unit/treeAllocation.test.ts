import { describe, expect, it } from 'vitest';
import {
  addExperience,
  allocateNode,
  freeSkillPoints,
  respec,
  respecPreview,
  selectClass,
  treeNodeReason,
} from '../../src/core/progression';
import { newSession } from '../../src/core/session';
import { decodeSave, save } from '../../src/platform/save';

/** Warrior at level 3: two earned Skill Points, none spent beyond the free starter. */
function levelThreeWarrior() {
  const s = newSession();
  selectClass(s.player, 'warrior');
  addExperience(s.player, 50 + 100);
  return s;
}

describe('in-game tree allocation', () => {
  it('spends shared Skill Points on nodes connected to the class origin', () => {
    const s = newSession();
    selectClass(s.player, 'warrior');
    expect(freeSkillPoints(s.player)).toBe(0);
    expect(treeNodeReason(s.player, 'outer-warrior')).toBe('No Skill Points');

    addExperience(s.player, 50 + 100);
    expect(s.player.level).toBe(3);
    expect(freeSkillPoints(s.player)).toBe(2);
    expect(treeNodeReason(s.player, 'capstone-warrior')).toContain('connected');
    expect(allocateNode(s.player, 'outer-warrior')).toBe(true);
    expect(freeSkillPoints(s.player)).toBe(1);
    expect(treeNodeReason(s.player, 'outer-warrior')).toBe('Already allocated');
    expect(allocateNode(s.player, 'capstone-warrior')).toBe(true);
    expect(freeSkillPoints(s.player)).toBe(0);
    expect(allocateNode(s.player, 'inner-warrior')).toBe(false);
    expect(s.player.tree.allocated).toEqual([
      'outer-warrior',
      'capstone-warrior',
    ]);
  });

  it('Mentor respec refunds tree nodes along with ranks and stat choices', () => {
    const { player } = levelThreeWarrior();
    expect(allocateNode(player, 'outer-warrior')).toBe(true);
    const preview = respecPreview(player);
    expect(preview.treeNodes).toBe(1);
    expect(player.tree.allocated).toEqual(['outer-warrior']);
    player.gold = preview.price;
    expect(respec(player)).toBe(true);
    expect(player.tree).toEqual({
      origin: 'warrior',
      allocated: [],
      masteries: {},
    });
    expect(freeSkillPoints(player)).toBe(2);
    expect(respec(player)).toBe(false);
  });

  it('saves allocations and rejects trees that overspend Skill Points', () => {
    const s = levelThreeWarrior();
    expect(allocateNode(s.player, 'outer-warrior')).toBe(true);
    let raw = '';
    const storage = {
      getItem: () => raw || null,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    expect(save(storage, s)).toContain('saved');
    expect(decodeSave(raw).player.tree.allocated).toEqual(['outer-warrior']);
    const overspent = JSON.parse(raw);
    overspent.player.tree.allocated = [
      'outer-warrior',
      'capstone-warrior',
      'inner-warrior',
    ];
    expect(() => decodeSave(JSON.stringify(overspent))).toThrow(
      'Invalid points',
    );
  });
});
