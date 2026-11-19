import Phaser from 'phaser';
import { HumanoidRig } from './HumanoidRig';
import { characterSkins, durationOf, type Motion } from './poses';
import { isStrike, melee } from './strikes';
import { MIN_FRAME_RATE } from '../../core/time';

const motions: Motion[] = [
  'idle',
  'walk',
  'run',
  'attack',
  'thrust',
  'chop',
  'throw',
  'bolt',
  'burst',
  'hit',
  'guard',
  'drink',
  'qi',
  'salute',
  'purchase',
  'meditate',
  'defeat',
];
import { classes, type ClassId } from '../../content/phase2';

/** Art/animation review page: /?rigPreview=1. No game progress is loaded or saved. */
export class RigPreviewScene extends Phaser.Scene {
  private rigs: HumanoidRig[] = [];
  private motion: Motion = 'idle';
  private back = false;
  private hits = 1;
  private dash = false;
  constructor() {
    super('RigPreview');
  }

  create() {
    document.title = 'Character rig workshop';
    document.querySelector('h1')!.textContent = 'Character rig workshop';
    const sheet = new URLSearchParams(location.search).get('sheet');
    if (sheet && motions.includes(sheet as Motion))
      return this.sheet(sheet as Motion);

    const panel = document.querySelector<HTMLElement>('#interface')!;
    panel.innerHTML = `<section style="pointer-events:auto;padding:16px;background:#18232b"><strong>Character rig workshop</strong><p>Stick skeleton · round joints · distance-driven walking · four origin palettes</p>${motions.map((m) => `<button data-motion="${m}">${m}</button>`).join('')}<button data-back>Front / back</button><button data-hits>Hits ×1</button><button data-dash>Dash: off</button><a href="./">Return to game</a></section>`;
    const listener = (event: Event) => {
      const el = (event.target as HTMLElement).closest('button');
      if (!el) return;
      if (el.hasAttribute('data-back')) this.back = !this.back;
      else if (el.hasAttribute('data-hits')) {
        this.hits = this.hits === 1 ? 2 : this.hits === 2 ? 4 : 1;
        el.textContent = `Hits ×${this.hits}`;
      } else if (el.hasAttribute('data-dash')) {
        this.dash = !this.dash;
        el.textContent = `Dash: ${this.dash ? 'on' : 'off'}`;
      } else this.motion = el.dataset.motion as Motion;
      this.rigs.forEach((r, i) => {
        const facing = i === 3 ? -1 : 1;
        r.place(260 + i * 360, 685, 1.6, facing, this.back);
        if (!isStrike(this.motion)) return r.play(this.motion);
        r.perform(this.motion, {
          hits: this.hits,
          reach: this.dash ? { x: 150 * facing, y: 0 } : undefined,
          ranges: melee.has(this.motion) ? [] : [320],
        });
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
            fontFamily: 'Marcellus, serif',
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
  /**
   * Contact sheet: `?rigPreview=1&sheet=chop&hits=2&dash=1` lays one motion out
   * at twelve evenly spaced moments, frozen, for reviewing every key pose.
   */
  private sheet(motion: Motion) {
    const params = new URLSearchParams(location.search);
    const hits = Number(params.get('hits') ?? 1) || 1,
      dash = params.has('dash');
    const frames = 8,
      length = Number.isFinite(durationOf(motion, hits))
        ? durationOf(motion, hits) + (dash && melee.has(motion) ? 0.8 : 0)
        : 1;
    for (let i = 0; i < frames; i++) {
      const x = 200 + (i % 4) * 400,
        y = i < 4 ? 420 : 870;
      this.add.rectangle(x, y - 190, 392, 440, 0xd8d2c4);
      this.add.rectangle(x, y, 392, 2, 0x44545c);
      const rig = new HumanoidRig(this);
      rig.setSkin('warrior');
      rig.place(x - 70, y, 1.2, 1);
      if (isStrike(motion))
        rig.perform(motion, {
          hits,
          reach: dash ? { x: 90, y: 0 } : undefined,
          ranges: melee.has(motion) ? [] : [230],
        });
      else rig.play(motion);
      // Step to this frame's moment in small ticks so blends and trails settle.
      // `&step=66` replays at the slowest frame the game still keeps pace
      // with; every frame should match the default 60 fps stepping.
      const ms = Math.min(
        1000 / MIN_FRAME_RATE,
        Number(params.get('step')) || 16,
      );
      const at = (length * i) / (frames - 1);
      let t = 0;
      do {
        const step = Math.min(ms, at * 1000 - t);
        rig.tick(step);
        t += Math.max(step, 1);
      } while (t < at * 1000);
      this.add.text(x - 186, y - 400, `${motion} · ${at.toFixed(2)}s`, {
        fontSize: '20px',
        color: '#1a1f24',
      });
    }
  }
  update(_time: number, delta: number) {
    this.rigs.forEach((r) => r.tick(delta));
  }
}
