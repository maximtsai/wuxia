import { classes } from '../content/phase2';
import {
  classIds,
  skillEffects,
  skillKinds,
  skillModifierFields,
  skillTargets,
  treeEffectTypes,
  treeNodeKinds,
  treeStats,
  type ClassId,
  type Skill,
  type TreeEffect,
  type TreeEffectType,
  type TreeNodeDefinition,
  type TreeNodeKind,
} from '../content/schema';
import { selectClass, syncStats } from '../core/progression';
import { newSession } from '../core/session';
import { newTreeProgress } from '../core/tree/allocation';
import { applyTreeStat, treeModifiers } from '../core/tree/effects';
import type { Editor } from './main';
import {
  addNode,
  defaultEffect,
  deleteNode,
  effectTypeLabels,
  esc,
  findNode,
  regionColor,
  renameNode,
  statLabels,
  toggleConnection,
} from './model';

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const option = (value: string, label: string, selected: boolean) =>
  `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
const field = (label: string, control: string, wide = false) =>
  `<label class="field${wide ? ' wide' : ''}"><span>${label}</span>${control}</label>`;
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function parseNumber(control: FormControl) {
  const n = Number(control.value);
  return control.value.trim() === '' || !Number.isFinite(n) ? null : n;
}

export function mountPanels(
  editor: Editor,
  hosts: { inspector: HTMLElement; skills: HTMLElement; issues: HTMLElement },
  signal: AbortSignal,
) {
  const { state } = editor;
  const skillName = (id: string) => state.skills[id]?.name ?? id;
  const nodeName = (id: string) => findNode(state.tree, id)?.name ?? id;

  // ---------- Tree node inspector ----------

  function effectEditor(
    node: TreeNodeDefinition,
    effect: TreeEffect,
    i: number,
  ) {
    const id = (key: string) => `f-${esc(node.id)}-effect-${i}-${key}`;
    const data = (key: string) =>
      `id="${id(key)}" data-node-id="${esc(node.id)}" data-effect="${i}" data-key="${key}"`;
    const skillSelect = (value: string) =>
      `<select ${data('skill')} aria-label="Skill">${Object.keys(state.skills)
        .map((skill) => option(skill, skillName(skill), skill === value))
        .join('')}</select>`;
    const statSelect = (value: string) =>
      `<select ${data('stat')} aria-label="Stat">${treeStats
        .map((stat) => option(stat, statLabels[stat], stat === value))
        .join('')}</select>`;
    const num = (key: string, value: number, label: string) =>
      `<input ${data(key)} type="number" step="1" value="${value}" aria-label="${label}">`;
    let body = '';
    switch (effect.type) {
      case 'stat':
        body = `${statSelect(effect.stat)}${num('amount', effect.amount, 'Amount')}`;
        break;
      case 'statPercent':
        body = `${statSelect(effect.stat)}${num('percent', effect.percent, 'Percent')}<span class="unit">%</span>`;
        break;
      case 'grantSkill':
        body = `${skillSelect(effect.skill)}<span class="unit">rank</span>${num('rank', effect.rank, 'Rank')}`;
        break;
      case 'skillModifier':
        body = `${skillSelect(effect.skill)}<select ${data('field')} aria-label="Field">${skillModifierFields
          .map((f) => option(f, f, f === effect.field))
          .join('')}</select>${num('amount', effect.amount, 'Amount')}`;
        break;
      case 'flag':
        body = `<input ${data('flag')} value="${esc(effect.flag)}" spellcheck="false" aria-label="Flag id">`;
        break;
    }
    return `<div class="effect"><select ${data('type')} aria-label="Effect type">${treeEffectTypes
      .map((t) => option(t, effectTypeLabels[t], t === effect.type))
      .join(
        '',
      )}</select><div class="effect-body">${body}</div><button class="icon" data-action="remove-effect" data-node-id="${esc(node.id)}" data-index="${i}" aria-label="Remove effect">×</button></div>`;
  }

  function nodeInspector(node: TreeNodeDefinition) {
    const regions = [...new Set(state.tree.nodes.map((n) => n.region))];
    const groups = [
      ...new Set(state.tree.nodes.flatMap((n) => n.masteryGroup ?? [])),
    ];
    const unlinked = state.tree.nodes.filter(
      (n) => n.id !== node.id && !node.connections.includes(n.id),
    );
    const input = (key: string, value: string, extra = '') =>
      `<input id="f-${key}" data-node-id="${esc(node.id)}" data-field="${key}" value="${esc(value)}" ${extra}>`;
    const issues = editor.issues.filter((issue) => issue.target === node.id);
    return `<div class="panel-head"><span class="swatch" style="--region:${regionColor(node.region)}"></span><h2>${esc(node.name)}</h2><button class="danger" data-action="delete-node" data-node-id="${esc(node.id)}">Delete</button></div>
    ${issues.length ? `<ul class="node-issues">${issues.map((i) => `<li>${esc(i.message)}</li>`).join('')}</ul>` : ''}
    <div class="grid2">
      ${field('Id', input('id', node.id, 'spellcheck="false"'))}
      ${field('Name', input('name', node.name))}
      ${field('Kind', `<select id="f-kind" data-node-id="${esc(node.id)}" data-field="kind">${treeNodeKinds.map((k) => option(k, k, k === node.kind)).join('')}</select>`)}
      ${
        node.kind === 'origin'
          ? field(
              'Class',
              `<select id="f-origin" data-node-id="${esc(node.id)}" data-field="origin">${classIds.map((c) => option(c, classes[c].name, c === node.origin)).join('')}</select>`,
            )
          : field(
              'Mastery group',
              input(
                'masteryGroup',
                node.masteryGroup ?? '',
                'list="mastery-groups" placeholder="none" spellcheck="false"',
              ),
            )
      }
      ${field('Region', input('region', node.region, 'list="regions" spellcheck="false"'))}
      ${field('Placeholder', `<input id="f-placeholder" type="checkbox" data-node-id="${esc(node.id)}" data-field="placeholder"${node.placeholder ? ' checked' : ''}>`)}
      ${field('X', input('x', String(node.position.x), 'type="number" step="0.5"'))}
      ${field('Y', input('y', String(node.position.y), 'type="number" step="0.5"'))}
    </div>
    ${field('Description', `<textarea id="f-description" data-node-id="${esc(node.id)}" data-field="description" rows="2">${esc(node.description ?? '')}</textarea>`, true)}
    <datalist id="regions">${regions.map((r) => option(r, r, false)).join('')}</datalist>
    <datalist id="mastery-groups">${groups.map((g) => option(g, g, false)).join('')}</datalist>
    <h3>Connections</h3>
    <ul class="chips">${
      node.connections
        .map(
          (id) =>
            `<li><button class="link" data-action="select-node" data-id="${esc(id)}">${esc(nodeName(id))}</button><button class="icon" data-action="disconnect" data-node-id="${esc(node.id)}" data-id="${esc(id)}" aria-label="Disconnect ${esc(nodeName(id))}">×</button></li>`,
        )
        .join('') || '<li class="muted">None</li>'
    }</ul>
    <div class="row"><select id="f-connect" aria-label="Node to connect">${unlinked.map((n) => option(n.id, `${n.name} (${n.id})`, false)).join('')}</select><button data-action="connect" data-node-id="${esc(node.id)}"${unlinked.length ? '' : ' disabled'}>Connect</button></div>
    <h3>Effects</h3>
    ${node.effects.map((effect, i) => effectEditor(node, effect, i)).join('') || '<p class="muted">No gameplay effect yet; this node only extends the path.</p>'}
    <div class="row"><select id="f-add-effect" aria-label="Effect type to add">${treeEffectTypes.map((t) => option(t, effectTypeLabels[t], false)).join('')}</select><button data-action="add-effect" data-node-id="${esc(node.id)}">Add effect</button></div>`;
  }

  function treeOverview() {
    const regions = [...new Set(state.tree.nodes.map((n) => n.region))];
    return `<h2>Tree</h2>
    <p class="muted">${state.tree.nodes.length} nodes across ${regions.length} regions. Select a node to edit it.</p>
    <ul class="legend">${regions.map((r) => `<li><span class="swatch" style="--region:${regionColor(r)}"></span>${esc(r)}</li>`).join('')}</ul>
    <div class="row"><button data-action="add-node">Add node</button><button data-action="fit">Fit view</button></div>
    <label class="check"><input id="f-snap" type="checkbox" data-setting="snap"${state.snap ? ' checked' : ''}> Snap to half grid</label>
    <h3>Controls</h3>
    <ul class="hints">
      <li><kbd>Drag</kbd> a node to move it; drag empty space to pan; scroll to zoom</li>
      <li><kbd>Shift</kbd>+click another node to connect or disconnect it from the selection</li>
      <li><kbd>Double-click</kbd> empty space to add a node linked to the selection</li>
      <li><kbd>Delete</kbd> removes the selected node · <kbd>F</kbd> fits the view</li>
      <li><kbd>Ctrl+Z</kbd> undo · <kbd>Ctrl+Shift+Z</kbd> redo · <kbd>Ctrl+S</kbd> save</li>
    </ul>
    <p class="hint">Nodes shaped by kind: circle passive, ring origin, square technique, hexagon mastery, pentagon discipline, diamond vow. Numbers show effect counts; dashed outlines are placeholders.</p>`;
  }

  // ---------- Build preview (runs the game's own allocation and stat code) ----------

  function previewPanel() {
    const index = editor.index!;
    const { classId, level, progress } = state.preview;
    const build = (withTree: boolean) => {
      const player = newSession().player;
      selectClass(player, classId);
      player.level = level;
      player.tree = withTree
        ? progress
        : { ...newTreeProgress(), origin: classId };
      syncStats(player, index);
      return player;
    };
    const base = build(false),
      built = build(true),
      mods = treeModifiers(progress, index),
      c = classes[classId];
    const rows: [string, number, number][] = [
      ['Strength', base.strength, built.strength],
      ['Speed', base.speed, built.speed],
      ['Max Life', base.maxLife, built.maxLife],
      ['Max Qi', base.maxMana, built.maxMana],
      ['Max Energy', base.maxEnergy, built.maxEnergy],
      ['Defense', c.defense, applyTreeStat(mods, 'defense', c.defense)],
      [
        'Qi Defense',
        c.magicDefense,
        applyTreeStat(mods, 'qiDefense', c.magicDefense),
      ],
      ['Physical power', 0, applyTreeStat(mods, 'physicalPower', 0)],
      ['Qi power', 0, applyTreeStat(mods, 'qiPower', 0)],
    ];
    const skillLines = [
      ...Object.entries(mods.grantedRanks).map(
        ([id, rank]) => `${esc(skillName(id))}: granted at rank ${rank}`,
      ),
      ...Object.entries(mods.skillModifiers).map(
        ([id, mod]) =>
          `${esc(skillName(id))}: ${skillModifierFields
            .filter((f) => mod[f])
            .map((f) => `${f} ${signed(mod[f])}`)
            .join(', ')}`,
      ),
    ];
    return `<h2>Preview build</h2>
    <div class="grid2">
      ${field('Class', `<select id="p-class" data-preview="class">${classIds.map((id) => option(id, classes[id].name, id === classId)).join('')}</select>`)}
      ${field('Level', `<input id="p-level" type="number" min="1" max="99" data-preview="level" value="${level}">`)}
    </div>
    <p class="muted">${progress.allocated.length} node${progress.allocated.length === 1 ? '' : 's'} allocated. Click nodes to allocate; click an allocated node to refund it and anything that depended on it.</p>
    <div class="row"><button data-action="preview-reset">Reset build</button></div>
    <table class="stats"><thead><tr><th>Stat</th><th>Base</th><th>With tree</th></tr></thead><tbody>${rows
      .map(
        ([label, before, after]) =>
          `<tr class="${after > before ? 'up' : after < before ? 'down' : ''}"><td>${label}</td><td>${before}</td><td>${after}${after !== before ? ` <small>(${signed(after - before)})</small>` : ''}</td></tr>`,
      )
      .join('')}</tbody></table>
    <h3>Skills</h3>${skillLines.length ? `<ul>${skillLines.map((l) => `<li>${l}</li>`).join('')}</ul>` : '<p class="muted">No skill effects.</p>'}
    <h3>Flags</h3>${mods.flags.size ? `<ul>${[...mods.flags].map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul>` : '<p class="muted">None.</p>'}
    <p class="hint">Stats come from the game's syncStats with class ${esc(c.name)} at level ${level} and no stat choices.</p>`;
  }

  // ---------- Skills tab ----------

  function skillsTab() {
    const ids = Object.keys(state.skills);
    const id = Object.hasOwn(state.skills, state.selectedSkill)
      ? state.selectedSkill
      : ids[0];
    const skill = state.skills[id];
    const issueTargets = new Set(
      editor.issues.filter((i) => i.scope === 'skills').map((i) => i.target),
    );
    const usedBy = state.tree.nodes.filter((node) =>
      node.effects.some(
        (effect) =>
          (effect.type === 'grantSkill' || effect.type === 'skillModifier') &&
          effect.skill === id,
      ),
    );
    const data = (key: string) =>
      `id="s-${key}" data-skill-id="${esc(id)}" data-skill-field="${key}"`;
    const num = (key: 'cost' | 'level' | 'hits' | 'power') =>
      `<input ${data(key)} type="number" min="0" step="1" value="${skill[key]}">`;
    const select = (key: string, values: readonly string[], value = '') =>
      `<select ${data(key)}>${values.map((v) => option(v, v || 'none', v === value)).join('')}</select>`;
    return `<div class="skills-layout">
      <nav class="skill-list" aria-label="Skills">${ids
        .map((sid) => {
          const s = state.skills[sid];
          return `<button class="skill-item${sid === id ? ' selected' : ''}${issueTargets.has(sid) ? ' has-issue' : ''}" data-select-skill="${esc(sid)}"><span class="skill-icon">${esc(s.icon)}</span><span>${esc(s.name)}<small>${esc(s.kind)}</small></span></button>`;
        })
        .join('')}</nav>
      <section class="skill-form">
        <div class="panel-head"><span class="skill-icon">${esc(skill.icon)}</span><h2>${esc(skill.name)}</h2><code>${esc(id)}</code></div>
        <div class="grid3">
          ${field('Name', `<input ${data('name')} value="${esc(skill.name)}">`)}
          ${field('Icon', `<input ${data('icon')} value="${esc(skill.icon)}">`)}
          ${field('Kind', select('kind', skillKinds, skill.kind))}
          ${field('Target', select('target', skillTargets, skill.target))}
          ${field('Effect', select('effect', ['', ...skillEffects], skill.effect ?? ''))}
          ${field('Qi cost', num('cost'))}
          ${field('Level', num('level'))}
          ${field('Hits', num('hits'))}
          ${field('Power', num('power'))}
          ${field('Uses per fight', `<input ${data('uses')} type="number" min="1" step="1" value="${skill.uses ?? ''}" placeholder="unlimited">`)}
        </div>
        ${field('Description', `<textarea ${data('description')} rows="2">${esc(skill.description)}</textarea>`, true)}
        <h3>Requires</h3>
        <div class="requires">${ids
          .filter((other) => other !== id)
          .map(
            (other) =>
              `<label class="check"><input id="s-req-${esc(other)}" type="checkbox" data-skill-id="${esc(id)}" data-requires="${esc(other)}"${skill.requires.includes(other) ? ' checked' : ''}> ${esc(skillName(other))}</label>`,
          )
          .join('')}</div>
        <h3>Used by tree nodes</h3>
        ${usedBy.length ? `<ul class="chips">${usedBy.map((n) => `<li><button class="link" data-goto-node="${esc(n.id)}">${esc(n.name)}</button></li>`).join('')}</ul>` : '<p class="muted">No tree node grants or modifies this skill.</p>'}
        <p class="hint">Skill ids are referenced by game code (for example Lightfoot Steps adds Speed), so skills can be tuned here but not added, renamed, or removed. The game requires exactly 16 active and 3 passive skills.</p>
      </section>
    </div>`;
  }

  // ---------- Events ----------

  function updateNodeField(
    node: TreeNodeDefinition,
    key: string,
    control: FormControl,
  ) {
    const value = control.value;
    switch (key) {
      case 'id':
        return renameNode(state, node.id, value.trim());
      case 'name':
        if (!value.trim()) return 'Name is required';
        node.name = value;
        return null;
      case 'description':
        if (value) node.description = value;
        else delete node.description;
        return null;
      case 'kind':
        node.kind = value as TreeNodeKind;
        if (node.kind === 'origin') {
          delete node.masteryGroup;
          node.origin ??=
            classIds.find(
              (c) => !state.tree.nodes.some((n) => n.origin === c),
            ) ?? 'balanced';
        } else delete node.origin;
        return null;
      case 'origin':
        node.origin = value as ClassId;
        return null;
      case 'region':
        if (!value.trim()) return 'Region is required';
        node.region = value.trim();
        return null;
      case 'masteryGroup':
        if (value.trim()) node.masteryGroup = value.trim();
        else delete node.masteryGroup;
        return null;
      case 'placeholder':
        if ((control as HTMLInputElement).checked) node.placeholder = true;
        else delete node.placeholder;
        return null;
      case 'x':
      case 'y': {
        const n = parseNumber(control);
        if (n === null) return 'Enter a number';
        node.position = { ...node.position, [key]: n };
        return null;
      }
    }
    return null;
  }

  function updateEffect(
    node: TreeNodeDefinition,
    i: number,
    key: string,
    control: FormControl,
  ) {
    const effect = node.effects[i];
    if (!effect) return null;
    if (key === 'type') {
      node.effects[i] = defaultEffect(
        control.value as TreeEffectType,
        Object.keys(state.skills),
      );
      return null;
    }
    const target = effect as unknown as Record<string, unknown>;
    if (key === 'amount' || key === 'percent' || key === 'rank') {
      const n = parseNumber(control);
      if (n === null) return 'Enter a number';
      target[key] = n;
    } else target[key] = control.value;
    return null;
  }

  const report = (error: string | null) => {
    if (error) {
      editor.notify(error, 'error');
      editor.render();
    }
  };

  hosts.inspector.addEventListener(
    'change',
    (e) => {
      const control = e.target as FormControl;
      const { preview, setting, field: key, effect, nodeId } = control.dataset;
      if (setting === 'snap') {
        state.snap = (control as HTMLInputElement).checked;
        return;
      }
      if (preview === 'class') {
        state.preview.classId = control.value as ClassId;
        state.preview.progress = {
          ...newTreeProgress(),
          origin: state.preview.classId,
        };
        editor.render();
        return;
      }
      if (preview === 'level') {
        const n = parseNumber(control);
        state.preview.level = Math.min(99, Math.max(1, Math.round(n ?? 1)));
        editor.render();
        return;
      }
      // Use the node id stored on the control: selection may already have moved on.
      const node = findNode(state.tree, nodeId);
      if (!node) return;
      if (key) report(editor.commit(() => updateNodeField(node, key, control)));
      else if (effect !== undefined)
        report(
          editor.commit(() =>
            updateEffect(node, Number(effect), control.dataset.key!, control),
          ),
        );
    },
    { signal },
  );

  hosts.inspector.addEventListener(
    'click',
    (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-action]',
      );
      if (!button) return;
      const node = findNode(state.tree, button.dataset.nodeId);
      switch (button.dataset.action) {
        case 'select-node':
          state.selectedNode = button.dataset.id ?? null;
          editor.render();
          break;
        case 'delete-node':
          if (node) editor.commit(() => deleteNode(state, node.id));
          break;
        case 'disconnect':
          if (node)
            editor.commit(() =>
              toggleConnection(state, node.id, button.dataset.id!),
            );
          break;
        case 'connect': {
          const target =
            hosts.inspector.querySelector<HTMLSelectElement>(
              '#f-connect',
            )?.value;
          if (node && target)
            editor.commit(() => toggleConnection(state, node.id, target));
          break;
        }
        case 'add-effect': {
          const type = hosts.inspector.querySelector<HTMLSelectElement>(
            '#f-add-effect',
          )?.value as TreeEffectType;
          if (node)
            editor.commit(() =>
              node.effects.push(defaultEffect(type, Object.keys(state.skills))),
            );
          break;
        }
        case 'remove-effect':
          if (node)
            editor.commit(() =>
              node.effects.splice(Number(button.dataset.index), 1),
            );
          break;
        case 'add-node':
          editor.commit(() => {
            state.selectedNode = addNode(state, editor.viewCenter(), null);
          });
          break;
        case 'fit':
          editor.fitView();
          break;
        case 'preview-reset':
          state.preview.progress = {
            ...newTreeProgress(),
            origin: state.preview.classId,
          };
          editor.render();
          break;
      }
    },
    { signal },
  );

  hosts.skills.addEventListener(
    'change',
    (e) => {
      const control = e.target as FormControl;
      const { skillId, skillField, requires } = control.dataset;
      const skill: Skill | undefined = skillId
        ? state.skills[skillId]
        : undefined;
      if (!skill) return;
      if (requires)
        editor.commit(() => {
          skill.requires = (control as HTMLInputElement).checked
            ? [...skill.requires, requires]
            : skill.requires.filter((r) => r !== requires);
        });
      else if (skillField)
        report(
          editor.commit(() => {
            const target = skill as unknown as Record<string, unknown>;
            if (skillField === 'uses') {
              const n = parseNumber(control);
              if (!control.value.trim()) delete skill.uses;
              else if (n === null || !Number.isInteger(n) || n < 1)
                return 'Uses must be a whole number of at least 1';
              else skill.uses = n;
            } else if (
              ['cost', 'level', 'hits', 'power'].includes(skillField)
            ) {
              const n = parseNumber(control);
              if (n === null) return 'Enter a number';
              target[skillField] = n;
            } else if (skillField === 'effect') {
              if (control.value)
                skill.effect = control.value as Skill['effect'];
              else delete skill.effect;
            } else target[skillField] = control.value;
            return null;
          }),
        );
    },
    { signal },
  );

  hosts.skills.addEventListener(
    'click',
    (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        'button',
      );
      if (button?.dataset.selectSkill) {
        state.selectedSkill = button.dataset.selectSkill;
        editor.render();
      } else if (button?.dataset.gotoNode) {
        state.tab = 'tree';
        state.mode = 'edit';
        state.selectedNode = button.dataset.gotoNode;
        editor.render();
      }
    },
    { signal },
  );

  hosts.issues.addEventListener(
    'click',
    (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>(
        'button[data-issue]',
      );
      const issue = button && editor.issues[Number(button.dataset.issue)];
      if (!issue) return;
      if (issue.scope === 'tree') {
        state.tab = 'tree';
        state.mode = 'edit';
        if (findNode(state.tree, issue.target))
          state.selectedNode = issue.target!;
      } else {
        state.tab = 'skills';
        if (issue.target && Object.hasOwn(state.skills, issue.target))
          state.selectedSkill = issue.target;
      }
      editor.render();
    },
    { signal },
  );

  function render() {
    if (state.tab === 'skills') {
      hosts.skills.innerHTML = skillsTab();
      hosts.inspector.innerHTML = '';
    } else {
      hosts.skills.innerHTML = '';
      const node = findNode(state.tree, state.selectedNode);
      hosts.inspector.innerHTML =
        state.mode === 'preview' && editor.index
          ? previewPanel()
          : node
            ? nodeInspector(node)
            : treeOverview();
    }
    const count = editor.issues.length;
    hosts.issues.innerHTML = count
      ? `<h3>${count} issue${count === 1 ? '' : 's'} · saving is blocked</h3><ul>${editor.issues
          .map(
            (issue, i) =>
              `<li><button data-issue="${i}"><span class="scope">${issue.scope}</span>${esc(issue.message)}</button></li>`,
          )
          .join('')}</ul>`
      : '<p class="ok">Content is valid.</p>';
  }

  return { render };
}
