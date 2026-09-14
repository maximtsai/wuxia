# The Wandering Path — Game Design Document

## How to use this document

This is the canonical design for the successor game. It describes what the game
**should** be. Other documents cover everything else:

| Document                                             | Purpose                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| [abilities.md](abilities.md)                         | Shared tree, techniques, Disciplines, Vows, and per-ability detail |
| [docs/reference-sinjid.md](docs/reference-sinjid.md) | Research on the original _Sinjid: Shadow of the Warrior_           |
| [docs/technical-design.md](docs/technical-design.md) | What the running build currently implements                        |
| [docs/decisions.md](docs/decisions.md)               | Implementation choices actually made                               |
| [docs/backlog.md](docs/backlog.md)                   | Unimplemented work                                                 |
| [docs/history.md](docs/history.md)                   | Completed phase acceptance records (historical, not instructions)  |

Every rule carries one of these statuses:

- **Approved** — a user requirement. Implement it when its phase is authorized.
- **Candidate** — a proposal. Keep it visible, but do not silently turn it into a rule.
- **Open** — a decision the user still needs to make.
- **Reference** — original-game behavior. It informs design but does not require
  reproduction, and lives in `docs/reference-sinjid.md`.

Unlabeled rules inside an **Approved** section are approved. Exact numbers
(coefficients, prices, node counts, stats) are balance data unless stated otherwise.
This document does not claim that approved rules are already implemented; check
`docs/technical-design.md` and `docs/backlog.md` for status.

## 1. Vision

### 1.1 Product — Approved

- An original HTML5 **wuxia martial-arts RPG**, working title **The Wandering
  Path**, inspired mechanically by _Sinjid: Shadow of the Warrior_.
- Eventual publication on CrazyGames.
- Original title, characters, story, artwork, and audio. Reference screenshots are
  design references, not production assets; do not assume rights to the original
  game's assets or identity.
- Project folder: `C:\Users\Maxim\Desktop\maxgames\sinjid`. Preserve existing work
  and keep `README.md` accurate.

### 1.2 Design pillars

**Preserve from the original:**

- A compact, inhabited temple hub with recognizable destinations.
- Tactical, left-versus-right turn-based duels against one or two enemies.
- The preparation → battle → reward → upgrade → retry loop.
- Meaningful stat and technique choices, and distinct build identities from four
  starting classes.
- Resource management across Life, Qi, Energy, potions, food, and training.
- Fixed, understandable item progression with exciting weapon, armor, and shield
  milestones.
- Alternate challenges when one encounter is hard, and optional mastery content after
  the main campaign.

**Modernize:**

- No ordinary misses; Speed decides the opening side and critical chance.
- Enemy intent is telegraphed before the player acts.
- Gate previews show the next encounter before any cost is paid.
- Same-encounter **Retry prepared** without a recovery trip.
- Refillable potions instead of stockpiled consumables.
- One shared tree with cheap respecs instead of permanent rank investments.
- Organic mini-quests instead of repetitive delivery grinding.
- Deterministic rewards; no randomized loot.

### 1.3 Problems the successor addresses

Limited reviews and a retrospective of the original reported class imbalance, a
Blood Spirit difficulty spike, tedious herb-delivery gold grinding, limited ability to
correct skill choices, poorly explained progression bonuses, and potions becoming weak
late. Treat these as hypotheses to verify through playtesting.

### 1.4 Setting and vocabulary — Approved

The player is a martial artist entering the jianghu, training among temple schools,
rival disciples, itinerant masters, and secluded mountain paths. Sinjid remains a
mechanical reference, not the visual or cultural setting.

- Mana is displayed as **Qi**; magic damage and defense become **Qi damage / Qi
  defense**.
- Describe abilities as martial techniques, qi circulation, palm strikes, flying
  blades, and lightness skill rather than spells.
- **Qi** powers techniques. **Energy** pays encounter and training costs. They are
  distinct resources. Renaming grants no extra powers and changes no numbers.

### 1.5 Art direction — Approved

- Bold, thick, confident brush strokes; rough dry-brush edges; large flat masses of
  ink and pigment; spare facial marks and cloth folds. Portraits should feel
  deliberately drawn by hand.
- A distinct, readable action silhouette for every class. No character looks at the
  viewer.
- Avoid excess detail, filigree, glossy surfaces, photoreal skin, particle clouds,
  polished gradients, ornate fantasy armor, and interchangeable front-facing poses.
- Express qi with a few purposeful brush marks. Favor hanfu, plain sashes,
  dao/jian/staff silhouettes, and restrained paper texture.
- Keep art separate from UI text and rules.

### 1.6 Save-compatible naming — Approved

Retain internal IDs `balanced`, `warrior`, `caster`, `shadow`, `mana`, `maxMana`, and
`magic` so existing saves and formulas remain valid. Player-facing names:

| Internal / original     | Display name    |
| ----------------------- | --------------- |
| Balanced / Talentless   | Wanderer        |
| Spell Caster (`caster`) | Qi Adept        |
| Shadow Ninja (`shadow`) | Swiftblade      |
| Shuriken                | Flying Blades   |
| Charge                  | Gather Qi       |
| Energy Shot             | Qi Strike       |
| Mana Bomb               | Qi Burst        |
| Shadow Blend            | Lightfoot Steps |

