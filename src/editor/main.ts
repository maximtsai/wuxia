import rawSkills from '../content/data/skills.json' with { type: 'json' };
import rawTree from '../content/data/tree.json' with { type: 'json' };
import {
  indexTree,
  validateSkillData,
  validateTreeData,
  type ClassId,
  type ContentIssue,
  type Skill,
  type TreeData,
  type TreeIndex,
} from '../content/schema';
import {
  newTreeProgress,
  pruneTreeProgress,
  type TreeProgress,
} from '../core/tree/allocation';
import { deleteNode } from './model';
import { mountPanels } from './panels';
import { mountTreeView } from './treeView';
import './editor.css';

export interface EditorState {
  tree: TreeData;
  skills: Record<string, Skill>;
  tab: 'tree' | 'skills';
  mode: 'edit' | 'preview';
  selectedNode: string | null;
  selectedSkill: string;
  view: { x: number; y: number; scale: number };
  snap: boolean;
  preview: { classId: ClassId; level: number; progress: TreeProgress };
}

export interface EditorIssue extends ContentIssue {
  scope: 'tree' | 'skills';
}

export interface Editor {
  state: EditorState;
  issues: EditorIssue[];
  /** Index of the edited tree, or null while the tree has issues. */
  index: TreeIndex | null;
  snapshot(): string;
  /** Runs a content change as one undoable step and re-renders. */
  commit<T>(change: () => T): T;
  /** Adds an undo step for changes made since `before` (for drags). */
  record(before: string): void;
  render(): void;
  notify(message: string, tone?: 'info' | 'error'): void;
  fitView(): void;
  viewCenter(): { x: number; y: number };
}

interface Persisted {
  state: EditorState;
  undo: string[];
  redo: string[];
  disk: string;
}

const diskTree = rawTree as unknown as TreeData;
const diskSkills = rawSkills as unknown as Record<string, Skill>;
const diskSkillIds = Object.keys(diskSkills);
const contentSnapshot = (tree: TreeData, skills: Record<string, Skill>) =>
  JSON.stringify({ skills, tree });
const diskSnapshot = contentSnapshot(diskTree, diskSkills);

// Hot updates (including the one triggered by saving) re-run this module; keep the UI state.
const persisted = import.meta.hot?.data.editor as Persisted | undefined;
const keepEdits =
  !!persisted &&
  contentSnapshot(persisted.state.tree, persisted.state.skills) !==
    persisted.disk;
const state: EditorState = persisted
  ? {
      ...persisted.state,
      ...(keepEdits
        ? {}
        : {
            tree: structuredClone(diskTree),
            skills: structuredClone(diskSkills),
          }),
    }
  : {
      tree: structuredClone(diskTree),
      skills: structuredClone(diskSkills),
      tab: 'tree',
      mode: 'edit',
      selectedNode: null,
      selectedSkill: diskSkillIds[0],
      view: { x: 0, y: 0, scale: 1 },
      snap: true,
      preview: {
        classId: 'warrior',
        level: 10,
        progress: { ...newTreeProgress(), origin: 'warrior' },
      },
    };
const undo = persisted?.undo ?? [];
const redo = persisted?.redo ?? [];
let savedSnapshot = diskSnapshot;

const controller = new AbortController();
const { signal } = controller;
const root = document.querySelector<HTMLElement>('#editor')!;
root.innerHTML = `<header class="topbar">
  <strong class="brand">Skill Tree Editor</strong>
  <nav class="segmented" aria-label="Content">
    <button data-tab="tree">Tree</button><button data-tab="skills">Skills</button>
  </nav>
  <nav class="segmented tree-only" aria-label="Mode">
    <button data-mode="edit">Edit</button><button data-mode="preview">Preview build</button>
  </nav>
  <span class="spacer"></span>
  <span id="status" role="status"></span>
  <button data-action="undo" title="Ctrl+Z">Undo</button>
  <button data-action="redo" title="Ctrl+Shift+Z">Redo</button>
  <button data-action="copy" title="Copy the current tab's JSON">Copy JSON</button>
  <button data-action="revert" title="Discard unsaved changes">Revert</button>
  <button data-action="save" class="primary" title="Ctrl+S">Save</button>
</header>
<main class="workspace">
  <section class="canvas" id="canvas"></section>
  <section class="skills-tab" id="skills"></section>
  <aside class="sidebar"><div id="inspector"></div><div id="issues" class="issues"></div></aside>
</main>
<div id="toast" role="alert" hidden></div>`;
const $ = <T extends HTMLElement>(selector: string) =>
  root.querySelector<T>(selector)!;

