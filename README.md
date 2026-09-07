# Jeff Beckman Tower Defense

A Kingdom Rush–style tower defense with a plumbing / hydronic-heating theme. Jeff Beckman —
tall plumber, full beard, ear gauges — is the only hero. Towers are tools and fixtures; enemies
are leaks, scale, pressure spikes and rogue hydronic gremlins.

This is the **Stage 1 vertical slice** from `docs/superpowers/specs/`: four campaign maps, six
towers, Jeff with his full kit, three difficulties, a small Journeyman Stars skill tree, an
enemy encyclopedia, and a results screen that reports Jeff-vs-tower damage share.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle in dist/
npm test           # vitest: sim unit tests + Stage 0 falsifiers
npm run balance    # headless auto-play across every map/difficulty; prints clear rates + damage share
```

## Controls

| Input | Action |
|-------|--------|
| Click pipe node | Build menu |
| Click tower | Upgrade / sell |
| Right-click map | Send Jeff |
| Click Jeff, then click map | Send Jeff |
| **Q** | Pipe Clamp (hold + slow zone at Jeff) |
| **E** | Emergency Shutoff (map-wide slow, spawns pause) |
| **Space** / **N** | Call next wave early for bonus cash |
| **F** | Toggle 2× speed |
| **P** | Pause |
| **J** | Select Jeff |
| **Esc** | Deselect |

## Layout

```
src/core     vec math, seeded RNG, fixed-step loop
src/data     towers, enemies, Jeff, skills, difficulty, maps (pure data)
src/sim      deterministic game logic — no DOM, no canvas
src/render   canvas renderer + procedural sprites
src/ui       DOM screens (title, hub, skills, encyclopedia, play) and HUD
src/save     localStorage persistence
tests        vitest specs + headless auto-builder harness
scripts      balance report
```

Progress is saved in `localStorage` under `jbtd-save-v1`.
