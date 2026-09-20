/**
 * Data shapes and validators for editable JSON content (`content/data/*.json`).
 * Pure and dependency-free so the game, the skill tree editor, and the editor's
 * dev-server save endpoint all apply exactly the same rules.
 */

export const classIds = ['balanced', 'warrior', 'caster', 'shadow'] as const;
export type ClassId = (typeof classIds)[number];

export const skillKinds = ['physical', 'magic', 'support', 'passive'] as const;
export const skillTargets = ['single', 'all', 'self'] as const;
export const skillEffects = [
  'burn',
  'weaken',
  'shield',
  'manaBomb',
  'avenger',
  'heal',
  'charge',
  'summon',
  'enemyLife',
] as const;

export interface Skill {
  name: string;
  icon: string;
  cost: number;
  level: number;
  requires: string[];
  kind: (typeof skillKinds)[number];
  target: (typeof skillTargets)[number];
  hits: number;
  power: number;
  effect?: (typeof skillEffects)[number];
  description: string;
  /** Uses per encounter; omitted means unlimited. */
  uses?: number;
  /** Life percentage for `avenger` (missing Life) and `enemyLife` (target's current Life) damage. */
  percent?: number;
  /** When true, the skill never critically strikes. */
  noCrit?: boolean;
}

export const treeNodeKinds = [
  'origin',
  'passive',
  'technique',
  'mastery',
  'discipline',
  'vow',
] as const;
export type TreeNodeKind = (typeof treeNodeKinds)[number];

/** Stats a tree node can modify. Power stats add to action power; defenses reduce damage taken. */
export const treeStats = [
  'strength',
  'speed',
  'maxLife',
  'maxMana',
  'maxEnergy',
  'defense',
  'qiDefense',
  'physicalPower',
  'qiPower',
] as const;
export type TreeStat = (typeof treeStats)[number];
export const treeStatLabels: Record<TreeStat, string> = {
  strength: 'Strength',
  speed: 'Speed',
  maxLife: 'Max Life',
  maxMana: 'Max Qi',
  maxEnergy: 'Max Energy',
  defense: 'Defense',
  qiDefense: 'Qi Defense',
  physicalPower: 'Physical power',
  qiPower: 'Qi power',
};

export const skillModifierFields = [
  'cost',
  'power',
  'hits',
  'uses',
  'percent',
] as const;
export type SkillModifierField = (typeof skillModifierFields)[number];

export type TreeEffect =
  | { type: 'stat'; stat: TreeStat; amount: number }
  | { type: 'statPercent'; stat: TreeStat; percent: number }
  | { type: 'grantSkill'; skill: string; rank: number }
  | {
      type: 'skillModifier';
      skill: string;
      field: SkillModifierField;
      amount: number;
    }
  | { type: 'flag'; flag: string };
export type TreeEffectType = TreeEffect['type'];
export const treeEffectTypes: readonly TreeEffectType[] = [
  'stat',
  'statPercent',
  'grantSkill',
  'skillModifier',
  'flag',
];

export interface TreeNodeDefinition {
  id: string;
  name: string;
  description?: string;
  kind: TreeNodeKind;
  region: string;
  position: { x: number; y: number };
  connections: string[];
  origin?: ClassId;
  masteryGroup?: string;
  placeholder?: boolean;
  effects: TreeEffect[];
}

export interface TreeData {
  nodes: TreeNodeDefinition[];
}

export interface TreeIndex {
  data: TreeData;
  nodes: readonly TreeNodeDefinition[];
  byId: Readonly<Record<string, TreeNodeDefinition>>;
  originByClass: Readonly<Record<ClassId, string>>;
}

export interface ContentIssue {
  message: string;
  /** Tree node id or skill id the issue belongs to, for editor navigation. */
  target?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;
const includes = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v);

export const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** Builds lookups for already-validated tree data. */
export function indexTree(data: TreeData): TreeIndex {
  const byId: Record<string, TreeNodeDefinition> = Object.create(null);
  for (const node of data.nodes) byId[node.id] = node;
  const originByClass = {} as Record<ClassId, string>;
  for (const node of data.nodes)
    if (node.kind === 'origin' && node.origin)
      originByClass[node.origin] = node.id;
  return { data, nodes: data.nodes, byId, originByClass };
}

