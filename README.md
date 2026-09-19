# Jeff Beckman Tower Defense

A Kingdom Rush–style tower defense with a plumbing / hydronic-heating theme. Jeff Beckman —
tall plumber, full beard, ear gauges — is the only hero. Towers are tools and fixtures; enemies
are leaks, scale, pressure spikes and rogue hydronic gremlins.

Twenty-four unique towers across nine campaign maps. Before each job you pack up to
five tools — Kingdom Rush style — from what later calls have taught you. Opt-in
remasters after a Classic clear (Code Inspection / Frozen Main), and Night Shift
after the first four service calls. Jeff levels, spends talent points, and
equips locker gear. Still no second hero or cosmetics.

## Run it

```bash
npm install
npm run dev        # prints a local URL, usually http://localhost:5173
npx vite --host    # also prints a Network URL for phones on the same Wi-Fi
```

```bash
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve dist/ locally (relative assets)
npm test           # vitest: sim unit tests + Stage 0 falsifiers
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
| Tower selected, **A** | Cycle aim (First / Strong / Close / Last) |
| Tower selected, **U** | Upgrade |
| Tower selected, **S** | Sell |
| Tap / click tower | Upgrade / sell |
| Tap / click a leak | Send Jeff’s wrench |
| Select Jeff, then tap empty ground | Move Jeff |
| Right-click map | Move Jeff (desktop) |
| Tap / click Jeff (or **J**) | Select Jeff |
| **Q** | Pipe Clamp (hold + slow zone at Jeff) |
| **E** | Emergency Shutoff (map-wide slow, spawns pause) |
| **R** | Manometer Pulse (shred + stun around Jeff) |
| **T** | Isolation Sleeve (extra holds for a few seconds) |
| **C** | Coffee Thermos (heal + sprint) |
| **Space** / **N** | Call next wave early for bonus cash |
| **F** | Toggle 2× speed |
| **P** | Pause (Resume / sound / Quit panel) |
| **Esc** | Deselect, or open/close pause when nothing is selected |
| Clock out | Night Shift soft-exit (keeps the wave record) |

## Layout

```
src/core     vec math, seeded RNG, fixed-step loop
src/data     towers, enemies, Jeff, skills, difficulty, maps (pure data)
src/sim      deterministic game logic — no DOM, no canvas
src/render   canvas renderer + procedural sprites
src/ui       DOM screens (title, hub, loadout, skills, talents, locker, encyclopedia, play) and HUD
src/save     localStorage persistence
tests        vitest specs + headless auto-builder harness
scripts      balance report
```

Progress is saved in `localStorage` under `jbtd-save-v1`.

Sound is soft AV only (oscillator beds + short blips). In a job, cycle the sound
button: **Off → Soft → Full**.
