import { smooth } from './kinematics';

/**
 * Keyframed combat motions. Each blow is a cock pose snapping into a hit pose,
 * so multi-hit skills repeat that pair on a fixed rhythm and the rig can tell
 * the stage exactly when every blow lands.
 */
export type StrikeMotion =
  'attack' | 'thrust' | 'chop' | 'throw' | 'bolt' | 'burst';
/** The leap in to a melee target and the hop back home. */
export type TravelMotion = 'dash' | 'retreat';
/** Poses that punctuate out-of-combat interactions. */
export type GestureMotion = 'salute' | 'purchase';
export type KeyedMotion = StrikeMotion | TravelMotion | GestureMotion;

/**
 * Seconds from the start to the first contact (or release), between repeated
 * contacts, and from the last contact back to the ready stance.
 */
export const strikeTiming: Record<
  StrikeMotion,
  { wind: number; interval: number; recover: number }
> = {
  attack: { wind: 0.3, interval: 0.22, recover: 0.42 },
  thrust: { wind: 0.3, interval: 0.22, recover: 0.4 },
  chop: { wind: 0.42, interval: 0.34, recover: 0.46 },
  throw: { wind: 0.28, interval: 0.24, recover: 0.4 },
  bolt: { wind: 0.34, interval: 0.26, recover: 0.42 },
  burst: { wind: 0.46, interval: 0.36, recover: 0.5 },
};
export const fixedDuration: Record<TravelMotion | GestureMotion, number> = {
  dash: 0.42,
  retreat: 0.38,
  salute: 1.1,
  purchase: 0.9,
};
/** When the root is airborne during a travel motion, as fractions of it. */
export const travelWindow: Record<
  TravelMotion,
  { start: number; end: number; arc: number }
> = {
  dash: { start: 0.16, end: 0.86, arc: 55 },
  retreat: { start: 0.15, end: 0.85, arc: 35 },
};
export const melee = new Set<string>(['attack', 'thrust', 'chop']);
/** Screen pixels per second; a ranged blow lands when its projectile arrives. */
export const projectileSpeed: Partial<Record<StrikeMotion, number>> = {
  throw: 1700,
  bolt: 1300,
  burst: 950,
};
export const isStrike = (m: string): m is StrikeMotion => m in strikeTiming;
export const isKeyed = (m: string): m is KeyedMotion =>
  isStrike(m) || m in fixedDuration;

/** Seconds after the motion starts at which each blow lands or is released. */
export function contactTimes(motion: StrikeMotion, hits: number) {
  const { wind, interval } = strikeTiming[motion];
  return Array.from(
    { length: Math.max(1, hits) },
    (_, k) => wind + k * interval,
  );
}
/**
 * When each blow lands, in seconds from the action starting: after any leap
 * in, at its contact, plus the flight time to each ranged target. One list
 * per entry of `ranges`, or a single list for melee.
 */
export function impactTimes(
  motion: StrikeMotion,
  hits: number,
  { leap = false, ranges = [] }: { leap?: boolean; ranges?: number[] } = {},
) {
  const lead = leap ? fixedDuration.dash : 0,
    speed = projectileSpeed[motion];
  return (ranges.length ? ranges : [0]).map((r) =>
    contactTimes(motion, hits).map((c) => lead + c + (speed ? r / speed : 0)),
  );
}
export function keyedDuration(motion: KeyedMotion, hits = 1) {
  if (!isStrike(motion)) return fixedDuration[motion];
  const { wind, interval, recover } = strikeTiming[motion];
  return wind + (Math.max(1, hits) - 1) * interval + recover;
}

/** Everything a keyframe can move. Arm and wrist channels are angles. */
type Channels = {
  x: number;
  y: number;
  lean: number;
  spine: number;
  head: number;
  twist: number;
  aNU: number;
  aNL: number;
  aFU: number;
  aFL: number;
  wrist: number;
  fNX: number;
  fNY: number;
  fFX: number;
  fFY: number;
  toeN: number;
  toeF: number;
  slash: number;
  glow: number;
  cloth: number;
};
/** Offsets from the ready stance, so class stances still show through. */
type Delta = Partial<Channels>;
const ANGLES = new Set<keyof Channels>(['aNU', 'aNL', 'aFU', 'aFL', 'wrist']);

