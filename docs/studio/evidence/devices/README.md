# Real-device recordings

Empty until someone records on real hardware (blocker B2). Everything in
`../studio/` is from simulated devices (headless Chromium, SwiftShader).

To add one: on the device, open `/universe`, start a voyage, wait about 60 s,
then use المسجّل → صدّر JSON. Save it here as
`real-<device>-<yyyy-mm-dd>.json` (for example `real-pixel7-2026-10-20.json`)
and run:

```bash
npx tsx scripts/analyze-recording.ts docs/studio/evidence/devices/real-*.json
```

Add the output beside it as `.txt`, and update GLITCH.md and PERFORMANCE.md.
