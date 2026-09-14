export type CombatEventPayload =
  | { type: 'battle-started'; encounterId: string; openingOrder: string[] }
  | {
      type: 'action-used';
      actorId: string;
      actionId: string;
      targetIds: string[];
    }
  | {
      type: 'resource-changed';
      actorId: string;
      resource: 'life' | 'qi' | 'energy';
      amount: number;
      source: string;
    }
  | {
      type: 'damage';
      targetId: string;
      amount: number;
      channel: 'physical' | 'qi';
      shieldAbsorbed: number;
    }
  | {
      type: 'status-applied';
      targetId: string;
      status: 'burn' | 'weaken' | 'silence';
      turns: number;
    }
  | { type: 'attack-avoided'; targetId: string; source: string }
  | { type: 'turn-started'; actorId: string; round: number }
  | { type: 'battle-ended'; outcome: 'victory' | 'defeat' | 'finished' };

export type CombatEvent = CombatEventPayload & { sequence: number };

interface EventTarget {
  eventSequence: number;
  events: CombatEvent[];
}

export function recordCombatEvent(
  target: EventTarget,
  payload: CombatEventPayload,
) {
  target.eventSequence++;
  target.events = [
    ...target.events.slice(-99),
    { ...payload, sequence: target.eventSequence } as CombatEvent,
  ];
}
