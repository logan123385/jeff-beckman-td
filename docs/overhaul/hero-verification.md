# Playable hero expansion verification

Local verification performed September 19, 2026. The game has five selectable heroes: Jeff Beckman, Big Mike, Robo Bob, Mr. Chris, and Becbec. Each has five active abilities and a distinct passive aura. New heroes are available immediately from **Pack the truck**; the selected hero persists, and existing saves default to Jeff.

## Implemented behavior

- Big Mike fights at range from a blue truck with cream accents and no logos. Physical plunger javelins travel from his throwing hand to their targets. His kit provides volleys, horn knockback, a healing supply crate, attack/movement haste, and a plunger barrage. His aura improves nearby tower range and firing rate.
- Robo Bob has a laser hand cannon, the piercing **You're Fired** beam, a repair/shield ability, EMP, overclock, and three target marks that increase incoming damage. **Orbs Aren't Real** reveals phased enemies and slows airborne enemies nearby.
- Mr. Chris uses a reciprocating saw, a golf swing with a ricocheting golf ball, a three-hit saw combo, a slowing gas cloud, and lifesteal. Logan is a temporary independent ally with movement, target selection, attacks, health, blocking, expiry, and cleanup. **Strongest Boy in the 8th Grade** damages and slows nearby ground enemies.
- Becbec is cartoonishly muscular, with oversized shoulders, biceps, forearms, and legs, while retaining auburn hair and the supplied facial direction. She fights with bare hands: Haymaker, Seismic Slam, Bring It On, Iron Will, and a five-hit Knuckle Storm. **Stronger Together** increases nearby friendly NPC and support-crew damage.
- Jeff retains his existing kit and ear gauges. **Greatest Plumber to Ever Live** heals and protects nearby crew; Jeff retains his barricade repair role.

The five new transparent atlases contain 120 painted poses, covering movement, attacks, and signature casts for Mike, Bob, Chris, Becbec, and Logan. Pose transitions use eased interpolation; attacks have anticipation, contact, follow-through, and recovery. Projectiles, lasers, impacts, auras, dust, and cast sounds reinforce the different kits. Runtime atlas extraction preserves limbs and tools that extend beyond a nominal grid cell. Exact prompts and asset locations are in [hero-art-prompts.md](hero-art-prompts.md).

## Automated checks

- `npm run typecheck`: passed.
- `npm test`: all **200 tests across five files passed**.
- `npx vitest run tests/heroes.test.ts`: all **41 hero tests passed again** after the final projectile-origin alignment change.
- `npm run build`: production TypeScript/Vite build passed.
- `git diff --check`: passed.

Hero tests cover save migration/selection, all kits, cast windup and contact timing, attack recovery, ranged positioning, interruption and death cleanup, invalid targets without cooldown loss, aura range and non-accumulation, projectile impacts and golf ricochets, Logan movement/blocking/damage/expiry, Becbec's five-hit combo and temporary extra holds, and opening-campaign completion for all five heroes with ordinary resources.

## Browser and visual checks

An isolated browser session exercised the local production preview. Real hero-picker controls entered a job with each new hero, showed the correct name, health, aura, and five abilities, persisted the selection, and changed the activated ability's cooldown. No browser errors were reported. Desktop and 390-pixel mobile hero menus had no horizontal overflow.

- [Desktop hero roster](hero-roster-desktop.png)
- [Mobile hero roster](hero-roster-mobile.png)
- [Becbec in the normal gameplay HUD](becbec-live.png)
- [Big Mike in the normal gameplay HUD](mike-live.png)
- [Robo Bob in the normal gameplay HUD](bob-live.png)
- [Mr. Chris in the normal gameplay HUD](chris-live.png)
- [Extracted movement and attack poses](hero-motion-sheet.png)
- [Captured UI observations](hero-ui-checks.json)

[Combat video](hero-combat.webm) and [Mike](mike-combat.png), [Bob](bob-combat.png), [Chris](chris-combat.png), and [Becbec](becbec-combat.png) combat captures use an explicitly labeled animation test stage with durable enemies and the real simulation/renderer. It demonstrated plunger barrage, cannon beam, Logan plus golf, and Becbec's punch combo. This fixture is animation evidence, not an ordinary campaign balance run. It is not shipped as a game mode or cheat hook.

## The Neverending Service Call

`npx vite-node scripts/hero-service-call-check.ts` ran every hero for **30 simulated minutes on Journeyman**, with ordinary resources and a tower build. All five runs remained active with 20 lives. These are automated simulation runs, not five real-time browser playthroughs.

| Hero | Calls completed | Calls launched | Lives | Result |
|---|---:|---:|---:|---|
| Jeff | 70 | 71 | 20 | Still playing |
| Big Mike | 73 | 74 | 20 | Still playing |
| Robo Bob | 72 | 73 | 20 | Still playing |
| Mr. Chris | 70 | 71 | 20 | Still playing |
| Becbec | 68 | 69 | 20 | Still playing |

Raw output: [hero-service-call-soak.jsonl](hero-service-call-soak.jsonl). The long simulation was recorded before the final projectile-origin alignment and temporary-hold cleanup adjustments; the hero tests were rerun afterward.

## Scope of evidence

This verifies the local build, selected UI flows, targeted combat behavior, opening-job integration, and the bounded endless simulations above. It does not establish balance on every campaign map/difficulty or a universal frame-rate guarantee. These checks were recorded before PR publication; no hosted deployment or merge was part of this validation.
