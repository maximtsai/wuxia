import { treeIndex } from '../../content/tree';
import {
  treeStats,
  type SkillModifierField,
  type TreeIndex,
  type TreeNodeDefinition,
  type TreeStat,
} from '../../content/schema';
import type { TreeProgress } from './allocation';

/** Summed gameplay effects of every allocated tree node. */
export interface TreeModifiers {
  flat: Record<TreeStat, number>;
  percent: Record<TreeStat, number>;
  /** Highest rank granted per skill id. */
  grantedRanks: Record<string, number>;
  skillModifiers: Record<string, Record<SkillModifierField, number>>;
  flags: Set<string>;
}

const zeroStats = () =>
  Object.fromEntries(treeStats.map((stat) => [stat, 0])) as Record<
    TreeStat,
    number
  >;

/** Tolerates missing progress and unknown ids so it is safe while a save is still being validated. */
export function treeModifiers(
  tree: TreeProgress | undefined,
  index: TreeIndex = treeIndex,
): TreeModifiers {
  const mods: TreeModifiers = {
    flat: zeroStats(),
    percent: zeroStats(),
    grantedRanks: {},
    skillModifiers: {},
    flags: new Set(),
  };
  if (!tree || !Array.isArray(tree.allocated)) return mods;
  for (const id of tree.allocated) {
    const node: TreeNodeDefinition | undefined = index.byId[id];
    if (!node) continue;
    for (const effect of node.effects)
      switch (effect.type) {
        case 'stat':
          mods.flat[effect.stat] += effect.amount;
          break;
        case 'statPercent':
          mods.percent[effect.stat] += effect.percent;
          break;
        case 'grantSkill':
          mods.grantedRanks[effect.skill] = Math.max(
            mods.grantedRanks[effect.skill] ?? 0,
            effect.rank,
          );
          break;
        case 'skillModifier':
          mods.skillModifiers[effect.skill] ??= {
            cost: 0,
            power: 0,
            hits: 0,
            uses: 0,
            percent: 0,
          };
          mods.skillModifiers[effect.skill][effect.field] += effect.amount;
          break;
        case 'flag':
          mods.flags.add(effect.flag);
          break;
      }
  }
  return mods;
}

/** Applies flat then percentage bonuses to a base value, floored and never below `min`. */
export function applyTreeStat(
  mods: TreeModifiers,
  stat: TreeStat,
  base: number,
  min = 0,
) {
  return Math.max(
    min,
    Math.floor((base + mods.flat[stat]) * (1 + mods.percent[stat] / 100)),
  );
}

/** For rules implemented in code that a node switches on via a `flag` effect. */
export function hasTreeFlag(tree: TreeProgress | undefined, flag: string) {
  return treeModifiers(tree).flags.has(flag);
}
