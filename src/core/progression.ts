import {
  classes,
  skills,
  skillIds,
  type ClassId,
  type Skill,
  type SkillId,
  type StatChoice,
} from '../content/phase2';
import { treeIndex, type TreeNodeId } from '../content/tree';
import type { TreeIndex } from '../content/schema';
import type { Player } from './types';
import { weapons } from '../content/catalog';
import {
  allocateTreeNode,
  resetTreeProgress,
  treeAllocationReason,
} from './tree/allocation';
import { applyTreeStat, treeModifiers } from './tree/effects';
export function starter(p: Player): SkillId {
  return classes[p.classId ?? 'balanced'].starter;
}
export function syncStats(p: Player, index: TreeIndex = treeIndex) {
  const c = classes[p.classId ?? 'balanced'],
    bonus = Math.floor(p.level / 5) * 2,
    tree = treeModifiers(p.tree, index);
  const count = (id: StatChoice) => p.choices.filter((v) => v === id).length;
  p.strength = applyTreeStat(
    tree,
    'strength',
    c.strength + bonus + count('strength') * c.growth.strength,
  );
  p.speed = applyTreeStat(
    tree,
    'speed',
    c.speed + bonus + count('speed') * c.growth.speed,
  );
  p.maxLife = applyTreeStat(
    tree,
    'maxLife',
    c.life + (p.level - 1) * 5 + count('life') * c.growth.life,
    1,
  );
  p.maxMana = applyTreeStat(
    tree,
    'maxMana',
    c.mana + (p.level - 1) * 5 + count('mana') * c.growth.mana,
  );
  p.maxEnergy = applyTreeStat(tree, 'maxEnergy', 50 + (p.level - 1) * 3, 1);
}
/** Learned rank, or the rank granted by allocated tree nodes when that is higher. */
export function skillRank(p: Player, id: SkillId, index = treeIndex) {
  return Math.max(
    p.ranks[id] ?? 0,
    treeModifiers(p.tree, index).grantedRanks[id] ?? 0,
  );
}
/** Skill definition with tree modifiers applied to cost, power, and hits. */
export function effectiveSkill(
  p: Player,
  id: SkillId,
  index = treeIndex,
): Skill {
  const base: Skill = skills[id],
    mod = treeModifiers(p.tree, index).skillModifiers[id];
  if (!mod) return base;
  return {
    ...base,
    cost: Math.max(0, Math.round(base.cost + mod.cost)),
    power: Math.max(0, base.power + mod.power),
    hits: base.hits > 0 ? Math.max(1, Math.round(base.hits + mod.hits)) : 0,
    // Tree nodes can add uses to limited techniques but never limit unlimited ones.
    uses:
      base.uses === undefined
        ? undefined
        : Math.max(1, Math.round(base.uses + mod.uses)),
    percent:
      base.percent === undefined
        ? undefined
        : Math.max(0, base.percent + mod.percent),
  };
}
export function effectiveSpeed(p: Player) {
  return p.speed + skillRank(p, 'shadowBlend') * 2;
}
export function earnedSkillPoints(p: Player) {
  return p.level - 1 + Math.floor(p.level / 5);
}
/** Technique ranks and tree nodes spend one shared pool; the class starter rank is free. */
export function freeSkillPoints(p: Player) {
  return (
    earnedSkillPoints(p) -
    skillIds.reduce((n, id) => n + (p.ranks[id] ?? 0), 0) +
    1 -
    (p.tree?.allocated?.length ?? 0)
  );
}
export function learnReason(p: Player, id: SkillId): string | null {
  const d = skills[id];
  if (!p.classId) return 'Choose a class';
  if ((p.ranks[id] ?? 0) >= 10) return 'Maximum rank';
  if (p.level < d.level) return `Requires level ${d.level}`;
  if (id !== starter(p)) {
    const missing = d.requires.filter((r) => !p.ranks[r as SkillId]);
    if (missing.length)
      return (
        'Requires ' + missing.map((r) => skills[r as SkillId].name).join(', ')
      );
  }
  if (freeSkillPoints(p) < 1) return 'No Skill Points';
  return null;
}
export function learn(p: Player, id: SkillId) {
  if (!Object.hasOwn(skills, id) || learnReason(p, id)) return false;
  p.ranks[id] = (p.ranks[id] ?? 0) + 1;
  return true;
}
/** Why a tree node cannot be allocated right now, or null when it can. */
export function treeNodeReason(p: Player, id: TreeNodeId): string | null {
  if (!p.classId) return 'Choose a class';
  const reason = treeAllocationReason(p.tree, id);
  if (reason) return reason;
  if (freeSkillPoints(p) < 1) return 'No Skill Points';
  return null;
}
export function allocateNode(p: Player, id: TreeNodeId) {
  if (treeNodeReason(p, id)) return false;
  allocateTreeNode(p.tree, id);
  syncStats(p);
  p.life = Math.min(p.life, p.maxLife);
  p.mana = Math.min(p.mana, p.maxMana);
  p.energy = Math.min(p.energy, p.maxEnergy);
  return true;
}
export function chooseStat(p: Player, id: StatChoice) {
  if (
    !['strength', 'speed', 'life', 'mana'].includes(id) ||
    p.choices.length >= p.level - 1
  )
    return false;
  p.choices.push(id);
  syncStats(p);
  return true;
}
export function selectClass(p: Player, id: ClassId) {
  if (p.classId || !Object.hasOwn(classes, id)) return false;
  const life = p.life / p.maxLife,
    mana = p.mana / p.maxMana;
  p.classId = id;
  p.ranks = { [classes[id].starter]: 1 };
  p.tree = { origin: id, allocated: [], masteries: {} };
  syncStats(p);
  p.life = Math.min(p.maxLife, Math.round(life * p.maxLife));
  p.mana = Math.min(p.maxMana, Math.round(mana * p.maxMana));
  return true;
}
export function addExperience(p: Player, amount: number) {
  p.xp += amount;
  let levels = 0;
  while (p.level < 99 && p.xp >= 50 * p.level) {
    p.xp -= 50 * p.level;
    p.level++;
    levels++;
  }
  if (p.level === 99) p.xp = Math.min(p.xp, 4950);
  syncStats(p);
  if (levels) {
    p.life = p.maxLife;
    p.mana = p.maxMana;
    p.energy = p.maxEnergy;
  }
  return levels;
}
export function respecPreview(p: Player) {
  const preview = {
    ...p,
    choices: [],
    ranks: { [starter(p)]: 1 },
    tree: { origin: p.tree.origin, allocated: [], masteries: {} },
  } as Player;
  syncStats(preview);
  return {
    price: p.level * 2,
    strength: preview.strength,
    speed: preview.speed,
    maxLife: preview.maxLife,
    maxMana: preview.maxMana,
    statPoints: p.level - 1,
    skillPoints: earnedSkillPoints(p),
    treeNodes: p.tree.allocated.length,
    unequip:
      p.strength >= weapons[p.weapon].strength &&
      preview.strength < weapons[p.weapon].strength,
  };
}
export function respec(p: Player) {
  const v = respecPreview(p);
  if (
    !p.classId ||
    (!p.choices.length &&
      !p.tree.allocated.length &&
      skillIds.reduce((n, id) => n + (p.ranks[id] ?? 0), 0) <= 1) ||
    p.gold < v.price
  )
    return false;
  p.gold -= v.price;
  p.choices = [];
  p.ranks = { [starter(p)]: 1 };
  resetTreeProgress(p.tree);
  syncStats(p);
  p.life = Math.min(p.life, p.maxLife);
  p.mana = Math.min(p.mana, p.maxMana);
  p.energy = Math.min(p.energy, p.maxEnergy);
  if (weapons[p.weapon].strength > p.strength) p.weapon = 'starter';
  if (p.strength < 15) p.shieldEquipped = false;
  return true;
}
