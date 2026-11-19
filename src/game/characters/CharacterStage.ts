import type Phaser from 'phaser';
import type { Battle, Session } from '../../core/types';
import type { CombatEvent } from '../../core/combat/events';
import { skills, type SkillId } from '../../content/phase2';
import { interactables } from '../../content/world';
import { HumanoidRig } from './HumanoidRig';
import type { Motion } from './poses';
import { isStrike, melee } from './strikes';
import { frameSeconds } from '../../core/time';

/**
 * How each action looks. Player skills are keyed by id, enemy intents by
 * name; anything unlisted falls back on the skill's kind.
 */
const actionMotions: Record<string, Motion> = {
  attack: 'attack',
  stab: 'thrust',
  shuriken: 'throw',
  doubleStrike: 'attack',
  speedStrike: 'thrust',
  energyShot: 'bolt',
  blastFire: 'burst',
  verticalStrike: 'chop',
  manaBomb: 'burst',
  avenger: 'attack',
  split: 'chop',
  shadowStrike: 'bolt',
  annihilate: 'bolt',
  execution: 'attack',
  Strike: 'attack',
  'Retargeted strike': 'attack',
  'Heavy strike': 'chop',
  'Burning bolt': 'bolt',
  'Silencing hex': 'bolt',
  'Mend ally': 'qi',
  'Brace shield': 'guard',
};
function motionFor(actionId: string): Motion {
  if (actionId.startsWith('potion')) return 'drink';
  if (actionMotions[actionId]) return actionMotions[actionId];
  const kind = skills[actionId as SkillId]?.kind;
  if (kind === 'magic') return 'bolt';
  if (kind === 'support') return 'qi';
  return actionId.toLowerCase().includes('guard') ? 'guard' : 'attack';
}
/** Melee stops this far short of the target, in rig units: one blade's reach. */
const STAND_OFF = 140;
type Impact = Extract<CombatEvent, { type: 'damage' | 'attack-avoided' }>;

