import Phaser from 'phaser';
import type { ClassId } from '../../content/phase2';
import {
  characterSkins,
  cycleDistance,
  durationOf,
  HIP_HEIGHT,
  hipOffset,
  runCycleDistance,
  samplePose,
  shoulderOffset,
  blendPose,
  type Foot,
  type LegAngles,
  type Limb,
  type Motion,
  type RigPose,
} from './poses';
import {
  contactTimes,
  impactTimes,
  isStrike,
  melee,
  projectileSpeed,
  travelWindow,
} from './strikes';
import { solveLeg, smooth } from './kinematics';
import { approach, frameSeconds } from '../../core/time';

type Point = { x: number; y: number };
const end = (p: Point, angle: number, length: number): Point => ({
  x: p.x - Math.sin((angle * Math.PI) / 180) * length,
  y: p.y + Math.cos((angle * Math.PI) / 180) * length,
});
const reducedMotion = () =>
  document.documentElement.classList.contains('reduced-motion');

/** Cycles per second the stride scale aims for before the legs run out of reach. */
const TARGET_CADENCE = 1.9;
/** Above this the legs cannot keep up and the feet do skate. */
const MAX_CADENCE = 4.5;
/** Local units per second: break into a run above ON, settle back below OFF. */
const RUN_ON = 330,
  RUN_OFF = 260;
/** Period of the idle breathing sine, used to keep the clock from growing. */
const IDLE_PERIOD = (Math.PI * 2) / 1.8;
/** Seconds to turn around; the figure narrows through side-on as it does. */
const TURN_TIME = 0.16;
/** How long the blade ribbon lingers behind the tip. */
const TRAIL_SECONDS = 0.12;
/** Gestures that give way the moment the character starts moving. */
const GESTURES = new Set<Motion>(['salute', 'purchase']);

/** Screen-space travel of the root during one segment of an action. */
type Travel = {
  to: Point;
  arc: number;
  start: number;
  end: number;
  from?: Point;
};
type Segment = {
  motion: Motion;
  hits?: number;
  travel?: Travel;
  /** Screen distances to each ranged target, for drawing projectiles. */
  ranges?: number[];
  /** Overrides the motion's own length, for held poses such as a rest. */
  duration?: number;
};

