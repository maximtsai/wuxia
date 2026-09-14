import { describe, expect, it } from 'vitest';
import { validateTreeContent } from '../../src/content/tree';
import {
  allocateTreeNode,
  newTreeProgress,
  resetTreeProgress,
  treeAllocationReason,
  validateTreeProgress,
} from '../../src/core/tree/allocation';
import { dispatchCombatCommand } from '../../src/core/combat/commands';
import { beginBattle, newSession } from '../../src/core/session';
import { selectClass } from '../../src/core/progression';
import {
  decodePreferences,
  defaultPreferences,
  loadPreferences,
  savePreferences,
} from '../../src/platform/preferences';

describe('shared-tree foundation', () => {
  it('validates connected placeholder topology with specialist starts before the edge', () => {
    expect(() => validateTreeContent()).not.toThrow();
  });

  it('allocates only connected nodes and treats origins as free junctions', () => {
    const progress = newTreeProgress();
    progress.origin = 'warrior';
    expect(treeAllocationReason(progress, 'inner-qi')).toContain('connected');
    expect(allocateTreeNode(progress, 'origin-warrior')).toBe(false);
    expect(allocateTreeNode(progress, 'outer-warrior')).toBe(true);
    expect(allocateTreeNode(progress, 'capstone-warrior')).toBe(true);
    expect(() => validateTreeProgress(progress)).not.toThrow();
  });

  it('resets purchased nodes without changing the class origin', () => {
    const progress = newTreeProgress();
    progress.origin = 'warrior';
    expect(allocateTreeNode(progress, 'outer-warrior')).toBe(true);
    expect(resetTreeProgress(progress)).toBe(1);
    expect(progress).toEqual({
      origin: 'warrior',
      allocated: [],
      masteries: {},
    });
  });
});

describe('combat command and event foundation', () => {
  it('dispatches a token-checked command and records structured events', () => {
    const session = newSession();
    selectClass(session.player, 'warrior');
    session.player.speed = 100;
    session.player.mana = 0;
    beginBattle(session);
    const token = session.battle!.token;
    expect(
      dispatchCombatCommand(
        session,
        {
          type: 'use-action',
          actionId: 'attack',
          token,
          targetId: 'enemy0',
        },
        () => 0.99,
      ),
    ).toBe(true);
    expect(session.player.mana).toBe(10);
    expect(
      session.battle!.events.some((event) => event.type === 'damage'),
    ).toBe(true);
    expect(
      session.battle!.events.some(
        (event) =>
          event.type === 'resource-changed' &&
          event.resource === 'qi' &&
          event.amount === 10,
      ),
    ).toBe(true);
    expect(
      dispatchCombatCommand(session, {
        type: 'resolve-npc-turn',
        token,
      }),
    ).toBe(false);
  });
});

describe('preferences foundation', () => {
  it('round-trips valid settings and safely falls back from invalid storage', () => {
    let raw: string | null = null;
    const storage = {
      getItem: () => raw,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    const preferences = {
      ...defaultPreferences(),
      music: 0.4,
      reducedMotion: true,
    };
    savePreferences(storage, preferences);
    expect(loadPreferences(storage)).toEqual(preferences);
    expect(decodePreferences(raw!)).toEqual(preferences);
    raw = '{"music": 2}';
    expect(loadPreferences(storage)).toEqual(defaultPreferences());
  });
});
