import { rooms, portals, newWorld, type WorldState } from '../content/world';
import {
  newSession,
  copyPlayer,
  normalizePlayer,
  type Player,
  type Session,
} from '../core/session';
import { potions, weapons } from '../content/catalog';
import {
  classes,
  skills,
  skillIds,
  type SkillId,
  type StatChoice,
} from '../content/phase2';
import { addExperience, freeSkillPoints, starter } from '../core/progression';
import {
  copyTreeProgress,
  newTreeProgress,
  pruneTreeProgress,
  validateTreeProgress,
  type TreeProgress,
} from '../core/tree/allocation';
import { treeData } from '../content/tree';
import { contentHash } from '../content/schema';
export const SAVE_KEY = 'rpg.phase1.save';
/**
 * Identifies the skill and tree content a save was written against. When a
 * save's hash differs, content was edited since, so invalid ranks and tree
 * allocations are refunded and derived stats recomputed instead of rejected.
 */
export const CONTENT_HASH = contentHash(skills, treeData);
function pruneRanks(p: Player) {
  for (let changed = true; changed;) {
    changed = false;
    for (const [id, rank] of Object.entries(p.ranks))
      if (
        !Object.hasOwn(skills, id) ||
        (rank &&
          id !== starter(p) &&
          (p.level < skills[id as SkillId].level ||
            skills[id as SkillId].requires.some((r) => !p.ranks[r as SkillId])))
      ) {
        delete p.ranks[id as SkillId];
        changed = true;
      }
  }
}
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export type LoadResult =
  { ok: true; session: Session } | { ok: false; message: string };
