# Jeff Beckman TD — Residual Correctness findings

| Field | Value |
|---|---|
| **Lane** | correctness (residual) |
| **Run** | `20260919-2225-deep-residual` / task `R1-correctness` |
| **Revision** | `56f5e1c394867eb2c89747425395c05c2b601001` |
| **Independence** | First residual pass. Read only the attached brief, locked ledger index, and prior-gaps excerpt. Did not read peer residual lanes. |
| **Method** | Read-only vs application source. Evidence from `vite-node` probes that called `deployHero` + `rankAbility` + aim payloads. No application source edits. |

## 1. Meta

**HEAD verified**

```
56f5e1c394867eb2c89747425395c05c2b601001
56f5e1c Merge pull request #2 from logan123385/review/hero-ranks-and-play-feel
```

**Commands executed**

| Command | Result |
|---|---|
| `git rev-parse HEAD` | `56f5e1c394867eb2c89747425395c05c2b601001` |
| `npm install` | 51 packages, clean enough to run vitest / vite-node |
| `npx vite-node` focused probes (deployHero + rankAbility ×3 + aim) | See findings. Probe scripts were ephemeral and not left in the tree. |
| `npx vitest run tests/heroes.test.ts tests/sim.test.ts` | **50 failed / 60 passed** — same inert-hero / undeployed-kit pattern already locked as CORR-001 / CORR-012. Not re-filed. |

**What this pass actually exercised (that the locked run called out as untested)**

- All five kits after `deployHero({x,y})`.
- Targeted abilities with `{ pos, enemyId }` aim (Mike volley / rain, Bob beam, FORE, Becbec haymaker).
- `rankAbility(slot)` ×3 on Clamp, Pulse, Review, Rain, Unleash Logan, Isolation Sleeve.
- Washer splash incoming leftover, Weak vs partial/full reservation, Close vs flying, Last vs phased.
- Night `boss()` schedule over 200 procedural indices; clock-out `xpForRun` / `chestsForRun` vs `nightWavesCompleted`.
- Municipal leftover dump after a 1800s hero-off harness; Lift dual-path force-place.
- Torch strike vs flying; torch control specialization elite stun.
- Second Wind lifesteal on Rampage vs basic saw.
- Audio: `src/sim/**` has zero `audio` / `AudioBus` imports.

## 2. Summary counts (CORR-R** only)

| Severity | Count | IDs |
|---|---:|---|
| high | 0 | — |
| medium | 5 | CORR-R01, CORR-R02, CORR-R03, CORR-R04, CORR-R06 |
| low | 2 | CORR-R05, CORR-R07 |
| note | 0 | — |
| **Total net-new** | **7** | |

No locked ID was re-opened. Rediscoveries are one-liners in §4.

---

## 3. Findings

### CORR-R01 — Unleash Logan ★2 “Faster bites” is a no-op

| Field | Value |
|---|---|
| **ID** | CORR-R01 |
| **Title** | Logan’s attack interval stays 0.49s at every ability rank |
| **Severity** | medium |
| **Category** | ability-rank / kit math |
| **Assertion** | After `rankAbility(0)` ×3, Logan’s bite cadence must be faster than the unranked 0.49s timer (rank-2 blurb: “Faster bites. More health.”). |
| **Paths + lines** | `src/data/heroes.ts` 101–102 (rank blurbs); `src/sim/heroPowers.ts` 216–219 (HP / duration use `pwr`); `src/sim/heroPowers.ts` 337 (`s.attackTimer = .49` hardcoded) |
| **Preconditions** | Deploy Chris. `pendingRankUps = 3`, `rankAbility(0)` three times. Cast Unleash Logan with an in-range ground leak. |
| **Expected** | Bite interval shrinks with rank (at least at ★2 / ★3). HP and lifetime already scale (`230 * pwr`, `18 * pwr`). |
| **Actual** | ★3 Logan is 354 HP / 27.72s (correct). Measured swing gap is still **0.500s** (timer 0.49). Rank 2’s “faster bites” never reads `abilityRank` / `abilityPower`. |
| **Evidence** | `deployHero` + `rankAbility(0)×3` + `useAbility(0)` + 180 frames of `update(1/60)`. `{ swings: 6, gap: 0.49999999999999856 }`. Unranked timer in source is the same `.49`. |
| **Confidence** | high (executed) |
| **Smallest fix** | Scale `s.attackTimer` (and maybe `s.swing`) by `abilityCdFactor` or `1 / (1 + abilityRank(game, 0) * k)` at the attack-start site in `updateHeroSummons`. |
| **Non-goals** | Do not retune Logan HP/duration (those already match rank 1). Do not change hold-1 rules. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

