import type { ClassId } from '../../content/phase2';
import { smooth } from './kinematics';
import { applyKeys, isKeyed, keyedDuration, type KeyedMotion } from './strikes';

type PosedMotion =
  | 'idle'
  | 'walk'
  | 'run'
  | 'hit'
  | 'guard'
  | 'drink'
  | 'qi'
  | 'defeat'
  | 'meditate';
export type Motion = PosedMotion | KeyedMotion;
const motionDuration: Record<PosedMotion, number> = {
  idle: Infinity,
  walk: Infinity,
  run: Infinity,
  hit: 0.4,
  guard: 1.0,
  drink: 1.4,
  qi: 1.25,
  defeat: 1.1,
  meditate: Infinity,
};
/** How long `motion` runs; keyed strikes lengthen with each extra blow. */
export const durationOf = (motion: Motion, hits = 1) =>
  isKeyed(motion) ? keyedDuration(motion, hits) : motionDuration[motion];
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
/** Hip height above the root. Leg reach is 108, so this leaves a soft knee. */
export const HIP_HEIGHT = -109;
/** Hip-to-ankle length of a walking stance leg (~20° of knee) and of the leading
 * leg at heel strike, which straightens almost fully (~10°) for that instant. */
const STANCE_LEG = 106.3,
  STRIKE_LEG = 107.6;
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
 * A run plants each foot for barely a third of the cycle, so both are off the
 * ground twice per cycle; that flight phase is what separates it from a walk.
 */
const RUN_STANCE = 0.35,
  RUN_RANGE = 30;
export const runCycleDistance = (RUN_RANGE * 2) / RUN_STANCE;

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
/** Explicit hip/knee angles, for folded poses the two-bone solver cannot reach. */
export type LegAngles = { thigh: number; shin: number };

export function samplePose(
  motion: Motion,
  elapsed: number,
  origin: ClassId,
  { stride = 0.85, hits = 1 }: { stride?: number; hits?: number } = {},
) {
  const time = Math.max(0, elapsed),
    phase = Math.min(1, time / durationOf(motion, hits));
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
    /** Overrides the foot-target IK when set; `feet[].toe` still angles the foot. */
    legs: null as null | { near: LegAngles; far: LegAngles },
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
    p.lean = 2;
    p.head = -2; // gaze stays level through the forward lean
    // Near foot leads at cycle 0, so the near arm is furthest back there.
    const swing = Math.cos(cycle * Math.PI * 2);
    p.twist = -swing * 7; // shoulders counter-rotate against the pelvis
    // Pelvis rides the stance legs like an inverted pendulum: it vaults over
    // mid-stance and drops through double support just far enough that the
    // leading leg lands nearly straight, then softens again as it loads.
    let hip = -Infinity;
    for (const [t, foot, near] of [
      [cycle, p.feet.near, true],
      [(cycle + 0.5) % 1, p.feet.far, false],
    ] as const) {
      if (t >= STANCE && t < 0.85) continue; // lifted clear, leg hangs free
      const fromStrike = t < 0.5 ? t : 1 - t;
      const leg =
        STANCE_LEG +
        (STRIKE_LEG - STANCE_LEG) * (1 - smooth(fromStrike / 0.15));
      const dx = foot.x - hipOffset(p.twist, near);
      hip = Math.max(hip, foot.y - Math.sqrt(leg * leg - dx * dx));
    }
    p.y = hip - HIP_HEIGHT;
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
  } else if (motion === 'run') {
    const cycle = time % 1,
      span = RUN_RANGE * 2;
    const step = (t: number): Foot => {
      const swing = t >= RUN_STANCE,
        u = swing ? (t - RUN_STANCE) / (1 - RUN_STANCE) : t / RUN_STANCE;
      const tangent = (-span * (1 - RUN_STANCE)) / RUN_STANCE;
      // The heel kicks up behind early in the swing, then the knee drives
      // through high and the foot reaches forward to land under the body.
      const lift = swing
        ? Math.sin(u * Math.PI) ** 1.3 * 38 +
          Math.sin(Math.min(1, u / 0.55) * Math.PI) * 14
        : 0;
      // Lands on the midfoot, pushes off over the ball, levels out in flight.
      const toe = swing
        ? 30 * (1 - smooth(u / 0.5))
        : 30 * smooth((u - 0.5) / 0.5);
      const roll = toe > 0 ? Math.sin((toe * Math.PI) / 180) * 9 : 0;
      return {
        x: swing
          ? -RUN_RANGE +
            span * smooth(u) +
            tangent * (2 * u ** 3 - 3 * u ** 2 + u)
          : RUN_RANGE - span * u,
        y: GROUND - lift - roll,
        toe,
      };
    };
    p.feet.near = step(cycle);
    p.feet.far = step((cycle + 0.5) % 1);
    // Unlike the walk, the body is lowest at mid-stance, where the leg
    // compresses, and highest in flight between contacts.
    p.y = 6 + Math.cos(Math.PI * 4 * (cycle - RUN_STANCE / 2)) * 4;
    p.lean = 9;
    p.spine = 2;
    p.head = -7;
    const swing = Math.cos(cycle * Math.PI * 2);
    p.twist = -swing * 9;
    // Elbows stay bent near a right angle and pump from the shoulder.
    p.arms.near = { upper: -10 + swing * 38, lower: -85 - swing * 10 };
    p.arms.far = { upper: -10 - swing * 38, lower: -85 + swing * 10 };
    p.cloth = Math.sin(cycle * Math.PI * 2 - 0.5) * 7 - 4;
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
  } else if (motion === 'meditate') {
    // Seated cross-legged: hips on the floor, thighs forward along it and
    // shins folded back under them. A foot beside the hip would make IK point
    // the knee straight up, so this pose sets the leg angles directly.
    const breathe = Math.sin(time * 1.8);
    p.y = 88; // hips 21 above the root, knees and ankles just off the floor
    p.lean = 0;
    p.spine = -2;
    p.head = 5 + breathe * 0.6; // eyes lowered
    p.breath = breathe * 1.6;
    p.legs = {
      near: { thigh: -78, shin: 163 },
      far: { thigh: -86, shin: 170 },
    };
    p.feet.near.toe = p.feet.far.toe = 20;
    // Hands rest on the thighs, just short of the knees.
    p.arms.near = { upper: -12, lower: -30 };
    p.arms.far = { upper: -6, lower: -34 };
    p.cloth = breathe * 0.8;
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
  } else if (isKeyed(motion)) {
    // Gestures happen out of combat, so they start from relaxed idle arms
    // rather than the fists-up guard every strike begins from.
    if (motion === 'salute' || motion === 'purchase') {
      p.arms.near = { upper: -8, lower: -8 };
      p.arms.far = { upper: 10, lower: -6 };
    }
    applyKeys(p, motion, time, hits);
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