const integer = (v: unknown, max: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max;
function validBottles(p: Player) {
  if (
    !Array.isArray(p.bottles) ||
    p.bottles.length > 5 ||
    !Array.isArray(p.potionSlots) ||
    p.potionSlots.length !== 2
  )
    throw new Error('Invalid bottles');
  const ids = new Set<string>();
  for (const b of p.bottles) {
    if (
      !b ||
      !Object.hasOwn(potions, b.type) ||
      b.id !== `b-${b.type}` ||
      !integer(b.charges, potions[b.type].charges) ||
      ids.has(b.id)
    )
      throw new Error('Invalid bottle');
    ids.add(b.id);
  }
  if (
    p.potionSlots.some((id) => id !== null && !ids.has(id)) ||
    (p.potionSlots[0] !== null && p.potionSlots[0] === p.potionSlots[1])
  )
    throw new Error('Invalid slots');
}
export function decodeSave(raw: string): Session {
  const data = JSON.parse(raw) as {
    version: number;
    content?: string;
    world?: WorldState;
    player: Player & {
      lifePotions?: number;
      manaPotions?: number;
      tree?: TreeProgress;
    };
  };
  if (!data || ![1, 2, 3, 4, 5].includes(data.version) || !data.player)
    throw new Error('Unsupported save');
  let p = data.player;
  const drifted =
    typeof data.content === 'string' && data.content !== CONTENT_HASH;
  for (const [key, max] of Object.entries({
    life: 10000,
    mana: 10000,
    gold: 1e9,
    xp: 1e9,
    wins: 1e9,
    strength: 1000,
    speed: 1000,
  })) {
    if (data.version === 1 && key === 'speed') continue;
    if (!integer(p[key as keyof Player], max))
      throw new Error('Invalid resources');
  }
  if (
    typeof p.energy !== 'number' ||
    !Number.isFinite(p.energy) ||
    p.energy < 0 ||
    p.energy > 10000
  )
    throw new Error('Invalid Energy');
  if (
    !Array.isArray(p.inventory) ||
    !p.inventory.includes('starter') ||
    p.inventory.some((id) => !Object.hasOwn(weapons, id)) ||
    new Set(p.inventory).size !== p.inventory.length ||
    !p.inventory.includes(p.weapon)
  )
    throw new Error('Invalid equipment');
  if (data.version < 3) {
    if (
      p.life > 80 ||
      p.mana > 24 ||
      p.energy > (data.version === 1 ? 100 : 50) ||
      p.strength !== 5
    )
      throw new Error('Invalid legacy resources');
    if (data.version === 1) {
      if (!integer(p.lifePotions, 1e6) || !integer(p.manaPotions, 1e6))
        throw new Error('Invalid legacy potion stock');
      p.bottles = [
        { id: 'b-small', type: 'small', charges: Math.min(4, p.lifePotions!) },
        { id: 'b-mana', type: 'mana', charges: Math.min(3, p.manaPotions!) },
      ];
      p.potionSlots = ['b-small', 'b-mana'];
      p.gold +=
        Math.max(0, p.lifePotions! - 4) + Math.max(0, p.manaPotions! - 3);
      p.energy /= 2;
    }
    validBottles(p);
    const base = newSession().player,
      life = p.life / 80,
      mana = p.mana / 24,
      energy = p.energy / 50;
    const oldXP = p.xp;
    p = {
      ...base,
      inventory: [...p.inventory],
      weapon: p.weapon,
      bottles: p.bottles.map((b) => ({ ...b })),
      potionSlots: [...p.potionSlots],
      gold: p.gold,
      wins: p.wins,
    };
    addExperience(p, oldXP);
    p.life = Math.floor(life * p.maxLife);
    p.mana = Math.floor(mana * p.maxMana);
    p.energy = energy * p.maxEnergy;
  } else {
    if (
      (p.classId !== null && !Object.hasOwn(classes, p.classId)) ||
      !integer(p.level, 99) ||
      p.level < 1 ||
      !Array.isArray(p.choices) ||
      p.choices.length > p.level - 1 ||
      p.choices.some(
        (v) => !['strength', 'speed', 'life', 'mana'].includes(v),
      ) ||
      typeof p.shieldEquipped !== 'boolean' ||
      !p.ranks ||
      typeof p.ranks !== 'object' ||
      Array.isArray(p.ranks)
    )
      throw new Error('Invalid progression');
    // Tree nodes spend Skill Points, so settle the tree before checking points.
    if (data.version < 5) p.tree = { ...newTreeProgress(), origin: p.classId };
    else {
      if (!p.tree || p.tree.origin !== p.classId)
        throw new Error('Invalid tree origin');
      if (drifted) p.tree = pruneTreeProgress(p.tree);
      validateTreeProgress(p.tree);
    }
    if (drifted) pruneRanks(p);
    for (const [id, rank] of Object.entries(p.ranks)) {
      if (!Object.hasOwn(skills, id) || !integer(rank, 10))
        throw new Error('Invalid ranks');
      if (
        rank > 0 &&
        id !== starter(p) &&
        (p.level < skills[id as SkillId].level ||
          skills[id as SkillId].requires.some((r) => !p.ranks[r as SkillId]))
      )
        throw new Error('Invalid prerequisites');
    }
    if (
      !p.ranks[starter(p)] ||
      freeSkillPoints(p) < 0 ||
      p.xp > (p.level === 99 ? 4950 : 50 * p.level - 1)
    )
      throw new Error('Invalid points');
    if (
      p.classId === null &&
      (p.choices.length ||
        Object.keys(p.ranks).some((k) => k !== 'shuriken') ||
        p.ranks.shuriken !== 1)
    )
      throw new Error('Invalid unselected class');
    const computed = { ...p };
    normalizePlayer(computed);
    for (const key of [
      'maxLife',
      'maxMana',
      'maxEnergy',
      'strength',
      'speed',
      'life',
      'mana',
      'energy',
    ] as const)
      if (computed[key] !== p[key]) {
        if (!drifted) throw new Error('Invalid derived stats');
        p[key] = computed[key];
      }
    if (p.shieldEquipped && p.strength < 15) {
      if (!drifted) throw new Error('Invalid shield');
      p.shieldEquipped = false;
    }
    validBottles(p);
  }
  if (weapons[p.weapon].strength > p.strength) {
    if (!drifted) throw new Error('Invalid weapon requirement');
    p.weapon = 'starter';
  }
  if (p.gold > 1e9) throw new Error('Gold overflow');
  const clean: Player = {
    life: p.life,
    mana: p.mana,
    energy: p.energy,
    gold: p.gold,
    xp: p.xp,
    wins: p.wins,
    strength: p.strength,
    speed: p.speed,
    maxLife: p.maxLife,
    maxMana: p.maxMana,
    maxEnergy: p.maxEnergy,
    classId: p.classId,
    level: p.level,
    choices: [...p.choices] as StatChoice[],
    ranks: Object.fromEntries(
      skillIds.filter((id) => p.ranks[id]).map((id) => [id, p.ranks[id]]),
    ),
    shieldEquipped: p.shieldEquipped,
    weapon: p.weapon,
    inventory: [...p.inventory],
    bottles: p.bottles.map((b) => ({
      id: b.id,
      type: b.type,
      charges: b.charges,
    })),
    potionSlots: [...p.potionSlots],
    tree: copyTreeProgress(p.tree),
  };
  const world = newWorld();
  if (data.version >= 4) {
    const w = data.world;
    if (
      !w ||
      !Object.hasOwn(rooms, w.room) ||
      typeof w.delivery !== 'boolean' ||
      typeof w.endingSeen !== 'boolean' ||
      !integer(w.deliveries, 1e9) ||
      !w.cleared
    )
      throw new Error('Invalid world');
    for (const id of ['human', 'monster', 'rift'] as const) {
      if (!integer(w.cleared[id], portals[id].count))
        throw new Error('Invalid portal progress');
      world.cleared[id] = w.cleared[id];
    }
    if (
      (w.endingSeen ||
        w.room === 'ending' ||
        w.room === 'rift' ||
        w.cleared.rift > 0) &&
      w.cleared.human !== 20
    )
      throw new Error('Invalid unlock');
    world.room = w.room;
    world.delivery = w.delivery;
    world.deliveries = w.deliveries;
    world.endingSeen = w.endingSeen;
  }
  return {
    ...newSession(),
    world,
    player: clean,
    log: [
      data.version < 3
        ? 'Save migrated to Phase 2. Choose your permanent class; resources and progression were preserved.'
        : 'Saved progress loaded.',
    ],
  };
}
export function load(storage: StoragePort): LoadResult {
  try {
    const raw = storage.getItem(SAVE_KEY);
    return raw
      ? { ok: true, session: decodeSave(raw) }
      : { ok: false, message: 'No saved progress yet.' };
  } catch {
    return {
      ok: false,
      message:
        'Save unavailable or invalid. Existing saved data was left untouched.',
    };
  }
}
export function save(storage: StoragePort, s: Session) {
  if (s.battle) return 'Return to the room before saving.';
  try {
    const old = storage.getItem(SAVE_KEY);
    if (old) decodeSave(old);
    const raw = JSON.stringify({
      version: 5,
      content: CONTENT_HASH,
      player: copyPlayer(s.player),
      world: s.world,
    });
    decodeSave(raw);
    storage.setItem(SAVE_KEY, raw);
    return 'Progress saved on this browser.';
  } catch {
    return 'Could not save. Existing data was left untouched.';
  }
}