Original names may remain in research citations and internal keys only. The full
naming map is in [abilities.md](abilities.md).

## 2. Campaign structure and core loop

### 2.1 Core loop — Approved

1. Explore the temple freely; buy, equip, refill potions, recover, allocate the tree.
2. Interact with a gate to open its encounter preview.
3. Prepare, or confirm entry and pay the Energy fee.
4. Fight. On defeat, Retry prepared or return to the temple.
5. On victory, settle rewards once; level up and grow.

### 2.2 Portals — Approved

| Portal         | Stages | Role                                                     | Replay after clearing |
| -------------- | -----: | -------------------------------------------------------- | --------------------- |
| Human Gateway  |     20 | Required main campaign; clearing stage 20 unlocks ending | **Not replayable**    |
| Monster Portal |     10 | Optional; harder than the Human Gateway                  | Replayable            |
| Dark Rift      |      5 | Optional; hardest; unlocked by clearing Human stage 20   | Replayable            |

- Stages are cleared in order. A new victory unlocks the next stage once. Defeat,
  retreat, and prepared retries grant no clearance.
- **Human Gateway stages cannot be replayed once cleared.** Their rewards settle
  exactly once. Retry prepared after a defeat is not a replay: the stage is still
  uncleared.
- Monster Portal completion is not required for the ending or Dark Rift.
- The player can return to unfinished content after the ending.
- Some stages contain two enemies.

**Open:** With Human stages non-replayable, a struggling player below the Monster
Portal's first stage (suggested level 9) has only the Training Ward and mini-quests for
repeatable EXP and gold. Confirm this catch-up path is sufficient during playtesting.

### 2.3 Temple map — Approved

The user-supplied `layout.png` is the room-graph authority (12 temple rooms plus the
ending). Research notes on the original map are in the reference document.

| Room                     | Function                                                             |
| ------------------------ | -------------------------------------------------------------------- |
| Entry                    | Recovery and saving NPCs; ending route below after Human stage 20    |
| Potions and food         | Potion seller, neighboring refill well, food; leads to Human Gateway |
| Human Gateway            | Main campaign portal                                                 |
| Weapons and merchant     | Basic weapons; merchant quest-giver                                  |
| Upstairs                 | Lounge, NPCs, secrets; Mentor respecs                                |
| Advanced equipment       | Mid-tier equipment                                                   |
| Library                  | Lore, hints, information; quest destination                          |
| Statue room              | Statue and two guards                                                |
| High-difficulty entryway | Approach to the optional high-difficulty area                        |
| Monster gate room        | Monster Portal and Training Ward access                              |
| Training room            | Training Ward with three difficulties                                |
| High-difficulty room     | High-level equipment and the Dark Rift                               |

Keep distinctive landmarks in each room, a consistent exploration HUD, and an
inhabited temple.

**Candidate:** Show destination names near exits, offer convenient equipment
comparison, and reduce repetitive travel for already-understood services while
preserving the hub's atmosphere.

## 3. Character

### 3.1 Classes — Approved

Class selection happens before the game world and is permanent. Class changes are not
approved. Classes appear left to right in this order:

| Class      | Direction                                          | Accent            | Portrait action                                    |
| ---------- | -------------------------------------------------- | ----------------- | -------------------------------------------------- |
| Warrior    | Strength, resilience, decisive dao strikes         | Vermilion red     | Grounded diagonal sword lunge, side profile        |
| Qi Adept   | Inner cultivation and projected qi                 | Icy blue-white    | Turning palm strike, eyes following the projection |
| Swiftblade | Lightness skill, opening speed, critical precision | Golden yellow     | Airborne sideways leap, looking toward the landing |
| Wanderer   | Generalist, self-taught and adaptable              | Jade / sage green | Low sweeping staff stance, face under a straw hat  |

Wanderer flavor: “You were born with no specialty, but your potential is yours to
shape.” No hidden late-game specialty is implied.

**A class is defined by:**

- **Slightly different starting stats.** Differences should be modest. Current
  prototype values come from the original game (see reference document) and are wider
  than intended; the exact successor values are balance data.
- **Starting equipment.**
- **Its origin position on the shared tree.** This is the main source of long-term
  identity: nearby stat nodes and techniques let each class's stats grow in its own
  direction organically.

**Classes do not have different growth rates.** All classes receive identical
automatic per-level growth (§3.2). Class-specific level-up modifiers from the original
game are superseded.

Opening screen presentation: four compact vertical portrait columns, grayscale until
hover/focus, class-colored glow, description tooltips, and explicit choice buttons.
Phones may wrap to two rows. Saved progress can be loaded directly.

### 3.2 Leveling — Approved

- EXP to the next level is `50 × current level`.
- Every level-up grants the same automatic growth to every class, restores Life, Qi,
  and Energy to maximum, and grants shared-tree points.
- Current growth values, carried from the prototype as balance data: every level
  +5 Max Life, +5 Max Qi, +3 Max Energy, and 1 point; every fifth level additionally
  +2 Strength, +2 Speed, and 1 point.
