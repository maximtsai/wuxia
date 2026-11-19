import { bottleDock } from '../bottleDock';
import { classSelection } from '../classSelection';
import { CharacterStage } from '../characters/CharacterStage';

import {
  rooms,
  doorways,
  type ExitDirection,
  portals,
  type RoomId,
  type PortalId,
  interactables,
  nearestInteractable,
  serviceSpot,
  standSpot,
  type Interactable,
  MONK_RESTORES,
} from '../../content/world';
import {
  travel,
  travelReason,
  delivery,
  buyWeapon,
  shopStock,
} from '../../core/world';
import Phaser from 'phaser';
import {
  theme,
  weapons,
  potions,
  type WeaponId,
  type PotionId,
  foods,
  type FoodId,
} from '../../content/catalog';
import {
  classes,
  skills,
  activeSkills,
  passiveSkills,
  skillIds,
  encounters,
  type ClassId,
  type SkillId,
  type StatChoice,
  type CombatAction,
} from '../../content/phase2';
import {
  actionInfo,
  beginBattle,
  entryReason,
  retryPrepared,
  refill,
  buyPotion,
  slotPotion,
  slottedBottle,
  potionDescription,
  equip,
  move,
  newSession,
  rest,
  eat,
  eatReason,
  meditate,
  meditateReason,
  returnToRoom,
  unavailable,
} from '../../core/session';
import { dispatchCombatCommand } from '../../core/combat/commands';
import {
  selectClass,
  chooseStat,
  learn,
  learnReason,
  freeSkillPoints,
  respecPreview,
  respec,
  skillRank,
  allocateNode,
  treeNodeReason,
  xpToNext,
} from '../../core/progression';
import { treeScreen } from '../treeScreen';
import { load, save, type StoragePort } from '../../platform/save';
import { frameSeconds } from '../../core/time';
const storage: StoragePort = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
};
type Menu =
  | 'equipment'
  | 'skills'
  | 'shop'
  | 'food'
  | 'progression'
  | 'encounters'
  | 'vendor'
  | 'library'
  | 'map'
  | 'journal'
  | 'dialogue'
  | 'ranks'
  | null;
export class SliceScene extends Phaser.Scene {
  private session = newSession();
  private graphics!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private pending: { command: string; value?: string } | null = null;
  private target: { x: number; y: number } | null = null;
  private keys = new Set<string>();
  private paused = false;
  private enemyWait = 800;
  private panel!: HTMLElement;
  private notice = '';
  private menu: Menu = null;
  /** Top-right options menu: commands that are not needed right now. */
  private optionsOpen = false;
  private respecOpen = false;
  private treeSelected: string | null = null;
  private characters!: CharacterStage;
  private previewClass: ClassId | null = null;
  /** True while blows are still landing on screen; actions wait for them. */
  private settling = false;
  /** A long press on a touch action shows its details instead of using it. */
  private suppressClick = false;
  /** Shown on a new game until the player first moves. */
  private walkHint = false;
  /** Notices fade after a few seconds. */
  private shownNotice = '';
  private noticeTimer = 0;
  /** Object whose card is showing; re-rendered only when this changes. */
  private nearby: Interactable | null = null;
  /** Object whose card the player opened with E / Space / Enter or a tap. */
  private interacting: Interactable | null = null;
  /** Separate background and transparent props for the market room. */
  private marketArt: Phaser.GameObjects.Image[] = [];
  private entryArt!: Phaser.GameObjects.Image;
  constructor() {
    super('Slice');
  }