let frame = 0;
let toastTimer = 0;
const editor: Editor = {
  state,
  issues: [],
  index: null,
  snapshot: () => contentSnapshot(state.tree, state.skills),
  commit(change) {
    const before = editor.snapshot();
    const result = change();
    editor.record(before);
    editor.render();
    return result;
  },
  record(before) {
    if (editor.snapshot() === before) return;
    undo.push(before);
    if (undo.length > 200) undo.shift();
    redo.length = 0;
  },
  render() {
    // Deferred so a field's change event finishes moving focus before the panel is rebuilt.
    frame ||= requestAnimationFrame(renderNow);
  },
  notify(message, tone = 'info') {
    const toast = $('#toast');
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(
      () => (toast.hidden = true),
      tone === 'error' ? 6000 : 3500,
    );
  },
  fitView() {
    treeView.fit();
    editor.render();
  },
  viewCenter: () => treeView.viewCenter(),
};

const treeView = mountTreeView(editor, $('#canvas'), signal);
const panels = mountPanels(
  editor,
  { inspector: $('#inspector'), skills: $('#skills'), issues: $('#issues') },
  signal,
);

function refresh() {
  const skillIssues = validateSkillData(state.skills, {
    expectedIds: diskSkillIds,
  });
  if (!skillIssues.length) {
    const passive = Object.values(state.skills).filter(
      (s) => s.kind === 'passive',
    ).length;
    const active = diskSkillIds.length - passive;
    if (active !== 16 || passive !== 3)
      skillIssues.push({
        message: `The game requires 16 active and 3 passive skills (currently ${active} and ${passive})`,
      });
  }
  const treeIssues = validateTreeData(state.tree, {
    skillIds: Object.keys(state.skills),
  });
  editor.issues = [
    ...treeIssues.map((issue) => ({ ...issue, scope: 'tree' as const })),
    ...skillIssues.map((issue) => ({ ...issue, scope: 'skills' as const })),
  ];
  editor.index = treeIssues.length ? null : indexTree(state.tree);
  if (editor.index)
    state.preview.progress = pruneTreeProgress(
      { ...state.preview.progress, origin: state.preview.classId },
      editor.index,
    );
  else if (state.mode === 'preview') state.mode = 'edit';
  if (
    state.selectedNode &&
    !state.tree.nodes.some((node) => node.id === state.selectedNode)
  )
    state.selectedNode = null;
}

function renderNow() {
  frame = 0;
  const active = document.activeElement;
  const focusId =
    active instanceof HTMLElement && root.contains(active) ? active.id : '';
  refresh();
  root.dataset.tab = state.tab;
  root.dataset.mode = state.mode;
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-tab]'))
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.tab === state.tab),
    );
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]'))
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.mode === state.mode),
    );
  $<HTMLButtonElement>('[data-action=undo]').disabled = !undo.length;
  $<HTMLButtonElement>('[data-action=redo]').disabled = !redo.length;
  const dirty = editor.snapshot() !== savedSnapshot,
    count = editor.issues.length;
  $<HTMLButtonElement>('[data-action=save]').disabled = !dirty || count > 0;
  $<HTMLButtonElement>('[data-action=revert]').disabled = !dirty;
  const status = $('#status');
  status.textContent = `${dirty ? 'Unsaved changes' : 'Saved'} · ${count ? `${count} issue${count === 1 ? '' : 's'}` : 'valid'}`;
  status.dataset.tone = count ? 'error' : dirty ? 'dirty' : 'ok';
  document.title = `${dirty ? '• ' : ''}Skill Tree Editor`;
  treeView.render();
  panels.render();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll: true });
}

