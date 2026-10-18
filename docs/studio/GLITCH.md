# The half-screen glitch

**Status: one root cause isolated, reproduced, fixed, and kept reproducible.**
It was confirmed on simulated devices only (headless Chromium, SwiftShader). It
has **not** been confirmed on the Android phone where it was reported. That
check is blocker B2.

## What was reported

A half-screen visual glitch that looked like a misbehaving digitizer: part of
the scene missing or offset on a phone.

## Root cause (class: **compositing**)

The legacy الكون scene (`/`, `src/components/cosmos/scene.tsx`) sized its
renderer with `renderer.setSize(w, h, false)`. The third argument turns off
`updateStyle`. three.js then sets the drawing buffer to `w·dpr × h·dpr` but
gives the `<canvas>` element no CSS size. The element therefore lays out at its
buffer size in CSS pixels, so on a device-pixel-ratio-2 screen it is twice the
host in each dimension.

- The host clips it, so only the **top-left quarter** of the rendered frame is
  on screen, magnified 2×.
- The DOM controls are laid out separately and stay correct. So the screen
  shows correct chrome over a magnified, offset field, which reads as
  "half the screen is wrong".
- The scene caps the pixel ratio at 2, so every phone with DPR ≥ 2 shows
  exactly the same 2× defect. That covers effectively every current Android
  phone (DPR 2.625 and 3 are common).

`4c059a1` had already found and fixed this exact defect in الرحلة
(`rihla-scene.tsx`: *"THE CANVAS WAS MAGNIFIED… updateStyle stays on"*). The
legacy scene was never given the same fix.

## Reproduction

`tests/browser/glitch-repro.mjs` measures host, canvas and buffer sizes and
takes a screenshot at DPR 1, 2, 2.625 and 3 (viewport 412×860).

| run | DPR 1 | DPR 2 | DPR 2.625 | DPR 3 |
|---|---|---|---|---|
| `before` (baseline `4c059a1`) | 412×860, 100% visible | **824×1720 css, 25% visible** | **824×1720, 25%** | **824×1720, 25%** |
| `after` (fixed) | 100% | 100% | 100% | 100% |
| `flag` (`/?legacy-canvas`) | 100% | 25% | 25% | 25% |
| `rihla` (`/rihla`, untouched) | 100% | 100% | 100% | 100% |
| `universe-prod` (new `/universe`, production build) | 100% | 100% | 100% | 100% |

The JSON results and PNGs are in `docs/studio/evidence/glitch/`. Compare
`before-dpr1.png` with `before-dpr2.625.png`: the node field visible at lower
left at DPR 1 is pushed off-screen at DPR 2.625, while the panels are
unchanged.

```bash
npm run build && STUDIO_ACCESS_TOKEN=t npx next start -p 3200 &
CHROMIUM_PATH=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
STUDIO_TOKEN=t node tests/browser/glitch-repro.mjs http://127.0.0.1:3200 /tmp/out flag "/?legacy-canvas"
```

## Fix

`setSize(w, h, !legacyCanvas)`: `updateStyle` is on unless the URL carries
`?legacy-canvas`. That flag exists only to keep the minimal reproduction one
URL away. The new scene always keeps `updateStyle` on, and its flight
recorder logs host, CSS and buffer sizes on every resize. `diagnose()`
classifies any mismatch as `compositing`, so the same defect would show up in
any recording a user exports.

## Other classes, checked and not supported by the evidence

These come from `diagnose()` over the phone and desktop recordings in
`docs/studio/evidence/studio/`:

| class | finding |
|---|---|
| precision | 0 non-finite poses. Largest coordinate 170u, where float32 spacing is 1.5e-5u (H5: about 10⁻³ px at the closest viewing distance). |
| clipping | far/near = 40,000. Depth resolution at 900u ≈ 0.48u, irrelevant with depthWrite off and additive blending. |
| buffer | buffer = host × DPR in every record. |
| context loss | no `webglcontextlost` events. The new scene records them if they occur. |
| shader | no shader or program errors logged. |
| device | **unresolved**: needs a recording from real hardware. |

## If the glitch persists on the phone after this fix

Then this was not (or not the only) cause. Open `/universe`, fly until it
happens, open المسجّل and export the JSON, then run
`npx tsx scripts/analyze-recording.ts <file>`. The diagnosis lists each class
against what that device actually recorded.