### CORR-R02 — Weak aim ignores partial overkill reservation

| Field | Value |
|---|---|
| **ID** | CORR-R02 |
| **Title** | Weak ranks by current HP and will retarget a reserved-but-not-dead leak |
| **Severity** | medium |
| **Category** | targeting |
| **Assertion** | `pickTarget` already skips `hp - incoming <= 0`. Weak should not pile onto a drip that is already reserved down to a sliver when a healthier unreserved drip is in range. |
| **Paths + lines** | `src/sim/combat.ts` 219–233 (`hp - incoming <= 0` skip only); 250–251 (`case 'weak': return e.hp < best.hp`) |
| **Preconditions** | Torch (or any shooter) with `aim = 'weak'`. Drip A: `hp=12`, `incoming=10`. Drip B: `hp=20`, `incoming=0`. Both in range. |
| **Expected** | Weak prefers the leak that will actually die from a new shot — B, or A ranked by remaining HP (`hp - incoming`). Reservation exists so shooters do not stack. |
| **Actual** | Weak picks A (`12 < 20`) even though A has only 2 unreserved HP. Fully reserved A (`incoming=12`) *is* skipped — the hole is the partial case. |
| **Evidence** | Direct `pickTarget` probe after `deployHero` + `placeTower(0, 'torch')` + `t.aim = 'weak'`. Partial: picked A. Full reserve: picked B. |
| **Confidence** | high (executed) |
| **Smallest fix** | Rank Weak on `e.hp - e.incoming` (same remaining-HP key First/Last already use for path). Keep the existing full-reserve skip. |
| **Non-goals** | Not CORR-008 (Strong uses max HP vs Weak current HP). Not CORR-005 (Last/Weak HUD label). Do not change Strong. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

### CORR-R03 — Clock-out XP and crates drop the in-progress wave

| Field | Value |
|---|---|
| **ID** | CORR-R03 |
| **Title** | `nightWavesCompleted` says clock-out keeps the current wave; `xpForRun` / `chestsForRun` use `completedWaves` only |
| **Severity** | medium |
| **Category** | Night Shift rewards |
| **Assertion** | Soft clock-out must credit the wave you are on (`nightWavesCompleted(waveIdx, true) === waveIdx`). Drown drops the unfinished one. |
| **Paths + lines** | `src/data/xp.ts` 44–47 (documented helper, **never called**); `src/data/progress.ts` 34–41 and 45–47 (live path uses `game.completedWaves`); `src/sim/game.ts` 635–638 (`retire` does not bump `completedWaves`); `src/ui/screens/play.ts` 1147–1148 (`recordServiceCall(game.completedWaves)`) |
| **Preconditions** | The Neverending Service Call. `callNextWave()` once (wave 1 active, `completedWaves === 0`). `retire()`. |
| **Expected** | Helper: completed = 1, `nightXp(1, true) = 23`. Consolation / milestone crates keyed off that count. |
| **Actual** | `xpForRun = 0`. Mid-wave-8 (`waveIdx=8`, `completedWaves=7`): XP 81 and crates `['night']` (wave-5 milestone only). Helper would credit wave 8 and the ≥8 consolation crate. |
| **Evidence** | Executed `Game(SERVICE_CALL)` retire probes. `grep` shows `nightWavesCompleted` has no callers outside its definition. |
| **Confidence** | high (executed + dead helper) |
| **Smallest fix** | `const completed = nightWavesCompleted(game.waveIdx, game.status === 'retired')` in `xpForRun` and `chestsForRun` (and `recordServiceCall`). Drown path already matches the helper (`waveIdx - 1`). |
| **Non-goals** | Not CORR-006 (CLEAN CALL + cleared-call double pay on a *cleared* wave). Do not change `nightXp` formula. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

### CORR-R04 — Night `boss()` schedule almost never fires

