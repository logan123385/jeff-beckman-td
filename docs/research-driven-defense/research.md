# Research-driven defense

Research and implementation: 20 September 2026. This follows PR #8, merged as
1531c29834ae0b6c17dde98bb4df4d85e6413bba after its two Greptile findings were fixed.

## What makes a strong tower defense game?

There is no universal feature checklist that guarantees a great game. The common
thread in these examples is meaningful, legible decisions: understand a threat,
choose a response, observe the outcome, and try a different strategy. The table
separates documented mechanics and designers' opinions from our recommendations.
This is a primary-source design review, not a claim that we personally played or
benchmarked every game, or that a feature caused its commercial success.

| Reference | Documented design / mechanics | Implication for this game |
| --- | --- | --- |
| [Defender’s Quest — designer Lars Doucet](https://www.gamedeveloper.com/design/optimizing-tower-defense-for-focus-and-thinking---defender-s-quest) | Advocates complete tactical information, pause with actions, slow motion, multiple counters, and distinct unit roles. This is a designer's argument about focus rather than a universal law. | Let the player inspect, construct and order without losing simulation time; make the forecast accurate. |
| [Kingdom Rush Alliance — Ironhide Q&A](https://www.ironhidegames.com/News/Details/341) | Two heroes create combinations and tactical roles; enemy information helps players interpret escalating waves. | This game already has eight selectable heroes. Improve crew experimentation before increasing the simultaneous control burden. |
| [Ironhide devlog 21](https://www.ironhidegames.com/News/Details/502) | Describes removing individual tower leveling because it encouraged grinding; moves toward global upgrades and clearer UI. | Avoid mandatory replay XP and another tower progression layer. Optional recognition can reward mastery without gating power. |
| [Defense Grid — official manual](https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/18500/manuals/manual_english.pdf?t=1721059385) | Tactical reconnaissance, inspection, statistics, path display, time controls, medals and constrained challenge modes. | Add quantified route information and optional objectives, while clearly distinguishing reach from actual damage coverage. |
| [Bloons TD 6 — developer store description](https://store.steampowered.com/app/960090/Bloons_TD_6/?curator_clanid=33027386) | Branching upgrades, abilities, themed Odyssey sequences, quests and user-authored challenges support variety and replay. | Preserve existing specializations and remasters; make switching between hero/tool strategies easy. A challenge editor is a larger future milestone. |
| [Element TD 2 — developer site](https://www.eletd.com/) | Element combinations and multiple upgrade paths make tower composition important. | Better explain and reuse existing compositions before adding more tower types. |
| [Dungeon Warfare 2 — developer store description](https://store.steampowered.com/app/698540/Dungeon_Warfare_2/?curator_clanid=33156170&l=english) | Distinct traps, environmental physics, talents, equipment and difficulty runes provide strategic variation. | Map interactions could be valuable, but need dedicated level design and testing; do not bolt arbitrary hazards onto fixed paths in this pass. |
| [Isle of Arrows — developer site](https://gridpop.co/isle/) | Random tile construction, guilds and multiple modes create a different kind of TD decision space. | Randomized construction is not automatically a fit for our deliberate five-tool loadout and authored maps. Preserve player agency here. |
| [GemCraft — developer updates](https://store.steampowered.com/oldnews/?appgroupname=GemCraft+-+Frostborn+Wrath&appids=1106530&feed=steam_community_announcements) | Developer updates made Trials optional after launch difficulty feedback. | Challenge objectives must not block campaign progress. |

## Priorities implemented

1. **Tactical planning and half speed.** B or the Plan defenses button freezes the
   simulation without a blocking menu. Construction, upgrades, rallies and hero
   orders remain available. Resume explicitly to advance time. Wave calling is
   blocked during planning. Scout and hero-rank panels preserve planning state.
   F cycles 1× → 2× → 3× → ½× → 1×.
2. **Three-wave intelligence.** Scout tabs show upcoming compositions, routes,
   properties, correct scaled health/shell and final entry timing. Future waves
   are inspectable but cannot be called from their tab. Route percentages sample
   direct shooter reach along the centerline, separately for ground and air.
   They include installed construction, not hero/recruit movement, damage,
   immunity, splash or a promise of safety. Pipe Snake uses its actual route
   segment rather than a radial range approximation.
3. **Three saved crews.** Store hero plus ordered tool kit; load against the
   current map's unlocked, permitted tools. Invalid choices are replaced from
   the legal list with visible feedback. Old saves migrate without a version
   reset. Empty, duplicate and retired IDs are sanitized on load.
4. **Optional commendations.** Watertight (no escapes), Small footprint (at most
   four concurrent towers), Full toolbox (build every packed tool type). Recorded
   separately per map, difficulty and remaster, only after a campaign win. No
   power, currency or progression gate. Selling cannot erase the peak tower
   count or previously built types.

## Correctness issue uncovered

Overlapping waves previously shared the most recently started wave's HP scale.
Delayed enemies and split children could therefore become stronger than their
origin wave. Spawn health now derives from the enemy's wave ID, using the same
rounding as scouting, including pressurized HP and cast shells.

## Deferred deliberately

Environmental map actions, player-authored challenges, additional specialization
branches and detailed synergy tutoring remain good candidates for later work.
They require broader balancing or level design. Adding a second controllable
hero, random draws, mandatory dailies, online rankings or extra grinding is not
justified by this game's current needs. No enemy nerfs or resource grants were
used to make the new systems pass tests.