- Campaign pacing target: roughly **20–25 tree points** by the end of the Human
  Gateway. This is not a lifetime cap; grinding may eventually unlock the whole tree.
- **There is no per-level stat choice.** The original's pick of Strength, Speed, Max
  Life, or Max Qi at each level-up is removed. Player-directed stat growth comes
  entirely from shared-tree stat nodes.

Explain every progression bonus clearly at the moment it is gained.

### 3.3 Shared tree — Approved

The full specification is in [abilities.md](abilities.md). Structural rules:

**Topology**

- One visible, connected tree for all classes. Wanderer's origin is the center.
  Warrior, Qi Adept, and Swiftblade origins sit roughly midway between the center and
  the outer edge of their themed region.
- All links are bidirectional, and every node is reachable from every origin. Cycles
  and alternate routes are allowed; there are no class-exclusive or one-way links.
- Purchases must connect to the character's own origin through purchased nodes and
  reached junctions.
- The full tree is visible from the beginning and supports text search and filters.

**Origins**

- The chosen origin anchor is free, and a new character receives **one unspent point**
  to allocate immediately. No fixed technique is pre-learned.
- Other origin anchors are free junctions when reached. They grant no origin change and
  no bonus points.

**Node layout gradient**

- **Pure stat nodes between abilities.** Many nodes are plain stat increases (for
  example Strength, Speed, Max Life, Max Qi, damage, defense, critical chance) placed
  between technique, Discipline, and Vow nodes. Travel must feel like growth, never a
  tax.
- **Center nodes are fundamental.** Nodes near the Wanderer origin are broadly useful
  and drawback-free. They include:
  - a **Qi recovery** node near the center, in the direction of the Qi Adept;
  - a **Life recovery** node near the center, in the direction of the Warrior;
  - a **Quick Draught** node near the center, in the direction of the Swiftblade.
- **Edge nodes are extreme.** Moving outward, nodes become more specialized and more
  powerful, and outer nodes pair their benefit with a real **drawback**. An edge node
  must not be strictly better than a center node; it is a stronger commitment.
- Vows are the clearest expression of this rule, but ordinary outer stat nodes and
  Disciplines may also carry drawbacks.

Qi recovery nodes and effects must not modify Basic Attack's fixed 10-Qi restoration.

**Quick Draught** — once per encounter, the player's first potion drink does not end
their turn:

- After that drink resolves, the same player turn continues and the player chooses
  another action. Any later drink in the encounter ends the turn normally.
- The drink still spends one charge and follows all normal potion validation. A rejected
  or invalid drink spends nothing and does not use up Quick Draught.
- The free drink is not a separate turn: it does not advance status durations, enemy
  cadence counters, or the turn cycle, and enemy intents stay committed.
- It resets every encounter and every Training Ward session. Retry prepared restores it.
- While available, both potion slots show a "Quick" indicator, and the log notes when it
  is used.

This is an approved exception to the rule that drinking a potion takes the player's
turn (§6.2).

**Open:** Whether further fundamentals sit between the specialist directions.
Unchosen candidate ideas are listed in `abilities.md`.

**Candidate:** Node counts, named techniques, effects, coefficients, Disciplines,
Vows, evolutions, and masteries described in `abilities.md`.

### 3.4 Respec — Approved

- A temple NPC (the upstairs Mentor) offers **very cheap** respecs. Price is balance
  data but should never make experimentation feel costly.
- Tree respec is a **full reset**: every purchased node and mastery is refunded,
  including the initial point if spent, without duplicating it. The free origin
  anchor, unspent points, class, level, EXP, and automatic growth are preserved. Because
  stats come only from starting values, automatic growth, equipment, and tree nodes,
  a tree respec is the only stat respec.
- Preview exact before/after stats, nodes, masteries, equipment eligibility, required
  unequips, and gold cost before confirmation. Preview and cancel change nothing and
  cost nothing. Negative gold is impossible.
- Confirmation revalidates connectivity, mastery exclusivity, and equipment
  requirements atomically.
- Respec does not change class.

## 4. Combat

### 4.1 Layout and turns — Approved

- The player is on the left; one or two enemies are on the right, clearly separated.
- Life, Qi, shield, status, and intent information sits beside each fighter. The
  battlefield remains visually dominant.
- Speed decides only which side acts first when the encounter begins. Enemies win
  opening-Speed ties.
- The encounter then follows a fixed cycle: living enemies keep their authored order,
  the player keeps their place, and summons join immediately after the player. Speed
  changes never reorder turns.
- Prevent duplicate input from resolving an action or spending a cost twice.

### 4.2 Hits and critical strikes — Approved

- Ordinary valid attacks always hit for both player and enemies. Speed does not affect
  accuracy.
- Speed increases critical-strike chance for eligible attacks through a bounded,
  monotonic formula with explicit base chance, cap, multiplier, and eligible action
  types (balance data). Recovery and buffs never crit. Do not count crit chance twice.
- Inject the random source for reproducible tests.
- **Avoided** is the term for an attack canceled by a defensive effect such as Smoke
  Step. Show `AVOIDED`, never `MISS`, and name the cause in the log. Only attacks tagged
  **Unavoidable** bypass Avoid.
