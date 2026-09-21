# Jeff Beckman Tower Defense

A Kingdom Rush–style tower defense with a plumbing / hydronic-heating theme. Eight playable heroes lead the crew: Jeff Beckman (full beard and ear gauges), Big Mike, Robo Bob, Mr. Chris, Becbec, CBJ, Doni, and Jayjay. Towers are tools and fixtures; enemies are leaks, scale, pressure spikes, and rogue hydronic gremlins.

Twenty-four unique towers across nine campaign maps. Before each job you pack up to
five tools — Kingdom Rush style — from what later calls have taught you. Opt-in
remasters after a Classic clear (Code Inspection / Frozen Main / Cash Job / Clean Hands), and The Neverending Service Call
after the first four service calls. Heroes share crew XP, talent points, and equipped locker gear. Each has a different combat kit and aura.

## Gameplay flow overhaul

- Combat keeps moving through ordinary kills and hero level-ups. Spend earned hero
  ranks when ready with **L**; the rank panel pauses time and can be dismissed
  without spending anything. Combat ability keys keep their normal meaning outside it.
- Move or attack orders during a hero cast queue until its recovery finishes. Moves
  respond faster; retreat for three quiet seconds to begin recovering 4% health per
  second. Melee basic attacks pursue ground enemies; ranged heroes can cover air.
- At most two campaign waves overlap. Calls unlock after the current group finishes
  entering; early calls grant the displayed cash and up to eight seconds of cooldown
  recovery for hero skills, Logan, and torch rain. A cleared yard gets a six-second
  breather. Endless still waits for a full clear.
- Each wave keeps its own kills, leaks, and clean-clear reward, including its split
  children. The battle strip shows remaining enemies, wave progress, clean-clear
  receipts, and warnings when a moving enemy is close to an exit.
- Select a shooter, then click a valid enemy in range to focus it. **A** returns to
  priority targeting. Shooters skip immune enemies and avoid shots already reserved
  by projectiles in flight.
- Range previews highlight covered routes; tower commands compare the next upgrade.
  Build hotkeys follow the visible tray order. Short battlefields use a compact
  command panel that keeps the controls inside the yard.

See the [gameplay audit and verification](docs/gameplay-overhaul/audit.md) for the
before/after pacing probe, production playthrough, campaign checks, and remaining
playtesting limits.

## Tactical campaign update

- Navigate an original illustrated county map with connected jobs, saved 90’s ratings,
  locked mission previews, and a briefing for the selected location.
- Mission preparation lists incoming enemies and warns when the packed tools lack
  damaging anti-air, armor counters, or ranged support.
- Press **I**, use **Scout**, or click an entrance flag to pause and inspect the next
  wave by route. Counts, portraits, health, traits, counters, and highlighted routes
  help plan defenses. Call the wave directly from the panel for the displayed bonus.
- Every specialized tower has **two trainable abilities with three ranks each**.
  Ten different behaviors cover burning, splash, precision shots, chain damage,
  freezing, armor stripping, healing, attack-speed support, knockback, and revealing.
  Abilities activate automatically against valid targets. Purchases belong to that
  building and contribute to its sell value.
- Boss attacks mark their impact area before striking. Move allies clear or interrupt
  with a stun. Heat Plant now ends a 13-wave siege with **The First Furnace**, which
  targets expensive defenses and temporarily overheats unshielded towers.
  **A boss reaching the exit loses the mission.**
- The tower menu stays stable as cash arrives. Audio has distinct weapon cues and a
  boss warning; leaving a battle releases its audio context. Results explain which
  enemies escaped and how to counter them.

See [tactical update verification](docs/overhaul/tactical-verification.md) for the
combined regression checks, nine-map simulation checks, browser verification,
screenshots, and the limits of the evidence.

## Illustrated defense overhaul

Original painted artwork now covers all 24 towers, all 20 enemies, Jeff (including his
black ear gauges), the support crew, and five environment themes. Jeff has idle,
running, and wrench-attack poses; enemies squash, flinch, and fall; towers recoil and
gain larger silhouettes and elite pennants as they upgrade. The HUD has illustrated
skill emblems, numeric cooldowns, enemy previews, and a boss health bar.