  preload() {
    this.load.image(
      'entry-background',
      `${import.meta.env.BASE_URL}images/rooms/entry/background.png`,
    );
    for (const name of ['background', 'potion-table', 'food-table', 'well']) {
      this.load.image(
        `market-${name}`,
        `${import.meta.env.BASE_URL}images/rooms/market/${name}.png`,
      );
    }
  }
  create() {
    this.entryArt = this.add
      .image(800, 450, 'entry-background')
      .setDisplaySize(1600, 900)
      .setDepth(-2)
      .setVisible(false);
    this.marketArt = [
      this.add
        .image(800, 450, 'market-background')
        .setDisplaySize(1600, 900)
        .setDepth(-2),
      this.add
        .image(590, 413, 'market-potion-table')
        .setDisplaySize(420, 150)
        .setDepth(10.48),
      this.add
        .image(1120, 413, 'market-food-table')
        .setDisplaySize(420, 150)
        .setDepth(10.48),
      this.add
        .image(285, 425, 'market-well')
        .setDisplaySize(170, 170)
        .setDepth(10.48),
    ];
    this.marketArt.forEach((image) => image.setVisible(false));
    this.characters = new CharacterStage(this);
    this.events.once('shutdown', () => this.characters.destroy());
    this.panel = document.querySelector<HTMLElement>('#interface')!;
    document.querySelector('h1')!.textContent = theme.title;
    document.title = theme.title;
    document.querySelector('header span')!.textContent =
      'Temple campaign · Phase 3';
    this.graphics = this.add.graphics();
    const abort = new AbortController(),
      options = { signal: abort.signal };
    window.addEventListener(
      'keydown',
      (e) => {
        if (!this.session.player.classId) return;
        const shortcut = (
          {
            m: 'map',
            j: 'journal',
            c: 'progression',
            i: 'equipment',
            k: 'skills',
          } as Record<string, string>
        )[e.key.toLowerCase()];
        if (
          shortcut &&
          !e.repeat &&
          !this.paused &&
          !this.session.battle &&
          !(e.target as HTMLElement)?.closest('input, textarea, select')
        ) {
          e.preventDefault();
          this.command(shortcut);
          return;
        }
        if (
          e.key.toLowerCase() === 'o' &&
          !e.repeat &&
          !this.paused &&
          !(e.target as HTMLElement)?.closest('input, textarea, select')
        ) {
          this.command('options');
          return;
        }
        if (e.key === 'Escape' && !e.repeat) {
          if (this.optionsOpen) this.optionsOpen = false;
          else if (this.menu) this.menu = null;
          else if (this.interacting) this.interacting = null;
          else this.paused = !this.paused;
          this.stopMovement();
          this.render();
          return;
        }
        const onButton = (e.target as HTMLElement | null)?.closest?.('button');
        if (
          ['e', 'E', ' ', 'Enter'].includes(e.key) &&
          !e.repeat &&
          !this.paused &&
          !this.menu &&
          !this.session.battle &&
          this.nearby
        ) {
          // Enter / Space on a focused button keep their native click.
          if (onButton && e.key !== 'e' && e.key !== 'E') return;
          e.preventDefault();
          if (!this.interacting) this.interact();
          else if ((e.key === 'e' || e.key === 'E') && this.nearby.actions[0])
            this.command(this.nearby.actions[0]);
          return;
        }
        if (this.session.battle && !e.repeat && /^[1-9]$/.test(e.key)) {
          const learned = activeSkills.filter(
            (id) => skillRank(this.session.player, id as SkillId) > 0,
          );
          const id = learned[Number(e.key) - 1];
          if (id) this.command('use', id, this.session.battle.token);
          return;
        }
        if (
          !this.paused &&
          !this.menu &&
          !this.session.battle &&
          this.session.player.classId &&
          [
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
            'w',
            'a',
            's',
            'd',
          ].includes(e.key)
        ) {
          e.preventDefault();
          this.keys.add(e.key);
          this.dismissWalkHint();
        }
      },
      options,
    );
    window.addEventListener('keyup', (e) => this.keys.delete(e.key), options);
    const pause = () => {
      if (!this.session.player.classId) return;
      this.paused = true;
      this.stopMovement();
      this.render();
    };
    window.addEventListener('blur', pause, options);
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) pause();
      },
      options,
    );
    // Action details replace the latest log line while an action is hovered,
    // focused, or long-pressed on touch.
    const showDetail = (el: HTMLElement | null) => {
      const line = this.panel.querySelector<HTMLElement>('.last-log');
      if (!line) return;
      const detail = el?.closest<HTMLElement>('[data-detail]')?.dataset.detail;
      // The line keeps its one-line height; a longer detail grows upward over
      // the content above, so the buttons under the pointer never move.
      const text = document.createElement('span');
      text.textContent = detail ?? line.dataset.log ?? '';
      line.replaceChildren(text);
      line.classList.toggle('showing-detail', !!detail);
    };
    let press = 0;
    this.panel.addEventListener(
      'pointerover',
      (e) => showDetail(e.target as HTMLElement),
      options,
    );
    this.panel.addEventListener(
      'focusin',
      (e) => showDetail(e.target as HTMLElement),
      options,
    );
    this.panel.addEventListener(
      'pointerout',
      (e) => {
        if (
          !(e.relatedTarget as HTMLElement | null)?.closest?.('[data-detail]')
        )
          showDetail(null);
      },
      options,
    );
    this.panel.addEventListener(
      'pointerdown',
      (e) => {
        const el = (e.target as HTMLElement).closest<HTMLElement>(
          '[data-detail]',
        );
        if (e.pointerType !== 'touch' || !el) return;
        press = window.setTimeout(() => {
          showDetail(el);
          this.suppressClick = true;
        }, 450);
      },
      options,
    );
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
      this.panel.addEventListener(
        type,
        () => window.clearTimeout(press),
        options,
      );
    this.panel.addEventListener(
      'click',
      (e) => {
        if (this.suppressClick) {
          this.suppressClick = false;
          return;
        }
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
          'button',
        );
        // Any click outside an open options menu dismisses it.
        if (
          this.optionsOpen &&
          !b &&
          !(e.target as HTMLElement).closest('.options')
        ) {
          this.optionsOpen = false;
          this.render();
          return;
        }
        if (b && !b.disabled)
          this.command(
            b.dataset.command!,
            b.dataset.value,
            Number(b.dataset.token),
          );
      },
      options,
    );
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: unknown[]) => {
      if (over.length) return; // tapped the interact button, not the floor
      if (this.optionsOpen) {
        this.optionsOpen = false;
        this.render();
        return;
      }
      if (
        !this.paused &&
        !this.menu &&
        !this.session.battle &&
        this.session.player.classId
      ) {
        // Clicking an object walks to where it is used, not onto it.
        const o = interactables[this.session.world.room].find(
          (i) => Math.hypot(p.x - i.x, p.y - i.y) < 90,
        );
        this.target = o ? standSpot(o) : { x: p.x, y: p.y };
        this.dismissWalkHint();
      }
    });
    this.events.once('shutdown', () => abort.abort());
    this.render();
  }
  private dismissWalkHint() {
    if (!this.walkHint) return;
    this.walkHint = false;
    this.render();
  }
  /** Key caps for keyboards and mice; a tap icon on touch screens. */
  private walkHintMarkup() {
    const caps = (top: string, row: string[]) =>
      `<span class="key-cluster"><kbd>${top}</kbd><span>${row.map((k) => `<kbd>${k}</kbd>`).join('')}</span></span>`;
    const mouse =
      '<svg class="hint-icon" viewBox="0 0 24 32" aria-hidden="true"><rect x="2" y="2" width="20" height="28" rx="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 2v11M2 13h20" stroke="currentColor" stroke-width="2"/><path d="M3 12V12a9 9 0 0 1 9-9v9z" fill="currentColor" opacity=".55"/></svg>';
    const tap =
      '<svg class="hint-icon" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="5" fill="currentColor"/><circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" stroke-width="2" opacity=".6"/><circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"/></svg>';
    return `<div class="walk-hint glass" role="note"><span class="visually-hidden">Walk with W A S D, the arrow keys, or by clicking or tapping the floor.</span><span class="walk-hint-row kbd-only" aria-hidden="true">${caps('W', ['A', 'S', 'D'])}<span class="hint-or">or</span>${caps('↑', ['←', '↓', '→'])}<span class="hint-or">or</span>${mouse}</span><span class="walk-hint-row touch-only" aria-hidden="true">${tap}</span><span class="hint-label" aria-hidden="true">to walk</span></div>`;
  }
  private stopMovement() {
    this.target = null;
    this.pending = null;
    this.keys.clear();
  }
  /** Gear-style toggle plus its menu; `items` are [label, command, key hint, disabled]. */
  private options(items: [string, string, string, boolean?][]) {
    return `<div class="options"><button class="options-toggle" data-command="options" data-value="" aria-label="Options" aria-expanded="${this.optionsOpen}" title="Options (O)"><span aria-hidden="true">☰</span> Menu</button>${
      this.optionsOpen
        ? `<nav class="options-menu glass" aria-label="Options">${items
            .map(
              ([label, command, key, disabled]) =>
                `<button data-command="${command}" data-value="" aria-label="${label}" ${disabled ? 'disabled' : ''}>${label}${key ? `<kbd class="kbd-only">${key}</kbd>` : ''}</button>`,
            )
            .join('')}</nav>`
        : ''
    }</div>`;
  }
  private button(label: string, command: string, value = '', disabled = false) {
    return `<button aria-label="${label}" data-command="${command}" data-value="${value}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }
  private command(command: string, value?: string, token?: number) {
    if (command === 'options') {
      this.optionsOpen = !this.optionsOpen;
      this.render();
      return;
    }
    this.optionsOpen = false;
    if (command === 'close-card') {
      this.interacting = null;
      this.render();
      return;
    }
    if (command === 'pause') {
      this.paused = !this.paused;
      this.stopMovement();
      this.render();
      return;
    }
    if (this.paused) return;
    const services = [
      'rest',
      'refill',
      'shop',
      'food',
      'vendor',
      'library',
      'delivery',
      'dialogue',
      'encounters',
      'respec-preview',
    ];
    const spot = serviceSpot(this.session.world.room, command);
    if (
      !this.session.battle &&
      !this.menu &&
      services.includes(command) &&
      Math.hypot(
        this.session.position.x - spot.x,
        this.session.position.y - spot.y,
      ) > 150
    ) {
      this.pending = { command, value };
      this.target = spot;
      this.render();
      return;
    }
    this.stopMovement();
    const s = this.session,
      p = s.player;
    if (command === 'interact') {
      this.interact();
      return;
    }
    if (
      command === 'preview-class' &&
      !p.classId &&
      value &&
      value in classes
    ) {
      this.previewClass = value as ClassId;
      this.render();
      this.panel
        .querySelector<HTMLButtonElement>(
          `[data-command="preview-class"][data-value="${value}"]`,
        )
        ?.focus({ preventScroll: true });
      return;
    }
    if (
      command === 'class' &&
      !p.classId &&
      !s.battle &&
      value === this.previewClass &&
      value
    ) {
      selectClass(p, value as ClassId);
      this.walkHint = true;
    }
    if (command === 'fight' && beginBattle(s, value || 'practice')) {
      this.menu = null;
      this.enemyWait = 800;
      this.notice = '';
    }
    if (command === 'retry' && retryPrepared(s)) {
      this.enemyWait = 800;
    }
    if (
      command === 'target' &&
      s.battle?.turn === 'player' &&
      s.battle.enemies.some((e) => e.id === value && e.life > 0)
    )
      s.battle.selectedTarget = value!;
    if (
      command === 'use' &&
      s.battle &&
      !this.characters.settling() &&
      dispatchCombatCommand(
        s,
        {
          type: 'use-action',
          actionId: value as CombatAction,
          token: token!,
          targetId: s.battle.selectedTarget,
        },
        Math.random,
      )
    )
      this.enemyWait = 800;
    if (command === 'return' && returnToRoom(s)) {
      this.enemyWait = 800;
    }
    if (!s.battle) {
      if (command === 'travel' && travel(s, value as RoomId)) {
        this.menu = null;
        this.notice = rooms[s.world.room].landmark;
      }
      if (command === 'delivery') {
        const done = delivery(s);
        if (done) this.characters.gesture('salute');
        this.notice = done
          ? s.world.delivery
            ? 'Parcel accepted. Deliver it to the Library for 35 gold.'
            : 'Delivery complete. Earned 35 gold.'
          : 'No delivery available here.';
      }
      if (command === 'buy-weapon') {
        const bought = buyWeapon(s, value as WeaponId);
        if (bought) this.characters.gesture('purchase');
        this.notice = bought
          ? 'Equipment purchased. Equip it from Equipment.'
          : 'Cannot purchase this equipment.';
      }
      if (command === 'rest' && rest(s)) {
        this.characters.gesture('rest');
        this.notice =
          'Life, Qi and Energy restored. Bottles refill at the well.';
      }
      if (command === 'eat' && value && eat(s, value as FoodId)) {
        this.characters.gesture('purchase');
        this.notice = `${foods[value as FoodId].name}: Energy ${Math.floor(p.energy)}/${p.maxEnergy}, Life ${p.life}/${p.maxLife}, Qi ${p.mana}/${p.maxMana}.`;
      }
      if (command === 'refill' && refill(s)) {
        this.characters.gesture('purchase');
        this.notice = 'All owned bottles refilled for free.';
      }
      if (
        [
          'equipment',
          'skills',
          'shop',
          'food',
          'progression',
          'encounters',
          'vendor',
          'library',
          'map',
          'journal',
          'dialogue',
          'ranks',
        ].includes(command)
      ) {
        const menu = command as Menu;
        this.menu = this.menu === menu ? null : menu;
        this.respecOpen = false;
        this.notice = '';
        // Greeting whoever tends this room as the conversation opens.
        if (this.menu === 'dialogue') this.characters.gesture('salute');
      }
      if (command === 'tree-select') this.treeSelected = value ?? null;
      if (command === 'tree-allocate' && value) {
        this.treeSelected = value;
        const reason = treeNodeReason(p, value);
        this.notice = allocateNode(p, value)
          ? 'Tree node allocated.'
          : (reason ?? 'Cannot allocate this node.');
      }
      if (command === 'equip') equip(s, value as WeaponId);
      if (command === 'shield' && p.strength >= 15)
        p.shieldEquipped = !p.shieldEquipped;
      if (command === 'learn' && learn(p, value as SkillId))
        this.notice = 'Skill rank learned.';
      if (command === 'stat' && chooseStat(p, value as StatChoice))
        this.notice = 'Stat choice applied.';
      if (command === 'respec-preview' && s.world.room === 'upstairs')
        this.respecOpen = !this.respecOpen;
      if (
        command === 'respec-confirm' &&
        s.world.room === 'upstairs' &&
        respec(p)
      ) {
        this.notice = 'Your points are back to spend.';
        this.respecOpen = false;
      }
      if (command === 'buy') {
        const bought = buyPotion(s, value as PotionId);
        if (bought) this.characters.gesture('purchase');
        this.notice = bought
          ? 'Reusable bottle purchased. Choose its slot.'
          : 'Cannot buy this potion.';
      }
      if (command === 'slot') {
        const [slot, id] = value!.split(':');
        slotPotion(s, Number(slot), id === 'empty' ? null : id);
      }
      if (command === 'save') this.notice = save(storage, s);
      if (command === 'meditate') {
        const restored = meditate(s);
        if (restored) this.characters.gesture('rest');
        this.notice = restored
          ? `Life, Qi and Energy fully restored. ${MONK_RESTORES - s.world.restoresUsed} of ${MONK_RESTORES} restores remain.`
          : (meditateReason(s) ?? '');
      }
      if (command === 'load') {
        const r = load(storage);
        if (r.ok) {
          this.session = r.session;
          this.menu = null;
          this.notice = r.session.log[0];
        } else this.notice = r.message;
      }
    }
    this.render();
  }
  update(_time: number, delta: number) {
    if (this.paused) return;
    this.characters.sync(this.session);
    this.characters.tick(delta);
    // Readouts follow the animation, so a landing blow refreshes the panel.
    const settling = !!this.session.battle && this.characters.settling();
    if (settling !== this.settling) {
      this.settling = settling;
      this.render();
    }
    if (
      this.session.battle &&
      ['enemy', 'shadow'].includes(this.session.battle.turn)
    ) {
      this.enemyWait -= frameSeconds(delta) * 1000;
      // Let the last exchange finish on screen before the next one starts.
      if (this.enemyWait <= 0 && !this.characters.busy()) {
        dispatchCombatCommand(this.session, {
          type: 'resolve-npc-turn',
          token: this.session.battle.token,
        });
        this.enemyWait = 800;
        this.render();
      }
      return;
    }
    if (this.session.battle || this.menu || !this.session.player.classId)
      return;
    const x =
        Number(this.keys.has('d') || this.keys.has('ArrowRight')) -
        Number(this.keys.has('a') || this.keys.has('ArrowLeft')),
      y =
        Number(this.keys.has('s') || this.keys.has('ArrowDown')) -
        Number(this.keys.has('w') || this.keys.has('ArrowUp')),
      p = this.session.position,
      t = x || y ? { x: p.x + x * 100, y: p.y + y * 100 } : this.target;
    if (t) {
      const room = this.session.world.room;
      move(this.session, t.x, t.y, delta / 1000);
      if (this.session.world.room !== room) {
        this.stopMovement();
        this.notice = rooms[this.session.world.room].landmark;
        this.render();
        return;
      }
      this.draw();
      const near = nearestInteractable(
        this.session.world.room,
        this.session.position,
      );
      if (near !== this.nearby) {
        this.interacting = null;
        this.render();
      }
      const pending = this.pending;
      const spot =
        pending && serviceSpot(this.session.world.room, pending.command);
      if (pending && spot && Math.hypot(p.x - spot.x, p.y - spot.y) <= 150) {
        this.pending = null;
        this.command(pending.command, pending.value);
        return;
      }
      if (
        Math.hypot(
          t.x - this.session.position.x,
          t.y - this.session.position.y,
        ) < 3
      )
        this.target = null;
    }
  }
  /** Opens the nearby object's card and focuses its first action. */
  private interact() {
    if (!this.nearby || this.paused || this.menu || this.session.battle) return;
    this.interacting = this.nearby;
    this.stopMovement();
    this.render();
    this.panel
      .querySelector<HTMLButtonElement>(
        '.interact-actions button:not([disabled])',
      )
      ?.focus({ preventScroll: true });
  }
  private render() {
    const s = this.session,
      p = s.player,
      b = s.battle;
    const focus = document.activeElement as HTMLButtonElement | null;
    const focused = focus?.dataset.command
      ? { command: focus.dataset.command, value: focus.dataset.value }
      : null;
    const wasSelecting = document.body.classList.contains('choosing-class');
    const selecting = !p.classId;
    document.body.classList.toggle('in-overworld', !b && !selecting);
    document.body.classList.toggle('in-combat', !!b);
    if (this.notice !== this.shownNotice) {
      this.shownNotice = this.notice;
      window.clearTimeout(this.noticeTimer);
      const text = this.notice;
      if (text)
        this.noticeTimer = window.setTimeout(() => {
          if (this.notice !== text) return;
          this.notice = '';
          this.render();
        }, 4000);
    }
    document.body.classList.toggle('choosing-class', selecting);
    document
      .querySelector('main')!
      .classList.toggle('overworld', !b && !selecting);
    if (selecting)
      this.panel.innerHTML = classSelection(this.notice, this.previewClass);
    else if (!b) this.renderOverworld();
    else {
      const done = ['victory', 'defeat', 'finished'].includes(b.turn),
        training = encounters[b.encounterId].training;
      // Only actions the player actually has: learned skills and filled slots.
      // Owned actions: Attack, both potion slots, and learned active skills.
      // Checked directly, since "Wait for your turn" would mask "Not learned".
      const owned = (id: CombatAction) =>
        id === 'attack' ||
        id === 'potion0' ||
        id === 'potion1' ||
        (activeSkills.includes(id as SkillId) &&
          skillRank(p, id as SkillId) > 0);
      const learnedOrder = activeSkills.filter((id) => skillRank(p, id) > 0);
      const living = b.enemies.filter((e) => e.life > 0),
        // Targeting only matters when there is a choice to make.
        choosing = living.length > 1,
        targetName =
          b.enemies.find((e) => e.id === b.selectedTarget)?.name ?? 'target';
      // Keys 1–9 use learned skills in this order; the badge shows which key.
      const hotkey = (id: CombatAction) => {
        const n = learnedOrder.indexOf(id as SkillId) + 1;
        return n > 0 && n < 10
          ? `<kbd class="hotkey kbd-only" aria-hidden="true">${n}</kbd>`
          : '';
      };
      const actionButton = (id: CombatAction) => {
        const a = actionInfo(s, id),
          why =
            unavailable(s, id, b.selectedTarget) ??
            (this.settling ? 'Wait for the exchange to finish' : null);
        const bottle =
          id === 'potion0' || id === 'potion1'
            ? slottedBottle(p, id === 'potion0' ? 0 : 1)
            : undefined;
        const cost = [
          bottle
            ? `${bottle.charges}/${potions[bottle.type].charges} left`
            : '',
          a.cost ? `${a.cost} Qi` : '',
          a.uses ? `${a.uses.left}/${a.uses.max} uses` : '',
        ]
          .filter(Boolean)
          .join(' · ');
        const aim =
          why ??
          (!choosing || a.target === 'self'
            ? ''
            : a.target === 'all'
              ? 'All enemies'
              : '→ ' + targetName);
        return `<button class="skill-button" data-command="use" data-value="${id}" data-token="${b.token}" ${why ? 'disabled' : ''} aria-label="${a.name}" aria-description="${a.detail}" data-detail="${a.detail}">${hotkey(id)}<strong>${a.name}</strong>${cost ? `<small>${cost}</small>` : ''}${aim ? `<small>${aim}</small>` : ''}</button>`;
      };
      const learned = activeSkills.filter(owned);
      // Life a blow has already taken shows only once that blow lands.
      const shownLife = (id: string, life: number, max: number) =>
        Math.min(max, life + this.characters.pendingLife(id));
      const statuses = (list: { kind: string; turns: number }[]) =>
        list.map((v) => `${v.kind} ${v.turns}t`).join(', ');
      const title = this.paused
        ? 'Paused'
        : done
          ? b.turn === 'victory'
            ? 'Victory'
            : b.turn === 'defeat'
              ? 'Defeat'
              : 'Training ended'
          : b.turn === 'player'
            ? 'Your turn'
            : b.turn === 'shadow'
              ? 'Shadow’s turn'
              : 'Enemy turn';
      // Who acts next matters once there are three or more fighters.
      const cycle = b.openingOrder.filter((id) =>
          id === 'player'
            ? true
            : id === 'shadow'
              ? (b.shadow?.life ?? 0) > 0
              : (b.enemies.find((e) => e.id === id)?.life ?? 0) > 0,
        ),
        upcoming = [...b.queue, ...cycle].slice(0, cycle.length),
        actorName = (id: string) =>
          id === 'player'
            ? 'You'
            : id === 'shadow'
              ? 'Shadow'
              : (b.enemies.find((e) => e.id === id)?.name ?? id),
        turnOrder =
          cycle.length >= 3 && !done
            ? `<p class="turn-order" aria-label="Turn order">${upcoming
                .map((id, i) =>
                  i === 0 ? `<strong>${actorName(id)}</strong>` : actorName(id),
                )
                .join(' → ')}</p>`
            : '';
      // Only what this turn needs: resources, shields and effects in play.
      const strip = [
        `Life ${shownLife('player', p.life, p.maxLife)}/${p.maxLife}`,
        `Qi ${p.mana}/${p.maxMana}`,
        b.playerShield ? `Shield ${b.playerShield}` : '',
        training ? `Energy ${Math.floor(p.energy)}/${p.maxEnergy}` : '',
        b.guard ? `Guard ${b.guard}` : '',
        b.statuses.length ? statuses(b.statuses) : '',
        b.shadow?.life
          ? `Shadow ${shownLife('shadow', b.shadow.life, b.shadow.maxLife)}/${b.shadow.maxLife}`
          : '',
        ...b.enemies
          .filter((e) => e.life && e.statuses.length)
          .map((e) => `${e.name}: ${statuses(e.statuses)}`),
      ]
        .filter(Boolean)
        .map((v) => `<span>${v}</span>`)
        .join('');
      const targets = choosing
        ? `<div class="target-row" role="group" aria-label="Target">${b.enemies
            .map((e) => {
              const selected = b.selectedTarget === e.id;
              return `<button class="target-button ${selected ? 'selected' : ''}" data-command="target" data-value="${e.id}" aria-pressed="${selected}" aria-label="${e.name}" ${!e.life || b.turn !== 'player' ? 'disabled' : ''}>${e.life ? e.name : `${e.name} · defeated`}</button>`;
            })
            .join('')}</div>`
        : '';
      const e = b.earned,
        gains = [
          e.gold ? `+${e.gold} gold` : '',
          e.xp ? `+${e.xp} EXP` : '',
          e.levels
            ? `Level up${e.levels > 1 ? ` ×${e.levels}` : ''}! Lv ${p.level}`
            : '',
          e.cleared ? 'Stage cleared' : '',
        ]
          .filter(Boolean)
          .join(' · ');
      const settled =
        b.turn === 'defeat' && !training
          ? 'Retry restores your preparation; no extra Energy.'
          : '';
      const summary = [gains && `<strong>${gains}</strong>`, settled]
        .filter(Boolean)
        .join('<br>');
      this.panel.innerHTML = `<div class="combat-head"><h2>${title}</h2>${
        done
          ? ''
          : this.options([
              [this.paused ? 'Resume' : 'Pause', 'pause', 'Esc'],
              [
                training ? 'End training' : 'Retreat',
                'return',
                '',
                ['enemy', 'shadow'].includes(b.turn),
              ],
            ])
      }</div><div class="stats combat-stats">${strip}</div>${turnOrder}${
        this.paused
          ? this.button('Resume', 'pause')
          : done
            ? `${summary ? `<p class="fight-summary">${summary}</p>` : ''}<div class="controls">${b.turn === 'defeat' && !training ? this.button('Retry prepared', 'retry') : ''}${this.button(training ? 'Return' : 'Return to room', 'return')}</div>`
            : `${targets}<p class="last-log" data-log="${s.log.at(-1) ?? ''}"><span>${s.log.at(-1) ?? ''}</span></p><div class="basic-actions">${(['attack', 'potion0', 'potion1'] as CombatAction[]).filter(owned).map(actionButton).join('')}</div>${learned.length ? `<div class="skill-grid" aria-label="Learned skills">${learned.map(actionButton).join('')}</div>` : ''}`
      }<details><summary>Combat log</summary><ol class="combat-log" aria-label="Combat log">${s.log.map((l) => `<li>${l}</li>`).join('')}</ol></details><p id="notice" role="status">${this.notice}</p>`;
    }
    if (focused) {
      const candidate = Array.from(
        this.panel.querySelectorAll<HTMLButtonElement>('button'),
      ).find(
        (el) =>
          el.dataset.command === focused.command &&
          el.dataset.value === focused.value &&
          !el.disabled,
      );
      candidate?.focus({ preventScroll: true });
    }
    if (wasSelecting && !selecting) {
      this.scale.setGameSize(1600, 900);
      this.scale.refresh();
    }
    this.draw();
  }
  private menuMarkup() {
    const p = this.session.player,
      w = this.session.world;
    if (this.menu === 'vendor')
      return `<h2>Equipment shop</h2>${(shopStock[w.room] ?? []).map((id) => `<div class="potion-offer"><strong>${theme.weapons[id]}</strong><p>+${weapons[id].damage} damage · Requires ${weapons[id].strength} Strength · ${weapons[id].price} gold<br>Equipped: +${weapons[p.weapon].damage} damage</p>${this.button(p.inventory.includes(id) ? 'Owned' : 'Buy ' + theme.weapons[id], 'buy-weapon', id, p.inventory.includes(id) || p.gold < weapons[id].price)}</div>`).join('')}${this.button('Close shop', 'vendor')}`;
    if (this.menu === 'library')
      return `<h2>Library</h2><p>Break all twenty Human Gateway seals to open the way out of the temple.</p><p>Faster fighters act first and land more critical hits. Shields soak up damage until they break.</p>${this.button(w.delivery ? 'Deliver parcel · 35 gold' : 'No parcel to deliver', 'delivery', '', !w.delivery)}${this.button('Close library', 'library')}`;
    if (this.menu === 'dialogue')
      return `<h2>${rooms[w.room].name}</h2><p>${w.room === 'statue' || w.room === 'riftEntry' ? '“Break all twenty Human Gateway seals, and we’ll open the Rift.”' : w.room === 'upstairs' ? '“Want to rethink your build? I can refund your stats and skills.”' : w.room === 'merchant' ? '“Take this parcel to the Library and there’s 35 gold in it for you.”' : '“Rest whenever you need. The map shows every room.”'}</p>${this.button('Close dialogue', 'dialogue')}`;
    if (this.menu === 'journal')
      return `<h2>Journey</h2>${Object.entries(portals)
        .map(
          ([id, d]) =>
            `<p>${d.name}: ${w.cleared[id as PortalId]}/${d.count}</p>`,
        )
        .join(
          '',
        )}<p>${w.cleared.human === 20 ? 'Main objective complete. Return to Entry and take the downward exit.' : 'Next objective: Human Gateway stage ' + (w.cleared.human + 1)}</p><p>${w.delivery ? 'Delivery: take the parcel to the Library.' : 'No active delivery.'} Completed deliveries: ${w.deliveries}</p><p>${w.endingSeen ? 'Ending reached. Optional portals remain available.' : 'Ending not yet visited.'}</p>${this.button('Close journal', 'journal')}`;
    if (this.menu === 'map')
      return `<h2>Temple map</h2><p>Your current room is highlighted. Walk through a doorway, or travel to a neighbouring room:</p><div class="map-travel">${Object.values(
        rooms[w.room].exits,
      )
        .map((to) =>
          this.button(
            'Go · ' + rooms[to as RoomId].name,
            'travel',
            to,
            !!travelReason(this.session, to),
          ),
        )
        .join('')}</div><div class="temple-map">${Object.entries(rooms)
        .map(
          ([id, d]) =>
            `<div class="map-room ${id === w.room ? 'selected' : ''}" data-room="${id}"><strong>${d.name}${id === w.room ? ' · You' : ''}</strong><small>${Object.entries(
              d.exits,
            )
              .map(
                ([direction, to]) =>
                  direction + ': ' + rooms[to as RoomId].name,
              )
              .join('<br>')}</small></div>`,
        )
        .join('')}</div>${this.button('Close map', 'map')}`;
    if (this.menu === 'equipment')
      return `<h2>Equipment</h2><p>Strength ${p.strength} · Equipped ${theme.weapons[p.weapon]}</p><div class="controls">${p.inventory.map((id) => this.button(`${theme.weapons[id]} · +${weapons[id].damage} damage${id === p.weapon ? ' · Equipped' : ''}`, 'equip', id, id === p.weapon)).join('')}${this.button(p.shieldEquipped ? 'Unequip buckler' : 'Equip buckler', 'shield', '', p.strength < 15)}</div><p>Buckler requires 15 Strength; starts each battle with ${20 + p.level * 3} shield. Physical and qi defenses come from your class.</p>${this.button('Close equipment', 'equipment')}`;
    if (this.menu === 'skills') return treeScreen(p, this.treeSelected);
    if (this.menu === 'ranks')
      return `<h2>Technique ranks</h2><p>${freeSkillPoints(p)} Skill Points, shared with the skill tree · Class starter is free; maximum rank 10.</p>${this.button('Back to skill tree', 'skills')}${[
        ...activeSkills,
        ...passiveSkills,
      ]
        .map((id) => {
          const d = skills[id],
            reason = learnReason(p, id);
          return `<div class="potion-offer"><strong>${d.icon} ${d.name} · ${p.ranks[id] ?? 0}/10${d.kind === 'passive' ? ' · Passive' : ''}</strong><p>${actionInfo(this.session, id).detail}</p>${this.button('Learn ' + d.name, 'learn', id, !!reason)}<small>${reason ?? 'Spend 1 Skill Point'}</small></div>`;
        })
        .join('')}${this.button('Close technique ranks', 'ranks')}`;
    if (this.menu === 'progression') {
      const c = classes[p.classId ?? 'balanced'],
        v = respecPreview(p);
      const unspent = p.level - 1 - p.choices.length,
        stats = (['strength', 'speed', 'life', 'mana'] as StatChoice[]).map(
          (id) =>
            [
              id,
              id === 'mana' ? 'Qi' : id[0].toUpperCase() + id.slice(1),
              id === 'life' ? p.maxLife : id === 'mana' ? p.maxMana : p[id],
            ] as const,
        );
      const upstairs = this.session.world.room === 'upstairs';
      // Choices as buttons while some wait; otherwise just the numbers.
      return `<h2>Character</h2>${
        unspent
          ? `<p>${unspent} stat choice${unspent === 1 ? '' : 's'} to make</p><div class="stat-choices">${stats
              .map(
                ([id, name, current]) =>
                  `<button data-command="stat" data-value="${id}" aria-label="Increase ${name.toLowerCase()}">${name} ${current} → ${current + c.growth[id]}</button>`,
              )
              .join('')}</div>`
          : `<p class="stat-list">${stats.map(([, name, current]) => `<span>${name} ${current}</span>`).join('')}</p>`
      }${upstairs ? `<hr><h3>Mentor: respec</h3>${this.button('Preview respec', 'respec-preview')}` : ''}${
        upstairs && this.respecOpen
          ? `<p>Cost ${v.price} gold (you have ${p.gold}). Class and level stay unchanged.<br>Strength ${p.strength} → ${v.strength}<br>Speed ${p.speed} → ${v.speed}<br>Max Life ${p.maxLife} → ${v.maxLife}<br>Max Qi ${p.maxMana} → ${v.maxMana}<br>Refund ${v.statPoints} stat choices and ${v.skillPoints} Skill Points. All skills reset to the class starter at rank 1, and ${v.treeNodes} tree node${v.treeNodes === 1 ? '' : 's'} are refunded. Current Life/Qi are clamped, not refilled.${v.unequip ? ' Weapon will be unequipped.' : ''}${p.shieldEquipped && v.strength < 15 ? ' Buckler will be unequipped.' : ''}</p><ul>${skillIds
              .filter((id) => p.ranks[id])
              .map(
                (id) =>
                  `<li>${skills[id].name}: ${p.ranks[id]} → ${id === c.starter ? 1 : 0}</li>`,
              )
              .join(
                '',
              )}</ul>${this.button('Confirm respec', 'respec-confirm', '', p.gold < v.price || (!p.choices.length && freeSkillPoints(p) === v.skillPoints))}${this.button('Cancel respec', 'respec-preview')}`
          : ''
      }${this.button('Close character', 'progression')}`;
    }
    if (this.menu === 'encounters') {
      const training = w.room === 'training',
        portal = w.room as PortalId,
        cleared = training ? 0 : w.cleared[portal],
        stage = (id: string) => Number(id.split('-')[1]);
      // The next stage, then cleared stages where replays are allowed.
      const shown = Object.entries(encounters)
        .filter(([id]) =>
          training
            ? !!encounters[id].training
            : id.startsWith(w.room + '-') &&
              (stage(id) === cleared + 1 ||
                (portal !== 'human' && stage(id) <= cleared)),
        )
        .sort(([a], [b]) =>
          training
            ? 0
            : (stage(a) === cleared + 1 ? -1 : 0) -
              (stage(b) === cleared + 1 ? -1 : 0),
        );
      return `<h2>${training ? 'Training' : portals[portal].name}</h2>${training ? '' : `<p class="muted">Cleared ${cleared}/${portals[portal].count}${portal !== 'human' && cleared ? ' · cleared stages can be replayed' : ''}</p>`}${shown.length ? '' : '<p>Every stage is cleared.</p>'}${shown
        .map(
          ([id, d]) =>
            `<div class="potion-offer"><strong>${d.name}</strong><p>Suggested level ${d.level} · ${d.enemies.length} opponent(s)<br>${d.training ? d.training.cost + ' Energy and ' + d.training.xp + ' EXP per damaging hit; double EXP once the shield is depleted.' : `10 Energy entry · ${d.xp} EXP · ${d.gold} gold`}</p>${this.button('Enter ' + d.name, 'fight', id, !!entryReason(this.session, id))}${entryReason(this.session, id) ? `<small>${entryReason(this.session, id)}</small>` : ''}</div>`,
        )
        .join('')}${this.button('Close encounters', 'encounters')}`;
    }
    if (this.menu === 'food')
      return `<h2>Food seller</h2><p>Eaten on the spot. Mostly restores Energy, with a little Life and Qi. You have ${p.gold} gold.</p>${(
        Object.entries(foods) as [FoodId, (typeof foods)[FoodId]][]
      )
        .map(([id, f]) => {
          const why = eatReason(this.session, id);
          return `<div class="potion-offer food-offer"><strong>${f.name} · ${f.price} gold</strong><p>+${f.energy} Energy · +${f.life} Life · +${f.mana} Qi</p>${this.button('Eat ' + f.name, 'eat', id, !!why)}<small>${why ?? ''}</small></div>`;
        })
        .join('')}${this.button('Close food seller', 'food')}`;
    return `<h2>Potion seller</h2><p>Two slots. One owned bottle per type. The well refills all bottles free.</p><p>${[
      0, 1,
    ]
      .map((i) => {
        const b = slottedBottle(p, i);
        return `Slot ${i + 1}: ${b ? potions[b.type].name + ' ' + b.charges + '/' + potions[b.type].charges : 'Empty'}`;
      })
      .join('<br>')}</p>${(Object.keys(potions) as PotionId[])
      .map((type) => {
        const d = potions[type],
          b = p.bottles.find((v) => v.type === type);
        return `<div class="potion-offer"><strong>${d.name}</strong><p>${potionDescription(type)}<br>${d.charges} max charges · ${d.price} gold${b ? ' · Owned: ' + b.charges + ' remaining' : ''}</p>${b ? [0, 1].map((i) => this.button('Slot ' + (i + 1), 'slot', i + ':' + b.id, p.potionSlots.includes(b.id))).join('') : this.button('Buy ' + d.name, 'buy', type, p.gold < d.price)}</div>`;
      })
      .join(
        '',
      )}<div class="controls">${this.button('Clear slot 1', 'slot', '0:empty')}${this.button('Clear slot 2', 'slot', '1:empty')}${this.button('Close seller', 'shop')}</div>`;
  }
  private renderOverworld() {
    const p = this.session.player;
    const meter = (name: string, v: number, max: number, kind: string) =>
      `<div class="resource ${kind}"><span>${name}</span><strong>${Math.floor(v)} / ${max}</strong><meter aria-label="${name}" min="0" max="${max}" value="${v}"></meter></div>`;
    const w = this.session.world,
      room = rooms[w.room];
    const actionLabels: Record<string, string> = {
      rest: w.room === 'potions' ? 'Meal · recover free' : 'Recover · free',
      dialogue: 'Talk',
      shop: 'Browse potions',
      food: 'Browse food',
      refill: 'Refill bottles · free',
      encounters: w.room === 'training' ? 'Train' : 'Enter trials',
      vendor: 'Browse equipment',
      library: 'Read / Deliver',
      progression: 'Respec with Mentor',
      save: 'Save progress',
      meditate: `Full restore · ${MONK_RESTORES - w.restoresUsed}/${MONK_RESTORES} left`,
      delivery: w.delivery
        ? 'Parcel already held'
        : 'Accept delivery · 35 gold',
    };
    // Only the object the player stands beside shows any UI at all.
    const near = (this.nearby = nearestInteractable(
      w.room,
      this.session.position,
    ));
    const doorway = Object.entries(room.exits).find(
      ([direction, to]) =>
        travelReason(this.session, to) &&
        Math.hypot(
          this.session.position.x - doorways[direction as ExitDirection].x,
          this.session.position.y - doorways[direction as ExitDirection].y,
        ) < 150,
    );
    const at = (x: number, y: number) =>
      `left:${(x / 1600) * 100}%;top:${(y / 900) * 100}%`;
    if (this.interacting !== near) this.interacting = null;
    const open = this.interacting;
    const card = open
      ? `<aside class="interact-card glass" style="${at(open.x, open.figures ? open.y - 120 : open.y - 50)}" aria-label="${open.name}"><button class="card-close" data-command="close-card" data-value="" aria-label="Close">×</button><strong>${open.name}</strong><p>${open.blurb}</p>${
          open.actions.length
            ? `<div class="interact-actions">${open.actions
                .map((c) =>
                  this.button(
                    actionLabels[c],
                    c,
                    '',
                    (c === 'delivery' && w.delivery) ||
                      (c === 'meditate' && !!meditateReason(this.session)),
                  ),
                )
                .join(
                  '',
                )}</div>${open.actions.includes('meditate') && meditateReason(this.session) ? `<small>Restore: ${meditateReason(this.session)}</small>` : ''}<small class="kbd-only">E · ${actionLabels[open.actions[0]]}</small>`
            : ''
        }</aside>`
      : near
        ? `<p class="visually-hidden interact-hint" aria-live="polite">Press E to interact with ${near.name}</p><button class="context-prompt" data-command="interact" style="${at(near.x, near.y - 20)}"><kbd class="kbd-only">E</kbd> ${actionLabels[near.actions[0]] ?? near.name}</button>`
        : doorway
          ? `<aside class="interact-card glass" style="${at(doorways[doorway[0] as ExitDirection].x, doorways[doorway[0] as ExitDirection].y + (doorway[0] === 'down' ? -60 : 110))}"><strong>${rooms[doorway[1] as RoomId].name}</strong><p>${travelReason(this.session, doorway[1])}</p></aside>`
          : '';
    this.panel.innerHTML = `<div class="player-hud glass stats"><div class="portrait stick-portrait" aria-hidden="true"><span></span></div><div class="player-resources"><strong>${p.classId ? classes[p.classId].name : theme.player} · Lv ${p.level}</strong><meter class="xp-bar" aria-label="EXP" title="EXP ${p.xp} / ${xpToNext(p.level)}" min="0" max="${xpToNext(p.level)}" value="${p.xp}"></meter>${meter('Life', p.life, p.maxLife, 'life')}${meter('Qi', p.mana, p.maxMana, 'mana')}<small class="training-energy" title="Energy is spent on combat and training. Walking is free.">Training ${Math.floor(p.energy)}/${p.maxEnergy}</small></div></div>
    <h2 class="room-title glass">${room.name}</h2><div class="world-tools glass"><span class="gold-counter"><span aria-hidden="true">◉ </span><span class="visually-hidden">Gold </span>${p.gold}</span>${
      this.paused
        ? ''
        : this.options([
            ['Map', 'map', 'M'],
            ['Journal', 'journal', 'J'],
            ['Character', 'progression', 'C'],
            ['Equipment', 'equipment', 'I'],
            ['Skill tree', 'skills', 'K'],
            ['Pause', 'pause', 'Esc'],
          ])
    }</div>
    ${
      this.paused
        ? `<aside class="world-modal glass"><h2>Paused</h2>${this.button('Resume', 'pause')}</aside>`
        : `
      ${this.menu ? '' : card}
      ${this.walkHint && !this.menu ? this.walkHintMarkup() : ''}
      ${bottleDock(p)}
      ${
        // Skill Tree surfaces only while points wait to be spent.
        // Points waiting to be spent surface their own button with a badge.
        (() => {
          const due = [
            [
              'Character',
              'progression',
              p.level - 1 - p.choices.length,
              'stat choices',
            ],
            ['Skill Tree', 'skills', freeSkillPoints(p), 'skill points'],
          ] as const;
          const shown = due.filter(
            ([, command, n]) => n > 0 && this.menu !== command,
          );
          return shown.length
            ? `<div class="world-dock">${shown
                .map(
                  ([label, command, n, what]) =>
                    `<div class="skill-dock">${this.button(label, command)}<span class="skill-badge" aria-label="${n} ${what} available">${n}</span></div>`,
                )
                .join('')}</div>`
            : '';
        })()
      }
      ${this.menu ? `<aside class="world-modal glass ${this.menu === 'map' ? 'map-modal' : this.menu === 'skills' ? 'tree-modal' : ''}">${this.menuMarkup()}</aside>` : ''}`
    }
      <p id="notice" role="status" class="world-notice">${this.notice === room.landmark ? '' : this.notice}</p>`;
  }

  private draw() {
    const g = this.graphics,
      c = theme.colors,
      s = this.session;
    g.clear();
    const market =
      !!s.player.classId && !s.battle && s.world.room === 'potions';
    const entry = !!s.player.classId && !s.battle && s.world.room === 'entry';
    const paintedRoom = market || entry;
    this.entryArt.setVisible(entry);
    this.marketArt.forEach((image) => image.setVisible(market));
    this.labels.forEach((l) => l.destroy());
    this.labels = [];

    if (!s.player.classId) return;
    if (!paintedRoom) {
      g.fillStyle(c.background).fillRect(0, 0, 1600, 900);
      g.fillStyle(c.floor).fillRect(90, 290, 1420, 500);
      g.lineStyle(3, c.line).strokeRect(90, 290, 1420, 500);
    }
    const label = (x: number, y: number, t: string, size = 30) =>
      this.labels.push(
        this.add
          .text(x, y, t, {
            fontFamily: 'Noto Sans, sans-serif',
            fontSize: `${size}px`,
            color: '#f3e7cb',
          })
          .setOrigin(0.5),
      );
    if (s.battle) {
      const b = s.battle;
      label(800, 100, encounters[b.encounterId].name, 38);
      // Life as a bar with its number; values follow the blow on screen.
      const shown = (id: string, life: number, max: number) =>
        Math.min(max, life + this.characters.pendingLife(id));
      const bar = (x: number, life: number, max: number) => {
        // Sized to stay legible when the battlefield shrinks to fit the panel.
        g.fillStyle(0x0f0b07).fillRect(x - 120, 645, 240, 40);
        g.fillStyle(0xc9604f).fillRect(
          x - 117,
          648,
          234 * Math.max(0, Math.min(1, life / max)),
          34,
        );
        g.lineStyle(3, 0x5e462c).strokeRect(x - 120, 645, 240, 40);
        label(x, 665, `${life}/${max}`, 30);
      };
      const who = (id: string) =>
        id === 'player'
          ? 'you'
          : id === 'shadow'
            ? 'Shadow'
            : (b.enemies.find((e) => e.id === id)?.name ?? id);
      label(325, 340, classes[s.player.classId!].name);
      bar(
        325,
        shown('player', s.player.life, s.player.maxLife),
        s.player.maxLife,
      );
      if (b.playerShield) label(325, 710, `${b.playerShield} shield`, 28);
      if (b.shadow && b.shadow.life > 0) {
        label(515, 720, `Shadow ${b.shadow.life} Life`, 22);
      }
      b.enemies.forEach((e, i) => {
        const x = b.enemies.length === 1 ? 1170 : 960 + i * 360;
        label(x, 340, e.name, 32);
        bar(x, shown(e.id, e.life, e.maxLife), e.maxLife);
        label(
          x,
          710,
          `${e.shield ? `${e.shield} shield · ` : ''}${e.mana} Qi`,
          28,
        );
        if (e.life)
          label(
            x,
            220,
            b.intents[e.id].name + ' → ' + who(b.intents[e.id].target),
            30,
          );
        if (b.selectedTarget === e.id)
          g.lineStyle(3, c.player).strokeRect(x - 60, 420, 120, 200);
      });
    } else {
      const room = rooms[s.world.room];
      g.lineStyle(2, c.line);
      if (!paintedRoom) {
        for (let y = 410; y < 790; y += 125) g.lineBetween(90, y, 1510, y);
        for (const x of [400, 800, 1200]) g.lineBetween(x, 290, x, 790);
      }
      // Props get a simple mark; their name and actions live on the card.
      for (const o of interactables[s.world.room])
        if (!o.figures && !market)
          g.lineStyle(8, c.player).strokeCircle(
            o.x,
            o.y,
            o.id === 'well' ? 35 : 48,
          );
      for (const direction of Object.keys(room.exits)) {
        const { x, y } = doorways[direction as ExitDirection];
        if (direction === 'up' && !entry)
          g.fillStyle(c.floor).fillRect(x - 45, y, 90, 130);
        g.lineStyle(3, paintedRoom ? 0xf2dfad : c.player);
        if (direction === 'down')
          g.beginPath()
            .moveTo(x - 14, y - 14)
            .lineTo(x, y)
            .lineTo(x + 14, y - 14)
            .strokePath();
        else if (direction === 'left')
          g.beginPath()
            .moveTo(x + 14, y - 14)
            .lineTo(x, y)
            .lineTo(x + 14, y + 14)
            .strokePath();
        else if (direction === 'right')
          g.beginPath()
            .moveTo(x - 14, y - 14)
            .lineTo(x, y)
            .lineTo(x - 14, y + 14)
            .strokePath();
        else
          g.beginPath()
            .moveTo(x - 14, y + 14)
            .lineTo(x, y)
            .lineTo(x + 14, y + 14)
            .strokePath();
        // Small in-world sign instead of a travel button.
        const to = room.exits[direction as keyof typeof room.exits] as RoomId;
        const sign = rooms[to].name + (travelReason(s, to) ? ' · locked' : '');
        if (direction === 'up' && entry) label(x, y + 155, sign, 18);
        else if (direction === 'up') label(x + 175, y + 20, sign, 18);
        else if (direction === 'down') label(x, y - 40, sign, 18);
        else label(x + (direction === 'left' ? 75 : -75), y - 60, sign, 18);
      }
    }
  }
}
