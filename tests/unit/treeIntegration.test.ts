import { describe, expect, it, vi } from 'vitest';
import {
  act,
  actionInfo,
  beginBattle,
  newSession,
  unavailable,
} from '../../src/core/session';
import { selectClass } from '../../src/core/progression';
import { allocateTreeNode } from '../../src/core/tree/allocation';

// Stands in for a tree edited with editor.html, so the game's default content path is exercised.
vi.mock('../../src/content/data/tree.json', async (importOriginal) => {
  const original = (await importOriginal()) as {
    default: { nodes: { id: string; effects: unknown[] }[] };
  };
  const tree = structuredClone(original.default);
  tree.nodes.find((node) => node.id === 'outer-warrior')!.effects = [
    { type: 'grantSkill', skill: 'doubleStrike', rank: 1 },
    {
      type: 'skillModifier',
      skill: 'doubleStrike',
      field: 'cost',
      amount: -100,
    },
    { type: 'stat', stat: 'physicalPower', amount: 10 },
  ];
  return { default: tree };
});

const basePower = (detail: string) =>
  Number(/Base power (\d+)/.exec(detail)?.[1]);

describe('tree effects in combat', () => {
  it('grant usable skills, change costs, and add power through session code', () => {
    const s = newSession();
    selectClass(s.player, 'warrior');
    s.player.speed = 100;
    expect(beginBattle(s)).toBe(true);
    expect(s.battle!.turn).toBe('player');
    const stabPower = basePower(actionInfo(s, 'stab').detail);
    expect(unavailable(s, 'doubleStrike')).toBe('Not learned');

    expect(allocateTreeNode(s.player.tree, 'outer-warrior')).toBe(true);
    expect(basePower(actionInfo(s, 'stab').detail)).toBe(stabPower + 10);
    expect(actionInfo(s, 'doubleStrike').cost).toBe(0);
    expect(unavailable(s, 'doubleStrike', 'enemy0')).toBeNull();
    const mana = s.player.mana;
    expect(act(s, 'doubleStrike', s.battle!.token, () => 0.99, 'enemy0')).toBe(
      true,
    );
    expect(s.player.mana).toBe(mana);
  });
});
