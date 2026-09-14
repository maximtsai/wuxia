import {
  ID_PATTERN,
  type TreeData,
  type TreeEffect,
  type TreeEffectType,
} from '../content/schema';
import type { EditorState } from './main';

export const esc = (value: unknown) =>
  String(value).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export const effectTypeLabels: Record<TreeEffectType, string> = {
  stat: 'Stat bonus',
  statPercent: 'Stat %',
  grantSkill: 'Grant skill',
  skillModifier: 'Modify skill',
  flag: 'Flag (code rule)',
};

export { treeStatLabels as statLabels } from '../content/schema';

const regionPalette: Record<string, string> = {
  center: '#5fb58f',
  warrior: '#d9594c',
  qi: '#9cc9e8',
  swiftblade: '#e3c04f',
  'iron-body': '#b98d68',
  'shadow-arts': '#9a82d6',
  'weapon-tempo': '#de8f45',
};

export function regionColor(region: string) {
  if (regionPalette[region]) return regionPalette[region];
  let hue = 0;
  for (const ch of region) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hue} 55% 62%)`;
}

export const findNode = (tree: TreeData, id: string | null | undefined) =>
  tree.nodes.find((node) => node.id === id);

function uniqueNodeId(tree: TreeData) {
  let n = tree.nodes.length + 1;
  while (findNode(tree, `node-${n}`)) n++;
  return `node-${n}`;
}

/** Adds a node, linked both ways to `connectTo` when given, and returns its id. */
export function addNode(
  state: EditorState,
  position: { x: number; y: number },
  connectTo: string | null,
) {
  const anchor = findNode(state.tree, connectTo);
  const id = uniqueNodeId(state.tree);
  state.tree.nodes.push({
    id,
    name: 'New node',
    kind: 'passive',
    region: anchor?.region ?? 'center',
    position,
    connections: anchor ? [anchor.id] : [],
    effects: [],
  });
  anchor?.connections.push(id);
  return id;
}

export function deleteNode(state: EditorState, id: string) {
  state.tree.nodes = state.tree.nodes.filter((node) => node.id !== id);
  for (const node of state.tree.nodes)
    node.connections = node.connections.filter((other) => other !== id);
  if (state.selectedNode === id) state.selectedNode = null;
}

/** Renames a node and every reference to it; returns an error message instead when invalid. */
export function renameNode(state: EditorState, from: string, to: string) {
  if (to === from) return null;
  if (!ID_PATTERN.test(to)) return 'Ids may only use letters, digits, - and _';
  if (findNode(state.tree, to)) return `Id "${to}" is already used`;
  for (const node of state.tree.nodes) {
    if (node.id === from) node.id = to;
    node.connections = node.connections.map((c) => (c === from ? to : c));
  }
  const progress = state.preview.progress;
  progress.allocated = progress.allocated.map((id) => (id === from ? to : id));
  if (state.selectedNode === from) state.selectedNode = to;
  return null;
}

/** Links or unlinks two nodes in both directions. */
export function toggleConnection(state: EditorState, a: string, b: string) {
  const first = findNode(state.tree, a),
    second = findNode(state.tree, b);
  if (!first || !second || a === b) return;
  if (first.connections.includes(b) || second.connections.includes(a)) {
    first.connections = first.connections.filter((id) => id !== b);
    second.connections = second.connections.filter((id) => id !== a);
  } else {
    first.connections.push(b);
    second.connections.push(a);
  }
}

export function defaultEffect(
  type: TreeEffectType,
  skillIds: readonly string[],
): TreeEffect {
  switch (type) {
    case 'stat':
      return { type, stat: 'strength', amount: 1 };
    case 'statPercent':
      return { type, stat: 'maxLife', percent: 5 };
    case 'grantSkill':
      return { type, skill: skillIds[0], rank: 1 };
    case 'skillModifier':
      return { type, skill: skillIds[0], field: 'power', amount: 2 };
    case 'flag':
      return { type, flag: 'new-flag' };
  }
}
