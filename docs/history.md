# Phase history

Acceptance records for completed phases, moved out of [../tdd.md](../tdd.md). These
are **historical** and are not current product instructions. Current rules live in
the TDD; the running implementation is described in
[technical-design.md](technical-design.md).

## Phase 0 — Technical foundation (complete)

### Required behavior

- Opens through the local Vite server and starts Phaser successfully.
- Shows centered “Hello world” on an otherwise blank background.
- Resizes without clipping or page scrollbars.
- Uses a 1600×900 logical resolution, scaled with `Phaser.Scale.FIT` and centered with
  `Phaser.Scale.CENTER_BOTH`.
- Has no gameplay, menus, decorative art, or reference screenshots.
- Requires no external account, API key, or live platform SDK connection.

The page and game container fill the viewport with no default margin or overflow.
1600×900 is the stable coordinate system; resizing changes only the displayed canvas
size. Verified at desktop, tablet-sized, and phone-sized viewports.

The CrazyGames SDK was explicitly excluded from Phase 0: not installed, loaded,
initialized, or required.

### Suggested initial structure

```
sinjid/
  README.md
  package.json
  package-lock.json
  index.html
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  playwright.config.ts
  eslint.config.js
  .gitignore
  .prettierignore
  .prettierrc.json

  src/
    main.ts
    style.css
    vite-env.d.ts
    game/
      createGame.ts
      scenes/
        HelloWorldScene.ts

  tests/
    e2e/
      hello-world.spec.ts

  docs/
    technical-design.md
    decisions.md
    backlog.md

  public/
    assets/
```

Names could be adjusted to tooling conventions; numerous empty subsystem files were
not to be created. `docs/technical-design.md` held an organized version of the brief,
`docs/decisions.md` actual choices, and `docs/backlog.md` future work.

### npm scripts

```
npm run dev
npm run build
npm run build:bundle
npm run preview
npm run typecheck
npm run lint
npm run format
npm run format:check
npm run check:docs
npm run test
npm run test:watch
npm run test:e2e
npm run test:e2e:run
npm run check
```

Document exactly what `check` includes and whether browser installation is required.
If Vitest has no test files, say so rather than adding a meaningless test.

### Verification and acceptance criteria

1. Dependencies install successfully.
2. The lockfile is present.
3. Type checking passes.
4. Lint and formatting checks pass.
5. The production build succeeds.
6. The game boots in a real browser.
7. The canvas is visible and has nonzero dimensions.
8. The Hello World content renders in the canvas.
9. There are no uncaught application errors during startup.
10. Resizing to desktop and smaller viewports does not break the screen.
11. The production preview works, not just the development server.
12. The production build loads beneath a nested URL path such as `/test-game/build/`.
13. README.md lets another developer repeat these steps.

Canvas content is not DOM text; do not claim rendering from an unrelated hidden label.
Use browser inspection, a small readiness signal, and a screenshot. If environment
limits prevent a check, name the unverified step rather than claiming it passed.

### README requirements

The Phase 0 README covered:

- **Project summary** — a technical foundation containing only Hello World.
- **Prerequisites** — tested Node.js and npm versions, OS assumptions, whether Git is
  required, internet access for first installs.
- **Installation** — `npm ci`; mention `npm.cmd` if PowerShell execution policy blocks
  `npm.ps1`, without weakening system policy.
- **Development** — `npm run dev`, local URL, stopping, hot reload, changing the port,
  and optional LAN testing with firewall implications.
- **Testing and code quality** — all commands, installing Playwright browsers with the
  local version, configured browser projects, report and screenshot locations.
- **Production build and preview** — `npm run build` and `npm run preview`; the release
  is `dist/`; `file://` is not the test method; Vite preview is not production hosting;
  validate beneath a nested URL.
- **CrazyGames preparation** — what is prepared and what remains; never imply Hello
  World is publishable.
- **Project structure**, **troubleshooting** (Node mismatch, occupied ports, missing
  browsers, install failures, blank canvas, relative asset paths), and a **verification
  record** with limitations.

### Completion report

The Phase 0 handoff recorded: the project folder, installed technologies and versions,
files created or changed, the start command, test and build commands, checks completed
and results, environmental blockers, and the README location.

## Phase 1 — Vertical slice (complete)

Authorized with simple placeholder visuals:

- One temple room.
- One enemy.
- A few abilities.
- One complete combat loop.
- Basic equipment interaction.
- Save/load.

## Phase 2 — Combat depth (complete)

Implemented in the existing room, including early Mentor respec support once
allocation existed. Five repeatable encounter tiers and three Training Wards exercised
the systems. No cooldowns were introduced.

- Two-slot refillable potions with charge/effect validation, hybrid recovery, buffs, UI
  previews, and save migration.
- Temporary 16-active-skill compatibility interface backed by the legacy
  prerequisite/rank system, plus passives and basic actions. Not the final shared tree.
- Speed-based opening order and critical chance; ordinary attacks cannot miss.
- Prepared retries, enemy telegraphs, and explanatory combat logging.
- 50 maximum starting Energy; 10 per normal encounter; no walking costs.
- One- and two-enemy encounters, multi-target actions, shields, and summons.
- Class-specific progression; automated balance testing later removed.
- Training Ward with 3/5/20 base EXP and 2/3/10 Energy by difficulty, doubled EXP after
  shield depletion.
- Status effects.
- Prototype multi-enemy behaviors; expanded authored rosters deferred to Phase 3.5.
- Touch and keyboard usability.

## Phase 3 — Temple and progression (complete)

- Room graph follows `layout.png`, including the Library, Statue Room, both upper
  branches, and the ending below Entry.
- 20 Human, 10 optional Monster, and 5 optional Rift stages playable in order. Cleared
  stages were replayable in this phase; the successor design now makes Human Gateway
  stages non-replayable.
- Human 20 unlocks both the ending and Rift; Monster completion is not required.
- Room-specific services: free recovery/food, seller and neighboring well, three
  weapon-shop tiers, Library hints, repeatable 35-gold deliveries, Training Wards, and
  the upstairs Mentor.
- Six fixed weapon options and the existing buckler.
- Manual save/load in any room outside combat; schema v5; older saves migrate.
- Encounter stats and rewards generated from portal stage and behavior archetypes as
  provisional successor balance values.

Original Phase 3 checklist:

- Confirm room graph.
- Shops, training, library, and deliveries.
- Affordable temple-NPC stat/skill respecs with before/after previews and transactional
  confirmation.
- Potion seller with reusable varieties and a free refill well beside the stand.
- Main and optional encounters.
- Ending unlock.
- Economy and progression balancing.

## Phase 3.5 — Foundations implemented so far

- Fixed opening-side and encounter turn-cycle rules.
- Token-checked combat commands, bounded typed combat events, and shared action
  preview/resolution power calculation.
- Validated shared-tree topology, connected allocation, mastery exclusivity,
  reset/refund support, and save-v5 structural persistence without granting
  placeholder moves.
- Independent validated preferences for audio, reduced motion, and screen shake.
