> This records the initial illustrated pass. See [crew update verification](crew-verification.md) for the subsequent crew milestone and [hero verification](hero-verification.md) for the latest 200-test build.

# Overhaul verification — September 19, 2026

## Automated checks

- `npm run build`: TypeScript and production bundling passed.
- `npm test`: 120 tests passed (65 simulation, 36 overhaul, 19 campaign balance).
- Campaign checks cover all nine maps, including clears with Jeff disabled,
  tower contribution with Jeff enabled, and an undefended field losing.
- New checks cover first-wave preparation, exact wave previews, all 24 towers'
  independent elite purchases and refunds, control pulses, medic healing,
  camera mark strength, crew placement/cooldowns/expiration/death, rally bounds,
  and stunned enemies being unable to attack their holders.
- `git diff --check`: passed.

## Browser checks

Served the production build at `http://127.0.0.1:4173` in an isolated automation
session. Used the actual title, loadout, battlefield, upgrade, and result controls.
No existing player save was edited.

- Title, painted Jeff with black ear gauges, tower portraits, and map art loaded.
- First wave remained in preparation until called.
- Built a pressure washer and barricade; moved the barricade rally point;
  selected and moved Jeff; deployed support crew; activated all five skills.
- Inspected numeric cooldowns, skill effects, tower upgrades and elite options.
- Purchased Field Medic Lodge through the real elite menu after scripted clicks
  called waves early for cash: 768 HP, five holds, and a $295 sell value appeared.
  This used UI buttons, without injecting simulation state or save data.
- Finished Crawlspace Chaos on Journeyman: 10 waves, 11 lives remaining,
  146 kills, two stars, +80 XP, and a gear chest. Returned to the van and
  entered the newly unlocked Boiler Room Blues.
- Final desktop layout at 1440 × 960: document width 1440, document height
  960, scroll offset zero. The complete battlefield and HUD fit the viewport.
- At 390 × 844, title and battlefield document widths were both exactly 390px,
  with no horizontal overflow. Visually inspected both screenshots.
- Browser page-error logs were empty after combat and after the final skill-art pass.

The automation tool's keyboard command generated repeated synthetic key events;
subsequent interaction used visible buttons and pointer controls. Keyboard bindings
remain implemented, but these checks do not establish physical-keyboard or physical
mobile-device acceptance. The complete interactive clear covered the first map;
the remaining campaign maps were covered by headless balance checks.

## Evidence

- [Desktop title](evidence/title.png)
- [Final desktop preparation layout](evidence/desktop-preparation.png)
- [First-map combat](evidence/desktop-battle.png)
- [Updated skill presentation and boiler workshop](evidence/abilities.png)
- [Elite upgrade after purchase](evidence/elite-upgrade.png)
- [Completed job and rewards](evidence/run-results.png)
- [Mobile title](evidence/mobile-title.png)
- [Mobile battlefield](evidence/mobile-battle.png)

The first-map screenshots predate the final removal of overlapping skill plaques.
The final desktop preparation screenshot also includes the viewport sizing fix;
earlier combat captures are 25 pixels taller. Original PNG
sources and generated-image prompts are documented in [art direction](art-direction.md).

These checks record the local implementation and production preview before PR
publication. No hosted deployment or merge was part of this validation.
