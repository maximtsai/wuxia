import rawTree from './data/tree.json' with { type: 'json' };
import { skillIds } from './phase2';
import {
  indexTree,
  validateTreeData,
  type ClassId,
  type TreeData,
} from './schema';
export type {
  TreeData,
  TreeEffect,
  TreeIndex,
  TreeNodeDefinition,
  TreeNodeKind,
  TreeStat,
} from './schema';

/** Node ids come from `data/tree.json`, so they are validated at load time rather than typed. */
export type TreeNodeId = string;

export function loadTreeData(
  data: unknown,
  knownSkillIds: readonly string[] = skillIds,
): TreeData {
  const issues = validateTreeData(data, { skillIds: knownSkillIds });
  if (issues.length)
    throw new Error(
      'Invalid tree content: ' + issues.map((i) => i.message).join('; '),
    );
  return data as TreeData;
}

/**
 * Shared-tree content, edited with editor.html. Placeholder nodes establish
 * topology without committing the game to final techniques or balance.
 */
export const treeData = loadTreeData(rawTree);
export const treeIndex = indexTree(treeData);
export const treeNodes = treeIndex.nodes;
export const treeNodeById = treeIndex.byId;
export const originNodeByClass: Readonly<Record<ClassId, TreeNodeId>> =
  treeIndex.originByClass;

export function validateTreeContent() {
  loadTreeData(treeData);
}