// Arm angles are measured from straight down, positive swinging backward;
// the ready stance holds the near arm near -30 and the wrist near 94. Angle
// channels blend the short way round, so a chop from 165 (raised behind the
// head) to -40 travels up and over the front rather than back past the hip.
const slashCock: Delta = {
  x: -6,
  lean: -7,
  spine: -4,
  twist: 7,
  aNU: 42,
  aNL: -48,
  wrist: -25,
  aFU: 12,
};
const slashFore: Delta = {
  x: 17,
  y: 3,
  lean: 11,
  spine: 5,
  twist: -5,
  aNU: -64,
  aNL: 4,
  wrist: 5,
  aFU: 12,
  fNX: 10,
  slash: 1,
};
// The backhand rises from where the forehand finished, so alternate blows
// flow into each other instead of re-cocking every time.
const slashBack: Delta = {
  x: 19,
  y: 1,
  lean: 6,
  spine: 2,
  twist: 8,
  aNU: -120,
  aNL: 45,
  wrist: -34,
  aFU: -10,
  fNX: 10,
  slash: 1,
};
const thrustCock: Delta = {
  x: -10,
  y: 5,
  lean: -8,
  spine: -4,
  twist: 10,
  aNU: 70,
  aNL: -55,
  wrist: -104,
  aFU: -82,
  aFL: 25,
  fNX: -4,
};
const thrustLunge: Delta = {
  x: 30,
  y: 7,
  lean: 16,
  spine: 6,
  twist: -10,
  aNU: -54,
  aNL: 61,
  wrist: -96,
  aFU: 28,
  aFL: 35,
  fNX: 16,
  fFX: -8,
  slash: 1,
};
const chopRaise: Delta = {
  y: -6,
  lean: -10,
  spine: -8,
  head: -4,
  twist: 4,
  aNU: 195,
  aNL: 75,
  wrist: -119,
  aFU: 138,
  aFL: 80,
  fNX: 4,
};
const chopStrike: Delta = {
  x: 22,
  y: 16,
  lean: 30,
  spine: 10,
  head: 8,
  twist: -4,
  aNU: -10,
  aNL: 45,
  wrist: -79,
  aFU: -52,
  aFL: 35,
  fNX: 14,
  fFX: -6,
  slash: 1,
};
// Wound back at shoulder height rather than overhead, where the head would
// hide the throwing hand.
const throwCock: Delta = {
  x: -8,
  lean: -10,
  spine: -6,
  twist: 12,
  aNU: 150,
  aNL: 35,
  aFU: -92,
  aFL: 45,
};
const throwRelease: Delta = {
  x: 10,
  lean: 12,
  spine: 6,
  twist: -12,
  aNU: -65,
  aNL: 55,
  aFU: 18,
  aFL: 45,
  fNX: 8,
};
const boltGather: Delta = {
  x: -6,
  y: 4,
  lean: -6,
  spine: -3,
  twist: 6,
  aNU: 60,
  aNL: -35,
  aFU: -2,
  aFL: -45,
  glow: 0.8,
};
const boltPush: Delta = {
  x: 12,
  y: 3,
  lean: 10,
  spine: 4,
  twist: -8,
  aNU: -58,
  aNL: 63,
  aFU: -92,
  aFL: 55,
  fNX: 10,
  glow: 1,
};
const burstRaise: Delta = {
  y: -8,
  lean: -6,
  spine: -10,
  head: -10,
  aNU: 200,
  aNL: 65,
  aFU: 153,
  aFL: 65,
  glow: 1,
};
const burstSlam: Delta = {
  y: 18,
  lean: 20,
  spine: 10,
  head: 6,
  aNU: -5,
  aNL: 55,
  aFU: -47,
  aFL: 55,
  fNX: 12,
  fFX: -10,
  glow: 0.6,
};

/** The cock pose that leads into blow `k` and the pose it lands in. */
function blow(motion: StrikeMotion, k: number, previous: Delta) {
  switch (motion) {
    case 'attack':
      return k % 2
        ? { cock: { ...previous, slash: 0 }, hit: slashBack }
        : { cock: slashCock, hit: slashFore };
    case 'thrust':
      return {
        cock: k ? { ...thrustCock, x: 4, fNX: 8 } : thrustCock,
        hit: thrustLunge,
      };
    case 'chop':
      return { cock: chopRaise, hit: chopStrike };
    case 'throw':
      return { cock: throwCock, hit: throwRelease };
    case 'bolt':
      return { cock: boltGather, hit: boltPush };
    case 'burst':
      return { cock: burstRaise, hit: burstSlam };
  }
}

type Key = [time: number, delta: Delta];
function strikeKeys(motion: StrikeMotion, hits: number): Key[] {
  const { interval, recover } = strikeTiming[motion];
  const contacts = contactTimes(motion, hits);
  // The snap into each blow; shorter than the gap so repeated blows re-cock.
  const snap = Math.min(0.1, interval * 0.45);
  const keys: Key[] = [[0, {}]];
  let previous: Delta = {};
  contacts.forEach((c, k) => {
    const { cock, hit } = blow(motion, k, previous);
    keys.push([c - snap, cock], [c, hit]);
    previous = hit;
  });
  const last = contacts[contacts.length - 1];
  keys.push(
    [last + Math.min(0.12, recover * 0.3), { ...previous, slash: 0 }],
    [last + recover, {}],
  );
  return keys;
}

