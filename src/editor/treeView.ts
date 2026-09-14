import {
  allocateTreeNode,
  treeAllocationReason,
} from '../core/tree/allocation';
import type { TreeNodeDefinition } from '../content/schema';
import type { Editor } from './main';
import { addNode, esc, findNode, regionColor, toggleConnection } from './model';

/** Screen pixels per tree position unit at 100% zoom. */
const UNIT = 90;
const SVG_NS = 'http://www.w3.org/2000/svg';

function polygon(sides: number, radius: number, rotation = -Math.PI / 2) {
  return Array.from({ length: sides }, (_, i) => {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    return `${(Math.cos(angle) * radius).toFixed(1)},${(Math.sin(angle) * radius).toFixed(1)}`;
  }).join(' ');
}

function shape(node: TreeNodeDefinition) {
  switch (node.kind) {
    case 'origin':
      return '<circle class="shape" r="28"/><circle class="inner" r="19"/>';
    case 'technique':
      return '<rect class="shape" x="-21" y="-21" width="42" height="42" rx="8"/>';
    case 'mastery':
      return `<polygon class="shape" points="${polygon(6, 25, 0)}"/>`;
    case 'discipline':
      return `<polygon class="shape" points="${polygon(5, 25)}"/>`;
    case 'vow':
      return `<polygon class="shape" points="${polygon(4, 29)}"/>`;
    default:
      return '<circle class="shape" r="21"/>';
  }
}

type Drag =
  | {
      type: 'node';
      id: string;
      startX: number;
      startY: number;
      x: number;
      y: number;
      moved: boolean;
      before: string;
    }
  | {
      type: 'pan';
      id: string | null;
      startX: number;
      startY: number;
      viewX: number;
      viewY: number;
      moved: boolean;
    };

