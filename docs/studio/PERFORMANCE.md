# Performance

**Simulated devices only.** Every figure below comes from headless Chromium
rendering through **SwiftShader**, a CPU implementation of the GPU, on a
4-core container. That makes these numbers a floor and a regression baseline,
**not** a statement about any phone. No real device has been measured (blocker
B2).

## Measured (production build, `/universe`, during a seeded voyage)

From the recorder exports in `evidence/studio/*-recording.json`, summarised
by `scripts/analyze-recording.ts` (`evidence/studio/recordings-summary.txt`):

| simulated device | canvas (css / buffer) | frames | median | p95 | max |
|---|---|---|---|---|---|
| phone 393×852, DPR 2.75 → capped 2 | 393×852 / 786×1704 | 910 | 43.3 ms (~23 fps) | 112.6 ms | 348.8 ms |
| desktop 1440×900, DPR 1 | 1440×900 / 1440×900 | 709 | 56.2 ms (~18 fps) | 115.1 ms | 341.5 ms |

Run-to-run variation between two runs was about ±5% on the median.

The desktop is slower than the phone despite fewer device pixels per CSS pixel:
1.30 Mpx against 1.34 Mpx is about equal fill, and the desktop's longer label
lines and larger point sprites cost more under software rasterisation. This is
an inference; it has not been profiled.

Load: field ready in about 1.0–1.4 s on a local server. `/universe` first-load
JS is 259 kB. The data is `universe.json` 387 kB and `relations.json` 516 kB,
uncompressed.

## Known per-frame CPU costs (by reading the code; not yet profiled)

- Nearest-āyah search for collision avoidance and the overlay: O(6,236) per
  frame.
- Label candidates: up to 6,236 projections per frame when many āyāt are within
  26u.
- Glow decay: a 6,236-float loop and a buffer upload per frame.

All three are linear and cheap on a real CPU and GPU. If a phone recording
shows frame time dominated by script, the first change is a spatial hash
(the rihla body field already has one) and decimated label passes.

## How to measure a real device

Open `/universe` on the phone, start a voyage (رحلة → انطلق), let it run
60 s, then use المسجّل → صدّر JSON and run:

```bash
npx tsx scripts/analyze-recording.ts the-file.json
```

The recording carries the user agent, the unmasked GPU renderer string, DPR,
canvas and buffer sizes and every frame time. Mark it `real` by filename when
adding it to `evidence/devices/`.
