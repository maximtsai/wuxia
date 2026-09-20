import Phaser from 'phaser';
import { HumanoidRig } from './HumanoidRig';
import { characterSkins, type Motion } from './poses';
import { classes, type ClassId } from '../../content/phase2';

/** Art/animation review page: /?rigPreview=1. No game progress is loaded or saved. */
export class RigPreviewScene extends Phaser.Scene {
  private rigs: HumanoidRig[] = [];
  private motion: Motion = 'idle';
  private back = false;
  constructor() {
    super('RigPreview');
  }

  create() {
    document.title = 'Character rig workshop';
    document.querySelector('h1')!.textContent = 'Character rig workshop';

    const panel = document.querySelector<HTMLElement>('#interface')!;
    panel.innerHTML = `<section style="pointer-events:auto;padding:16px;background:#18232b"><strong>Character rig workshop</strong><p>Stick skeleton · round joints · distance-driven walking · four origin palettes</p>${(['idle', 'walk', 'attack', 'hit', 'guard', 'drink', 'qi', 'defeat'] as Motion[]).map((m) => `<button data-motion="${m}">${m}</button>`).join('')}<button data-back>Front / back</button><a href="./">Return to game</a></section>`;
    const listener = (event: Event) => {
      const el = (event.target as HTMLElement).closest('button');
      if (!el) return;
      if (el.hasAttribute('data-back')) this.back = !this.back;
      else this.motion = el.dataset.motion as Motion;
      this.rigs.forEach((r, i) => {
        r.place(260 + i * 360, 685, 1.6, i === 3 ? -1 : 1, this.back);
        r.play(this.motion);
      });
    };
    panel.addEventListener('click', listener);
    this.add.rectangle(800, 690, 1460, 2, 0x44545c);
    (['warrior', 'caster', 'shadow', 'balanced'] as ClassId[]).forEach(
      (id, i) => {
        this.add.rectangle(
          260 + i * 360,
          445,
          340,
          510,
          characterSkins[id].cloth,
          0.9,
        );
        const rig = new HumanoidRig(this);
        rig.setSkin(id);
        rig.place(260 + i * 360, 685, 1.6, i === 3 ? -1 : 1);
        this.rigs.push(rig);
        this.add
          .text(260 + i * 360, 750, classes[id].name, {
            fontSize: '26px',
            color: '#' + characterSkins[id].accent.toString(16),
          })
          .setOrigin(0.5);
      },
    );
    this.events.once('shutdown', () => {
      panel.removeEventListener('click', listener);
      this.rigs.forEach((r) => r.destroy());
      this.rigs = [];
    });
  }
  update(_time: number, delta: number) {
    this.rigs.forEach((r) => r.tick(delta));
  }
}
