import { describe, expect, it } from 'vitest';
import { skillIds, skills } from '../../src/content/phase2';
import {
  indexTree,
  validateSkillData,
  validateTreeData,
  type TreeData,
} from '../../src/content/schema';
import { treeData } from '../../src/content/tree';
import {
  effectiveSkill,
  selectClass,
  skillRank,
  syncStats,
} from '../../src/core/progression';
import { newSession } from '../../src/core/session';
import {
  allocateTreeNode,
  newTreeProgress,
  pruneTreeProgress,
} from '../../src/core/tree/allocation';
import { CONTENT_HASH, decodeSave, save } from '../../src/platform/save';

const cloneTree = () => structuredClone(treeData) as TreeData;
const node = (tree: TreeData, id: string) =>
  tree.nodes.find((candidate) => candidate.id === id)!;
const messages = (tree: TreeData) =>
  validateTreeData(tree, { skillIds })
    .map((issue) => issue.message)
    .join('\n');

describe('editable content validation', () => {
  it('accepts the shipped tree and skills', () => {
    expect(validateTreeData(treeData, { skillIds })).toEqual([]);
    expect(validateSkillData(skills, { expectedIds: skillIds })).toEqual([]);
  });

  it('rejects effects that reference unknown skills or stats', () => {
    const tree = cloneTree();
    node(tree, 'capstone-qi').effects.push(
      { type: 'grantSkill', skill: 'missing', rank: 1 },
      { type: 'stat', stat: 'luck' as 'speed', amount: 1 },
    );
    expect(messages(tree)).toContain('unknown skill "missing"');
    expect(messages(tree)).toContain('unknown stat "luck"');
  });

  it('rejects one-way links and classes without exactly one origin', () => {
    const tree = cloneTree();
    node(tree, 'outer-warrior').connections.push('outer-qi');
    node(tree, 'origin-swiftblade').origin = 'warrior';
    expect(messages(tree)).toContain('must link both ways');
    expect(messages(tree)).toContain('Class shadow needs exactly one origin');
  });

  it('rejects prerequisite cycles and added or renamed skills', () => {
    const edited = structuredClone(skills) as Record<
      string,
      typeof skills.stab
    >;
    edited.stab.requires = ['verticalStrike'];
    edited.renamed = edited.split;
    delete edited.split;
    const found = validateSkillData(edited, { expectedIds: skillIds })
      .map((issue) => issue.message)
      .join('\n');
    expect(found).toContain('renamed: skills cannot be added or renamed');
    expect(found).toContain('split: skill is missing');
    delete edited.renamed;
    edited.split = structuredClone(skills.split);
    expect(validateSkillData(edited).map((issue) => issue.message)).toContain(
      'stab: prerequisite cycle',
    );
  });
});

describe('tree effects', () => {
  it('apply stat, percent, granted-rank, and skill-modifier effects', () => {
    const tree = cloneTree();
    node(tree, 'outer-warrior').effects = [
      { type: 'stat', stat: 'strength', amount: 4 },
      { type: 'statPercent', stat: 'maxLife', percent: 10 },
      { type: 'grantSkill', skill: 'doubleStrike', rank: 2 },
      { type: 'skillModifier', skill: 'stab', field: 'cost', amount: -5 },
    ];
    expect(messages(tree)).toBe('');
    const index = indexTree(tree);
    const player = newSession().player;
    selectClass(player, 'warrior');
    syncStats(player, index);
    const { strength, maxLife } = player;
    expect(skillRank(player, 'doubleStrike', index)).toBe(0);
    expect(allocateTreeNode(player.tree, 'outer-warrior', index)).toBe(true);
    syncStats(player, index);
    expect(player.strength).toBe(strength + 4);
    expect(player.maxLife).toBe(Math.floor(maxLife * 1.1));
    expect(skillRank(player, 'doubleStrike', index)).toBe(2);
    expect(effectiveSkill(player, 'stab', index).cost).toBe(
      skills.stab.cost - 5,
    );
    expect(effectiveSkill(player, 'split', index)).toBe(skills.split);
  });

  it('prunes allocations that no longer fit the tree', () => {
    const progress = {
      ...newTreeProgress(),
      origin: 'warrior' as const,
      allocated: ['capstone-warrior', 'removed-node', 'outer-warrior'],
    };
    expect(pruneTreeProgress(progress).allocated).toEqual([
      'outer-warrior',
      'capstone-warrior',
    ]);
    progress.allocated = ['capstone-warrior'];
    expect(pruneTreeProgress(progress).allocated).toEqual([]);
  });
});

describe('saves across content edits', () => {
  it('refunds and recomputes saves made against other content, but stays strict otherwise', () => {
    const session = newSession();
    selectClass(session.player, 'warrior');
    let raw = '';
    const storage = {
      getItem: () => raw || null,
      setItem: (_key: string, value: string) => {
        raw = value;
      },
    };
    expect(save(storage, session)).toContain('saved');
    const data = JSON.parse(raw);
    expect(data.content).toBe(CONTENT_HASH);
    data.player.tree.allocated = ['removed-node'];
    data.player.strength = 99;
    expect(() => decodeSave(JSON.stringify(data))).toThrow();
    data.content = 'older-content';
    const loaded = decodeSave(JSON.stringify(data)).player;
    expect(loaded.tree.allocated).toEqual([]);
    expect(loaded.strength).toBe(session.player.strength);
  });
});
