import { describe, expect, it } from 'vitest';
import { solveLeg } from '../../src/game/characters/kinematics';
import {
  durationOf,
  HIP_HEIGHT,
  hipOffset,
  runCycleDistance,
  samplePose,
  type Foot,
} from '../../src/game/characters/poses';
import {
  contactTimes,
  fixedDuration,
  impactTimes,
  projectileSpeed,
  strikeTiming,
  type StrikeMotion,
} from '../../src/game/characters/strikes';

const strikes = Object.keys(strikeTiming) as StrikeMotion[];
/** Arm angle folded into [-180, 180): 0 hangs down, -90 points forward. */
const fold = (a: number) => ((((a + 180) % 360) + 360) % 360) - 180;

describe('strike timeline', () => {
  it('spaces repeated blows one interval apart and lengthens to fit them', () => {
    for (const motion of strikes) {
      const { interval } = strikeTiming[motion];
      const four = contactTimes(motion, 4);
      expect(four).toHaveLength(4);
      four
        .slice(1)
        .forEach((t, k) => expect(t - four[k]).toBeCloseTo(interval));
      expect(durationOf(motion, 4) - durationOf(motion, 1)).toBeCloseTo(
        3 * interval,
      );
    }
  });
  it('lands every melee blow exactly at its contact time', () => {
    for (const motion of ['attack', 'thrust', 'chop'] as const)
      for (const t of contactTimes(motion, 4))
        expect(samplePose(motion, t, 'warrior', { hits: 4 }).slash).toBe(1);
  });
  it('starts and finishes every strike in the ready stance', () => {
    for (const motion of strikes) {
      const start = samplePose(motion, 0, 'warrior', { hits: 2 }),
        end = samplePose(motion, durationOf(motion, 2), 'warrior', { hits: 2 });
      for (const side of ['near', 'far'] as const) {
        expect(fold(end.arms[side].upper - start.arms[side].upper)).toBeCloseTo(
          0,
        );
        expect(fold(end.arms[side].lower - start.arms[side].lower)).toBeCloseTo(
          0,
        );
      }
      expect(end.x).toBeCloseTo(start.x);
      expect(end.slash).toBe(0);
    }
  });
  it('brings a chop over the top rather than back past the hip', () => {
    // Raised behind the head, the blade must travel up and forward; hanging
    // straight down or pointing backward mid-snap means it took the long way.
    const [contact] = contactTimes('chop', 1);
    for (let t = contact - 0.1; t <= contact; t += 0.005) {
      const arm = fold(samplePose('chop', t, 'warrior').arms.near.upper);
      expect(arm < -30 || arm > 130).toBe(true);
    }
  });
  it('alternates forehand and backhand on repeated slashes', () => {
    const [first, second] = contactTimes('attack', 2);
    const fore = samplePose('attack', first, 'warrior', { hits: 2 }),
      back = samplePose('attack', second, 'warrior', { hits: 2 });
    // The backhand finishes with the sword arm raised well above the forehand.
    expect(fold(back.arms.near.upper)).toBeLessThan(
      fold(fore.arms.near.upper) - 40,
    );
  });
});

describe('impact timing', () => {
  it('lands melee blows after the leap in', () => {
    const [times] = impactTimes('attack', 2, { leap: true });
    expect(times[0]).toBeCloseTo(fixedDuration.dash + strikeTiming.attack.wind);
    const [still] = impactTimes('attack', 2);
    expect(times[1] - still[1]).toBeCloseTo(fixedDuration.dash);
  });
  it('lands ranged blows when the projectile reaches each target', () => {
    const [near, far] = impactTimes('bolt', 1, { ranges: [300, 900] });
    const speed = projectileSpeed.bolt!;
    expect(far[0] - near[0]).toBeCloseTo(600 / speed);
    expect(near[0]).toBeCloseTo(strikeTiming.bolt.wind + 300 / speed);
  });
});

describe('gestures', () => {
  it('begin and end on relaxed idle arms, not the combat guard', () => {
    const idle = samplePose('idle', 0, 'balanced');
    for (const motion of ['salute', 'purchase'] as const)
      for (const t of [0, durationOf(motion)]) {
        const p = samplePose(motion, t, 'balanced');
        expect(p.arms.near.upper).toBeCloseTo(idle.arms.near.upper);
        expect(p.arms.far.lower).toBeCloseTo(idle.arms.far.lower);
      }
  });
});

describe('run cycle', () => {
  const run = (c: number) => samplePose('run', c, 'balanced');
  const contact = (f: Foot) =>
    f.y + (f.toe > 0 ? Math.sin((f.toe * Math.PI) / 180) * 9 : 0);
  it('has a flight phase with both feet off the ground', () => {
    let flying = 0;
    for (let i = 0; i < 200; i++) {
      const p = run(i / 200);
      if (Math.max(contact(p.feet.near), contact(p.feet.far)) < -7 - 1e-6)
        flying++;
    }
    // Two flights of roughly 15% of the cycle each.
    expect(flying / 200).toBeGreaterThan(0.2);
    expect(flying / 200).toBeLessThan(0.4);
  });
  it('sweeps the planted foot at exactly the distance the run covers', () => {
    const step = 1e-4;
    for (const c of [0.05, 0.15, 0.3]) {
      const moved = run(c + step).feet.near.x - run(c).feet.near.x;
      expect(-moved / step).toBeCloseTo(runCycleDistance, 3);
    }
  });
  it('never asks a leg to stretch past its reach', () => {
    for (let i = 0; i < 200; i++) {
      const p = run(i / 200);
      for (const near of [true, false]) {
        const f = near ? p.feet.near : p.feet.far;
        const dx = f.x - hipOffset(p.twist, near),
          dy = f.y - (HIP_HEIGHT + p.y);
        expect(Math.hypot(dx, dy)).toBeLessThan(108);
        expect(solveLeg(dx, dy, 54, 54).shin).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
