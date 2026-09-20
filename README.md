# Sinjid-inspired browser RPG

Phases 0–3 are playable with simple, replaceable visuals. See [the TDD](tdd.md),
[implemented rules](docs/technical-design.md), and [remaining work](docs/backlog.md).

Use Node 22.13+ and npm 10.9+:

```sh
npm ci
npm run dev
```

To edit the shared skill tree and skill numbers, run `npm run editor` (or open
`/editor.html` on the dev server). Saving writes `src/content/data/*.json`, and open
game tabs reload with the change. See
[Content editor](docs/technical-design.md#content-editor).

Choose a class and travel up to Potions & Food, then left to Human Gateway.
Open **Encounters / Training** at a portal or in the Training Room. **Skills** (in the
bottom-right dock) opens the shared skill tree, where connected nodes and technique
ranks spend the same Skill Points; **Progression** offers stat choices and respec previews. Select an
action and target, then confirm. All 16 active skills stay visible as temporary
prototype content; prerequisites determine availability. Basic Attack restores 10
Qi after resolving. Tab/Enter activates controls, keys 1–9 select skills, and
Escape closes menus or pauses. Losing focus pauses until explicitly resumed.

Buy reusable bottles, equip up to two, and refill at the neighboring well. Recovery
restores Life/Qi/Energy separately. Save/load is manual outside battle; older
saves migrate when loaded.

```sh
npx playwright install chromium
npm run check
```

The check runs types, lint, formatting, unit tests, production build, and browser
flows. It performs one typecheck and one production bundle; Playwright reuses that
bundle with one browser worker. Use `npm run check:docs` for Markdown-only changes.
`npm run test:e2e` remains standalone and builds before testing. Combat tuning is
provisional. CrazyGames integration is the next phase.

The Map follows `layout.png`. Clear 20 Human stages to unlock the ending below
Entry and the optional Dark Rift; Monster has 10 optional stages and Rift has 5.
Journey tracks clears and deliveries. Clicking a room service approaches it.

Entry and the food stand restore resources free. The upstairs Mentor handles
respecs. Weapon shops occupy the merchant, advanced, and Rift rooms. Take merchant
parcels to the Library for 35 gold each. Save v5 includes room, campaign, delivery,
and empty shared-tree progress; v1–v4 migrate while preserving the character.

Wuxia theme: Warrior (red), Cultivator (icy blue-white), Windstep (yellow),
and Wanderer (jade), displayed in that order. Portraits use rough, bold brushwork
and distinct action poses with averted gazes. UI terminology uses Qi; internal
resource/class keys remain stable for save compatibility.