- A future status may explicitly enable misses (for example Blind). This is not
  authorized content; if introduced, define its chance, duration, affected actions, and
  interactions, and show it in previews and logs.

### 4.3 Resources — Approved

- **Life** and **Qi** carry between battles; they do not automatically restore after
  every encounter.
- **Basic Attack** is universal, outside the tree, costs no Qi, and restores exactly
  **10 Qi** after resolving (capped at Max Qi), even if its damage is prevented.
- Other Qi recovery comes from Gather Qi, potions, tree nodes, and equipment, but the
  combat loop must work without them.
- **Energy** is spent on encounter entry and Training Ward hits (§5.2, §5.3).

### 4.4 Actions — Approved

- **Basic Attack** — always available; separate from technique positions.
- **Techniques** — up to **16** active-technique positions. This is interface
  capacity, not a required roster size.
- **Potions** — exactly two potion slots, separate from techniques (§6.2).
- Passive nodes never occupy action positions.

**Limited-use techniques**

Some techniques may be used only a limited number of times per encounter.

- A technique definition may declare a per-encounter use limit, such as once per
  fight or N times per fight. Techniques without a limit are unlimited.
- A use is spent exactly once, when the action is validly committed, alongside its Qi
  cost. Rejected, invalid, or duplicate commands spend nothing.
- Uses reset at the start of every encounter, and Retry prepared restores them because
  it rebuilds the encounter. They never carry between fights.
- Show remaining and maximum uses on the button and in the preview. An exhausted
  technique keeps its position and shows "No uses left this fight."
- This is not a cooldown: uses do not recharge over turns. General cooldowns remain
  excluded unless separately approved as a labeled successor mechanic.

**Candidate:** Which techniques are limited and their counts. **Open:** Whether an
evolution inherits, changes, or removes its base technique's limit, and how limits
behave in Training Ward sessions.

### 4.5 Action dock and technique buttons — Approved

```
                 Selected action preview
          Name | effect | Qi cost | uses | availability

Attack | Allocated techniques ... | Potion slot 1
       | Allocated techniques ... | Potion slot 2
```

- Technique positions are stable; they never reorder when unavailable. Unused capacity
  may stay empty.
- Any grid or paging redesign must keep fast access to every allocated technique and
  requires approval if it changes the 16-position capacity. Do not reduce to a
  four-to-six-slot loadout without explicit approval.
- At narrow widths the grid may become four columns by four rows. Keep touch targets
  usable and test the dock/battlefield height balance on phones.

Each button shows: a distinguishable icon, a short label where space permits, Qi cost
(or an explicit no-Qi label), remaining uses when limited, allocated state and effect
summary, tree requirements when locked, selected state, availability, and a full
description in the shared preview.

**Explain every unavailable action with labels and symbols, not color alone:**

- Not enough Qi.
- No uses left this fight.
- Technique not allocated, or its tree requirement is unmet.
- Not the active unit's turn.
- Silence or another restriction.
- Invalid or defeated target.
- Missing required condition.
- Potion slot empty, or the equipped potion has no charges.

**Interaction model**

- Desktop: hover or keyboard focus previews; selection and targeting are explicit
  before commitment.
- Touch: the first tap previews/selects; an explicit confirmation or valid target tap
  commits. Exploratory taps never spend resources.
- Use one consistent confirmation model.

**Candidate:** Rearranging technique positions outside combat.

### 4.6 Ability tooltips — Approved

- Tooltips show each ability's normal formula and, when a target is selected, the
  calculated result.
- **There are no boss-specific damage caps.** Scaling abilities (such as current-Life
  or missing-Life scaling) use the same math against every target.
- General diminishing returns authored into an ability, such as Qi Burst's effective-Qi
  conversion, apply to all targets and are shown in the tooltip.
- Constants are balance data read by resolution and tooltips alike, never hard-coded
  UI strings.
- Exact damage previews are optional. Where shown, distinguish estimates from
  guarantees and account for crits and defenses.

### 4.7 Enemies — Approved

**Telegraphs**

- Show the next committed enemy action before the player chooses: attack/support type,
  intended target, and important effects. Telegraph major attacks with text and icons.
- Previews and resolution come from the same action definition. Never secretly reroll a
  committed intent. If an intent becomes invalid, update it visibly before resolution.

**Move sets and behavior**

- Enemies have authored move sets, not scaled basic attacks: direct attacks, multi-hit
  or shield-focused attacks, resource pressure, statuses, defensive actions, self-buffs.
- Some turns may be non-damaging self-buffs that make the enemy tougher for the rest
  of the encounter. A self-buff consumes the enemy's action, deals no damage unless it
  explicitly includes damage, and is telegraphed.
- Persistent encounter buffs do not expire by turn countdown. They stack on repeated
  use unless authored **one-and-done**, which becomes ineligible after its first
  successful use. Definitions state per-stack effect and any stack cap; uncapped
  stacking is allowed as deliberate escalation. Show buff, stacks, affected stats, and
  resulting state in telegraph, status display, and log. Buffs end with the encounter
  and reset on Retry prepared.