- Prepare your defenses without a countdown before the first wave.
- Jeff automatically fights enemies within reach while guarding. An enemy click
  starts a hunt; moving him posts him at a new position.
- Level-three towers choose a permanent **power** or **control** specialization.
  All 24 towers have two named choices. The choice applies to that tower only.
- **D** arms Summon Logan targeting. Click a route to deploy Logan for
  18 seconds; the ability recharges in 28 seconds. He holds and batters ground
  enemies and can be defeated. Invalid placement never spends the cooldown.
- Select a Shutoff Valve Barricade and press **G** to move its hold point onto a nearby route.
- Open Scout (I) for paused route intelligence; hover enemies for health and counters. A **RUSH** pill means packed parents — splash or the children flood. The pipe medal counts lives on the line, including kids still inside parents.
- Big leaks **split** when they pop: Scale Crabs shed drips, Frozen Mains shed crabs, Sediment Boulders become Lime Scale. Pressurized mains shed one extra child. Child pips sit under a parent on the yard; hover it to read the family. Splash the children; letting a parent walk off costs the whole family.
- **Clean Hands** is the CHIMPS remaster: no selling, no actives, no Logan, no torch rain, truck money only, one leak.

Progress remains in the existing save format (`jbtd-save-v1`). A backup copy (`jbtd-save-v1.bak`) is written before reset. Title and the van offer **Download save** if you have progress; a banner appears if this device couldn’t write, or if a backup was restored. Original PNG sources and optimized
WebP runtime assets live in `assets/remaster/`; see [art direction and prompts](docs/overhaul/art-direction.md)
and [verification with screenshots](docs/overhaul/verification.md).

## Crew, progression, and motion update

- Apprentice Workshop, Jayjay’s Stronghold, and CBJ & Doni’s Garage have been retired. CBJ, Doni, and Jayjay are playable heroes with their own five-skill kits. Older saved tool picks migrate to legal loadouts.
- Every tower has **six equipment tiers**, two specialization choices, and increasingly expensive repeatable **Mastery** after tier VI. Buildings and recruit armor change visibly.
- **The 90’s Workshop** has four branches, 28 perks, mutually exclusive forks, and free respecs. Campaign ratings award 1–3 90’s; the icon depicts a PureFlow PEX press elbow with a black body and silver sleeves.
- **The Neverending Service Call** waits for the field to clear, pays cleared-call bonuses, repairs two lives every fifth completed call, and continues with generated waves. Records, XP, and crates use completed calls.
- Full painted attack and walking sequences cover Jeff, Jayjay, CBJ, and Doni. Monsters deform continuously through locomotion, anticipation, contact, and recovery. Damage lands at the contact pose; towers wind up and recoil.

See [crew update verification](docs/overhaul/crew-verification.md) and [generation prompts](docs/overhaul/crew-art-prompts.md).

## Eight playable heroes

Choose your hero while packing the truck. Every hero is available immediately, the choice persists, and old saves default to Jeff without losing progress. Each kit has its own respawn timer after going down.

| Hero | Playstyle | Signature kit | Aura |
|---|---|---|---|
| Jeff Beckman | Frontline guardian | Wrench, Pipe Clamp, Emergency Shutoff, Manometer, Sleeve, Coffee | Greatest Plumber to Ever Live |
| Big Mike | Mobile ranged support | Blue/cream truck with no logos, plunger javelins, horn knockback, supply crate, throttle, Plunger Rain | The Truck King |
| Robo Bob | Precision ranged destroyer | Laser hand cannon, You’re Fired piercing beam, reboot, EMP, overclock, target marks | Orbs Aren’t Real |
| Mr. Chris | Melee skirmisher | Reciprocating saw, sand trap, ricocheting golf ball, saw combo, gas cloud, lifesteal | Strongest Boy in the 8th Grade |
| Becbec | Heavy bare-handed brawler | Cartoonishly muscular, haymaker, ground slam, extra holds, Iron Will, five-punch combo | Stronger Together |
| CBJ | Ranged quartermaster | Tater projectiles, Tailgate Slam, Lunch Break, Diesel Rush, Fully Loaded | trucks n taters |
| Doni | Ranged control | Set the Hook, Cast a Wide Net, Shore Lunch, River Current, The Big One | guided fishing tour |
| Jayjay | Frontline brawler | Opening Bell, Canvas Slam, Square Up, Second Round, Unanimous Decision | would beat ronda rousey in a 1v1 easily |

