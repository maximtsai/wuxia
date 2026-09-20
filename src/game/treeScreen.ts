import { classes, skills, type SkillId } from '../content/phase2';
import {
  skillModifierFields,
  treeStatLabels,
  treeStats,
  type TreeEffect,
  type TreeNodeDefinition,
} from '../content/schema';
import { originNodeByClass, treeNodeById, treeNodes } from '../content/tree';
import { freeSkillPoints, treeNodeReason } from '../core/progression';
import { treeModifiers } from '../core/tree/effects';
import type { Player } from '../core/types';

// Region hues follow the class accents on the opening screen.
const regionColors: Record<string, string> = {
  center: '#87c6a3',
  warrior: '#eb836d',
  qi: '#bfe7fa',
  swiftblade: '#edc65a',
  'iron-body': '#c79a74',
  'shadow-arts': '#a58ad8',
  'weapon-tempo': '#e39a55',
};

type NodeState =
  'allocated' | 'available' | 'reachable' | 'locked' | 'junction';
const stateLabels: Record<NodeState, string> = {
  allocated: 'Allocated',
  available: 'Available',
  reachable: 'Needs a Skill Point',
  locked: 'Not connected',
  junction: 'Origin junction',
};

const esc = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const skillName = (id: string) => skills[id as SkillId]?.name ?? id;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function regionColor(region: string) {
  if (regionColors[region]) return regionColors[region];
  let hue = 0;
  for (const ch of region) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hue} 55% 65%)`;
}

/** "+1 use", "+2 uses", "-5 Qi cost" for a skill modifier amount. */
function modifierText(field: string, amount: number) {
  const label =
    field === 'cost'
      ? 'Qi cost'
      : field === 'uses'
        ? Math.abs(amount) === 1
          ? 'use'
          : 'uses'
        : field;
  if (field === 'percent') return `${signed(amount)}% Life scaling`;
  return `${signed(amount)} ${label}`;
}

export function describeTreeEffect(effect: TreeEffect) {
  switch (effect.type) {
    case 'stat':
      return `${signed(effect.amount)} ${treeStatLabels[effect.stat]}`;
    case 'statPercent':
      return `${signed(effect.percent)}% ${treeStatLabels[effect.stat]}`;
    case 'grantSkill':
      return `Grants ${skillName(effect.skill)} at rank ${effect.rank}`;
    case 'skillModifier':
      return `${skillName(effect.skill)}: ${modifierText(effect.field, effect.amount)}`;
    case 'flag':
      return `Special rule: ${effect.flag}`;
  }
}

function nodeState(
  p: Player,
  node: TreeNodeDefinition,
  owned: Set<string>,
): NodeState {
  if (owned.has(node.id)) return 'allocated';
  if (node.kind === 'origin') return 'junction';
  const reason = treeNodeReason(p, node.id);
  return reason === null
    ? 'available'
    : reason === 'No Skill Points'
      ? 'reachable'
      : 'locked';
}

function bonusSummary(p: Player) {
  const mods = treeModifiers(p.tree);
  const lines = [
    ...treeStats.flatMap((stat) => [
      ...(mods.flat[stat]
        ? [`${signed(mods.flat[stat])} ${treeStatLabels[stat]}`]
        : []),
      ...(mods.percent[stat]
        ? [`${signed(mods.percent[stat])}% ${treeStatLabels[stat]}`]
        : []),
    ]),
    ...Object.entries(mods.grantedRanks).map(
      ([id, rank]) => `${skillName(id)} at rank ${rank}`,
    ),
    ...Object.entries(mods.skillModifiers).map(
      ([id, mod]) =>
        `${skillName(id)}: ${skillModifierFields
          .filter((field) => mod[field])
          .map((field) => modifierText(field, mod[field]))
          .join(', ')}`,
    ),
    ...[...mods.flags].map((flag) => `Special rule: ${flag}`),
  ];
  return lines.length
    ? `<ul class="tree-effects">${lines.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>`
    : '<p class="muted">No bonuses yet.</p>';
}

/** Overworld skill tree screen. Commands: tree-select, tree-allocate, ranks, skills. */
export function treeScreen(p: Player, selected: string | null) {
  const own = p.classId ? originNodeByClass[p.classId] : null;
  const owned = new Set([...p.tree.allocated, ...(own ? [own] : [])]);
  const states = new Map(
    treeNodes.map((node) => [node.id, nodeState(p, node, owned)]),
  );
  const focus =
    (selected && treeNodeById[selected]) ||
    treeNodes.find((node) => states.get(node.id) === 'available') ||
    (own ? treeNodeById[own] : treeNodes[0]);

  const xs = treeNodes.map((node) => node.position.x),
    ys = treeNodes.map((node) => node.position.y);
  const minX = Math.min(...xs) - 0.8,
    minY = Math.min(...ys) - 0.6,
    width = Math.max(...xs) + 0.8 - minX,
    height = Math.max(...ys) + 0.9 - minY;
  const left = (x: number) => (((x - minX) / width) * 100).toFixed(2),
    top = (y: number) => (((y - minY) / height) * 100).toFixed(2);

  let edges = '';
  for (const node of treeNodes)
    for (const otherId of node.connections) {
      if (node.id > otherId) continue;
      const other = treeNodeById[otherId];
      const active = owned.has(node.id) && owned.has(otherId);
      edges += `<line class="tree-edge${active ? ' active' : ''}" x1="${node.position.x}" y1="${node.position.y}" x2="${other.position.x}" y2="${other.position.y}" vector-effect="non-scaling-stroke"/>`;
    }

  const nodes = treeNodes
    .map((node) => {
      const state = states.get(node.id)!,
        isFocus = node.id === focus.id;
      return `<button class="tree-node kind-${node.kind} ${state}${isFocus ? ' selected' : ''}" style="left:${left(node.position.x)}%;top:${top(node.position.y)}%;--region:${regionColor(node.region)}" data-command="tree-select" data-value="${esc(node.id)}" aria-pressed="${isFocus}" aria-label="${esc(node.name)} · ${stateLabels[state]}"><span class="tree-node-mark" aria-hidden="true"></span><span class="tree-node-name" aria-hidden="true">${esc(node.name)}</span></button>`;
    })
    .join('');

  const focusState = states.get(focus.id)!,
    reason = treeNodeReason(p, focus.id);
  const action =
    focusState === 'allocated'
      ? `<p class="tree-owned">${focus.kind === 'origin' ? 'Your origin · free' : 'Allocated'}</p>`
      : focus.kind === 'origin'
        ? '<p class="muted">Other origins are free junctions once your path reaches them.</p>'
        : `<button data-command="tree-allocate" data-value="${esc(focus.id)}"${reason ? ' disabled' : ''}>Allocate ${esc(focus.name)}</button><small>${esc(reason ?? 'Spends 1 Skill Point')}</small>`;

  const free = freeSkillPoints(p);
  return `<div class="tree-head"><h2>Skill tree</h2><p>${plural(free, 'Skill Point')} · ${plural(p.tree.allocated.length, 'node')} allocated${p.classId ? ` · ${classes[p.classId].name} origin` : ''}</p><div class="controls"><button data-command="ranks" data-value="">Technique ranks</button><button data-command="skills" data-value="">Close skills</button></div></div>
  <ul class="tree-legend">${(['allocated', 'available', 'reachable', 'locked'] as NodeState[]).map((state) => `<li class="${state}"><span aria-hidden="true"></span>${stateLabels[state]}</li>`).join('')}</ul>
  <div class="tree-layout">
    <div class="tree-canvas"><div class="tree-board" style="aspect-ratio:${width.toFixed(2)} / ${height.toFixed(2)}"><svg viewBox="${minX} ${minY} ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">${edges}</svg>${nodes}</div></div>
    <aside class="tree-details" aria-live="polite">
      <h3>${esc(focus.name)}</h3>
      <p class="muted">${esc(focus.kind)} · ${esc(focus.region)}${focus.placeholder ? ' · placeholder' : ''} · ${stateLabels[focusState]}</p>
      ${focus.description ? `<p>${esc(focus.description)}</p>` : ''}
      ${focus.effects.length ? `<ul class="tree-effects">${focus.effects.map((effect) => `<li>${esc(describeTreeEffect(effect))}</li>`).join('')}</ul>` : '<p class="muted">No bonus of its own; it extends your path.</p>'}
      ${action}
      <h3>Your tree bonuses</h3>
      ${bonusSummary(p)}
      <p class="muted tree-hint">Allocate nodes connected to your path. Tree nodes and technique ranks share Skill Points; the Mentor upstairs refunds both.</p>
    </aside>
  </div>`;
}