- Behavior follows a larger authored pattern with minor controlled randomness, for
  example a stacking buff every third turn and a random choice between two legal
  attacks otherwise. Randomness chooses only among moves legal for the current pattern
  step and never bypasses cadence, one-and-done, resource, or condition rules.
- Selection is data-driven: ordered pattern steps, cadence counters, per-move
  conditions, and optional weights. No enemy-specific branches in scenes. Commit the
  next intent before the player's decision window.

**Encounter design principles**

- Create encounters that change decisions rather than just adding health and damage.
- Give each enemy one readable defining mechanic, communicated consistently through
  visuals, preview, telegraphs, status display, and log.
- Teach a new status, buff, targeting rule, or pattern in a simpler encounter before
  combining it with other threats.
- Avoid single mandatory counters. Support multiple responses such as mitigation,
  interruption, cleansing, resource management, debuffs, burst, or aggression.
  Preparation should change difficulty without locking out valid builds.
- Discourage indefinite stalling through encounter-specific escalation rather than a
  universal turn limit, while leaving defensive and recovery builds time to function.
- Make defeats explainable through clear status descriptions and feedback.

### 4.8 Defeat and Retry prepared — Approved

- On defeat, offer **Retry prepared** and **Return to temple**.
- After the 10-Energy entry fee is charged, capture a preparation snapshot: current
  Life/Qi/Energy, potion charges and both slots, equipment and build, and relevant
  persistent state, plus the encounter definition and initial setup.
- Retry restores that snapshot and resets enemies, turns, temporary statuses,
  limited-use counts, intents, and logs. Resources return to their entry values, not
  maximums.
- Retry spends no extra Energy and never refunds the original fee. It cannot accumulate
  rewards, gold, EXP, items, charges, or permanent changes.
- Settlement is transactional: failed attempts grant nothing; a success settles once.
  Returning to the temple ends the retry chain.
- Returning after defeat keeps recovery services reachable.
- The Training Ward uses its own settlement model and has no prepared rollback.
- Retry is scoped to the active encounter session. No mid-battle saving.

### 4.9 Combat log — Approved

Keep a readable, bounded log explaining damage, crits, mitigation, recovery, resource
costs, use limits, buffs/debuffs and expiration, and named causes for Avoided attacks.
Place it outside the main action area, expandable or scrollable. Presentation reports
resolved rules; it never calculates separate results.

## 5. World activities

### 5.1 Gate encounter preview — Approved

Interacting with a gate always opens a preview; it never starts combat immediately.

- Preview the next uncleared stage by default. At the Monster Portal and Dark Rift the
  player may select a cleared stage to replay. Cleared Human Gateway stages are not
  selectable.
- Show every enemy: name, visual identity, level or difficulty, Life, Qi, Speed,
  defenses, starting shield, and concise descriptions of its known moves, including
  self-buffs and special actions. A future discovery mechanic may mark values unknown,
  but the preview must still support preparation.
- Show the Energy entry cost and exact deterministic rewards, including whether a
  one-time item is already claimed. Never reveal combat RNG, future action order beyond
  the opening rule, or runtime intents.
- Provide separate **Prepare/Back** and **Enter encounter** actions. Leaving changes
  nothing and spends nothing. Preparation screens opened from the preview return to the
  same gate and stage.
- On confirmation, revalidate progression, stage availability, and Energy; then deduct
  the fee, create the retry snapshot, instantiate enemies, and enter combat. Repeated
  confirmation creates one encounter and one charge.
- Build previews from the same typed definitions used to create combat.

### 5.2 Energy — Approved

- Characters start with **50 max and 50 current Energy**. Capacity growth is balance
  data.
- Walking, exploration, menus, vendors, dialogue, inventory, potion use, refilling,
  resting, and idle time cost no Energy.
- Each normal encounter costs **10 Energy total**, deducted once on entry. At least 10
  Energy is required; rejected or duplicate entries spend nothing.
- Victory, defeat, retreat, turns, and settlement cost nothing more. Retreat does not
  refund. A separate new encounter costs another 10.
- Zero Energy never slows walking or drains Life/Qi; it only blocks paid entry.
- Energy recovers through the food vendor and/or restoration NPC (amounts are balance
  data). The potion well does not restore Energy.

### 5.3 Training Ward — Approved

- Repeatable training with three difficulties, costing **2/3/10 Energy per damaging
  hit** and no entry fee. Non-damaging actions are free.
- Awards EXP per damaging hit; after the ward's shield is depleted, EXP doubles and the
  Energy cost does not change. Reference values: 3/5/20 base EXP (6/10/40 doubled).
- Grants no gold or items. The ward fights back.
- The player can stop at any time; training ends when Energy cannot pay for another hit.

**Open:** The exact shield-breaking-hit boundary for doubled EXP, and exploit resistance
around free non-damaging actions.

### 5.4 Mini-quests — Approved direction

- Replace the repeatable delivery grind with organic **mini-quests** from temple NPCs:
  short, authored requests that fit the characters and the world.
- Once the authored mini-quests are exhausted, the merchant falls back to repeatable
  deliveries as a dependable gold source.
- Avoid long travel loops for trivial rewards.

**Open:** Quest content, rewards, gating, and how many exist per campaign section.

### 5.5 Recovery — Approved

