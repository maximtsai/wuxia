import type { CombatAction } from '../../content/phase2';
import type { Session } from '../types';
import { act, enemyAct } from '../session';

export type CombatCommand =
  | {
      type: 'use-action';
      actionId: CombatAction;
      token: number;
      targetId?: string | null;
    }
  | { type: 'resolve-npc-turn'; token: number };

export function dispatchCombatCommand(
  session: Session,
  command: CombatCommand,
  random: () => number = Math.random,
) {
  if (command.type === 'use-action')
    return act(
      session,
      command.actionId,
      command.token,
      random,
      command.targetId,
    );
  if (!session.battle || session.battle.token !== command.token) return false;
  return enemyAct(session, random);
}
