import { COOLDOWN_FIELDS, type AbilitySlot } from '../../data/heroes';
import { AudioBus, moodForMap } from '../../audio/bus';
import { GameLoop } from '../../core/loop';
import { dist, type Vec } from '../../core/vec';
import { DIFFICULTIES } from '../../data/difficulty';
import { ENEMIES } from '../../data/enemies';
import { MAPS, WORLD_H, WORLD_W, mapById } from '../../data/maps';
import { availableTowers, resolveLoadout } from '../../data/loadout';
import { TOWERS, TOWER_ORDER } from '../../data/towers';
import { NIGHT_MUTATORS } from '../../data/night';
import { remasterTitle } from '../../data/remasters';
import { buildRunModifiers, grantRunRewards } from '../../data/progress';
import type { EnemyId, RemasterId, TowerId } from '../../data/types';
import { Renderer, type RenderView } from '../../render/renderer';
import { JEFF_SELECT_RADIUS } from '../../render/sprites';
import { Game } from '../../sim/game';
import { scaledCastRange } from '../../sim/combat';
import { starsForClear } from '../../save/save';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';
import { Hud } from '../play/hud';
import { createPausePanel, pauseSoundLabel } from '../play/pause';
import { createRankPanel } from '../play/ranks';
import { Popover } from '../play/popover';
import { renderResults } from '../play/results';
import { createTutorCoach, type TutorCoach } from '../play/tutorial';

const SLOT_PICK_RADIUS = 38;
const TOWER_PICK_RADIUS = 42;