A struggling player always retains dependable recovery, potion refills, cheap respecs,
equipment changes, and repeatable activities. Defeat and low Energy must never trap
the player in an unwinnable economic or combat loop.

## 6. Items and economy

### 6.1 Equipment — Approved

- Weapons, armor, and shields are separate categories.
- Items may have Strength requirements.
- Stats include Physical and Qi damage, Physical and Qi defense, shield Hit Points with
  shield defenses, and modifiers to combat stats and resource capacity.
- Damage to Life and bonus damage to active shields are resolved separately.
- All shop stock and portal item rewards are authored and deterministic: no drop rates,
  weighted loot tables, rarity rolls, or generated items.
- Certain stages grant a unique, named item with a stable ID. Each encounter references
  its exact reward and a deterministic eligibility rule (first clear, or every clear for
  replayable portals). Probability is never part of eligibility.
- Grant items only during successful transactional settlement. Defeat, retreat, stale
  input, and retries never duplicate awards. Persist acquired items and claimed
  one-time reward IDs through save schema v6.

### 6.2 Refillable potions — Approved

Replaces the original's stockpiled consumables.

- At most **two** potions are equipped, in stable slots. Either slot may hold any
  potion type; never force one Life and one Qi slot.
- The seller sells reusable potion types. Buying adds an owned bottle, not a stack.
- Drinking spends one charge and the player's turn, except for the first drink of an
  encounter when the player has the Quick Draught node (§3.3). An empty bottle stays
  owned.
- The **well beside the seller** refills all owned bottles for free, including
  unequipped ones, when the player interacts with it.
- Charges never refill automatically after battles, defeats, retreat, loading, or
  equipment changes. Retry prepared restores the entry charge counts, not maximums.
- Unequipped bottles keep their charges. No swapping in combat, no bottle in both slots,
  and swapping never manufactures charges.
- Potion use and refilling cost no Energy.

Variety should create tradeoffs, for example: small recovery (less per drink, more
charges), concentrated recovery (more per drink, fewer charges), Qi potions, hybrid
Life+Qi potions, and fortifying potions with a temporary buff. Names, prices, values,
capacities, buffs, duplicate ownership, starting bottles, and stacking are balance
decisions.

**Technical and UI requirements**

- Separate potion definitions (type ID, name, description, price, max charges,
  recovery, optional typed buff and duration) from owned-bottle state (instance ID,
  type ID, remaining charges) and slot references.
- Reuse the core effect pipeline. Validate turn, slot, charges, and effect eligibility
  before spending. A hybrid resolves all effects and consumes one charge.
- Clamp recovery to maximums. A full resource does not block the potion's other valid
  effects; disable use only when nothing can apply, and explain why.
- Show both slots, names/icons, remaining/max charges, and an effect preview. Empty
  bottles show "Refill at the well." Slots never reorder.
- The seller compares per-drink recovery, capacity, effects, buffs, and price against
  equipped options. The well has an obvious label and refill confirmation.
- Save owned bottles, slot assignments, and charges; keep legacy disposable-potion
  migration coverage.

### 6.3 Gold — Approved

Portal victories are the primary gold source, supplemented by mini-quests and fallback
deliveries. Gold buys equipment, potions, and cheap respecs.

## 7. Save system — Approved

- Versioned format storing stable IDs, never Phaser objects, with migrations.
- Handle invalid or unavailable storage gracefully; never overwrite a valid save with
  incomplete initialization state.
- Persist class, level, EXP, stats, tree origin/allocations/masteries and point
  accounting, inventory, equipment, owned potions with slots and charges, portal
  progress, current Life/Qi/Energy, quest state, and legacy Skill Points and ranks while
  they remain active.
- Save explicitly from any room outside combat. Battle saves stay blocked. Automatic
  save points require a separate, deliberate decision.
- Schema v5 is current. v6 adds claimed one-time reward IDs when rewards are
  implemented; do not silently reinterpret v5.
- When shared-tree progression replaces legacy ranks, add explicit earned/spent/unspent
  tree-point accounting through a versioned migration, and never count the initial
  point in both legacy Skill Points and the tree.
- A storage adapter lets local and CrazyGames persistence share one interface. No cloud
  sync or conflict resolution until requirements exist.

## 8. Platform: CrazyGames

Recheck official documentation before implementing platform behavior or submitting:

- <https://docs.crazygames.com/sdk/intro/>
- <https://docs.crazygames.com/requirements/intro/>
- <https://docs.crazygames.com/requirements/technical/>
- <https://docs.crazygames.com/faq/>

As verified in September 2026: HTML5 SDK v3 is current and initializes asynchronously.
Basic Launch may omit the SDK and cannot monetize; Full Launch requires it. Limits:
50 MB initial download, 20 MB for mobile homepage eligibility, 250 MB total, 1,500
files, relative bundle paths. Browser compatibility and low-memory devices matter.
Treat limits as ceilings. A successful build does not mean acceptance.

**Integration rules (Phase 4)**

- Keep the platform behind a small adapter: initialization, environment detection,
  gameplay start/stop, loading events, persistence, ads, optional accounts.
- Provide a browser implementation alongside the CrazyGames one; local play never
  depends on a live SDK request.
