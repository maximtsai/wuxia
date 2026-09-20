# Original game reference

Research on _Sinjid: Shadow of the Warrior_. Everything here is **Reference**
behavior: it informs the successor design in [../tdd.md](../tdd.md) but does not
require reproduction. Where the successor differs, the TDD wins.

Detailed per-skill formulas and the successor ability design are in
[../abilities.md](../abilities.md).

## Sources and confidence

The primary formula source is the community-maintained
[Sinjid Wiki skill reconstruction](https://sinjid.fandom.com/wiki/Skills_%28Sinjid%3A_Shadow_of_the_Warrior%29),
cross-checked against the [original Newgrounds release](https://www.newgrounds.com/portal/view/209736)
and contemporary [Newgrounds strategy discussion](https://www.newgrounds.com/bbs/topic/215343/1).
The formulas are reverse-engineered community research, not an official
specification; verify them in the original runtime or ActionScript before treating
them as compatibility requirements.

## Classes

| Class      | Reference identity                                                                              | Starting skill | Starting weapon |
| ---------- | ----------------------------------------------------------------------------------------------- | -------------- | --------------- |
| Wanderer   | Generalist with no outstanding weakness                                                         | Flying Blades  | Iron Knife      |
| Warrior    | Strength- and Life-focused melee fighter; slower and weak in qi                                 | Stab           | Iron Knife      |
| Cultivator   | Qi-focused class with high Qi; relies on projected techniques, healing, Gather Qi, and Qi Burst | Gather Qi      | Energy Knife    |
| Windstep | Speed- and evasion-focused class with weaker physical power                                     | Shadow Blend   | Iron Knife      |

Starting stats and class-specific level-up boosts:

| Class      | Strength |   Speed | Max Life |   Max Qi | Physical Damage | Qi Damage | Physical Defence | Qi Defence |
| ---------- | -------: | ------: | -------: | -------: | --------------: | --------: | ---------------: | ---------: |
| Wanderer   |  15 (+2) | 15 (+2) | 75 (+10) | 75 (+10) |           3 (8) |         2 |                3 |          2 |
| Warrior    |  17 (+3) | 13 (+1) | 85 (+15) |  65 (+5) |          5 (10) |         0 |                5 |          0 |
| Cultivator   |  15 (+1) | 13 (+2) | 75 (+10) | 90 (+15) |               0 |    5 (10) |                0 |          5 |
| Windstep |  13 (+1) | 17 (+3) | 70 (+10) | 80 (+10) |           3 (8) |         3 |                2 |          2 |

All classes start with 50 Max Energy. Parenthesized values in stat columns are the
class-specific increase when that stat is chosen at level-up. Damage values shown as
`x (y)` are the documented base and total starting values.

The successor keeps modest starting differences but gives every class identical
per-level growth; class-specific boosts are superseded.

## Leveling

- Every level-up grants +5 Max Life, +5 Max Qi, +3 Max Energy, and 1 Skill Point.
- Every fifth level-up through level 95 grants an additional +2 Strength, +2 Speed,
  and 1 Skill Point.
- The player chooses Strength, Speed, Max Life, or Max Qi for the class-specific boost.
- The class reference table reports +5 Max Energy instead of +3 when Strength or Speed
  is chosen; the detailed Stats reference reports +2. The sources conflict; this value
  is not a successor requirement.
- Leveling restores Life, Qi, and Energy.
- EXP to the next level is `50 × current level`.
- On defeat, retry returns the character to the overworld with 5 Life, 5 Qi, and 5
  Energy.
- Each skill accepts up to 10 Skill Points.
- Class selection is permanent; changing class requires starting over.

## Turn order and accuracy

The original is not strictly player-then-enemy. The highest-Speed living unit acts
first, then the next highest. Ties resolve Enemy 1 > Enemy 2 > Sinjid > Shadow. Most
attacks roll Speed-derived accuracy for caster and target; the attack hits when the
caster's roll is strictly greater, and a caster with at least 1 more Speed than the
target is guaranteed to hit. Skills marked "cannot miss" bypass the roll. There is no
general cooldown system.

## Skill roster

The original has **19 learned skills** (13 offensive active, 3 support active, 3
passive) and **3 basic actions** (Attack, Life Potion, Mana Potion). No additional
player skill was found. Enemy-exclusive abilities are separate.

Notation: `rX` is rank of skill X; `PD` displayed Physical Damage; `QD` displayed
Magical (Qi) Damage; `STR` Strength; `SPD` Speed; `ESD` Extra Shield Damage; `EF` and
`IS` Energy Field and Inner Strength ranks; `R(x)` a random non-negative integer below
`x`. P, Q, Str, Sh, and Rnd are physical, qi, Strength, shield, and unmitigated random
components.

The original has a damage-channel bug: `QD` feeds physical components and `PD` feeds
qi components. The formulas preserve that shape. The bug is not a successor
requirement. Accuracy entries are the attacker's roll input; "always" bypasses it.

### Basic actions

| Action                  | Original target and detailed effect                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Attack                  | One enemy, one hit, 0 Qi. Accuracy `SPD`. Components: P `QD`; Str `STR`; Q `PD + 5×IS`; Sh `ESD`; Rnd `R(PD/3)`. |
| Life Potion             | Self. Restores 80 Life and consumes one disposable Life Potion.                                                  |
| Mana Potion / Qi Potion | Self. Restores 80 Mana/Qi and consumes one disposable potion.                                                    |

### Offensive active skills

| Successor name (original) | Unlock and cost                             | Original target, accuracy, and detailed formula                                                                                                                                                                       |
| ------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stab                      | Level 1; 15 Qi; Warrior starter             | One hit, one enemy; accuracy `SPD`. P `QD`; Str `STR`; Q `PD + 4×rStab + 5×IS`; Sh `ESD`; Rnd `R(PD/3) + R(10)`.                                                                                                      |
| Flying Blades (Shuriken)  | Level 1; 20 Qi; Wanderer starter            | One hit against both enemies; accuracy `SPD`. P `QD + 15 + 7×rShuriken + 7×EF`; Rnd `R(PD/3) + R(5)`. Enemy 1/lower gets no Str or Sh component; Enemy 2/upper also gets Str `STR` and Sh `ESD`.                      |
| Double Strike             | Level 1 + Stab; 20 Qi                       | Two equal hits against one enemy; cost paid once; accuracy `SPD`. With `f=0.52+0.08×rDoubleStrike`: P `QD×f`; Str `STR×f`; Q `PD×f + 5×IS`; Sh `ESD×(0.62+0.08×rShuriken)`; Rnd `R(PD/3)` per hit.                    |
| Speed Strike              | Level 1 + Stab; 20 Qi                       | One hit, one enemy; cannot miss. P `QD`; Str `STR`; Q `PD + 0.6×SPD×rSpeedStrike + 5×IS`; Sh `ESD`; Rnd `R(PD/3) + R(5)`.                                                                                             |
| Qi Strike (Energy Shot)   | Level 1 + Shuriken; 25 Qi                   | One hit, one enemy; accuracy `SPD+5`. P `QD + 40 + 9×rEnergyShot + 7×EF`; Rnd `R(PD/3)`; no other component documented.                                                                                               |
| Blast Fire                | Level 1 + Shuriken; 25 Qi                   | Two equal hits against each enemy; accuracy `SPD+5`. P `QD + 7 + 5×rBlastFire + 7×EF`; Rnd `R(PD/3) + R(5)` per hit. No original Burn is documented.                                                                  |
| Vertical Strike           | Level 1 + Double Strike; 20 Qi              | One hit, one enemy; accuracy `SPD-2`. P `QD`; Str `STR×(1+0.8×rVerticalStrike)`; Q `PD + 5×IS`; Sh `ESD`; Rnd `R(PD/3) + R(5)`.                                                                                       |
| Qi Burst (Mana Bomb)      | Level 5 + Energy Field; 1 Qi plus remainder | One reconstructed selected target, one hit; accuracy `SPD`. After paying 1 Qi, P `remaining Qi×(0.7+0.8×rManaBomb)`; Rnd `R(PD/3) + R(5)`; then Qi becomes 0. Energy Field does not apply. Verify original targeting. |
| Avenger                   | Level 10 + Inner Strength; 25 Qi            | One hit, one enemy; accuracy `SPD`. P `QD`; Str `STR`; Q `PD + (1+rAvenger)×missing Life + 5×IS`; Sh `ESD`; Rnd `R(PD/3) + R(10)`.                                                                                    |
| Split                     | Level 10 + Inner Strength; 25 Qi            | **One original hit**, one enemy; accuracy `SPD`. P `QD`; Str `STR`; Q `PD + target current Life×(0.10+0.02×rSplit) + 5×IS`; Sh `ESD`; Rnd `R(PD/3) + R(10)`.                                                          |
| Shadow Strike             | Level 10 + Shadow Blend + Mana Bomb; 40 Qi  | One hit, one enemy; cannot miss. P `QD + 60 + 25×rShuriken + 7×EF`; Rnd `R(PD/3) + R(5)`. Its own rank does not scale damage due to a bug. No original Weaken is documented.                                          |
| Annihilate                | Level 10 + Blast Fire + Heal; 60 Qi         | Three equal hits against one enemy; accuracy `SPD`; cost paid once. P `QD + 15 + 7×rShuriken + 7×EF`; Rnd `R(PD/3) + R(5)` per hit. Its own rank does not scale damage due to a bug.                                  |
| Execution                 | Level 15 + Avenger + Split; 70 Qi           | Four equal hits against one enemy; accuracy `SPD`; cost paid once. P `QD`; Str `STR`; Q `PD×(0.60+0.05×rExecution) + 5×IS`; Sh `ESD`; Rnd `R(PD/3) + R(10)` per hit.                                                  |

Cross-skill bugs: Shuriken rank controls Double Strike's shield multiplier and the main
rank scaling of Shadow Strike and Annihilate. Do not reproduce them silently.

### Support active skills

| Successor name (original) | Unlock and cost                                           | Original detailed effect                                                                                                                                                                                                                     |
| ------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gather Qi (Charge)        | Energy Shot learned; no cost documented; Cultivator starter | Self; consumes the turn; restores `25×rCharge` Qi, capped at Max Qi. Rank 10 restores 250.                                                                                                                                                   |
| Heal                      | Level 5 + Charge; 15 Qi                                   | Self; consumes the turn; restores `Max Life×(0.13+0.12×rHeal)`, capped at Max Life. The raw formula exceeds 100% at rank 8.                                                                                                                  |
| Shadow Replicate          | Level 15 + Shadow Strike; 100 Qi                          | Summons a shadow ally with Max Life `70+30×r`, Physical Damage `13+12×r`, Magical/Qi Damage `13+12×r`, and Speed `Sinjid Speed+4×r`. Defence, duration, repeat-cast, replacement, and exact attack behavior are not specified by the source. |

### Passive skills

| Successor name (original)      | Unlock                                     | Original detailed effect                                                                                                                                                                                                             |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Lightfoot Steps (Shadow Blend) | Level 1 + Speed Strike; Windstep starter | At battle start, adds `2×rShadowBlend` Speed. No separate critical bonus is documented.                                                                                                                                              |
| Energy Field                   | Level 1 + Energy Shot                      | Adds `7×rEnergyField` to Shuriken, Energy Shot, Blast Fire, Shadow Strike, and Annihilate formulas. It does not affect Mana Bomb. Because of the channel bug, the documented magical passive ultimately raises physical-type damage. |
| Inner Strength                 | Level 5 + Vertical Strike                  | Adds `5×rInnerStrength` to Attack, Stab, Double Strike, Speed Strike, Vertical Strike, Avenger, Split, and Execution formulas. Because of the channel bug, the documented physical passive ultimately raises qi/magical-type damage. |

Only one class starter is learned at game start. Charge and Shadow Blend are starter
exceptions despite their ordinary prerequisites.

### Temporary prototype differences

The playable compatibility prototype adds Burn to Blast Fire, makes Mana Bomb
multi-target, tags Vertical Strike and Split with special shield behavior, makes Split
two hits, adds Weaken to Shadow Strike, and describes Shadow Blend as contributing to
critical scaling. These are noncanonical placeholders kept only to keep the prototype
playable; replace or remove them when the successor roster is approved.

## Portals and training

| Portal or activity | Reference structure and behavior                                                                                                                                                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Human Gateway      | First main portal; 20 increasingly difficult levels. Some levels contain two enemies. Victories provide experience, gold, and sometimes item drops. Completing all 20 is the primary progression milestone.                                         |
| Monster Portal     | Optional second portal; 10 increasingly difficult levels containing undead, demons, insects, and other mythical creatures. It is generally harder than the Human Gateway.                                                                           |
| Dark Rift          | Final and hardest portal; 5 levels with enemies possessing special abilities and unusually high difficulty. Access is gated by progression. The exact relationship between Dark Rift completion and the ending remains a design/reference question. |
| Training Ward      | Repeatable training activity with 3 difficulty settings. Grants EXP per damaging hit and consumes Energy per damaging hit. No gold or item drops.                                                                                                   |

Sources agree Dark Rift access is gated by Human Gateway progress but differ on whether
other portals must also be completed. The successor resolves this: Human stage 20
unlocks the Dark Rift and ending.

| Training Ward difficulty | Recommended level | Energy per damaging hit | Base EXP per damaging hit | EXP after shield is depleted | Reference ward stats              |
| ------------------------ | ----------------: | ----------------------: | ------------------------: | ---------------------------: | --------------------------------- |
| Basic Training           |          Level 1+ |                       2 |                         3 |                            6 | 80 Life; 300 shield HP; Speed 15  |
| Training                 |          Level 5+ |                       3 |                         5 |                           10 | 180 Life; 500 shield HP; Speed 30 |
| Advanced Training        |         Level 10+ |                      10 |                        20 |                           40 | 300 Life; 700 shield HP; Speed 40 |

- Once the shield is depleted, EXP doubles; Energy cost does not change. Old-game
  behavior around the breaking hit may differ from documentation.
- Non-damaging actions such as Charge, Heal, and item use cost no Energy.
- The player can end training at any time; zero Energy ends it.
- A training level-up restores Energy.
- The ward fights back.

## Energy

The original drained Energy while walking, applied post-victory costs, and returned
defeated players with low resources. The successor supersedes all of these.

## Temple rooms

User-supplied screenshots and notes. Confirmed and inferred connections are kept
distinct; `layout.png` is the successor implementation authority.

| Room                     | Reference function and user-supplied or inferred connections                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry                    | Contains the entrance NPCs, including healing/restoration and saving functions. Up leads to potions/food. Down is the exit/end route after the required main progression. |
| Potions and food         | Sells recovery items and food. Left leads to Human Gateway, right to weapons/merchant, and down to entry according to the current room notes.                             |
| Human Gateway            | Main progression portal consisting of 20 levels.                                                                                                                          |
| Weapons and merchant     | Basic weapons and a repeatable merchant work/delivery activity for money. Up leads upstairs according to the current room notes.                                          |
| Upstairs                 | Lounge area with additional NPCs and secrets. Left leads to advanced equipment according to the current room notes.                                                       |
| Advanced equipment       | Mid-tier equipment and weapons. Left leads to library according to the current room notes.                                                                                |
| Library                  | Lore, hints, information, and delivery destination for merchant work.                                                                                                     |
| Statue room              | Statue and two guards. Left is currently recorded as leading toward the high-difficulty area, but this connection is not fully verified.                                  |
| High-difficulty entryway | Leads toward the optional high-difficulty area; the screenshot identification is inferred.                                                                                |
| Monster gate room        | Contains the Monster Portal and nearby Training Ward access according to the current room notes; exact connections remain provisional.                                    |
| Training room            | Repeatable Training Ward with 3 difficulty settings; exact room connection remains provisional.                                                                           |
| High-difficulty room     | Contains high-level equipment and the Dark Rift or equivalent hardest portal; exact identity and prerequisites remain provisional.                                        |

The ninth and tenth screenshots appeared to show the high-difficulty entryway and
Monster Gate room; that identification was inferred.

## Reference mockup

A generated combat UI concept exists at:

```
C:\Users\Maxim\Documents\Codex\2026-09-11\what-is-the-game-sinjid-shadow-2\combat-ui-16-skills.png
```

Treat it as a visual reference only. Its names, costs, levels, and damage numbers are
illustrative and not a balance specification. Do not include it in the production
bundle.
