import { heroGlyphs } from './heroGlyphs';
/** Crisp, locally rendered ability emblems at every display scale. */
export function skillGlyph(key: string): string {
  const shapes: Record<string, string> = {
    Q: '<path d="M28 8H16a8 8 0 0 0-8 8v10a8 8 0 0 0 8 8h12v-7H18a3 3 0 0 1-3-3v-6a3 3 0 0 1 3-3h10z" fill="#e96b47"/><path d="M28 5v16m-5-16h10m-5 14v7"/><rect x="23" y="22" width="10" height="5" fill="#f1d7aa"/>',
    E: '<circle cx="20" cy="20" r="13" fill="#386f88"/><circle cx="20" cy="20" r="8"/><path d="M20 7v26M7 20h26M11 11l18 18M29 11L11 29"/><circle cx="20" cy="20" r="4" fill="#f7dc8e"/>',
    R: '<circle cx="20" cy="19" r="14" fill="#efc273"/><circle cx="20" cy="19" r="10" fill="#faf0c8"/><path d="M20 19l7-7M12 12l2 2m-4 6h3m15 0h3M16 34h8"/><circle cx="20" cy="19" r="2" fill="#c76a48"/>',
    T: '<path d="M20 5l13 5v11c0 7-13 14-13 14S7 28 7 21V10z" fill="#679c8f"/><path d="M20 10v18m-7-12h14"/><path d="M14 32h12"/>',
    C: '<path d="M9 15h20v15a5 5 0 0 1-5 5H14a5 5 0 0 1-5-5z" fill="#aa6945"/><path d="M29 18h3a5 5 0 0 1 0 10h-3M13 10c-4-4 4-4 0-8m8 8c-4-4 4-4 0-8"/><path d="M10 19h18"/>',
    D: '<path d="M6 27v-7a14 14 0 0 1 28 0v7" fill="#e8b853"/><path d="M17 5h6v18h-6z" fill="#f8d989"/><path d="M4 27h32v5H4z" fill="#e1a343"/><path d="M10 18v5m20-5v5"/>',
  };
  return `<svg viewBox="0 0 40 40" aria-hidden="true" fill="none" stroke="#f7e3b3" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${heroGlyphs[key] ?? shapes[({ clamp: 'Q', valve: 'E', pulse: 'R', shield: 'T', coffee: 'C' } as Record<string, string>)[key] ?? key] ?? ''}</svg>`;
}
