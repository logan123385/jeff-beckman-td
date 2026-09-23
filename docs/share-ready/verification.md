# Share-ready release pass

2026-09-22. Original Jeff Beckman Tower Defense, based on main `a7b6484`, integrating the audit fixes from `089c320` (PR #13). Sneepy TD is a separate game and was not changed.

## Confirmed problems repaired

- Match exit depended on `window.confirm`, which can be suppressed by embedded browsers. Pause → Main menu now uses a game-owned, focus-trapped confirmation. Cancelling preserves pause/planning state. Reset and salvage use the same dialog.
- A stale tab could bank a finished run against old data, then discard that run when it discovered a newer save. Reward transactions now refresh before applying rewards. A regression covers a second completed run, existing purchases, XP, points, job counts, and first-clear chest deduplication.
- Banking on pagehide marked the UI finished before it presented results. The banked receipt and presentation state are now separate; rewards bank at the terminal transition, while the results animation remains independent. Immediate exits and repeated pagehide events are covered.
- Restricted localStorage access could prevent startup. The game now runs with a persistence warning. Failed writes retain the in-memory record for export, and failed imports/resets preserve current progress.
- Download save had no restore counterpart. Title and hub now restore downloaded JSON after validation and a backup. Unsupported or unreadable files do not replace progress.
- A weaker hero heat DoT could change the source and damage type of a stronger descaler effect. Source/type/duration now stay together; final partial ticks use the remaining duration.
- Ranged pin bonuses advanced on launch even if the missile missed. They now advance at the first connecting impact, once across bounces/pierces.
- Empty endless exits no longer count toward hero-card unlocks. Buying a first tower license makes that purchase exportable without skipping the first-job tutorial.
- Results keep navigation buttons on screen while the reward receipt scrolls, including short landscape phones.
- Help reflects touch controls, bought tower licenses, current kits, and the exit/save flows. Mobile title spacing is tighter. Shared links have a title, description, artwork, and favicon.
- Retained PR #13's gear-ID repair, batched rewards, current modifiers module, removal of obsolete tree screens, and persistence notices.

## Evidence

- `npm test` and `npm run build` pass. Tests cover simulation, all heroes, tower abilities, splits, save migration/recovery, progression, gear, remasters, and combat cadence.
- [21 production-browser checks](browser-functional.json): fresh entry, help dismissal, all 24 store entries, purchase, all eight hero kit tabs and both stances, encyclopedia, loadout, first-job tutorial after shopping, touch exits with native confirms disabled, save restore/backup/reload, and startup/play with storage blocked. No runtime exceptions.
- [Five lifecycle checks](browser-terminal.json): terminal pagehide and receipt presentation, immediate victory exit, repeat-clear loot, loss/retry, background pause, and clock-out from pause. These use explicit terminal-state fixtures in the dev runtime; they are not campaign wins.
- [22 measured layouts](mobile-layouts.json): 320–1440px widths, short landscape down to 667×280, tablet, rotation, boss/five-tool stress, and desktop. Battlefield and dock do not overlap; combat controls stay on screen, and compact-layout targets are at least 44px. Real CDP touch input also builds a tower, deploys the hero, casts Logan, calls a wave, and opens scout/pause.
- [Apprentice campaign simulation](campaign-apprentice.json): all nine maps won with normal resources, capped kits, CBJ (Big Mike on Heat Plant), seed 7, and no equipment bonuses. Lift Station uses a deliberate split-route deployment. This proves one viable strategy, not universal difficulty balance.
- [Journeyman campaign simulation](campaign-journeyman.json): the same policy wins seven of nine. Lift Station and Heat Plant defeat that policy. They were not weakened merely to make an automated builder win. Equipment, hero choices, and different strategies are not exhausted by this check.
- All eight heroes exercised in the endless simulation with ordinary resources; each survives 10–14 completed waves, then loses normally without a simulation exception.

## Reproduce

Use a disposable `agent-browser` session and its CDP port. The functional check expects a fresh save. The terminal fixture resets its disposable save. Never point these at an owner's browser profile.

```sh
npm ci
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 5188 --strictPort
# Open the preview in the isolated browser first:
node scripts/browser-release-check.mjs <CDP-port> /tmp/jeff-release http://127.0.0.1:5188/
node scripts/browser-mobile-check.mjs <CDP-port> /tmp/jeff-layouts http://127.0.0.1:5188/
# Terminal fixture needs the dev server (5187), not the production bundle:
node scripts/browser-terminal-check.mjs <CDP-port> /tmp/jeff-terminal http://127.0.0.1:5187/
npx vite-node scripts/tactical-campaign-check.ts /tmp/campaign.json apprentice
npx vite-node scripts/hero-service-call-check.ts
```

## Limits

Browser evidence uses Chromium with touch emulation. A physical iPhone, Android phone, and Snapchat's actual webview have not been exercised. Suppressed native dialogs and blocked storage were reproduced separately. Full Master/remaster clears and every possible build combination are not claimed. Saves remain device/browser local; this release does not add cloud sync or offline installation. localStorage revision checks reduce stale-tab overwrites; they are not a database transaction across processes.