/** Travel and gesture keys, as fractions of the motion's duration. */
const fractionKeys: Record<TravelMotion | GestureMotion, Key[]> = {
  dash: [
    [0, {}],
    [0.16, { y: 12, lean: 10, spine: 4, aNU: 60, aNL: 25, aFU: 40, aFL: 30 }],
    [
      0.5,
      {
        y: -4,
        lean: 24,
        spine: 6,
        head: -10,
        aNU: 90,
        aNL: 45,
        aFU: 50,
        aFL: 50,
        fNY: -42,
        fFX: 5,
        fFY: -32,
        toeN: 30,
        toeF: 30,
        cloth: -6,
      },
    ],
    [0.86, { y: 14, lean: 12, spine: 3, fNX: 12, fFX: -7, aNU: 10 }],
    [1, { y: 10, lean: 8, fNX: 10, fFX: -6 }],
  ],
  retreat: [
    [0, {}],
    [0.15, { y: 10, lean: -3, aNU: 20 }],
    [
      0.5,
      {
        y: -4,
        lean: -10,
        spine: -4,
        aNU: 40,
        aNL: -20,
        aFU: 30,
        aFL: -10,
        fNX: -10,
        fNY: -36,
        fFX: -3,
        fFY: -28,
        toeN: 25,
        toeF: 25,
        cloth: 5,
      },
    ],
    [0.85, { y: 8 }],
    [1, {}],
  ],
  // Baoquan: the right fist pressed into the left palm before the chest,
  // held through a shallow bow. Offsets are from the relaxed idle arms.
  salute: [
    [0, {}],
    [0.2, { aNU: -37, aNL: -152, aFU: -43, aFL: -104, head: 2 }],
    [0.35, { aNU: -37, aNL: -152, aFU: -43, aFL: -104, lean: 14, head: 10 }],
    [0.72, { aNU: -37, aNL: -152, aFU: -43, aFL: -104, lean: 14, head: 10 }],
    [0.88, { aNU: -37, aNL: -152, aFU: -43, aFL: -104, head: 2 }],
    [1, {}],
  ],
  // Hand out level to pay or take, a nod, hand back.
  purchase: [
    [0, {}],
    [0.3, { aNU: -62, aNL: -12, lean: 4, head: 4 }],
    [0.55, { aNU: -62, aNL: -12, lean: 4, head: 8 }],
    [0.8, { aNU: -12, aNL: -17, head: 2 }],
    [1, {}],
  ],
};

type PoseLike = {
  x: number;
  y: number;
  lean: number;
  spine: number;
  head: number;
  twist: number;
  wrist: number;
  slash: number;
  glow: number;
  cloth: number;
  arms: {
    near: { upper: number; lower: number };
    far: { upper: number; lower: number };
  };
  feet: {
    near: { x: number; y: number; toe: number };
    far: { x: number; y: number; toe: number };
  };
};
const read = (p: PoseLike): Channels => ({
  x: p.x,
  y: p.y,
  lean: p.lean,
  spine: p.spine,
  head: p.head,
  twist: p.twist,
  aNU: p.arms.near.upper,
  aNL: p.arms.near.lower,
  aFU: p.arms.far.upper,
  aFL: p.arms.far.lower,
  wrist: p.wrist,
  fNX: p.feet.near.x,
  fNY: p.feet.near.y,
  fFX: p.feet.far.x,
  fFY: p.feet.far.y,
  toeN: p.feet.near.toe,
  toeF: p.feet.far.toe,
  slash: p.slash,
  glow: p.glow,
  cloth: p.cloth,
});

/** Poses `p` (already in its ready stance) at `time` seconds into `motion`. */
export function applyKeys(
  p: PoseLike,
  motion: KeyedMotion,
  time: number,
  hits = 1,
) {
  const ready = read(p);
  const keys = isStrike(motion)
    ? strikeKeys(motion, hits)
    : fractionKeys[motion].map(([t, d]): Key => [t * fixedDuration[motion], d]);
  let i = 0;
  while (i < keys.length - 2 && time >= keys[i + 1][0]) i++;
  const [t0, a] = keys[i],
    [t1, b] = keys[i + 1];
  const w = smooth((time - t0) / Math.max(1e-6, t1 - t0));
  const c = {} as Channels;
  for (const key of Object.keys(ready) as (keyof Channels)[]) {
    const from = ready[key] + (a[key] ?? 0),
      to = ready[key] + (b[key] ?? 0);
    const span = ANGLES.has(key)
      ? ((((to - from) % 360) + 540) % 360) - 180
      : to - from;
    c[key] = from + span * w;
  }
  Object.assign(p, {
    x: c.x,
    y: c.y,
    lean: c.lean,
    spine: c.spine,
    head: c.head,
    twist: c.twist,
    wrist: c.wrist,
    slash: c.slash,
    glow: c.glow,
    cloth: c.cloth,
  });
  p.arms.near = { upper: c.aNU, lower: c.aNL };
  p.arms.far = { upper: c.aFU, lower: c.aFL };
  p.feet.near = { x: c.fNX, y: c.fNY, toe: c.toeN };
  p.feet.far = { x: c.fFX, y: c.fFY, toe: c.toeF };
}
