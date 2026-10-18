// Minimal reproduction of the half-screen glitch on the legacy الكون route.
// Usage: node tests/browser/glitch-repro.mjs <baseUrl> <outDir> <label>
// Measures, per device-pixel ratio, the host size, the canvas element's laid-out
// size and its drawing-buffer size, and takes a screenshot. Simulated devices
// only (headless Chromium + SwiftShader); this is not real Android hardware.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [base = 'http://localhost:3100', out = 'docs/studio/evidence/glitch', label = 'run', route = '/'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...(process.env.HTTPS_PROXY && /^https:/.test(process.argv[2] ?? '') ? { proxy: { server: process.env.HTTPS_PROXY } } : {}) });
const results = [];
for (const dpr of [1, 2, 2.625, 3]) {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: dpr, isMobile: dpr > 1, hasTouch: dpr > 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + route, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 60000 });
  await page.waitForTimeout(2500);
  const m = await page.evaluate(() => {
    const c = [...document.querySelectorAll('canvas')].find((x) => x.getContext && (x.getAttribute('data-engine') || x.width > 0));
    const host = c.parentElement;
    const r = c.getBoundingClientRect();
    const h = host.getBoundingClientRect();
    return {
      viewport: [innerWidth, innerHeight],
      deviceDpr: devicePixelRatio,
      host: [Math.round(h.width), Math.round(h.height)],
      css: [Math.round(r.width), Math.round(r.height)],
      buffer: [c.width, c.height],
      styleWidth: c.style.width || null,
      visibleFraction: (Math.min(r.right, innerWidth) - Math.max(r.left, 0)) * (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / (r.width * r.height),
    };
  });
  const shot = path.join(out, `${label}-dpr${dpr}.png`);
  await page.screenshot({ path: shot });
  results.push({ dpr, ...m, errors: errors.slice(0, 5), screenshot: shot });
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(out, `${label}.json`), JSON.stringify({ base, route, label, simulated: true, browser: 'chromium headless, SwiftShader', results }, null, 2));
for (const r of results) console.log(`dpr ${r.dpr}: host ${r.host} css ${r.css} buffer ${r.buffer} visible ${(r.visibleFraction * 100).toFixed(0)}% errors ${r.errors.length}`);