| Field | Value |
|---|---|
| **ID** | CORR-R04 |
| **Title** | `boss()` (every 10th glycol / 20th rogue boiler) is only consulted in Graveyard windows that almost never contain those indices |
| **Severity** | medium |
| **Category** | Night Shift wave script |
| **Assertion** | If `boss(index)` encodes a 10/20-wave cadence, those bosses must appear on that cadence in the procedural stretch — not once every ~70 Graveyard-aligned ticks. |
| **Paths + lines** | `src/data/night.ts` 51–55 (`boss`); 115–122 (Graveyard is the **only** caller); 33–35 (`nightMutatorAt` = 5-wave blocks over 7 mutators). Freeze Snap (`n % 8 === 0`) is a separate glycol injection. |
| **Preconditions** | Enumerate `generateEndlessWave(proc, 2)` for `proc = 0..199` after the 5-wave scripted opener. |
| **Expected** | Glycol / rogue boiler on procedural 9, 19, 29… (or an equivalent advertised cadence). First Graveyard block (proc 30–34) should be able to roll the helper’s boss. |
| **Actual** | First 80 procedural waves: glycol/rogue from `boss()` **once** (proc 69 / call **75**, glycol). First `rogueBoiler` from `boss()` is proc **139 / call 145**. Graveyard 30–34 is five `frozenMain` packs. Extra glycols in Freeze Snap (proc 23, 55) come from the `% 8` side door, not `boss()`. |
| **Evidence** | Executed schedule dump. `boss()` is referenced only in the `graveyard` case. |
| **Confidence** | high (executed) |
| **Smallest fix** | Call `boss(index)` from every 10th procedural wave regardless of mutator (or align Graveyard windows to `index % 10 === 9`). Do not leave the helper as dead cadence. |
| **Non-goals** | Not CORR-011 (mutators only change the recipe — this *is* the recipe, and the helper inside it does not run). Do not add combat mutators. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

### CORR-R05 — Rank-up pause does not stop an in-flight `GameLoop` burst

| Field | Value |
|---|---|
| **ID** | CORR-R05 |
| **Title** | `pendingRankUps` pauses the next rAF, not the rest of the current step burst |
| **Severity** | low |
| **Category** | rank-up / sim lock |
| **Assertion** | Once a level-up is granted, the yard must stop before more leaks walk / more XP is granted. `play.ts` sets `loop.paused` for that purpose. |
| **Paths + lines** | `src/core/loop.ts` 33–41 (`paused` read only before the `while`); `src/ui/screens/play.ts` 173–177 and 471–473 (`syncPause` inside `handlers.update`); `src/sim/game.ts` 752–753 (`Game.update` ignores `pendingRankUps`) |
| **Preconditions** | 3× speed or a hitch (`elapsed` capped at 0.25s → up to 36 fixed steps per rAF). A kill in step *k* of that burst calls `grantHeroXp` → `pendingRankUps += 1`. |
| **Expected** | Remaining steps in the burst do not run (or `Game.update` no-ops while `pendingRankUps > 0`). |
| **Actual** | `syncPause()` sets `loop.paused = true` mid-burst; the `while` never re-reads it. `Game.update` keeps ticking. Probe: `grantHeroXp(missionXpToNext(1))` then 16 more `update` calls — sim time advanced 0.18s with `pendingRankUps === 1`. |
| **Evidence** | Source of `GameLoop.tick` + `play.ts` update hook. Direct grant + continued `update` loop. |
| **Confidence** | high (source + executed). Player-visible only under 2×/3× or a long frame — hence low, not medium. |
| **Smallest fix** | Break the `while` when `this.paused` becomes true, **or** start `Game.update` with `if (this.pendingRankUps > 0) return` (UI still collects the pick). |
| **Non-goals** | Not the unconfirmed “`rankPanel.show()` fails → hard softlock” gap. Keys Q/E/R/T/C still rank if the overlay is up. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

### CORR-R06 — Second Wind lifesteal does not apply to Reciprocating Rampage

| Field | Value |
|---|---|
| **ID** | CORR-R06 |
| **Title** | Rampage saw cuts deal damage during Second Wind and return 0 health |
| **Severity** | medium |
| **Category** | kit / lifesteal |
| **Assertion** | Second Wind: “saw attacks … return 45% of damage dealt as health.” Rampage is three saw cuts (`glyph: 'saw'`). Those hits must lifesteal while `hero.lifesteal > 0`. |
| **Paths + lines** | `src/data/heroes.ts` 109–110 (blurb); `src/sim/heroPowers.ts` 88–96 (Rampage `applyDamage`, no lifesteal); 247–250 (basic saw is the **only** lifesteal site) |
| **Preconditions** | Deploy Chris at 200 HP. Cast Second Wind (heals to 300). Immediate Rampage on a 10k-HP sludge. |
| **Expected** | ~45% of the ~98 Rampage damage returns as HP. |
| **Actual** | Enemy lost 98.2. Hero HP stayed **300** (`hpDelta: 0`) with `lifesteal` still ~6.3s. Control: basic saws in the same window healed **+25.65** on 66 damage. |
| **Evidence** | `deployHero` + `useAbility(4)` then `useAbility(2)` vs basic-attack control. |
| **Confidence** | high (executed) |
| **Smallest fix** | After each Rampage `applyDamage`, apply the same `dealt * 0.45` heal used in `strikeNewHero` when `h.lifesteal > 0`. |
| **Non-goals** | Attack-speed on the channeled combo (fixed contact frames) is a separate product call. Do not change the 100 HP burst heal. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