function validateEffect(
  effect: unknown,
  where: string,
  skillIds: readonly string[],
  issue: (message: string) => void,
) {
  if (!isObject(effect) || !includes(treeEffectTypes, effect.type))
    return issue(`${where}: unknown effect type`);
  switch (effect.type) {
    case 'stat':
    case 'statPercent': {
      if (!includes(treeStats, effect.stat))
        issue(`${where}: unknown stat "${String(effect.stat)}"`);
      const value = effect.type === 'stat' ? effect.amount : effect.percent;
      if (!isFiniteNumber(value)) issue(`${where}: value must be a number`);
      break;
    }
    case 'grantSkill':
      if (!includes(skillIds, effect.skill))
        issue(`${where}: unknown skill "${String(effect.skill)}"`);
      if (
        !Number.isInteger(effect.rank) ||
        (effect.rank as number) < 1 ||
        (effect.rank as number) > 10
      )
        issue(`${where}: granted rank must be an integer from 1 to 10`);
      break;
    case 'skillModifier':
      if (!includes(skillIds, effect.skill))
        issue(`${where}: unknown skill "${String(effect.skill)}"`);
      if (!includes(skillModifierFields, effect.field))
        issue(`${where}: unknown skill field "${String(effect.field)}"`);
      if (!isFiniteNumber(effect.amount))
        issue(`${where}: amount must be a number`);
      break;
    case 'flag':
      if (!isNonEmptyString(effect.flag) || !ID_PATTERN.test(effect.flag))
        issue(
          `${where}: flag must be a non-empty id (letters, digits, - or _)`,
        );
      break;
  }
}

