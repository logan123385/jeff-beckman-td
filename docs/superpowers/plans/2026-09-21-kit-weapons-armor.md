# Kit, Weapons, and Armor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hero builds, talents, and 90’s perks with one kit (stance weapon, shared chest/boots, two cards) and a post-job weapon/armor grind.

**Architecture:** Pure data in `src/data/weapons.ts` and `src/data/kitCards.ts` defines families, profiles, implicits, and cards. `src/sim/attackProfile.ts` resolves the equipped kit at run start. Basics read that profile instead of `HeroDef.ranged` / per-id switches. Save v2 migrates old trees and locker slots. One Kit screen owns equip; the locker only inspects and salvages.

**Tech Stack:** Vite, TypeScript, Vitest, existing canvas sim + DOM screens, `localStorage` key `jbtd-save-v1`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-21-kit-weapons-armor-design.md` — copy numbers from it, do not invent new card effects.
- Built-in family commons never enter `inventory`. Found items do.
- Chest and boots are account-wide. Weapon family + found weapon + cards are per hero.
- Kit cannot change during a job.
- Cards do not replace Q–C.
- `SaveData.version` is `2`. Same storage key.
- Exhaustive `switch` on unions with a `never` default.
- Imports stay at the top of each file.
- Do not mid-job equip, craft, reroll, or add painted weapon atlases.

## File map

| File | Role |
|------|------|
| `src/data/types.ts` | `KitItem`, `ArmorSlot`, new `AffixKey`s, drop `GearSlot` for runtime (keep reading old saves) |
| `src/data/weapons.ts` | Families, profiles, implicits, names, `defaultFamily`, `familyOf` |
| `src/data/kitCards.ts` | 64 cards, `cardUnlocked`, `defaultCards`, `cardsFor` |
| `src/data/loot.ts` | `rollChest` → one `KitItem`; armor/weapon mix; `gearScore`/`applyAffix` for new keys |
| `src/data/progress.ts` | Mods from chest+boots only; rewards typed as `KitItem` |
| `src/save/save.ts` | v2 `SaveData`, migrate, kit APIs |
| `src/sim/attackProfile.ts` | `resolveAttackProfile` |
| `src/sim/kitCards.ts` | `onKitHit`, `updateKitCards` |
| `src/sim/hero.ts` | Basics use profile |
| `src/sim/heroPowers.ts` | `strikeFromProfile` |
| `src/sim/state.ts` | Missile kinds `hose` \| `rebar` \| `bell` |
| `src/sim/game.ts` | Hold `attackProfile`, `kitState`; stop `heroForBuild` |
| `src/ui/screens/kit.ts` | Kit screen |
| `src/ui/screens/locker.ts` | Inspect/salvage `KitItem` |
| `src/ui/app.ts` | `kind: 'kit'`; old routes redirect |
| `src/ui/screens/hub.ts` / `loadout.ts` / `title.ts` | Copy and links |
| `src/ui/play/results.ts` | New item cards |
| `src/render/renderer.ts` / missile draw | New kinds reuse existing projectile strokes |
| `tests/kit.test.ts` | New coverage |
| Existing tests that import `GearItem` / builds / talents / skills | Update |

---

### Task 1: Weapon families and attack profiles

**Files:**
- Create: `src/data/weapons.ts`
- Create: `src/sim/attackProfile.ts`
- Modify: `src/data/types.ts` (add `WeaponStance`, `WeaponFamilyId`, `ArmorSlot`, `WeaponItem`, `ArmorItem`, `KitItem`, affix keys `heroRate`, `onHitHeat`, `bounty`, `sellRate`)
- Test: `tests/kit.test.ts`

**Interfaces:**
- Consumes: `HeroId` from `src/data/heroes.ts`; `Rarity`, `GearAffix` from `src/data/types.ts`
- Produces:
  - `export type WeaponStance = 'melee' | 'ranged'`
  - `export type WeaponFamilyId = \`${HeroId}_${WeaponStance}\``
  - `export interface AttackProfile { family: WeaponFamilyId; hero: HeroId; stance: WeaponStance; reach: number; damage: number; attackRate: number; holds: number; air: boolean; damageType: DamageType; basic: 'contact' | 'missile' | 'laser'; missile?: 'plunger' | 'golf' | 'tater' | 'hook' | 'hose' | 'rebar' | 'bell'; pierce: number; bounce: number; splash: number; splashRadius: number; pull: number; stun: number; stunChance: number; shred: number; tapStunEvery: number | null }`
  - `export function defaultFamily(hero: HeroId): WeaponFamilyId`
  - `export function familyHero(family: WeaponFamilyId): HeroId`
  - `export function familyStance(family: WeaponFamilyId): WeaponStance`
  - `export function isWeaponFamilyId(id: string): id is WeaponFamilyId`
  - `export function implicitFor(family: WeaponFamilyId, rarity: Rarity): Partial<AttackProfile>`
  - `export function baseProfile(family: WeaponFamilyId): AttackProfile`
  - `export function resolveAttackProfile(family: WeaponFamilyId, rarity: Rarity, affixes: GearAffix[]): AttackProfile`