### CORR-R07 — Last-aim tooltip describes the wrong rule

| Field | Value |
|---|---|
| **ID** | CORR-R07 |
| **Title** | Last is advertised as “just entered range” but ranks by remaining path |
| **Severity** | low |
| **Category** | targeting copy vs sim |
| **Assertion** | Wheel / HUD copy for Last must match `preferTarget` (`remaining path` greater). |
| **Paths + lines** | `src/sim/combat.ts` 203 (`AIM_HINT.last`); 246–247 (`case 'last': rem > bestRem`); `src/ui/play/popover.ts` 210 (`Shoots ${AIM_HINT[t.aim]}`) |
| **Preconditions** | Select a shooter, cycle to Last, read the Aim spoke tooltip. |
| **Expected** | Copy matches the sim: the leak farthest from the valve / with the most pipe left. |
| **Actual** | Tooltip: “the leak that just entered range.” That would be a time-in-range key the sim does not store. A leak can *just* enter a mid-path washer circle and still be First (less pipe left). |
| **Evidence** | Source. `AIM_HINT` object printed from the same module the wheel imports. |
| **Confidence** | high (source). Not re-tested in a browser — copy is load-bearing. |
| **Smallest fix** | Change `AIM_HINT.last` to “the leak farthest from the valve” (mirror First). Leave the comparator alone. |
| **Non-goals** | Not CORR-005 (Weak labeled Last on the *cycle hint* ternary). The wheel **sub-label** already prints `AIM_LABEL.weak === 'Weak'`. |
| **Disposition** | open |
| **Revision** | 56f5e1c39486 |

---

## 4. Covered by prior run — no new ID

