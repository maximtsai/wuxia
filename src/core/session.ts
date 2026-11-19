import { MONK_RESTORES, newWorld, roomBounds } from '../content/world';
import { campaignReason, completeStage, travelThroughDoorway } from './world';
import { frameSeconds } from './time';
import {
  weapons,
  potions,
  foods,
  type WeaponId,
  type PotionId,
  type FoodId,
} from '../content/catalog';
import {
  classes,
  skills,
  encounters,
  type SkillId,
  type Skill,
  type CombatAction,
} from '../content/phase2';
import {
  syncStats,
  effectiveSpeed,
  addExperience,
  effectiveSkill,
  skillRank,
} from './progression';
import { applyTreeStat, treeModifiers } from './tree/effects';
import type { Player, Session, Battle, Fighter, Status, Intent } from './types';
import {
  addShadowToOrder,
  createOpeningOrder,
  livingCycle,
} from './combat/turnOrder';
import { recordCombatEvent } from './combat/events';
import {
  BASIC_ATTACK_QI_GAIN,
  basicAttack,
  calculateActionPower,
} from './combat/actions';
import { copyTreeProgress, newTreeProgress } from './tree/allocation';
export type { Player, Session, Battle, Bottle } from './types';
export const copyPlayer = (p: Player): Player => ({
  ...p,
  choices: [...p.choices],
  ranks: { ...p.ranks },
  inventory: [...p.inventory],
  bottles: p.bottles.map((b) => ({ ...b })),
  potionSlots: [...p.potionSlots],
  tree: copyTreeProgress(p.tree),
});
export function newSession(): Session {
  const p: Player = {
    life: 75,
    mana: 75,
    energy: 50,
    maxLife: 75,
    maxMana: 75,
    maxEnergy: 50,
    classId: null,
    level: 1,
    choices: [],
    ranks: { shuriken: 1 },
    shieldEquipped: false,
    gold: 0,
    xp: 0,
    wins: 0,
    strength: 15,
    speed: 15,
    weapon: 'starter',
    inventory: ['starter'],
    bottles: [
      { id: 'b-small', type: 'small', charges: 4 },
      { id: 'b-mana', type: 'mana', charges: 3 },
    ],
    potionSlots: ['b-small', 'b-mana'],
    tree: newTreeProgress(),
  };
  return {
    world: newWorld(),
    player: p,
    battle: null,
    position: { x: 800, y: 590 },
    log: ['Choose a class. Walking is free; normal encounters cost 10 Energy.'],
  };
}
function log(s: Session, message: string) {
  s.log = [...s.log.slice(-39), message];
}
export function criticalChance(speed: number) {
  return Math.min(0.4, 0.05 + Math.max(0, speed) * 0.005);
}
const definition = (s: Session) => encounters[s.battle!.encounterId];
function fighter(s: Session, id: string) {
  return (
    s.battle!.enemies.find((e) => e.id === id) ??
    (s.battle!.shadow?.id === id ? s.battle!.shadow : undefined)
  );
}
/** Display name for log lines: "You" for the player, otherwise the fighter's name. */
function nameOf(s: Session, id: string) {
  return id === 'player' ? 'You' : (fighter(s, id)?.name ?? id);
}
function alive(s: Session, id: string) {
  return id === 'player' ? s.player.life > 0 : (fighter(s, id)?.life ?? 0) > 0;
}
function chooseIntent(s: Session, e: Fighter): Intent {
  const b = s.battle!,
    living = b.enemies.filter((v) => v.life > 0),
    hurt = [...living].sort(
      (a, c) => a.life / a.maxLife - c.life / c.maxLife,
    )[0];
  if (
    e.behavior === 'healer' &&
    e.mana >= 10 &&
    hurt.life < hurt.maxLife * 0.65
  )
    return {
      name: 'Mend ally',
      kind: 'heal',
      target: hurt.id,
      power: Math.round(e.maxLife * 0.2),
      cost: 10,
    };
  if (e.behavior === 'caster' && e.mana >= 8 && b.round % 2 === 0)
    return {
      name: b.round % 4 === 0 ? 'Silencing hex' : 'Burning bolt',
      kind: 'magic',
      target: 'player',
      power: e.damage,
      cost: 8,
      status: b.round % 4 === 0 ? 'silence' : 'burn',
    };
  if (e.behavior === 'striker' && b.round % 4 === 0)
    return {
      name: 'Brace shield',
      kind: 'guard',
      target: e.id,
      power: Math.max(12, Math.round(e.maxShield * 0.5)),
      cost: 0,
    };
  return {
    name: b.round % 3 === 0 ? 'Heavy strike' : 'Strike',
    kind: 'physical',
    target:
      b.shadow && b.shadow.life > 0 && b.round % 3 === 0 ? 'shadow' : 'player',
    power: Math.round(e.damage * (b.round % 3 === 0 ? 1.7 : 1)),
    cost: 0,
  };
}
function setIntents(s: Session) {
  for (const e of s.battle!.enemies.filter((e) => e.life > 0))
    s.battle!.intents[e.id] = chooseIntent(s, e);
}
function activate(s: Session) {
  const b = s.battle!;
  b.queue = b.queue.filter((id) => alive(s, id));
  if (!b.queue.length) {
    b.round++;
    b.queue = livingCycle(b.openingOrder, (id) => alive(s, id));
    setIntents(s);
  }
  b.actor = b.queue[0];
  b.turn =
    b.actor === 'player' ? 'player' : b.actor === 'shadow' ? 'shadow' : 'enemy';
  recordCombatEvent(b, {
    type: 'turn-started',
    actorId: b.actor,
    round: b.round,
  });
}
function newBattle(s: Session, id: string, token = 0) {
  const d = encounters[id];
  const b: Battle = {
    encounterId: id,
    enemies: d.enemies.map((e, i) => ({
      ...e,
      id: `enemy${i}`,
      maxLife: e.life,
      maxShield: e.shield,
      statuses: [],
    })),
    shadow: null,
    turn: 'player',
    openingOrder: [],
    queue: [],
    actor: 'player',
    round: 1,
    token,
    guard: 0,
    playerShield: s.player.shieldEquipped ? 20 + s.player.level * 3 : 0,
    statuses: [],
    intents: {},
    prepared: copyPlayer(s.player),
    selectedTarget: 'enemy0',
    eventSequence: 0,
    events: [],
    usesSpent: {},
    earned: { gold: 0, xp: 0, levels: 0, cleared: false },
  };
  s.battle = b;
  b.openingOrder = createOpeningOrder(effectiveSpeed(s.player), b.enemies);
  b.queue = livingCycle(b.openingOrder, (actorId) => alive(s, actorId));
  recordCombatEvent(b, {
    type: 'battle-started',
    encounterId: id,
    openingOrder: [...b.openingOrder],
  });
  setIntents(s);
  activate(s);
}
export function entryReason(s: Session, id = 'practice') {
  const d = encounters[id];
  const gate = campaignReason(s, id);
  if (gate) return gate;
  return !d
    ? 'Unknown encounter'
    : s.battle
      ? 'Already in combat'
      : !s.player.classId
        ? 'Choose a class first'
        : s.player.life <= 0
          ? 'Recover Life first'
          : s.player.energy < (d.training?.cost ?? 10)
            ? `Need ${d.training?.cost ?? 10} Energy — visit recovery`
            : null;
}
export function beginBattle(s: Session, id = 'practice') {
  if (entryReason(s, id)) return false;
  if (!encounters[id].training) s.player.energy -= 10;
  newBattle(s, id);
  s.log = [
    encounters[id].training
      ? 'Training: each hit costs Energy and earns EXP.'
      : 'Encounter entry: 10 Energy.',
    s.battle!.actor === 'player'
      ? 'You act first.'
      : `${s.battle!.enemies.find((e) => e.id === s.battle!.actor)?.name ?? 'The enemy'} acts first.`,
  ];
  return true;
}
export function retryPrepared(s: Session) {
  const b = s.battle;
  if (b?.turn !== 'defeat' || encounters[b.encounterId].training) return false;
  const { encounterId, token } = b;
  s.player = copyPlayer(b.prepared);
  newBattle(s, encounterId, token + 1);
  s.log = ['Trying again, as you were when you entered. No extra Energy.'];
  return true;
}
export function slottedBottle(p: Player, slot: number) {
  return p.bottles.find((b) => b.id === p.potionSlots[slot]);
}
export function potionDescription(type: PotionId) {
  const d = potions[type];
  return [
    d.life ? `${d.life} Life` : '',
    d.mana ? `${d.mana} Qi` : '',
    d.guard ? 'Guard: next 2 enemy hits reduced by 50%' : '',
  ]
    .filter(Boolean)
    .join(' + ');
}
export interface ActionInfo {
  name: string;
  detail: string;
  cost: number;
  target: Skill['target'];
  /** Present for limited-use techniques; `left` counts the current encounter. */
  uses?: { left: number; max: number };
  /** Rank and learning requirements, for the ranks screen (not shown in combat). */
  requirements?: string;
}
export function actionInfo(s: Session, id: CombatAction): ActionInfo {
  if (id === 'potion0' || id === 'potion1') {
    const i = id === 'potion0' ? 0 : 1,
      b = slottedBottle(s.player, i);
    return {
      name: `Slot ${i + 1}: ${b ? potions[b.type].name : 'Empty'}`,
      detail: b
        ? `${potionDescription(b.type)} · ${b.charges}/${potions[b.type].charges} charges`
        : 'Choose at the potion seller',
      cost: 0,
      target: 'self' as const,
    };
  }
  if (id === 'attack')
    return {
      name: 'Attack',
      detail: `Free physical attack. One enemy; restores ${BASIC_ATTACK_QI_GAIN} Qi after resolving. Power ${Math.floor(calculateActionPower(s.player, basicAttack, 'attack', 1, s.player.mana))} before defense and critical.`,
      cost: 0,
      target: 'single' as const,
    };
  const d: Skill = effectiveSkill(s.player, id),
    rank = skillRank(s.player, id);
  const target = s.battle?.enemies.find(
    (e) => e.id === s.battle?.selectedTarget && e.life > 0,
  );
  const power = calculateActionPower(
    s.player,
    d,
    id,
    rank,
    s.player.mana,
    target,
  );
  return {
    name: d.name,
    detail:
      `${d.description}${d.percent !== undefined ? ` Deals ${d.percent}% of ${d.effect === 'avenger' ? 'your missing Life' : "the target's current Life"}.` : ''}${d.noCrit ? ' Cannot critically strike.' : ''}${d.hits ? ` Power ${Math.floor(power)} per hit before defense and critical.` : ''}${d.effect === 'heal' ? ` Restores ${healAmount(s.player, rank)} Life.` : ''}`.trim(),
    requirements: `Rank ${rank}/10. Requires level ${d.level}${d.requires.length ? ', ' + d.requires.map((v) => skills[v as SkillId].name).join(', ') : ''}.`,
    cost: d.cost,
    target: d.target,
    uses:
      d.uses === undefined
        ? undefined
        : {
            left: Math.max(0, d.uses - (s.battle?.usesSpent[id] ?? 0)),
            max: d.uses,
          },
  };
}
export function unavailable(
  s: Session,
  id: CombatAction,
  target?: string | null,
): string | null {
  const b = s.battle,
    p = s.player;
  if (!b || b.turn !== 'player') return 'Wait for your turn';
  if (id === 'potion0' || id === 'potion1') {
    const bottle = slottedBottle(p, id === 'potion0' ? 0 : 1);
    if (!bottle) return 'Buy at the potion seller';
    // Drinkable at full Life and Qi: potions may carry other effects.
    return bottle.charges ? null : 'Refill at the well';
  }
  if (id !== 'attack') {
    if (!Object.hasOwn(skills, id)) return 'Unknown skill';
    const d: Skill = effectiveSkill(p, id);
    if (d.kind === 'passive') return 'Passive skill';
    if (!skillRank(p, id)) return 'Not learned';
    if (d.uses !== undefined && (b.usesSpent[id] ?? 0) >= d.uses)
      return 'No uses left';
    if (d.effect === 'avenger' && p.life === p.maxLife)
      return 'No missing Life';
    if (p.mana < d.cost) return 'Not enough Qi';
    if (
      b.statuses.some((v) => v.kind === 'silence') &&
      (d.kind === 'magic' || d.kind === 'support')
    )
      return 'Silenced';
    if (d.effect === 'charge' && p.mana === p.maxMana) return 'Qi is full';
    if (d.effect === 'heal' && p.life === p.maxLife) return 'Life is full';
    if (d.effect === 'summon' && b.shadow && b.shadow.life > 0)
      return 'Shadow already active';
  }
  const single = id === 'attack' || skills[id].target === 'single';
  if (
    single &&
    target !== undefined &&
    !b.enemies.some((e) => e.id === target && e.life > 0)
  )
    return 'Choose a living enemy';
  if (
    definition(s).training &&
    (id === 'attack' ||
      skills[id].kind === 'physical' ||
      skills[id].kind === 'magic') &&
    p.energy < definition(s).training!.cost
  )
    return 'Not enough Training Energy';
  return null;
}
function recover(s: Session, life: number, mana: number) {
  const l = Math.min(life, s.player.maxLife - s.player.life),
    m = Math.min(mana, s.player.maxMana - s.player.mana);
  s.player.life += l;
  s.player.mana += m;
  if (l)
    recordCombatEvent(s.battle!, {
      type: 'resource-changed',
      actorId: 'player',
      resource: 'life',
      amount: l,
      source: 'recovery',
    });
  if (m)
    recordCombatEvent(s.battle!, {
      type: 'resource-changed',
      actorId: 'player',
      resource: 'qi',
      amount: m,
      source: 'recovery',
    });
  log(s, `Restored ${l} Life and ${m} Qi.`);
}
function gainQi(s: Session, amount: number, source: string) {
  const gained = Math.min(amount, s.player.maxMana - s.player.mana);
  s.player.mana += gained;
  recordCombatEvent(s.battle!, {
    type: 'resource-changed',
    actorId: 'player',
    resource: 'qi',
    amount: gained,
    source,
  });
  log(s, `${source}: restored ${gained} Qi.`);
}
/** Life restored by Heal at `rank`, capped at full Life. */
export function healAmount(p: Player, rank: number) {
  return Math.floor(p.maxLife * Math.min(1, 0.13 + 0.12 * rank));
}
function experience(s: Session, amount: number) {
  const levels = addExperience(s.player, amount);
  if (s.battle) {
    s.battle.earned.xp += amount;
    s.battle.earned.levels += levels;
  }
  log(
    s,
    `+${amount} EXP${levels ? `; reached level ${s.player.level}. Resources restored; spend points in Character and the Skill Tree.` : '.'}`,
  );
}
function status(s: Session, id: string, kind: Status['kind'], power: number) {
  const list = id === 'player' ? s.battle!.statuses : fighter(s, id)!.statuses;
  const old = list.find((v) => v.kind === kind);
  if (old) {
    old.turns = 2;
    old.power = power;
  } else list.push({ kind, turns: 2, power });
  recordCombatEvent(s.battle!, {
    type: 'status-applied',
    targetId: id,
    status: kind,
    turns: 2,
  });
  log(s, `${nameOf(s, id)}: ${kind} for 2 turns.`);
}
function hit(
  s: Session,
  id: string,
  raw: number,
  kind: 'physical' | 'magic',
  shieldBonus = 0,
) {
  const b = s.battle!,
    p = s.player,
    e = fighter(s, id),
    c = classes[p.classId ?? 'balanced'];
  const def =
    id === 'player'
      ? applyTreeStat(
          treeModifiers(p.tree),
          kind === 'physical' ? 'defense' : 'qiDefense',
          kind === 'physical' ? c.defense : c.magicDefense,
        )
      : kind === 'physical'
        ? e!.defense
        : e!.magicDefense;
  let amount = Math.max(1, Math.floor(raw) - def);
  const initial = amount;
  let shieldAbsorbed = 0;
  let shield = id === 'player' ? b.playerShield : e!.shield;
  if (shield > 0) {
    const shieldDamage = Math.max(1, amount - 2),
      absorbed = Math.min(shield, shieldDamage);
    shieldAbsorbed = absorbed;
    shield = Math.max(0, shield - absorbed - shieldBonus);
    amount = Math.max(0, shieldDamage - absorbed);
    log(
      s,
      `${id} shield absorbs ${absorbed}${shieldBonus ? ` plus ${shieldBonus} shield-only damage` : ''}.`,
    );
    if (id === 'player') b.playerShield = shield;
    else e!.shield = shield;
  }
  if (id === 'player' && b.guard > 0) {
    const before = amount;
    amount = Math.ceil(amount / 2);
    b.guard--;
    log(s, `Guard blocks ${before - amount}; ${b.guard} hits remain.`);
  }
  if (id === 'player') p.life = Math.max(0, p.life - amount);
  else e!.life = Math.max(0, e!.life - amount);
  recordCombatEvent(b, {
    type: 'damage',
    targetId: id,
    amount,
    channel: kind === 'magic' ? 'qi' : 'physical',
    shieldAbsorbed,
  });
  const blocked = Math.max(0, Math.floor(raw) - initial);
  log(
    s,
    `${nameOf(s, id)} ${id === 'player' ? 'take' : 'takes'} ${amount} damage${blocked ? ` (${blocked} blocked)` : ''}.`,
  );
  return initial > 0;
}
function settlement(s: Session) {
  const b = s.battle!;
  if (!s.player.life) {
    b.turn = 'defeat';
    recordCombatEvent(b, { type: 'battle-ended', outcome: 'defeat' });
    log(
      s,
      definition(s).training
        ? 'Training defeat. Earned EXP is retained.'
        : 'Defeat. Retry prepared or return to the temple.',
    );
    return true;
  }
  if (b.enemies.every((e) => !e.life)) {
    b.turn = 'victory';
    recordCombatEvent(b, { type: 'battle-ended', outcome: 'victory' });
    if (!definition(s).training) {
      const d = definition(s);
      s.player.gold += d.gold;
      b.earned.gold += d.gold;
      s.player.wins++;
      if (completeStage(s, b.encounterId)) {
        b.earned.cleared = true;
        log(s, 'New campaign stage cleared. Next stage unlocked.');
      }
      experience(s, d.xp);
      if (!s.player.inventory.includes('earned'))
        s.player.inventory.push('earned');
      log(s, `Victory! +${d.gold} gold.`);
    } else log(s, 'Training complete.');
    return true;
  }
  return false;
}
function finishTurn(s: Session) {
  const b = s.battle!,
    id = b.actor,
    list = id === 'player' ? b.statuses : (fighter(s, id)?.statuses ?? []);
  for (const effect of [...list]) {
    if (effect.kind === 'burn' && alive(s, id))
      hit(s, id, effect.power, 'magic');
    effect.turns--;
    if (!effect.turns) log(s, `${nameOf(s, id)}: ${effect.kind} wore off.`);
  }
  if (id === 'player') b.statuses = list.filter((v) => v.turns > 0);
  else if (fighter(s, id))
    fighter(s, id)!.statuses = list.filter((v) => v.turns > 0);
  b.token++;
  if (settlement(s)) return;
  if (definition(s).training && s.player.energy <= 0) {
    b.turn = 'finished';
    recordCombatEvent(b, { type: 'battle-ended', outcome: 'finished' });
    log(s, 'Training ended: no Energy left.');
    return;
  }
  b.queue.shift();
  activate(s);
}
export function act(
  s: Session,
  id: CombatAction,
  token: number,
  random: () => number = Math.random,
  target?: string | null,
) {
  const b = s.battle;
  if (!b || b.token !== token || unavailable(s, id, target ?? b.selectedTarget))
    return false;
  const p = s.player;
  const targetIds =
    id === 'potion0' || id === 'potion1'
      ? ['player']
      : id === 'attack' || skills[id].target === 'single'
        ? [target ?? b.selectedTarget!]
        : skills[id].target === 'self'
          ? ['player']
          : b.enemies
              .filter((enemy) => enemy.life > 0)
              .map((enemy) => enemy.id);
  recordCombatEvent(b, {
    type: 'action-used',
    actorId: 'player',
    actionId: id,
    targetIds,
  });
  if (id === 'potion0' || id === 'potion1') {
    const bottle = slottedBottle(p, id === 'potion0' ? 0 : 1)!,
      d = potions[bottle.type];
    bottle.charges--;
    log(s, `${d.name}: spent 1 charge, 1 turn.`);
    recover(s, d.life, d.mana);
    if (d.guard) b.guard = 2;
  } else {
    const d: Skill = id === 'attack' ? basicAttack : effectiveSkill(p, id);
    const rank = id === 'attack' ? 1 : skillRank(p, id),
      mana = p.mana;
    p.mana -= d.cost;
    if (d.effect === 'manaBomb') p.mana = 0;
    if (d.uses !== undefined) {
      const spent = (b.usesSpent[id as SkillId] ?? 0) + 1;
      b.usesSpent[id as SkillId] = spent;
      log(
        s,
        `${d.name}: ${d.uses - spent}/${d.uses} uses left this encounter.`,
      );
    }
    log(s, `${d.name}: ${d.effect === 'manaBomb' ? mana : d.cost} Qi spent.`);
    if (d.effect === 'heal') recover(s, healAmount(p, rank), 0);
    else if (d.effect === 'charge') recover(s, 0, 25 * rank);
    else if (d.effect === 'summon') {
      b.shadow = {
        id: 'shadow',
        name: 'Shadow',
        life: Math.floor(p.maxLife * 0.5),
        maxLife: Math.floor(p.maxLife * 0.5),
        mana: 0,
        speed: effectiveSpeed(p),
        damage: Math.floor(p.strength * 0.5) + rank * 3,
        defense: 2,
        magicDefense: 2,
        shield: 0,
        maxShield: 0,
        statuses: [],
        behavior: 'shadow',
      };
      b.openingOrder = addShadowToOrder(b.openingOrder);
      log(s, 'Your shadow will join next round.');
    } else {
      const targets =
        d.target === 'all'
          ? b.enemies.filter((e) => e.life > 0)
          : b.enemies.filter((e) => e.id === (target ?? b.selectedTarget));
      let stop = false;
      for (let n = 0; n < d.hits && !stop; n++)
        for (const e of targets) {
          if (e.life <= 0) continue;
          const training = definition(s).training;
          if (training && p.energy < training.cost) {
            stop = true;
            log(s, 'Training hit skipped: insufficient Energy.');
            break;
          }
          const unshielded = e.shield === 0;
          const power = calculateActionPower(p, d, id, rank, mana, e);
          const weak = b.statuses.some((v) => v.kind === 'weaken') ? 0.75 : 1,
            crit = !d.noCrit && random() < criticalChance(effectiveSpeed(p));
          if (crit) log(s, 'Critical strike!');
          if (training) p.energy -= training.cost;
          hit(
            s,
            e.id,
            power * weak * (crit ? 1.5 : 1),
            d.kind === 'magic' ? 'magic' : 'physical',
            d.effect === 'shield' ? rank * 12 : 0,
          );
          if (training) {
            log(s, `Training: ${training.cost} Energy spent.`);
            experience(s, training.xp * (unshielded ? 2 : 1));
          }
          if (e.life > 0 && !training && d.effect === 'burn')
            status(s, e.id, 'burn', 3 + rank);
          if (e.life > 0 && d.effect === 'weaken') status(s, e.id, 'weaken', 0);
          if (training && p.energy <= 0) {
            stop = true;
            break;
          }
        }
      if (id === 'attack') gainQi(s, BASIC_ATTACK_QI_GAIN, basicAttack.name);
    }
  }
  finishTurn(s);
  return true;
}
export function enemyAct(s: Session, random: () => number = Math.random) {
  const b = s.battle;
  if (!b || !['enemy', 'shadow'].includes(b.turn)) return false;
  const e = fighter(s, b.actor)!;
  if (b.turn === 'shadow') {
    const target = b.enemies.find((v) => v.life > 0)!;
    recordCombatEvent(b, {
      type: 'action-used',
      actorId: 'shadow',
      actionId: 'attack',
      targetIds: [target.id],
    });
    const training = definition(s).training;
    if (training && s.player.energy < training.cost) {
      b.turn = 'finished';
      b.token++;
      recordCombatEvent(b, { type: 'battle-ended', outcome: 'finished' });
      log(s, 'Training ended: not enough Energy for the shadow hit.');
      return true;
    }
    const unshielded = target.shield === 0;
    if (training) s.player.energy -= training.cost;
    hit(
      s,
      target.id,
      e.damage * (random() < criticalChance(e.speed) ? 1.5 : 1),
      'physical',
    );
    log(s, 'Shadow attacks.');
    if (training) experience(s, training.xp * (unshielded ? 2 : 1));
  } else {
    let intent = b.intents[e.id];
    if (
      !alive(s, intent.target) ||
      (intent.kind === 'heal' &&
        fighter(s, intent.target)!.life === fighter(s, intent.target)!.maxLife)
    ) {
      intent = {
        name: 'Retargeted strike',
        kind: 'physical',
        target: 'player',
        power: e.damage,
        cost: 0,
      };
      b.intents[e.id] = intent;
      log(
        s,
        `${e.name}: intent changed because the original target is unavailable.`,
      );
      return true;
    }
    recordCombatEvent(b, {
      type: 'action-used',
      actorId: e.id,
      actionId: intent.name,
      targetIds: [intent.target],
    });
    e.mana -= intent.cost;
    log(
      s,
      `${e.name}: ${intent.name} → ${intent.target}${intent.cost ? ` (${intent.cost} Qi)` : ''}.`,
    );
    if (intent.kind === 'heal') {
      const target = fighter(s, intent.target)!;
      const gain = Math.min(intent.power, target.maxLife - target.life);
      target.life += gain;
      log(s, `Healed ${gain} Life.`);
    } else if (intent.kind === 'guard') {
      e.shield = Math.min(Math.max(e.maxShield, 20), e.shield + intent.power);
      log(s, 'Shield reinforced.');
    } else {
      const crit = random() < criticalChance(e.speed);
      if (crit) log(s, 'Enemy critical strike!');
      hit(
        s,
        intent.target,
        intent.power *
          (crit ? 1.5 : 1) *
          (e.statuses.some((v) => v.kind === 'weaken') ? 0.75 : 1),
        intent.kind,
      );
      if (intent.status && alive(s, intent.target))
        status(
          s,
          intent.target,
          intent.status,
          intent.status === 'burn' ? 4 : 0,
        );
    }
  }
  finishTurn(s);
  return true;
}
export function returnToRoom(s: Session) {
  if (!s.battle || ['enemy', 'shadow'].includes(s.battle.turn)) return false;
  s.battle = null;
  return true;
}
export function rest(s: Session) {
  if (s.battle) return false;
  s.player.life = s.player.maxLife;
  s.player.mana = s.player.maxMana;
  s.player.energy = s.player.maxEnergy;
  log(s, 'Life, Qi and Energy restored. Refill bottles at the well.');
  return true;
}
export function equip(s: Session, id: WeaponId) {
  if (
    s.battle ||
    !Object.hasOwn(weapons, id) ||
    !s.player.inventory.includes(id) ||
    s.player.strength < weapons[id].strength
  )
    return false;
  s.player.weapon = id;
  return true;
}
/** Why a dish cannot be bought and eaten right now, or null when it can. */
export function eatReason(s: Session, id: FoodId) {
  const p = s.player,
    f = foods[id];
  if (s.battle) return 'Return to the room first';
  if (p.gold < f.price) return `Needs ${f.price} gold`;
  if (p.life === p.maxLife && p.mana === p.maxMana && p.energy === p.maxEnergy)
    return 'Already fully restored';
  return null;
}
export function eat(s: Session, id: FoodId) {
  if (!Object.hasOwn(foods, id) || eatReason(s, id)) return false;
  const p = s.player,
    f = foods[id];
  p.gold -= f.price;
  p.energy = Math.min(p.maxEnergy, p.energy + f.energy);
  p.life = Math.min(p.maxLife, p.life + f.life);
  p.mana = Math.min(p.maxMana, p.mana + f.mana);
  log(s, `Ate ${f.name}.`);
  return true;
}
/** Spends one of the monk's lifetime full restores; refuses when nothing is missing. */
export function meditateReason(s: Session) {
  const p = s.player;
  if (s.battle) return 'Return to the room first';
  if (s.world.restoresUsed >= MONK_RESTORES) return 'No restores left';
  if (p.life === p.maxLife && p.mana === p.maxMana && p.energy === p.maxEnergy)
    return 'Already fully restored';
  return null;
}
export function meditate(s: Session) {
  if (meditateReason(s)) return false;
  s.player.life = s.player.maxLife;
  s.player.mana = s.player.maxMana;
  s.player.energy = s.player.maxEnergy;
  s.world.restoresUsed++;
  log(
    s,
    `Life, Qi and Energy fully restored. ${MONK_RESTORES - s.world.restoresUsed} restores remain.`,
  );
  return true;
}
export function refill(s: Session) {
  if (s.battle) return false;
  s.player.bottles.forEach((b) => (b.charges = potions[b.type].charges));
  return true;
}
export function buyPotion(s: Session, type: PotionId) {
  if (
    s.battle ||
    !Object.hasOwn(potions, type) ||
    s.player.bottles.some((b) => b.type === type) ||
    s.player.gold < potions[type].price
  )
    return false;
  s.player.gold -= potions[type].price;
  s.player.bottles.push({
    id: `b-${type}`,
    type,
    charges: potions[type].charges,
  });
  return true;
}
export function slotPotion(s: Session, slot: number, id: string | null) {
  if (
    s.battle ||
    (slot !== 0 && slot !== 1) ||
    (id !== null &&
      (!s.player.bottles.some((b) => b.id === id) ||
        s.player.potionSlots[1 - slot] === id))
  )
    return false;
  s.player.potionSlots[slot] = id;
  return true;
}
/** Walking pace in units per second, and the longest slice resolved at once. */
const WALK_SPEED = 270,
  MAX_SLICE = 0.05;