- Do not fabricate an npm package name; follow the official loading mechanism.
- Initialize before SDK calls; handle unsupported environments; report gameplay events
  at real transitions; pause and resume gameplay and audio around ads; grant rewarded-ad
  benefits only after the documented completion event, once.

## 9. Technical architecture

### 9.1 Stack

| Technology | Role                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| Phaser     | Rendering, scenes, sprites, input, animation, audio, and game lifecycle |
| TypeScript | Strict typing for application and game systems                          |
| Vite       | Development server and production bundling                              |
| npm        | Dependency installation and reproducible scripts                        |

Development tools (all `devDependencies`): Vitest, Playwright Test, ESLint with
TypeScript support, Prettier. Commit the lockfile and document `npm ci`. Verify current
compatible releases before installing, and document tested Node.js versions.

Do not add React, a backend, a database, authentication, networking, or a
state-management framework. Use Phaser's audio and animation first. Assistant-side AI
tools are not runtime dependencies; the game needs no AI API key.

### 9.2 Boundaries

```
src/
  core/       Pure TypeScript rules, state transitions, and domain models
  content/    Typed skills, enemies, items, encounters, and room definitions
  game/       Phaser scenes, rendering, input, animation, and audio
  platform/   Browser and CrazyGames platform adapters
```

- `core/` never imports Phaser, touches the DOM or browser globals, or calls SDKs.
  Dependencies point inward; boundaries pass plain typed values.
- Scenes display state, collect input, and play animations. Rules live in `core/`:
  damage, resources, opening side, crits, statuses, targeting, shields, equipment,
  progression, shops, and save migrations.
- Do not create empty scaffolding.

### 9.3 Data-driven content

Skills, enemies, items, encounters, portal stages, Training Ward variants, rooms, tree
nodes, and quests are typed definitions referenced by stable IDs. Definitions can
express:

- Technique category (offensive active, support active, passive), Qi cost, per-encounter
  use limit, crit eligibility, and any explicit miss-enabling interaction.
- Damage components (physical, qi, Strength, shield, random) and targeting (single,
  multi-target, repeated hits).
- Tree node type, stats, benefits, drawbacks, and connections.
- Enemy stats, opening Speed, defenses, shields, deterministic rewards, and an authored
  action roster with selection conditions, telegraph data, and typed effects.
- Portal identity, stage progression, and replayability.

Validate content references. Avoid a schema library until data justifies one.

### 9.4 Combat state flow

1. Initialize the encounter, including one or two enemies and shields.
2. Select the opening side from Speed and fix the turn cycle.
3. Player selects an action when active.
4. Target selection, including valid multi-target sets.
5. Validate turn ownership, tree allocation, Qi, uses remaining, items, target, and
   status restrictions.
6. Commit resources and uses exactly once.
7. Resolve crits for eligible actions; resolve misses only for explicit exceptions.
8. Resolve damage, healing, shields, statuses, summons, and other effects.
9. Emit combat-log and feedback events.
10. Play animations without changing resolved results.
11. Advance to the next living unit in the fixed cycle.
12. Handle victory, defeat, retry, or retreat.
13. Settle rewards and persistent progression.

### 9.5 Build requirements

- Type checking is part of release validation. Output goes to `dist/`.
- Vite `base: "./"`; load assets through imports or relative `public/` paths; verify the
  build beneath a nested URL path.
- Only intended public assets ship: no references, docs, tests, or source-only files.
- No API keys or secrets in browser environment variables.
- 1600×900 logical resolution, `Phaser.Scale.FIT`, `Phaser.Scale.CENTER_BOTH`.

## 10. Testing strategy

Tests validate meaningful behavior; do not manufacture coverage. Use controlled
randomness. Keep visual polish checks separate from rule correctness. **Do not maintain
automated balance or build-viability simulations while mechanics are in flux.**

### 10.1 Unit

- Invalid actions spend no Qi or uses; valid actions spend each exactly once.
- Limited-use techniques become unavailable at zero uses, reset each encounter, and are
  restored by Retry prepared.
- The opening side follows the Speed rule; turn order then stays fixed.
- Ordinary attacks never miss; crit chance follows the bounded Speed formula.
- Single-target actions cannot affect invalid targets; multi-target and multi-hit
  actions hit the intended targets and counts.
- Healing cannot exceed maximum Life. Shield damage resolves separately from Life.
- Statuses expire on the intended boundary.
- Enemy AI stays within its authored cadence; randomness varies only legal choices.
- Stacking buffs add exactly once per use; one-and-done buffs become ineligible; retries
  clear both.
- Passives modify intended calculations without spending Qi.
- Scaling abilities use identical math against bosses and non-bosses.
- All classes receive identical per-level growth, and level-ups offer no stat choice.
- Tree allocation enforces connectivity; full reset refunds correctly.
- Training Ward awards 3/5/20 EXP before shield depletion and doubles afterward without
  changing Energy cost; non-damaging actions cost no Energy.
- Starting Energy is 50/50; non-paid activities cost none; entry spends 10 once;
  insufficient Energy rejects entry; turns, settlement, and retries never charge again.
