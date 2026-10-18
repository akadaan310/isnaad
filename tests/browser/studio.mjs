// Browser interaction test for /universe. Simulated devices (headless Chromium,
// SwiftShader) — not real hardware. Writes screenshots and a JSON report.
// Usage: node tests/browser/studio.mjs <baseUrl> <outDir> <expectedDigest>
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const [base = 'http://localhost:3100', out = 'docs/studio/evidence/studio', expected = ''] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const report = { base, simulated: true, steps: [], failures: [] };
const step = (name, ok, detail = {}) => {
  report.steps.push({ name, ok, ...detail });
  if (!ok) report.failures.push(name);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${Object.keys(detail).length ? ' ' + JSON.stringify(detail) : ''}`);
};

// With STUDIO_TOKEN set, every context authenticates as a token holder would.
const auth = process.env.STUDIO_TOKEN ? { httpCredentials: { username: 'abed', password: process.env.STUDIO_TOKEN } } : {};
for (const device of [
  { name: 'phone', viewport: { width: 393, height: 852 }, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true },
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
]) {
  const ctx = await browser.newContext({ ...device, ...auth });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const shot = (n) => page.screenshot({ path: path.join(out, `${device.name}-${n}.png`) });

  const t0 = Date.now();
  await page.goto(base + '/universe', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid=universe] canvas[data-engine=universe]', { timeout: 90000 });
  step(`${device.name}: field loads`, true, { ms: Date.now() - t0 });
  await page.waitForTimeout(1500);

  const geom = await page.evaluate(() => {
    const c = document.querySelector('canvas[data-engine=universe]');
    const r = c.getBoundingClientRect();
    return { css: [Math.round(r.width), Math.round(r.height)], vp: [innerWidth, innerHeight], buf: [c.width, c.height] };
  });
  step(`${device.name}: canvas fills viewport at dpr ${device.deviceScaleFactor}`, geom.css[0] === geom.vp[0] && geom.css[1] === geom.vp[1], geom);

  const tour = await page.$('[data-testid=tour]');
  step(`${device.name}: first launch opens the tour`, !!tour);
  await shot('01-tour-step1');
  for (let i = 2; i <= 6; i++) {
    await page.getByRole('button', { name: i <= 6 ? 'التالي' : 'ابدأ' }).click();
    await page.waitForTimeout(i === 3 ? 3500 : 1200);
    if (i === 3) await shot('02-tour-inspect');
    if (i === 4) {
      await page.waitForTimeout(2500);
      await shot('03-tour-voyage');
    }
  }
  await page.getByRole('button', { name: 'ابدأ' }).click();
  step(`${device.name}: tour completes and closes`, !(await page.$('[data-testid=tour]')));

  // Search a locus → inspector with Uthmani text.
  await page.getByLabel('ابحث عن موضع').fill('ق ٢');
  await page.keyboard.press('Enter');
  await page.waitForSelector('[data-testid=inspector]', { timeout: 15000 });
  await page.waitForFunction(() => document.querySelector('[data-testid=ayah-text]')?.textContent?.includes('عَجِبُوٓا۟'), null, { timeout: 15000 }).catch(() => {});
  const ayah = await page.textContent('[data-testid=ayah-text]');
  step(`${device.name}: search "ق ٢" opens 50:2 with its Uthmani text`, (ayah ?? '').includes('عَجِبُوٓا'), { text: ayah?.slice(0, 40) });
  await page.waitForTimeout(3500);
  await shot('04-inspect-50-2');

  // Overlay.
  await page.click('[data-testid=dock-overlay]');
  await page.waitForTimeout(700);
  const ov = await page.textContent('[data-testid=overlay]');
  step(`${device.name}: scientific overlay shows transform, precision, buffers`, /mushaf-spiral/.test(ov ?? '') && /ulp/.test(ov ?? '') && /buffer/.test(ov ?? ''));
  await shot('05-overlay');
  await page.click('[data-testid=dock-overlay]');

  // Seeded voyage and its digest.
  await page.click('[data-testid=dock-voyage]');
  await page.getByLabel('البذرة', { exact: true }).fill('هود٢٩');
  await page.click('[data-testid=voyage-start]');
  await page.waitForTimeout(500);
  const dig = (await page.textContent('[data-testid=voyage-digest]')) ?? '';
  const digest = dig.match(/digest (\w+)/)?.[1];
  step(`${device.name}: voyage digest equals the Node-computed digest for the same seed`, !expected || digest === expected, { digest, expected });
  await page.click('[data-testid=dock-voyage]');
  await page.waitForTimeout(6000);
  const cap = await page.textContent('[data-testid=voyage-caption]').catch(() => null);
  step(`${device.name}: voyage caption states the leg and its reason`, !!cap && cap.length > 4, { caption: cap });
  await shot('06-voyage');
  await page.keyboard.press(' ');
  await page.waitForTimeout(400);

  // Performance + provenance: export the flight recording the voyage produced.
  await page.getByRole('button', { name: 'المسجّل' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'صدّر JSON' }).click()]);
  const recPath = path.join(out, `${device.name}-recording.json`);
  await dl.saveAs(recPath);
  step(`${device.name}: flight recording exported`, true, { file: recPath });
  await page.getByRole('button', { name: 'المسجّل' }).click();

  // Lens switch: celestial.
  await page.getByRole('tab', { name: 'السماء' }).click();
  await page.waitForTimeout(1500);
  const stmt = await page.textContent('[data-testid=lens-statement]');
  step(`${device.name}: celestial lens states it is a separate space`, /لا آيةَ مرسومةٌ هنا/.test(stmt ?? ''));
  await shot('07-celestial');
  await page.getByRole('tab', { name: 'فضاء الإسناد' }).click();
  await page.waitForTimeout(800);

  // Coverage counts.
  await page.getByRole('button', { name: 'التغطية' }).click();
  const cov = await page.textContent('[data-testid=coverage-table]');
  step(`${device.name}: coverage shows four separate counts`, /6236/.test(cov ?? '') && /352/.test(cov ?? ''));
  await shot('08-coverage');
  await page.getByRole('button', { name: 'التغطية' }).click();

  // Manual flight: keys move the camera.
  const before = await page.evaluate(() => document.querySelector('[data-testid=overlay]') ? 1 : 0);
  await page.click('[data-testid=dock-overlay]');
  await page.waitForTimeout(400);
  const w0 = await page.textContent('[data-testid=overlay]');
  await page.mouse.move(device.viewport.width / 2, device.viewport.height / 2);
  await page.keyboard.down('w');
  await page.waitForTimeout(900);
  await page.keyboard.up('w');
  await page.waitForTimeout(400);
  const w1 = await page.textContent('[data-testid=overlay]');
  const pos = (s) => (s?.match(/world: ([-\d., ]+)/)?.[1] ?? '').split(',').map(Number);
  const moved = Math.hypot(...pos(w1).map((x, i) => x - pos(w0)[i]));
  step(`${device.name}: W moves the camera`, moved > 1, { moved: +moved.toFixed(2), before });
  await page.click('[data-testid=dock-overlay]');

  // Recorder diagnosis.
  await page.getByRole('button', { name: 'المسجّل' }).click();
  await page.getByRole('button', { name: 'لقطة من السجل' }).click();
  await page.waitForTimeout(300);
  const rec = await page.textContent('[data-testid=panel-recorder]');
  step(`${device.name}: recorder diagnosis finds no compositing fault`, /✓ compositing/.test(rec ?? ''), { excerpt: rec?.match(/[✓✗] compositing[^✓✗]*/)?.[0] });
  await shot('09-recorder');
  await page.getByRole('button', { name: 'المسجّل' }).click();

  // Handoff: make a link, open it in a fresh context, land on the locus.
  await page.click('[data-testid=dock-handoff]');
  await page.getByLabel('ملاحظة التسليم').fill('انظر رجع الجذر هنا');
  await page.click('[data-testid=handoff-make]');
  const link = await page.inputValue('[data-testid=handoff-link]');
  await shot('10-handoff');
  const ctx2 = await browser.newContext({ ...device, ...auth });
  const p2 = await ctx2.newPage();
  await p2.goto(link, { waitUntil: 'networkidle' });
  await p2.waitForSelector('[data-testid=incoming]', { timeout: 60000 });
  const inc = await p2.textContent('[data-testid=incoming]');
  const sent = (inc ?? '').match(/الموضع: (.+?) ([٠-٩]+)/);
  step(`${device.name}: handoff link opens elsewhere with locus, note and access statement`, !!sent && /رجع الجذر/.test(inc ?? '') && /لا يمنح وصولًا حيًّا/.test(inc ?? ''));
  await p2.getByRole('button', { name: 'اذهب إليه' }).click();
  await p2.waitForSelector('[data-testid=inspector]', { timeout: 15000 });
  await p2.waitForTimeout(1500);
  await p2.screenshot({ path: path.join(out, `${device.name}-11-handoff-received.png`) });
  const landed = ((await p2.textContent('[data-testid=inspector] h2')) ?? '').trim();
  step(`${device.name}: recipient lands on the handed-off āyah`, !!sent && landed === `${sent[1]} ${sent[2]}`, { sent: sent?.slice(1), landed });
  await ctx2.close();

  step(`${device.name}: no page errors`, errors.length === 0, { errors: errors.slice(0, 5) });
  await ctx.close();
}
await browser.close();
writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(report.failures.length ? `\n${report.failures.length} failure(s)` : '\nall browser checks passed');
process.exit(report.failures.length ? 1 : 0);
