import { potions } from '../content/catalog';
import { slottedBottle } from '../core/session';
import type { Player } from '../core/types';

/** Read-only preparation status; drinking remains a combat action. */
export function bottleDock(player: Player) {
  return `<div class="potions bottle-dock" aria-label="Equipped potions">${[
    0, 1,
  ]
    .map((slot) => {
      const bottle = slottedBottle(player, slot);
      const def = bottle ? potions[bottle.type] : null;
      const color =
        bottle?.type === 'mana'
          ? '#86cddb'
          : bottle?.type === 'hybrid'
            ? '#b494d5'
            : bottle?.type === 'fortify'
              ? '#d9b35a'
              : '#cc6860';
      return `<div class="bottle-slot ${!bottle || !bottle.charges ? 'depleted' : ''}" style="--bottle-color:${color}" tabindex="0" aria-label="Slot ${slot + 1}: ${def?.name ?? 'Empty'}${bottle && def ? `, ${bottle.charges} of ${def.charges} charges` : ''}" title="${def ? `${def.name}: ${def.life} Life, ${def.mana} Qi${def.guard ? ', guard buff' : ''}. Used in combat; refill at the well.` : 'Equip a bottle at the potion seller.'}"><span class="bottle-number">${slot + 1}</span><span class="bottle-icon" aria-hidden="true"></span><strong>${bottle && def ? `${bottle.charges}/${def.charges}` : 'Empty'}</strong><span class="charge-pips" aria-hidden="true">${def ? Array.from({ length: def.charges }, (_, i) => `<i class="${i < bottle!.charges ? 'filled' : ''}"></i>`).join('') : ''}</span></div>`;
    })
    .join('')}</div>`;
}