Painted transparent atlases contain complete movement, attack, and signature-cast poses for the heroes and Logan. Contact-timed damage, projectile arcs, custom laser/impact effects, distinct sound cues, smooth pose transitions, and moving aura boundaries make the kits readable. Logan moves, fights, takes damage, expires, and releases enemies as a real ally. See [hero verification](docs/overhaul/hero-verification.md), [motion sheet](docs/overhaul/hero-motion-sheet.png), and [exact art prompts](docs/overhaul/hero-art-prompts.md).

## Run it

```bash
npm install
npm run dev        # prints a local URL, usually http://localhost:5173
npx vite --host    # also prints a Network URL for phones on the same Wi-Fi
```

```bash
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve dist/ locally (relative assets)
npm test           # vitest — sim, heroes, splits, save, audit, and crawlspace Stage 0
npm run balance    # headless auto-play across every map/difficulty; prints clear rates + damage share
```

## Deploy

Static site — Vite builds to `dist/` with `base: './'` so it works on GitHub Pages project URLs.

1. In the repo **Settings → Pages**, set Source to **GitHub Actions**.
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually).
3. Open the Pages URL GitHub prints after the workflow finishes.

Local check: `npm run build && npm run preview`.

## Controls

| Input | Action |
|-------|--------|
| Tap / click pipe node, then **1–5** | Build that tool |
| Tower selected, **A** | Clear focus and cycle aim (First / Strong / Close / Last / Weak) |
| Shooter selected, tap / click an enemy | Focus fire within range |
| Tower selected, **U** | Upgrade |
| Tower selected, **S** | Sell |
| Tap / click tower | Upgrade / sell |
| Tap / click a leak with no tower selected | Order your hero to attack |
| Select your hero, then tap empty ground | Move your hero |
| Right-click map | Move your hero (desktop) |
| Tap / click your hero (or **J**) | Select your hero |
| **Q / E / R / T / C** | Your selected hero’s five abilities; names and cooldowns appear in the HUD |
| **L** / Hero ranks | Pause to spend earned skill ranks, or decide later |
| **D**, then click a route | Summon Logan for 18 seconds |
| Tower selected, **V** | Spend spare parts on its active ability |
| Specialized tower → Specialists | Train automatic abilities independently of its V active |
| **X**, then click the yard | Torch rain — three fire dumps (hits ground and air) |
| Barricade selected, **G**, then click a nearby route | Move the valve’s hold point |
| **Space** / **N** | Call next wave early for cash and skill cooldown recovery |
| **I** / Scout / entrance flag | Inspect three upcoming waves, health, routes and shooter coverage |
| **B** / Plan defenses | Freeze time while building, upgrading and giving orders; B resumes |
| **F** | Cycle 1× / 2× / 3× / ½× speed |
| **P** | Pause (Resume / sound / Quit panel) |
| **Esc** | Deselect, or open/close pause when nothing is selected |
| Clock out | The Neverending Service Call soft-exit (keeps the wave record) |

## Layout

```
src/core     vec math, seeded RNG, fixed-step loop
src/data     towers, enemies, heroes, skills, difficulty, maps (pure data)
src/sim      deterministic game logic — no DOM, no canvas
src/render   canvas renderer, painted sprite atlases, animation, and procedural effects
src/ui       DOM screens (title, hub, loadout, skills, talents, locker, encyclopedia, play) and HUD
src/save     localStorage persistence
tests        vitest specs + headless auto-builder harness
scripts      balance report
```

Progress is saved in `localStorage` under `jbtd-save-v1`.

Sound combines Rain on Glass, quiet yard ambience, and combat cues. In a job, cycle the sound
button: **Off → Soft → Full**.

Research-driven additions include three saved hero/tool crews and optional campaign commendations per difficulty and remaster. See [research and design decisions](docs/research-driven-defense/research.md).
