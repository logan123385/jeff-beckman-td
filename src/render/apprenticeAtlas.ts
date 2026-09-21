/** The source uses a magenta production matte. Extract connected silhouettes,
 * rather than fixed cells: a wide wrench may cross a nominal grid boundary. */
export function apprenticeFrames(img: HTMLImageElement): HTMLCanvasElement[] {
  const source = document.createElement('canvas'); source.width = img.width; source.height = img.height;
  const ctx = source.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, img.width, img.height), p = data.data;
  for (let i = 0; i < p.length; i += 4) if (p[i]! > p[i + 1]! + 60 && p[i + 2]! > p[i + 1]! + 60) p[i + 3] = 0;
  const frames: HTMLCanvasElement[] = [], cellH = Math.round(img.height / 4), frameW = Math.ceil(img.width / 8 * 1.9);
  for (let row = 0; row < 4; row++) {
    const startY = Math.round(row * img.height / 4), endY = Math.round((row + 1) * img.height / 4);
    const visited = new Uint8Array(img.width * (endY - startY));
    const bodies: { pixels: number[]; x: number; bottom: number }[] = [];
    for (let at = 0; at < visited.length; at++) {
      if (visited[at] || p[(startY * img.width + at) * 4 + 3]! < 32) continue;
      const pixels = [at]; visited[at] = 1; let x = img.width, bottom = startY;
      for (let n = 0; n < pixels.length; n++) {
        const local = pixels[n]!, px = local % img.width, py = startY + Math.floor(local / img.width);
        x = Math.min(x, px); bottom = Math.max(bottom, py);
        for (const next of [px > 0 ? local - 1 : -1, px + 1 < img.width ? local + 1 : -1, local - img.width, local + img.width]) {
          if (next < 0 || next >= visited.length || visited[next] || p[(startY * img.width + next) * 4 + 3]! < 32) continue;
          visited[next] = 1; pixels.push(next);
        }
      }
      if (pixels.length > cellH * cellH * .025) bodies.push({ pixels, x, bottom });
    }
    const ordered = bodies.sort((a, b) => b.pixels.length - a.pixels.length).slice(0, 8).sort((a, b) => a.x - b.x);
    if (ordered.length !== 8) throw new Error('Incomplete apprentice row; use the fallback animation.');
    for (let col = 0; col < 8; col++) {
      const c = document.createElement('canvas'); c.width = frameW; c.height = cellH;
      const out = c.getContext('2d')!, pixels = out.createImageData(frameW, cellH), body = ordered[col];
      if (body) {
        // Align by the boots, so tool extents never shift the whole body.
        const feet = body.pixels.filter(at => startY + Math.floor(at / img.width) > body.bottom - 9);
        const footX = feet.reduce((sum, at) => sum + at % img.width, 0) / Math.max(1, feet.length);
        const dx = Math.round(frameW / 2 - footX), dy = cellH - 10 - body.bottom;
        for (const at of body.pixels) {
          const sx = at % img.width, sy = startY + Math.floor(at / img.width), x = sx + dx, y = sy + dy;
          if (x < 0 || x >= frameW || y < 0 || y >= cellH) continue;
          const from = (sy * img.width + sx) * 4, to = (y * frameW + x) * 4;
          pixels.data.set(p.subarray(from, from + 4), to);
        }
      }
      out.putImageData(pixels, 0, 0); frames.push(c);
    }
  }
  return frames;
}
