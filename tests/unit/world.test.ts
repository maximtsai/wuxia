import { describe, it, expect } from 'vitest';
import {
  rooms,
  doorways,
  type ExitDirection,
  campaign,
  newWorld,
  validateWorld,
  type RoomId,
} from '../../src/content/world';
import {
  travel,
  travelThroughDoorway,
  delivery,
  buyWeapon,
} from '../../src/core/world';
import {
  newSession,
  beginBattle,
  act,
  enemyAct,
  returnToRoom,
  equip,
  retryPrepared,
  move,
} from '../../src/core/session';
import { selectClass } from '../../src/core/progression';
import { weapons } from '../../src/content/catalog';
import { decodeSave, save, SAVE_KEY } from '../../src/platform/save';
const ready = () => {
  const s = newSession();
  selectClass(s.player, 'warrior');
  return s;
};
describe('temple and campaign', () => {
  it('walking through each connected doorway arrives at its reciprocal entrance without bouncing back', () => {
    for (const [from, room] of Object.entries(rooms)) {
      for (const [direction, to] of Object.entries(room.exits)) {
        const s = ready();
        s.world.room = from as RoomId;
        s.world.cleared.human = 20;
        s.player.energy = 0;
        const exit = doorways[direction as ExitDirection];
        s.position = { ...exit.arrival };
        for (let i = 0; i < 100 && s.world.room === from; i++)
          move(s, exit.x, exit.y, 0.05);
        expect(s.world.room).toBe(to);
        const reverse = Object.entries(rooms[to as RoomId].exits).find(
          ([, id]) => id === from,
        )!;
        expect(s.position).toEqual(
          doorways[reverse[0] as ExitDirection].arrival,
        );
        expect(s.player.energy).toBe(0);
        expect(travelThroughDoorway(s)).toBe(false);
        expect(s.world.room).toBe(to);
      }
    }
  });
  it('walking cannot cross locked or absent exits, or travel during combat', () => {
    const s = ready();
    for (const direction of ['down', 'left'] as const) {
      s.position = { ...doorways[direction].arrival };
      for (let i = 0; i < 100; i++)
        move(s, doorways[direction].x, doorways[direction].y, 0.05);
      expect(s.world.room).toBe('entry');
    }
    s.position = { x: doorways.up.x, y: doorways.up.y };
    beginBattle(s);
    expect(travelThroughDoorway(s)).toBe(false);
    move(s, doorways.up.x, doorways.up.y - 10, 0.05);
    expect(s.world.room).toBe('entry');
  });
  it('exit buttons use the same reciprocal arrival position', () => {
    const s = ready();
    expect(travel(s, 'potions')).toBe(true);
    expect(s.position).toEqual(doorways.down.arrival);
    expect(travel(s, 'human')).toBe(true);
    expect(s.position).toEqual(doorways.right.arrival);
  });
  it('matches map connections, is reciprocal, and reaches every room', () => {
    validateWorld();
    expect(rooms.potions.exits).toEqual({
      down: 'entry',
      left: 'human',
      right: 'merchant',
    });
    expect(rooms.statue.exits).toEqual({
      down: 'advanced',
      left: 'riftEntry',
      right: 'monster',
    });
    const seen = new Set<string>();
    const walk = (id: RoomId) => {
      if (seen.has(id)) return;
      seen.add(id);
      Object.values(rooms[id].exits).forEach((v) => walk(v as RoomId));
    };
    walk('entry');
    expect(seen.size).toBe(13);
    expect(Object.keys(campaign)).toHaveLength(35);
  });
  it('blocks disconnected/locked exits and allows free zero-Energy travel', () => {
    const s = ready();
    s.player.energy = 0;
    expect(travel(s, 'ending')).toBe(false);
    expect(travel(s, 'library')).toBe(false);
    expect(travel(s, 'potions')).toBe(true);
    expect(s.player.energy).toBe(0);
    s.world.room = 'riftEntry';
    expect(travel(s, 'rift')).toBe(false);
    s.world.cleared.human = 20;
    expect(travel(s, 'rift')).toBe(true);
    s.world.room = 'entry';
    expect(travel(s, 'ending')).toBe(true);
    expect(s.world.endingSeen).toBe(true);
  });
  it('gates portal order and settles clearance once without advancing on replay', () => {
    const s = ready();
    expect(beginBattle(s, 'human-1')).toBe(false);
    s.world.room = 'human';
    expect(beginBattle(s, 'human-2')).toBe(false);
    expect(s.player.energy).toBe(50);
    expect(beginBattle(s, 'human-1')).toBe(true);
    s.battle!.enemies[0].life = 1;
    act(s, 'attack', s.battle!.token, () => 0.99);
    expect(s.world.cleared.human).toBe(1);
    const gold = s.player.gold;
    expect(act(s, 'attack', s.battle!.token)).toBe(false);
    expect(s.player.gold).toBe(gold);
    returnToRoom(s);
    beginBattle(s, 'human-1');
    s.battle!.enemies[0].life = 1;
    act(s, 'attack', s.battle!.token, () => 0.99);
    expect(s.world.cleared.human).toBe(1);
  });
  it('defeat and prepared retry cannot grant clearance', () => {
    const s = ready();
    s.world.room = 'human';
    s.player.life = 1;
    beginBattle(s, 'human-1');
    act(s, 'attack', s.battle!.token, () => 0.99);
    enemyAct(s, () => 0.99);
    expect(s.battle!.turn).toBe('defeat');
    expect(s.world.cleared.human).toBe(0);
    expect(retryPrepared(s)).toBe(true);
    expect(s.player.energy).toBe(40);
    expect(s.world.cleared.human).toBe(0);
  });
  it('settling the final Human victory opens the ending and Rift', () => {
    const s = ready();
    s.world.room = 'human';
    s.world.cleared.human = 19;
    beginBattle(s, 'human-20');
    const b = s.battle!;
    // Exercise settlement with a controlled final hit, independent of boss tuning.
    b.actor = 'player';
    b.turn = 'player';
    b.queue = ['player'];
    b.enemies.forEach((e, i) =>
      Object.assign(e, { life: i === 0 ? 1 : 0, shield: 0, defense: 0 }),
    );
    expect(act(s, 'attack', b.token, () => 0.99, 'enemy0')).toBe(true);
    expect(b.turn).toBe('victory');
    expect(s.world.cleared.human).toBe(20);
    returnToRoom(s);
    s.world.room = 'entry';
    expect(travel(s, 'ending')).toBe(true);
    s.world.room = 'riftEntry';
    expect(travel(s, 'rift')).toBe(true);
  });
  it('delivery pays once at the Library and can be repeated from merchant', () => {
    const s = ready();
    expect(delivery(s)).toBe(false);
    s.world.room = 'merchant';
    expect(delivery(s)).toBe(true);
    expect(delivery(s)).toBe(false);
    expect(s.player.gold).toBe(0);
    s.world.room = 'library';
    expect(delivery(s)).toBe(true);
    const paid = s.player.gold;
    expect(paid).toBeGreaterThan(0);
    expect(delivery(s)).toBe(false);
    expect(s.player.gold).toBe(paid);
    s.world.room = 'merchant';
    expect(delivery(s)).toBe(true);
  });
  it('shops enforce stock, gold, ownership, and equipment requirements', () => {
    const s = ready();
    s.player.gold = weapons.tempered.price + weapons.focus.price;
    s.player.strength = weapons.tempered.strength - 1;
    expect(buyWeapon(s, 'tempered')).toBe(false);
    s.world.room = 'advanced';
    expect(buyWeapon(s, 'tempered')).toBe(true);
    expect(s.player.gold).toBe(weapons.focus.price);
    expect(buyWeapon(s, 'tempered')).toBe(false);
    expect(equip(s, 'tempered')).toBe(false);
    expect(buyWeapon(s, 'focus')).toBe(true);
    expect(equip(s, 'focus')).toBe(true);
  });
  it('v5 roundtrips world and gear, v3 starts at Entry, invalid unlocks preserve saves', () => {
    const s = ready();
    s.world.room = 'library';
    s.world.delivery = true;
    s.world.cleared.human = 7;
    s.player.inventory.push('focus');
    let raw = '';
    const storage = {
      getItem: () => raw || null,
      setItem: (_k: string, v: string) => {
        raw = v;
      },
    };
    expect(save(storage, s)).toContain('saved');
    expect(JSON.parse(raw).version).toBe(5);
    expect(decodeSave(raw).world).toEqual(s.world);
    expect(decodeSave(raw).player.inventory).toContain('focus');
    expect(decodeSave(raw).player.tree.origin).toBe('warrior');
    const legacyV4 = JSON.parse(raw);
    legacyV4.version = 4;
    delete legacyV4.player.tree;
    expect(decodeSave(JSON.stringify(legacyV4)).player.tree).toEqual({
      origin: 'warrior',
      allocated: [],
      masteries: {},
    });
    expect(
      decodeSave(JSON.stringify({ version: 3, player: s.player })).world,
    ).toEqual(newWorld());
    const invalid = JSON.parse(raw);
    invalid.world.endingSeen = true;
    raw = JSON.stringify(invalid);
    expect(() => decodeSave(raw)).toThrow();
    const old = raw;
    expect(save(storage, s)).toContain('left untouched');
    expect(raw).toBe(old);
    expect(SAVE_KEY).toBe('rpg.phase1.save');
  });
});
