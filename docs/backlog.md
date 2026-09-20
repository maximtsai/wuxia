# Remaining technical backlog

Phases 0–3 are implemented. The connected temple, 35-stage campaign, ending,
deliveries, shops, and room-specific services are playable with placeholder visuals.

Phase 3.5 now includes fixed opening-order infrastructure, typed combat commands
and events, shared preview/resolution power calculation, a validated placeholder
shared-tree scaffold, save v5 tree persistence, and independent preferences.

- Complete the shared-tree UI, connect its existing reset/refund primitive to the
  Mentor, and replace temporary rank progression only after actual nodes and moves
  are approved.
- Design update (2026-09-13), approved in [../tdd.md](../tdd.md) but not implemented:
  - Make cleared Human Gateway stages non-replayable (the build currently allows
    replays); keep Monster Portal and Dark Rift replays.
  - Give all classes identical per-level growth and narrower starting-stat differences;
    remove the per-level stat choice and class-specific level-up modifiers. Add a
    versioned save migration that drops stored stat choices and recomputes stats
    without losing level, EXP, or other progression.
  - Lay out the tree with pure stat nodes between abilities, drawback-free fundamental
    center nodes (Qi recovery toward Cultivator, Life recovery toward Warrior, Quick
    Draught toward Windstep), and extreme outer nodes with drawbacks. Quick Draught
    needs a once-per-encounter turn-keeping potion drink in combat commands, retries,
    potion UI, and logs.
  - Support per-encounter limited-use techniques in content, commands, retries, UI, and
    logs.
  - Remove boss-specific damage caps from ability math and tooltips.
  - Lower respec pricing to very cheap.
  - Replace deliveries with authored mini-quests that fall back to repeatable
    deliveries once exhausted.
- Break the remaining overworld/menu presentation out of `SliceScene.ts` as real
  screens when those screens begin receiving final UI designs.
- Add a short authored onboarding sequence and polish Human stages 1–5 after the
  initial move set is approved. Do not expand or simulate balance before then.
- Phase 4: CrazyGames adapter/SDK, current requirements verification, platform
  persistence, asset budgets, preview testing, submission materials, and release.
  Keep local play independent of the SDK.
- Human playtesting: difficulty, resource pacing, class/build diversity, shop value,
  and whether the Training Ward and mini-quests give stuck players enough catch-up now
  that Human stages cannot be replayed. Automated balance simulations are removed
  while mechanics remain in flux.
- Validate physical touch devices, Firefox, and WebKit; existing browser checks
  cover Chromium, keyboard activation, and emulated touch with responsive layouts.
- Replace geometric visuals when a theme is chosen; add loading/failure handling,
  animation/audio lifecycle, settings, and optimization when assets arrive.
- Optional content expansion: armor and more shield items, richer NPC stories,
  more individually authored enemy patterns, and additional item milestones.
- Consider extracting more scene presentation as future screens grow. Keep manual
  saves unless a deliberate autosave policy is introduced with migration support.
