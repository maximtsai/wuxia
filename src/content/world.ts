import type { EncounterDefinition, EnemyDefinition } from './phase2';
export const rooms = {
  entry: {
    name: 'Entry',
    landmark: 'Keeper and restoration alcove',
    exits: { up: 'potions', down: 'ending' },
  },
  potions: {
    name: 'Potions & Food',
    landmark: 'Potion stand, food stall and refill well',
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
/**
 * Things in a room the player can walk up to. Their card (name, one-line
 * blurb and actions) only appears while the player stands near them.
 * `figures` are NPC bodies drawn by the character stage; props have none.
 */
export interface Interactable {
  id: string;
  name: string;
  blurb: string;
  x: number;
  y: number;
  /** Scene commands offered on the card, first one bound to the E key. */
  actions: readonly string[];
  figures?: readonly { x: number; y: number }[];
  /** Looping body pose for the figures; standing idle when omitted. */
  pose?: 'meditate';
}
const npc = (
  id: string,
  name: string,
  blurb: string,
  x: number,
  actions: readonly string[],
): Interactable => ({
  id,
  name,
  blurb,
  x,
  y: 490,
  actions,
  figures: [{ x, y: 490 }],
});
const prop = (
  id: string,
  name: string,
  blurb: string,
  x: number,
  y: number,
  actions: readonly string[],
): Interactable => ({ id, name, blurb, x, y, actions });
export const interactables: Record<RoomId, readonly Interactable[]> = {
  entry: [
    npc('keeper', 'Keeper', 'Tends the restoration alcove.', 800, [
      'rest',
      'dialogue',
    ]),
    {
      ...npc(
        'monk',
        'Meditating monk',
        'Saves your game, and can fully restore you a few times.',
        1130,
        ['save', 'meditate'],
      ),
      pose: 'meditate',
    },
  ],
  potions: [
    {
      ...npc(
        'food-seller',
        'Food seller',
        'Hot meals, mostly for Energy.',
        1120,
        ['food'],
      ),
      y: 525,
      figures: [{ x: 1120, y: 455 }],
    },
    {
      ...npc(
        'potion-seller',
        'Potion seller',
        'Bottles for your two slots.',
        590,
        ['shop'],
      ),
      y: 525,
      figures: [{ x: 590, y: 455 }],
    },
    prop('well', 'Well', 'Refills every bottle you own, free.', 285, 520, [
      'refill',
    ]),
  ],
  human: [
    prop('human-gate', 'Human Gateway', 'Twenty sealed trials.', 800, 470, [
      'encounters',
    ]),
  ],
  merchant: [
    npc('merchant', 'Merchant', 'Weapons, and parcels for the Library.', 800, [
      'vendor',
      'delivery',
    ]),
  ],
  upstairs: [
    npc('mentor', 'Mentor', 'Can refund your stats and skills.', 800, [
      'dialogue',
      'progression',
    ]),
  ],
  advanced: [
    npc('smith', 'Forge-smith', 'Tempered equipment.', 800, ['vendor']),
  ],
  library: [
    npc('archivist', 'Archivist', 'Archives and the delivery desk.', 800, [
      'library',
    ]),
  ],
  statue: [
    {
      ...prop(
        'guards',
        'Temple guards',
        'They watch the Rift stairway.',
        800,
        490,
        ['dialogue'],
      ),
      figures: [
        { x: 690, y: 490 },
        { x: 910, y: 490 },
      ],
    },
  ],
  riftEntry: [
    prop(
      'stairway',
      'Rift stairway',
      'Sealed until the human seals fall.',
      800,
      470,
      [],
    ),
  ],
  rift: [
    prop('dark-rift', 'Dark Rift', 'Five masterwork trials.', 800, 470, [
      'encounters',
    ]),
    prop('masterwork', 'Masterwork forge', 'The finest equipment.', 1110, 470, [
      'vendor',
    ]),
  ],
  monster: [
    prop(
      'monster-portal',
      'Monster portal',
      'Optional monster trials.',
      800,
      470,
      ['encounters'],
    ),
  ],
  training: [
    prop('wards', 'Training wards', 'Spend Energy for EXP.', 800, 470, [
      'encounters',
    ]),
  ],
  ending: [
    prop(
      'road',
      'Open road',
      'The twenty seals are broken. The road is open.',
      800,
      420,
      [],
    ),
  ],
};
/** How close the player must stand for an object's card to appear. */
export const interactRadius = 190;
/** Where the player stands to use an object: in front of an NPC, beside a prop. */
export const standSpot = (o: Interactable) =>
  o.pose === 'meditate'
    ? { x: o.x - 150, y: o.y } // beside a seated figure, which is too low to stand before
    : o.figures
      ? { x: o.x, y: o.y + 110 }
      : { x: o.x, y: o.y + 180 };
export function nearestInteractable(
  room: RoomId,
  at: { x: number; y: number },
) {
  let best: Interactable | null = null,
    bestDistance = interactRadius;
  for (const o of interactables[room]) {
    const d = Math.hypot(at.x - o.x, at.y - o.y);
    if (d <= bestDistance) {
      best = o;
      bestDistance = d;
    }
  }
  return best;
}
// Where the player walks to use a room service from a menu.
export function serviceSpot(room: RoomId, command: string) {
  const o =
    interactables[room].find((i) => i.actions.includes(command)) ??
    interactables[room][0];
  return standSpot(o);
}
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
  /** Full restores already taken from the meditating monk, out of `MONK_RESTORES`. */
  restoresUsed: number;
}
/** Lifetime full restores (Life, Qi and Energy) the meditating monk offers. */
export const MONK_RESTORES = 10;
export const newWorld = (): WorldState => ({
  room: 'entry',
  cleared: { human: 0, monster: 0, rift: 0 },
  delivery: false,
  deliveries: 0,
  endingSeen: false,
  restoresUsed: 0,
});
export function portalStage(
  id: string,
): { portal: PortalId; stage: number } | null {
  const m = /^(human|monster|rift)-(\d+)$/.exec(id);
  return m ? { portal: m[1] as PortalId, stage: Number(m[2]) } : null;
}
/**
 * Human Gateway opponents per stage, after the original game (see
 * docs/reference-sinjid.md). Only names come from the reference (the Life
 * figures are kept for reference but unused); the rest of each enemy, including
 * its Life and moves, uses the shared stage formula below.
 */
const humanRoster: [name: string, life: number][][] = [
  [['Thief', 60]],
  [['Bandit', 40]],
  [['Raider', 120]],
  [
    ['Thief', 140],
    ['Bandit', 100],
  ],
  [['Warrior', 180]],
  [['Seer', 200]],
  [
    ['Raider', 200],
    ['Warrior', 230],
  ],
  [['Mercenary', 400]],
  [['Assailant', 100]],
  [
    ['Warrior', 280],
    ['Seer', 260],
  ],
  [
    ['Mercenary', 420],
    ['Assailant', 110],
  ],
  [['Agent', 550]],
  [['Seer', 600]],
  [['Shaman', 700]],
  [['Assailant', 180]],
  [['Ronin', 900]],
  [['Agent', 1000]],
  [['Samurai', 1100]],
  [
    ['Shaman', 1000],
    ['Ronin', 1000],
  ],
  [
    ['Samurai', 1350],
    ['Samurai', 1350],
  ],
];
export const campaign: Record<string, EncounterDefinition> = {};
for (const portal of Object.keys(portals) as PortalId[]) {
  for (let stage = 1; stage <= portals[portal].count; stage++) {
    const level =
      portal === 'human'
        ? stage
        : portal === 'monster'
          ? stage + 8
          : stage + 20;
    const roster = portal === 'human' ? humanRoster[stage - 1] : undefined;
    const duo = roster
      ? roster.length === 2
      : stage % 3 === 0 || portal === 'rift';
    const names =
      portal === 'monster'
        ? ['Crawler', 'Revenant', 'Wisp', 'Ogre']
        : ['Rift Warden', 'Void Oracle', 'Shade', 'Rift Keeper'];
    const enemies: EnemyDefinition[] = Array.from(
      { length: duo ? 2 : 1 },
      (_, i) => ({
        name: roster ? roster[i][0] : names[(stage - 1 + i) % names.length],
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
  if (humanRoster.length !== portals.human.count)
    throw new Error('Invalid Human Gateway roster');
}
validateWorld();
