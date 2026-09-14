import { classSelection } from '../classSelection';
import {
  rooms,
  doorways,
  type ExitDirection,
  portals,
  type RoomId,
  type PortalId,
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
  criticalChance,
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
  effectiveSpeed,
  respecPreview,
  respec,
  skillRank,
  allocateNode,
  treeNodeReason,
} from '../../core/progression';
import { treeScreen } from '../treeScreen';
import { load, save, type StoragePort } from '../../platform/save';
const storage: StoragePort = {
  getItem: (k) => localStorage.getItem(k),
  setItem: (k, v) => localStorage.setItem(k, v),
};
type Menu =
  | 'equipment'
  | 'skills'
  | 'shop'
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
  private chosen: CombatAction = 'attack';
  private respecOpen = false;
  private treeSelected: string | null = null;
  constructor() {
    super('Slice');
  }
  create() {
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
        if (e.key === 'Escape' && !e.repeat) {
          if (this.menu) this.menu = null;
          else this.paused = !this.paused;
          this.stopMovement();
          this.render();
          return;
        }
        if (this.session.battle && !e.repeat && /^[1-9]$/.test(e.key)) {
          this.chosen = activeSkills[Number(e.key) - 1];
          this.render();
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
    this.panel.addEventListener(
      'click',
      (e) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
          'button',
        );
        if (b && !b.disabled)
          this.command(
            b.dataset.command!,
            b.dataset.value,
            Number(b.dataset.token),
          );
      },
      options,
    );
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (
        !this.paused &&
        !this.menu &&
        !this.session.battle &&
        this.session.player.classId
      )
        this.target = { x: p.x, y: p.y };
    });
    this.events.once('shutdown', () => abort.abort());
    this.render();
  }
  private stopMovement() {
    this.target = null;
    this.pending = null;
    this.keys.clear();
  }
  private button(label: string, command: string, value = '', disabled = false) {
    return `<button data-command="${command}" data-value="${value}" ${disabled ? 'disabled' : ''}>${label}</button>`;
  }
  private command(command: string, value?: string, token?: number) {
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
      'vendor',
      'library',
      'delivery',
      'dialogue',
      'encounters',
      'respec-preview',
    ];
    if (
      !this.session.battle &&
      !this.menu &&
      services.includes(command) &&
      Math.hypot(this.session.position.x - 800, this.session.position.y - 470) >
        150
    ) {
      this.pending = { command, value };
      this.target = { x: 800, y: 470 };
      this.notice = 'Approaching the room service…';
      this.render();
      return;
    }
    this.stopMovement();
    const s = this.session,
      p = s.player;
    if (command === 'class' && !s.battle) {
      selectClass(p, value as ClassId);
      this.notice =
        'Class selected permanently. Open Skills to plan your build.';
    }
    if (command === 'fight' && beginBattle(s, value || 'practice')) {
      this.menu = null;
      this.chosen = 'attack';
      this.enemyWait = 800;
      this.notice = '';
    }
    if (command === 'retry' && retryPrepared(s)) {
      this.enemyWait = 800;
      this.chosen = 'attack';
    }
    if (command === 'select') this.chosen = value as CombatAction;
    if (
      command === 'target' &&
      s.battle?.turn === 'player' &&
      s.battle.enemies.some((e) => e.id === value && e.life > 0)
    )
      s.battle.selectedTarget = value!;
    if (
      command === 'confirm' &&
      s.battle &&
      dispatchCombatCommand(
        s,
        {
          type: 'use-action',
          actionId: this.chosen,
          token: token!,
          targetId: s.battle.selectedTarget,
        },
        Math.random,
      )
    )
      this.enemyWait = 800;
    if (command === 'return' && returnToRoom(s)) {
      this.enemyWait = 800;
      this.chosen = 'attack';
    }
    if (!s.battle) {
      if (command === 'travel' && travel(s, value as RoomId)) {
        this.menu = null;
        this.notice = rooms[s.world.room].landmark;
      }
      if (command === 'delivery')
        this.notice = delivery(s)
          ? s.world.delivery
            ? 'Parcel accepted. Deliver it to the Library for 35 gold.'
            : 'Delivery complete. Earned 35 gold.'
          : 'No delivery available here.';
      if (command === 'buy-weapon')
        this.notice = buyWeapon(s, value as WeaponId)
          ? 'Equipment purchased. Equip it from Equipment.'
          : 'Cannot purchase this equipment.';
      if (command === 'rest' && rest(s))
        this.notice =
          'Life, Qi and Energy restored. Bottles refill at the well.';
      if (command === 'refill' && refill(s))
        this.notice = 'All owned bottles refilled for free.';
      if (
        [
          'equipment',
          'skills',
          'shop',
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
        this.notice =
          'Stat and skill points refunded. Class and earned progression preserved.';
        this.respecOpen = false;
      }
      if (command === 'buy')
        this.notice = buyPotion(s, value as PotionId)
          ? 'Reusable bottle purchased. Choose its slot.'
          : 'Cannot buy this potion.';
      if (command === 'slot') {
        const [slot, id] = value!.split(':');
        slotPotion(s, Number(slot), id === 'empty' ? null : id);
      }
      if (command === 'save') this.notice = save(storage, s);
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
    if (
      this.session.battle &&
      ['enemy', 'shadow'].includes(this.session.battle.turn)
    ) {
      this.enemyWait -= Math.min(delta, 50);
      if (this.enemyWait <= 0) {
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
      if (this.pending && Math.hypot(p.x - 800, p.y - 470) <= 150) {
        const pending = this.pending;
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
    document.body.classList.toggle('choosing-class', selecting);
    document
      .querySelector('main')!
      .classList.toggle('overworld', !b && !selecting);
    if (selecting) this.panel.innerHTML = classSelection(this.notice);
    else if (!b) this.renderOverworld();
    else {
      const done = ['victory', 'defeat', 'finished'].includes(b.turn),
        training = encounters[b.encounterId].training,
        info = actionInfo(s, this.chosen),
        reason = unavailable(s, this.chosen, b.selectedTarget);
      const actionButton = (id: CombatAction) => {
        const a = actionInfo(s, id),
          why = unavailable(s, id);
        return `<button class="skill-button ${this.chosen === id ? 'selected' : ''}" data-command="select" data-value="${id}" aria-pressed="${this.chosen === id}" aria-label="${a.name}" title="${a.detail}"><strong>${id in skills ? skills[id as SkillId].icon + ' ' : ''}${a.name}</strong><small>${a.cost} Qi${a.uses ? ` · ${a.uses.left}/${a.uses.max} uses` : ''}${id in skills ? ' · Rank ' + skillRank(p, id as SkillId) + '/10' : ''}</small><small>${why ?? 'Available'}</small></button>`;
      };
      this.panel.innerHTML = `<div class="controls"><h2>${this.paused ? 'Paused' : done ? (b.turn === 'victory' ? 'Victory' : b.turn === 'defeat' ? 'Defeat' : 'Training ended') : b.turn === 'player' ? 'Your turn' : b.turn === 'shadow' ? 'Shadow’s turn' : 'Enemy turn'}</h2>${this.button(this.paused ? 'Resume' : 'Pause', 'pause')}</div><div class="stats"><span>Life ${p.life}/${p.maxLife}</span><span>Qi ${p.mana}/${p.maxMana}</span><span>Energy ${Math.floor(p.energy)}/${p.maxEnergy}</span><span>Shield ${b.playerShield}</span><span>Level ${p.level} · EXP ${p.xp}/${p.level * 50}</span><span>Speed ${effectiveSpeed(p)} · Crit ${Math.round(criticalChance(effectiveSpeed(p)) * 100)}%</span></div>${this.paused ? '<p>Resume when ready.</p>' : `<div class="target-row">${b.enemies.map((e) => `<div class="target-card ${b.selectedTarget === e.id ? 'selected' : ''}">${this.button(e.name + ' · ' + (e.life ? 'Select target' : 'Defeated'), 'target', e.id, !e.life || b.turn !== 'player')}<p>Life ${e.life}/${e.maxLife} · Qi ${e.mana} · Shield ${e.shield}</p><small>${e.life ? `${b.intents[e.id].name} → ${b.intents[e.id].target} · ${b.intents[e.id].power} base · ${Math.round(criticalChance(e.speed) * 100)}% crit` : ''}</small><p>${e.statuses.map((v) => v.kind + ' ' + v.turns + 't').join(' · ')}</p></div>`).join('')}</div><p class="muted">Round ${b.round} · Initiative: ${b.queue.join(' → ')}${b.shadow ? ' · Shadow Life ' + b.shadow.life + '/' + b.shadow.maxLife : ''}${training ? ' · Training ' + training.cost + ' Energy/hit, ' + training.xp + ' EXP (double after shield depletion)' : ''}</p><p>${b.statuses.map((v) => v.kind + ' ' + v.turns + 't').join(' · ')}${b.guard ? ' · Guard: ' + b.guard + ' enemy hits' : ''}</p>${done ? `<p>${b.turn === 'victory' ? 'Encounter settled. Return to allocate points and prepare.' : 'Training EXP is retained; normal encounters can retry their original preparation.'}</p>` : `<div class="action-preview"><strong>${info.name}</strong><p>${info.detail}</p><p>${reason ?? (info.target === 'all' ? 'Targets every living enemy' : info.target === 'self' ? 'Targets yourself' : 'Target: ' + (b.enemies.find((e) => e.id === b.selectedTarget)?.name ?? 'Select a living enemy'))}</p><button data-command="confirm" data-token="${b.token}" ${reason ? 'disabled' : ''}>Confirm ${info.name}</button></div><div class="basic-actions">${(['attack', 'potion0', 'potion1'] as CombatAction[]).map(actionButton).join('')}</div><div class="skill-grid" aria-label="16 active skills">${activeSkills.map(actionButton).join('')}</div><p class="muted">Select an action, select a target, then confirm. Tab/Enter works throughout; keys 1–9 select the first nine skills. No cooldowns.</p>`}<div class="controls">${b.turn === 'defeat' && !training ? this.button('Retry prepared', 'retry') : ''}${this.button(training ? 'End training / Return' : 'Return to room', 'return', '', ['enemy', 'shadow'].includes(b.turn))}</div><details open><summary>Combat log</summary><ol class="combat-log" aria-label="Combat log">${s.log.map((l) => `<li>${l}</li>`).join('')}</ol></details>`}<p id="notice" role="status">${this.notice}</p>`;
    }
    if (b)
      this.panel.innerHTML = this.panel.innerHTML.replace(
        `Initiative: ${b.queue.join(' → ')}`,
        `Fixed turn cycle: ${b.openingOrder.join(' → ')}`,
      );
    this.panel.innerHTML = this.panel.innerHTML.replace(
      'Speed grants initiative and critical chance.',
      'Speed can secure the opening turn and increases critical chance.',
    );
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
    if (wasSelecting && !selecting) this.scale.refresh();
    this.draw();
  }
  private menuMarkup() {
    const p = this.session.player,
      w = this.session.world;
    if (this.menu === 'vendor')
      return `<h2>Equipment shop</h2><p>Purchases are permanent. Compare requirements before buying.</p>${(shopStock[w.room] ?? []).map((id) => `<div class="potion-offer"><strong>${theme.weapons[id]}</strong><p>+${weapons[id].damage} damage · Requires ${weapons[id].strength} Strength · ${weapons[id].price} gold<br>Equipped: +${weapons[p.weapon].damage} damage</p>${this.button(p.inventory.includes(id) ? 'Owned' : 'Buy ' + theme.weapons[id], 'buy-weapon', id, p.inventory.includes(id) || p.gold < weapons[id].price)}</div>`).join('')}${this.button('Close shop', 'vendor')}`;
    if (this.menu === 'library')
      return `<h2>Library</h2><p>The twenty Human seals open the temple exit. The Monster Portal and Dark Rift are optional challenges.</p><p>Speed grants initiative and critical chance. Shields absorb damage; shield-breaking skills help against wards. Gather Qi and Heal sustain long encounters. Bottle charges return only at the well.</p><p>Training costs Energy per hit. Deliveries are a fallback source of gold; portal victories are the main source.</p>${this.button(w.delivery ? 'Deliver parcel · 35 gold' : 'No parcel to deliver', 'delivery', '', !w.delivery)}${this.button('Close library', 'library')}`;
    if (this.menu === 'dialogue')
      return `<h2>${rooms[w.room].name}</h2><p>${w.room === 'statue' || w.room === 'riftEntry' ? 'The guards will open the Dark Rift after all twenty Human Gateway seals are broken. Monster victories are optional.' : w.room === 'upstairs' ? 'The Mentor can refund allocated stats and skills. Your class and earned levels remain yours.' : w.room === 'merchant' ? 'Take a parcel to the Library for 35 gold. You can accept another after delivery.' : 'Rest here freely. Explore through the marked exits; the map records every connection.'}</p>${this.button('Close dialogue', 'dialogue')}`;
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
      return `<h2>Temple map</h2><p>Your current room is highlighted. Use the marked exits to travel.</p><div class="temple-map">${Object.entries(
        rooms,
      )
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
      return `<h2>Progression</h2><p>${c.name} · Level ${p.level} · EXP ${p.xp}/${50 * p.level}<br>${p.level - 1 - p.choices.length} unspent stat choices · ${freeSkillPoints(p)} Skill Points</p>${(
        ['strength', 'speed', 'life', 'mana'] as StatChoice[]
      )
        .map((id) => {
          const current =
            id === 'life' ? p.maxLife : id === 'mana' ? p.maxMana : p[id];
          return `<p>${id === 'mana' ? 'qi' : id}: ${current} → ${current + c.growth[id]}</p>${this.button('Increase ' + (id === 'mana' ? 'qi' : id), 'stat', id, p.choices.length >= p.level - 1)}`;
        })
        .join(
          '',
        )}<hr><h3>Mentor: respec</h3>${this.session.world.room === 'upstairs' ? this.button('Preview respec', 'respec-preview') : '<p>Visit the Mentor upstairs to respec.</p>'}${
        this.respecOpen
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
      }${this.button('Close progression', 'progression')}`;
    }
    if (this.menu === 'encounters')
      return `<h2>Encounters & Training</h2>${Object.entries(encounters)
        .filter(([id]) =>
          w.room === 'training'
            ? !!encounters[id].training
            : id.startsWith(w.room + '-'),
        )
        .map(
          ([id, d]) =>
            `<div class="potion-offer"><strong>${d.name}</strong><p>Suggested level ${d.level} · ${d.enemies.length} opponent(s)<br>${d.training ? d.training.cost + ' Energy and ' + d.training.xp + ' EXP per damaging hit; double EXP once the shield is depleted.' : `10 Energy entry · ${d.xp} EXP · ${d.gold} gold`}</p>${this.button('Enter ' + d.name, 'fight', id, !!entryReason(this.session, id))}<small>${entryReason(this.session, id) ?? ''}</small></div>`,
        )
        .join('')}${this.button('Close encounters', 'encounters')}`;
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
    const service =
      w.room === 'entry'
        ? this.button('Recover · free', 'rest') +
          this.button('Talk to Keeper', 'dialogue')
        : w.room === 'potions'
          ? this.button('Potion seller', 'shop') +
            this.button('Refill at well · free', 'refill') +
            this.button('Meal · recover free', 'rest')
          : ['human', 'monster', 'rift', 'training'].includes(w.room)
            ? this.button('Encounters / Training', 'encounters') +
              (w.room === 'rift' ? this.button('Equipment shop', 'vendor') : '')
            : ['merchant', 'advanced'].includes(w.room)
              ? this.button('Equipment shop', 'vendor') +
                (w.room === 'merchant'
                  ? this.button(
                      w.delivery
                        ? 'Parcel already held'
                        : 'Accept delivery · 35 gold',
                      'delivery',
                      '',
                      w.delivery,
                    )
                  : '')
              : w.room === 'library'
                ? this.button('Read library / Deliver', 'library')
                : w.room === 'upstairs'
                  ? this.button('Talk to Mentor', 'dialogue') +
                    this.button('Progression', 'progression')
                  : w.room === 'ending'
                    ? '<strong>The twenty seals are broken. Your journey through the temple is complete.</strong><p>You may return for optional challenges.</p>'
                    : this.button('Talk to guards', 'dialogue');
    this.panel.innerHTML = `<div class="player-hud glass stats"><div class="portrait" aria-hidden="true">◆</div><div class="player-resources"><strong>${p.classId ? classes[p.classId].name : theme.player} · Level ${p.level}</strong>${meter('Life', p.life, p.maxLife, 'life')}${meter('Qi', p.mana, p.maxMana, 'mana')}${meter('Energy', p.energy, p.maxEnergy, 'energy')}<small>EXP ${p.xp}/${50 * p.level}</small></div></div>
    <h2 class="room-title glass">${room.name}</h2><div class="world-tools glass"><span>Gold ${p.gold}</span>${this.button(this.paused ? 'Resume' : 'Pause', 'pause')}</div>
    ${
      this.paused
        ? '<aside class="world-modal glass"><h2>Paused</h2></aside>'
        : `
      <div class="room-services glass">${service}</div>
      <nav class="room-exits" aria-label="Room exits">${Object.entries(
        room.exits,
      )
        .map(
          ([direction, to]) =>
            `<div class="exit-${direction}">${this.button(direction + ' · ' + rooms[to as RoomId].name, 'travel', to, !!travelReason(this.session, to))}${travelReason(this.session, to) ? '<small>' + travelReason(this.session, to) + '</small>' : ''}</div>`,
        )
        .join('')}</nav>
      <div class="save-service glass">${this.button('Save progress', 'save')}${this.button('Load saved progress', 'load')}</div>
      <div class="world-hint glass">${this.button('Map', 'map')}${this.button('Journey', 'journal')}<small>WASD / Click to move · Free</small></div>
      <div class="world-dock"><div class="potions glass">${[0, 1]
        .map((i) => {
          const b = slottedBottle(p, i);
          return `<span>Slot ${i + 1}: ${b ? potions[b.type].name + ' ' + b.charges + '/' + potions[b.type].charges : 'Empty'}</span>`;
        })
        .join(
          '',
        )}</div>${this.button('Equipment', 'equipment')}${this.button('Skills', 'skills')}${w.room !== 'upstairs' ? this.button('Progression', 'progression') : ''}</div>
      ${this.menu ? `<aside class="world-modal glass ${this.menu === 'map' ? 'map-modal' : this.menu === 'skills' ? 'tree-modal' : ''}">${this.menuMarkup()}</aside>` : `<aside class="equipped-summary">${theme.weapons[p.weapon]} · Human seals ${w.cleared.human}/20</aside>`}`
    }
      <p id="notice" role="status" class="world-notice">${this.notice}</p>`;
  }

  private draw() {
    const g = this.graphics,
      c = theme.colors,
      s = this.session;
    g.clear();
    this.labels.forEach((l) => l.destroy());
    this.labels = [];
    if (!s.player.classId) return;
    g.fillStyle(c.background).fillRect(0, 0, 1600, 900);
    g.fillStyle(c.floor).fillRect(90, 290, 1420, 500);
    g.lineStyle(3, c.line).strokeRect(90, 290, 1420, 500);
    const label = (x: number, y: number, t: string, size = 30) =>
      this.labels.push(
        this.add
          .text(x, y, t, {
            fontFamily: 'Arial',
            fontSize: `${size}px`,
            color: '#e1e8ee',
          })
          .setOrigin(0.5),
      );
    if (s.battle) {
      const b = s.battle;
      label(800, 100, encounters[b.encounterId].name, 38);
      g.fillStyle(c.player).fillRoundedRect(275, 435, 100, 170, 10);
      label(325, 340, theme.player);
      label(
        325,
        665,
        `${s.player.life}/${s.player.maxLife} Life · ${b.playerShield} shield`,
        24,
      );
      if (b.shadow && b.shadow.life > 0) {
        g.fillStyle(0x817fba).fillRoundedRect(480, 535, 70, 120, 10);
        label(515, 720, `Shadow ${b.shadow.life} Life`, 22);
      }
      b.enemies.forEach((e, i) => {
        const x = b.enemies.length === 1 ? 1170 : 960 + i * 360;
        g.fillStyle(e.life ? c.enemy : c.line).fillRoundedRect(
          x - 45,
          435,
          90,
          170,
          10,
        );
        label(x, 340, e.name, 26);
        label(x, 665, `${e.life}/${e.maxLife} Life`, 24);
        label(x, 705, `${e.shield} shield · ${e.mana} Qi`, 22);
        if (e.life)
          label(
            x,
            220,
            b.intents[e.id].name + ' → ' + b.intents[e.id].target,
            22,
          );
        if (b.selectedTarget === e.id)
          g.lineStyle(3, c.player).strokeRect(x - 60, 420, 120, 200);
      });
    } else {
      const room = rooms[s.world.room];
      label(800, 280, room.landmark, 28);
      g.lineStyle(2, c.line);
      for (let y = 410; y < 790; y += 125) g.lineBetween(90, y, 1510, y);
      for (const x of [400, 800, 1200]) g.lineBetween(x, 290, x, 790);
      g.fillStyle(c.enemy).fillRoundedRect(760, 390, 80, 100, 10);
      label(
        800,
        370,
        s.world.room === 'ending' ? 'Open road' : 'Room service',
        24,
      );
      if (s.world.room === 'potions') {
        g.fillStyle(c.line).fillRect(690, 495, 170, 25);
        g.lineStyle(8, c.player).strokeCircle(930, 480, 35);
        label(930, 545, 'Well', 22);
      }
      for (const direction of Object.keys(room.exits)) {
        const { x, y } = doorways[direction as ExitDirection];
        if (direction === 'up')
          g.fillStyle(c.floor).fillRect(x - 45, y, 90, 130);
        g.lineStyle(4, c.player).strokeRect(x - 45, y - 35, 90, 70);
      }
      g.lineStyle(2, c.player).strokeCircle(s.position.x, s.position.y, 44);
      g.fillStyle(c.player).fillCircle(s.position.x, s.position.y, 32);
      label(s.position.x, s.position.y + 65, theme.player, 26);
    }
  }
}
