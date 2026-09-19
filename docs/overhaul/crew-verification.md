# Crew, equipment, and 90’s update — verification

This records local checks for the crew milestone, before the playable-hero expansion and PR publication. See [hero verification](hero-verification.md) for the latest 200-test build and additional browser checks.

## Implemented

- Apprentice Workshop: four independently simulated workers carrying different tools; five at tier IV, six at tier VI.
- Jayjay: one armored, high-health tank, bald with a grey beard, heavy punches and a brief stun.
- CBJ & Doni: skinny CBJ with a long brown beard and blue cap; burly dark-haired Doni, with `NYEH!` on connected punches.
- Actual movement from buildings to rally positions, individual blocking, delayed contact damage, armor, out-of-combat healing, defeat/fall animation, individual respawn, and cleanup when sold. Clicking a recruit selects its tower.
- Six tiers on all 27 towers, increasingly expensive late tiers, visible building reinforcement and recruit equipment, 54 specialization choices, repeatable paid Mastery after tier VI.
- Eight illustrated attack poses for Jeff, the three named recruits, and all four apprentice tool types. Eight walking poses for Jeff and the named recruits; continuous cached painted-mesh gait for apprentices. Animation covers anticipation, contact, follow-through, recovery, and transitions. Monsters have continuous gait/body deformation and timed attack cycles; shooters wind up and recoil. Enemy facing follows its actual holder.
- Animated menus and a four-branch, five-rank workshop with 28 perks. Exclusive choices at ranks II and IV; variable costs and free respec. Ratings award 1–3 **90’s** based on lives retained, keeping the best rating.
- Currency art: black-body, silver-sleeve PureFlow PEX press elbow, based on the user's specified 1½-inch fitting. It is labeled only 90’s in normal game UI.
- The Neverending Service Call: 650 starting cash, automatic waves wait for a cleared field, completion cash, two lives restored every fifth completed call, generated waves, six-tier progression and Mastery. Records/rewards count completed calls rather than merely called waves.
- Existing save key and campaign ratings retained. Legacy endless-best field is read for migration; the old mode name is absent from game copy.

## Automated checks

- `npm run build`: PASS (TypeScript and Vite production build).
- `npm test`: **159 passing tests**, four files.
- `git diff --check`: PASS.
- New coverage includes recruit counts, individual role stats, contact timing and NYEH, armor/death/respawn, rally movement, selling, all 27 towers' six tiers and mastery, catalogue isolation, perk choice/cost/respec, grading, save migration, endless pacing and early-call reward protection.
- Existing nine-map balance checks still pass on Apprentice with Jeff disabled and Journeyman with Jeff enabled.

## Survival simulation

Run `node_modules/.bin/vite-node scripts/service-call-check.ts` to reproduce. Raw output: [service-call-soak.jsonl](service-call-soak.jsonl).

A deterministic auto-builder used five tower types (Jayjay, torch, vent, washer, expansion), no purchased perks, normal starting resources, and simulated Jeff commands. It ran **5,400 in-game seconds (90 minutes)** per difficulty:

| Difficulty | Completed calls | Called wave | Lives remaining | Status |
| --- | ---: | ---: | ---: | --- |
| Apprentice | 160 | 161 | 20 | Still playing |
| Journeyman | 159 | 160 | 20 | Still playing |

This proves extended simulated survival, not a claim of a 90-minute human playtest or perfect balance for every loadout. Mastery is unit/UI-tested; this auto-builder stops at tier VI.

## Browser checks

Used an isolated agent-browser profile. Owner saves were not edited.

1. Normal loadout and game controls: selected all three recruit towers plus washer/vent, entered the service call, built the recruit towers through canvas pad menus, and started the first wave. Cash, names, visible squads, and waiting-for-clear HUD were checked. [Live game](crew-live-game.png).
2. Isolated progression fixture: seeded completed campaign ratings only in the test profile, purchased First Day Ready then Safety First through buttons, observed balance 27 → 25, and confirmed Tool Practice became unavailable. Workshop worked at 1440 px and 390 px; mobile scroll width equaled viewport width. [Desktop workshop](pex-workshop.png), [mobile workshop](pex-workshop-mobile.png).
3. Combat fixture: real Game/Renderer with base and tier-VI recruitment towers, 16 recruits, and durable enemies, to inspect sustained motion and NYEH. This is an explicit art/animation fixture, not a naturally earned campaign run. [Combat comparison](crew-combat.png).
4. Real Popover on that fixture: clicked all five upgrade buttons, reached Legendary 6/6 and six apprentices, then purchased Mastery 1; next price displayed $1920. [Upgrade UI](legendary-upgrade-ui.png).
5. The 29-character combat fixture measured 120 update/render samples: median 2.0 ms, 95th percentile 2.9 ms, maximum 59.1 ms. This is a local headless benchmark with an outlier, not an FPS guarantee. Reusable apprentice mesh poses are prewarmed during loading.
6. Production preview at `http://127.0.0.1:4173/?v=crew-and-90s` checked separately after building, including asset loading and browser errors. [Production title](crew-title-production.png).

Artwork sources and exact final generation prompts: [crew-art-prompts.md](crew-art-prompts.md). The animation approach mixes illustrated pose sequences, eased transitions, and procedural deformation; it is not a claim that every character has a bespoke hand-drawn frame for every render tick.