| Hunt theme | Result |
|---|---|
| Ability rank math — Bob Review marks 4 at ★3 | **searched, nothing new.** After `deployHero` + `rankAbility(4)×3`, four toughest marked; `markBonus = 0.3 * 1.54 = 0.462`. |
| Ability rank math — Jeff clamp holds 8 | **searched, nothing new.** `clampHolds() === 8`; after draining rank-up hitstop, 8/9 in-radius drips `heldBy === { kind: 'clamp' }`. (A first probe that stepped only 0.05s saw 0 holds — that was leftover `requestHitstop(0.05)` from `rankAbility`, not a clamp bug.) |
| Ability rank math — Pulse `38 * 1.54` | **searched, nothing new.** Dealt **58.52** to a 0-armor drip at level 1. |
| Ability rank math — Mike rain still 9 ticks | **searched, nothing new.** ★3 zone lasts 6.93s; `ticks === 9`; zone then expires. |
| Ability rank math — sleeve ★3 | **searched, nothing new.** 9 hero holds (2 + 4 + 3). |
| Rank-up softlock if `rankPanel.show()` fails | **searched, unconfirmed.** `live()` + `syncPause` + Q/E/R/T/C still rank. Cannot fail `show()` without breaking the overlay node. Softlock remains hypothetical. Mid-burst pause hole filed as CORR-R05 (different root cause). |
| Post-deploy kit combat + aim (all five heroes) | **searched, nothing new** for “kits do not fire.” All five slots returned true after `deployHero` (+ aim on targeted skills). Mike volley: no-aim `false`, aimed 3 missiles. FORE: 70 / 49 / 34.3 on three targets. Haymaker rejects flyers, accepts ground. Kit *tests* still undeployed: already covered: CORR-001, CORR-012. |
| Splash overkill / leftover `incoming` | **searched, nothing new.** Two sludges in washer splash: primary died, secondary took 22, both `incoming === 0`. Dual washers also cleared reservation. No double-dip on the primary. |
| Stage 0 Municipal leftover crabs | already covered: CORR-002. 1800s hero-off timeout, wave 15 still playing, 6 unheld scale crabs at path-1 progress ~85–123. **Not an entrance-hold-outside-range geometry bug:** `heldBy === null` (they just spawned). Slots 2 `(120,430)` and 3 `(130,565)` are 95 / 81 px from path-1-at-100 — torch 95 and washer 110 both cover if the harness plants there. Harness planted washer at slot 5 instead. |
| Stage 0 Lift wave-4 wipe | already covered: CORR-002. Default harness lost wave 4 / 88s. Forced dual-path barricade+washer still lost (wave 8 with a money dump). Harness-weak / not a new map-geometry ID. |
| Sticky tray / specialize / KR wheel | already covered: CORR-004 (regular barricade rally), CORR-005 (cycle-hint maps Weak → “Last”). Tray + keys 1–9 filter `allowedTowers`. Specialize keeps `def.id`; sticky replants the base tool. Esc disarms on the second press. **searched, nothing new.** |
| Close / Last / Weak vs flying / phased / marked | already covered: CORR-005, CORR-008. Close on torch (targets `both`) correctly prefers a nearby wisp. Last skips phased airlocks. Partial-reserve Weak is CORR-R02; Last tooltip is CORR-R07. |
| Night Shift mutators / recipe-only | already covered: CORR-011. HUD mutator vs `startWave` matches: waves 6–10 Rush Hour, 11+ Mineral Bloom. |
| All-hero respawn 11s | already covered: ARCH-002. Every kit’s `damageHero` uses `JEFF.respawn` (11). No per-hero field. Not re-filed as a correctness defect without a contrary kit blurb. |
| SERVICE_CALL “not in `MAPS`” | **not filed.** `mapById('serviceCall')` works; endless is unit-tested. Concrete Night defects are CORR-R03 / CORR-R04. |
| Audio coupling into sim tick | **searched, nothing new (positive).** `src/sim` has no audio imports. `play.ts` 105: “keep audio out of sim”; cues are derived from stats / effects after `game.update`. |
| Charter / Jeff-only docs | already covered: CORR-009. |
| BUILD_TIME blank valves | already covered: CORR-003. |
| Catmull-Rom path length | already covered: CORR-007. Two-point probe paths do not resample. |
| Support-crew walk-in timing | already covered: CORR-013. |
| Torch strike / control specialize / combo hitstop | **searched, nothing new** except CORR-R06. Strike hits flying (wisp died; hint says air). Torch control elite stunned (1.6s) and shredded 0.2 inside 7.2s. Combo ≥8 requests 0.05s hitstop, capped at 0.14. |

## 5. Residual gaps still unconfirmed

These were looked at and **not** promoted to IDs.

| Gap | Why it stays a gap |
|---|---|
| Rank overlay never mounts / CSS `hidden` stuck | No path that leaves `pendingRankUps > 0` with every skill at ★3 (9 picks, 15 stars). Keys still rank if the card is up. |
| Logan *bite damage* vs rank | Only cadence was measured. Damage stays `14 * jeffDamage * friendlyDamageBuff` — rank blurbs never say harder bites. |
| Deep-night crate at drown-on-15 vs retire-on-15 | Follows `completedWaves`; extra miss on mid-wave retire is CORR-R03. Drown-at-threshold not separately broken. |
| SERVICE_CALL 6–10-call retire harness | Not run to a 6–10 clear (time). Rewards bugs do not need a win. |
| Code Inspection + sticky banned tool | Tray / number keys only list `allowedTowers`. No live remaster session. |
| Catmull-Rom vs drawn pipe for rallies | already covered: CORR-007. No new rally-snap measurement. |
| Second Wind “faster saw” on Rampage contact frames | Channel is fixed; lifesteal miss is CORR-R06. Speed-on-combo is a product call. |
| Bob / Becbec “thicker armor / thicker guard” ranks | Shield DR stays 35%; only duration/heal scale. Softer than Logan’s explicit “faster bites.” Not filed. |
| Washer splash + `groundMult` mismatch | No current splash tower has `groundMult`. Latent only. |
| `Game.update` during `pendingRankUps` in headless | Headless never pauses; that is why rank lock is a play-loop concern (CORR-R05). |

---

**Stop condition.** Seven net-new evidenced CORR-R IDs. Remaining hunt themes are either locked IDs or explicit “searched, nothing new.” Diminishing returns after the deploy+aim / rank-math / Night / leftover dumps.
