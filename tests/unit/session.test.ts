import { describe, it, expect } from 'vitest';
import {
  newSession,
  beginBattle,
  act,
  enemyAct,
  returnToRoom,
  retryPrepared,
  criticalChance,
  rest,
  move,
  buyPotion,
  slotPotion,
  refill,
  unavailable,
  copyPlayer,
  type Session,
} from '../../src/core/session';
import {
  selectClass,
  addExperience,
  chooseStat,
  learn,
  freeSkillPoints,
  respec,
  respecPreview,
  effectiveSpeed,
} from '../../src/core/progression';
import {
  classes,
  activeSkills,
  skills,
  encounters,
  skillIds,
  validateContent,
  type ClassId,
} from '../../src/content/phase2';
import { save, load, decodeSave, SAVE_KEY } from '../../src/platform/save';
import { potions } from '../../src/content/catalog';
import { roomBounds } from '../../src/content/world';
const noCrit = () => 0.99;
function ready(id: ClassId = 'warrior') {
  const s = newSession();
  selectClass(s.player, id);
  return s;
}
function playerTurn(s: Session) {
  for (
    let i = 0;
    i < 10 && s.battle && ['enemy', 'shadow'].includes(s.battle.turn);
    i++
  )
    enemyAct(s, noCrit);
}
function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => {
      data.set(k, v);
    },
  };
}
function skilled() {
  const s = ready('caster');
  addExperience(s.player, 1000000);
  s.player.ranks = Object.fromEntries(skillIds.map((id) => [id, 1]));
  rest(s);
  return s;
}
describe('content and progression', () => {
  it('validates current content references', () => {
    expect(() => validateContent()).not.toThrow();
  });
  it.each(Object.keys(classes) as ClassId[])(
    '%s starts correctly and cannot change class',
    (id) => {
      const s = ready(id),
        c = classes[id];
      expect(s.player.maxLife).toBe(c.life);
      expect(s.player.maxMana).toBe(c.mana);
      expect(s.player.energy).toBe(s.player.maxEnergy);
      const before = copyPlayer(s.player);
      expect(
        selectClass(s.player, id === 'balanced' ? 'warrior' : 'balanced'),
      ).toBe(false);
      expect(s.player).toEqual(before);
    },
  );
  it('processes accumulated EXP consistently and prevents overspending stat choices', () => {
    const s = ready(),
      incremental = ready();
    const startingLevel = s.player.level;
    const gained = addExperience(s.player, 500);
    for (let i = 0; i < 5; i++) addExperience(incremental.player, 100);
    expect(gained).toBeGreaterThan(1);
    expect(s.player.level).toBe(startingLevel + gained);
    expect(s.player).toEqual(incremental.player);
    const n = s.player.strength;
    expect(chooseStat(s.player, 'strength')).toBe(true);
    expect(s.player.strength).toBeGreaterThan(n);
    for (let i = 1; i < gained; i++)
      expect(chooseStat(s.player, 'mana')).toBe(true);
    const before = copyPlayer(s.player);
    expect(chooseStat(s.player, 'speed')).toBe(false);
    expect(s.player).toEqual(before);
  });
  it('spends one point per skill allocation and preserves rejected builds', () => {
    const s = ready();
    const before = copyPlayer(s.player);
    expect(learn(s.player, 'execution')).toBe(false);
    expect(s.player).toEqual(before);
    addExperience(s.player, 500);
    const points = freeSkillPoints(s.player);
    expect(learn(s.player, 'doubleStrike')).toBe(true);
    expect(freeSkillPoints(s.player)).toBe(points - 1);
  });
  it('respec preview is read-only and confirmation refunds only earned allocations', () => {
    const s = ready();
    addExperience(s.player, 500);
    const points = freeSkillPoints(s.player),
      initialRanks = { ...s.player.ranks };
    chooseStat(s.player, 'life');
    learn(s.player, 'doubleStrike');
    s.player.gold = respecPreview(s.player).price * 2;
    const before = JSON.stringify(s.player),
      v = respecPreview(s.player);
    expect(JSON.stringify(s.player)).toBe(before);
    const gold = s.player.gold;
    expect(respec(s.player)).toBe(true);
    expect(s.player.gold).toBe(gold - v.price);
    expect(s.player.choices).toEqual([]);
    expect(s.player.ranks).toEqual(initialRanks);
    expect(freeSkillPoints(s.player)).toBe(points);
    expect(s.player.classId).toBe('warrior');
    const after = copyPlayer(s.player);
    expect(respec(s.player)).toBe(false);
    expect(s.player).toEqual(after);
  });
});
describe('combat and Energy', () => {
  it('requires class, charges entry once, and movement is free at zero Energy', () => {
    const s = newSession();
    expect(beginBattle(s)).toBe(false);
    selectClass(s.player, 'warrior');
    expect(beginBattle(s)).toBe(true);
    expect(beginBattle(s)).toBe(false);
    expect(s.player.energy).toBe(40);
    returnToRoom(s);
    s.player.energy = 0;
    expect(beginBattle(s)).toBe(false);
    const before = { ...s.position };
    move(s, 1200, 590, 10);
    expect(s.position.x).toBeGreaterThan(before.x);
    expect(s.position.x).toBeLessThanOrEqual(1200);
    s.position = { x: roomBounds.right, y: roomBounds.bottom };
    move(s, 10000, 10000, 10);
    expect(s.position).toEqual({ x: roomBounds.right, y: roomBounds.bottom });
    expect(s.player.energy).toBe(0);
  });
  it('rejects invalid targets and stale commands without spending twice', () => {
    const s = ready();
    beginBattle(s);
    const mana = s.player.mana;
    expect(act(s, 'stab', 0, noCrit, 'missing')).toBe(false);
    expect(s.player.mana).toBe(mana);
    expect(act(s, 'stab', 0, noCrit, 'enemy0')).toBe(true);
    expect(act(s, 'stab', 0, noCrit, 'enemy0')).toBe(false);
    expect(s.player.mana).toBe(mana - skills.stab.cost);
  });
  it('uses Speed only to choose the opening side and gives enemies tie priority', () => {
    const s = ready();
    s.player.speed = encounters.practice.enemies[0].speed;
    beginBattle(s);
    expect(s.battle!.actor).toBe('enemy0');
    enemyAct(s, noCrit);
    expect(s.battle!.actor).toBe('player');
    expect(criticalChance(10000)).toBeGreaterThanOrEqual(0);
    expect(criticalChance(10000)).toBeLessThanOrEqual(1);
    expect(criticalChance(20)).toBeGreaterThan(criticalChance(10));
  });
  it('keeps the opening order fixed after Speed changes', () => {
    const s = ready();
    s.player.speed = 100;
    beginBattle(s, 'pair');
    expect(s.battle!.openingOrder).toEqual(['player', 'enemy0', 'enemy1']);
    s.player.speed = 0;
    act(s, 'attack', s.battle!.token, noCrit, 'enemy0');
    enemyAct(s, noCrit);
    enemyAct(s, noCrit);
    expect(s.battle!.actor).toBe('player');
    expect(s.battle!.openingOrder).toEqual(['player', 'enemy0', 'enemy1']);
  });
  it('Basic Attack restores 10 Qi and the opening order stays fixed', () => {
    const s = ready();
    s.player.speed = 100;
    s.player.mana = 0;
    beginBattle(s, 'pair');
    expect(s.battle!.openingOrder).toEqual(['player', 'enemy0', 'enemy1']);
    act(s, 'attack', s.battle!.token, noCrit);
    expect(s.player.mana).toBe(10);
    s.player.speed = 0;
    s.battle!.enemies.forEach((enemy) => (enemy.speed = 1000));
    enemyAct(s, noCrit);
    enemyAct(s, noCrit);
    expect(s.battle!.actor).toBe('player');
    expect(s.battle!.openingOrder).toEqual(['player', 'enemy0', 'enemy1']);
  });
  it('ordinary attacks hit even on a failed crit roll; successful crit does more damage', () => {
    const a = ready(),
      b = ready();
    beginBattle(a);
    beginBattle(b);
    const life = a.battle!.enemies[0].life;
    act(a, 'attack', 0, noCrit);
    act(b, 'attack', 0, () => 0);
    expect(a.battle!.enemies[0].life).toBeLessThan(life);
    expect(b.battle!.enemies[0].life).toBeLessThan(a.battle!.enemies[0].life);
  });
  it('multi-target hits affect both opponents; repeated hits cost once', () => {
    const s = ready('balanced');
    beginBattle(s, 'pair');
    playerTurn(s);
    const mana = s.player.mana;
    const before = s.battle!.enemies.map((e) => e.life + e.shield);
    act(s, 'shuriken', s.battle!.token, noCrit);
    expect(s.player.mana).toBe(mana - skills.shuriken.cost);
    s.battle!.enemies.forEach((e, i) =>
      expect(e.life + e.shield).toBeLessThan(before[i]),
    );
    const t = ready();
    addExperience(t.player, 50);
    learn(t.player, 'doubleStrike');
    beginBattle(t);
    const mp = t.player.mana;
    act(t, 'doubleStrike', t.battle!.token, noCrit);
    expect(t.player.mana).toBe(mp - skills.doubleStrike.cost);
    expect(t.log.filter((l) => l.includes('Life damage'))).toHaveLength(2);
  });
  it('shields absorb damage and shield-specific bonuses do not multiply Life damage', () => {
    const s = ready();
    addExperience(s.player, 300);
    learn(s.player, 'doubleStrike');
    learn(s.player, 'verticalStrike');
    beginBattle(s, 'pair');
    playerTurn(s);
    const e = s.battle!.enemies[0];
    e.shield = 200;
    const hp = e.life;
    act(s, 'verticalStrike', s.battle!.token, noCrit, 'enemy0');
    expect(e.shield).toBeLessThan(200);
    expect(e.life).toBe(hp);
  });
  it('passives improve effective Speed and magic damage', () => {
    const s = skilled();
    expect(effectiveSpeed(s.player)).toBeGreaterThan(s.player.speed);
    const a = ready('caster'),
      b = ready('caster');
    a.player.ranks.energyShot = 1;
    b.player.ranks.energyShot = 1;
    b.player.ranks.energyField = 2;
    beginBattle(a);
    beginBattle(b);
    act(a, 'energyShot', 0, noCrit);
    act(b, 'energyShot', 0, noCrit);
    expect(b.battle!.enemies[0].life).toBeLessThan(a.battle!.enemies[0].life);
  });
  it('summon joins next round, acts and can be damaged', () => {
    const s = skilled();
    beginBattle(s, 'mastery');
    playerTurn(s);
    expect(act(s, 'shadowReplicate', s.battle!.token, noCrit)).toBe(true);
    expect(s.battle!.shadow?.life).toBeGreaterThan(0);
    playerTurn(s);
    expect(s.battle!.queue).toContain('shadow');
    expect(unavailable(s, 'shadowReplicate')).toBe('Shadow already active');
    act(s, 'charge', s.battle!.token, noCrit);
    playerTurn(s);
    expect(s.log.some((l) => l === 'Shadow attacks.')).toBe(true);
  });
  it('Burn expires on target turns and Silence blocks spells but not Attack or potions', () => {
    const s = skilled();
    beginBattle(s, 'mastery');
    playerTurn(s);
    act(s, 'blastFire', s.battle!.token, noCrit);
    expect(
      s.battle!.enemies.some((e) => e.statuses.some((v) => v.kind === 'burn')),
    ).toBe(true);
    playerTurn(s);
    s.battle!.statuses = [{ kind: 'silence', turns: 2, power: 0 }];
    expect(unavailable(s, 'charge')).toBe('Silenced');
    expect(unavailable(s, 'attack')).toBeNull();
    act(s, 'attack', s.battle!.token, noCrit);
    playerTurn(s);
    expect(s.battle!.statuses[0].turns).toBe(1);
  });
  it('normal victory settles once and retry restores a deep post-fee snapshot', () => {
    const s = ready();
    s.player.life = 1;
    s.player.mana = 10;
    beginBattle(s);
    const before = copyPlayer(s.player);
    act(s, 'attack', 0, noCrit);
    enemyAct(s, noCrit);
    expect(s.battle!.turn).toBe('defeat');
    expect(retryPrepared(s)).toBe(true);
    expect(s.player).toEqual(before);
    expect(act(s, 'attack', 0, noCrit)).toBe(false);
    expect(retryPrepared(s)).toBe(false);
    const t = ready();
    beginBattle(t);
    playerTurn(t);
    Object.assign(t.battle!.enemies[0], { life: 1, shield: 0, defense: 0 });
    const gold = t.player.gold;
    expect(act(t, 'attack', t.battle!.token, noCrit)).toBe(true);
    expect(t.battle!.turn).toBe('victory');
    expect(t.player.gold).toBe(gold + encounters.practice.gold);
    expect(t.player.wins).toBe(1);
    const settled = copyPlayer(t.player);
    expect(act(t, 'attack', t.battle!.token, noCrit)).toBe(false);
    expect(t.player).toEqual(settled);
  });
  it('enemy heal and guard intents execute the committed action', () => {
    const s = skilled();
    beginBattle(s, 'adepts');
    const b = s.battle!,
      healer = b.enemies[1];
    b.actor = healer.id;
    b.turn = 'enemy';
    b.queue = [healer.id, 'player'];
    b.enemies[0].life = 50;
    b.intents[healer.id] = {
      name: 'Mend ally',
      kind: 'heal',
      target: 'enemy0',
      power: 30,
      cost: 10,
    };
    const mp = healer.mana;
    enemyAct(s, noCrit);
    expect(b.enemies[0].life).toBe(80);
    expect(healer.mana).toBe(mp - 10);
  });
});
describe('Training Ward', () => {
  it.each([
    ['basicWard', 2, 3],
    ['ward', 3, 5],
    ['advancedWard', 10, 20],
  ] as const)(
    '%s charges per hit and doubles EXP only after shield depletion',
    (id, cost, xp) => {
      const s = ready();
      s.player.speed = 100;
      beginBattle(s, id);
      expect(s.player.energy).toBe(50);
      act(s, 'attack', s.battle!.token, noCrit);
      expect(s.player.energy).toBe(50 - cost);
      expect(s.player.xp).toBe(xp);
      playerTurn(s);
      s.battle!.enemies[0].shield = 0;
      act(s, 'attack', s.battle!.token, noCrit);
      expect(s.player.xp + (s.player.level > 1 ? 50 : 0)).toBe(xp * 3);
      expect(s.player.gold).toBe(0);
    },
  );
  it('stops repeated hits at the Energy boundary and charges nothing for Charge', () => {
    const s = ready('caster');
    s.player.ranks.doubleStrike = 1;
    s.player.energy = 2;
    beginBattle(s, 'basicWard');
    playerTurn(s);
    act(s, 'doubleStrike', s.battle!.token, noCrit);
    expect(s.player.energy).toBe(0);
    expect(s.player.xp).toBe(3);
    expect(s.battle!.turn).toBe('finished');
    expect(retryPrepared(s)).toBe(false);
    const t = ready('caster');
    t.player.mana = 1;
    beginBattle(t, 'basicWard');
    playerTurn(t);
    const en = t.player.energy;
    act(t, 'charge', t.battle!.token, noCrit);
    expect(t.player.energy).toBe(en);
  });
  it('training defeat retains per-hit EXP and cannot use prepared retry', () => {
    const s = ready();
    s.player.life = 1;
    s.player.speed = 100;
    beginBattle(s, 'basicWard');
    act(s, 'attack', 0, noCrit);
    enemyAct(s, noCrit);
    expect(s.battle!.turn).toBe('defeat');
    expect(s.player.xp).toBe(3);
    expect(retryPrepared(s)).toBe(false);
    returnToRoom(s);
    rest(s);
    expect(s.player.xp).toBe(3);
  });
});
describe('potions and saves', () => {
  it('preserves charges through swaps and recovery; refills all owned bottles at the well', () => {
    const s = ready();
    s.player.gold = potions.hybrid.price;
    expect(buyPotion(s, 'hybrid')).toBe(true);
    expect(buyPotion(s, 'hybrid')).toBe(false);
    expect(slotPotion(s, 0, 'b-hybrid')).toBe(true);
    expect(slotPotion(s, 1, 'b-hybrid')).toBe(false);
    s.player.mana = 1;
    beginBattle(s);
    act(s, 'potion0', 0);
    returnToRoom(s);
    playerTurn(s);
    returnToRoom(s);
    rest(s);
    expect(s.player.bottles[2].charges).toBe(potions.hybrid.charges - 1);
    refill(s);
    expect(s.player.bottles[2].charges).toBe(potions.hybrid.charges);
  });
  it('round-trips a valid levelled build and refuses malformed ranks/slots', () => {
    const s = ready();
    addExperience(s.player, 500);
    chooseStat(s.player, 'mana');
    learn(s.player, 'doubleStrike');
    const st = memory();
    save(st, s);
    const r = load(st);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.session.player).toEqual(s.player);
    const bad = copyPlayer(s.player);
    bad.ranks.execution = 10;
    expect(() =>
      decodeSave(JSON.stringify({ version: 3, player: bad })),
    ).toThrow();
    bad.ranks = { stab: 1 };
    bad.potionSlots = ['b-small', 'b-small'];
    expect(() =>
      decodeSave(JSON.stringify({ version: 3, player: bad })),
    ).toThrow();
  });
  it('migrates legacy Energy/stock and preserves progress, then accepts a permanent class', () => {
    const st = {
      life: 40,
      mana: 12,
      energy: 80,
      gold: 50,
      xp: 100,
      wins: 2,
      strength: 5,
      weapon: 'starter',
      inventory: ['starter'],
      lifePotions: 8,
      manaPotions: 5,
    };
    const s = decodeSave(JSON.stringify({ version: 1, player: st }));
    expect(s.player.level).toBe(2);
    expect(s.player.xp).toBe(50);
    expect(s.player.energy).toBeCloseTo(42.4);
    expect(s.player.gold).toBe(56);
    expect(s.player.classId).toBeNull();
    selectClass(s.player, 'caster');
    const storage = memory();
    expect(save(storage, s)).toContain('Progress saved');
  });
  it('never overwrites invalid data or saves battle snapshots', () => {
    const st = memory();
    st.setItem(SAVE_KEY, 'bad');
    expect(load(st).ok).toBe(false);
    save(st, ready());
    expect(st.getItem(SAVE_KEY)).toBe('bad');
    const good = memory(),
      s = ready();
    save(good, s);
    const before = good.getItem(SAVE_KEY);
    beginBattle(s);
    save(good, s);
    expect(good.getItem(SAVE_KEY)).toBe(before);
  });
});
describe('active skill resource invariants', () => {
  it('all active skills resolve for a learned high-level build without negative resources', () => {
    for (const id of activeSkills) {
      const s = skilled();
      beginBattle(s, 'mastery');
      playerTurn(s);
      s.player.life -= 20;
      s.player.mana -= 10;
      expect(act(s, id, s.battle!.token, noCrit, 'enemy0'), id).toBe(true);
      expect(s.player.mana).toBeGreaterThanOrEqual(0);
      expect(s.player.life).toBeLessThanOrEqual(s.player.maxLife);
    }
  });
});
describe('training boundaries', () => {
  it('the breaking hit is not doubled and a training level-up restores Energy', () => {
    const s = ready();
    s.player.speed = 100;
    s.player.xp = 49;
    s.player.energy = 2;
    beginBattle(s, 'basicWard');
    s.battle!.enemies[0].shield = 1;
    act(s, 'attack', s.battle!.token, noCrit);
    expect(s.player.level).toBe(2);
    expect(s.player.xp).toBe(2);
    expect(s.player.energy).toBe(s.player.maxEnergy);
    expect(s.battle!.turn).not.toBe('finished');
  });
  it('a summoned shadow pays Training Energy per hit', () => {
    const s = skilled();
    beginBattle(s, 'advancedWard');
    const b = s.battle!;
    b.shadow = {
      id: 'shadow',
      name: 'Shadow',
      life: 20,
      maxLife: 20,
      mana: 0,
      speed: 20,
      damage: 10,
      defense: 0,
      magicDefense: 0,
      shield: 0,
      maxShield: 0,
      statuses: [],
      behavior: 'shadow',
    };
    b.actor = 'shadow';
    b.turn = 'shadow';
    b.queue = ['shadow', 'player'];
    const energy = s.player.energy;
    enemyAct(s, noCrit);
    expect(s.player.energy).toBe(energy - 10);
  });
});
