# Kit, Weapons, and Armor

Approved 2026-09-21. Replaces hero build trees, shared crew talents, and the 90’s workshop with one loadout kit, hero-locked weapons, and shared armor. Gear grind is the endgame. Cards unlock early.

## Goal

A player sets five things before a job and immediately understands the fighter: one weapon (melee or ranged), two shared armor pieces, two stance cards. Changing the weapon rewrites basics, reach, air rules, and which cards may be slotted. Changing the two cards should feel like a different job on the same hero. The long chase is relic weapons and armor from campaign first-clears and The Neverending Service Call mileposts.

## Player loop

1. At the van, open **Kit**. Pick a hero tab.
2. Equip one weapon, one chest, one boots, and up to two cards from the active stance.
3. Pack five tools as today. Take the call.
4. The kit cannot change during the job.
5. After the job, one chest may drop one item. Inspect in the locker. Equip at the kit.

Chest and boots are **account-wide**: the same two armor pieces apply to whoever you take. Weapon and cards are **per hero**. Switching hero tabs keeps the same chest and boots and swaps that hero’s weapon and cards.

## What stays

- Signature Q / E / R / T / C and in-job ranks.
- Five-tool truck, Supply Store, Logan, torch rain, Scout, clock-out.
- Canvas sim, save key `jbtd-save-v1`, Vitest headless tests.

## What goes

Screens and save fields for Hero Builds (`heroBuilds`), Shared Crew Training (`talents`), and 90’s Workshop (`skills`). Hub and loadout links point at Kit. Routes `talents`, `crewTalents`, and `skills` redirect to Kit. Existing tree bonuses are not deleted from veterans; they migrate (see Saves).

## Weapons

Each hero has exactly two families. A family sets the attack. A dropped item is a rarity roll inside that family.

| Hero | Melee family | Ranged family | Default equipped |
|------|----------------|---------------|------------------|
| jeff | Pipe Wrench (`jeff_melee`) | Pressure Wand (`jeff_ranged`) | wrench |
| mike | Tire Iron (`mike_melee`) | Plunger Javelin (`mike_ranged`) | plunger |
| bob | Shock Prod (`bob_melee`) | Hand Cannon (`bob_ranged`) | cannon |
| chris | Recip Saw (`chris_melee`) | Golf Iron (`chris_ranged`) | saw |
| becbec | Work Gloves (`becbec_melee`) | Rebar Darts (`becbec_ranged`) | gloves |
| cbj | Spud Masher (`cbj_melee`) | Tater Cannon (`cbj_ranged`) | cannon |
| doni | Gaff (`doni_melee`) | Casting Rig (`doni_ranged`) | rig |
| jayjay | Ring Fists (`jayjay_melee`) | Bell Plate (`jayjay_ranged`) | fists |

Each family has a **built-in common** that does not occupy inventory. The kit always lets you pick melee or ranged for that hero; if no found weapon of that family is equipped, the built-in common is used. Found weapons are the grind. The default family matches how they fight today.

A found weapon is bound to one family. Jeff cannot equip Mike’s plunger. One weapon equipped per hero. Swap only at the kit.

### Attack profiles

`HeroDef.ranged` is not a combat flag. Run start copies the equipped family’s profile. Numbers are baseline before mods, card hooks, and implicits.

| Family | Reach | Damage | Rate | Holds | Air | Damage type | Basic |
|--------|------:|-------:|-----:|------:|-----|-------------|-------|
| jeff_melee | 42 | 22 | 1.35 | 2 | no | physical | contact wrench |
| jeff_ranged | 170 | 18 | 1.10 | 0 | yes | water | hose stream, pierce 1 |
| mike_melee | 44 | 28 | 1.05 | 2 | no | physical | contact club |
| mike_ranged | 195 | 39 | 0.85 | 1 | yes | physical | plunger missile |
| bob_melee | 40 | 24 | 1.20 | 1 | no | heat | contact prod |
| bob_ranged | 175 | 27 | 1.18 | 1 | yes | heat | instant laser |
| chris_melee | 44 | 19 | 1.65 | 2 | no | physical | saw + shred |
| chris_ranged | 165 | 21 | 1.00 | 0 | yes | physical | golf missile, 1 bounce |
| becbec_melee | 43 | 32 | 1.18 | 3 | no | physical | punch; stun every 3rd |
| becbec_ranged | 160 | 26 | 1.05 | 0 | yes | physical | rebar missile, pierce 1 |
| cbj_melee | 46 | 30 | 0.95 | 2 | no | physical | contact smash |
| cbj_ranged | 155 | 28 | 1.00 | 1 | yes | physical | tater missile |
| doni_melee | 52 | 22 | 1.15 | 2 | no | physical | gaff hook-hold |
| doni_ranged | 170 | 24 | 1.10 | 1 | yes | physical | hook missile, pull |
| jayjay_melee | 48 | 42 | 0.83 | 4 | no | physical | punch; stun every 3rd |
| jayjay_ranged | 150 | 34 | 0.90 | 0 | yes | physical | bell disk, 0.4s stun |