export function mountTreeView(
  editor: Editor,
  host: HTMLElement,
  signal: AbortSignal,
) {
  const { state } = editor;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('tree-svg');
  svg.setAttribute('role', 'application');
  svg.setAttribute('aria-label', 'Skill tree canvas');
  host.replaceChildren(svg);

  let drag: Drag | null = null;
  // Keep the whole tree framed while the canvas resizes, until the user pans or zooms.
  let autoFit = false;
  const resizes = new ResizeObserver(() => {
    if (!autoFit) return;
    fit();
    editor.render();
  });
  resizes.observe(svg);
  signal.addEventListener('abort', () => resizes.disconnect());
  let lastBackgroundClick: {
    time: number;
    x: number;
    y: number;
    selected: string | null;
  } | null = null;

  const toWorld = (clientX: number, clientY: number) => {
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - state.view.x) / (state.view.scale * UNIT),
      y: (clientY - rect.top - state.view.y) / (state.view.scale * UNIT),
    };
  };
  const snap = (value: number) =>
    state.snap ? Math.round(value * 2) / 2 : Math.round(value * 100) / 100;
  const nodeAt = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest('[data-node]')?.getAttribute('data-node') ?? null)
      : null;

  function togglePreview(id: string) {
    const index = editor.index;
    if (!index) return;
    const progress = state.preview.progress;
    if (progress.allocated.includes(id)) {
      // Dependent nodes that lose their connection are refunded on the next refresh.
      progress.allocated = progress.allocated.filter((other) => other !== id);
      progress.masteries = {};
    } else {
      const reason = treeAllocationReason(progress, id, index);
      if (reason) editor.notify(reason, 'error');
      else allocateTreeNode(progress, id, index);
    }
    editor.render();
  }

  svg.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0) return;
      const id = nodeAt(e.target);
      svg.setPointerCapture(e.pointerId);
      if (id && state.mode === 'edit') {
        if (e.shiftKey && state.selectedNode && state.selectedNode !== id) {
          const from = state.selectedNode;
          editor.commit(() => toggleConnection(state, from, id));
          return;
        }
        const node = findNode(state.tree, id)!;
        state.selectedNode = id;
        drag = {
          type: 'node',
          id,
          startX: e.clientX,
          startY: e.clientY,
          x: node.position.x,
          y: node.position.y,
          moved: false,
          before: editor.snapshot(),
        };
        editor.render();
      } else
        drag = {
          type: 'pan',
          id,
          startX: e.clientX,
          startY: e.clientY,
          viewX: state.view.x,
          viewY: state.view.y,
          moved: false,
        };
    },
    { signal },
  );

  svg.addEventListener(
    'pointermove',
    (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.startX,
        dy = e.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      autoFit = false;
      svg.classList.add('dragging');
      if (drag.type === 'node') {
        const node = findNode(state.tree, drag.id);
        if (!node) return;
        const scale = state.view.scale * UNIT;
        node.position = {
          x: snap(drag.x + dx / scale),
          y: snap(drag.y + dy / scale),
        };
      } else {
        state.view.x = drag.viewX + dx;
        state.view.y = drag.viewY + dy;
      }
      editor.render();
    },
    { signal },
  );

  const endDrag = (e: PointerEvent) => {
    const finished = drag;
    drag = null;
    svg.classList.remove('dragging');
    if (!finished) return;
    if (finished.type === 'node') {
      if (finished.moved) editor.record(finished.before);
      editor.render();
      return;
    }
    if (finished.moved || e.type === 'pointercancel') return;
    if (finished.id) {
      if (state.mode === 'preview') togglePreview(finished.id);
      return;
    }
    if (state.mode !== 'edit') return;
    const now = performance.now(),
      last = lastBackgroundClick;
    if (
      last &&
      now - last.time < 400 &&
      Math.hypot(e.clientX - last.x, e.clientY - last.y) < 6
    ) {
      const at = toWorld(e.clientX, e.clientY);
      lastBackgroundClick = null;
      editor.commit(() => {
        state.selectedNode = addNode(
          state,
          { x: snap(at.x), y: snap(at.y) },
          last.selected,
        );
      });
    } else {
      lastBackgroundClick = {
        time: now,
        x: e.clientX,
        y: e.clientY,
        selected: state.selectedNode,
      };
      state.selectedNode = null;
      editor.render();
    }
  };
  svg.addEventListener('pointerup', endDrag, { signal });
  svg.addEventListener('pointercancel', endDrag, { signal });

  svg.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      autoFit = false;
      const rect = svg.getBoundingClientRect(),
        cx = e.clientX - rect.left,
        cy = e.clientY - rect.top;
      const next = Math.min(
        3,
        Math.max(0.25, state.view.scale * Math.exp(-e.deltaY * 0.0015)),
      );
      const k = next / state.view.scale;
      state.view.x = cx - (cx - state.view.x) * k;
      state.view.y = cy - (cy - state.view.y) * k;
      state.view.scale = next;
      editor.render();
    },
    { signal, passive: false },
  );

  function render() {
    const { tree, view, mode, selectedNode } = state;
    const byId = new Map(tree.nodes.map((node) => [node.id, node]));
    const index = editor.index;
    const preview = mode === 'preview' && index ? state.preview : null;
    const reached = new Set<string>();
    if (preview && index) {
      reached.add(index.originByClass[preview.classId]);
      for (const id of preview.progress.allocated) reached.add(id);
    }
    const issueTargets = new Set(editor.issues.map((issue) => issue.target));
    const at = (node: TreeNodeDefinition) => ({
      x: node.position.x * UNIT,
      y: node.position.y * UNIT,
    });

    let edges = '';
    for (const node of tree.nodes)
      for (const otherId of node.connections) {
        const other = byId.get(otherId);
        if (!other) continue;
        const mutual = other.connections.includes(node.id);
        if (mutual && node.id > otherId) continue;
        const a = at(node),
          b = at(other);
        const classes = [
          'edge',
          mutual ? '' : 'one-way',
          reached.has(node.id) && reached.has(otherId) ? 'active' : '',
        ].join(' ');
        edges += `<line class="${classes}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
      }

    const nodes = tree.nodes
      .map((node) => {
        const { x, y } = at(node);
        let status = '';
        if (preview && index)
          status = reached.has(node.id)
            ? 'allocated'
            : node.kind === 'origin'
              ? 'junction'
              : treeAllocationReason(preview.progress, node.id, index)
                ? 'locked'
                : 'available';
        const classes = [
          'node',
          status,
          node.id === selectedNode && mode === 'edit' ? 'selected' : '',
          node.placeholder ? 'placeholder' : '',
          issueTargets.has(node.id) ? 'has-issue' : '',
        ].join(' ');
        const badge = node.effects.length
          ? `<g class="badge" transform="translate(21 -21)"><circle r="9"/><text dy="3.5">${node.effects.length}</text></g>`
          : '';
        return `<g class="${classes}" data-node="${esc(node.id)}" transform="translate(${x} ${y})" style="--region:${regionColor(node.region)}"><title>${esc(node.name)} (${esc(node.id)})</title>${shape(node)}<text class="label" y="${node.kind === 'origin' ? 46 : 40}">${esc(node.name)}</text>${badge}</g>`;
      })
      .join('');

    const half = UNIT / 2;
    svg.innerHTML = `<defs><pattern id="grid" width="${UNIT}" height="${UNIT}" x="${-half}" y="${-half}" patternUnits="userSpaceOnUse"><path class="grid-minor" d="M ${half} 0 V ${UNIT} M 0 ${half} H ${UNIT}"/><path class="grid-major" d="M 0 0 V ${UNIT} M 0 0 H ${UNIT}"/></pattern></defs><g transform="translate(${view.x} ${view.y}) scale(${view.scale})"><rect x="-6000" y="-6000" width="12000" height="12000" fill="url(#grid)"/><circle class="center-mark" r="5"/>${edges}${nodes}</g>`;
  }

  function fit() {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height || !state.tree.nodes.length) return;
    const xs = state.tree.nodes.map((n) => n.position.x * UNIT),
      ys = state.tree.nodes.map((n) => n.position.y * UNIT);
    const minX = Math.min(...xs) - 90,
      maxX = Math.max(...xs) + 90,
      minY = Math.min(...ys) - 70,
      maxY = Math.max(...ys) + 90;
    const scale = Math.min(
      1.6,
      Math.max(
        0.25,
        Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY)),
      ),
    );
    state.view.scale = scale;
    state.view.x = rect.width / 2 - ((minX + maxX) / 2) * scale;
    state.view.y = rect.height / 2 - ((minY + maxY) / 2) * scale;
  }

  function viewCenter() {
    const rect = svg.getBoundingClientRect();
    const center = toWorld(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return { x: snap(center.x), y: snap(center.y) };
  }

  function enableAutoFit() {
    autoFit = true;
    fit();
  }

  return { render, fit, viewCenter, enableAutoFit };
}
