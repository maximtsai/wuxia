import { campaign } from './world';
import rawSkills from './data/skills.json' with { type: 'json' };
import { validateSkillData, type ClassId, type Skill } from './schema';
export type { ClassId, Skill } from './schema';
export type StatChoice = 'strength' | 'speed' | 'life' | 'mana';
export const classes = {
  balanced: {
    name: 'Wanderer',
    strength: 15,
    speed: 15,
    life: 75,
    mana: 75,
    physical: 3,
    magic: 2,
    defense: 3,
    magicDefense: 2,
    growth: { strength: 2, speed: 2, life: 10, mana: 10 },
    starter: 'shuriken',
  },
  warrior: {
    name: 'Warrior',
    strength: 17,
    speed: 13,
    life: 85,
    mana: 65,
    physical: 5,
    magic: 0,
    defense: 5,
    magicDefense: 0,
    growth: { strength: 3, speed: 1, life: 15, mana: 5 },
    starter: 'stab',
  },
  caster: {
    name: 'Cultivator',
    strength: 15,
    speed: 13,
    life: 75,
    mana: 90,
    physical: 0,
    magic: 5,
    defense: 0,
    magicDefense: 5,
    growth: { strength: 1, speed: 2, life: 10, mana: 15 },
    starter: 'charge',
  },
  shadow: {
    name: 'Windstep',
    strength: 13,
    speed: 17,
    life: 70,
    mana: 80,
    physical: 3,
    magic: 3,
    defense: 2,
    magicDefense: 2,
    growth: { strength: 1, speed: 3, life: 10, mana: 10 },
    starter: 'shadowBlend',
  },
} as const satisfies Record<ClassId, object>;
/** Skill numbers live in `data/skills.json` (editable in editor.html); ids are referenced by code. */
export type SkillId = keyof typeof rawSkills;
export const skills = rawSkills as unknown as Record<SkillId, Skill>;
export const skillIds = Object.keys(skills) as SkillId[];
export const activeSkills = skillIds.filter(
  (id) => skills[id].kind !== 'passive',
);
export const passiveSkills = skillIds.filter(
  (id) => skills[id].kind === 'passive',
);
export type CombatAction = SkillId | 'attack' | 'potion0' | 'potion1';
export interface EnemyDefinition {
  name: string;
  life: number;
  mana: number;
  speed: number;
  damage: number;
  defense: number;
  magicDefense: number;
  shield: number;
  behavior: 'striker' | 'healer' | 'caster' | 'ward';
}
export interface EncounterDefinition {
  name: string;
  level: number;
  enemies: EnemyDefinition[];
  xp: number;
  gold: number;
  training?: { cost: number; xp: number };
}
const enemy = (
  name: string,
  life: number,
  speed: number,
  damage: number,
  behavior: EnemyDefinition['behavior'] = 'striker',
  shield = 0,
): EnemyDefinition => ({
  name,
  life,
  mana: 40,
  speed,
  damage,
  defense: 2,
  magicDefense: 2,
  shield,
  behavior,
});
export const encounters: Record<string, EncounterDefinition> = {
  ...campaign,
  practice: {
    name: 'Practice duel',
    level: 1,
    enemies: [enemy('Sentinel', 58, 8, 9)],
    xp: 30,
    gold: 12,
  },
  pair: {
    name: 'Shielded pair',
    level: 3,
    enemies: [
      enemy('Guard', 105, 14, 15, 'striker', 40),
      enemy('Scout', 85, 21, 12),
    ],
    xp: 100,
    gold: 24,
  },
  adepts: {
    name: 'Arcane duo',
    level: 7,
    enemies: [
      enemy('Invoker', 170, 23, 24, 'caster', 45),
      enemy('Mender', 150, 18, 16, 'healer', 30),
    ],
    xp: 240,
    gold: 40,
  },
  veterans: {
    name: 'Veteran challenge',
    level: 12,
    enemies: [
      enemy('Champion', 330, 31, 38, 'striker', 110),
      enemy('Hexer', 260, 29, 30, 'caster', 80),
    ],
    xp: 450,
    gold: 60,
  },
  mastery: {
    name: 'Mastery trial',
    level: 15,
    enemies: [
      enemy('Warden', 500, 40, 48, 'striker', 170),
      enemy('Oracle', 390, 35, 34, 'healer', 120),
    ],
    xp: 700,
    gold: 90,
  },
  basicWard: {
    name: 'Basic Training',
    level: 1,
    enemies: [enemy('Basic Ward', 80, 15, 7, 'ward', 300)],
    xp: 0,
    gold: 0,
    training: { cost: 2, xp: 3 },
  },
  ward: {
    name: 'Training',
    level: 5,
    enemies: [enemy('Training Ward', 180, 30, 14, 'ward', 500)],
    xp: 0,
    gold: 0,
    training: { cost: 3, xp: 5 },
  },
  advancedWard: {
    name: 'Advanced Training',
    level: 10,
    enemies: [enemy('Advanced Ward', 300, 40, 23, 'ward', 700)],
    xp: 0,
    gold: 0,
    training: { cost: 10, xp: 20 },
  },
};
export function validateContent() {
  const issues = validateSkillData(skills);
  if (issues.length)
    throw new Error(
      'Invalid skill content: ' + issues.map((i) => i.message).join('; '),
    );
  if (activeSkills.length !== 16 || passiveSkills.length !== 3)
    throw new Error('Invalid roster');
  for (const c of Object.values(classes))
    if (!Object.hasOwn(skills, c.starter))
      throw new Error('Unknown skill ' + c.starter);
  for (const e of Object.values(encounters))
    if (e.enemies.length < 1 || e.enemies.length > 2)
      throw new Error('Invalid encounter');
}
validateContent();
