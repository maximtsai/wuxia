import type { WorldState } from '../content/world';
import type { PotionId, WeaponId } from '../content/catalog';
import type { ClassId, SkillId, StatChoice } from '../content/phase2';
import type { CombatEvent } from './combat/events';
import type { TreeProgress } from './tree/allocation';
export interface Bottle {
  id: string;
  type: PotionId;
  charges: number;
}
export interface Player {
  life: number;
  mana: number;
  energy: number;
  gold: number;
  xp: number;
  wins: number;
  strength: number;
  speed: number;
  maxLife: number;
  maxMana: number;
  maxEnergy: number;
  classId: ClassId | null;
  level: number;
  choices: StatChoice[];
  ranks: Partial<Record<SkillId, number>>;
  shieldEquipped: boolean;
  weapon: WeaponId;
  inventory: WeaponId[];
  bottles: Bottle[];
  potionSlots: [string | null, string | null];
  /** Placeholder shared-tree state; rank progression remains temporary runtime content. */
  tree: TreeProgress;
}
export interface Status {
  kind: 'burn' | 'weaken' | 'silence';
  turns: number;
  power: number;
}
export interface Fighter {
  id: string;
  name: string;
  life: number;
  maxLife: number;
  mana: number;
  speed: number;
  damage: number;
  defense: number;
  magicDefense: number;
  shield: number;
  maxShield: number;
  statuses: Status[];
  behavior: 'striker' | 'healer' | 'caster' | 'ward' | 'shadow';
}
export interface Intent {
  name: string;
  kind: 'physical' | 'magic' | 'heal' | 'guard';
  target: string;
  power: number;
  cost: number;
  status?: 'burn' | 'silence';
}
export interface Battle {
  encounterId: string;
  enemies: Fighter[];
  shadow: Fighter | null;
  turn: 'player' | 'enemy' | 'shadow' | 'victory' | 'defeat' | 'finished';
  openingOrder: string[];
  queue: string[];
  actor: string;
  round: number;
  token: number;
  guard: number;
  playerShield: number;
  statuses: Status[];
  intents: Record<string, Intent>;
  prepared: Player;
  selectedTarget: string | null;
  eventSequence: number;
  events: CombatEvent[];
  /** Uses spent this encounter by limited-use techniques. */
  usesSpent: Partial<Record<SkillId, number>>;
}
export interface Session {
  world: WorldState;
  player: Player;
  battle: Battle | null;
  position: { x: number; y: number };
  log: string[];
}
