export const FIXED_DT = 1 / 60;

export interface LoopHandlers {
  update(dt: number): void;
  render(): void;
}

/** requestAnimationFrame loop with a fixed simulation step and a speed multiplier. */
export class GameLoop {
  speed = 1;
  paused = false;
  private acc = 0;
  private last = 0;
  private raf = 0;
  private running = false;

  constructor(private readonly handlers: LoopHandlers) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (now: number) => {
      if (!this.running) return;
      const elapsed = Math.min(0.25, (now - this.last) / 1000);
      this.last = now;
      if (!this.paused) {
        this.acc += elapsed * this.speed;
        let steps = 0;
        const maxSteps = this.speed > 1.25 ? 10 : 8;
        while (this.acc >= FIXED_DT && steps < maxSteps) {
          this.handlers.update(FIXED_DT);
          this.acc -= FIXED_DT;
          steps++;
        }
        if (steps >= maxSteps) this.acc = Math.min(this.acc, FIXED_DT);
      }
      this.handlers.render();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }
}
