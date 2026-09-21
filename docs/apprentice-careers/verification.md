# Apprentice careers, permanent tower licenses, and the visual pass

> **Historical note:** Hero Builds, Shared Crew Training, and 90's Workshop were replaced by the Kit system (weapons, armor, stance cards). See [Kit, weapons, and armor design](../superpowers/specs/2026-09-21-kit-weapons-armor-design.md) for the current model and save migration rules. The sections below describe the pre-kit apprentice careers pass.

Built from `origin/main` at `9dc5a0f` (PR #9, including its review repair). GitHub was fetched again before delivery; no newer main commits were missing.

## Play it

Open **Hero builds** or **Supply Store** from the van before the first job.

- Each hero has three paths, three passive nodes and a fourth node that unlocks an alternate **C** skill. Eight heroes, 96 nodes, 24 named alternate skills. The five mechanical directions are tower support, poison, helpers, area damage, and focused damage. Each hero gets three directions that work with its original kit.
- Start with one build point. Crew levels increase each hero's independent budget, capped at eight. A point spent on Doni does not spend Jeff's points. Mix paths, select one unlocked C skill, or keep the original C. Q/E/R/T remain available. Respec between jobs is free. Existing shared training, gear, and 90's perks are preserved.
- All 24 tower licenses appear in the store from the beginning. Torch, Washer, and Apprentice Barricade are included. The 100-point welcome balance buys an early additional tool. Other licenses cost 80–290 points, with no map-clear gate. Purchased tools work on any map; five-tool kits and inspection bans still apply.
- A completed run pays `6 × completed waves + .25 × kills` (kills capped at 300), multiplied by difficulty. A win adds 45 before that multiplier. A loss pays half the work total; retiring from endless pays 80%. Partial combat pays at least one point, but an idle exit pays none. Replays pay too. Granting results twice cannot duplicate rewards.
- Older saves keep tools previously available through unlocked maps. New saves use permanent licenses. Currency, ownership and each hero's build survive reload.

## Apprentice Barricade

The existing `barricade` ID is preserved for saved kits. Its new name is **Apprentice Barricade**. Four separate units have four silhouettes/tools, individual health, one hold each, contact-timed attacks, knockout and a nine-second respawn. They rally together and prioritize loose leaks; available squad members assist allies against already-held enemies. This prevents a regenerating enemy from stalling a wave against a lone apprentice while the rest stand idle.

| Tier | HP per apprentice | Combined HP | Apprentices |
|---|---:|---:|---:|
| I | 48 | 192 | 4 |
| II | 64 | 256 | 4 |
| III | 88 | 352 | 4 |
| IV | 116 | 464 | 4 |
| V | 150 | 600 | 4 |
| VI | 194 | 776 | 4 |

Tier I previously used one 260-HP structure. Power specialization adds 25% apprentice HP and 60% damage; control adds 20% HP, 25% reach/damage and nearby healing. Neither adds workers or holds. Crew Lockdown stuns enemies held by the squad. Selling releases holds; upgrading preserves health fractions and cannot revive knocked-out workers. Tower range buffs also affect their reach.

## Visuals

All tower appearances now include working mechanisms: fans, fluid sight glasses, rising bubbles, gauge needles, spinning tool details, heat vents, enamel plates and riveted footings. Turrets gain distinct assemblies and barrels. The apprentice lodge has a moving pennant and four colored equipment hooks. Existing tier armor and specialty banners remain.

The new apprentice source contains 32 painted poses. Runtime import keys its production matte and extracts connected silhouettes instead of cropping tools at cell boundaries. Boots provide consistent anchors. Attacks blend through anticipation/contact/follow-through/recovery; a continuous mesh gait articulates alternating legs and arms. Summoned build helpers have their own appearance, health and lifetime indicators. Poison pools/bubbles and engineer aura boundaries make the new builds visible in combat.

- [All 24 towers](all-24-towers.png)
- [Four apprentice identities and motion poses](four-apprentice-motion-sheet.png)
- [Continuous squad motion and combat recording](apprentice-motion.webm)
- [Phone hero-build screen](mobile-hero-builds.png)
- [Phone store](mobile-store.png)
- [Asset generation and import notes](art-generation.md)

## Acceptance evidence

`npm test -- --maxWorkers=2 --minWorkers=1`: **402 tests across 17 files**. The bounded worker count avoids local worker-RPC timeouts while other applications are busy. `npm run build`: TypeScript and production build pass. Coverage includes real casts for every alternate C, projectile contact procs, nonrecursive poison/splash, focus reset/cap, support removal on movement/knockout, helper replacement/expiration alongside Logan, recruit health/holds/respawn, save migration, purchases and reward idempotence.

Production Chromium, isolated profiles, real mouse/key controls:

- A fresh player saw 24 store entries, bought Vent Stack for 80 of the starting 100 points, and packed it on the first map. Jeff and Doni received separate first-point investments. Purchase, balance, hero selection, and both builds survived reload.
- An ordinary failed Doni run reached wave 10, lost all lives, killed 126 enemies, and banked **40 service points plus 48 XP**. No currency or XP was injected for that run. [Loss report](loss-acceptance.json).
- CBJ cleared all 10 opening waves with **20/20 lives**, six run-rank choices, a purchased specialist ability, a tower active, XP, loot, and persisted campaign progress. Ordinary resources and starter towers. This win paid **147 service points**. [Win report](win-acceptance.json).
- A separate, explicitly funded **5,000-XP UI fixture** exercised all 24 capstone unlocks and selections through real controls, verified each selected C in the loadout, and inspected all eight heroes at 390px. No horizontal overflow or browser exceptions. This fixture demonstrates UI and persistence, not natural progression speed. [Build UI report](build-ui-report.json).
- A further production-input check equipped Jeff’s Acid Flush, verified the career summary and alternate C in the loadout, cast it with C + a yard click, then verified planning freezes its cooldown. [Cast report](custom-c-report.json).
- The isolated renderer fixture sampled all 24 tower types, showed four separate apprentices, recorded walking/attacks/knockout/return, and verified identical pixels when paused. The measured renderer p95 was **5.8 ms** on this machine. This is a local rendering measurement, not a guarantee for every device. [Visual report](visual-report.json).
- Existing headless campaign checks terminate on all nine maps, and all eight heroes still clear the opening map with ordinary resources.

Reproduction scripts: `scripts/browser-careers-check.mjs` (use `--fresh` only on a disposable profile), `scripts/browser-career-builds-ui.mjs` (funded fixture), `scripts/browser-apprentice-visual.mjs` (funded renderer fixture), `scripts/browser-career-cast-check.mjs` (production-input C cast after the funded UI fixture), and the existing `scripts/browser-playtest.mjs`.

Long-term progression pacing and difficulty remain playtestable balance choices; the tests establish working rewards/builds and opening-map viability, not a claim that every possible kit wins every difficulty.
