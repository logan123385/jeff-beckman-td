import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AudioBus } from '../src/audio/bus';

const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
class NodeStub {
  gain = param(); frequency = param(); Q = param();
  connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
  buffer: unknown; loop = false;
}
const buffer = { getChannelData: () => new Float32Array(32) };
class ContextStub {
  currentTime = 0; sampleRate = 16; state = 'running'; destination = {};
  sources: NodeStub[] = [];
  createGain = () => new NodeStub(); createOscillator = () => new NodeStub(); createBiquadFilter = () => new NodeStub();
  createBufferSource = () => { const node = new NodeStub(); this.sources.push(node); return node; };
  createBuffer = () => buffer;
  decodeAudioData = vi.fn(async () => buffer);
  close = vi.fn(async () => {}); resume = vi.fn(async () => {});
}
let ctx: ContextStub;
let request: ReturnType<typeof vi.fn>;
beforeEach(() => {
  ctx = new ContextStub();
  vi.stubGlobal('window', { AudioContext: class { constructor() { return ctx; } } });
  vi.stubGlobal('OscillatorNode', NodeStub); vi.stubGlobal('AudioBufferSourceNode', NodeStub);
  request = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal('fetch', request);
});
afterEach(() => vi.unstubAllGlobals());
const playingMusic = () => ctx.sources.filter(s => s.buffer === buffer && s.start.mock.calls.length > 0 && s.stop.mock.calls.length === 0);

describe('Ambient music lifecycle', () => {
  it('Off does not fetch, decode or start a bed; unmuting starts it', async () => {
    const audio = new AudioBus({ muted: true }); audio.startAmbient('warm');
    expect(request).not.toHaveBeenCalled(); expect(ctx.sources).toHaveLength(0);
    audio.setMuted(false);
    await vi.waitFor(() => expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1));
    expect(playingMusic()).toHaveLength(2); // Pipe hiss and the decoded music.
    audio.applyPreset('off'); expect(playingMusic()).toHaveLength(0);
    audio.applyPreset('soft');
    await vi.waitFor(() => expect(playingMusic()).toHaveLength(2));
    expect(request).toHaveBeenCalledTimes(1); audio.dispose();
  });
  it('failed downloads can retry when sound is enabled again', async () => {
    request.mockRejectedValueOnce(new Error('offline'));
    const audio = new AudioBus(); audio.startAmbient('cold');
    await vi.waitFor(() => expect((audio as unknown as { musicLoad: unknown }).musicLoad).toBeNull());
    audio.setMuted(true); audio.setMuted(false);
    await vi.waitFor(() => expect(ctx.decodeAudioData).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledTimes(2); audio.dispose();
  });
  it('a late decode cannot start music after mute or disposal', async () => {
    let finish!: (value: typeof buffer) => void;
    ctx.decodeAudioData.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const audio = new AudioBus(); audio.startAmbient('plant');
    await vi.waitFor(() => expect(ctx.decodeAudioData).toHaveBeenCalled());
    audio.setMuted(true); audio.dispose(); finish(buffer);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(playingMusic()).toHaveLength(0); expect(ctx.close).toHaveBeenCalledTimes(1);
    audio.startAmbient('warm'); audio.unlock(); expect(request).toHaveBeenCalledTimes(1);
  });
  it('zero ambient volume suspends the bed until volume returns', async () => {
    const audio = new AudioBus({ ambientGain: 0 }); audio.startAmbient('night');
    expect(request).not.toHaveBeenCalled(); audio.setVolumes(.8, .5);
    await vi.waitFor(() => expect(playingMusic()).toHaveLength(2));
    audio.setVolumes(.8, 0); expect(playingMusic()).toHaveLength(0); audio.dispose();
  });
});
