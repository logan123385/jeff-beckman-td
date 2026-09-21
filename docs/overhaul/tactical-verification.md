# Combined Cursor and tactical update verification

Local verification: September 20, 2026. Integration branch: `codex/tactical-cursor-integration`.

## Provenance

The first tactical implementation was based on stale commit `69e3147`. Its code is
preserved on `codex/tactical-campaign-upgrade` at `0f587e2`; its earlier verification
does not establish the state of this combined version.

This integration starts from GitHub's latest game code, `64298a6`, the head of
[Cursor PR #5](https://github.com/logan123385/jeff-beckman-td/pull/5), which descends
from current `main`, `43e71cf`. Both remote heads were checked again before publication.
PR #3 contains an older residual audit document, not newer game code. PR #5's branch
was left intact; this branch includes its commit so reviewers can assess the complete game.

## Preserved and combined behavior

- Cursor's radial build menu, sticky tool tray, construction time, hero deployment
  from the truck, in-run hero skill ranks, and 1×/2×/3× speeds remain.
- Stacked enemy properties, cast shells, split families, rush waves, family leak
  counts, spare parts, all four remasters, and save/backup hardening remain.
- V still fires a tower's spare-parts active. D still summons Logan for every hero;
  Chris's Q is Sand Trap. Cursor's VFX and Rain on Glass music are included.
- The county campaign map, mission briefings, loadout warnings and paused route
  scouting are added. Scouting uses I to preserve V. Scouting shows Cursor's
  properties, cast shells and children, and restores an existing manual pause.
- The radial menu opens a separate Specialists page after specialization. Purchased
  automatic powers coexist with the existing manual active and have independent
  ranks/cooldowns. Installation, overheat and hero deployment rules are respected.
- Bosses telegraph interruptible attacks. Heat Plant retains Cursor's first ten
  waves and adds three culminating in the First Furnace, using the current base
  boiler HP. A boss breach fails the mission. Results report escaped enemy types.

Reproduced PR #5 findings were fixed: Logan now defends his selected deployment
area, music does not start loading while sound is off, failed loads can retry,
late decoding cannot restart audio after disposal, and freeze-pulse cooldowns no
longer draw misleading frozen-enemy halos. Historical hero captures are explicitly
labeled in [their original report](hero-verification.md).

## Automated checks

| Check | Result | What it establishes |
|---|---|---|
| `npm run build` | Passed | TypeScript and production assets compile |
| `npm test` | 290 passed across 12 files | Existing Cursor tests, tactical cases, combined-system and audio lifecycle regressions |
| `git diff --check` | Passed | No conflict markers or whitespace errors |
| Nine five-tool simulations | All terminate with coherent results | Legal kits and integration; not nine campaign victories |

The newer Cursor waves defeat the simple greedy builder on multiple jobs. The old
nine-clear claim has been removed. Existing opening-job completion tests for all
five heroes remain green. This integration preserves Cursor's encounter tuning;
full campaign balance still needs player testing.

## Browser evidence

An isolated Chromium profile used the local production build on port 5177. Game
actions used mouse/keyboard events; the script read visible controls and the saved
result. No extra cash, simulation hooks, forged stars or save edits were used.
The profile retained progression from earlier test replays; no perks or gear were
purchased or equipped. This is a compatibility run, not a fresh-player balance test.

The run completed Crawlspace on Apprentice with all 20 lives. It deployed Jeff
from the truck, summoned Logan, spent spare parts through V, bought and observed
Pressure Bomb fire through Specialists, picked hero ranks, and verified result/save
persistence after reload without duplicating the first-clear chest. No browser
exceptions were observed. Automation handles rank-up cards interrupting actions
and victory occurring during a final build attempt.

- [Campaign](tactical-campaign.png)
- [Route scouting](tactical-scout.png)
- [Specialist ability after activation](tactical-ability.png)
- [Combined-version victory](tactical-victory.png)
- [Desktop result JSON](tactical-browser-report.json)
- [390px mobile scouting](tactical-mobile.png)
- [Mobile and five-hero UI observations](combined-mobile-report.json)
- [Boss telegraph fixture](tactical-boss-fixture.png)

Mobile checks inspected all five hero kits, cast Chris's Sand Trap, separately
summoned Logan, checked scouting bounds/overflow, and verified that closing scouting
restored a pre-existing manual pause. The boss screenshot uses
`tests/fixtures/bossVisual.ts`, with controlled resources and positions; it is not
an earned Heat Plant clear and is never imported by the production game.

To reproduce the desktop acceptance run:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 5177
# Open the title/campaign screen in an isolated CDP-capable Chromium profile.
# Use Jeff and the default Crawlspace kit; do not run against a player's profile.
node scripts/browser-playtest.mjs <CDP_HTTP_PORT> /tmp/jeff-playtest
```

No merge, hosted deployment, exhaustive campaign playthrough, or commercial-quality
parity claim is part of this verification.

## Scout pause review fix

Greptile's PR #6 finding was reproduced in the production browser: Pause → Scout →
Start job hid the pause overlay, started wave 1, and awarded $24. The implicit
`setPaused(false)` was removed. The same sequence now keeps the pause panel open,
wave 0 and $230 unchanged; the existing live-action guard explains that the player
must resume. The ordinary unpaused Scout call behavior is unchanged. This exact
interaction is now part of `scripts/browser-playtest.mjs`.
