# Phase 3 technical design

Phases 0–3 are implemented with placeholder geometry and replaceable presentation.
The canonical design is [../tdd.md](../tdd.md). The connected temple and campaign are now playable.

## Architecture

- `core/types.ts`: plain player, fighter, status, and battle state.
- `core/progression.ts`: four classes, derived stats, level choices, prerequisites,
  skill ranks, and transactional respecs.
- `core/session.ts`: the temporary prototype combat/session facade. Randomness is
  injectable; durable combat concerns are being extracted below it.
- `core/combat/turnOrder.ts`: immutable opening-side and fixed-cycle rules.
- `core/combat/actions.ts`: shared provisional power calculation used by previews
  and resolution; move definitions remain replaceable content.
- `core/combat/commands.ts` and `events.ts`: token-checked command dispatch and a
  bounded typed event stream for future presentation, audio, replays, and debugging.
- `content/data/tree.json` and `content/data/skills.json`: editable content, the
  single source of truth for tree nodes and skill numbers. Edit them with
  `editor.html` (see below) or by hand.
- `content/schema.ts`: content types plus pure validators shared by the game, the
  editor, and the editor's save endpoint.
- `content/tree.ts` and `core/tree/allocation.ts`: loads and validates the tree,
  free origin junctions, connected allocation, reset/refund and pruning support,
  and mastery-group infrastructure. Rules accept an optional tree index so the
  editor can run them against unsaved content.
- `core/tree/effects.ts`: sums allocated nodes' effects. `syncStats`,
  `skillRank`, `effectiveSkill`, action power, and player defense apply them.
- `content/phase2.ts`: classes, 16 active and 3 passive skills (numbers loaded from
  JSON), roster validation, five normal encounters, and three Training Wards.
- `content/catalog.ts`: potion/equipment definitions and theme values.
- `game/scenes/SliceScene.ts`: placeholder geometry and responsive HTML controls.
  Canvas resolution is 1600×900 with FIT/CENTER_BOTH; compact screens scroll.
- `platform/save.ts`: explicit versioned validation with injected storage.
- `platform/preferences.ts`: independently stored validated audio, motion, and
  screen-shake preferences.

Core modules have no browser or Phaser dependencies.

## Progression

Choose Wanderer, Warrior, Caster, or Shadow. Class selection is permanent; existing
saves can be loaded from the selection screen. Skills opens the shared tree, where
nodes and technique ranks spend one Skill Point pool, and Progression allocates
stats or previews a Mentor respec. Skills require levels and
prerequisites and cap at rank 10. The class starter is free at rank 1 and bypasses
its usual prerequisites. This rank system is temporary compatibility content. New
sessions and migrated saves also carry an empty shared-tree allocation anchored to
their chosen origin. Tree node effects (see Content editor) apply to derived stats
and skills once allocated. Most shipped nodes are effect-free placeholders. The
exceptions are the Avenger and Cut Down technique nodes and their child masteries.

Each level requires 50 × current level EXP, grants one stat choice and one Skill
Point, and adds 5 maximum Life, 5 Qi, and 3 Energy. Every fifth level adds 2
Strength, 2 Speed, and another Skill Point. Stat-choice growth differs by class.
Level-ups restore resources; level caps at 99. Respec costs 2 gold per level,
refunds allocations, preserves earned progress and the starter, clamps resources
without healing, and removes incompatible equipment. Previewing does not mutate
state, and empty resets cannot charge gold.

## Combat

- Starting maximum Energy is 50. Walking is free at full speed. Normal entry costs
  10 Energy once; Training instead charges 2/3/10 Energy per damaging hit.
- Speed decides only whether the player or enemy side opens the encounter; enemies
  win ties. That opening order becomes a fixed turn cycle and is not re-sorted.
  Summons join the following cycle immediately after the player.
- Ordinary attacks always hit. Critical chance is min(40%, 5% + 0.5% × Speed),
  with floored 1.5× damage. No Blind ability or cooldowns are introduced.
- Basic Attack costs no Qi and restores 10 Qi after resolving, capped at Max Qi.
- A skill may declare `uses`, a per-encounter limit. A use is spent once, on a valid
  commit alongside the Qi cost. Uses reset every encounter (including Retry
  prepared) and never recharge mid-fight. Exhausted buttons stay in place and
  explain "No uses left". Tree `skillModifier` effects with `field: "uses"` add uses
  to limited skills only.