/** Presentation only: consumes event IDs, never mutates combat or save state. */
export class CharacterStage {
  private actors = new Map<string, HumanoidRig>();
  private battle: Battle | null = null;
  private sequence = 0;
  private previous = { x: 0, y: 0 };
  private clock = 0;
  /** Damage already resolved in combat but not yet landed on screen. */
  private landing: { id: string; amount: number; at: number }[] = [];
  private room = '';
  private face = 1;
  private back = false;
  constructor(private scene: Phaser.Scene) {}
  private actor(id: string) {
    let rig = this.actors.get(id);
    if (!rig) {
      rig = new HumanoidRig(this.scene);
      this.actors.set(id, rig);
    }
    return rig;
  }
  sync(s: Session) {
    if (s.battle !== this.battle) {
      this.actors.forEach((r) => r.destroy());
      this.actors.clear();
      this.battle = s.battle;
      this.sequence = 0;
      this.landing = [];
    }
    const visible = new Set<string>();
    const show = (id: string) => {
      visible.add(id);
      return this.actor(id);
    };
    if (s.player.classId) {
      const player = show('player');
      player.setSkin(s.player.classId);
      player.setWeapon(s.player.weapon);
      if (s.battle) {
        const b = s.battle;
        player.place(325, 620, 1.05, 1);
        player.locomotion(false);
        b.enemies.forEach((e, i) => {
          const rig = show(e.id);
          rig.setSkin(
            e.behavior === 'caster' || e.behavior === 'healer'
              ? 'caster'
              : e.behavior === 'ward'
                ? 'balanced'
                : 'warrior',
          );
          rig.place(
            b.enemies.length === 1 ? 1170 : 960 + i * 360,
            620,
            1.05,
            -1,
          );
        });
        if (b.shadow) {
          const shadow = show('shadow');
          shadow.setSkin('shadow');
          shadow.place(515, 650, 0.8, 1);
          shadow.root.setAlpha(0.55);
        }
        this.consume(b.events.filter((e) => e.sequence > this.sequence));
        player.setDead(s.player.life <= 0);
        b.enemies.forEach((e) => this.actors.get(e.id)?.setDead(e.life <= 0));
        if (b.shadow) this.actors.get('shadow')?.setDead(b.shadow.life <= 0);
      } else {
        const dx = s.position.x - this.previous.x,
          dy = s.position.y - this.previous.y;
        const moving = this.room === s.world.room && Math.hypot(dx, dy) > 0.05;
        if (moving) {
          if (Math.abs(dx) > 0.05) this.face = dx < 0 ? -1 : 1;
          this.back = dy < -Math.abs(dx);
        }
        player.place(s.position.x, s.position.y, 0.62, this.face, this.back);
        player.locomotion(moving, moving ? Math.hypot(dx, dy) : 0);
        player.setDead(false);
        for (const o of interactables[s.world.room])
          o.figures?.forEach((f, i) => {
            const npc = show(o.id + i);
            npc.setSkin(
              o.id === 'food-seller'
                ? 'shadow'
                : o.id === 'potion-seller'
                  ? 'caster'
                  : 'balanced',
            );
            npc.setWeapon('none');
            // Paired figures face each other; lone NPCs face the player's side.
            npc.place(f.x, f.y, 0.6, f.x > o.x ? -1 : f.x < o.x ? 1 : -1);
            npc.hold(o.pose ?? 'idle');
          });
      }
    }
    this.actors.forEach((rig, id) => rig.root.setVisible(visible.has(id)));
    this.previous = { ...s.position };
    this.room = s.world.room;
  }
  /**
   * Plays a batch of combat events. One action arrives with all of its blows,
   * so each blow's reaction is scheduled for the moment it visibly lands.
   */
  private consume(events: CombatEvent[]) {
    let settled = 0;
    const handled = new Set<CombatEvent>();
    events.forEach((event, i) => {
      this.sequence = event.sequence;
      if (event.type === 'action-used') {
        const impacts: Impact[] = [];
        for (const next of events.slice(i + 1)) {
          if (
            next.type === 'action-used' ||
            next.type === 'turn-started' ||
            next.type === 'battle-ended'
          )
            break;
          if (next.type === 'damage' || next.type === 'attack-avoided') {
            impacts.push(next);
            handled.add(next);
          }
        }
        settled = Math.max(settled, this.act(event, impacts));
      } else if (!handled.has(event)) {
        // Blows outside an action, such as burn ticks, follow whatever landed.
        if (event.type === 'damage')
          this.actors.get(event.targetId)?.play('hit', settled + 0.1);
        if (event.type === 'attack-avoided')
          this.actors.get(event.targetId)?.play('guard', settled + 0.05);
      }
    });
  }
  /** Starts one action and schedules its targets' reactions; returns the last. */
  private act(
    event: Extract<CombatEvent, { type: 'action-used' }>,
    impacts: Impact[],
  ) {
    const actor = this.actors.get(event.actorId);
    if (!actor) return 0;
    const motion = motionFor(event.actionId);
    const ids = [
      ...new Set([...event.targetIds, ...impacts.map((e) => e.targetId)]),
    ].filter((id) => id !== event.actorId && this.actors.has(id));
    const blows = ids.map((id) => impacts.filter((e) => e.targetId === id));
    if (!isStrike(motion)) {
      actor.play(motion);
      blows.flat().forEach((e) => this.react(e, 0.24));
      return blows.length ? 0.24 : 0;
    }
    const hits = Math.max(1, ...blows.map((list) => list.length));
    const from = actor.home,
      homes = ids.map((id) => this.actors.get(id)!.home);
    const first = homes[0];
    const reach =
      first && melee.has(motion)
        ? {
            x:
              Math.sign(first.x - from.x) *
              Math.max(
                0,
                Math.abs(first.x - from.x) - STAND_OFF * actor.root.scaleX,
              ),
            y: first.y - from.y,
          }
        : undefined;
    const ranged = !melee.has(motion);
    const times = actor.perform(motion, {
      hits,
      reach,
      ranges: ranged ? homes.map((h) => Math.abs(h.x - from.x)) : [],
    });
    let last = 0;
    blows.forEach((list, i) => {
      const lands = times[ranged ? i : 0] ?? [];
      list.forEach((e, k) => {
        const t = lands[Math.min(k, lands.length - 1)] ?? 0.24;
        this.react(e, t);
        last = Math.max(last, t);
      });
    });
    return last;
  }
  private react(event: Impact, at: number) {
    const target = this.actors.get(event.targetId);
    // A dodge or block has to be up before the blow arrives.
    if (event.type === 'attack-avoided')
      target?.play('guard', Math.max(0.01, at - 0.12));
    else {
      target?.play('hit', Math.max(0.01, at));
      this.landing.push({
        id: event.targetId,
        amount: event.amount,
        at: this.clock + at,
      });
    }
  }
  /**
   * Life a fighter has lost in combat but not yet on screen, so the readout can
   * hold its old value until the blow that takes it actually lands.
   */
  pendingLife(id: string) {
    return this.landing
      .filter((v) => v.id === id)
      .reduce((total, v) => total + v.amount, 0);
  }
  /** True while blows are still in flight or bodies are still moving. */
  settling() {
    return this.landing.length > 0 || this.busy();
  }
  /** Out-of-combat gestures for the player: greetings, purchases and rest. */
  gesture(kind: 'salute' | 'purchase' | 'rest') {
    const player = this.actors.get('player');
    if (!player) return;
    if (kind === 'rest') player.rest(1.8);
    else player.perform(kind);
  }
  /** True while any visible character is still mid-animation. */
  busy() {
    return [...this.actors.values()].some(
      (rig) => rig.root.visible && rig.busy(),
    );
  }
  tick(delta: number) {
    // The same clamped step the rigs advance by, so a landing readout and the
    // blow that causes it stay together when frames run long.
    this.clock += frameSeconds(delta);
    this.landing = this.landing.filter((v) => v.at > this.clock);
    this.actors.forEach((r) => r.tick(delta));
  }
  destroy() {
    this.actors.forEach((r) => r.destroy());
    this.actors.clear();
  }
}
