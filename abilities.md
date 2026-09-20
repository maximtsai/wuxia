# Ability reference

This document inventories every player action and learned skill discussed in
`tdd.md`. It separates reconstructed _Sinjid: Shadow of the Warrior_ behavior
from the successor game's approved shared-tree design. Original formulas remain
reference material; the **Successor design** sections are authoritative for the
new game.

> **Placeholder status:** Except for the universal Basic Attack restoring exactly
> **10 Qi** when it resolves, successor technique names, effects, coefficients,
> evolutions, Disciplines, Vows, node counts, and mastery choices in this document
> are design candidates rather than finalized moves. The shared topology, origin
> placement, connectivity, and respec foundations may be implemented independently
> of that provisional content.

## Completeness

The original roster contains:

- **3 basic actions:** Attack, Life Potion, and Mana Potion.
- **13 offensive active skills.**
- **3 support active skills.**
- **3 passive skills.**
- **19 learned skills total**, each accepting at most 10 Skill Points.
- **16 learned active skills total**, matching the successor UI requirement.

No additional player skill was found in the researched original-game roster.
Enemy-exclusive moves are outside this document.

The successor keeps **16 equipped active-technique identities**: 13 retained
original actives after three upgrades become evolutions rather than separate
buttons, plus Guard Stance, Qi Ward, and Smoke Step. Attack and potions remain
separate universal actions. The three original rankable passives become named
Disciplines in the shared passive tree.

## Sources and confidence

