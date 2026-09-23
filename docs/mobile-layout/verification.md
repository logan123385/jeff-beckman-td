# Mobile battle layout

Based on main `91422bd` (Kit of Three). The original local checkout and SneepyTD were not edited.

The battle uses the visible viewport with safe-area padding. Portrait keeps the hero, build tray, all seven powers, wave call, speed, planning, ranks and pause on screen. Landscape moves the lower controls into a side dock. The battlefield measures the space remaining after the HUD and preserves its 8:5 aspect ratio. Mobile Cancel replaces the need for Escape when building or targeting. Pause retains sound, quitting and banking an endless run. Scout, ranks, pause and results can scroll internally; the battle page cannot. Preparation screens remain normally scrollable.

Validation on the production build:

- `npm test`: 400 tests across 18 files passed.
- `npm run build` and `git diff --check`: passed.
- `node scripts/browser-mobile-check.mjs <isolated-CDP-port> <output> http://127.0.0.1:5186/`: passed, no browser exceptions.
- Twelve viewport sizes: 320×568, 360×640, 375×667, 390×664, 430×740, 768×1024, 568×320, 667×375, 740×360, 844×390, 844×300, 667×280. Every battle control is in view, at least 44 pixels tall/wide (allowing subpixel rounding), the dock does not overlap the board, and there is no document overflow. The two shortest layouts model expanded mobile browser bars.
- Eight additional presentation fixtures show boss health with a five-tool tray, including portrait tablets at 768×1024 and 820×1180. These clone UI elements only; they do not claim boss/endless gameplay completion.
- Normal touch input deploys Jeff, builds a tower with ordinary starting cash, cancels placement, opens tower commands, scouts, toggles planning/pause, starts a wave and summons Logan. Rotation during combat and the desktop 1440×900 layout pass too.

The Gitar review found that the older boss-panel selector beat the new board sizing at tablet widths. Reproduced a distorted board at 768×1024, raised the new sizing selector's specificity, and verified the corrected aspect ratio. The fixture now creates an actually visible boss element, exercising `:has(.boss-panel:not(.hidden))` rather than overriding display on a hidden element. Inline tower portrait sizes are also overridden so all five portraits fit their touch targets.

Additional isolated development fixtures verified the real rank panel at 320×568, and Pause → Clock out → results at 568×320. The endless fixture bypassed its unlock gate only, and the rank fixture granted test XP; neither is ordinary-play progression evidence.

`report.json` contains measurements for all 22 checks. Screenshots show small portrait, phone combat, landscape combat, a short landscape viewport and desktop. This is Chromium mobile emulation; physical iPhone/Safari and Android-device testing has not been performed. Safe-area padding and dynamic viewport sizing are implemented, not proven on physical hardware.
