import { treeIndex, type TreeNodeId } from '../../content/tree';
import type {
  ClassId,
  TreeIndex,
  TreeNodeDefinition,
} from '../../content/schema';

export interface TreeProgress {
  origin: ClassId | null;
  allocated: TreeNodeId[];
  masteries: Record<string, TreeNodeId>;
}

export const newTreeProgress = (): TreeProgress => ({
  origin: null,
  allocated: [],
  masteries: {},
});

export function copyTreeProgress(progress: TreeProgress): TreeProgress {
  return {
    origin: progress.origin,
    allocated: [...progress.allocated],
    masteries: { ...progress.masteries },
  };
}

function reachable(progress: TreeProgress, index: TreeIndex) {
  if (!progress.origin) return new Set<TreeNodeId>();
  const allowed = new Set<string>([
    ...progress.allocated,
    ...index.nodes.filter((node) => node.kind === 'origin').map((n) => n.id),
  ]);
  const start = index.originByClass[progress.origin];
  const seen = new Set<TreeNodeId>([start]);
  const pending: TreeNodeId[] = [start];
  while (pending.length) {
    const current = pending.shift()!;
    for (const next of index.byId[current].connections)
      if (allowed.has(next) && !seen.has(next)) {
        seen.add(next);
        pending.push(next);
      }
  }
  return seen;
}

export function treeAllocationReason(
  progress: TreeProgress,
  id: TreeNodeId,
  index: TreeIndex = treeIndex,
) {
  if (!progress.origin) return 'Choose an origin';
  const node: TreeNodeDefinition | undefined = index.byId[id];
  if (!node) return 'Unknown tree node';
  if (node.kind === 'origin') return 'Origin junctions are free';
  if (progress.allocated.includes(id)) return 'Already allocated';
  const connected = reachable(progress, index);
  if (!node.connections.some((other) => connected.has(other)))
    return 'Node is not connected to the allocated path';
  if (
    node.masteryGroup &&
    progress.masteries[node.masteryGroup] &&
    progress.masteries[node.masteryGroup] !== id
  )
    return 'Choose only one mastery in this group';
  return null;
}

export function allocateTreeNode(
  progress: TreeProgress,
  id: TreeNodeId,
  index: TreeIndex = treeIndex,
) {
  if (treeAllocationReason(progress, id, index)) return false;
  progress.allocated.push(id);
  const node = index.byId[id];
  if (node.masteryGroup) progress.masteries[node.masteryGroup] = id;
  return true;
}

/** Clears purchased nodes while preserving the class-specific starting point. */
export function resetTreeProgress(progress: TreeProgress) {
  const refunded = progress.allocated.length;
  progress.allocated = [];
  progress.masteries = {};
  return refunded;
}

function assertShape(progress: TreeProgress) {
  if (
    !progress ||
    typeof progress !== 'object' ||
    !Array.isArray(progress.allocated) ||
    progress.allocated.some((id) => typeof id !== 'string') ||
    !progress.masteries ||
    typeof progress.masteries !== 'object' ||
    Array.isArray(progress.masteries)
  )
    throw new Error('Invalid tree progress');
}

/** Re-allocates stored nodes in any valid order; returns the rebuilt progress and ids that could not be placed. */
function rebuild(progress: TreeProgress, index: TreeIndex) {
  const copy: TreeProgress = {
    origin: progress.origin,
    allocated: [],
    masteries: {},
  };
  const remaining = [...new Set(progress.allocated)];
  let changed = true;
  while (remaining.length && changed) {
    changed = false;
    for (const id of [...remaining])
      if (!treeAllocationReason(copy, id, index)) {
        allocateTreeNode(copy, id, index);
        remaining.splice(remaining.indexOf(id), 1);
        changed = true;
      }
  }
  return { copy, remaining };
}

export function validateTreeProgress(
  progress: TreeProgress,
  index: TreeIndex = treeIndex,
) {
  assertShape(progress);
  if (progress.origin === null) {
    if (progress.allocated.length || Object.keys(progress.masteries).length)
      throw new Error('Unselected origin cannot have tree allocations');
    return;
  }
  if (!Object.hasOwn(index.originByClass, progress.origin))
    throw new Error('Unknown tree origin');
  if (new Set(progress.allocated).size !== progress.allocated.length)
    throw new Error('Duplicate tree allocation');
  const { copy, remaining } = rebuild(progress, index);
  if (remaining.length)
    throw new Error('Disconnected or invalid tree allocation');
  if (JSON.stringify(copy.masteries) !== JSON.stringify(progress.masteries))
    throw new Error('Invalid mastery selections');
}

/**
 * Keeps only allocations that are still valid for the current tree content,
 * refunding nodes that were removed, disconnected, or now conflict.
 */
export function pruneTreeProgress(
  progress: TreeProgress,
  index: TreeIndex = treeIndex,
) {
  assertShape(progress);
  if (progress.origin === null || !index.originByClass[progress.origin])
    return { ...newTreeProgress(), origin: progress.origin };
  return rebuild(progress, index).copy;
}