Melee basics cannot target flying. Ranged basics can. Holds only apply while the family holds > 0 after implicits and affixes.

### Implicits (from family + rarity)

Not stored on the item. Common / uncommon / rare / relic:

| Family | Implicit |
|--------|----------|
| jeff_melee | +0 / +0 / +1 / +1 hold |
| jeff_ranged | pierce 1 / 1 / 2 / 2 |
| mike_melee | +1 / +1 / +1 / +2 hold |
| mike_ranged | +10 / +16 / +24 / +34 reach |
| bob_melee | 10% / 15% / 22% / 30% chance to stun 0.35s |
| bob_ranged | +6% / +10% / +16% / +24% heat damage |
| chris_melee | shred 8% / 12% / 16% / 22% armor for 3s |
| chris_ranged | +1 / +1 / +2 / +2 bounce |
| becbec_melee | +0 / +0 / +1 / +1 hold |
| becbec_ranged | pierce 1 / 1 / 2 / 2 |
| cbj_melee | 20 / 28 / 40 / 55 splash in 36 |
| cbj_ranged | +8 / +12 / +18 / +26 splash radius on tater |
| doni_melee | +6 / +10 / +16 / +24 reach |
| doni_ranged | +8 / +12 / +18 / +26 pull |
| jayjay_melee | +0 / +1 / +1 / +2 hold |
| jayjay_ranged | stun 0.4 / 0.5 / 0.65 / 0.85 s |

### Weapon affixes

1 / 2 / 2–3 / 3 affixes by rarity (rare: 35% chance of 3, else 2 — same as today). Pool: `jeffDamage`, attack rate (new `heroRate`, 6–14%), `jeffReach`, `jeffHolds` (melee families only), `cooldown`, on-hit heat (new `onHitHeat`, 4–10 dps for 2s). No duplicate keys on one item. Rare ×1.12, relic ×1.28 on rolled amounts.

## Armor

Two slots: **chest** and **boots**. Any hero can wear them. No third slot.

| Slot | Affix pool |
|------|------------|
| chest | `jeffHp`, `jeffRespawn`, `cooldown`, `towerDamage`, `jeffRepair`, `bounty` (new, 8–16%) |
| boots | `jeffSpeed`, `jeffReach`, `startMoney`, `jeffHolds`, `sellRate` (new, +10–20% of sell), `jeffRespawn` |

Same rarity, affix count, and multipliers as weapons. Names stay trade-flavored (hi-vis, composite toe).

### Migration of old locker slots

| Old slot | Becomes |
|----------|---------|
| shirt, belt, gauges | chest (keep affixes that still exist; drop unknown keys) |
| boots | boots |
| wrench | salvage for XP if it was a stat stick; do not create a Pipe Wrench from it |

## Chests

Drop cadence is unchanged: campaign first-clear `job` / `clean`; remaster first-clear `remaster`; endless every 5 completed waves (`night`, `deepNight` at 15+); retire bonus chest if completed ≥ 8 and not on a multiple of 5. Repeat campaign clears still pay XP and service points, not a chest.

Each chest rolls **one** item.

| Source | Armor | Weapon |
|--------|------:|-------:|
| Campaign first clear (`job`, `clean`, `remaster`) | 65% | 35% |
| Endless (`night`, `deepNight`) | 30% | 70% |

Weapon rolls pick a family of the hero just played 80% of the time, otherwise a uniformly random family. Armor rolls chest or boots 50/50.

Rarity weights stay as in `src/data/loot.ts` today. Inventory cap stays 24 mixed items. Full locker auto-salvages the lowest `gearScore` unequipped piece, or the new drop if it is worse.

## Cards

A card is a verb. It does not replace Q–C. It rewrites basics and one kit hook.

