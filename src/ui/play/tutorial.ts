import type { SaveStore } from '../../save/save';
import { h } from '../dom';

export type TutorStep = 'build' | 'jeff' | 'wave' | 'done';

const COPY: Record<TutorStep, { title: string; body: string; hint: string }> = {
  build: {
    title: 'Plant a tool',
    body: 'Arm a tool from the tray at the bottom, then tap a brass pipe node on the yard. Or tap a node first and pick from the wheel.',
    hint: 'Pick a tool from the tray, then tap a pad. Towers do the heavy lifting.',
  },
  jeff: {
    title: 'Deploy your hero',
    body: 'Tap Jeff’s portrait (or press J), then tap the yard to drop him in. After that, tap a leak to wrench it.',
    hint: 'Tap Jeff (portrait or J), then tap the yard to deploy. Tap a leak to wrench it, or ground to move.',
  },
  wave: {
    title: 'Start the job',
    body: 'Press Space or hit Start job / Call wave when you’re ready. Early calls pay bonus cash.',
    hint: 'Space (or Start job) calls the next wave. F for 2×, P to pause.',
  },
  done: {
    title: 'You’re on the job',
    body: 'Build, wrench, call waves. Q · E · R · T · C are Jeff’s skills. Level-ups pause the job so you can rank one.',
    hint: 'You’re on the job. Upgrade towers, rank skills on level-up, hold the line.',
  },
};

export interface TutorCoach {
  readonly el: HTMLElement;
  active: boolean;
  step: TutorStep;
  /** Call each frame while active (for done auto-dismiss). */
  tick(dt: number): void;
  onBuilt(): void;
  onJeffOrder(): void;
  onJeffSelected(): void;
  onWaveStarted(): void;
  dispose(): void;
  hint(): string;
}

/** In-job coach for brand-new Crawlspace Classic runs. */
export function createTutorCoach(save: SaveStore, onHint: (text: string) => void): TutorCoach | null {
  if (!save.needsTutorial()) return null;

  let step: TutorStep = 'build';
  let doneTimer = 0;
  let finished = false;

  const title = h('div', { class: 'coach-title' });
  const body = h('div', { class: 'coach-body' });
  const skip = h('button', {
    class: 'btn link coach-skip',
    text: 'Skip tutorial',
    onClick: () => complete(true),
  });
  const el = h('div', { class: 'coach' }, title, body, skip);

  const paint = () => {
    const c = COPY[step];
    title.textContent = c.title;
    body.textContent = c.body;
    onHint(c.hint);
  };

  const complete = (skipped: boolean) => {
    if (finished) return;
    finished = true;
    save.markTutorialDone();
    el.classList.add('hidden');
    coach.active = false;
    if (skipped) onHint('Tutorial skipped — you’re on the clock.');
  };

  const advance = (next: TutorStep) => {
    if (finished) return;
    step = next;
    coach.step = next;
    paint();
    if (next === 'done') doneTimer = 2;
  };

  paint();

  const coach: TutorCoach = {
    el,
    active: true,
    step: 'build',
    tick(dt) {
      if (!coach.active || step !== 'done') return;
      doneTimer -= dt;
      if (doneTimer <= 0) complete(false);
    },
    onBuilt() {
      if (step === 'build') advance('jeff');
    },
    onJeffOrder() {
      if (step === 'jeff') advance('wave');
    },
    onJeffSelected() {
      if (step === 'jeff') advance('wave');
    },
    onWaveStarted() {
      if (step === 'wave' || step === 'jeff' || step === 'build') advance('done');
    },
    dispose() {
      el.remove();
    },
    hint() {
      return COPY[step].hint;
    },
  };

  return coach;
}
