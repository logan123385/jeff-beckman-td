import { GameLoop } from '../../core/loop';
import { dist, type Vec } from '../../core/vec';
import { DIFFICULTIES } from '../../data/difficulty';
import { ENEMIES } from '../../data/enemies';
import { MAPS, WORLD_H, WORLD_W, mapById } from '../../data/maps';
import { buildModifiers } from '../../data/skills';
import type { EnemyId, TowerId } from '../../data/types';
import { Renderer, type RenderView } from '../../render/renderer';
import { JEFF_SELECT_RADIUS } from '../../render/sprites';
import { Game } from '../../sim/game';
import { starsForClear } from '../../save/save';
import type { App, ScreenView } from '../app';
import { clear, h } from '../dom';
import { Hud } from '../play/hud';
import { Popover } from '../play/popover';
import { renderResults } from '../play/results';

const SLOT_PICK_RADIUS = 24;
const TOWER_PICK_RADIUS = 24;

export function renderPlay(app: App, mapId: string): ScreenView {
  const found = mapById(mapId);
  if (!found) {
    app.go({ kind: 'hub' });
    return { el: h('div') };
  }
  const map = found;
  const difficulty = DIFFICULTIES[app.save.data.difficulty];
  const mods = buildModifiers(app.save.data.skills);
  const game = new Game(map, { difficulty, mods, seed: (Date.now() & 0xffff) + 1 });

  const canvas = h('canvas', { class: 'stage-canvas' });
  const banner = h('div', { class: 'banner hidden' });
  const stage = h('div', { class: 'stage' }, canvas, banner);
  const overlayHost = h('div');
  const el = h('div', { class: 'screen play' });

  const renderer = new Renderer(canvas);
  renderer.resize();

  const view: RenderView = { hoverSlot: null, selectedSlot: null, selectedTowerId: null, heroSelected: false, previewTower: null, mouse: null };

  let bannerTimer = 0;
  let lastWaveShown = -1;
  let finished = false;
  let endDelay = 0;

  const loop = new GameLoop({
    update(dt) {
      game.update(dt);
      if (bannerTimer > 0) {
        bannerTimer -= dt;
        if (bannerTimer <= 0) banner.classList.add('hidden');
      }
      if (game.waveIdx !== lastWaveShown && game.waveIdx > 0) {
        lastWaveShown = game.waveIdx;
        showWaveBanner();
      }
      if (game.status !== 'playing' && !finished) {
        endDelay += dt;
        if (endDelay > 0.8) finish();
      }
    },
    render() {
      renderer.draw(game, view);
      hud.update();
      popover.update(stage, canvas);
    },
  });

  const popover = new Popover(game, {
    onBuild: (slot, id: TowerId) => {
      if (game.placeTower(slot, id)) {
        const t = game.towerAt(slot);
        popover.hide();
        view.selectedSlot = null;
        view.previewTower = null;
        if (t) {
          view.selectedTowerId = t.id;
          popover.showTower(t.id);
        }
      } else {
        hud.setHint('Not enough cash for that yet.');
      }
    },
    onUpgrade: (towerId) => {
      if (game.upgradeTower(towerId)) popover.showTower(towerId);
    },
    onSell: (towerId) => {
      game.sellTower(towerId);
      clearSelection();
    },
    onPreview: (id) => {
      view.previewTower = id;
    },
    onClose: () => clearSelection(),
  });
  stage.append(popover.el);

  const hud = new Hud(
    game,
    {
      onCallWave: () => {
        const bonus = game.callNextWave();
        if (bonus > 0) hud.setHint(`Called early for +$${bonus}.`);
      },
      onToggleSpeed: () => {
        loop.speed = loop.speed === 1 ? 2 : 1;
      },
      onTogglePause: () => {
        loop.paused = !loop.paused;
      },
      onQuit: () => {
        if (game.status !== 'playing' || confirm('Leave this job? Progress on this map is not saved.')) app.go({ kind: 'hub' });
      },
      onClamp: () => useClamp(),
      onShutoff: () => useShutoff(),
      onSelectJeff: () => selectJeff(),
    },
    () => (loop.speed === 1 ? '▶ 1×' : '▶▶ 2×'),
    () => (loop.paused ? 'Resume' : 'Pause'),
  );
  hud.setHint('Click a pipe node to build. Right-click to move Jeff. Space starts the job.');

  el.append(hud.top, stage, hud.bottom, overlayHost);

  // ---------------------------------------------------------------- input

  function toWorld(ev: MouseEvent): Vec {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * WORLD_W, y: ((ev.clientY - r.top) / r.height) * WORLD_H };
  }

  function slotAt(p: Vec): number | null {
    let best: number | null = null;
    let bestD = SLOT_PICK_RADIUS;
    map.slots.forEach((s, i) => {
      const d = dist(s, p);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  function towerAtPoint(p: Vec): number | null {
    for (const t of game.towers) {
      if (dist(t.pos, { x: p.x, y: p.y + 8 }) < TOWER_PICK_RADIUS) return t.id;
      if (t.def.kind === 'barricade' && dist(t.rally, p) < 16) return t.id;
    }
    return null;
  }

  function clearSelection(): void {
    view.selectedSlot = null;
    view.selectedTowerId = null;
    view.heroSelected = false;
    view.previewTower = null;
    popover.hide();
  }

  function selectJeff(): void {
    clearSelection();
    view.heroSelected = true;
    hud.setHint('Jeff selected — click the map to send him. He holds two enemies and stuns with every sixth swing.');
  }

  function useClamp(): void {
    if (game.useClamp()) hud.setHint('Pipe Clamp down. Ground enemies inside are held and slowed.');
    else if (game.hero.clampCooldown > 0) hud.setHint(`Pipe Clamp ready in ${Math.ceil(game.hero.clampCooldown)}s.`);
  }

  function useShutoff(): void {
    if (game.useShutoff()) hud.setHint('Emergency Shutoff! Everything slows, spawns pause.');
    else if (game.hero.shutoffCooldown > 0) hud.setHint(`Emergency Shutoff ready in ${Math.ceil(game.hero.shutoffCooldown)}s.`);
  }

  canvas.addEventListener('mousemove', (ev) => {
    const p = toWorld(ev);
    view.mouse = p;
    view.hoverSlot = slotAt(p);
    canvas.style.cursor = view.hoverSlot !== null || towerAtPoint(p) !== null || (game.heroEnabled && dist(game.hero.pos, p) < JEFF_SELECT_RADIUS) ? 'pointer' : view.heroSelected ? 'crosshair' : 'default';
  });
  canvas.addEventListener('mouseleave', () => {
    view.hoverSlot = null;
    view.mouse = null;
  });
  canvas.addEventListener('contextmenu', (ev) => {
    ev.preventDefault();
    const p = toWorld(ev);
    if (game.commandHero(p)) hud.setHint('Jeff’s on his way.');
  });
  canvas.addEventListener('mousedown', (ev) => {
    if (ev.button !== 0 || game.status !== 'playing') return;
    const p = toWorld(ev);

    if (game.heroEnabled && game.hero.downed <= 0 && dist(game.hero.pos, { x: p.x, y: p.y + 10 }) < JEFF_SELECT_RADIUS) {
      selectJeff();
      return;
    }
    const towerId = towerAtPoint(p);
    if (towerId !== null) {
      clearSelection();
      view.selectedTowerId = towerId;
      popover.showTower(towerId);
      return;
    }
    const slot = slotAt(p);
    if (slot !== null && !game.towerAt(slot)) {
      clearSelection();
      view.selectedSlot = slot;
      popover.showBuild(slot);
      return;
    }
    if (view.heroSelected) {
      game.commandHero(p);
      return;
    }
    clearSelection();
  });

  const onKey = (ev: KeyboardEvent) => {
    if (ev.repeat) return;
    switch (ev.key.toLowerCase()) {
      case 'q':
        useClamp();
        break;
      case 'e':
        useShutoff();
        break;
      case ' ':
      case 'n':
        ev.preventDefault();
        game.callNextWave();
        break;
      case 'f':
        loop.speed = loop.speed === 1 ? 2 : 1;
        break;
      case 'p':
        loop.paused = !loop.paused;
        break;
      case 'j':
        selectJeff();
        break;
      case 'escape':
        clearSelection();
        break;
      default:
        return;
    }
  };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- banners / results

  function showWaveBanner(): void {
    const ids = [...new Set(game.enemies.map((e) => e.def.id).concat(game.spawns.map((s) => s.enemy)))] as EnemyId[];
    const fresh = ids.filter((id) => !app.save.hasSeen(id));
    clear(banner);
    banner.append(h('div', { class: 'banner-title', text: game.allWavesStarted ? `Final wave ${game.waveIdx}` : `Wave ${game.waveIdx}` }));
    const first = fresh[0];
    if (first) {
      const def = ENEMIES[first];
      banner.append(h('div', { class: 'banner-new' }, h('span', { class: 'pill new', text: 'NEW' }), h('b', { text: def.name }), h('span', { class: 'small', text: ` — ${def.fantasy}` })), h('div', { class: 'small counter', html: `<b>Counter:</b> ${def.counters}` }));
      bannerTimer = 6;
    } else {
      bannerTimer = 2.2;
    }
    banner.classList.remove('hidden');
    app.save.markSeen(ids);
  }

  function finish(): void {
    finished = true;
    loop.stop();
    app.save.markSeen(game.seen);
    const startLives = Math.max(1, Math.round(map.lives * difficulty.livesMult));
    const earned = game.status === 'won' ? starsForClear(game.lives, startLives) : 0;
    if (game.status === 'won') app.save.recordClear(map.id, difficulty.id, earned);
    const idx = MAPS.findIndex((m) => m.id === map.id);
    const next = MAPS[idx + 1];
    clearSelection();
    overlayHost.append(
      renderResults(game, earned, {
        onRetry: () => app.go({ kind: 'play', mapId: map.id }),
        onNext: game.status === 'won' && next ? () => app.go({ kind: 'play', mapId: next.id }) : null,
        onHub: () => app.go({ kind: 'hub' }),
      }),
    );
  }

  const onResize = () => renderer.resize();
  window.addEventListener('resize', onResize);
  loop.start();

  return {
    el,
    dispose() {
      loop.stop();
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    },
  };
}
