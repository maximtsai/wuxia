import type Phaser from 'phaser';
import type { Battle, Session } from '../../core/types';
import { skills, type SkillId } from '../../content/phase2';
import { HumanoidRig } from './HumanoidRig';
import type { Motion } from './poses';

/** Presentation only: consumes event IDs, never mutates combat or save state. */
export class CharacterStage {
  private actors = new Map<string, HumanoidRig>();
  private battle: Battle | null = null;
  private sequence = 0;
  private previous = { x: 0, y: 0 };
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
        for (const event of b.events.filter(
          (e) => e.sequence > this.sequence,
        )) {
          if (event.type === 'action-used') {
            let motion: Motion = 'attack';
            const definition = skills[event.actionId as SkillId];
            if (event.actionId.startsWith('potion')) motion = 'drink';
            else if (
              definition?.kind === 'magic' ||
              definition?.kind === 'support' ||
              ['Mend ally', 'Silencing hex', 'Burning bolt'].includes(
                event.actionId,
              )
            )
              motion = 'qi';
            if (
              event.actionId.toLowerCase().includes('guard') ||
              event.actionId === 'Brace shield'
            )
              motion = 'guard';
            this.actors.get(event.actorId)?.play(motion);
          }
          if (event.type === 'damage')
            this.actors.get(event.targetId)?.play('hit', 0.24);
          if (event.type === 'attack-avoided')
            this.actors.get(event.targetId)?.play('guard', 0.2);
          this.sequence = event.sequence;
        }
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
        const npc = show('service');
        npc.setSkin('balanced');
        npc.setWeapon('none');
        npc.place(800, 490, 0.6, -1);
      }
    }
    this.actors.forEach((rig, id) => rig.root.setVisible(visible.has(id)));
    this.previous = { ...s.position };
    this.room = s.world.room;
  }
  tick(delta: number) {
    this.actors.forEach((r) => r.tick(delta));
  }
  destroy() {
    this.actors.forEach((r) => r.destroy());
    this.actors.clear();
  }
}
