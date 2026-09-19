# Jeff Beckman Tower Defense — Vertical Slice (Stage 1) Design

Source: `Jeff_Beckman_Tower_Defense_Plan.pdf` (2026-09-07). This spec narrows the plan to
what the first web build ships.

## Scope

Ships: Jeff (only hero) + six towers + four campaign maps + wave system + soft-fail lives +
three difficulties + small Journeyman Stars tree + enemy encyclopedia with wave foreshadowing
+ results screen with Jeff-vs-tower damage share (the Stage 0 falsifier readout).

Shipped in the Stage 2 pass: remasters (Code Inspection / Frozen Main), The Neverending Service Call
endless with soft clock-out, towers 7–12, soft Web Audio.

Later expansion: towers 13–16, maps 5–7, Jeff XP / talents / locker gear. The Neverending Service Call
opens after the first four service calls.

Still deferred: second hero, cosmetics, live events.

## Stack

Vite + TypeScript, no framework. Game world renders on one 960×600 logical canvas scaled to
fit the viewport. Menus, hub, HUD and popovers are plain DOM. Vitest runs the headless sim.
Save data lives in `localStorage`.

## Architecture

```
src/
  main.ts            boot + screen router
  core/              vec, seeded rng, fixed-step loop
  data/              pure data: towers, enemies, jeff, skills, encyclopedia, maps/
  sim/               pure logic, no DOM/canvas — Game class + subsystems
  render/            canvas renderer + procedural sprites
  ui/                DOM screens + in-game HUD
  save/              localStorage persistence
tests/               vitest specs against sim/
```

The sim is deterministic given a seed and an input log; the renderer only reads state.

## Sim rules

- Fixed 60 Hz step; speed 1×/2×; pause.
- Enemies follow waypoint polylines (multi-path maps pick a path per spawn group). Reaching
  the exit costs lives (1; boss 5). Lives 0 → soft fail with retry.
- Damage types: `physical` (reduced by armor), `fire` (ignores armor; Sludge resists 50%),
  `heat` (radiant; bonus vs Frozen Main), `water` (washer; bonus vs Drips).
- Ground vs flying: flying ignores barricades/clamp and ground-only towers.
- Targeting: furthest-progressed enemy in range.
- Wave call-early bonus; waves auto-start after countdown.
- Economy: sell for 70%. Bounty per kill. Start money per map.

## Towers (3 levels each)

| # | Tower | Role | Notes |
|---|-------|------|-------|
| 1 | Soldering Torch | single-target fire DPS | ignores armor, hits air |
| 2 | Pressure Washer | ground AoE splash (water) | strong vs Drips |
| 3 | Shutoff Valve Barricade | block | holds up to N ground enemies, has HP, self-repairs |
| 4 | Vent Stack | anti-air | fast homing shots, big bonus vs flying, weak vs ground |
| 5 | Radiant Loop Coil | slow zone (heat) | slows ground enemies, protects towers in range from freeze |
| 6 | Expansion Tank | support aura | +dmg/+range to towers in range, absorbs one surge per cooldown |
| 7 | Pipe Snake | pierce / line | hits every enemy on a pipe stretch |
| 8 | Backflow Preventer | redirect | shoves ground enemies backward along the pipe |
| 9 | Chemical Descaler | DoT / shred | extra vs mineral (scale, sludge, ice) |
| 10 | Circulator Pump | haste aura | faster projectiles; Jeff move + ability CD in radius |
| 11 | PRV | reactive burst | charges from traffic, then dumps AoE |
| 12 | Boiler | late-game anchor | wide heat aura + freeze protection |

Remasters unlock after a Classic clear of that map (never the first play). Code Inspection
locks the map’s intended tools (`inspectionBan`). Frozen Main is 1 life with longer freezes.
Each remaster type awards one Journeyman Star on first clear.

The Neverending Service Call unlocks after all four campaign maps. Soft-exit (“Clock out”) saves a wave
record. Same Jeff, same towers, same skills — no exclusive campaign power.

## Enemies

Drip, Sludge Slug, Scale Crab, Steam Wisp (flying), Pressure Spike (damages barricades),
Airlock Bubble (phases; stun cancels), Frozen Main (freezes nearby towers), Boss Rogue Boiler
(3 phases, summons Drips, vents pressure at barricades).

## Jeff

Click-to-move. Auto-attacks nearest enemy in melee (physical, hits air, shreds armor).
Wrench Tap: every N s next hit stuns and interrupts phasing. Pipe Clamp (Q): 4 s block+slow
zone at Jeff. Emergency Shutoff (E): map-wide slow and spawn pause, long cooldown. Tool-belt:
repairs barricades near him. Downed Jeff respawns after a timer at the map's start node.

## Progression

Stars per map clear (1–3 by lives kept), best-per-map per difficulty. Journeyman Stars tree:
three branches × three nodes, 1 star each, free respec, never lose stars. Encyclopedia
unlocks on first sighting; pre-wave banner calls out new enemy types.

## Testing

Unit tests for path movement, targeting, damage math, economy. A headless harness with a
greedy auto-builder runs every map with Jeff disabled and asserts it is clearable on
Apprentice (hero-off falsifier), and with Jeff enabled asserts towers still do the majority
of damage (tower-matter test).