- Avenger costs 0 Qi, has 2 uses, and its base power is 250% of the player's missing
  Life. It replaces normal Strength, weapon, and rank scaling; defense and critical
  hits still apply. It is unavailable at full Life. The `technique-avenger` tree
  node grants it, and its child `avenger-third-use` adds a third use.
- A skill's `percent` field sets Life-based damage that replaces normal scaling.
  Avenger deals `percent` (250) of the player's missing Life. `enemyLife` skills deal
  `percent` of the target's current Life at the moment of the hit. Tree
  `skillModifier` effects with `field: "percent"` raise it, and `noCrit` skills never
  critically strike.
- Cut Down (internal id `split`) costs 30 Qi and hits once for 20% of the target's
  current Life. It cannot crit; defense and shields still apply. The
  `technique-cut-down` node grants it, and its child `cut-down-deeper` raises the
  damage to 25%.
- Actions preview effect/cost/target and require confirmation. Tokens reject stale
  commands. Previewed base power and resolved base power use the same pure
  calculation. Multi-hit/all-target actions pay Qi once; invalid targets spend
  nothing. Enemy turns use a pauseable presentation delay.
- Shields absorb damage before Life; shield-breaking bonuses affect shields only.
  Burn, Weaken, and Silence count affected actor turns. Shadow Replicate adds an
  ally. Enemy striker/caster/healer behaviors publish intents; changed heal targets
  are announced before resolving. The combat log retains 40 entries.
- Normal defeat offers Retry prepared, restoring the deep post-entry-fee snapshot
  including charges, without another fee. Rewards settle once.
- Wards give 3/5/20 EXP per paid hit, doubled only when the shield was already empty
  before that hit. Shadow hits follow the same rules. Insufficient Energy stops
  further hits. Training retains EXP and has no prepared rollback or bonus loot.
- Two slots accept owned reusable bottles. Each drink costs one charge and turn.
  Varieties include hybrid recovery and Guard. The free well refills all owned
  bottles; rest and battle entry do not refill them.

Damage coefficients, encounter stats, status values, and respec price are
provisional successor balance, not verified original-game formulas. Automated introductory, level-5, and full-campaign balance simulations have been
removed while the design is in flux. Functional tests remain.

## Saves and checks

Manual room saves use schema v5 and retain the `rpg.phase1.save` key. v1–v4 migrate
resources, equipment, currency, bottles, EXP, world progress, and empty shared-tree
state; legacy players choose a class.
Saves also record `content`, a hash of `skills.json` and `tree.json`. A save made
against different content loads leniently. Ranks whose prerequisites or levels no
longer hold, and tree nodes that were removed or disconnected, are refunded.
Derived stats are recomputed, and incompatible weapon and buckler equipment is
unequipped. Saves with a matching or missing hash keep the strict checks.
v1 disposable stock beyond bottle capacity converts to gold. Invalid/unknown saves
are preserved. Loading never writes, and battle saves are blocked. No autosave or
platform SDK is introduced.

Run `npm run check` for types, lint, formatting, unit tests, production build, and
Chromium browser tests served under a nested URL. The composed check performs one
typecheck and one Vite bundle, then Playwright previews that existing `dist` with
one worker. `npm run test:e2e` is the standalone build-and-browser-test command;
`npm run test:e2e:run` intentionally expects an existing build. For
documentation-only work, use `npm run check:docs` rather than starting the build
and browser suite. Tests cover all 16 actions,
classes, progression, respecs, shields/statuses/summons, Energy, rewards, training,
potions, migration, and retries. Browser tests include keyboard activation,
emulated touch targeting, and desktop/tablet/phone layouts. Physical devices and
other browsers remain release validation.

## Phase 3 world and campaign

`content/world.ts` defines the 13-node graph from `layout.png` (12 temple rooms and
one ending), 35 portal stages, and typed world state. `core/world.ts` validates
connected travel, gates, sequential clears, deliveries, and room-specific stock.
The scene displays exits and a schematic map in the same arrangement as the source.
Exits perform free room transitions; clicking a service approaches its landmark.
The upstairs Mentor hosts respecs. Stat and skill allocation remains portable.

Human Gateway has 20 stages, Monster Portal 10, and Dark Rift 5. Clear each portal
in order, with previous stages replayable. Human 20 unlocks the ending and Rift;
Monster remains optional. The ending permits return to unfinished content. Victory
settlement records new clearance once, while replays grant the advertised normal
rewards. Prepared retries retain world state and restore only paid preparation.

Campaign EXP is 50 × suggested level, gold is 12 + 5 × suggested level. Three
behavior archetypes and single/duo/shield variations generate the stage roster.
Values are provisional. Automated class/build campaign simulations are currently removed.