function restore(snapshot: string) {
  const content = JSON.parse(snapshot) as {
    tree: TreeData;
    skills: Record<string, Skill>;
  };
  state.tree = content.tree;
  state.skills = content.skills;
}

function step(from: string[], to: string[], label: string) {
  const snapshot = from.pop();
  if (snapshot === undefined) return editor.notify(`Nothing to ${label}`);
  to.push(editor.snapshot());
  restore(snapshot);
  editor.render();
}

async function save() {
  if (editor.issues.length)
    return editor.notify('Fix the listed issues before saving', 'error');
  try {
    const response = await fetch('/__editor/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skills: state.skills, tree: state.tree }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      issues?: string[];
    };
    if (!response.ok)
      return editor.notify(
        body.issues?.join('; ') ?? `Save failed (${response.status})`,
        'error',
      );
    savedSnapshot = editor.snapshot();
    editor.notify(
      'Saved to src/content/data. Open game tabs reload with the new content.',
    );
    editor.render();
  } catch {
    editor.notify(
      'Saving needs the dev server (npm run editor). Use Copy JSON instead.',
      'error',
    );
  }
}

const actions: Record<string, () => void> = {
  undo: () => step(undo, redo, 'undo'),
  redo: () => step(redo, undo, 'redo'),
  save: () => void save(),
  revert() {
    if (!confirm('Discard unsaved changes and reload the saved content?'))
      return;
    const saved = JSON.parse(savedSnapshot) as {
      tree: TreeData;
      skills: Record<string, Skill>;
    };
    editor.commit(() => {
      state.tree = saved.tree;
      state.skills = saved.skills;
    });
  },
  copy() {
    const json = JSON.stringify(
      state.tab === 'tree' ? state.tree : state.skills,
      null,
      2,
    );
    navigator.clipboard.writeText(json).then(
      () => editor.notify(`Copied ${state.tab}.json`),
      () => editor.notify('Clipboard unavailable', 'error'),
    );
  },
};

$('.topbar').addEventListener(
  'click',
  (e) => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
      'button',
    );
    if (!button) return;
    const { tab, mode, action } = button.dataset;
    if (tab) state.tab = tab as EditorState['tab'];
    if (mode === 'preview' && !editor.index)
      editor.notify('Fix the tree issues before previewing builds', 'error');
    else if (mode) state.mode = mode as EditorState['mode'];
    if (action) actions[action]?.();
    editor.render();
  },
  { signal },
);

window.addEventListener(
  'keydown',
  (e) => {
    const mod = e.ctrlKey || e.metaKey,
      key = e.key.toLowerCase();
    if (mod && key === 's') {
      e.preventDefault();
      void save();
      return;
    }
    if (
      e.target instanceof HTMLElement &&
      e.target.closest('input, textarea, select')
    )
      return;
    if (mod && (key === 'z' || key === 'y')) {
      e.preventDefault();
      if (key === 'y' || e.shiftKey) actions.redo();
      else actions.undo();
      return;
    }
    if (mod || state.tab !== 'tree') return;
    if ((key === 'delete' || key === 'backspace') && state.mode === 'edit') {
      const id = state.selectedNode;
      if (id) editor.commit(() => deleteNode(state, id));
    } else if (key === 'escape') {
      state.selectedNode = null;
      editor.render();
    } else if (key === 'f') editor.fitView();
  },
  { signal },
);

window.addEventListener(
  'beforeunload',
  (e) => {
    if (editor.snapshot() !== savedSnapshot) e.preventDefault();
  },
  { signal },
);

if (!persisted) treeView.enableAutoFit();
editor.render();

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose((data: { editor?: Persisted }) => {
    cancelAnimationFrame(frame);
    clearTimeout(toastTimer);
    controller.abort();
    data.editor = { state, undo, redo, disk: diskSnapshot };
  });
}