export function move(s: Session, x: number, y: number, seconds: number) {
  if (s.battle) return;
  // A slow frame still covers its full distance, but in slices short enough
  // that the walk cannot step straight over a doorway. Frames longer than
  // `MAX_FRAME_SECONDS` slow the walk down rather than teleporting the player.
  let remaining = frameSeconds(seconds * 1000);
  const room = s.world.room;
  while (remaining > 0) {
    const slice = Math.min(remaining, MAX_SLICE);
    remaining -= slice;
    const dx = x - s.position.x,
      dy = y - s.position.y,
      d = Math.hypot(dx, dy);
    if (!d) return;
    const step = Math.min(d, WALK_SPEED * slice);
    s.position = {
      x: Math.min(
        roomBounds.right,
        Math.max(roomBounds.left, s.position.x + (dx / d) * step),
      ),
      y: Math.min(
        roomBounds.bottom,
        Math.max(
          s.world.room === 'potions' ? 490 : roomBounds.top,
          s.position.y + (dy / d) * step,
        ),
      ),
    };
    travelThroughDoorway(s);
    // Arriving in the next room ends this frame's walk at its entrance.
    if (s.world.room !== room) return;
  }
}
export function normalizePlayer(p: Player) {
  syncStats(p);
  p.life = Math.min(p.life, p.maxLife);
  p.mana = Math.min(p.mana, p.maxMana);
  p.energy = Math.min(p.energy, p.maxEnergy);
}
