import type { ClassId } from '../../content/phase2';
import { smooth } from './kinematics';

export type Motion =
  'idle' | 'walk' | 'attack' | 'hit' | 'guard' | 'drink' | 'qi' | 'defeat';
export const motionDuration: Record<Motion, number> = {
  idle: Infinity,
  walk: Infinity,
  attack: 0.78,
  hit: 0.4,
  guard: 1.0,
  drink: 1.4,
  qi: 1.25,
  defeat: 1.1,
};
export const characterSkins: Record<
  ClassId,
  { cloth: number; accent: number; stance: number }
> = {
  warrior: { cloth: 0xc96359, accent: 0xf0a390, stance: 9 },
  caster: { cloth: 0xc3dfef, accent: 0xdff8ff, stance: -5 },
  shadow: { cloth: 0xe6c35d, accent: 0xffe898, stance: 17 },
  balanced: { cloth: 0x8db7a4, accent: 0xb8e5c7, stance: 3 },
};

/** Fraction of a walk cycle a foot stays planted; the remainder is its swing. */
const STANCE = 0.6;
/** Ankle height at contact, in rig-local units above the root. */
const GROUND = -7;
/** Hip height above the root. Leg reach is 108, so this leaves the knee bent. */
export const HIP_HEIGHT = -102;
const MIN_RANGE = 16,
  MAX_RANGE = 33;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
/** Half the sweep of a planted foot, for a 0..1 stride scale. */
export const footRange = (stride: number) =>
  MIN_RANGE + (MAX_RANGE - MIN_RANGE) * clamp01(stride);
/**
 * Ground a walk cycle covers. Advancing the cycle by anything else — wall time,
 * or a distance divisor that does not match the pose — makes the feet skate.
 */
export const cycleDistance = (stride: number) =>
  (footRange(stride) * 2) / STANCE;

/**
 * Depth offsets that keep the near and far limbs off a single pin joint, which
 * is what made the hips read as a mermaid tail and hid the near arm.
 */
const HIP_DEPTH = 4,
  SHOULDER_DEPTH = 5,
  HIP_COUNTER = 0.6;
export const hipOffset = (twist: number, near: boolean) =>
  near ? HIP_DEPTH - twist * HIP_COUNTER : -HIP_DEPTH + twist * HIP_COUNTER;
export const shoulderOffset = (twist: number, near: boolean) =>
  near ? SHOULDER_DEPTH + twist : -SHOULDER_DEPTH - twist;

export type Limb = { upper: number; lower: number };
export type Foot = { x: number; y: number; toe: number };

