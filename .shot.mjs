import { chromium } from 'playwright';
const out = process.argv[2] || '/tmp/claude-0/-home-user-isnaad/444c1c31-e4b0-51d3-85f5-feaeccdc1e0b/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: false, args: ['--headless=new', '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
await p.waitForTimeout(4000);
await p.screenshot({ path: out + '/field.png' });
// pick a node: press r to jump somewhere
await p.keyboard.press('r');
await p.waitForTimeout(3500);
await p.screenshot({ path: out + '/focus.png' });
// swap the basis to the isnād mix and let the field settle
await p.keyboard.press('Escape');
await p.getByTitle(/الطول من مزيج المتكلم/).click();
await p.waitForTimeout(2500);
await p.screenshot({ path: out + '/basis-isnad.png' });
await p.getByTitle(/شبكة الخيوط نفسها/).click();
await p.waitForTimeout(5000);
await p.screenshot({ path: out + '/basis-spectral.png' });
console.log('console errors:', errs.length ? errs.slice(0, 8) : 'none');
await b.close();
