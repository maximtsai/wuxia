import Phaser from 'phaser';
import type { ClassId } from '../../content/phase2';
import {
  characterSkins,
  cycleDistance,
  HIP_HEIGHT,
  hipOffset,
  motionDuration,
  samplePose,
  shoulderOffset,
  blendPose,
  type Foot,
  type Limb,
  type Motion,
  type RigPose,
} from './poses';
import { solveLeg, smooth } from './kinematics';

type Point = { x: number; y: number };
const end = (p: Point, angle: number, length: number): Point => ({
  x: p.x - Math.sin((angle * Math.PI) / 180) * length,
  y: p.y + Math.cos((angle * Math.PI) / 180) * length,
});

/** Cycles per second the stride scale aims for before the legs run out of reach. */
const TARGET_CADENCE = 1.9;
/** Above this the legs cannot keep up and the feet do skate; a run gait would. */
const MAX_CADENCE = 4.5;
/** Period of the idle breathing sine, used to keep the clock from growing. */
const IDLE_PERIOD = (Math.PI * 2) / 1.8;

/** Procedural stick skeleton. The public interface is shared by combat and travel. */
export class HumanoidRig {
  readonly root: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.Ellipse;
  private ink: Phaser.GameObjects.Graphics;
  private motion: Motion = 'idle';
  private elapsed = 0;
  private clock = 0;
  private walkClock = 0;
  private stride = 0.85;
  private pending: { motion: Motion; delay: number }[] = [];
  private origin: ClassId = 'balanced';
  private facing = 1;
  private back = false;
  private walking = false;
  private distance = 0;
  private dead = false;
  private weapon = 'starter';
  private displayed = samplePose('idle', 0, 'balanced');
  private blendFrom = this.displayed;
  private blendAge = 1;
  private lastMotion: Motion = 'idle';

