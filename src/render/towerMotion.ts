import type { Tower } from '../sim/state';
import { TOWER_ORDER } from '../data/towers';
import { rgba } from './ink';
type Ctx = CanvasRenderingContext2D;

/** Small, anchored mechanisms keep the masonry heavy while the machinery works. */
export function towerMechanisms(ctx: Ctx, tower: Tower, height: number, time: number): void {
  const id = tower.def.id, frozen = tower.frozen > 0 || (tower.build ?? 0) > 0 || (tower.overheated ?? 0) > 0;
  const clock = frozen ? 0 : time, phase = clock * 2.4 + TOWER_ORDER.indexOf(id) * .73;
  const pressure = Math.sin(phase) * .5 + .5;
  ctx.save();
  // Riveted copper footing, inset bevel and a color-coded enamel service plate.
  ctx.fillStyle = '#27383c'; ctx.strokeStyle = '#b6ad8e'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, -3, 26 + tower.level * 1.5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  for (let n = 0; n < 6; n++) { const a = n * Math.PI / 3; ctx.fillStyle = '#d4b984'; ctx.beginPath(); ctx.arc(Math.cos(a) * 24, -3 + Math.sin(a) * 6, 1.2, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = tower.def.color; ctx.strokeStyle = '#e6cf95'; ctx.beginPath(); ctx.roundRect(-10, -height * .23, 20, 7, 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff4c0'; ctx.fillRect(-7, -height * .23 + 2, 2 + pressure * 11, 1.5);
  if (id === 'barricade') {
    // A work-site pennant and four equipment hooks identify the apprentice lodge.
    ctx.strokeStyle = '#d3ae76'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-25, -8); ctx.lineTo(-25, -height * .85); ctx.stroke();
    ctx.fillStyle = '#e8bb5e'; ctx.beginPath(); ctx.moveTo(-25, -height * .85); ctx.quadraticCurveTo(-10, -height * .84 + Math.sin(phase) * 3, -9, -height * .7); ctx.lineTo(-25, -height * .7); ctx.fill();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = ['#74a969','#7495c8','#d78855','#79c5e8'][i]!; ctx.fillRect(-18 + i * 10, -12, 5, 4); }
  } else if (['vent', 'circulator', 'airSeparator', 'steamTrap'].includes(id)) {
    ctx.translate(0, -height * .73); ctx.scale(1, .6); ctx.rotate(phase * (id === 'circulator' ? 2 : 1));
    ctx.fillStyle = '#b1bdad'; ctx.strokeStyle = '#344a50';
    for (let n = 0; n < 5; n++) { ctx.rotate(Math.PI * 2 / 5); ctx.beginPath(); ctx.moveTo(2, -2); ctx.quadraticCurveTo(17, -10, 14, 5); ctx.lineTo(3, 3); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = '#e4bc69'; ctx.beginPath(); ctx.arc(0, 0, 3.8, 0, Math.PI * 2); ctx.fill();
  } else if (['torch', 'boiler', 'radiant', 'heatExchanger'].includes(id)) {
    const x = id === 'heatExchanger' ? -10 : 0, y = -height * .48;
    ctx.fillStyle = rgba('#ffac55', .2 + pressure * .16); ctx.beginPath(); ctx.ellipse(x, y, 11, 17, 0, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 3; i++) {
      const p = (clock * .65 + i / 3) % 1;
      ctx.fillStyle = rgba('#ffdc85', Math.sin(p * Math.PI) * .8); ctx.beginPath(); ctx.arc(x + Math.sin(i * 2 + p * 4) * 8, y - p * 23, 1.6 * (1 - p) + .5, 0, Math.PI * 2); ctx.fill();
    }
  } else if (['descaler', 'glycol', 'washer', 'mixingValve', 'sump'].includes(id)) {
    const x = id === 'mixingValve' ? 12 : 0, y = -height * .57;
    ctx.strokeStyle = rgba('#e7ffff', .5); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 8, y - 9); ctx.lineTo(x - 8, y + 13); ctx.stroke();
    for (let i = 0; i < 4; i++) { const p = (clock * .35 + i * .25) % 1; ctx.strokeStyle = rgba(tower.def.color, .4 + Math.sin(p * Math.PI) * .5); ctx.beginPath(); ctx.arc(x + Math.sin(i * 4 + p * 2) * 6, y + 14 - p * 25, 1 + p * 1.5, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = rgba('#e7ffff', .65); ctx.beginPath(); ctx.moveTo(x - 7, y + 5 + pressure * 3); ctx.quadraticCurveTo(x, y + pressure * 3, x + 7, y + 5 + pressure * 3); ctx.stroke();
  } else if (id === 'pipeSnake' || id === 'hammerDrill') {
    ctx.strokeStyle = '#c8d5d5'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { const x = -12 + i * 5; ctx.beginPath(); ctx.ellipse(x, -height * .53, 2.5, 7 + Math.sin(phase + i) * 2, -.65, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    // Gauge needle and moving indicator for pressure, control and distribution tools.
    const x = id === 'camera' ? 0 : 13, y = -height * .55;
    ctx.fillStyle = '#263a46'; ctx.strokeStyle = '#d8b46b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    const angle = -2.4 + pressure * 1.8; ctx.strokeStyle = tower.def.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle) * 6, y + Math.sin(angle) * 6); ctx.stroke();
    ctx.fillStyle = '#f7de9e'; ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