The detailed formulas below come from the community-maintained
[Sinjid Wiki skill reconstruction](https://sinjid.fandom.com/wiki/Skills_%28Sinjid%3A_Shadow_of_the_Warrior%29).
The [original Newgrounds release](https://www.newgrounds.com/portal/view/209736)
and its linked `209736_Sinjid2.swf` establish the 2004 game artifact. Contemporary
[Newgrounds strategy discussion](https://www.newgrounds.com/bbs/topic/215343/1)
corroborates practical behavior such as Avenger scaling with missing Life,
Split scaling with enemy Life, and Charge/Heal use.

The formula source is a reverse-engineered community reference rather than an
official manual. Exact original reproduction should therefore be checked in the
running Flash game or decompiled ActionScript before formulas become compatibility
requirements. Known source typos have been normalized where the intended variable
is unambiguous.

## Naming map

| Internal ID       | Successor display name | Original source name  |
| ----------------- | ---------------------- | --------------------- |
| `attack`          | Attack                 | Attack                |
| `stab`            | Stab                   | Stab                  |
| `shuriken`        | Flying Blades          | Shuriken              |
| `doubleStrike`    | Double Strike          | Double Strike         |
| `speedStrike`     | Speed Strike           | Speed Strike          |
| `energyShot`      | Qi Strike              | Energy Shot           |
| `blastFire`       | Blast Fire             | Blast Fire            |
| `verticalStrike`  | Vertical Strike        | Vertical Strike       |
| `shadowBlend`     | Lightfoot Steps        | Shadow Blend          |
| `energyField`     | Energy Field           | Energy Field          |
| `charge`          | Gather Qi              | Charge                |
| `innerStrength`   | Inner Strength         | Inner Strength        |
| `manaBomb`        | Qi Burst               | Mana Bomb             |
| `heal`            | Heal                   | Heal                  |
| `avenger`         | Avenger                | Avenger               |
| `split`           | Cut Down               | Split                 |
| `shadowStrike`    | Shadow Strike          | Shadow Strike         |
| `annihilate`      | Annihilate             | Annihilate            |
| `execution`       | Execution              | Execution             |
| `shadowReplicate` | Shadow Replicate       | Shadow Replicate      |
| `guardStance`     | Guard Stance           | New successor ability |
| `qiWard`          | Qi Ward                | New successor ability |
| `smokeStep`       | Smoke Step             | New successor ability |

The original Mana resource is called **Qi** in the successor. Formula names below
use successor vocabulary except where an original source name avoids ambiguity.

## Formula notation and original damage behavior

| Symbol      | Meaning                                                          |
| ----------- | ---------------------------------------------------------------- |
| `rX`        | Invested rank of skill X, from 1 through 10                      |
| `PD`        | Displayed Physical Damage stat                                   |
| `QD`        | Displayed Magical Damage stat, called Qi Damage in the successor |
| `STR`       | Strength                                                         |
| `SPD`       | Speed                                                            |
| `ESD`       | Equipment's Extra Shield Damage                                  |
| `EF`        | Energy Field rank                                                |
| `IS`        | Inner Strength rank                                              |
| `Qafter`    | Current Qi after paying Qi Burst's 1-Qi activation cost          |
| `MissingHP` | Max Life minus current Life                                      |
| `EnemyHP`   | Target's current Life before Split resolves                      |
| `R(x)`      | Random non-negative integer below `x`                            |

The source separates physical, qi/magical, Strength, shield, and random damage
components. Physical, qi, and Strength components are mitigated by their stated
defence channel and rounded upward; shield and random components are unmitigated.
Shield components apply only while the target has an active shield.

The original contains a known channel bug: `QD` feeds the physical component and
`PD` feeds the qi/magical component. The tables preserve that observed formula
shape. This is reference behavior, not a requirement to reproduce the bug.

The “accuracy” entry is the attacker's original Speed-based accuracy-roll input.
“Cannot miss” bypasses that roll. The successor does not use ordinary miss rolls.
Speed determines which combatant takes the first turn and contributes to bounded
critical chance; it never moves a combatant forward or backward within combat.

In successor formulas, `SPD` means the acting character's final Speed after gear
and passive modifiers. A listed `SPD` coefficient is added to the technique's
normal damage before critical and target mitigation are applied.

## Successor shared-tree design

All origins use one visible, connected passive tree. Wanderer starts at the center.
Warrior, Cultivator, and Windstep each start roughly midway between the center and
the outer edge of their themed region—not at its endpoint. From a specialist start,
traveling inward leads toward hybrid and cross-archetype options, while traveling
outward leads through deeper specialization to that archetype's most advanced
techniques, Disciplines, and Vow capstones.

The perimeter still links adjacent themes through three hybrid bridges: Warrior–Qi
is iron-body, Qi–Windstep is shadow arts, and Windstep–Warrior is weapon tempo.
Wanderer reaches the specialist starting rings quickly but requires more total
investment to reach any furthest-edge capstone.

### Node layout gradient (approved)

- **Pure stat nodes sit between abilities.** Many nodes are plain stat increases
  (Strength, Speed, Max Life, Max Qi, damage, defence, critical chance) placed between
  technique, Discipline, and Vow nodes. Because origins sit in different regions, each
  class organically grows different stats from the nodes around it. All classes share
  identical automatic per-level growth.
- **Center nodes are fundamental and drawback-free.** Near the Wanderer origin:
  - a **Qi recovery** node in the direction of the Cultivator;
  - a **Life recovery** node in the direction of the Warrior;
  - a **Quick Draught** node in the direction of the Windstep.

  Qi recovery nodes never modify Basic Attack's fixed 10-Qi restoration.

- **Edge nodes are extreme.** Nodes grow more specialized and powerful moving outward,
  and outer nodes pair their benefit with a real drawback, so they are a stronger
  commitment rather than strictly better than center nodes. Vows are the most extreme
  case; outer stat nodes and Disciplines may also carry drawbacks.

There is no per-level stat choice; stat nodes are the only player-directed stat growth.

**Quick Draught (approved).** Once per encounter, the player's first potion drink does
not end their turn; the player then takes another action. The drink still spends a
charge, does not advance statuses or enemy cadence, and resets each encounter and on
Retry prepared. It is an approved exception to potions taking the turn. Full rules are
in [tdd.md](tdd.md) §3.3.

**Other fundamental node ideas (candidates).** These were not chosen for the Windstep
direction but could sit between specialist directions or become small passives
elsewhere. Each respects the approved combat rules: no misses, fixed turn order after
the opening, Speed affecting only the opening side and critical chance, and Attack's
fixed 10 Qi.

| Candidate    | Effect idea                                                                              | Why it fits                                                                          |
| ------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Light Body   | Harmful statuses (Burn, Weaken, Silence) on the player last one fewer turn, minimum one. | Status recovery alongside the Life and Qi recovery nodes.                            |
| First Step   | The player's first action in each encounter gains bonus critical chance or damage.       | Rewards opening tempo without changing turn order; useful to every build.            |
| Keen Eye     | Enemy intents also show an estimated damage range; small flat critical chance.           | Lightness skill as awareness; supports the telegraph design and helps newer players. |
| Ready Stance | The player wins opening-Speed ties instead of the enemy.                                 | Minimal, clean Speed-identity node; matters most in close early fights.              |
| Flowing Cut  | Critical hits from techniques restore a small amount of Life. Attack is excluded.        | Connects crit identity to sustain; excluding Attack keeps the 10-Qi rule untouched.  |

The initial core is approximately 48 nodes (candidate counts), before a small set of
optional mastery nodes:

- 16 active-technique unlocks.
- 18 or more pure stat and small passive nodes, including Life, Qi, damage, defence,
  Speed, critical, recovery, healing, and status-effect improvements. The approved
  layout calls for many stat nodes, so this count is expected to grow.
- 10 named Disciplines with build-shaping effects.
- 4 Vows with a substantial benefit and drawback.

Every node costs one point. Techniques unlock at full base functionality and
scale automatically with character level and relevant stats. They do not have
ten linear ranks. Only selected techniques receive additional mastery nodes in
this first version; do not add two or three masteries to every technique. Start
with the three specified evolution masteries, and add other mastery options only
as needed. These are counted separately from the 48-node core (51 purchasable
nodes with only those three evolutions). A mastery is a side-grade unless explicitly
identified as an evolution. Existing mastery directions elsewhere are candidates,
not a requirement to implement every option immediately.

The main campaign should award roughly 20–25 points. This is a standard-play
pacing target, not a lifetime cap. Players who choose to grind may eventually
unlock the entire tree; do not add a point cap to prevent this.

### Origin starts

At character creation, activate the chosen origin anchor for free and grant
**one unspent tree point** immediately. The player spends it on an adjacent node;
there is no fixed pre-learned technique. The anchor is not part of the purchasable
node budget. Each other origin anchor is a freely traversable junction once reached
through an allocated path; it does not change the character's origin or grant
another starting point. The character's own anchor remains the connectivity root.

Origins grant position, slightly different starting stats, and starting
equipment—not growth multipliers. All classes use identical automatic per-level
growth (approved), so traveling to an off-origin branch remains viable and class stat
identity emerges from the stat nodes near each origin.

The three specialist origin nodes sit on their branch's middle ring. Each has a
clear inward route toward Wanderer and neighboring themes plus multiple outward
routes. No specialist origin node is itself a Vow, capstone, or advanced technique.

Each origin begins next to two immediate technique choices rather than receiving a
fixed learned skill:

| Origin     | Immediate choices             | Intended early identity                  |
| ---------- | ----------------------------- | ---------------------------------------- |
| Warrior    | Stab or Guard Stance          | Direct damage or durable counterplay     |
| Cultivator   | Qi Strike or Gather Qi        | Efficient spell damage or burst recovery |
| Windstep | Flying Blades or Speed Strike | Multi-target pressure or fast offense    |
| Wanderer   | First step toward any branch  | Flexible routing with slower capstones   |

Attack is universal and outside the tree, so no origin can be stranded without a
damage action or a way to regenerate Qi.

### Action-bar and evolution rules

The successor has no separate buttons for Shadow Strike, Annihilate, or Execution.
They are optional mastery evolutions that replace the behavior and presentation of
their base technique:

| Base technique | Evolution     | Result                                              |
| -------------- | ------------- | --------------------------------------------------- |
| Qi Strike      | Shadow Strike | Higher-cost, cannot-miss strike that applies Weaken |
| Blast Fire     | Annihilate    | Higher-cost three-hit focused attack retaining Burn |
| Double Strike  | Execution     | Higher-cost four-hit finisher                       |

An evolution occupies the base technique's existing action-bar slot and can be
reverted through the normal respec system. This frees three active slots for Guard
Stance, Qi Ward, and Smoke Step without expanding combat UI complexity.

### Qi economy

Qi recovery has multiple independent sources:

- **Attack:** restores 10 Qi after the action resolves, capped at Max Qi. This is
  unconditional and does not depend on damage dealt, critical hits, or a tree node.
- **Gather Qi:** spends a turn for a much larger burst of recovery. It is a build
  choice, never a prerequisite for Heal or any other technique.
- **Qi Potion:** the reusable charged potion provides emergency recovery and is
  outside the passive tree.
- Equipment affixes and selected passives may improve Qi recovery, but the base
  combat loop must remain functional without them.

The 10-Qi Attack value is an approved fixed rule, so Max-Qi stacking does not also
multiply baseline recovery.

### Tree integrity and respec rules

- All tree connections are bidirectional. Every node is eventually reachable from
  every origin; branches have no class-exclusive or one-way links. Loops and
  alternate routes are valid. Purchases must connect to the character's origin
  through allocated nodes and reached origin junctions.
- Respec resets the **entire tree**, not individual nodes or disconnected branches.
  Preview all refunded allocations, restored points, and equipment consequences.
  Confirmation removes every purchased node and mastery, retaining only the
  character's free origin anchor. Refund all spent points, including the initial
  point, without awarding that initial point a second time. Preserve unspent points,
  origin, earned progression, and the existing transactional confirmation rules.
- Travel nodes must give useful combat stats rather than functioning as taxes.
- Tree nodes require stable internal IDs and versioned save migrations.
- There are no boss-specific damage caps; scaling uses the same math on every target.
- The full tree is visible from the beginning and supports text search and filters.
- Respec is very cheap so experimenting with routes never feels costly.

### Limited-use techniques (approved)

Some techniques may be used only a limited number of times per encounter.

- A technique definition may declare a per-encounter use limit (once per fight, or N
  times). Techniques without a limit are unlimited.
- A use is spent once, on valid commitment, alongside the Qi cost. Rejected or
  duplicate commands spend nothing.
- Uses reset every encounter and are restored by Retry prepared; they never carry
  between fights and never recharge over turns. This is not a cooldown system.
- Buttons show remaining/maximum uses and keep their position when exhausted.

Which techniques are limited, their counts, and whether evolutions inherit limits
remain open. Strong candidates are high-impact moves such as Qi Burst, Shadow
Replicate, and the three evolutions.

### Successor combat terms and tooltip rules

**Avoided** is the successor's explicit term for an attack canceled by a defensive
effect such as Smoke Step. The game displays `AVOIDED` instead of `MISS`, and the
combat log names the effect that caused it. Ordinary attacks do not roll to miss.
Only attacks explicitly tagged **Unavoidable** bypass Avoid; historical “cannot
miss” wording does not grant that tag automatically.

Each tooltip shows its normal formula. When a target is selected, it also shows the
calculated damage contribution. **There are no boss-specific damage caps**: Split's
current-Life scaling and Avenger's missing-Life scaling use the same math against
bosses and ordinary enemies. General diminishing returns authored into an ability
apply to every target and are shown in the tooltip:

- **Qi Burst:** Let `Qspent` be Qi consumed after its activation cost. Effective Qi
  is `min(Qspent, 100) + 0.5×min(max(Qspent-100, 0), 100) +
0.25×max(Qspent-200, 0)`. The first 100 Qi contributes at 100%, the next 100 at
  50%, and Qi above 200 at 25%. The tooltip displays both Qi spent and effective
  Qi. This diminishing return applies against every target, not just bosses.

These constants are balance data, not hard-coded UI strings, so simulation,
combat resolution, and tooltips always read the same values.

## Basic actions

### Attack

- **Category:** Basic offensive action; not learned or upgraded.
- **Qi cost:** 0.
- **Target/hits:** One selected enemy, one hit.
- **Original accuracy input:** `SPD`.
- **Original components:** physical `QD`; Strength `STR`; qi `PD + 5×IS`;
  shield `ESD`; random `R(PD/3)`.
- **Successor design:** Remains a separate universal basic action and restores
  **10 Qi when the action resolves**, capped at Max Qi. The recovery occurs even if
  damage is prevented, ensuring every build always has a reliable Qi loop.

### Life Potion

- **Category:** Basic item action; not learned or upgraded.
- **Original effect:** Restore 80 Life and consume one Life Potion.
- **Successor status:** Superseded by the approved reusable, charged potion system.
  It is historical reference behavior, not a successor potion definition.

### Mana Potion / Qi Potion

- **Category:** Basic item action; not learned or upgraded.
- **Original effect:** Restore 80 Mana and consume one Mana Potion.
- **Successor status:** Superseded by the approved reusable, charged potion system.

## Offensive active skills

Unlocks and formulas in this section describe the original game. In the successor,
each retained technique is unlocked from the shared tree and scales with level and
stats instead of ranks 1–10.

### Stab

- **Unlock:** Level 1; Warrior starter.
- **Qi cost:** 15.
- **Target/hits:** One enemy, one hit.
- **Original accuracy input:** `SPD`.
- **Original components:** physical `QD`; Strength `STR`; qi
  `PD + 4×rStab + 5×IS`; shield `ESD`; random `R(PD/3) + R(10)`.
- **Successor design:** Retained as a direct, efficient single-target weapon
  technique in the Warrior region.

### Flying Blades / Shuriken

- **Unlock:** Level 1; Balanced/Wanderer starter.
- **Qi cost:** 20.
- **Target/hits:** Both enemies, one hit per enemy.
- **Original accuracy input:** `SPD`.
- **Original physical component:** `QD + 15 + 7×rShuriken + 7×EF`.
- **Enemy-specific components:** Enemy 1, the lower target, gets no Strength or
  shield component. Enemy 2, the upper target, additionally gets `STR` and `ESD`.
- **Original random component:** `R(PD/3) + R(5)`.
- **Known bug:** Shuriken rank also controls Double Strike's shield multiplier and
  the principal rank scaling of Shadow Strike and Annihilate.
- **Successor design:** Retained as early multi-target pressure available near the
  Windstep start. Both targets use the same transparent damage rules. Each hit
  gains bonus physical damage equal to `0.35×SPD`.

### Double Strike

- **Unlock:** Level 1 and Stab learned.
- **Qi cost:** 20, paid once.
- **Target/hits:** One enemy, two hits with the same scaling.
- **Original accuracy input:** `SPD`.
- Let `f = 0.52 + 0.08×rDoubleStrike`.
- **Original components per hit:** physical `QD×f`; Strength `STR×f`; qi
  `PD×f + 5×IS`; shield `ESD×(0.62 + 0.08×rShuriken)`; random `R(PD/3)`.
- **Known bug:** Its shield scaling reads Shuriken rank instead of Double Strike
  rank.
- **Successor design:** Retained in the Warrior–Windstep weapon-tempo bridge.
  Each hit gains bonus physical damage equal to `0.30×SPD`. An adjacent evolution
  mastery upgrades it into Execution in the same action slot.

### Speed Strike

- **Unlock:** Level 1 and Stab learned.
- **Qi cost:** 20.
- **Target/hits:** One enemy, one hit.
- **Original accuracy:** Cannot miss.
- **Original components:** physical `QD`; Strength `STR`; qi
  `PD + 0.6×SPD×rSpeedStrike + 5×IS`; shield `ESD`; random
  `R(PD/3) + R(5)`.
- **Successor design:** Retained near the Windstep start. Speed improves its
  damage by `1.25×SPD`; it never changes turn order after combat begins.

### Qi Strike / Energy Shot

- **Unlock:** Level 1 and Shuriken learned.
- **Qi cost:** 25.
- **Target/hits:** One enemy, one hit.
- **Original accuracy input:** `SPD + 5`.
- **Original components:** physical `QD + 40 + 9×rEnergyShot + 7×EF`;
  random `R(PD/3)`. No Strength, qi, or shield component is documented.
- **Successor design:** Retained near the Cultivator start. An adjacent evolution
  mastery upgrades it into Shadow Strike in the same action slot.

### Blast Fire

- **Unlock:** Level 1 and Shuriken learned.
- **Qi cost:** 25.
- **Target/hits:** Both enemies, two hits per enemy with the same scaling.
- **Original accuracy input:** `SPD + 5`.
- **Original components per hit:** physical
  `QD + 7 + 5×rBlastFire + 7×EF`; random `R(PD/3) + R(5)`.
- **Original status effects:** None documented. The successor's Burn effect is a
  new mechanic, not original behavior.
- **Successor design:** Retained as a two-hit area technique that applies Burn. An
  adjacent evolution mastery upgrades it into Annihilate in the same action slot.

### Vertical Strike

- **Unlock:** Level 1 and Double Strike learned.
- **Qi cost:** 20.
- **Target/hits:** One enemy, one hit.
- **Original accuracy input:** `SPD - 2`.
- **Original components:** physical `QD`; Strength
  `STR×(1 + 0.8×rVerticalStrike)`; qi `PD + 5×IS`; shield `ESD`; random
  `R(PD/3) + R(5)`.
- **Successor design:** Retained as a heavy single-target strike with explicit
  bonus damage against shields.

### Qi Burst / Mana Bomb

- **Unlock:** Level 5 and Energy Field learned.
- **Qi cost:** 1 to activate, then all remaining Qi is consumed.
- **Target/hits:** One selected enemy, one hit according to the available roster
  reconstruction; verify target behavior in the original runtime before treating
  this as authoritative.
- **Original accuracy input:** `SPD`.
- **Original components:** physical `Qafter×(0.7 + 0.8×rManaBomb)`; random
  `R(PD/3) + R(5)`.
- Damage is calculated after the 1-Qi cost. Energy Field does not affect it, and
  current Qi becomes zero after use.
- **Successor design:** Retained as an all-enemy attack that consumes all remaining
  Qi. Damage uses the displayed effective-Qi formula: 100% contribution through
  100 Qi spent, 50% from 101–200, and 25% above 200.

### Avenger

- **Unlock:** Level 10 and Inner Strength learned.
- **Qi cost:** 25.
- **Target/hits:** One enemy, one hit.
- **Original accuracy input:** `SPD`.
- **Original components:** physical `QD`; Strength `STR`; qi
  `PD + (1 + rAvenger)×MissingHP + 5×IS`; shield `ESD`; random
  `R(PD/3) + R(10)`.
- This unusually large missing-Life multiplier is consistent with contemporary
  reports of a rank-10 Avenger producing more than 3,000 damage after losing about
  300 Life.
- **Successor design:** Retained as a low-Life payoff. It costs 0 Qi, is limited to
  2 uses per encounter, and deals base power equal to 250% of the player's missing
  Life (defense and critical hits still apply). Damage is uncapped against every
  target, including bosses; the tooltip displays it. A child mastery node grants a
  third use per encounter.

### Split

- **Unlock:** Level 10 and Inner Strength learned.
- **Qi cost:** 25.
- **Target/hits:** One enemy, **one hit** in the original reference.
- **Original accuracy input:** `SPD`.
- **Original components:** physical `QD`; Strength `STR`; qi
  `PD + EnemyHP×(0.10 + 0.02×rSplit) + 5×IS`; shield `ESD`; random
  `R(PD/3) + R(10)`.
- The percentage term uses the target's current Life, making Split strongest early
  in a fight.
- **Successor design:** Renamed **Cut Down**. One hit for 30 Qi, with base power equal
  to 20% of the target's current Life at the moment of the hit. It cannot critically
  strike; defense and shields still apply. Damage is uncapped against every target,
  including bosses. A child mastery node raises it to 25% of current Life.

### Shadow Strike

- **Unlock:** Level 10, Shadow Blend learned, and Mana Bomb learned.
- **Qi cost:** 40.
- **Target/hits:** One enemy, one hit.
- **Original accuracy:** Cannot miss.
- **Original components:** physical
  `QD + 60 + 25×rShuriken + 7×EF`; random `R(PD/3) + R(5)`.
- **Known bug:** Shadow Strike's own rank does not increase its damage; Shuriken
  rank supplies the large rank term.
- **Original status effects:** None documented. The successor's Weaken effect is
  new behavior.
- **Successor design:** Not a separate technique node or action-bar button. It is
  Qi Strike's optional evolution and applies 25% Weaken for two turns. Like other
  ordinary successor attacks it has no miss roll, but it can be Avoided and is not
  Unavoidable.

### Annihilate

- **Unlock:** Level 10, Blast Fire learned, and Heal learned.
- **Qi cost:** 60, paid once.
- **Target/hits:** One enemy, three hits with the same scaling.
- **Original accuracy input:** `SPD`.
- **Original components per hit:** physical
  `QD + 15 + 7×rShuriken + 7×EF`; random `R(PD/3) + R(5)`.
- **Known bug:** Annihilate's own rank does not increase its damage; Shuriken rank
  is used instead.
- **Successor design:** Not a separate technique node or action-bar button. It is
  Blast Fire's optional evolution: a higher-cost, three-hit focused attack that
  retains Burn.

### Execution

- **Unlock:** Level 15, Avenger learned, and Split learned.
- **Qi cost:** 70, paid once.
- **Target/hits:** One enemy, four hits with the same scaling.
- **Original accuracy input:** `SPD`.
- **Original components per hit:** physical `QD`; Strength `STR`; qi
  `PD×(0.60 + 0.05×rExecution) + 5×IS`; shield `ESD`; random
  `R(PD/3) + R(10)`.
- **Successor design:** Not a separate technique node or action-bar button. It is
  Double Strike's optional evolution: a higher-cost four-hit finisher. Each hit
  gains `0.25×SPD`, for `1.00×SPD` across all four hits before mitigation.

## Support active skills

### Gather Qi / Charge

- **Unlock:** Energy Shot learned; Spell Caster/Cultivator starter.
- **Qi cost:** No cost is documented.
- **Target:** Self; consumes the combat turn.
- **Original effect:** Restore `25×rCharge` Qi, capped by Max Qi. Rank 10 restores
  250 Qi.
- **Successor design:** Retained as an optional Qi-region technique that spends a
  turn to restore a large amount of Qi. It is not required to unlock Heal or any
  other technique. Its initial tuning target is 30% Max Qi plus a modest flat
  amount, subject to playtesting.

### Heal

- **Unlock:** Level 5 and Charge learned.
- **Qi cost:** 15.
- **Target:** Self; consumes the combat turn.
- **Original effect:** Restore
  `MaxLife×(0.13 + 0.12×rHeal)`, capped at Max Life.
- The raw formula reaches 109% at rank 8, so rank 8 and above fill the Life bar.
- **Successor design:** Retained in the Warrior–Qi iron-body bridge and independently
  accessible; Gather Qi is not a prerequisite.

### Shadow Replicate

- **Unlock:** Level 15 and Shadow Strike learned.
- **Qi cost:** 100.
- **Target:** Self/summon slot.
- **Original effect:** Summon a shadow copy that fights beside Sinjid.
- **Shadow Max Life:** `70 + 30×rShadowReplicate`.
- **Shadow Physical Damage:** `13 + 12×rShadowReplicate`.
- **Shadow Magical/Qi Damage:** `13 + 12×rShadowReplicate`.
- **Shadow Speed:** `SinjidSpeed + 4×rShadowReplicate`.
- The researched roster does not specify its defences, exact basic-attack formula,
  duration, replacement behavior, or what happens when a shadow already exists.
  Those details require runtime or ActionScript verification.
- **Successor design:** Retained in the Qi–Windstep shadow-arts bridge. It does
  not require the Shadow Strike evolution, preventing one mastery choice from
  becoming a hidden prerequisite. The summon inherits 100% of the caster's final
  Speed when created; later changes to the caster's Speed do not retroactively
  alter the summon.

### Guard Stance

- **Category:** New successor support technique; Warrior region.
- **Qi cost:** Low; exact value is a balance constant.
- **Target:** Self; consumes the combat turn.
- **Effect:** Gain a temporary shield scaling with Max Life and Physical Defence.
  If an enemy damages that shield before the user's next turn, the user's next
  physical technique gains bonus damage.
- **Role:** Gives durable builds an active defensive choice and creates a readable
  defend-then-counter rhythm.

### Qi Ward

- **Category:** New successor support technique; Qi region.
- **Qi cost:** Moderate; exact value is a balance constant.
- **Target:** Self; consumes the combat turn.
- **Effect:** Gain a temporary shield scaling with Max Qi and Qi Damage. It absorbs
  Qi damage more efficiently than physical damage.
- **Mastery direction:** One adjacent mastery converts a limited portion of unused
  shield into Qi when the ward expires. Recovery is capped so it cannot create an
  infinite loop with repeated casting.

### Smoke Step

- **Category:** New successor support technique; Windstep region.
- **Qi cost:** Moderate; exact value is a balance constant.
- **Target:** Self; consumes the combat turn.
- **Effect:** The next direct single-target enemy hit before the user's next turn
  is **Avoided**. Area attacks, damage-over-time effects, and explicitly
  Unavoidable attacks bypass Smoke Step.
- **Mastery directions:** Counterattack after the Avoided hit for physical damage
  including `1.00×SPD`, cleanse one harmful status on use, or empower the next
  Flying Blades.
- **Turn-order rule:** Smoke Step never advances, delays, refunds, or otherwise
  changes a turn. Speed only decides who takes the first turn of combat.

## Original passive skill reference

### Lightfoot Steps / Shadow Blend

- **Unlock:** Level 1 and Speed Strike learned; Shadow Ninja/Windstep starter.
- **Original effect:** At battle start, add `2×rShadowBlend` Speed.
- No separate original critical modifier is documented. Any critical improvement in
  the successor is an indirect consequence of its Speed rules.

### Energy Field

- **Unlock:** Level 1 and Energy Shot learned.
- **Original effect:** Add `7×rEnergyField` to the affected physical-component
  formulas for Shuriken, Energy Shot, Blast Fire, Shadow Strike, and Annihilate.
- It does not affect Mana Bomb.
- Because of the original channel bug, this documented “magical-type” passive
  ultimately increases physical-type damage.

### Inner Strength

- **Unlock:** Level 5 and Vertical Strike learned.
- **Original effect:** Add `5×rInnerStrength` to the affected qi/magical-component
  formulas for Attack, Stab, Double Strike, Speed Strike, Vertical Strike,
  Avenger, Split, and Execution.
- Because of the original channel bug, this documented “physical-type” passive
  ultimately increases qi/magical-type damage.

## Successor Disciplines

Disciplines are one-point named passive nodes, not rankable learned skills and not
action-bar entries. The first tree uses these 10:

| Region        | Discipline        | Effect                                                                                                           |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| Warrior       | Iron Constitution | Increases Max Life and improves shields received.                                                                |
| Warrior       | Shield Breaker    | Physical techniques deal increased shield damage; excess shield damage partially carries into Life damage.       |
| Warrior       | Inner Strength    | Increases physical technique damage and improves the counter bonus from Guard Stance.                            |
| Qi            | Deep Meridian     | Placeholder: may improve Max Qi or other recovery without changing Attack's fixed 10-Qi rule.                    |
| Qi            | Controlled Burn   | Burn lasts longer, but cannot be refreshed beyond its duration cap.                                              |
| Qi            | Energy Field      | Increases Qi-technique damage and improves Qi Ward; it does not affect Qi Burst's Qi conversion.                 |
| Windstep    | First Blood       | Grants bounded critical chance against targets at full Life.                                                     |
| Windstep    | Relentless Rhythm | Later hits in a multi-hit technique gain a small damage bonus.                                                   |
| Windstep    | Lightfoot Steps   | Increases Speed and bounded critical chance; it has no mid-combat turn-order effect.                             |
| Center/hybrid | Flowing Steel     | A limited portion of the lower of Physical Damage and Qi Damage contributes to techniques using the higher stat. |

Inner Strength, Energy Field, and Lightfoot Steps therefore no longer exist as
ten-rank skills. Their names and identities survive as Disciplines with corrected,
explicit successor behavior.

## Successor Vows

Vows are one-point capstones that materially reshape a build. Their drawbacks are
part of the node and cannot be removed separately.

| Vow               | Benefit                                                                   | Drawback                                                                       |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Iron Root         | Greatly improves Defence and shields.                                     | Reduces bonuses gained from Speed; base Speed still determines who acts first. |
| Last Breath       | Strengthens Avenger and other low-Life effects.                           | Reduces all healing received.                                                  |
| Empty Vessel      | Techniques become stronger as current Qi falls.                           | Gather Qi restores less Qi. Attack and potion recovery are unchanged.          |
| Form Without Form | The lower of Physical Damage and Qi Damage rises toward the higher value. | Specialized single-damage-type bonuses are less effective.                     |

## Candidate successor departures

Only Attack's 10-Qi recovery is approved. The remaining rows are retained as
candidate directions so they can be evaluated later without being mistaken for
finalized move designs.

| Ability/system  | Original behavior                                     | Approved successor behavior                                                    |
| --------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------ |
| Attack          | Deals damage without restoring Mana                   | Restores 10 Qi unconditionally when resolved                                   |
| Blast Fire      | No status effect documented                           | Applies Burn                                                                   |
| Mana Bomb       | Reconstructed as one selected target                  | Qi Burst attacks all enemies and uses diminishing Qi conversion                |
| Split           | One hit                                               | Two hits; current-Life scaling uncapped, including against bosses              |
| Vertical Strike | No special shield tag                                 | Deals explicit bonus shield damage                                             |
| Shadow Strike   | Separate learned skill; no status effect documented   | Qi Strike evolution that applies two-turn 25% Weaken                           |
| Annihilate      | Separate learned skill                                | Blast Fire evolution that retains Burn                                         |
| Execution       | Separate learned skill                                | Double Strike evolution                                                        |
| Gather Qi       | Required along the route to Heal                      | Optional recovery technique; no dependent techniques                           |
| Shadow Blend    | Rankable passive adding Speed at battle start         | One-point Lightfoot Steps Discipline adding Speed and bounded critical chance  |
| Turn order      | Speed contributes to repeatable accuracy calculations | Speed decides only which side takes the first turn; turns never move afterward |

Ordinary attacks do not miss in the successor. Smoke Step is a discrete defensive
effect with explicit exceptions, not an accuracy or turn-order subsystem.

## Validation policy while the design is in flux

Do not maintain automated balance or build-viability simulations at this stage.
Retain tests for rule correctness, resources, connectivity, full-reset respecs,
reward settlement, persistence/migration, and UI behavior. Detailed ability,
mastery, and combat-resolution decisions remain deferred for the user.
