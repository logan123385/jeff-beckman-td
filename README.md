# Jeff Beckman Tower Defense

A Kingdom Rush–style tower defense with a plumbing / hydronic-heating theme. Five playable heroes lead the crew: Jeff Beckman (full beard and ear gauges), Big Mike, Robo Bob, Mr. Chris, and Becbec. Towers are tools and fixtures; enemies are leaks, scale, pressure spikes, and rogue hydronic gremlins.

Twenty-seven unique towers across nine campaign maps. Before each job you pack up to
five tools — Kingdom Rush style — from what later calls have taught you. Opt-in
remasters after a Classic clear (Code Inspection / Frozen Main / Cash Job / Clean Hands), and The Neverending Service Call
after the first four service calls. Heroes share crew XP, talent points, and equipped locker gear. Each has a different combat kit and aura.

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

Original painted artwork now covers all 27 towers, all 20 enemies, Jeff (including his
black ear gauges), the support crew, and five environment themes. Jeff has idle,
running, and wrench-attack poses; enemies squash, flinch, and fall; towers recoil and
gain larger silhouettes and elite pennants as they upgrade. The HUD has illustrated
skill emblems, numeric cooldowns, enemy previews, and a boss health bar.

- Prepare your defenses without a countdown before the first wave.
- Jeff automatically fights enemies within reach while guarding. An enemy click
  starts a hunt; moving him posts him at a new position.
- Level-three towers choose a permanent **power** or **control** specialization.
  All 27 towers have two named choices. The choice applies to that tower only.
- **D** arms Summon Logan targeting. Click a route to deploy Logan for
  18 seconds; the ability recharges in 28 seconds. He holds and batters ground
  enemies and can be defeated. Invalid placement never spends the cooldown.
- Select a barricade or barracks and press **G** to move its hold / rally point. Stock shutoff valves rally the hold; workshops rally their crew.
- Open Scout (I) for paused route intelligence; hover enemies for health and counters. A **RUSH** pill means packed parents — splash or the children flood. The pipe medal counts lives on the line, including kids still inside parents.
- Big leaks **split** when they pop: Scale Crabs shed drips, Frozen Mains shed crabs, Sediment Boulders become Lime Scale. Pressurized mains shed one extra child. Child pips sit under a parent on the yard; hover it to read the family. Splash the children; letting a parent walk off costs the whole family.
- **Clean Hands** is the CHIMPS remaster: no selling, no actives, no Logan, no torch rain, truck money only, one leak.

Progress remains in the existing save format (`jbtd-save-v1`). A backup copy (`jbtd-save-v1.bak`) is written before reset. Title and the van offer **Download save** if you have progress; a banner appears if this device couldn’t write, or if a backup was restored. Original PNG sources and optimized
WebP runtime assets live in `assets/remaster/`; see [art direction and prompts](docs/overhaul/art-direction.md)
and [verification with screenshots](docs/overhaul/verification.md).

## Crew, progression, and motion update

- **Apprentice Workshop** fields four individual tool-bearing workers, five at tier IV and six at tier VI.
- **Jayjay’s Stronghold** fields one bald, grey-bearded tank with armor and heavy punches.
- **CBJ & Doni’s Garage** fields long-bearded CBJ in his blue cap and burly dark-haired Doni. Doni calls “NYEH!” when a punch connects.
- Recruits walk to rally points, block ground enemies, take damage, heal out of combat, and respawn individually. Selling their tower removes them.
- Every tower has **six equipment tiers**, two specialization choices, and increasingly expensive repeatable **Mastery** after tier VI. Buildings and recruit armor change visibly.
- **The 90’s Workshop** has four branches, 28 perks, mutually exclusive forks, and free respecs. Campaign ratings award 1–3 90’s; the icon depicts a PureFlow PEX press elbow with a black body and silver sleeves.
- **The Neverending Service Call** waits for the field to clear, pays cleared-call bonuses, repairs two lives every fifth completed call, and continues with generated waves. Records, XP, and crates use completed calls.
- Full eight-pose painted attack sequences cover Jeff, Jayjay, CBJ, Doni, and all four apprentice tools. Jeff and the named recruits have eight-pose walking cycles; apprentices use a continuous painted mesh gait. Monsters deform continuously through locomotion, anticipation, contact, and recovery. Damage lands at the contact pose; towers wind up and recoil.

See [crew update verification](docs/overhaul/crew-verification.md) and [generation prompts](docs/overhaul/crew-art-prompts.md).

## Five playable heroes

Choose your hero while packing the truck. Every hero is available immediately, the choice persists, and old saves default to Jeff without losing progress. Each kit has its own respawn timer after going down.

| Hero | Playstyle | Signature kit | Aura |
|---|---|---|---|
| Jeff Beckman | Frontline guardian | Wrench, Pipe Clamp, Emergency Shutoff, Manometer, Sleeve, Coffee | Greatest Plumber to Ever Live |
| Big Mike | Mobile ranged support | Blue/cream truck with no logos, plunger javelins, horn knockback, supply crate, throttle, Plunger Rain | The Truck King |
| Robo Bob | Precision ranged destroyer | Laser hand cannon, You’re Fired piercing beam, reboot, EMP, overclock, target marks | Orbs Aren’t Real |
| Mr. Chris | Melee skirmisher | Reciprocating saw, sand trap, ricocheting golf ball, saw combo, gas cloud, lifesteal | Strongest Boy in the 8th Grade |
| Becbec | Heavy bare-handed brawler | Cartoonishly muscular, haymaker, ground slam, extra holds, Iron Will, five-punch combo | Stronger Together |

Five painted transparent atlases contain 120 movement, attack, and signature-cast poses for the new heroes and Logan. Contact-timed damage, projectile arcs, custom laser/impact effects, distinct sound cues, smooth pose transitions, and moving aura boundaries make the kits readable. Logan moves, fights, takes damage, expires, and releases enemies as a real ally. See [hero verification](docs/overhaul/hero-verification.md), [motion sheet](docs/overhaul/hero-motion-sheet.png), and [exact art prompts](docs/overhaul/hero-art-prompts.md).

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
| Tower selected, **A** | Cycle aim (First / Strong / Close / Last / Weak) |
| Tower selected, **U** | Upgrade |
| Tower selected, **S** | Sell |
| Tap / click tower | Upgrade / sell |
| Tap / click a leak | Order your hero to attack |
| Select your hero, then tap empty ground | Move your hero |
| Right-click map | Move your hero (desktop) |
| Tap / click your hero (or **J**) | Select your hero |
| **Q / E / R / T / C** | Your selected hero’s five abilities; names and cooldowns appear in the HUD |
| **D**, then click a route | Summon Logan for 18 seconds |
| Tower selected, **V** | Spend spare parts on its active ability |
| Specialized tower → Specialists | Train automatic abilities independently of its V active |
| **X**, then click the yard | Torch rain — three fire dumps (hits ground and air) |
| Barricade or barracks selected, **G**, then click a nearby route | Move the valve’s hold point, or the crew rally |
| **Space** / **N** | Call next wave early for bonus cash |
| **I** / Scout / entrance flag | Pause and inspect the next wave by route |
| **F** | Cycle 1× / 2× / 3× speed |
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
