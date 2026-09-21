/** Controlled rendering fixture. Never imported by the game; does not read or write saves. */
import { DIFFICULTIES } from '../../src/data/difficulty';
import { HEAT_PLANT } from '../../src/data/maps/heatPlant';
import { neutralModifiers } from '../../src/data/skills';
import { TOWER_ORDER } from '../../src/data/towers';
import { Game } from '../../src/sim/game';
import { updateEnemies } from '../../src/sim/enemies';
import { Renderer } from '../../src/render/renderer';
import { h } from '../../src/ui/dom';
import { Hud } from '../../src/ui/play/hud';

export function mountBossVisual(root: HTMLElement): void {
  const game = new Game({ ...HEAT_PLANT, startMoney: 10000, allowedTowers: TOWER_ORDER }, {
    difficulty: DIFFICULTIES.journeyman, mods: neutralModifiers(), manualStart: true, loadout: ['apprentices', 'torch', 'heatExchanger', 'vent', 'barricade'],
  });
  game.placeTower(9, 'apprentices');
  const academy = game.towers[0]!;
  game.upgradeTower(academy.id); game.upgradeTower(academy.id); game.specializeTower(academy.id, 'power');
  game.buySpecialistAbility(academy.id, 'mend');
  game.placeTower(10, 'torch'); game.placeTower(8, 'heatExchanger'); game.placeTower(12, 'vent'); game.placeTower(11, 'barricade');
  for (const f of game.friendlies) f.pos = { ...f.home };
  for (const t of game.towers) t.build = 0;
  game.deployHero({ x: 580, y: 365 });
  const boss = game.spawnEnemy('rogueBoiler', 1, 700); boss.ventTimer = 0; boss.hp = 1100; boss.bossPhase = 1;
  game.spawnEnemy('limeScale', 0, 510); game.spawnEnemy('zincWhisker', 0, 560); game.spawnEnemy('biofilm', 1, 430);
  game.effects.length = 0;
  updateEnemies(game, .05); if (boss.ventCast) boss.ventCast.left = 1.4;
  game.waveIdx = HEAT_PLANT.waves.length; game.time = 20;
  const noop = () => {};
  const hud = new Hud(game, { onCallWave: noop, onToggleSpeed: noop, onTogglePause: noop, onQuit: noop,
    onClockOut: noop, onMute: noop, muteLabel: () => 'Sound off', onClamp: noop, onShutoff: noop,
    onPulse: noop, onSleeve: noop, onCoffee: noop, onSelectJeff: noop, onCrew: noop, onStrike: () => {}, onArm: () => {}, onScout: noop }, () => '1×', () => 'Paused');
  const canvas = h('canvas', { class: 'stage-canvas' });
  const stage = h('div', { class: 'stage' }, canvas);
  root.replaceChildren(h('main', { class: 'screen play' }, hud.top,
    h('div', { class: 'job-strip' }, h('span', { class: 'eyebrow', text: 'Controlled render fixture' }), h('b', { text: 'Heat Plant · The First Furnace' })), stage, hud.bottom));
  const renderer = new Renderer(canvas); renderer.resize();
  hud.setHint('The impact position is locked. Move the hero and rally the crew clear, or stun the Furnace.'); hud.update();
  renderer.draw(game, { hoverSlot: null, selectedSlot: null, selectedTowerId: null, heroSelected: true, previewTower: null, mouse: null, hoverEnemyId: null });
}
