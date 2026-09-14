import {
  rooms,
  doorways,
  doorwayRadius,
  type ExitDirection,
  portals,
  portalStage,
  type RoomId,
  type PortalId,
} from '../content/world';
import { weapons, type WeaponId } from '../content/catalog';
import type { Session } from './types';
export function travelReason(s: Session, to: string): string | null {
  if (s.battle) return 'Return from combat first';
  if (!s.player.classId) return 'Choose a class first';
  if (!Object.values(rooms[s.world.room].exits).includes(to as never))
    return 'No connecting exit';
  if ((to === 'ending' || to === 'rift') && s.world.cleared.human < 20)
    return 'Complete all 20 Human Gateway stages';
  return null;
}
export function travel(s: Session, to: RoomId) {
  if (travelReason(s, to)) return false;
  const entrance = Object.entries(rooms[to].exits).find(
    ([, room]) => room === s.world.room,
  );
  if (!entrance) return false;
  s.world.room = to;
  s.position = { ...doorways[entrance[0] as ExitDirection].arrival };
  if (to === 'ending') s.world.endingSeen = true;
  return true;
}
export function travelThroughDoorway(s: Session) {
  for (const [direction, to] of Object.entries(rooms[s.world.room].exits)) {
    const doorway = doorways[direction as ExitDirection];
    if (
      Math.hypot(s.position.x - doorway.x, s.position.y - doorway.y) <=
      doorwayRadius
    )
      return travel(s, to as RoomId);
  }
  return false;
}
export function campaignReason(s: Session, id: string) {
  const stage = portalStage(id);
  if (!stage) return null;
  if (stage.stage < 1 || stage.stage > portals[stage.portal].count)
    return 'Unknown stage';
  if (s.world.room !== stage.portal) return 'Visit the corresponding portal';
  if (stage.portal === 'rift' && s.world.cleared.human < 20)
    return 'Complete the Human Gateway first';
  if (stage.stage > s.world.cleared[stage.portal] + 1)
    return 'Clear the previous stage first';
  return null;
}
export function completeStage(s: Session, id: string) {
  const v = portalStage(id);
  if (!v || v.stage !== s.world.cleared[v.portal] + 1) return false;
  s.world.cleared[v.portal] = v.stage;
  return true;
}
export function delivery(s: Session) {
  if (s.battle || !s.player.classId) return false;
  if (s.world.room === 'merchant' && !s.world.delivery) {
    s.world.delivery = true;
    return true;
  }
  if (s.world.room === 'library' && s.world.delivery) {
    s.world.delivery = false;
    s.world.deliveries++;
    s.player.gold += 35;
    return true;
  }
  return false;
}
export const shopStock: Partial<Record<RoomId, WeaponId[]>> = {
  merchant: ['earned', 'swift'],
  advanced: ['tempered', 'focus'],
  rift: ['masterwork'],
};
export function buyWeapon(s: Session, id: WeaponId) {
  if (
    s.battle ||
    !s.player.classId ||
    !shopStock[s.world.room]?.includes(id) ||
    s.player.inventory.includes(id) ||
    s.player.gold < weapons[id].price
  )
    return false;
  s.player.gold -= weapons[id].price;
  s.player.inventory.push(id);
  return true;
}
export const portalIds = Object.keys(portals) as PortalId[];
