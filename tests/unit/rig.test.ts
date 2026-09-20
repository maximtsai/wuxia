import { describe, expect, it } from 'vitest';
import { solveLeg } from '../../src/game/characters/kinematics';
import {
  cycleDistance,
  footRange,
  HIP_HEIGHT,
  hipOffset,
  samplePose,
  type Foot,
} from '../../src/game/characters/poses';

const REACH = 54 + 54;
const walk = (cycle: number, stride = 1) =>
  samplePose('walk', cycle, 'balanced', stride);
const span = (p: ReturnType<typeof walk>, foot: Foot, near: boolean) =>
  Math.hypot(foot.x - hipOffset(p.twist, near), foot.y - (HIP_HEIGHT + p.y));

describe('rig leg placement', () => {
  it('reaches supported foot targets without reversing the knee', () => {
    for (const [x, y] of [
      [20, 102],
      [-20, 102],
      [30, 70],
      [-10, 60],
    ]) {
      const { thigh, shin } = solveLeg(x, y, 54, 54);
      const a = (thigh * Math.PI) / 180,
        b = ((thigh + shin) * Math.PI) / 180;
      expect(-54 * Math.sin(a) - 54 * Math.sin(b)).toBeCloseTo(x);
      expect(54 * Math.cos(a) + 54 * Math.cos(b)).toBeCloseTo(y);
      expect(shin).toBeGreaterThanOrEqual(0);
    }
  });
  it('keeps unreachable and coincident targets finite', () => {
    for (const [x, y] of [
      [0, 0],
      [1000, 1000],
      [0, -1000],
    ]) {
      const angles = solveLeg(x, y, 54, 54);
      expect(Number.isFinite(angles.thigh)).toBe(true);
      expect(Number.isFinite(angles.shin)).toBe(true);
    }
  });
});

describe('walk cycle', () => {
  it('sweeps a planted foot at exactly the distance the cycle covers', () => {
    // Driving the cycle with any other divisor is what made the feet skate.
    for (const stride of [0, 0.5, 1]) {
      const step = 1e-4;
      for (const cycle of [0.1, 0.3, 0.5]) {
        const moved =
          walk(cycle + step, stride).feet.near.x -
          walk(cycle, stride).feet.near.x;
        expect(-moved / step).toBeCloseTo(cycleDistance(stride), 3);
      }
    }
  });
  it('keeps a foot in contact without ever sinking through the floor', () => {
    // Once the foot rolls over the ball, the toe tip is the contact point, not
    // the ankle -- that is what the ankle lift in `step` pays for.
    const contact = (f: Foot) =>
      f.y + (f.toe > 0 ? Math.sin((f.toe * Math.PI) / 180) * 9 : 0);
    for (let i = 0; i < 200; i++) {
      const p = walk(i / 200);
      // Negative y is up, so the planted foot is the lower-lying of the two.
      const points = [contact(p.feet.near), contact(p.feet.far)];
      expect(Math.max(...points)).toBeCloseTo(-7, 9);
      expect(Math.min(...points)).toBeLessThanOrEqual(-7 + 1e-9);
    }
  });
  it('never asks a leg to stretch past its reach', () => {
    for (const stride of [0, 0.5, 1])
      for (let i = 0; i < 100; i++) {
        const p = walk(i / 100, stride);
        expect(span(p, p.feet.near, true)).toBeLessThan(REACH);
        expect(span(p, p.feet.far, false)).toBeLessThan(REACH);
      }
  });
  it('lifts the pelvis over mid-stance and drops it through double support', () => {
    // Negative y is higher. Double support sits at cycle 0 and 0.5; each leg's
    // single-support midpoint is a quarter cycle later.
    expect(walk(0.3).y).toBeLessThan(walk(0).y);
    expect(walk(0.8).y).toBeLessThan(walk(0.5).y);
    expect(Math.abs(walk(0.3).y)).toBeGreaterThan(1);
  });
  it('rolls the foot continuously from toe-off round to heel strike', () => {
    const near = (c: number) => walk(c).feet.near;
    expect(near(0).toe).toBeLessThan(-15); // heel strike, toe up
    expect(Math.abs(near(0.25).toe)).toBeLessThan(1e-9); // flat through mid-stance
    expect(near(0.599).toe).toBeGreaterThan(30); // toe-off over the ball
    for (let i = 1; i < 400; i++)
      expect(
        Math.abs(near(i / 400).toe - near((i - 1) / 400).toe),
      ).toBeLessThan(6);
  });
  it('swings each arm opposite its own leg', () => {
    // Near foot leads at cycle 0, so the near arm must be furthest back there.
    expect(walk(0).arms.near.upper).toBeGreaterThan(walk(0.5).arms.near.upper);
    expect(walk(0).arms.far.upper).toBeLessThan(walk(0.5).arms.far.upper);
    expect(walk(0).feet.near.x).toBeGreaterThan(walk(0.5).feet.near.x);
    // Shoulders counter-rotate against the pelvis rather than tracking it.
    expect(Math.sign(walk(0).twist)).toBe(-Math.sign(walk(0.5).twist));
  });
  it('scales the step with the stride so slow travel takes small steps', () => {
    expect(footRange(0)).toBeLessThan(footRange(1));
    expect(cycleDistance(0)).toBeLessThan(cycleDistance(1));
    expect(cycleDistance(2)).toBe(cycleDistance(1));
  });
});