- [ ] **Step 1: Write the failing test**

Create `tests/kit.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { HERO_ORDER } from '../src/data/heroes';
import { defaultFamily, familyHero, familyStance, implicitFor, resolveAttackProfile } from '../src/data/weapons';
import { resolveAttackProfile as resolve } from '../src/sim/attackProfile';

describe('weapon families', () => {
  it('gives each hero a default family matching today’s stance', () => {
    expect(defaultFamily('jeff')).toBe('jeff_melee');
    expect(defaultFamily('mike')).toBe('mike_ranged');
    expect(defaultFamily('bob')).toBe('bob_ranged');
    expect(defaultFamily('chris')).toBe('chris_melee');
    expect(defaultFamily('becbec')).toBe('becbec_melee');
    expect(defaultFamily('cbj')).toBe('cbj_ranged');
    expect(defaultFamily('doni')).toBe('doni_ranged');
    expect(defaultFamily('jayjay')).toBe('jayjay_melee');
  });
  it('exposes 16 families with air and hold rules from the spec', () => {
    expect(HERO_ORDER).toHaveLength(8);
    const jeffMelee = resolve('jeff_melee', 'common', []);
    expect(jeffMelee.air).toBe(false);
    expect(jeffMelee.holds).toBe(2);
    expect(jeffMelee.reach).toBe(42);
    const jeffWand = resolve('jeff_ranged', 'relic', []);
    expect(jeffWand.air).toBe(true);
    expect(jeffWand.holds).toBe(0);
    expect(jeffWand.pierce).toBe(2);
    expect(familyHero('mike_melee')).toBe('mike');
    expect(familyStance('mike_melee')).toBe('melee');
  });
  it('scales implicits by rarity and applies reach affixes', () => {
    expect(implicitFor('jayjay_melee', 'common').holds).toBe(0);
    expect(implicitFor('jayjay_melee', 'uncommon').holds).toBe(1);
    expect(implicitFor('jayjay_melee', 'relic').holds).toBe(2);
    const boosted = resolve('jeff_melee', 'rare', [{ key: 'jeffHolds', amount: 1 }, { key: 'jeffReach', amount: 0.1 }]);
    expect(boosted.holds).toBe(3);
    expect(boosted.reach).toBeCloseTo(42 * 1.1, 5);
  });
});
```

If you keep `resolveAttackProfile` only in `src/sim/attackProfile.ts`, import it from there and export `implicitFor` from `weapons.ts`. Do not export the same function from both files.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — cannot find module `../src/data/weapons`

- [ ] **Step 3: Write types, `weapons.ts`, and `attackProfile.ts`**

In `src/data/types.ts` add next to the existing gear types:

```typescript
export type WeaponStance = 'melee' | 'ranged';
export type ArmorSlot = 'chest' | 'boots';
export type WeaponFamilyId = `${import('./heroes').HeroId}_${WeaponStance}`;
```

Do **not** use that inline import. Add `WeaponFamilyId` in `src/data/weapons.ts` instead, and add item types in `types.ts`:

```typescript
export type AffixKey =
  | 'jeffDamage' | 'jeffHp' | 'jeffSpeed' | 'cooldown' | 'stunDuration'
  | 'jeffHolds' | 'jeffRepair' | 'jeffReach' | 'jeffRespawn'
  | 'startMoney' | 'towerDamage' | 'heroRate' | 'onHitHeat' | 'bounty' | 'sellRate';

export interface WeaponItem {
  kind: 'weapon';
  id: string;
  family: string;
  name: string;
  rarity: Rarity;
  affixes: GearAffix[];
}
export interface ArmorItem {
  kind: 'armor';
  id: string;
  slot: ArmorSlot;
  name: string;
  rarity: Rarity;
  affixes: GearAffix[];
}
export type KitItem = WeaponItem | ArmorItem;
```

Keep `GearItem` / `GearSlot` for reading v1 saves.

`src/data/weapons.ts` — copy the spec tables into `FAMILY_BASE` and `FAMILY_IMPLICIT` records keyed by `WeaponFamilyId`. `defaultFamily` uses the spec default column. `isWeaponFamilyId` checks `${hero}_${stance}` against `HERO_ORDER`.

`src/sim/attackProfile.ts`:

```typescript
export function resolveAttackProfile(family: WeaponFamilyId, rarity: Rarity, affixes: GearAffix[]): AttackProfile {
  const base = baseProfile(family);
  const impl = implicitFor(family, rarity);
  const out = { ...base, ...impl, pierce: base.pierce + (impl.pierce ?? 0), bounce: base.bounce + (impl.bounce ?? 0), holds: base.holds + (impl.holds ?? 0), splash: (impl.splash ?? base.splash), splashRadius: (impl.splashRadius ?? base.splashRadius), pull: base.pull + (impl.pull ?? 0), stun: impl.stun ?? base.stun, stunChance: impl.stunChance ?? base.stunChance, shred: impl.shred ?? base.shred, reach: impl.reach ? base.reach + impl.reach : base.reach };
  for (const a of affixes) {
    if (a.key === 'jeffHolds') out.holds += a.amount;
    if (a.key === 'jeffReach') out.reach *= 1 + a.amount;
    if (a.key === 'jeffDamage') out.damage *= 1 + a.amount;
    if (a.key === 'heroRate') out.attackRate *= 1 + a.amount;
  }
  return out;
}
```

Use spec implicit columns exactly. For implicits that add reach (mike_ranged, doni_melee) add to `reach`, do not replace.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/kit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/types.ts src/data/weapons.ts src/sim/attackProfile.ts tests/kit.test.ts
git commit -m "$(cat <<'EOF'
Add weapon families and resolved attack profiles.

EOF
)"
```

---

### Task 2: Playstyle cards and unlocks

**Files:**
- Create: `src/data/kitCards.ts`
- Test: `tests/kit.test.ts`

**Interfaces:**
- Consumes: `HeroId`, `WeaponStance`, `WeaponFamilyId`
- Produces:
  - `export type CardJob = 'anchor' | 'breaker' | 'crew' | 'sweep' | 'lane' | 'pin' | 'control' | 'spot'`
  - `export interface KitCard { id: string; hero: HeroId; stance: WeaponStance; job: CardJob; name: string; verb: string; description: string }`
  - `export const KIT_CARDS: KitCard[]`
  - `export function cardsFor(hero: HeroId, stance: WeaponStance): KitCard[]`
  - `export function cardById(id: string): KitCard | undefined`
  - `export function cardUnlocked(card: KitCard, heroJobs: number): boolean`
  - `export function defaultCards(hero: HeroId): [string, string]`

Unlock: jobs `anchor`/`breaker`/`lane`/`pin` when `heroJobs >= 0`; `crew`/`control` when `heroJobs >= 1`; `sweep`/`spot` when `heroJobs >= 3`.

`defaultCards('jeff')` is `['jeff_anchor', 'jeff_breaker']` (Hold the Line, Wrench Tap). Other default-stance heroes slot their Anchor+Breaker or Lane+Pin pair.

Card ids: `${hero}_${job}`.

- [ ] **Step 1: Write the failing test**

Append to `tests/kit.test.ts`:

```typescript
import { cardUnlocked, cardsFor, defaultCards, KIT_CARDS } from '../src/data/kitCards';