/** Procedural stick skeleton. The public interface is shared by combat and travel. */
export class HumanoidRig {
  readonly root: Phaser.GameObjects.Container;
  private shade: Phaser.GameObjects.Ellipse;
  private ink: Phaser.GameObjects.Graphics;
  private motion: Motion = 'idle';
  private hits = 1;
  private travel: Travel | undefined;
  private ranges: number[] = [];
  private span: number | undefined;
  private queue: Segment[] = [];
  private armed = false;
  private elapsed = 0;
  private clock = 0;
  private walkClock = 0;
  private stride = 0.85;
  private speed = 0;
  private running = false;
  private pending: { delay: number; run: () => void }[] = [];
  private origin: ClassId = 'balanced';
  private facing = 1;
  private turn = { from: 1, age: Infinity };
  private placed = false;
  private back = false;
  private walking = false;
  private distance = 0;
  private dead = false;
  private weapon = 'starter';
  private base = { x: 0, y: 0, depth: 10 };
  private offset: Point = { x: 0, y: 0 };
  private lift = 0;
  /** Blade-tip ribbon; points expire by age, not by frame count. */
  private trail: (Point & { at: number })[] = [];
  /** Monotonic seconds since this rig was built, for age-based effects. */
  private age = 0;
  private displayed = samplePose('idle', 0, 'balanced');
  private blendFrom = this.displayed;
  private blendAge = 1;
  private blendTime = 0.24;
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
  /** Where the character stands when not mid-action, in screen space. */
  get home(): Point {
    return { x: this.base.x, y: this.base.y };
  }
  place(
    x: number,
    y: number,
    scale: number,
    facing = this.facing,
    back = false,
  ) {
    this.base = { x, y, depth: 10 + y / 1000 };
    this.root.setScale(scale);
    this.applyRoot();
    // Turning around is animated; the first placement just faces the way given.
    if (facing !== this.facing && this.placed)
      this.turn = { from: this.ink.scaleX, age: 0 };
    else if (!this.placed) this.ink.setScale(facing, 1);
    this.placed = true;
    this.facing = facing;
    this.back = back;
  }
  locomotion(walking: boolean, distance?: number) {
    this.walking = walking;
    // Actual travel controls the stride, including diagonal motion; room jumps do not.
    this.distance +=
      walking && distance !== undefined ? distance / this.root.scaleX : 0;
    if (walking && (GESTURES.has(this.motion) || this.span !== undefined)) {
      this.queue = [];
      this.settle();
    }
  }
  play(motion: Motion, delay = 0) {
    if (delay) {
      this.pending.push({ delay, run: () => this.play(motion) });
      return;
    }
    // Interrupted away from home (hit mid-action): react, then hop back.
    const away = this.offset.x !== 0 || this.offset.y !== 0;
    this.start(
      away && motion !== 'defeat'
        ? [{ motion }, this.homeward()]
        : [{ motion }],
    );
  }
  /** Keep a looping motion such as `meditate` without restarting it each frame. */
  hold(motion: Motion) {
    if (this.motion !== motion) this.play(motion);
  }
  /** Sit and breathe for `seconds`, then stand again. */
  rest(seconds: number) {
    this.start([{ motion: 'meditate', duration: seconds }]);
  }
  /**
   * Runs a combat action: melee leaps to `reach` (screen offset to the stand-off
   * point), strikes, and hops home; ranged motions fire from where they stand.
   * Returns when each blow lands, in seconds from now, per entry of `ranges`
   * (or a single list for melee).
   */
  perform(
    motion: Motion,
    {
      hits = 1,
      reach,
      ranges = [],
    }: { hits?: number; reach?: Point; ranges?: number[] } = {},
  ): number[][] {
    const leap =
      melee.has(motion) &&
      reach &&
      !reducedMotion() &&
      Math.hypot(reach.x, reach.y) > 30
        ? reach
        : undefined;
    const away = this.offset.x !== 0 || this.offset.y !== 0;
    const segments: Segment[] = [];
    if (leap)
      segments.push({
        motion: 'dash',
        travel: { to: leap, ...travelWindow.dash },
      });
    segments.push({ motion, hits, ranges });
    if (leap || away) segments.push(this.homeward());
    this.start(segments);
    return isStrike(motion)
      ? impactTimes(motion, hits, { leap: !!leap, ranges })
      : [];
  }
  /** True while anything is still playing out, so turns can wait for it. */
  busy() {
    const d = this.duration();
    return (
      this.pending.length > 0 ||
      this.queue.length > 0 ||
      this.offset.x !== 0 ||
      this.offset.y !== 0 ||
      (Number.isFinite(d) && this.elapsed < d)
    );
  }
  setDead(dead: boolean) {
    // Fall after the last blow already on its way, not before it lands.
    if (dead && !this.dead)
      this.play(
        'defeat',
        Math.max(0.3, ...this.pending.map((p) => p.delay + 0.25)),
      );
    if (!dead && this.dead) {
      this.pending = [];
      this.play('idle');
    }
    this.dead = dead;
  }
  private homeward(): Segment {
    return {
      motion: 'retreat',
      travel: { to: { x: 0, y: 0 }, ...travelWindow.retreat },
    };
  }
  private duration() {
    return this.span ?? durationOf(this.motion, this.hits);
  }
  private start(segments: Segment[]) {
    this.armed = segments.some((s) => melee.has(s.motion));
    this.trail = [];
    this.queue = segments.slice(1);
    this.begin(segments[0]);
  }
  private begin(segment: Segment) {
    this.blend(segment.motion);
    this.motion = segment.motion;
    this.hits = segment.hits ?? 1;
    this.span = segment.duration;
    this.ranges = segment.ranges ?? [];
    this.travel = segment.travel && {
      ...segment.travel,
      from: segment.travel.from ?? { ...this.offset },
    };
    this.elapsed = 0;
  }
  private settle() {
    if (this.travel) this.offset = { ...this.travel.to };
    this.motion = 'idle';
    this.hits = 1;
    this.span = undefined;
    this.travel = undefined;
    this.ranges = [];
    this.armed = false;
  }
  private blend(to: Motion) {
    const from = this.lastMotion;
    this.blendFrom = this.displayed;
    this.blendAge = 0;
    this.blendTime =
      from === 'meditate' || to === 'meditate'
        ? 0.45
        : to === 'hit'
          ? 0.07
          : to === 'walk' || to === 'idle' || to === 'run'
            ? 0.24
            : 0.14;
    this.lastMotion = to;
  }
  private retargetStride(speed: number, dt: number) {
    const floor = cycleDistance(0),
      span = cycleDistance(1) - floor;
    const wanted = (speed / TARGET_CADENCE - floor) / span;
    this.stride +=
      (Math.max(0, Math.min(1, wanted)) - this.stride) * approach(dt, 6);
  }
  /** Fixed hip and knee angles for a pose, so seated and standing poses blend. */
  private withLegs(p: RigPose): RigPose {
    if (p.legs) return p;
    const hipY = HIP_HEIGHT + p.y;
    const solve = (foot: Foot, near: boolean) =>
      solveLeg(
        foot.x - (p.x + hipOffset(p.twist, near)),
        foot.y - hipY,
        54,
        54,
      );
    return {
      ...p,
      legs: { near: solve(p.feet.near, true), far: solve(p.feet.far, false) },
    };
  }
  private applyRoot() {
    const away = this.offset.x !== 0 || this.offset.y !== 0;
    this.root
      .setPosition(
        this.base.x + this.offset.x,
        this.base.y + this.offset.y - this.lift * this.root.scaleY,
      )
      .setDepth(this.base.depth + (away ? 0.5 : 0));
  }
  tick(delta: number) {
    const dt = frameSeconds(delta);
    this.age += dt;
    this.clock = (this.clock + dt) % IDLE_PERIOD;
    this.elapsed += dt;
    this.pending.forEach((p) => (p.delay -= dt));
    const due = this.pending.filter((p) => p.delay <= 0);
    this.pending = this.pending.filter((p) => p.delay > 0);
    due.forEach((p) => p.run());
    while (this.queue.length && this.elapsed >= this.duration()) {
      const over = this.elapsed - this.duration();
      this.begin(this.queue.shift()!);
      this.elapsed = over;
    }
    if (this.motion !== 'defeat' && this.elapsed >= this.duration())
      this.settle();
    if (this.travel) {
      const { from, to, start, end, arc } = this.travel;
      const u = Math.max(
        0,
        Math.min(1, (this.elapsed / this.duration() - start) / (end - start)),
      );
      const e = smooth(u);
      this.offset = {
        x: from!.x + (to.x - from!.x) * e,
        y: from!.y + (to.y - from!.y) * e,
      };
      this.lift = u > 0 && u < 1 ? Math.sin(u * Math.PI) * arc : 0;
    } else this.lift = 0;
    this.applyRoot();
    this.turn.age += dt;
    const turned = reducedMotion() ? 1 : smooth(this.turn.age / TURN_TIME);
    this.ink.setScale(
      this.turn.from + (this.facing - this.turn.from) * turned,
      1,
    );

    // Pick the gait from smoothed travel speed, with hysteresis so it does not
    // flicker between walking and running at the threshold.
    if (this.walking && dt > 0)
      this.speed += (this.distance / dt - this.speed) * approach(dt, 8);
    else if (!this.walking) this.speed = 0;
    if (this.running ? this.speed < RUN_OFF : this.speed > RUN_ON)
      this.running = !this.running;
    const motion =
      this.motion === 'idle' && this.walking
        ? this.running
          ? 'run'
          : 'walk'
        : this.motion;
    // Workshop gaits run in place; world travel advances one cycle per cycle
    // distance travelled, which is what keeps the planted foot still.
    if (motion === 'walk' || motion === 'run') {
      if (this.walking) {
        if (motion === 'walk' && dt > 0)
          this.retargetStride(this.distance / dt, dt);
        const cycle =
          motion === 'run' ? runCycleDistance : cycleDistance(this.stride);
        this.walkClock += Math.min(this.distance / cycle, dt * MAX_CADENCE);
      } else this.walkClock += dt * (motion === 'run' ? 2.5 : 1);
      this.walkClock %= 1;
    }
    this.distance = 0;
    if (motion !== this.lastMotion) this.blend(motion);
    this.blendAge += dt;
    const target = samplePose(
      motion,
      motion === 'walk' || motion === 'run'
        ? this.walkClock
        : motion === 'idle' || motion === 'meditate'
          ? this.clock
          : this.elapsed,
      this.origin,
      { stride: this.stride, hits: this.hits },
    );
    const weight = smooth(this.blendAge / this.blendTime);
    // A seated pose sets its leg angles directly; give the other side of the
    // blend explicit angles too, or the legs would snap instead of folding.
    const folding = weight < 1 && (!!this.blendFrom.legs || !!target.legs);
    const p = blendPose(
      folding ? this.withLegs(this.blendFrom) : this.blendFrom,
      folding ? this.withLegs(target) : target,
      weight,
    );
    if (reducedMotion()) {
      // Hold a legible mid-stride contact rather than gliding in the idle pose.
      if (motion === 'walk' || motion === 'run' || motion === 'idle')
        Object.assign(
          p,
          samplePose(motion === 'run' ? 'walk' : motion, 0, this.origin, {
            stride: this.stride,
          }),
        );
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
      rear = 0x30383d;
    const accent = characterSkins[this.origin].cloth,
      light = characterSkins[this.origin].accent;
    const stroke = (a: Point, b: Point, width: number, color = black) => {
      g.lineStyle(width, color, 1).lineBetween(a.x, a.y, b.x, b.y);
      g.fillStyle(color, 1)
        .fillCircle(a.x, a.y, width / 2)
        .fillCircle(b.x, b.y, width / 2);
    };
    // The contact shadow stays on the ground under a leap, shrinking and
    // fading with height; hips dropping toward the floor spread and darken it.
    const height = Math.min(1, this.lift / 110);
    this.shade
      .setPosition(p.x * 0.4, 1 + this.lift)
      .setScale((1 + p.y * 0.004) * (1 - height * 0.35), 1 - height * 0.2)
      .setAlpha(
        Math.max(0.08, 0.22 + p.y * 0.0016) * p.alpha * (1 - height * 0.5),
      );
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
    const leg = (
      hip: Point,
      foot: Foot,
      width: number,
      color: number,
      fixed?: LegAngles,
    ) => {
      const angles = fixed ?? solveLeg(foot.x - hip.x, foot.y - hip.y, 54, 54);
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
    leg(farHip, p.feet.far, 11, rear, p.legs?.far);
    const backHand = arm(farShoulder, p.arms.far, 10, rear);
    stroke(farHip, nearHip, 13, body);
    leg(nearHip, p.feet.near, 13, black, p.legs?.near);
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
    let tip: Point | undefined;
    if (p.bottle) {
      g.fillStyle(accent).fillRoundedRect(hand.x - 6, hand.y - 10, 12, 18, 3);
      g.fillStyle(0xf5e7cc).fillRect(hand.x - 3, hand.y - 14, 6, 5);
    } else if (this.armed && this.weapon !== 'none' && !p.palm) {
      tip = end(hand, p.wrist + p.arms.near.upper + p.arms.near.lower, 65);
      stroke(hand, tip, 5, accent);
    }
    // The blade leaves a short fading ribbon through each blow, which reads as
    // the arc of a slash, the line of a thrust or the fall of a chop.
    if (tip && p.slash > 0.05) {
      this.trail.push({ ...tip, at: this.age });
    }
    // The ribbon always covers the same span of time, at any frame rate.
    this.trail = this.trail.filter((v) => this.age - v.at <= TRAIL_SECONDS);
    if (this.trail.length > 1) {
      for (let i = 1; i < this.trail.length; i++) {
        const f = 1 - (this.age - this.trail[i].at) / TRAIL_SECONDS;
        g.lineStyle(2 + 5 * f, light, 0.75 * f).lineBetween(
          this.trail[i - 1].x,
          this.trail[i - 1].y,
          this.trail[i].x,
          this.trail[i].y,
        );
      }
    }
    if (p.glow > 0) {
      g.lineStyle(3, light, p.glow);
      g.beginPath();
      g.moveTo(backHand.x, backHand.y);
      g.lineTo((hand.x + backHand.x) / 2, Math.min(hand.y, backHand.y) - 15);
      g.lineTo(hand.x, hand.y);
      g.strokePath();
      g.fillStyle(accent, p.glow * 0.3).fillCircle(hand.x, hand.y, 17);
    }
    this.drawShots(g, light);
  }
  /** Blades, qi bolts and ground waves in flight toward their targets. */
  private drawShots(g: Phaser.GameObjects.Graphics, color: number) {
    const motion = this.motion;
    if (!isStrike(motion) || !this.ranges.length) return;
    const speed = projectileSpeed[motion];
    if (!speed) return;
    const scale = this.root.scaleX;
    // One ground wave covers every target in its path.
    const ranges =
      motion === 'burst' ? [Math.max(...this.ranges)] : this.ranges;
    const launch =
      motion === 'burst' ? { x: 30, y: 0 } : { x: 48, y: HIP_HEIGHT - 50 };
    contactTimes(motion, this.hits).forEach((c, k) =>
      ranges.forEach((r) => {
        const f = (this.elapsed - c) / (r / speed);
        if (f < 0 || f > 1) return;
        const x = launch.x + (r / scale - launch.x) * f,
          y = launch.y;
        if (motion === 'throw') {
          const spin = this.elapsed * 28 + k;
          g.lineStyle(3, 0xd8dde2, 1);
          for (let j = 0; j < 4; j++) {
            const a = spin + (j * Math.PI) / 2;
            g.lineBetween(x, y, x + Math.cos(a) * 10, y + Math.sin(a) * 10);
          }
          g.fillStyle(0x101316, 1).fillCircle(x, y, 3);
        } else if (motion === 'bolt') {
          g.lineStyle(5, color, 0.35).lineBetween(x - 34, y, x, y);
          g.fillStyle(color, 0.25).fillCircle(x, y, 17);
          g.fillStyle(color, 1).fillCircle(x, y, 8);
        } else {
          g.lineStyle(6, color, 1 - f * 0.6);
          g.beginPath();
          g.arc(x - 34, -30, 44, -0.9, 0.9);
          g.strokePath();
          g.lineStyle(3, color, 0.4 * (1 - f)).lineBetween(x - 70, -2, x, -2);
        }
      }),
    );
  }
  destroy() {
    this.pending = [];
    this.root.destroy(true);
  }
}