  constructor(scene: Phaser.Scene) {
    this.root = scene.add.container(0, 0).setDepth(10);
    this.shade = scene.add.ellipse(0, 1, 75, 13, 0x080d13, 0.22);
    this.root.add(this.shade);
    this.ink = scene.add.graphics();
    this.root.add(this.ink);
    this.tick(0);
  }
  setSkin(origin: ClassId) {
    this.origin = origin;
  }
  setWeapon(id: string) {
    this.weapon = id;
  }
  place(
    x: number,
    y: number,
    scale: number,
    facing = this.facing,
    back = false,
  ) {
    this.root
      .setPosition(x, y)
      .setScale(scale)
      .setDepth(10 + y / 1000);
    this.facing = facing;
    this.back = back;
    this.ink.setScale(facing, 1);
  }
  locomotion(walking: boolean, distance?: number) {
    this.walking = walking;
    // Actual travel controls the stride, including diagonal motion; room jumps do not.
    this.distance +=
      walking && distance !== undefined ? distance / this.root.scaleX : 0;
  }
  play(motion: Motion, delay = 0) {
    if (delay) {
      this.pending.push({ motion, delay });
      return;
    }
    this.blendFrom = this.displayed;
    this.blendAge = 0;
    this.lastMotion = motion;
    this.motion = motion;
    this.elapsed = 0;
  }
  setDead(dead: boolean) {
    if (dead && !this.dead) this.play('defeat', 0.3);
    if (!dead && this.dead) {
      this.pending = [];
      this.play('idle');
    }
    this.dead = dead;
  }
  /**
   * Longest step the legs can take at this speed, so slow travel takes small
   * steps and fast travel opens up rather than just churning faster.
   */
  private retargetStride(speed: number, dt: number) {
    const floor = cycleDistance(0),
      span = cycleDistance(1) - floor;
    const wanted = (speed / TARGET_CADENCE - floor) / span;
    this.stride +=
      (Math.max(0, Math.min(1, wanted)) - this.stride) * Math.min(1, dt * 6);
  }
  tick(delta: number) {
    const dt = Math.min(delta, 50) / 1000;
    this.clock = (this.clock + dt) % IDLE_PERIOD;
    this.elapsed += dt;
    this.pending.forEach((p) => (p.delay -= dt));
    const due = this.pending.filter((p) => p.delay <= 0);
    this.pending = this.pending.filter((p) => p.delay > 0);
    due.forEach((p) => this.play(p.motion));
    if (this.motion !== 'defeat' && this.elapsed >= motionDuration[this.motion])
      this.motion = 'idle';
    const motion =
      this.motion === 'idle' && this.walking ? 'walk' : this.motion;
    // Workshop walk runs in place; world walking advances one cycle per
    // `cycleDistance` travelled, which is what keeps the planted foot still.
    if (motion === 'walk') {
      if (this.walking) {
        if (dt > 0) this.retargetStride(this.distance / dt, dt);
        this.walkClock += Math.min(
          this.distance / cycleDistance(this.stride),
          dt * MAX_CADENCE,
        );
      } else this.walkClock += dt;
      this.walkClock %= 1;
    }
    this.distance = 0;
    if (motion !== this.lastMotion) {
      this.blendFrom = this.displayed;
      this.blendAge = 0;
      this.lastMotion = motion;
    }
    this.blendAge += dt;
    const target = samplePose(
      motion,
      motion === 'walk'
        ? this.walkClock
        : motion === 'idle'
          ? this.clock
          : this.elapsed,
      this.origin,
      this.stride,
    );
    const p = blendPose(
      this.blendFrom,
      target,
      smooth(
        this.blendAge /
          (motion === 'hit'
            ? 0.07
            : motion === 'walk' || motion === 'idle'
              ? 0.24
              : 0.14),
      ),
    );
    if (document.documentElement.classList.contains('reduced-motion')) {
      // Hold a legible mid-stride contact rather than gliding in the idle pose.
      if (motion === 'walk' || motion === 'idle')
        Object.assign(p, samplePose(motion, 0, this.origin, this.stride));
      p.cloth = p.slash = p.glow = 0;
    }
    this.displayed = p;
    this.draw(p);
  }
  private draw(p: RigPose) {
    const g = this.ink.clear().setAlpha(p.alpha);
    // Three ink values read as depth: near limbs darkest, torso a step lighter
    // so an overlapping near arm still shows a seam, far limbs lightest.
    const black = 0x101316,
      body = 0x232a31,
      rear = 0x3a4348;
    const accent = characterSkins[this.origin].cloth;
    const stroke = (a: Point, b: Point, width: number, color = black) => {
      g.lineStyle(width, color, 1).lineBetween(a.x, a.y, b.x, b.y);
      g.fillStyle(color, 1)
        .fillCircle(a.x, a.y, width / 2)
        .fillCircle(b.x, b.y, width / 2);
    };
    // Hips lower the body toward the ground as it collapses, so the contact
    // shadow spreads and darkens; a lunge drags it part of the way along.
    this.shade
      .setPosition(p.x * 0.4, 1)
      .setScale(1 + p.y * 0.004, 1)
      .setAlpha(Math.max(0.08, 0.22 + p.y * 0.0016) * p.alpha);
    const hips = { x: p.x, y: HIP_HEIGHT + p.y };
    const chest = end(hips, 180 + p.lean, 26);
    const shoulder = end(chest, 180 + p.lean + p.spine, 28 + p.breath);
    const head = end(shoulder, 180 + p.lean + p.spine + p.head, 34);
    const nearHip = { x: hips.x + hipOffset(p.twist, true), y: hips.y };
    const farHip = { x: hips.x + hipOffset(p.twist, false), y: hips.y };
    const nearShoulder = {
      x: shoulder.x + shoulderOffset(p.twist, true),
      y: shoulder.y,
    };
    const farShoulder = {
      x: shoulder.x + shoulderOffset(p.twist, false),
      y: shoulder.y,
    };
    const leg = (hip: Point, foot: Foot, width: number, color: number) => {
      const angles = solveLeg(foot.x - hip.x, foot.y - hip.y, 54, 54);
      const knee = end(hip, angles.thigh, 54);
      const ankle = end(knee, angles.thigh + angles.shin, 54);
      stroke(hip, knee, width, color);
      stroke(knee, ankle, width, color);
      // `toe` is degrees of plantarflexion about the ankle: positive points down.
      const toe = (foot.toe * Math.PI) / 180;
      stroke(
        ankle,
        { x: ankle.x + Math.cos(toe) * 9, y: ankle.y + Math.sin(toe) * 9 },
        width - 1,
        color,
      );
    };
    const arm = (origin: Point, limb: Limb, width: number, color: number) => {
      const elbow = end(origin, limb.upper + p.lean, 35);
      const hand = end(elbow, limb.upper + limb.lower + p.lean, 33);
      stroke(origin, elbow, width, color);
      stroke(elbow, hand, width, color);
      g.fillStyle(color, 1).fillCircle(hand.x, hand.y, width * 0.66);
      return hand;
    };
    leg(farHip, p.feet.far, 11, rear);
    const backHand = arm(farShoulder, p.arms.far, 10, rear);
    stroke(farHip, nearHip, 13, body);
    leg(nearHip, p.feet.near, 13, black);
    stroke(hips, chest, 18, body);
    stroke(chest, shoulder, 17, body);
    stroke(shoulder, head, 9, body);
    const hand = arm(nearShoulder, p.arms.near, 12, black);
    g.fillStyle(black, 1).fillCircle(head.x, head.y, 21);
    // Small accessories carry class color without turning the silhouette into clothing.
    stroke(
      { x: head.x - 19, y: head.y - 3 },
      { x: head.x + 19, y: head.y - 1 },
      7,
      accent,
    );
    const flutter = p.cloth;
    stroke(
      { x: head.x - 17, y: head.y },
      { x: head.x - 42, y: head.y + 7 + flutter },
      4,
      accent,
    );
    stroke(
      { x: head.x - 17, y: head.y },
      { x: head.x - 37, y: head.y + 17 - flutter },
      3,
      accent,
    );
    stroke(
      { x: hips.x - 8, y: hips.y - 4 },
      { x: hips.x + 8, y: hips.y - 4 },
      8,
      accent,
    );
    stroke(hips, { x: hips.x - 25, y: hips.y + 16 + flutter }, 5, accent);
    if (this.back) g.fillStyle(accent).fillCircle(head.x - 15, head.y, 4);
    if (p.bottle) {
      g.fillStyle(accent).fillRoundedRect(hand.x - 6, hand.y - 10, 12, 18, 3);
      g.fillStyle(0xf5e7cc).fillRect(hand.x - 3, hand.y - 14, 6, 5);
    } else if (
      this.weapon !== 'none' &&
      !p.palm &&
      !this.walking &&
      this.motion === 'attack'
    ) {
      stroke(
        hand,
        end(hand, p.wrist + p.arms.near.upper + p.arms.near.lower, 65),
        5,
        accent,
      );
    }
    if (p.glow > 0) {
      g.lineStyle(3, characterSkins[this.origin].accent, p.glow);
      g.beginPath();
      g.moveTo(backHand.x, backHand.y);
      g.lineTo((hand.x + backHand.x) / 2, Math.min(hand.y, backHand.y) - 15);
      g.lineTo(hand.x, hand.y);
      g.strokePath();
      g.fillStyle(accent, p.glow * 0.3).fillCircle(hand.x, hand.y, 17);
    }
    if (p.slash > 0) {
      g.lineStyle(4, accent, p.slash);
      g.beginPath();
      g.arc(hand.x, hand.y, 36, -1.1, 1.1);
      g.strokePath();
    }
  }
  destroy() {
    this.pending = [];
    this.root.destroy(true);
  }
}
