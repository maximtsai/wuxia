import { classes, type CombatAction, type Skill } from '../../content/phase2';
import { weapons } from '../../content/catalog';
import { effectiveSpeed, skillRank } from '../progression';
import { applyTreeStat, treeModifiers } from '../tree/effects';
import type { Player } from '../types';

export const BASIC_ATTACK_QI_GAIN = 10;

export const basicAttack: Skill = {
  name: 'Attack',
  icon: 'A',
  cost: 0,
  level: 1,
  requires: [],
  kind: 'physical',
  target: 'single',
  hits: 1,
  power: 7,
  description: '',
};

/** Shared by action previews and resolution so displayed base power cannot drift. */
export function calculateActionPower(
  player: Player,
  skill: Skill,
  id: CombatAction,
  rank: number,
  manaBeforeCost: number,
) {
  if (skill.kind === 'support' || skill.kind === 'passive') return 0;
  const characterClass = classes[player.classId ?? 'balanced'],
    tree = treeModifiers(player.tree);
  let power =
    skill.power +
    rank * 3 +
    weapons[player.weapon].damage +
    (skill.kind === 'magic'
      ? characterClass.magic +
        skillRank(player, 'energyField') * 7 +
        applyTreeStat(tree, 'qiPower', 0)
      : player.strength * 0.6 +
        characterClass.physical +
        skillRank(player, 'innerStrength') * 5 +
        applyTreeStat(tree, 'physicalPower', 0));
  if (id === 'speedStrike')
    power += effectiveSpeed(player) - player.strength * 0.6;
  // Avenger replaces normal scaling: 250% of the player's missing Life.
  if (skill.effect === 'avenger') power = (player.maxLife - player.life) * 2.5;
  if (skill.effect === 'manaBomb')
    power = manaBeforeCost * (0.55 + 0.08 * rank);
  return power;
}