Each hero has four melee cards and four ranged cards. Slot two from the **active stance** only. Empty slots are legal. Any two cards in the same stance may pair. Wrong-stance cards unequip when the weapon stance changes.

Unlock, per hero, per stance:

- Jobs **Anchor + Breaker** (melee) and **Lane + Pin** (ranged) start unlocked.
- **Crew** / **Control** unlock after **1** finished job as that hero (`won`, `lost`, or `retired`).
- **Sweep** / **Spot** unlock after **3** finished jobs as that hero.

Track `heroJobs: Partial<Record<HeroId, number>>`. A finished job increments the selected hero only. A new save slots the two starter cards of the **default stance** (Jeff: Hold the Line + Wrench Tap) so the first fight still matches today’s kit.

### Melee jobs

1. **Anchor** — holds, stay on the pipe.
2. **Breaker** — shred, slam, stun.
3. **Crew** — towers or helpers while deployed.
4. **Sweep** — splash or cleave.

### Ranged jobs

1. **Lane** — pierce, bounce, lingering shot.
2. **Pin** — focus, expose, charged hit.
3. **Control** — slow, pull, zone.
4. **Spot** — towers or Logan from range.

### Card list

Effects apply only while that card is slotted and the hero is deployed (unless noted). Numbers are before `abilityPower` and `mods`.

**jeff melee:** Hold the Line (`+1` hold); Wrench Tap (every 3rd basic shreds 20% armor 4s); Foreman Pulse (towers within 160 +12% damage); Basin Swing (basics splash 30% within 44).

**jeff ranged:** Wash the Lane (+1 pierce); Pressure Spike (every 4th basic +60% damage); Steam Cloud (basics 20% slow for 2s); Spotter (towers within 200 +8% range).

**mike melee:** Jack Stand (+1 hold); Lug Crack (basics shred 15% armor 3s); Jobsite Yell (towers within 160 +12% attack speed); Cross-Bed Swing (splash 35% within 50).

**mike ranged:** Skip Plunger (+1 bounce); Pinpoint (focus +10%/hit on one target, max 40%, reset on switch); Suction Cup (basics 18% slow 1.8s); Tailgate Call (Logan damage +20% while Mike is deployed).

**bob melee:** Live Circuit (+1 hold on the prod); Arc Tap (15% chance 0.5s stun); Contractor Mark (held target takes +15% from towers); Bus Bar (splash 25% heat within 40).

**bob ranged:** Through-Beam (laser pierce +1); Termination Dot (focus +12%/hit, max 48%); Capacitor Hum (basics 15% slow 2s); Range Finder (towers within 180 +10% range).

**chris melee:** Foot in the Trench (+1 hold); Saw Tooth (shred 18% 3s); Caddie Wave (one 8s helper every 22s during `waveActive`); Gallery Swing (splash 30% within 48).

**chris ranged:** Skip Lie (+1 bounce); Pin High (every 4th basic +55% damage); Sand Bite (basics 20% slow 2s); Gallery Call (towers within 170 +10% attack speed).

**becbec melee:** Planted Feet (+1 hold); Haymaker Cadence (stun every 2nd basic instead of 3rd); Crew Captain (towers within 150 +12% damage); Shoulder Check (splash 40% within 52).

**becbec ranged:** Rebar Line (+1 pierce); Invoice Stamp (expose 20% for 4s every 5th hit); Dust Cloud (basics 16% slow 2s); Spotter Yell (towers within 170 +8% damage).

**cbj melee:** Tailgate Wall (+1 hold); Masher Crack (shred 14% 3s); Convoy Honk (two 10s helpers on a 28s timer during `waveActive`); Bed Sweep (splash 35% within 50).

**cbj ranged:** Extra Spud (+18 splash radius); Loaded Tater (every 4th basic +50% damage + 0.4s stun); Grease Slick (basics 18% slow 2s); Dispatch (towers within 180 +10% attack speed).

**doni melee:** Gaff Set (+1 hold); Scale Rip (shred 16% 3s); Deckhand (one 10s helper every 20s during `waveActive`); Sweep the Gunwale (splash 28% within 46).

**doni ranged:** Long Cast (+25 reach); Trophy Hook (focus +10%/hit, max 40%); Chum Line (basics 20% slow 2.2s); Tour Guide (towers within 180 +8% range).

**jayjay melee:** Title Belt (+1 hold); Main Event (stun every 2nd basic); Corner Crew (one 12s helper every 20s during `waveActive`); Rope Swing (splash 35% within 54).

