// Stable IDs and numeric balance are independent of names and visual theme.
export const weapons = {
  starter: { damage: 0, strength: 0, price: 0 },
  earned: { damage: 5, strength: 5, price: 25 },
  swift: { damage: 9, strength: 0, price: 65 },
  tempered: { damage: 16, strength: 22, price: 120 },
  focus: { damage: 13, strength: 0, price: 110 },
  masterwork: { damage: 24, strength: 0, price: 250 },
} as const;
export type WeaponId = keyof typeof weapons;
export const theme = {
  title: 'The Wandering Path',
  room: 'Temple room',
  player: 'Traveler',
  enemy: 'Sparring sentinel',
  colors: {
    background: 0x1a130c,
    floor: 0x3a2a1a,
    line: 0x5e462c,
    player: 0xe3bf6c,
    enemy: 0xd9ad86,
  },
  weapons: {
    starter: 'Practice blade',
    earned: 'Balanced blade',
    swift: 'Light blade',
    tempered: 'Tempered blade',
    focus: 'Channeling blade',
    masterwork: 'Masterwork blade',
  },
};

export const potions = {
  small: {
    name: 'Gentle draught',
    life: 20,
    mana: 0,
    charges: 4,
    guard: 0,
    price: 12,
  },
  strong: {
    name: 'Concentrated draught',
    life: 55,
    mana: 0,
    charges: 2,
    guard: 0,
    price: 24,
  },
  mana: {
    name: 'Qi draught',
    life: 0,
    mana: 16,
    charges: 3,
    guard: 0,
    price: 12,
  },
  hybrid: {
    name: 'Twin draught',
    life: 25,
    mana: 10,
    charges: 2,
    guard: 0,
    price: 24,
  },
  fortify: {
    name: 'Fortifying draught',
    life: 12,
    mana: 0,
    charges: 2,
    guard: 2,
    price: 24,
  },
} as const;
export type PotionId = keyof typeof potions;
/** Food seller's menu, eaten on the spot: mostly Energy, a little Life and Qi. */
export const foods = {
  riceBall: { name: 'Rice ball', energy: 10, life: 4, mana: 2, price: 5 },
  dumplings: {
    name: 'Tea and dumplings',
    energy: 18,
    life: 5,
    mana: 6,
    price: 10,
  },
  noodles: { name: 'Noodle soup', energy: 25, life: 10, mana: 4, price: 16 },
  fish: {
    name: 'Grilled river fish',
    energy: 35,
    life: 14,
    mana: 6,
    price: 24,
  },
  feast: { name: 'Temple feast', energy: 50, life: 20, mana: 10, price: 40 },
} as const;
export type FoodId = keyof typeof foods;