export function samplePose(
  motion: Motion,
  elapsed: number,
  origin: ClassId,
  stride = 0.85,
) {
  const time = Math.max(0, elapsed),
    phase = Math.min(1, time / motionDuration[motion]);
  const stance = characterSkins[origin].stance;
  const p = {
    x: 0,
    y: Math.sin(time * 1.8) * 0.25,
    lean: stance * 0.09,
    /** Chest-to-shoulder angle, applied on top of `lean`. */
    spine: 0,
    /** Shoulder-segment stretch, so idle breathing lifts the chest, not the hips. */
    breath: 0,
    head: -stance * 0.06,
    /** Near shoulder pushed forward by this much; the near hip counter-rotates. */
    twist: 0,
    arms: {
      near: { upper: -26 - stance * 0.4, lower: -65 } as Limb,
      far: { upper: 22, lower: -65 } as Limb,
    },
    feet: {
      near: { x: 24 + stance * 0.2, y: GROUND, toe: 0 } as Foot,
      far: { x: -23 - stance * 0.15, y: GROUND, toe: 0 } as Foot,
    },
    cloth: Math.sin(time * 1.8 + 0.6) * 1.2,
    wrist: 94,
    slash: 0,
    glow: 0,
    bottle: false,
    palm: false,
    alpha: 1,
  };
  const hold = smooth(phase / 0.2) * (1 - smooth((phase - 0.75) / 0.25));
  if (motion === 'idle') {
    p.arms.near = { upper: -8, lower: -8 };
    p.arms.far = { upper: 10, lower: -6 };
    p.breath = Math.sin(time * 1.8) * 1.3;
    p.spine = Math.sin(time * 1.8) * 0.8;
  } else if (motion === 'walk') {
    const cycle = time % 1;
    const range = footRange(stride),
      span = range * 2;
    const step = (t: number): Foot => {
      // Stance travels backward at constant speed; the lifted foot returns forward.
      const swing = t >= STANCE,
        u = swing ? (t - STANCE) / (1 - STANCE) : t / STANCE;
      // Match horizontal velocity at lift-off and landing; squared sine also
      // gives zero vertical velocity at both contacts, avoiding a foot snap.
      const tangent = (-span * (1 - STANCE)) / STANCE;
      const lift = Math.sin(u * Math.PI) ** 2;
      // Heel strike lands toe-up, the foot flattens through mid-stance, then
      // rolls over the ball at toe-off; the swing carries that push-off back
      // round to the next landing.
      const toe = swing
        ? 38 * (1 - smooth(u / 0.35)) - 20 * smooth((u - 0.4) / 0.6)
        : u < 0.25
          ? -20 * (1 - u / 0.25)
          : 38 * smooth((u - 0.6) / 0.4);
      // Pivoting over the toe raises the ankle instead of driving it underground.
      const roll = toe > 0 ? Math.sin((toe * Math.PI) / 180) * 9 : 0;
      return {
        x: swing
          ? -range + span * smooth(u) + tangent * (2 * u ** 3 - 3 * u ** 2 + u)
          : range - span * u,
        y: GROUND - (swing ? lift * (7 + 6 * clamp01(stride)) : 0) - roll,
        toe,
      };
    };
    p.feet.near = step(cycle);
    p.feet.far = step((cycle + 0.5) % 1);
    // Pelvis vaults over the straight stance leg and drops through double support.
    p.y = Math.cos(cycle * Math.PI * 4) * range * 0.09;
    p.lean = 2;
    p.head = -2; // gaze stays level through the forward lean
    // Near foot leads at cycle 0, so the near arm is furthest back there.
    const swing = Math.cos(cycle * Math.PI * 2);
    p.twist = -swing * 7; // shoulders counter-rotate against the pelvis
    const reach = 10 + 18 * clamp01(stride);
    p.arms.near = {
      upper: -5 + swing * reach,
      // The elbow folds on the forward swing and opens again behind the body.
      lower: -10 - (1 - swing) * 15,
    };
    p.arms.far = {
      upper: 5 - swing * reach,
      lower: -10 - (1 + swing) * 15,
    };
    p.cloth = Math.sin(cycle * Math.PI * 2 - 0.5) * 4;
  } else if (motion === 'attack') {
    const wind = smooth(phase / 0.28),
      strike = smooth((phase - 0.28) / 0.13);
    const recover = 1 - smooth((phase - 0.62) / 0.38);
    p.x = (-6 * wind + 23 * strike) * recover;
    p.y = 3 * strike * recover;
    p.lean += (-7 * wind + 18 * strike) * recover;
    p.spine = (-4 * wind + 9 * strike) * recover;
    p.twist = (7 * wind - 12 * strike) * recover;
    p.arms.near.upper += (42 * wind - 106 * strike) * recover;
    p.arms.near.lower += (-48 * wind + 52 * strike) * recover;
    p.wrist += (-25 * wind + 30 * strike) * recover;
    p.arms.far.upper += 12 * wind * recover;
    p.head = -p.lean * 0.55;
    p.feet.near.x += 10 * strike * recover;
    p.cloth = -p.lean * 0.4;
    p.slash =
      phase > 0.32 && phase < 0.6
        ? Math.sin(((phase - 0.32) / 0.28) * Math.PI)
        : 0;
  } else if (motion === 'hit') {
    const recoil = Math.sin(phase * Math.PI);
    p.x = -recoil * 7;
    p.y = recoil * 3;
    p.lean = -recoil * 12;
    p.spine = -recoil * 5;
    p.head = -recoil * 6;
  } else if (motion === 'guard') {
    p.arms.near.upper -= hold * 30;
    p.arms.near.lower -= hold * 60;
    p.arms.far.upper -= hold * 20;
    p.y += hold * 5;
    p.lean -= hold * 5;
    p.spine -= hold * 3;
    p.wrist -= hold * 35;
  } else if (motion === 'drink') {
    p.arms.near.upper += (-103 - p.arms.near.upper) * hold;
    p.arms.near.lower += (-129 - p.arms.near.lower) * hold;
    p.head -= hold * 5;
    p.bottle = true;
  } else if (motion === 'qi') {
    p.arms.near.upper -= hold * 64;
    p.arms.near.lower += hold * 22;
    p.arms.far.upper -= hold * 10;
    p.arms.far.lower -= hold * 45;
    p.palm = hold > 0.65;
    p.glow = hold * 0.75;
    p.cloth -= hold * 4;
    p.lean += hold * 3;
    p.spine += hold * 4;
  } else if (motion === 'defeat') {
    const collapse = smooth(phase);
    p.x = collapse * 8;
    p.y = collapse * 44;
    p.lean = collapse * 42;
    p.spine = collapse * 10;
    p.head = collapse * 18;
    p.arms.near = { upper: collapse * 18, lower: -15 };
    p.wrist = 110 - p.lean - p.arms.near.upper - p.arms.near.lower;
    p.alpha = 1 - collapse * 0.2;
  }
  return p;
}
export type RigPose = ReturnType<typeof samplePose>;

/** Blends every number in the pose tree; non-numbers snap to the target. */
function mix(from: unknown, to: unknown, weight: number): unknown {
  if (typeof to === 'number')
    return typeof from === 'number' ? from + (to - from) * weight : to;
  if (to && typeof to === 'object') {
    const source = (from ?? {}) as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(to as Record<string, unknown>))
      result[key] = mix(source[key], value, weight);
    return result;
  }
  return to;
}
export function blendPose(from: RigPose, to: RigPose, weight: number): RigPose {
  return mix(from, to, weight) as RigPose;
}