**jayjay ranged:** Plate Skip (+1 bounce); Bell Judge (expose 25% for 5s every 5th hit); Crowd Hush (basics 18% slow 2s); Ring Announcer (towers within 190 +10% damage).

Helpers from cards share Logan’s cap rules already used by summoner builds: at most three non-Logan helpers; a new spawn replaces the oldest.

## Screens

**Kit** (`src/ui/screens/kit.ts`) replaces `builds.ts` as the career screen. Hero tabs, five slots, unlocked/locked cards, and one line of copy: stance name plus the two slotted verbs (or “signature basics” if both cards empty).

**Locker** stays inspect / compare / salvage. Equipping is on the kit. Results still list dropped items.

Hub: one **Kit** button. Remove **Hero builds**, **90’s Perks**, and the builds-screen link to shared training. Loadout shows the equipped weapon name and two card names.

## Data and combat

New modules:

- `src/data/weapons.ts` — families, profiles, implicits, starter commons.
- `src/data/kitCards.ts` — card defs and unlock rules.
- `src/sim/attackProfile.ts` — resolve profile + implicits + affixes at run start.
- `src/sim/kitCards.ts` — `onBasicHit`, aura tick, helper timers.

`src/sim/hero.ts` basics read the resolved profile, not `def.ranged` or `def.id === 'jeff'` for melee-vs-ranged. Jeff’s wrench tap lives on the Wrench Tap card, not a hidden Jeff-only path. Signature abilities stay in `src/sim/heroPowers.ts`. New missile kinds: `hose`, `rebar`, `bell`. Golf basics reuse `golf`.

`buildRunModifiers` applies chest, boots, and remaining affixes. It no longer reads `skills` or `talents` after migrate. Engineer-style tower buffs come from Crew/Spot cards, not `heroBuilds`.

If the equipped weapon id is missing or not in inventory, use the built-in common of the selected family (default family if none selected). If a card is locked or the wrong stance, clear that slot.

## Saves

Bump `SaveData.version` to `2`. Keep the `jbtd-save-v1` key. `normalizeSave` migrates v1 in memory and writes v2.

v2 fields (replace `heroBuilds`, `talents`, `skills`, `equipped: Partial<Record<GearSlot, string>>`):

```
inventory: KitItem[]
chestId: string | null
bootsId: string | null
kits: Partial<Record<HeroId, { family: WeaponFamilyId; weaponId: string | null; cards: [string | null, string | null] }>>
heroJobs: Partial<Record<HeroId, number>>
```

Card unlocks are derived from `heroJobs` only. `family` is the stance choice; `weaponId` is a found item or `null` for the built-in common.

Migration, once:

1. Set each hero’s `family` to their default. Slot the two starter cards of that stance. Do not insert built-in commons into inventory.
2. If that hero owned any build node, set `heroJobs[hero]` to at least `1` (Crew/Control). If they owned a tier-4 node, set it to at least `3` (Sweep/Spot).
3. Convert shirt/belt/gauges → chest items; keep boots; salvage wrenches for XP.
4. If the account owned any 90’s skill or talent, add one **Veteran Vest** (rare chest) and one **Veteran Pacs** (rare boots) with affixes that cover start money, cooldown, and HP so the account is not stripped. Equip them if chest/boots are empty.
5. Drop `heroBuilds`, `talents`, `skills`.

## Tests

- v1 mid-progress save migrates: default family + starter cards, no built-in commons in inventory, veteran armor if trees were spent, no leftover `skills` in the written payload.
- Every family: air rule and hold count match the profile table (16 cases).
- Wrong-hero weapon rejected; wrong-stance card cleared on equip.
- One card pair per stance for Jeff and one other hero (melee Anchor+Crew, ranged Lane+Control) changes combat vs empty cards.
- Chest mix: campaign bias armor; endless bias the played hero’s weapons; rarity weights unchanged.
- Opening-map clears for all eight heroes still pass on starter default kits.
- Existing campaign kit and endless reward tests updated for the new item shape.

## Out of scope

Mid-job equip or stance swap. Crafting, rerolls, trading. A third armor slot. New signature abilities. Reworking the Supply Store. Painted weapon atlases beyond using existing hero poses plus the new missile kinds.

## Success

A new player can open Kit, switch Jeff from wrench to wand, slot two cards, and see a different fighter in one job. A veteran can farm The Neverending Service Call for a relic family item and feel the implicit. No third skill tree is visible.