export function validateTreeData(
  data: unknown,
  context: { skillIds: readonly string[] },
): ContentIssue[] {
  const issues: ContentIssue[] = [];
  if (!isObject(data) || !Array.isArray(data.nodes))
    return [{ message: 'Tree data must be an object with a "nodes" array' }];
  const nodes = data.nodes as unknown[];
  const ids = new Set<string>();
  for (const [i, raw] of nodes.entries()) {
    if (!isObject(raw)) {
      issues.push({ message: `Node #${i} is not an object` });
      continue;
    }
    const id = typeof raw.id === 'string' ? raw.id : `#${i}`;
    const issue = (message: string) =>
      issues.push({ message: `${id}: ${message}`, target: id });
    if (!isNonEmptyString(raw.id) || !ID_PATTERN.test(raw.id))
      issue('id must use letters, digits, - or _');
    else if (ids.has(raw.id)) issue('duplicate id');
    else ids.add(raw.id);
    if (!isNonEmptyString(raw.name)) issue('name is required');
    if (raw.description !== undefined && typeof raw.description !== 'string')
      issue('description must be text');
    if (!includes(treeNodeKinds, raw.kind)) issue('unknown kind');
    if (!isNonEmptyString(raw.region)) issue('region is required');
    if (
      !isObject(raw.position) ||
      !isFiniteNumber(raw.position.x) ||
      !isFiniteNumber(raw.position.y)
    )
      issue('position needs numeric x and y');
    if (
      !Array.isArray(raw.connections) ||
      raw.connections.some((c) => typeof c !== 'string')
    )
      issue('connections must be a list of node ids');
    if (raw.kind === 'origin') {
      if (!includes(classIds, raw.origin))
        issue('origin nodes must name a class');
    } else if (raw.origin !== undefined)
      issue('only origin nodes may set a class origin');
    if (
      raw.masteryGroup !== undefined &&
      (!isNonEmptyString(raw.masteryGroup) || raw.kind === 'origin')
    )
      issue('mastery group must be non-empty and not on an origin');
    if (raw.placeholder !== undefined && typeof raw.placeholder !== 'boolean')
      issue('placeholder must be true or false');
    if (!Array.isArray(raw.effects)) issue('effects must be a list');
    else
      raw.effects.forEach((effect, n) =>
        validateEffect(effect, `effect ${n + 1}`, context.skillIds, issue),
      );
  }
  if (issues.length) return issues;

  const tree = data as unknown as TreeData;
  const index = indexTree(tree);
  for (const node of tree.nodes) {
    const seen = new Set<string>();
    for (const other of node.connections) {
      const target = node.id;
      if (other === node.id)
        issues.push({ message: `${node.id}: connects to itself`, target });
      else if (seen.has(other))
        issues.push({
          message: `${node.id}: duplicate connection to ${other}`,
          target,
        });
      else if (!index.byId[other])
        issues.push({
          message: `${node.id}: references missing node ${other}`,
          target,
        });
      else if (!index.byId[other].connections.includes(node.id))
        issues.push({
          message: `${node.id} and ${other} must link both ways`,
          target,
        });
      seen.add(other);
    }
  }
  for (const classId of classIds) {
    const origins = tree.nodes.filter((node) => node.origin === classId);
    if (origins.length !== 1) {
      issues.push({
        message: `Class ${classId} needs exactly one origin node (found ${origins.length})`,
      });
      continue;
    }
    const node = origins[0];
    if (classId === 'balanced') continue;
    const radius = Math.hypot(node.position.x, node.position.y);
    const furthest = Math.max(
      ...tree.nodes
        .filter((candidate) => candidate.region === node.region)
        .map((candidate) =>
          Math.hypot(candidate.position.x, candidate.position.y),
        ),
    );
    if (radius >= furthest)
      issues.push({
        message: `${node.id}: specialist origin must sit closer to the center than the outer edge of region ${node.region}`,
        target: node.id,
      });
  }
  if (issues.length) return issues;

  const start = index.originByClass.balanced;
  const seen = new Set<string>([start]);
  const pending = [start];
  while (pending.length) {
    const id = pending.shift()!;
    for (const next of index.byId[id].connections)
      if (!seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
  }
  for (const node of tree.nodes)
    if (!seen.has(node.id))
      issues.push({
        message: `${node.id}: not connected to the Wanderer origin`,
        target: node.id,
      });
  return issues;
}

export function validateSkillData(
  data: unknown,
  context: { expectedIds?: readonly string[] } = {},
): ContentIssue[] {
  if (!isObject(data))
    return [{ message: 'Skill data must be an object keyed by skill id' }];
  const issues: ContentIssue[] = [];
  const ids = Object.keys(data);
  if (context.expectedIds) {
    const expected = new Set(context.expectedIds);
    for (const id of ids)
      if (!expected.has(id))
        issues.push({
          message: `${id}: skills cannot be added or renamed in data alone; game code references skill ids`,
          target: id,
        });
    for (const id of expected)
      if (!Object.hasOwn(data, id))
        issues.push({ message: `${id}: skill is missing`, target: id });
  }
  for (const [id, raw] of Object.entries(data)) {
    const issue = (message: string) =>
      issues.push({ message: `${id}: ${message}`, target: id });
    if (!ID_PATTERN.test(id)) issue('id must use letters, digits, - or _');
    if (!isObject(raw)) {
      issue('must be an object');
      continue;
    }
    if (!isNonEmptyString(raw.name)) issue('name is required');
    if (typeof raw.icon !== 'string') issue('icon must be text');
    if (typeof raw.description !== 'string') issue('description must be text');
    for (const field of ['cost', 'hits', 'power'] as const)
      if (!isFiniteNumber(raw[field]) || (raw[field] as number) < 0)
        issue(`${field} must be a number of at least 0`);
    if (
      !Number.isInteger(raw.level) ||
      (raw.level as number) < 1 ||
      (raw.level as number) > 99
    )
      issue('level must be an integer from 1 to 99');
    if (!Number.isInteger(raw.hits)) issue('hits must be a whole number');
    if (!includes(skillKinds, raw.kind)) issue('unknown kind');
    if (!includes(skillTargets, raw.target)) issue('unknown target');
    if (raw.effect !== undefined && !includes(skillEffects, raw.effect))
      issue('unknown effect');
    if (
      raw.uses !== undefined &&
      (!Number.isInteger(raw.uses) || (raw.uses as number) < 1)
    )
      issue('uses must be a whole number of at least 1');
    if (
      raw.percent !== undefined &&
      (!isFiniteNumber(raw.percent) || raw.percent < 0)
    )
      issue('percent must be a number of at least 0');
    if (
      (raw.effect === 'avenger' || raw.effect === 'enemyLife') &&
      raw.percent === undefined
    )
      issue(`${raw.effect} skills need a percent`);
    if (raw.noCrit !== undefined && typeof raw.noCrit !== 'boolean')
      issue('noCrit must be true or false');
    if (
      !Array.isArray(raw.requires) ||
      raw.requires.some((r) => !includes(ids, r))
    )
      issue('requires must list existing skill ids');
  }
  if (issues.length) return issues;

  const skills = data as Record<string, Skill>;
  const visited = new Set<string>(),
    visiting = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    const ok = skills[id].requires.every(visit);
    visiting.delete(id);
    visited.add(id);
    return ok;
  };
  for (const id of ids)
    if (!visit(id)) {
      issues.push({ message: `${id}: prerequisite cycle`, target: id });
      break;
    }
  return issues;
}

/** Stable short hash used to detect saves made against different content. */
export function contentHash(...parts: unknown[]) {
  let hash = 0x811c9dc5;
  const text = JSON.stringify(parts);
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