export function renderPlay(app: App, mapId: string, remaster: RemasterId = 'classic', loadout?: TowerId[]): ScreenView {
  const found = mapById(mapId);
  if (!found) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }
  if (remaster !== 'classic' && app.save.starsFor(found.id) <= 0) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }
  if (found.endless && !app.save.serviceCallUnlocked()) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }
  const map = found;
  const difficulty = DIFFICULTIES[app.save.data.difficulty];
  const mods = buildRunModifiers(app.save);
  const kit = resolveLoadout(loadout ?? app.save.data.lastLoadout, availableTowers(app.save, map, remaster));
  const game = new Game(map, { heroId: app.save.data.selectedHero, difficulty, mods, seed: (Date.now() & 0xffff) + 1, remaster, loadout: kit, manualStart: true });
  const audio = new AudioBus({
    muted: app.save.data.muted,
    sfxGain: app.save.data.sfxVolume,
    ambientGain: app.save.data.ambientVolume,
  });
  const replay = () => app.go({ kind: 'loadout', mapId: map.id, remaster });

  let lastKills = game.stats.kills;
  let lastEscaped = game.stats.escaped;
  const heardHitFx = new WeakSet<object>();
  const lastRecoil = new Map<number, number>();
  let dripClock = 0;

  const canvas = h('canvas', { class: 'stage-canvas' });
  const banner = h('div', { class: 'banner hidden' });
  const stage = h('div', { class: 'stage' }, canvas, banner);
  const overlayHost = h('div');
  const el = h('div', { class: 'screen play' });

  const renderer = new Renderer(canvas);
  renderer.resize();

  const view: RenderView = {
    hoverSlot: null,
    selectedSlot: null,
    selectedTowerId: null,
    heroSelected: false,
    previewTower: null,
    mouse: null,
    hoverEnemyId: null,
    targeting: null,
    abilitySlot: null,
    armed: null,
    interp: 1,
  };

  let bannerTimer = 0;
  let lastWaveShown = -1;
  let lastForeshadow = -1;
  let finished = false;
  let endDelay = 0;
  let coach: TutorCoach | null = null;
  let stickyTower: TowerId | null = null;
  let autoPauseWaves = false;
  let userPaused = false;
  let lastTowerTap = { id: 0, at: 0 };
  let wasDowned = false;
  let rankPanel!: ReturnType<typeof createRankPanel>;

  const loop = new GameLoop({
    update(dt) {
      game.update(dt);
      app.save.markSeen(game.seen);
      coach?.tick(dt);

      // soft combat cues from sim stats (keep audio out of sim)
      const dk = game.stats.kills - lastKills;
      if (dk > 0) {
        const n = Math.min(3, dk);
        for (let i = 0; i < n; i++) audio.kill();
        lastKills = game.stats.kills;
      }
      const de = game.stats.escaped - lastEscaped;
      if (de > 0) {
        for (let i = 0; i < Math.min(2, de); i++) audio.leak();
        lastEscaped = game.stats.escaped;
      }
      for (const fx of game.effects) {
        if (fx.kind === 'hit' && !heardHitFx.has(fx)) {
          heardHitFx.add(fx);
          if (fx.color === '#fffde7' || fx.color === '#ffecb3' || fx.color === '#ffe082') audio.wrench();
          else audio.hit();
        }
      }
      for (const fx of game.heroVisuals) if (!heardHitFx.has(fx)) {
        heardHitFx.add(fx); audio.heroImpact(fx.kind);
      }
      for (const projectile of game.heroMissiles) if (projectile.kind === 'plunger' && !heardHitFx.has(projectile)) {
        heardHitFx.add(projectile); audio.heroImpact('plunger');
      }
      for (const t of game.towers) {
        const prev = lastRecoil.get(t.id) ?? 0;
        if (t.recoil > 0.05 && prev <= 0.05) audio.shot();
        lastRecoil.set(t.id, t.recoil);
      }
      dripClock += dt;
      if (dripClock >= 2.2) {
        dripClock = 0;
        audio.dripTick();
      }

      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) banner.classList.add('hidden');
      }
      let justStarted = false;
      if (game.waveIdx !== lastWaveShown && game.waveIdx > 0) {
        lastWaveShown = game.waveIdx;
        justStarted = true;
        audio.wave();
        coach?.onWaveStarted();
        showWaveBanner();
      }
      if (!justStarted && !game.allWavesStarted && game.waveCountdown > 0 && lastForeshadow !== game.waveIdx) {
        lastForeshadow = game.waveIdx;
        showUpcomingBanner();
      }
      if (game.status !== 'playing' && !finished) {
        endDelay += dt;
        if (endDelay > 0.8) finish();
      }
      if (game.waveJustCleared) {
        game.waveJustCleared = false;
        if (autoPauseWaves && game.status === 'playing' && !game.allWavesStarted && !game.endless) {
          setPaused(true);
          hud.setHint('Wave clear — defenses hold. Resume when you are ready.');
        }
      }
      if (wasDowned && game.hero.downed <= 0 && !game.hero.deployed) {
        hud.setHint(`${game.heroDef.name} is ready — tap the portrait, then the yard.`);
        audio.order();
      }
      wasDowned = game.hero.downed > 0;
      if (game.pendingRankUps > 0 && game.status === 'playing' && !rankPanel.isOpen()) {
        rankPanel.show();
        syncPause();
        audio.upgrade();
        hud.setHint(`${game.heroDef.name} leveled up — pick a skill to rank.`);
      }
    },
    render() {
      view.interp = loop.alpha;
      view.armed = stickyTower;
      renderer.draw(game, view);
      hud.update();
      popover.update(stage, canvas);
    },
  });

  const popover = new Popover(game, {
    onBuild: (slot, id: TowerId) => {
      if (!live()) return;
      if (game.placeTower(slot, id)) {
        audio.place();
        coach?.onBuilt();
        stickyTower = id;
        view.armed = id;
        hud.setArmed(id);
        popover.hide();
        view.selectedSlot = null;
        view.selectedTowerId = null;
        view.previewTower = id;
        hud.setHint(`${TOWERS[id].name} going in. Tap another pad to plant another — Esc cancels.`);
      } else {
        hud.setHint('Not enough cash for that yet.');
      }
    },
    onUpgrade: (towerId) => {
      if (!live()) return;
      if (game.upgradeTower(towerId)) {
        audio.upgrade();
        popover.showTower(towerId);
      } else {
        const t = game.towerById(towerId);
        const cost = t ? game.upgradeCost(t) : null;
        hud.setHint(cost === null ? 'Already at max tier — try Mastery.' : `Need $${cost} to upgrade.`);
      }
    },
    onMastery: (towerId) => {
      if (!live()) return;
      if (game.reinforceTower(towerId)) { audio.upgrade(); popover.showTower(towerId); }
      else hud.setHint(`Need $${game.towerById(towerId) ? game.masteryCost(game.towerById(towerId)!) : 0} for Mastery.`);
    },
    onSell: (towerId) => {
      if (!live()) return;
      game.sellTower(towerId);
      audio.sell();
      view.selectedTowerId = null;
      popover.hide();
      hud.setHint(stickyTower ? `${TOWERS[stickyTower].name} still armed. Tap the pad to rebuild.` : 'Sold. Arm a tool from the tray, or tap a pad.');
    },
    onPreview: (id) => {
      view.previewTower = id;
    },
    onClose: () => {
      view.selectedSlot = null;
      view.selectedTowerId = null;
      view.heroSelected = false;
      view.previewTower = stickyTower;
      hud.setHeroSelected(false);
      popover.hide();
    },
    onCycleAim: (towerId) => {
      if (!live()) return;
      const aim = game.cycleAim(towerId);
      if (!aim) return;
      audio.order();
      popover.showTower(towerId);
      hud.setHint(`Aim: ${aim === 'first' ? 'First — closest to the valve' : aim === 'strong' ? 'Strong — toughest in range' : aim === 'close' ? 'Close — nearest leak' : 'Last — newest in range'}.`);
    },
    onSpecialize: (towerId, choice) => {
      if (!live()) return;
      if (game.specializeTower(towerId, choice)) { audio.upgrade(); popover.showTower(towerId); hud.setHint('Elite defense ready.'); }
    },
    onRally: (towerId) => beginRally(towerId),
  });
  stage.append(popover.el);

  const hud = new Hud(
    game,
    {
      onCallWave: () => {
        if (!live()) return;
        const bonus = game.callNextWave();
        if (!game.hero.deployed && game.heroEnabled) {
          hud.setHint(`Wave inbound. ${game.heroDef.name} is still in the truck — tap the portrait, then the yard.`);
        } else if (bonus > 0) hud.setHint(`Called early for +$${bonus}.`);
        if (game.waveIdx > 0 || game.waveActive) coach?.onWaveStarted();
      },
      onToggleSpeed: () => {
        loop.speed = loop.speed >= 2.5 ? 1 : loop.speed >= 1.5 ? 3 : 2;
        hud.syncTransport();
      },
      onTogglePause: () => {
        togglePause();
      },
      onQuit: () => quitJob(),
      onClockOut: () => {
        if (!live()) return;
        if (game.retire()) {
          audio.clock();
          hud.setHint('Clocked out. Record saved.');
        } else if (game.endless && game.waveIdx <= 0) {
          hud.setHint('Start the call before you clock out — no XP for standing in the lot.');
        }
      },
      onMute: () => cycleSound(),
      muteLabel: () => pauseSoundLabel(audio.preset()),
      onClamp: () => useClamp(),
      onShutoff: () => useShutoff(),
      onPulse: () => usePulse(),
      onSleeve: () => useSleeve(),
      onCoffee: () => useCoffee(),
      onSelectJeff: () => selectJeff(),
      onCrew: () => beginCrew(),
      onStrike: () => beginStrike(),
      onArm: (id) => arm(id, true),
    },
    () => (loop.speed >= 2.5 ? '▶▶▶ 3×' : loop.speed >= 1.5 ? '▶▶ 2×' : '▶ 1×'),
    () => (loop.paused ? 'Resume' : 'Pause'),
  );

  function cycleSound(): void {
    const next = audio.cyclePreset();
    app.save.setMuted(audio.muted);
    app.save.setVolumes(audio.sfxGain, audio.ambientGain);
    pausePanel.syncSound();
    hud.syncMute();
    const hint =
      next === 'off'
        ? 'Sound off.'
        : next === 'soft'
          ? 'Sound soft — cues on, quiet yard bed.'
          : 'Sound full — soft AV + yard bed.';
    hud.setHint(hint);
  }

  function quitJob(): void {
    if (game.status !== 'playing') {
      app.go({ kind: 'hub' });
      return;
    }
    const leave = game.endless
      ? 'Leave without clocking out? You will not keep XP or crates. Use Clock out to bank them.'
      : 'Leave this job? You will not keep XP or chests from this run.';
    if (confirm(leave)) app.go({ kind: 'hub' });
  }

  const pausePanel = createPausePanel({
    onResume: () => setPaused(false),
    onCycleSound: () => cycleSound(),
    soundLabel: () => pauseSoundLabel(audio.preset()),
    onQuit: () => quitJob(),
    autoPause: () => autoPauseWaves,
    onToggleAutoPause: () => {
      autoPauseWaves = !autoPauseWaves;
      hud.setHint(autoPauseWaves ? 'Auto-pause after each wave.' : 'Waves will roll on.');
    },
  });
  rankPanel = createRankPanel(game, {
    onPick: (slot) => pickRank(slot),
  });
  el.append(pausePanel.el, rankPanel.el);

  audio.unlock();
  audio.startAmbient(moodForMap(map.id));
  coach = game.heroDef.id === 'jeff' && map.id === 'crawlspace' && remaster === 'classic' ? createTutorCoach(app.save, (text) => hud.setHint(text)) : null;
  if (coach) stage.append(coach.el);
  const modeHint =
    remaster === 'frozenMain'
      ? 'Frozen Main — one life. Freezes linger.'
      : remaster === 'codeInspection'
        ? 'Code Inspection — the obvious tools are locked.'
        : game.endless
          ? 'The Neverending Service Call — the endgame. Mutators rotate. Clock out any time; XP and crates bank. Same kit, no exclusive power.'
          : `Arm a tool in the tray (keys 1–5), then tap a pad. Tap ${game.heroDef.name} (or J), then tap the yard to deploy. Space starts the job.`;
  hud.setHint(coach ? coach.hint() : modeHint);

  const job = h(
    'div',
    { class: 'job-strip' },
    h('span', { class: 'eyebrow', text: game.endless ? 'After hours' : map.subtitle }),
    h('b', { text: map.name }),
    h('span', { class: 'pill', text: remasterTitle(remaster) }),
    h('span', { class: 'pill', text: difficulty.name }),
    game.endless ? h('span', { class: 'small muted', text: 'Clock out anytime' }) : h('span', { class: 'small muted', text: `${map.waves.length} waves` }),
  );

  el.append(hud.top, job, stage, hud.bottom, overlayHost);

  // ---------------------------------------------------------------- input

  const COARSE_PAD = 20;

  function isCoarsePointer(ev: PointerEvent | MouseEvent): boolean {
    if ('pointerType' in ev && ev.pointerType === 'touch') return true;
    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  }

  function pickPad(ev: PointerEvent | MouseEvent): number {
    return isCoarsePointer(ev) ? COARSE_PAD : 0;
  }

  function toWorld(clientX: number, clientY: number): Vec {
    const r = canvas.getBoundingClientRect();
    return { x: ((clientX - r.left) / r.width) * WORLD_W, y: ((clientY - r.top) / r.height) * WORLD_H };
  }

  function slotAt(p: Vec, pad = 0): number | null {
    let best: number | null = null;
    let bestD = SLOT_PICK_RADIUS + pad;
    map.slots.forEach((s, i) => {
      const d = dist(s, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  function towerAtPoint(p: Vec, pad = 0): number | null {
    for (const t of game.towers) {
      if (Math.abs(t.pos.x - p.x) < TOWER_PICK_RADIUS + pad && p.y >= t.pos.y - 58 - t.level * 10 - pad && p.y <= t.pos.y + 20 + pad) return t.id;
      if (t.def.kind === 'barricade' && dist(t.rally, p) < 16 + pad) return t.id;
    }
    return null;
  }

  function clearSelection(opts?: { disarm?: boolean }): void {
    view.targeting = null;
    view.abilitySlot = null;
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = false;
    view.previewTower = opts?.disarm ? null : stickyTower;
    hud.setHeroSelected(false);
    hud.setAbilityArmed(null);
    popover.hide();
    if (opts?.disarm) disarm();
  }

  function disarm(): void {
    stickyTower = null;
    view.armed = null;
    if (!popover.isOpen) view.previewTower = null;
    hud.setArmed(null);
  }

  function arm(id: TowerId, toggle = false): void {
    if (!live()) return;
    if (toggle && stickyTower === id) {
      disarm();
      hud.setHint('Tool canceled. Tap a pad to pick from the wheel, or arm another tool.');
      return;
    }
    stickyTower = id;
    view.armed = id;
    hud.setArmed(id);
    if (view.targeting === 'ability' || view.targeting === 'deploy') {
      view.targeting = null;
      view.abilitySlot = null;
      hud.setAbilityArmed(null);
    }
    const def = TOWERS[id];
    hud.setHint(`${def.name} armed ($${game.towerCost(id)}). Tap a pad to plant — Esc cancels.`);
    if (view.selectedSlot !== null && !game.towerAt(view.selectedSlot)) {
      tryStickyPlace(view.selectedSlot);
    }
  }

  function cancelAim(): boolean {
    if (!view.targeting) return false;
    view.targeting = null;
    view.abilitySlot = null;
    hud.setAbilityArmed(null);
    return true;
  }

  function live(): boolean {
    if (game.status !== 'playing') return false;
    if (game.pendingRankUps > 0) {
      hud.setHint('Level up — pick a skill to rank.');
      rankPanel.show();
      return false;
    }
    if (!loop.paused) return true;
    hud.setHint('Paused — press P or Esc to resume.');
    return false;
  }

  function syncPause(): void {
    const rankLock = game.pendingRankUps > 0 && game.status === 'playing';
    loop.paused = userPaused || rankLock;
    el.classList.toggle('paused', loop.paused);
    hud.syncTransport();
    if (userPaused && !rankLock) pausePanel.show();
    else pausePanel.hide();
    if (rankLock) rankPanel.show();
    else rankPanel.hide();
  }

  function setPaused(on: boolean): void {
    if (on && game.pendingRankUps > 0) {
      userPaused = true;
      hud.setHint('Pick a skill to rank first.');
      rankPanel.show();
      syncPause();
      return;
    }
    userPaused = on;
    syncPause();
    if (on) hud.setHint('Paused — the truck is waiting.');
    else hud.setHint(coach?.active ? coach.hint() : 'Back on the clock.');
  }

  function pickRank(slot: AbilitySlot): void {
    const ability = game.heroDef.abilities[slot];
    if (!game.rankAbility(slot)) {
      hud.setHint(game.abilityRanks[slot] >= 3 ? `${ability.name} is fully ranked.` : 'Pick a skill that still has room.');
      rankPanel.sync();
      return;
    }
    audio.upgrade();
    const stars = game.abilityRanks[slot];
    if (game.pendingRankUps > 0) {
      rankPanel.sync();
      hud.setHint(`${ability.name} ranked to ${stars}. ${game.pendingRankUps} pick${game.pendingRankUps === 1 ? '' : 's'} left.`);
    } else {
      rankPanel.hide();
      syncPause();
      hud.setHint(
        userPaused
          ? `${ability.name} ranked to ${stars}. Wave clear — resume when you are ready.`
          : `${ability.name} ranked to ${stars}. Back on the clock.`,
      );
    }
  }

  function togglePause(): void {
    if (game.pendingRankUps > 0) {
      hud.setHint('Pick a skill to rank first.');
      rankPanel.show();
      return;
    }
    setPaused(!userPaused);
  }

  function beginCrew(): void {
    if (!live()) return;
    if (game.crewCooldown > 0) { hud.setHint(`Support crew ready in ${Math.ceil(game.crewCooldown)}s.`); return; }
    view.targeting = 'crew';
    view.abilitySlot = null;
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = false;
    hud.setHeroSelected(false);
    hud.setAbilityArmed(null);
    popover.hide();
    hud.setHint('Deploy support crew: click a route. Two helpers hold enemies for 18s. Esc cancels.');
  }

  function beginStrike(): void {
    if (!live()) return;
    if (game.strikeCooldown > 0) { hud.setHint(`Torch rain ready in ${Math.ceil(game.strikeCooldown)}s.`); return; }
    view.targeting = 'strike';
    view.abilitySlot = null;
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = false;
    hud.setHeroSelected(false);
    hud.setAbilityArmed(null);
    popover.hide();
    hud.setHint('Torch rain: click the yard. Three fire dumps. Hits ground and air. Esc cancels.');
  }

  function beginRally(towerId: number): void {
    if (!live()) return;
    const t = game.towerById(towerId);
    if (!t || t.def.kind !== 'barricade') return;
    view.selectedTowerId = towerId;
    view.targeting = 'rally';
    view.abilitySlot = null;
    view.selectedSlot = null;
    view.heroSelected = false;
    hud.setHeroSelected(false);
    hud.setAbilityArmed(null);
    popover.hide();
    hud.setHint('Set rally point: click a nearby route inside the circle. Esc cancels.');
  }

  function tryStickyPlace(slot: number): boolean {
    if (stickyTower === null || game.towerAt(slot)) return false;
    if (game.placeTower(slot, stickyTower)) {
      audio.place();
      coach?.onBuilt();
      view.selectedSlot = null;
      view.selectedTowerId = null;
      view.previewTower = stickyTower;
      popover.hide();
      view.heroSelected = false;
      hud.setHeroSelected(false);
      hud.setArmed(stickyTower);
      hud.setHint(`${TOWERS[stickyTower].name} going in. Tap another pad to keep building.`);
      return true;
    }
    hud.setHint(`Need $${game.towerCost(stickyTower)} for another ${TOWERS[stickyTower].name}.`);
    return false;
  }

  function tapEmptyPad(slot: number): void {
    if (tryStickyPlace(slot)) return;
    if (stickyTower && game.money >= game.towerCost(stickyTower)) return;
    view.selectedSlot = slot;
    view.selectedTowerId = null;
    view.heroSelected = false;
    hud.setHeroSelected(false);
    popover.showBuild(slot);
  }

  function selectJeff(): void {
    if (!game.hero.deployed || game.hero.downed > 0) {
      beginDeploy();
      return;
    }
    cancelAim();
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = true;
    view.previewTower = stickyTower;
    hud.setHeroSelected(true);
    hud.setAbilityArmed(null);
    popover.hide();
    coach?.onJeffSelected();
    hud.setHint(
      coach?.active
        ? coach.hint()
        : `${game.heroDef.name} ready — tap an enemy to attack, or ground to move. Right-click also moves. Q · E · R · T · C for skills.`,
    );
  }

  function beginDeploy(): void {
    if (!live()) return;
    if (!game.heroEnabled) return;
    if (game.hero.downed > 0) {
      hud.setHint(`${game.heroDef.name} is down — back in ${Math.ceil(game.hero.downed)}s.`);
      return;
    }
    if (game.hero.deployed) {
      selectJeff();
      return;
    }
    view.targeting = 'deploy';
    view.abilitySlot = null;
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = true;
    view.previewTower = stickyTower;
    hud.setHeroSelected(true);
    hud.setAbilityArmed(null);
    popover.hide();
    hud.setHint(`Tap the yard to deploy ${game.heroDef.name}. Esc cancels.`);
  }

  function tapTower(towerId: number): void {
    const now = performance.now();
    if (lastTowerTap.id === towerId && now - lastTowerTap.at < 360) {
      lastTowerTap = { id: 0, at: 0 };
      if (!live()) return;
      if (game.upgradeTower(towerId)) {
        audio.upgrade();
        view.selectedTowerId = towerId;
        popover.showTower(towerId);
        hud.setHint('Upgraded. Double-tap again for the next tier.');
        return;
      }
      const t = game.towerById(towerId);
      const cost = t ? game.upgradeCost(t) : null;
      hud.setHint(cost === null ? 'Already maxed — try Mastery.' : `Need $${cost} to upgrade.`);
    }
    lastTowerTap = { id: towerId, at: now };
    cancelAim();
    view.selectedSlot = null;
    view.heroSelected = false;
    view.previewTower = stickyTower;
    hud.setHeroSelected(false);
    hud.setAbilityArmed(null);
    view.selectedTowerId = towerId;
    popover.showTower(towerId);
  }

  function enemyAtPoint(p: Vec, pad = 0): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const e of game.enemies) {
      if (e.dead || e.escaped) continue;
      const lift = e.def.flying ? 10 : 0;
      const d = dist(e.pos, { x: p.x, y: p.y + lift });
      const hit = e.def.radius + 14 + pad;
      if (d < hit && d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    return best;
  }

  function orderAttack(enemyId: number): void {
    if (!live()) return;
    if (!game.commandHeroAttack(enemyId)) return;
    view.heroSelected = true;
    hud.setHeroSelected(true);
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.previewTower = null;
    popover.hide();
    const prey = game.enemies.find((e) => e.id === enemyId);
    audio.order();
    coach?.onJeffOrder();
    hud.setHint(prey ? `${game.heroDef.name} is on ${prey.def.name}. Tap ground to reposition.` : `${game.heroDef.name} is attacking.`);
  }

  function orderMove(p: Vec): void {
    if (!live()) return;
    if (!game.commandHero(p)) return;
    view.heroSelected = true;
    hud.setHeroSelected(true);
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.previewTower = null;
    popover.hide();
    audio.order();
    coach?.onJeffOrder();
    hud.setHint(coach?.active && coach.step === 'jeff' ? coach.hint() : `${game.heroDef.name} is on the way.`);
  }

  function useHeroSkill(slot: AbilitySlot): void {
    if (!live()) return;
    if (!game.hero.deployed || game.hero.downed > 0) {
      beginDeploy();
      return;
    }
    const ability = game.heroDef.abilities[slot];
    if (ability.target) {
      if (view.targeting === 'ability' && view.abilitySlot === slot) {
        cancelAim();
        hud.setHint('Aim canceled.');
        return;
      }
      beginAbilityAim(slot);
      return;
    }
    if (game.useAbility(slot)) {
      if (game.heroDef.id === 'jeff') audio.skill(['clamp', 'shutoff', 'pulse', 'sleeve', 'coffee'][slot] as 'clamp' | 'shutoff' | 'pulse' | 'sleeve' | 'coffee');
      hud.setHint(`${ability.name} — ${ability.description}`);
    } else if (game.hero.downed > 0) hud.setHint(`${game.heroDef.name} is recovering.`);
    else if (game.hero.cast) hud.setHint(`Finishing ${game.heroDef.abilities[game.hero.cast.slot].name}.`);
    else if (game.hero[COOLDOWN_FIELDS[slot]] > 0) hud.setHint(`${ability.name} ready in ${Math.ceil(game.hero[COOLDOWN_FIELDS[slot]])}s.`);
    else hud.setHint(`${ability.name} needs an enemy in range. Click an enemy to focus it, or move closer.`);
  }

  function beginAbilityAim(slot: AbilitySlot): void {
    const ability = game.heroDef.abilities[slot];
    if (!game.hero.deployed || game.hero.downed > 0) { beginDeploy(); return; }
    if (game.hero.cast) { hud.setHint(`Finishing ${game.heroDef.abilities[game.hero.cast.slot].name}.`); return; }
    if (game.hero[COOLDOWN_FIELDS[slot]] > 0) {
      hud.setHint(`${ability.name} ready in ${Math.ceil(game.hero[COOLDOWN_FIELDS[slot]])}s.`);
      return;
    }
    view.targeting = 'ability';
    view.abilitySlot = slot;
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = true;
    view.previewTower = stickyTower;
    hud.setHeroSelected(true);
    hud.setAbilityArmed(slot);
    popover.hide();
    const kind = ability.aim === 'ground' ? 'Click the yard' : 'Click a leak';
    hud.setHint(`${ability.name}: ${kind} within ${scaledCastRange(game, slot)}. Esc cancels.`);
  }

  function fireAimedAbility(slot: AbilitySlot, p: Vec, enemyId?: number): void {
    const ability = game.heroDef.abilities[slot];
    const range = scaledCastRange(game, slot);
    if (ability.aim === 'enemy') {
      if (enemyId === undefined) {
        hud.setHint(`Click a leak within ${range}. Esc cancels.`);
        return;
      }
      const prey = game.enemies.find((e) => e.id === enemyId && !e.dead && !e.escaped);
      if (!prey) {
        hud.setHint(`Click a leak within ${range}. Esc cancels.`);
        return;
      }
      if (game.heroDef.id === 'becbec' && prey.def.flying) {
        hud.setHint('Haymaker only hits ground leaks.');
        return;
      }
      if (dist(game.hero.pos, prey.pos) > range + prey.def.radius) {
        hud.setHint('Out of range — move closer.');
        return;
      }
      if (game.useAbility(slot, { pos: prey.pos, enemyId })) {
        if (game.heroDef.id === 'jeff') audio.skill(['clamp', 'shutoff', 'pulse', 'sleeve', 'coffee'][slot] as 'clamp' | 'shutoff' | 'pulse' | 'sleeve' | 'coffee');
        else audio.heroImpact('cast');
        cancelAim();
        hud.setHint(`${ability.name} — ${ability.description}`);
      } else hud.setHint(`${ability.name} couldn't fire.`);
      return;
    }
    if (dist(game.hero.pos, p) > range) {
      hud.setHint('Out of range — move closer.');
      return;
    }
    if (game.useAbility(slot, { pos: p })) {
      if (game.heroDef.id === 'jeff') audio.skill(['clamp', 'shutoff', 'pulse', 'sleeve', 'coffee'][slot] as 'clamp' | 'shutoff' | 'pulse' | 'sleeve' | 'coffee');
      else audio.heroImpact('cast');
      cancelAim();
      hud.setHint(`${ability.name} — ${ability.description}`);
    } else hud.setHint(`${ability.name} couldn't fire.`);
  }
  function useClamp(): void { useHeroSkill(0); }
  function useShutoff(): void { useHeroSkill(1); }
  function usePulse(): void { useHeroSkill(2); }
  function useSleeve(): void { useHeroSkill(3); }
  function useCoffee(): void { useHeroSkill(4); }

  canvas.addEventListener('mousemove', (ev) => {
    const p = toWorld(ev.clientX, ev.clientY);
    view.mouse = p;
    view.hoverSlot = slotAt(p);
    view.hoverEnemyId = enemyAtPoint(p);
    const overJeff = game.heroEnabled && dist(game.hero.pos, p) < JEFF_SELECT_RADIUS;
    const overTower = towerAtPoint(p) !== null;
    if (view.targeting || view.hoverEnemyId !== null) canvas.style.cursor = 'crosshair';
    else if (view.hoverSlot !== null || overTower || overJeff) canvas.style.cursor = 'pointer';
    else if (view.heroSelected) canvas.style.cursor = 'move';
    else canvas.style.cursor = 'default';
  });
  canvas.addEventListener('mouseleave', () => {
    view.hoverSlot = null;
    view.hoverEnemyId = null;
    view.mouse = null;
  });
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    if (!live()) return;
    if (cancelAim()) {
      hud.setHint('Aim canceled.');
      return;
    }
    orderMove(toWorld(ev.clientX, ev.clientY));
  });

  /** Primary path for mouse + touch: select / attack / build / move. */
  function handleYardPointer(ev: PointerEvent): void {
    audio.unlock();
    if (ev.button !== 0 && ev.pointerType === 'mouse') return;
    if (game.status !== 'playing') return;
    if (!live()) return;
    // ignore extra fingers
    if (ev.isPrimary === false) return;

    const pad = pickPad(ev);
    const p = toWorld(ev.clientX, ev.clientY);
    const jeffR = (game.heroDef.id === 'mike' ? 48 : JEFF_SELECT_RADIUS) + pad;

    if (view.targeting) {
      const mode = view.targeting;
      if (mode === 'ability') {
        const slot = (view.abilitySlot ?? 0) as AbilitySlot;
        fireAimedAbility(slot, p, enemyAtPoint(p, pad) ?? undefined);
        return;
      }
      if (mode === 'deploy') {
        if (game.deployHero(p)) {
          audio.order();
          cancelAim();
          view.heroSelected = true;
          hud.setHeroSelected(true);
          coach?.onJeffSelected();
          hud.setHint(`${game.heroDef.name} is on the yard. Tap a leak to attack, or ground to move.`);
        } else if (game.hero.downed > 0) {
          hud.setHint(`${game.heroDef.name} is down — back in ${Math.ceil(game.hero.downed)}s.`);
        } else hud.setHint('Tap the yard to drop them in. Esc cancels.');
        return;
      }
      if (mode === 'strike') {
        if (game.torchStrike(p)) {
          audio.skill('pulse');
          cancelAim();
          hud.setHint('Torch rain inbound.');
        } else hud.setHint('Aim on the yard. Esc cancels.');
        return;
      }
      const ok = mode === 'crew' ? game.reinforce(p) : view.selectedTowerId !== null && game.setRally(view.selectedTowerId, p);
      if (ok) {
        audio.order();
        cancelAim();
        hud.setHint(mode === 'crew' ? 'Crew in position. Hold the line.' : 'Rally set. Recruits will hold that ground.');
      }
      else hud.setHint('Choose a visible route nearby. Esc cancels.');
      return;
    }

    const coarse = isCoarsePointer(ev);
    const slotNear = slotAt(p, pad);
    const towerNear = towerAtPoint(p, pad);

    if (coarse && towerNear !== null) {
      tapTower(towerNear);
      return;
    }
    if (coarse && slotNear !== null && !game.towerAt(slotNear)) {
      tapEmptyPad(slotNear);
      return;
    }

    if (game.heroEnabled && game.hero.deployed && game.hero.downed <= 0 && dist(game.hero.pos, { x: p.x, y: p.y + 10 }) < jeffR) {
      selectJeff();
      return;
    }
    const enemyId = enemyAtPoint(p, pad);
    if (enemyId !== null && game.heroEnabled && game.hero.deployed && game.hero.downed <= 0) {
      orderAttack(enemyId);
      return;
    }
    const recruit = game.friendlies.find(f => f.hp > 0 && dist({ x: f.pos.x, y: f.pos.y - 17 }, p) < 15 + pad);
    if (recruit) {
      view.selectedTowerId = recruit.towerId;
      view.selectedSlot = null;
      view.heroSelected = false;
      hud.setHeroSelected(false);
      popover.showTower(recruit.towerId);
      return;
    }
    const towerId = towerAtPoint(p, pad);
    if (towerId !== null) {
      tapTower(towerId);
      return;
    }
    const slot = slotAt(p, pad);
    if (slot !== null && !game.towerAt(slot)) {
      tapEmptyPad(slot);
      return;
    }
    if (view.heroSelected) {
      orderMove(p);
      return;
    }
    view.selectedSlot = null;
    view.selectedTowerId = null;
    popover.hide();
    hud.setHint(
      !game.hero.deployed
        ? `Tap ${game.heroDef.name} (portrait or J), then tap the yard to deploy.`
        : stickyTower
          ? `${TOWERS[stickyTower].name} armed. Tap a pad to plant, or Esc to cancel.`
          : `Arm a tool in the tray, or tap a pad. Select ${game.heroDef.name} (J) to move — tap a leak to attack.`,
    );
  }

  canvas.addEventListener('pointerdown', (ev) => {
    ev.preventDefault();
    handleYardPointer(ev);
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (ev.pointerType !== 'touch') return;
    const p = toWorld(ev.clientX, ev.clientY);
    view.mouse = p;
    view.hoverSlot = slotAt(p, pickPad(ev));
    view.hoverEnemyId = enemyAtPoint(p, pickPad(ev));
  });
  // Avoid ghost mouse events after touch on some browsers
  canvas.style.touchAction = 'none';

  const onKey = (ev: KeyboardEvent) => {
    if (ev.repeat) return;
    const key = ev.key.toLowerCase();
    if (' qertcdgjufpsanx123456789'.includes(key) || ev.key === ' ' || key === 'escape') ev.preventDefault();
    if (game.pendingRankUps > 0 && game.status === 'playing') {
      const rankKeys: Record<string, AbilitySlot> = { q: 0, e: 1, r: 2, t: 3, c: 4 };
      if (key in rankKeys) {
        pickRank(rankKeys[key]!);
        return;
      }
      if (key === '1' || key === '2' || key === '3' || key === '4' || key === '5') {
        pickRank((Number(key) - 1) as AbilitySlot);
        return;
      }
      if (key === 'escape' || key === 'p') {
        hud.setHint('Pick a skill to rank first.');
        rankPanel.show();
        return;
      }
    }
    switch (key) {
      case 'd': beginCrew(); break;
      case 'x': beginStrike(); break;
      case 'g': if (view.selectedTowerId !== null) beginRally(view.selectedTowerId); break;
      case 'q':
        useClamp();
        break;
      case 'e':
        useShutoff();
        break;
      case 'r':
        usePulse();
        break;
      case 't':
        useSleeve();
        break;
      case 'c':
        useCoffee();
        break;
      case ' ':
      case 'n': {
        ev.preventDefault();
        if (!live()) break;
        const bonus = game.callNextWave();
        if (!game.hero.deployed && game.heroEnabled) {
          hud.setHint(`Wave inbound. ${game.heroDef.name} is still in the truck — tap the portrait, then the yard.`);
        } else if (bonus > 0) hud.setHint(`Called early for +$${bonus}.`);
        if (game.waveIdx > 0 || game.waveActive) coach?.onWaveStarted();
        break;
      }
      case 'f':
        loop.speed = loop.speed >= 2.5 ? 1 : loop.speed >= 1.5 ? 3 : 2;
        hud.syncTransport();
        break;
      case 'p':
        togglePause();
        break;
      case 'j':
        selectJeff();
        break;
      case 'u': {
        if (!live() || view.selectedTowerId === null) break;
        const id = view.selectedTowerId;
        if (game.upgradeTower(id)) {
          audio.upgrade();
          popover.showTower(id);
        }
        break;
      }
      case 'a': {
        if (!live() || view.selectedTowerId === null) break;
        const aim = game.cycleAim(view.selectedTowerId);
        if (aim) {
          audio.order();
          popover.showTower(view.selectedTowerId);
          hud.setHint(`Aim: ${aim}.`);
        }
        break;
      }
      case 's': {
        if (!live() || view.selectedTowerId === null) break;
        const id = view.selectedTowerId;
        if (game.sellTower(id)) {
          audio.sell();
          view.selectedTowerId = null;
          popover.hide();
          hud.setHint(stickyTower ? `${TOWERS[stickyTower].name} still armed. Tap the pad to rebuild.` : 'Sold.');
        }
        break;
      }
      case '1':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9': {
        if (!live()) break;
        const kit = TOWER_ORDER.filter((id) => game.allowedTowers.includes(id));
        const id = kit[Number(ev.key) - 1];
        if (!id) break;
        arm(id);
        break;
      }
      case 'escape':
        if (view.targeting) {
          cancelAim();
          hud.setHint('Aim canceled.');
        } else if (view.selectedSlot !== null || view.selectedTowerId !== null || view.heroSelected || popover.isOpen) {
          view.selectedSlot = null;
          view.selectedTowerId = null;
          view.heroSelected = false;
          view.previewTower = stickyTower;
          hud.setHeroSelected(false);
          popover.hide();
          hud.setHint(stickyTower ? `${TOWERS[stickyTower].name} still armed. Tap a pad or Esc to cancel.` : 'Selection cleared.');
        } else if (stickyTower) {
          disarm();
          hud.setHint('Tool canceled.');
        } else {
          togglePause();
        }
        break;
      default:
        return;
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- banners / results

  function showUpcomingBanner(): void {
    const ids = game.nextWaveEnemies();
    const fresh = ids.filter((id) => !app.save.hasSeen(id));
    if (fresh.length === 0) return;
    const first = fresh[0]!;
    const def = ENEMIES[first];
    const extra = fresh.length > 1 ? ` + ${fresh.length - 1} more new` : '';
    clear(banner);
    banner.append(
      h('div', { class: 'banner-title', text: game.waveIdx === 0 ? 'Incoming' : `Incoming · wave ${game.waveIdx + 1}` }),
      h('div', { class: 'banner-new' }, h('span', { class: 'pill new', text: 'NEW' }), h('b', { text: def.name }), h('span', { class: 'small', text: ` — ${def.fantasy}${extra}` })),
      h('div', { class: 'small counter', html: `<b>Counter:</b> ${def.counters}` }),
    );
    bannerTimer = 6;
    banner.classList.remove('hidden');
  }

  function showWaveBanner(): void {
    const ids = [...new Set(game.enemies.map((e) => e.def.id).concat(game.spawns.map((s) => s.enemy)))] as EnemyId[];
    const fresh = ids.filter((id) => !app.save.hasSeen(id));
    clear(banner);
    const mut = game.nightMutator ? ` · ${NIGHT_MUTATORS[game.nightMutator].name}` : '';
    banner.append(
      h('div', { class: 'banner-title', text: game.endless ? `The Neverending Service Call · wave ${game.waveIdx}${mut}` : game.allWavesStarted ? `Final wave ${game.waveIdx}` : `${remasterTitle(remaster)} · Wave ${game.waveIdx}` }),
    );
    if (game.nightMutator) {
      banner.append(h('div', { class: 'small muted', text: NIGHT_MUTATORS[game.nightMutator].blurb }));
    }
    const first = fresh[0];
    if (first) {
      const def = ENEMIES[first];
      banner.append(h('div', { class: 'banner-new' }, h('span', { class: 'pill new', text: 'NEW' }), h('b', { text: def.name }), h('span', { class: 'small', text: ` — ${def.fantasy}` })), h('div', { class: 'small counter', html: `<b>Counter:</b> ${def.counters}` }));
      bannerTimer = 6;
    } else {
      bannerTimer = 2.2;
    }
    banner.classList.remove('hidden');
  }

  function finish(): void {
    finished = true;
    loop.stop();
    audio.stopAmbient();
    app.save.markSeen(game.seen);
    const startLives = game.remaster === 'frozenMain' ? 1 : Math.max(1, Math.round(map.lives * difficulty.livesMult));
    let earned = 0;
    let firstClear = true;
    if (game.status === 'won' && !game.endless) {
      if (remaster === 'classic') {
        firstClear = app.save.starsFor(map.id) === 0;
        earned = starsForClear(game.lives, startLives);
        app.save.recordClear(map.id, difficulty.id, earned);
      } else {
        firstClear = app.save.recordRemaster(map.id, remaster);
        earned = firstClear ? 1 : 0;
      }
      audio.win();
    } else if (game.status === 'retired') {
      app.save.recordServiceCall(game.completedWaves);
      audio.clock();
    } else if (game.status === 'lost') {
      if (game.endless) app.save.recordServiceCall(Math.max(0, game.waveIdx - 1));
      audio.lose();
    }
    const reward = grantRunRewards(app.save, game, earned, firstClear);
    const idx = MAPS.findIndex((m) => m.id === map.id);
    const next = remaster === 'classic' && !game.endless ? MAPS[idx + 1] : undefined;
    clearSelection({ disarm: true });
    overlayHost.append(
      renderResults(game, earned, {
        onRetry: replay,
        onNext: game.status === 'won' && next ? () => app.go({ kind: 'loadout', mapId: next.id, remaster: 'classic' }) : null,
        onHub: () => app.go({ kind: 'hub' }),
      }, reward),
    );
  }

  const onResize = () => renderer.resize();
  const onHide = () => {
    if (document.hidden && game.status === 'playing' && !loop.paused) {
      setPaused(true);
      hud.setHint('Paused — the tab was in the background. Press P or Esc to resume.');
    }
  };
  const stageWatch = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
  stageWatch?.observe(stage);
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onHide);
  lastForeshadow = game.waveIdx;
  showUpcomingBanner();
  if (import.meta.env.DEV) {
    (window as Window & { __jbtd?: { grantHeroXp: (n: number) => void } }).__jbtd = {
      grantHeroXp: (n: number) => game.grantHeroXp(n),
    };
  }
  loop.start();

  return {
    el,
    dispose() {
      loop.stop();
      audio.stopAmbient();
      coach?.dispose();
      pausePanel.hide();
      rankPanel.hide();
      if (import.meta.env.DEV) delete (window as Window & { __jbtd?: unknown }).__jbtd;
      stageWatch?.disconnect();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onHide);
    },
  };
}