- Rewards cannot be claimed twice; deterministic item rewards settle at most once and
  persist; no reward path rolls drop rates.
- Cleared Human Gateway stages cannot be entered again.
- Purchases and respecs cannot produce negative gold.
- Save migrations preserve class, progression, resources, inventory, and equipment.
- The ending unlocks after Human stage 20.

### 10.2 Potions

- At most two bottles equipped; one bottle cannot fill both slots.
- A valid drink spends one turn and one charge; repeated or invalid input spends nothing.
- With Quick Draught, only the first valid drink per encounter keeps the turn; it still
  spends a charge, does not tick statuses or enemy cadence, and resets on retry.
- Hybrid recovery clamps each resource independently and applies eligible buffs once;
  one full resource does not block other effects.
- Empty bottles cannot be drunk; the well refills owned bottles to capacity.
- Battles, recovery, save/load, and swaps never refill; retry restores entry counts.
- Swaps and save/load preserve charges and slot assignments.
- Buff duration and stacking follow selected rules; purchases enforce gold and
  ownership; legacy migration preserves documented value.

### 10.3 Integration

- Content IDs resolve for classes, techniques, passives, tree nodes, items, equipment,
  shields, enemies, portals, Training Ward variants, rooms, and quests.
- Tree links reference existing nodes, are bidirectional, and reach every node from each
  origin; cycles are valid.
- Encounter results update progression correctly.
- Human stage 20 unlocks the ending and Dark Rift; Monster Portal remains optional.
- Save/load restores expected state, including carried Life, Qi, and Energy.
- Local and platform adapters satisfy the same contract.

### 10.4 Browser

- Boots without application errors; layouts survive resizing at desktop, tablet, and
  phone sizes.
- Mouse, keyboard, and touch selection work; one- and two-enemy layouts stay readable.
- Unavailable actions, including exhausted limited-use techniques, explain their state.
- Target selection prevents invalid attacks; repeated input never duplicates actions;
  overlays block background actions.
- Walking is unrestricted at zero Energy; paid entry explains insufficient Energy.
- Training Ward shield depletion visibly changes EXP without changing cost.
- Entry decreases Energy by 10 once; retry restores the snapshot without duplicate
  rewards.
- Gates open the correct preview without spending Energy; backing out changes nothing;
  confirming creates exactly the displayed encounter once; cleared Human stages are not
  offered.
- Enemy intent is visible before action selection, never secretly rerolled, and the log
  explains results. Persistent self-buffs change declared stats, appear in UI and logs,
  and reset on reconstruction.
- Respec preview/cancel changes nothing; confirmation applies atomically.

## 11. Roadmap

| Phase | Status         | Scope                                                                |
| ----- | -------------- | -------------------------------------------------------------------- |
| 0     | Complete       | Technical foundation                                                 |
| 1     | Complete       | Vertical slice                                                       |
| 2     | Complete       | Combat depth, classes, potions, training, retries                    |
| 3     | Complete       | Connected temple, 35-stage campaign, shops, ending                   |
| 3.5   | In progress    | Shared tree, final techniques, enemy rosters, previews, item rewards |
| 4     | Not authorized | CrazyGames adapter, persistence, asset budgets, submission, release  |

Acceptance records for completed phases are in [docs/history.md](docs/history.md).

**Phase 3.5 — approved, not yet implemented:**

- Replace legacy ranks with the final shared tree, techniques, and explicit tree-point
  accounting once the roster is approved.
- Identical per-level growth for all classes, removal of the per-level stat choice,
  and narrower starting-stat differences.
- Tree node gradient: stat nodes between abilities, fundamental center nodes (Qi
  recovery toward Qi Adept, Life recovery toward Warrior, Quick Draught toward
  Swiftblade), extreme edge nodes with drawbacks.
- Limited-use techniques.
- Non-replayable Human Gateway stages.
- Removal of boss-specific damage caps.
- Very cheap respec pricing.
- Mini-quests with delivery fallback.
- Gate encounter previews and the preparation return flow.
- Pattern-driven enemy rosters with stacking and one-and-done self-buffs.
- Deterministic stage item rewards and save v6.

## 12. Open questions

| Topic               | Question                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------ |
| Center nodes        | Do further fundamental nodes sit between the specialist directions?                        |
| Limited-use moves   | Which techniques are limited, their counts, evolution inheritance, Training Ward behavior? |
| Starting stats      | Exact successor starting stats per class.                                                  |
| Catch-up path       | Are Training Ward and mini-quests enough repeatable EXP/gold with Human stages locked?     |
| Mini-quests         | Content, rewards, gating, and count per campaign section.                                  |
| Respec price        | Exact "very cheap" price.                                                                  |
| Potions             | Names, prices, capacities, buffs, duplicates, starting bottles, stacking.                  |
| Energy              | Capacity growth and food/restoration amounts.                                              |
| Training Ward       | Shield-breaking-hit boundary and non-damaging-action exploit resistance.                   |
| Crit constants      | Base chance, cap, multiplier, eligible action types.                                       |
| Monster/Rift replay | Do replays grant full normal rewards, or reduced rewards?                                  |
| Equipment           | Item identities, unique stage rewards, and replay eligibility.                             |
