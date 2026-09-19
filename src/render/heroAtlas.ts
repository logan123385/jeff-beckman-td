/** Runtime sprite extraction keeps outstretched fists and tools outside the nominal grid cell.
 * The generated source atlas stays intact. Each connected actor is cached on a roomy canvas,
 * with its original cell anchor, so a long punch neither clips nor drags the next pose with it.
 */
export function extractHeroFrames(img: HTMLImageElement): HTMLCanvasElement[] {
  const width = img.width, height = img.height, cellW = width / 8, cellH = height / 3;
  const source = document.createElement('canvas'); source.width = width; source.height = height;
  const sourceCtx = source.getContext('2d', { willReadFrequently: true })!;
  sourceCtx.drawImage(img, 0, 0);
  const pixels = sourceCtx.getImageData(0, 0, width, height).data;
  const labels = new Int32Array(width * height), stack = new Int32Array(width * height);
  const components: { label: number; minX: number; minY: number; maxX: number; maxY: number; count: number }[] = [];
  let label = 0;
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] || pixels[start * 4 + 3]! < 60) continue;
    label++; let n = 1; stack[0] = start; labels[start] = label;
    const c = { label, minX: width, minY: height, maxX: 0, maxY: 0, count: 0 };
    while (n > 0) {
      const at = stack[--n]!, x = at % width, y = Math.floor(at / width);
      c.minX = Math.min(c.minX, x); c.maxX = Math.max(c.maxX, x); c.minY = Math.min(c.minY, y); c.maxY = Math.max(c.maxY, y); c.count++;
      const visit = (next: number) => { if (!labels[next] && pixels[next * 4 + 3]! >= 60) { labels[next] = label; stack[n++] = next; } };
      if (x > 0) visit(at - 1); if (x < width - 1) visit(at + 1); if (y > 0) visit(at - width); if (y < height - 1) visit(at + width);
    }
    if (c.count > 1500) components.push(c);
  }
  const assignments = new Map<number, { frame: number; split?: number }>();
  for (let row = 0; row < 3; row++) {
    const parts = components.filter(c => Math.min(2, Math.floor((c.maxY - 10) / cellH)) === row).sort((a, b) => a.minX - b.minX);
    let col = 0;
    for (const c of parts) {
      // Two golf poses may touch at the club tip; split at the gap between their bodies.
      const merged = parts.length < 8 && c.maxX - c.minX > cellW * 1.35 && col < 7;
      assignments.set(c.label, { frame: row * 8 + col, split: merged ? Math.round((col + 1) * cellW + 5) : undefined });
      col += merged ? 2 : 1;
    }
  }
  const fw = Math.ceil(cellW * 1.5), fh = Math.ceil(cellH * 1.2);
  const outputs = Array.from({ length: 24 }, () => new ImageData(fw, fh));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = y * width + x;
    if (!pixels[at * 4 + 3]) continue;
    let a = assignments.get(labels[at]!);
    // Retain the original translucent antialiasing fringe around the connected actor.
    if (!a && pixels[at * 4 + 3]! < 60) {
      for (let dy = -2; dy <= 2 && !a; dy++) for (let dx = -2; dx <= 2 && !a; dx++) {
        const sx = x + dx, sy = y + dy;
        if (sx >= 0 && sx < width && sy >= 0 && sy < height) a = assignments.get(labels[sy * width + sx]!);
      }
    }
    if (!a) continue;
    const frame = a.frame + (a.split !== undefined && x >= a.split ? 1 : 0), row = Math.floor(frame / 8), col = frame % 8;
    const px = Math.round(x - (col + .5) * cellW + fw / 2), py = Math.round(y - (row + 1) * cellH + fh);
    if (px < 0 || py < 0 || px >= fw || py >= fh) continue;
    const out = outputs[frame]!.data, dest = (py * fw + px) * 4;
    out[dest] = pixels[at * 4]!; out[dest + 1] = pixels[at * 4 + 1]!; out[dest + 2] = pixels[at * 4 + 2]!; out[dest + 3] = pixels[at * 4 + 3]!;
  }
  return outputs.map(data => {
    const canvas = document.createElement('canvas'); canvas.width = fw; canvas.height = fh;
    canvas.getContext('2d')!.putImageData(data, 0, 0); return canvas;
  });
}