Weapon shops offer basic (25/65 gold), advanced (110/120 gold), and masterwork
(250 gold) stock, with comparisons, ownership, and Strength checks. The first
victory still awards the Balanced blade. Repeatable merchant-to-Library deliveries
pay 35 gold once per parcel; portal rewards remain the primary income source.
Free recovery at Entry or food at the potion stand prevents resource deadlocks.
The well remains a separate free charge refill beside the seller.

Save v4 supersedes v3. It stores validated room, sequential portal clearance counts,
active delivery/count, and ending state, plus player progression and equipment.
v1–v3 migrate to Entry without inventing campaign clears from historical wins.
Manual save/load is available in every room outside combat. Invalid saves remain
untouched. Resume positions use the room's safe spawn rather than arbitrary saved
coordinates. No SDK, autosave, or external assets were added.

## Class selection presentation

A separate opening screen precedes the overworld. Four generated portraits in
`public/images/classes/` use grayscale at rest and class-colored hover/focus
lighting, with descriptive tooltips and explicit choice buttons. Touch users can
focus portraits before choosing. Phones use two rows for legibility. World art
remains independent. Balanced is now displayed as Wanderer; its stable save ID
`balanced`, stats, and growth remain unchanged. Legacy saves need no migration.

Wuxia theme: Warrior (red), Cultivator (icy blue-white), Windstep (yellow),
and Wanderer (jade), displayed in that order. Portraits use rough, bold brushwork
and distinct action poses with averted gazes. UI terminology uses Qi; internal
resource/class keys remain stable for save compatibility.

## Shared-tree design status

The runtime carries and validates the shared tree's structural scaffold: a
central Wanderer origin, specialist origins midway toward their edges, outward
capstone space, bidirectional connections, free origin junctions, connected
allocations, and mastery exclusivity support. Exact nodes and all move concepts
remain placeholders. The old rank system still drives the playable prototype.
**Skills** in the overworld dock opens the tree screen. It lays out every node
with allocated, available, needs-a-point, and locked states, and a details panel
shows the selected node's effects and the character's total tree bonuses.
**Technique ranks** switches to the legacy rank list. Tree nodes spend the same
Skill Point pool as ranks, so the initial point is never counted twice. A new
character's single point already pays for the free starter rank, so the first
tree point arrives at level 2. The Mentor respec refunds tree nodes together with
ranks and stat choices.
Balance simulations remain intentionally absent; functional tests cover the
topology, effects, content validation, command/event, preference, and persistence
foundations.

## Content editor

`npm run editor` starts the dev server and opens `editor.html`, a dev-only page
that is not part of the production build.

- **Tree tab:** drag nodes on a half-unit grid, Shift+click to link or unlink,
  double-click empty space to add a linked node, and edit id, name, kind, region,
  class origin, mastery group, placeholder state, and effects in the inspector.
  Renaming a node updates every reference to it. **Preview build** picks a class
  and level, allocates nodes with the game's own allocation rules, and shows the
  resulting `syncStats` values and skill effects.
- **Skills tab:** tunes names, icons, descriptions, kind, target, effect, Qi cost,
  level, hits, power, and prerequisites. Skill ids are referenced in code, so
  skills cannot be added, renamed, or removed from the editor.
- Validation from `content/schema.ts` runs on every change. Issues link to the
  node or skill involved and block saving. Undo/redo keeps 200 steps.
- Save posts to a `/__editor/save` middleware in `vite.config.ts`. It validates
  again, formats the JSON with Prettier, and writes `src/content/data`. Vite then
  reloads open game tabs. The game also validates content at startup and refuses
  to start on invalid data.

Effect types:

| Type            | Fields                                                    | Applied in                                        |
| --------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `stat`          | `stat`, `amount` (flat)                                   | `syncStats`, action power, player defense         |
| `statPercent`   | `stat`, `percent` (after flat bonuses)                    | same as `stat`                                    |
| `grantSkill`    | `skill`, `rank` (1–10)                                    | `skillRank`: usable if not learned; highest wins  |
| `skillModifier` | `skill`, `field` (cost/power/hits/uses/percent), `amount` | `effectiveSkill`, used by previews and resolution |
| `flag`          | `flag`                                                    | `hasTreeFlag` for rules implemented in code       |

Stats: `strength`, `speed`, `maxLife`, `maxMana`, `maxEnergy`, `defense`,
`qiDefense`, `physicalPower`, `qiPower`. Granted ranks do not satisfy
prerequisites for learning skills with Skill Points.
