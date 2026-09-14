import type { EncounterDefinition, EnemyDefinition } from './phase2';
export const rooms = {
  entry: {
    name: 'Entry',
    landmark: 'Keeper and restoration alcove',
    exits: { up: 'potions', down: 'ending' },
  },
  potions: {
    name: 'Potions & Food',
    landmark: 'Seller stand and refill well',
    exits: { down: 'entry', left: 'human', right: 'merchant' },
  },
  human: {
    name: 'Human Gateway',
    landmark: 'Twenty seals around the gateway',
    exits: { right: 'potions' },
  },
  merchant: {
    name: 'Weapons & Merchant',
    landmark: 'Weapon racks and delivery counter',
    exits: { left: 'potions', up: 'upstairs' },
  },
  upstairs: {
    name: 'Upstairs',
    landmark: 'Quiet lounge and Mentor',
    exits: { down: 'merchant', left: 'advanced' },
  },
  advanced: {
    name: 'Advanced Equipment',
    landmark: 'Tempered equipment forge',
    exits: { right: 'upstairs', left: 'library', up: 'statue' },
  },
  library: {
    name: 'Library',
    landmark: 'Archives and delivery desk',
    exits: { right: 'advanced' },
  },
  statue: {
    name: 'Statue Room',
    landmark: 'Stone sentinel and two guards',
    exits: { down: 'advanced', left: 'riftEntry', right: 'monster' },
  },
  riftEntry: {
    name: 'High-difficulty Entryway',
    landmark: 'Sealed Rift stairway',
    exits: { right: 'statue', up: 'rift' },
  },
  rift: {
    name: 'High-difficulty Room',
    landmark: 'Dark Rift and masterwork forge',
    exits: { down: 'riftEntry' },
  },
  monster: {
    name: 'Monster Gate',
    landmark: 'Optional monster portal',
    exits: { left: 'statue', up: 'training' },
  },
  training: {
    name: 'Training Room',
    landmark: 'Three training wards',
    exits: { down: 'monster' },
  },
  ending: {
    name: 'Beyond the Temple',
    landmark: 'An open road',
    exits: { up: 'entry' },
  },
} as const;
export type RoomId = keyof typeof rooms;
// Shared by movement, room transitions, and doorway rendering.
export const roomBounds = { left: 140, right: 1460, top: 160, bottom: 805 };
export const doorways = {
  up: { x: 800, y: 160, arrival: { x: 800, y: 270 } },
  down: { x: 800, y: 805, arrival: { x: 800, y: 695 } },
  left: { x: 140, y: 560, arrival: { x: 250, y: 560 } },
  right: { x: 1460, y: 560, arrival: { x: 1350, y: 560 } },
} as const;
export type ExitDirection = keyof typeof doorways;
export const doorwayRadius = 55;
export type PortalId = 'human' | 'monster' | 'rift';
export const portals = {
  human: { name: 'Human Gateway', count: 20 },
  monster: { name: 'Monster Portal', count: 10 },
  rift: { name: 'Dark Rift', count: 5 },
} as const;
export interface WorldState {
  room: RoomId;
  cleared: Record<PortalId, number>;
  delivery: boolean;
  deliveries: number;
  endingSeen: boolean;
}
export const newWorld = (): WorldState => ({
  room: 'entry',
  cleared: { human: 0, monster: 0, rift: 0 },
  delivery: false,
  deliveries: 0,
  endingSeen: false,
});
export function portalStage(
  id: string,
): { portal: PortalId; stage: number } | null {
  const m = /^(human|monster|rift)-(\d+)$/.exec(id);
  return m ? { portal: m[1] as PortalId, stage: Number(m[2]) } : null;
}
export const campaign: Record<string, EncounterDefinition> = {};
for (const portal of Object.keys(portals) as PortalId[]) {
  for (let stage = 1; stage <= portals[portal].count; stage++) {
    const level =
      portal === 'human'
        ? stage
        : portal === 'monster'
          ? stage + 8
          : stage + 20;
    const duo = stage % 3 === 0 || portal === 'rift';
    const names =
      portal === 'human'
        ? ['Scout', 'Guard', 'Invoker', 'Captain']
        : portal === 'monster'
          ? ['Crawler', 'Revenant', 'Wisp', 'Ogre']
          : ['Rift Warden', 'Void Oracle', 'Shade', 'Rift Keeper'];
    const enemies: EnemyDefinition[] = Array.from(
      { length: duo ? 2 : 1 },
      (_, i) => ({
        name: names[(stage - 1 + i) % names.length],
        life: Math.round((45 + level * 9) * (duo ? 0.72 : 1)),
        mana: 40 + level * 2,
        speed: 7 + Math.floor(level * 0.9) + i * 2,
        damage: 6 + Math.floor(level * (duo ? 0.7 : 1)),
        defense: Math.floor(level / 5),
        magicDefense: Math.floor(level / 6),
        shield: stage % 4 === 0 || portal === 'rift' ? level * 3 : 0,
        behavior:
          level > 5 && i === 1
            ? 'healer'
            : stage % 4 === 0
              ? 'caster'
              : 'striker',
      }),
    );
    campaign[`${portal}-${stage}`] = {
      name: `${portals[portal].name} ${stage}`,
      level,
      enemies,
      xp: level * 50,
      gold: 12 + level * 5,
    };
  }
}
export function validateWorld() {
  for (const [id, room] of Object.entries(rooms)) {
    for (const next of Object.values(room.exits)) {
      if (
        !Object.hasOwn(rooms, next) ||
        !Object.values(rooms[next as RoomId].exits).includes(id as never)
      )
        throw new Error('Invalid room connection');
    }
  }
  if (Object.keys(campaign).length !== 35) throw new Error('Invalid campaign');
}
validateWorld();