describe('kit cards', () => {
  it('has four melee and four ranged cards per hero', () => {
    expect(KIT_CARDS).toHaveLength(64);
    for (const hero of HERO_ORDER) {
      expect(cardsFor(hero, 'melee').map(c => c.job)).toEqual(['anchor', 'breaker', 'crew', 'sweep']);
      expect(cardsFor(hero, 'ranged').map(c => c.job)).toEqual(['lane', 'pin', 'control', 'spot']);
    }
  });
  it('unlocks crew after one job and sweep after three', () => {
    const crew = cardsFor('jeff', 'melee').find(c => c.job === 'crew')!;
    const sweep = cardsFor('jeff', 'melee').find(c => c.job === 'sweep')!;
    expect(cardUnlocked(crew, 0)).toBe(false);
    expect(cardUnlocked(crew, 1)).toBe(true);
    expect(cardUnlocked(sweep, 2)).toBe(false);
    expect(cardUnlocked(sweep, 3)).toBe(true);
    expect(defaultCards('jeff')).toEqual(['jeff_anchor', 'jeff_breaker']);
    expect(defaultCards('mike')).toEqual(['mike_lane', 'mike_pin']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — cannot find `kitCards`

- [ ] **Step 3: Implement all 64 cards**

Create `src/data/kitCards.ts`. Every card’s `name`, `verb`, and `description` must match the spec card list (Hold the Line, Wrench Tap, Wash the Lane, … Ring Announcer). `verb` is the short kit-line word: Hold, Tap, Pierce, etc.

```typescript
export function cardUnlocked(card: KitCard, heroJobs: number): boolean {
  switch (card.job) {
    case 'anchor':
    case 'breaker':
    case 'lane':
    case 'pin':
      return true;
    case 'crew':
    case 'control':
      return heroJobs >= 1;
    case 'sweep':
    case 'spot':
      return heroJobs >= 3;
    default: {
      const _exhaustive: never = card.job;
      return _exhaustive;
    }
  }
}

export function defaultCards(hero: HeroId): [string, string] {
  return familyStance(defaultFamily(hero)) === 'melee' ? [`${hero}_anchor`, `${hero}_breaker`] : [`${hero}_lane`, `${hero}_pin`];
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/kit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/data/kitCards.ts tests/kit.test.ts
git commit -m "$(cat <<'EOF'
Add stance cards and job-count unlocks.

EOF
)"
```

---

### Task 3: Chest rolls become one weapon or one armor

**Files:**
- Modify: `src/data/loot.ts`
- Modify: `src/data/types.ts` (`gearScore` input)
- Test: `tests/kit.test.ts`

**Interfaces:**
- Consumes: `KitItem`, `WeaponFamilyId`, `ChestQuality`, `Rng`
- Produces:
  - `export function rollChest(rng: Rng, quality: ChestQuality, id: string, playedHero?: HeroId): KitItem`
  - `export function isKitItem(value: unknown): value is KitItem`
  - `export function gearScore(item: KitItem | GearItem): number`

Campaign qualities (`job`, `clean`, `remaster`): 65% armor, 35% weapon.
Endless (`night`, `deepNight`): 30% armor, 70% weapon.
Weapon family: 80% `playedHero`’s random stance if `playedHero` is set, else uniform among 16.
Armor slot 50/50 chest/boots.
Rarity weights unchanged.

- [ ] **Step 1: Write the failing test**

```typescript
import { Rng } from '../src/core/rng';
import { rollChest } from '../src/data/loot';

describe('kit chests', () => {
  it('leans armor on campaign clears and the played hero on endless', () => {
    const campaign = Array.from({ length: 200 }, (_, i) => rollChest(new Rng(i + 1), 'job', `c${i}`, 'jeff'));
    const armor = campaign.filter(item => item.kind === 'armor').length;
    expect(armor).toBeGreaterThan(110);
    const night = Array.from({ length: 200 }, (_, i) => rollChest(new Rng(1000 + i), 'deepNight', `n${i}`, 'doni'));
    const doniWeapons = night.filter(item => item.kind === 'weapon' && item.family.startsWith('doni_'));
    expect(doniWeapons.length).toBeGreaterThan(90);
    const relic = rollChest(new Rng(42), 'deepNight', 'r1', 'jeff');
    expect(['uncommon', 'rare', 'relic']).toContain(relic.rarity);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — `item.kind` undefined (old `GearItem`)

- [ ] **Step 3: Rewrite `rollChest`**

Keep `RARITY_WEIGHTS`, `affixCount`, `rollAffix`. Add `AFFIX_ROLL` entries:

```typescript
heroRate: { min: 0.06, max: 0.14, label: (n) => `+${pct(n)} attack rate` },
onHitHeat: { min: 4, max: 10, label: (n) => `${n.toFixed(0)} heat/s on hit` },
bounty: { min: 0.08, max: 0.16, label: (n) => `+${pct(n)} bounty` },
sellRate: { min: 0.10, max: 0.20, label: (n) => `+${pct(n)} sell` },
```

Weapon affix pool: `jeffDamage`, `heroRate`, `jeffReach`, `jeffHolds` (melee families only), `cooldown`, `onHitHeat`.
Chest pool: `jeffHp`, `jeffRespawn`, `cooldown`, `towerDamage`, `jeffRepair`, `bounty`.
Boots pool: `jeffSpeed`, `jeffReach`, `startMoney`, `jeffHolds`, `sellRate`, `jeffRespawn`.

`applyAffix` cases for the four new keys: `heroRate` unused on `Modifiers` until Task 5 (store on item only, or add `heroRate` to `Modifiers` now). Add `heroRate: number` default `1` and `onHitHeat: number` default `0` to `Modifiers` and `neutralModifiers()` in this task so `applyAffix` stays exhaustive.

```typescript
case 'heroRate': m.heroRate *= 1 + a.amount; return;
case 'onHitHeat': m.onHitHeat += a.amount; return;
case 'bounty': m.bounty *= 1 + a.amount; return;
case 'sellRate': m.sellRate = Math.min(1, m.sellRate + a.amount); return;
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/kit.test.ts tests/sim.test.ts`
Expected: `kit.test.ts` PASS. Fix any `applyAffix` / `Modifiers` compile failures in `sim.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/data/loot.ts src/data/types.ts src/data/skills.ts tests/kit.test.ts
git commit -m "$(cat <<'EOF'
Roll post-job chests as one weapon or armor item.

EOF
)"
```

---

### Task 4: Save v2 and migration

**Files:**
- Modify: `src/save/save.ts`
- Modify: `src/data/progress.ts` (`buildRunModifiers` uses chest/boots; `RunReward.items: KitItem[]`)
- Test: `tests/kit.test.ts`, update `tests/save.test.ts` / `tests/careers.test.ts` as they break

**Interfaces:**
- Consumes: `KitItem`, `defaultFamily`, `defaultCards`, `isWeaponFamilyId`
- Produces `SaveData` v2:

```typescript
export interface HeroKit {
  family: WeaponFamilyId;
  weaponId: string | null;
  cards: [string | null, string | null];
}
export interface SaveData {
  version: 2;
  // existing fields except heroBuilds, talents, skills, equipped
  inventory: KitItem[];
  chestId: string | null;
  bootsId: string | null;
  kits: Partial<Record<HeroId, HeroKit>>;
  heroJobs: Partial<Record<HeroId, number>>;
}
```

SaveStore methods:

```typescript
equippedArmor(): ArmorItem[]
heroKit(hero: HeroId): HeroKit
setFamily(hero: HeroId, family: WeaponFamilyId): boolean
equipWeapon(hero: HeroId, id: string | null): boolean
equipCard(hero: HeroId, slot: 0 | 1, id: string | null): boolean
equipArmor(id: string): boolean
unequipArmor(slot: ArmorSlot): void
recordHeroJob(hero: HeroId): void
```

`parseBlob`: accept `version === 1` or `2` (and missing version via `looksLikeV1`). Always `normalizeSave` to v2.

Migration rules from the spec. Veteran Vest / Pacs ids `g-veteran-chest` / `g-veteran-boots` only if `parsed.skills` or `parsed.talents` is a non-empty array. Affixes: chest `{ startMoney: 50, cooldown: 0.08, jeffHp: 0.12 }`; boots `{ jeffSpeed: 0.08, jeffRespawn: 0.1, startMoney: 20 }`.

`setFamily` rejects a family whose hero is not `hero`. `equipWeapon` rejects missing ids, non-weapons, and other heroes’ families; `null` clears to built-in. `equipCard` rejects locked or wrong-stance cards (use `heroJobs[hero] ?? 0`). Changing family clears cards that fail `card.stance === familyStance(family)`.

- [ ] **Step 1: Write the failing test**

```typescript
import { normalizeSave, SaveStore } from '../src/save/save';

describe('save v2', () => {
  it('migrates a v1 tree save without stuffing starter weapons into the locker', () => {
    const data = normalizeSave({
      version: 1,
      jeffXp: 400,
      skills: ['sharpTools'],
      talents: ['ironGrip'],
      heroBuilds: { jeff: { nodes: ['venom:1', 'venom:2', 'venom:3', 'venom:4'], technique: 'venom' } },
      inventory: [{ id: 'g1', name: 'Hi-Vis Tee', slot: 'shirt', rarity: 'rare', affixes: [{ key: 'jeffHp', amount: 0.12 }] }],
      equipped: { shirt: 'g1' },
    } as never);
    expect(data.version).toBe(2);
    expect(data.inventory.some(i => i.kind === 'weapon' && i.rarity === 'common')).toBe(false);
    expect(data.kits.jeff?.family).toBe('jeff_melee');
    expect(data.kits.jeff?.cards).toEqual(['jeff_anchor', 'jeff_breaker']);
    expect(data.heroJobs.jeff).toBeGreaterThanOrEqual(3);
    expect(data.inventory.some(i => i.kind === 'armor' && i.slot === 'chest' && i.name === 'Veteran Vest')).toBe(true);
    expect((data as { skills?: unknown }).skills).toBeUndefined();
  });
  it('rejects a weapon for the wrong hero', () => {
    const save = new SaveStore(null);
    save.data.inventory.push({ kind: 'weapon', id: 'w1', family: 'mike_ranged', name: 'Test', rarity: 'rare', affixes: [] });
    expect(save.equipWeapon('jeff', 'w1')).toBe(false);
    expect(save.setFamily('jeff', 'mike_ranged')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — `version` is still 1 or `kits` missing

- [ ] **Step 3: Implement normalize + APIs**

`blank()` returns version 2, empty inventory, null chest/boots, empty kits/heroJobs.

`sanitizeKitItem` accepts v2 items and v1 `GearItem` (no `kind`): shirt/belt/gauges → chest; boots → boots; wrench → skip (caller salvages XP into `jeffXp`).

`equippedItems()` becomes armor only (`chestId`, `bootsId`). Update `addGear` to take `KitItem` and treat equipped as those two ids plus any `kits.*.weaponId`.

`buildRunModifiers`:

```typescript
export function buildRunModifiers(save: SaveStore): Modifiers {
  const m = neutralModifiers();
  for (const item of save.equippedArmor()) for (const affix of item.affixes) applyAffix(m, affix);
  return m;
}
```

Weapon damage affixes apply in `resolveAttackProfile`, not here.

- [ ] **Step 4: Run tests**

Run: `npx tsc --noEmit && npx vitest run tests/kit.test.ts tests/save.test.ts tests/careers.test.ts`
Expected: kit + save pass. Update careers tests that still read `heroBuilds` / `equipTechnique` / `serviceReward` only — keep store tests; remove or rewrite build-unlock tests to kit APIs.

- [ ] **Step 5: Commit**

```bash
git add src/save/save.ts src/data/progress.ts tests
git commit -m "$(cat <<'EOF'
Migrate saves to kit loadouts and shared armor.

EOF
)"
```

---

### Task 5: Basics read the attack profile

**Files:**
- Modify: `src/sim/game.ts` (construct `attackProfile` + `kitState`)
- Modify: `src/sim/hero.ts`
- Modify: `src/sim/heroPowers.ts` (`strikeFromProfile`)
- Modify: `src/sim/state.ts` (missile kinds)
- Modify: `src/ui/screens/play.ts` (pass kit into `Game` if the constructor needs it)
- Test: `tests/kit.test.ts`

**Interfaces:**
- Consumes: `resolveAttackProfile`, `heroKit`, inventory
- Produces: `Game.attackProfile: AttackProfile` and `Game.kitCards: [string | null, string | null]`
- `export function strikeFromProfile(game: Game, enemy: Enemy): void`

Game constructor options gain `kit?: { family: WeaponFamilyId; weapon?: WeaponItem | null; cards: [string | null, string | null] }`. If omitted, use `defaultFamily(hero)` and `defaultCards(hero)` with common rarity.

`updateHero` contact check:

```typescript
const profile = game.attackProfile;
const reach = profile.reach * game.mods.jeffReach;
if (target && (profile.air || !target.def.flying) && !h.dest && dist(h.pos, target.pos) <= reach + target.def.radius + 10) {
  strikeFromProfile(game, target);
}
```

`holdNearby` uses `profile.holds + game.mods.jeffHolds`.

`strikeFromProfile`:
- `basic === 'laser'`: current Bob instant heat + visual
- `basic === 'missile'`: `fireHeroMissile(game, profile.missile!, enemy.pos, profile.damage, enemy.id, profile.splash, profile.bounce, undefined, { pull: profile.pull, stun: profile.stun })` and set `missile.basic = true`, `missile.pierce = profile.pierce`
- `basic === 'contact'`: `applyDamage` with `profile.damageType`; apply shred/tap stun/stunChance/splash from profile; Jeff no longer has a hidden tap unless the Wrench Tap card is slotted (Task 7). Chris shred on the saw family implicit only.

Extend `HeroMissile` with `pierce?: number` and kinds `'hose' | 'rebar' | 'bell'`. In `updateHeroMissiles`, if `pierce > 0` after a hit, keep the missile toward the next target like Bob’s beam conceptually: subtract one pierce and retarget (copy the bounce retarget block, filter `hitIds`).

Draw new kinds in the existing missile stroke path (hose = washer blue, rebar = rust, bell = gold). Reuse plunger/golf/tater/hook drawers when `kind` matches.

Remove `onBuildAttack` from the basic-attack path. Leave `heroBuilds.ts` in the tree until Task 7 deletes call sites; do not call it.

- [ ] **Step 1: Write the failing test**

```typescript
import { Game } from '../src/sim/game';
import { CRAWLSPACE } from '../src/data/maps/crawlspace';
import { DIFFICULTIES } from '../src/data/difficulty';
import { neutralModifiers } from '../src/data/skills';

function playJeff(family: 'jeff_melee' | 'jeff_ranged') {
  return new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), hero: 'jeff', kit: { family, weapon: null, cards: [null, null] } });
}

describe('profile basics', () => {
  it('lets a wand Jeff hit air and a wrench Jeff hold ground', () => {
    const melee = playJeff('jeff_melee');
    expect(melee.attackProfile.air).toBe(false);
    expect(melee.attackProfile.holds).toBeGreaterThanOrEqual(2);
    const wand = playJeff('jeff_ranged');
    expect(wand.attackProfile.air).toBe(true);
    expect(wand.attackProfile.holds).toBe(0);
    expect(wand.attackProfile.missile).toBe('hose');
  });
});
```

Pass `hero` into `Game` if not already supported (it is via existing options — confirm `game.ts` constructor). Add `kit` next to it.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — `attackProfile` missing or wand still melee

- [ ] **Step 3: Wire constructor + `strikeFromProfile`**

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/kit.test.ts tests/heroes.test.ts`
Expected: kit PASS. Hero tests that assume Jeff wrench tap every N swings may fail — keep implicit Jeff tap **off** unless card slotted; update those tests in Task 7 if they fail now. If an opening-map clear depends on tap, slot default cards in the test harness.

- [ ] **Step 5: Commit**

```bash
git add src/sim tests/kit.test.ts
git commit -m "$(cat <<'EOF'
Drive hero basics from the equipped weapon profile.

EOF
)"
```

---

### Task 6: Card combat hooks

**Files:**
- Create: `src/sim/kitCards.ts`
- Modify: `src/sim/hero.ts` (call `onKitHit` after a basic connects)
- Modify: `src/sim/towers.ts` or `src/sim/game.ts` tick (`updateKitCards`)
- Modify: `src/sim/heroBuilds.ts` — stop calling from combat; keep file only if tests still import it, otherwise delete after tests move
- Test: `tests/kit.test.ts`

**Interfaces:**
- Consumes: `KIT_CARDS`, `Game.kitCards`, `AttackProfile`
- Produces:
  - `export function onKitHit(game: Game, enemy: Enemy, baseDamage: number): void`
  - `export function updateKitCards(game: Game, dt: number): void`

Implement every spec effect. Use `card.job` + `card.hero` switches with `never` defaults. Shared helpers: `splashNear(game, enemy, fraction, radius)`, `applyFocus(game, enemy, perHit, cap)`, `expose(enemy, amount, duration)`, `towerAura(game, radius, buff)`, `maybeHelper(game, hp, duration, interval)` using existing `spawnBuildHelpers` or a renamed copy in this file.

`game.kitState = { focusId: number | null, focusHits: number, helperTimer: number, hitCounts: Record<string, number> }`.

Jeff Anchor+Crew vs empty cards: hold +1 and towers in 160 get +12% damage while deployed (assert via `game.buffs` or a tower’s effective damage helper).

- [ ] **Step 1: Write the failing test**

Use a small crawlspace game, slot `['jeff_anchor', 'jeff_crew']`, spawn a ground drip in reach, step until a hit, expect `attackProfile.holds` + card hold === 3 and a tower buff key set. Second case: `['jeff_lane', 'jeff_control']` on `jeff_ranged` — after a hose hit, enemy `slow >= 0.2`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — no buff / no slow

- [ ] **Step 3: Implement hooks for all 64 cards**

Copy numbers from the spec. Do not leave a card as a no-op.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/kit.test.ts tests/build-combat.test.ts tests/heroes.test.ts`
Expected: kit PASS. Update or delete `tests/build-combat.test.ts` (old C techniques). Prefer delete if every assertion is about `BUILD_STYLES`; add a short comment in the commit body that cards replaced those techniques.

- [ ] **Step 5: Commit**

```bash
git add src/sim/kitCards.ts src/sim/hero.ts src/sim/game.ts tests
git commit -m "$(cat <<'EOF'
Apply slotted stance cards on basics and auras.

EOF
)"
```

---

### Task 7: Kit screen and retired trees

**Files:**
- Create: `src/ui/screens/kit.ts`
- Modify: `src/ui/app.ts`
- Modify: `src/ui/screens/hub.ts`
- Modify: `src/ui/screens/loadout.ts`
- Modify: `src/ui/screens/title.ts` (one How-it-works line)
- Delete or stub: `src/ui/screens/builds.ts`, `talents.ts`, `skills.ts` — redirect via `app.go({ kind: 'kit' })` if anything still links
- CSS: add kit layout to `src/remaster.css` or `src/cinematic.css` (hero tabs, five slots, locked cards muted)

**Interfaces:**
- Consumes: `SaveStore` kit APIs, `cardsFor`, `cardUnlocked`, `KIT_CARDS`
- Produces: `export function renderKit(app: App): ScreenView`

Screen: header “Kit”, points/jobs line (`Call ${n} as this hero`), hero roster, weapon column (melee family / ranged family toggle; found items of that family listed; built-in common labeled Common), chest, boots, two card slots from `cardsFor(hero, stance)`, footer line `${stance} · ${verbA} · ${verbB}` or `signature basics`.

`Screen` type: add `{ kind: 'kit' }`. Map `talents`, `crewTalents`, `skills` to `renderKit`.

Hub: replace Hero builds + 90’s Perks with **Kit**. Locker button unchanged (still after first progress).

Loadout: replace career-build sentence with weapon name + two card names. Button “Edit kit” → `app.go({ kind: 'kit' })`.

- [ ] **Step 1: Write a DOM-free test for copy helpers**

In `src/ui/screens/kit.ts` export:

```typescript
export function kitSummary(hero: HeroId, kit: HeroKit, jobs: number): string
```

Test: Jeff default → contains `Pipe Wrench` and `Hold` / `Tap`. After `setFamily` to `jeff_ranged` with empty cards → `Pressure Wand` and `signature basics`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/kit.test.ts`
Expected: FAIL — module missing `kitSummary`

- [ ] **Step 3: Implement `renderKit` + routing**

Keep the screen on one column at 390px (existing `.sheet` / `.build-roster` patterns). No horizontal overflow.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx tsc --noEmit && npx vitest run tests/kit.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui src/remaster.css src/cinematic.css tests/kit.test.ts
git commit -m "$(cat <<'EOF'
Replace skill trees with one Kit screen.

EOF
)"
```

---

### Task 8: Locker, results, play wiring

**Files:**
- Modify: `src/ui/screens/locker.ts`
- Modify: `src/ui/play/results.ts`
- Modify: `src/ui/screens/play.ts` (`finish()` → `save.recordHeroJob(game.heroDef.id)`; `grantRunRewards` already rolls chests)
- Modify: `src/data/progress.ts` — `rollChest(..., game.heroDef.id)`
- Test: `tests/kit.test.ts`, `tests/careers.test.ts` (zero-payout copy still valid)

**Interfaces:**
- Locker lists `KitItem`s. Equip armor via `equipArmor`. Equip weapons via “Equip on {hero}” only if `familyHero(item.family) === selectedHero`. Salvage updates chest/boots/weapon ids.
- Results: if `item.kind === 'weapon'` show family label + affixes; armor shows slot.

`grantRunRewards` loop:

```typescript
const item = rollChest(rng, quality, save.nextGearId(), game.heroDef.id);
```

- [ ] **Step 1: Write the failing test**

```typescript
it('increments heroJobs on a finished run and stamps the played hero on the chest rng path', () => {
  const save = new SaveStore(null);
  const g = new Game(CRAWLSPACE, { difficulty: DIFFICULTIES.apprentice, mods: neutralModifiers(), hero: 'chris' });
  g.status = 'lost';
  g.stats.kills = 3;
  g.completedWaves = 1;
  save.recordHeroJob('chris');
  expect(save.data.heroJobs.chris).toBe(1);
  expect(cardUnlocked(cardsFor('chris', 'melee').find(c => c.job === 'crew')!, save.data.heroJobs.chris ?? 0)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL if `recordHeroJob` missing

- [ ] **Step 3: Implement locker/results/play**

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/kit.test.ts tests/careers.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui src/data/progress.ts src/save/save.ts tests
git commit -m "$(cat <<'EOF'
Drop kit items after jobs and record hero-specific unlocks.

EOF
)"
```

---

### Task 9: Clear leftover build/talent/skill usage

**Files:**
- Grep and update: `tests/careers.test.ts`, `tests/build-combat.test.ts`, `tests/crew-expansion.test.ts`, `tests/sim.test.ts`, `tests/overhaul.test.ts`, `src/ui/screens/builds.ts` (delete if unused), `src/data/heroBuilds.ts` (keep only if something still needs `heroForBuild` — it should not)
- `src/sim/game.ts` — remove `heroForBuild` swap of C
- Docs: one paragraph at the top of `docs/apprentice-careers/verification.md` pointing at the new spec (historical)

**Interfaces:** none new.

- [ ] **Step 1: Search**

Run: `rg -n "heroBuilds|equipTechnique|unlockTalent|unlockSkill|BUILD_STYLES|heroForBuild" src tests`
Every hit must go: delete test, rewrite to kit, or delete dead module.

- [ ] **Step 2: Fix compile and tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: all files pass. If a count regresses, fix the cause.

- [ ] **Step 3: Opening-map sanity**

Run: `npx vitest run tests/heroes.test.ts tests/campaign-kits.test.ts`
Expected: PASS on default kits (wrench Jeff with default cards).

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "$(cat <<'EOF'
Remove retired build, talent, and perk code paths.

EOF
)"
```

---

### Task 10: Browser kit check

**Files:**
- Create: `scripts/browser-kit-check.mjs` following `scripts/browser-careers-check.mjs` patterns
- Optional: `docs/superpowers/specs/2026-09-21-kit-weapons-armor-design.md` already lists success — do not rewrite the spec

**Interfaces:** none.

- [ ] **Step 1: Script**

Headless Chromium, isolated profile: open Kit, switch Jeff to Pressure Wand, slot Wash the Lane + Steam Cloud, confirm loadout summary, start crawlspace, fire a basic (no console errors). Second path: clock a tiny fixture only if existing playtest helpers allow; otherwise stop at loadout.

- [ ] **Step 2: Run unit suite once more**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add scripts/browser-kit-check.mjs
git commit -m "$(cat <<'EOF'
Add a production-input check for the Kit screen.

EOF
)"
```

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| Kit loop, five slots, shared armor | 4, 7 |
| 16 families, defaults, built-in commons | 1, 4 |
| Profiles, implicits, weapon affixes | 1, 3, 5 |
| Armor pools, old slot mapping | 3, 4 |
| Chest cadence + mix + hero bias | 3, 8 |
| 64 cards, unlocks, default Jeff cards | 2, 6 |
| Combat profile + new missiles | 5 |
| Card hooks | 6 |
| Kit / locker / hub screens | 7, 8 |
| Save v2 migrate | 4 |
| Tests listed in spec | 1–6, 9 |
| Out of scope respected | all |

## Type names (do not rename later)

`WeaponStance`, `WeaponFamilyId`, `ArmorSlot`, `WeaponItem`, `ArmorItem`, `KitItem`, `HeroKit`, `AttackProfile`, `KitCard`, `CardJob`, `resolveAttackProfile`, `strikeFromProfile`, `onKitHit`, `updateKitCards`, `rollChest(rng, quality, id, playedHero?)`.
