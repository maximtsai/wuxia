# Implemented technical decisions

## Phase 0

- Use Phaser with TypeScript and Vite as a browser-native stack.
- Keep Phaser as the only production dependency.
- Use a fixed 1600×900 logical resolution with responsive `FIT` scaling and
  `CENTER_BOTH` canvas centering.
- Use `Phaser.AUTO` so Phaser selects its supported renderer.
- Configure Vite with `base: './'` and test the build below a nested URL.
- Use Chromium as the initial Playwright browser project.
- Do not install or scaffold the CrazyGames SDK or platform adapter in Phase 0.
- Do not create empty directories for future architecture.

## Phase 1

- User authorized a playable vertical slice with low-effort, replaceable visuals.
- Keep the existing stack; use shapes and HTML buttons without external assets.
- Theme names/colors and numeric content definitions live outside pure rules.
- One session owns state across room/combat views; no global game-state framework.
- Use a fixed prototype build and player-first guaranteed-hit combat. Full Speed
  rules, classes, skill trees and leveling are deferred to Phase 2.
- Enemy damage is shown before actions as a provisional prototype aid.
- Explicit manual room save/load; no automatic overwrite or battle save.
- Free recovery restores Life/Mana/Energy but not consumables. No defeat penalty.
- Energy decreases by movement distance; zero Energy halves movement speed.
- Responsive DOM controls can scroll vertically below the fixed-coordinate canvas.
- Browser tests always start a fresh server instead of reusing stale output.

## Approved rule update implemented

Supersedes earlier Phase 1 resource and fixed-turn decisions:

- 50 starting/max Energy, free full-speed walking, 10 Energy once per entry.
- Post-fee deep preparation snapshots support same-encounter defeat retries.
  Returning ends the chain; rewards settle once. No mid-battle persistence.
- Speed orders the two combatants, enemy wins ties. All ordinary attacks hit.
  Prototype crit chance: min(40%, 5% + 0.5% per Speed); damage multiplier 1.5,
  floored. Injected randomness supports deterministic rule tests.
- Named enemy intents and a bounded 20-entry log share resolved battle state.
- Five reusable potion definitions, one owned bottle per type, two arbitrary
  slots. Shop sells full bottles; the neighboring well freely refills all owned
  bottles. Recovery and equipment swaps do not refill them.
- Guard reduces the next two enemy hits by half, rounding damage up. Reapplication
  refreshes duration rather than stacking mitigation; combat exit clears it.
- Save v2 migrates v1 Energy proportionally, preserves capped starter charges,
  and converts surplus disposable uses to 1 gold each. Existing save key retained.
- Stat/skill respecs await allocatable progression; no paid no-op respec is added.
- Seller/well are provisional services in the existing room; future world layout
  still follows layout.png. Theme and numeric balance remain data-driven.

## Phase 2

The Phase 2 implementation supersedes historical fixed-build, Energy-cap, log-size,
and deferred-respec decisions above. See [technical-design.md](technical-design.md)
for current rules. Four classes, level/stat choices, 19 prerequisite skills,
multi-enemy combat, shields, statuses, shadows, and three Training Wards now exist.
Respec support was brought forward because allocation is now implemented. Saves
use v3 with v1/v2 migration. Combat and progression values remain provisional;
visuals stay geometric and theme-independent. Connected rooms remain Phase 3.

## Phase 3

- Follow every room connection in the user-supplied `layout.png`.
- Human completion unlocks the exit and Dark Rift; Monster is optional. This is a
  successor gate choice resolving the earlier reference ambiguity.
- Generate 20/10/5 sequential portal stages from typed archetypes and balance data.
- Keep manual saves in every room, with explicit v4 migration and no campaign
  unlocks inferred from old prototype wins.
- Room service buttons approach their landmark; exits transition immediately and
  cost no Energy. Respec is located upstairs; allocation is available everywhere.
- Keep free recovery and well access, fixed weapon stock, and a 35-gold delivery
  fallback. Broader armor/shield content remains a future extension.

## Phase 3.5 foundations

- Keep the existing rank-based move roster only as playable prototype content.
  Do not treat proposed techniques, masteries, Disciplines, Vows, coefficients, or
  node counts as final. Basic Attack restoring exactly 10 Qi is the only finalized
  successor move rule.
- Speed selects the opening side once. Preserve that encounter order as a fixed
  cycle; never recalculate turn positions from Speed. Enemies win opening ties.
- Route UI combat actions through typed, token-checked commands. Record bounded
  typed combat events independently of the human-readable log, and calculate
  previewed and resolved base power through the same pure function.
- Add a connected placeholder tree scaffold with specialist origins midway toward
  their themed edges and generic outer capstone space. Persist empty allocation
  state without granting placeholder gameplay effects.
- Save schema v5 adds validated shared-tree state and migrates v1–v4 without
  inventing allocations. Preferences use a separate validated storage key.
- Do not add balance simulations while abilities and numeric tuning are in flux.
