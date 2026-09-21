# Verification

All browser evidence uses the production build served at 127.0.0.1:5177, an
isolated browser profile, ordinary input and normal game resources. No user save
was reset and no runtime resources or simulation state were injected.

- `npm run build`: passed TypeScript and production bundling.
- `npm test -- --reporter=dot`: 346 tests in 14 files passed. Added regressions
  cover wave-specific health/shell, pure forecasts, ground/air and Pipe Snake
  coverage, malformed and migrated saves, legal crew loading, peak construction,
  full-kit tracking, and independent/idempotent commendation records.
- `node scripts/browser-research-check.mjs <cdp-port> <output>`: saved a Doni crew,
  selected CBJ, restored Doni, reloaded the page and verified persistence. Built
  towers using real money with planning active; cooldown remained frozen; wave
  calling stayed blocked; resuming advanced the cooldown. Inspected all three
  forecast tabs, verified future-wave calling disabled, restored planning and
  manual pause correctly, selected half speed, and checked 390px layout.
- `node scripts/browser-gameplay-check.mjs <cdp-port> <output>`: existing combat
  flow regression passed, including call-mash guard, 8-second early-call recovery,
  voluntary ranks, keyboard focus, queued movement, tower upgrade comparisons,
  wave receipts and contained/reachable mobile tower commands.
- `node scripts/browser-playtest.mjs <cdp-port> <output> CBJ`: won all ten
  Apprentice Crawlspace waves with 20 lives, six hero rank choices, a trained
  specialist that fired, and tower actives. Earned 84 XP and one first-clear gear
  item. Results showed all three goals; Watertight was recorded and persisted
  across reload. No browser exceptions.
- Screenshots were visually inspected. The mobile Scout now fills the viewport;
  disabling the battlefield's animated CSS filter while scouting prevents it
  from capturing the fixed-position dialog. Crew buttons reserve scroll margin
  above the sticky loadout footer.

Reports and representative screenshots are in [evidence](evidence/).

Limits: route reach is explicitly an approximation, not a damage or immunity
simulation. This pass does not claim human balance acceptance for every
hero/map/remaster combination. Existing campaign simulation tests pass; a
single complete browser campaign job supplements them.
