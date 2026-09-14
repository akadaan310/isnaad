#!/usr/bin/env tsx
/* ===========================================================================
 *  ingest-gaia.ts — real astrophysics, fitted, so the universe can be deep.
 *
 *  No catalogue holds trillions of stars. Gaia DR3 is the largest ever made
 *  and holds 1.81 billion sources; the Galaxy has of order 10^11 and the
 *  observable universe perhaps 10^22. Downloading them is not the route to
 *  depth and never will be.
 *
 *  The honest route is the one astronomy itself uses: measure a real sample,
 *  fit the laws that govern the population, then generate from those laws —
 *  and keep the line between the two visible at every point. This script does
 *  the measuring and the fitting. It writes parameters, not stars:
 *
 *    1. the colour–magnitude relation      (the main sequence, binned ridge)
 *    2. the luminosity function            φ(M_G), volume-limited
 *    3. the vertical density law           n(z) ∝ exp(−|z|/h_z), fitted
 *    4. the colour–temperature relation    BP−RP → Teff, from Gaia's own GSP-Phot
 *
 *  Everything downstream that draws a star it did not observe is drawing from
 *  these four, and says so.
 *
 *  Run: npm run ingest:gaia
 * ======================================================================== */
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'sky');
const CACHE = path.join(ROOT, '.cache');
const TAP = 'https://gea.esac.esa.int/tap-server/tap';

const log = (m: string) => console.log(`   ${m}`);

// ── TAP ─────────────────────────────────────────────────────────────────────
async function tapAsync(query: string, label: string): Promise<Record<string, number>[]> {
  await mkdir(CACHE, { recursive: true });
  const cached = path.join(CACHE, `gaia-${label}.json`);
  try {
    await stat(cached);
    log(`${label}: cached`);
    return JSON.parse(await readFile(cached, 'utf8'));
  } catch {
    // fall through and fetch
  }

  log(`${label}: submitting…`);
  const body = new URLSearchParams({
    REQUEST: 'doQuery',
    LANG: 'ADQL',
    FORMAT: 'json',
    PHASE: 'RUN',
    QUERY: query,
  });
  const submit = await fetch(`${TAP}/async`, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    redirect: 'manual',
  });
  const location = submit.headers.get('location');
  if (!location) throw new Error(`${label}: no job location (${submit.status})`);
  const job = location.startsWith('http') ? location : `${TAP}${location}`;

  for (let i = 0; i < 240; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const phaseRes = await fetch(`${job}/phase`);
    const phase = (await phaseRes.text()).trim();
    if (phase === 'COMPLETED') break;
    if (phase === 'ERROR' || phase === 'ABORTED') {
      const err = await fetch(`${job}/error`).then((r) => r.text());
      throw new Error(`${label}: ${phase} — ${err.slice(0, 400)}`);
    }
    if (i % 8 === 7) log(`${label}: ${phase}…`);
  }

  const res = await fetch(`${job}/results/result`);
  const text = await res.text();
  const parsed = JSON.parse(text) as {
    metadata: { name: string }[];
    data: (number | null)[][];
  };
  const names = parsed.metadata.map((m) => m.name);
  const rows = parsed.data.map((r) => {
    const o: Record<string, number> = {};
    names.forEach((n, i) => {
      const v = r[i];
      if (v !== null && Number.isFinite(v)) o[n] = v as number;
    });
    return o;
  });
  await writeFile(cached, JSON.stringify(rows));
  log(`${label}: ${rows.length.toLocaleString()} rows`);
  return rows;
}

// ── fitting ─────────────────────────────────────────────────────────────────

/** Least squares on y = a + b·x. */
function linefit(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  if (!n) return { a: 0, b: 0, r2: 0 };
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  const b = sxx ? sxy / sxx : 0;
  return { a: my - b * mx, b, r2: sxx && syy ? (sxy * sxy) / (sxx * syy) : 0 };
}

/** Polynomial least squares, normal equations with Gaussian elimination. */
function polyfit(xs: number[], ys: number[], deg: number): number[] {
  const m = deg + 1;
  const A: number[][] = Array.from({ length: m }, () => new Array(m + 1).fill(0));
  const pow = (x: number, k: number) => Math.pow(x, k);
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
      let s = 0;
      for (let k = 0; k < xs.length; k++) s += pow(xs[k], i + j);
      A[i][j] = s;
    }
    let s = 0;
    for (let k = 0; k < xs.length; k++) s += ys[k] * pow(xs[k], i);
    A[i][m] = s;
  }
  for (let i = 0; i < m; i++) {
    let piv = i;
    for (let r = i + 1; r < m; r++) if (Math.abs(A[r][i]) > Math.abs(A[piv][i])) piv = r;
    [A[i], A[piv]] = [A[piv], A[i]];
    if (Math.abs(A[i][i]) < 1e-12) continue;
    for (let r = 0; r < m; r++) {
      if (r === i) continue;
      const f = A[r][i] / A[i][i];
      for (let c = i; c <= m; c++) A[r][c] -= f * A[i][c];
    }
  }
  return A.map((row, i) => (Math.abs(row[i]) < 1e-12 ? 0 : row[m] / row[i]));
}

const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function main() {
  console.log('\n  Gaia DR3 — measuring the population, not downloading it\n');

  // ── 1. volume-limited sample: colour–magnitude and the luminosity function
  //  Within 200 pc and with a 5σ parallax, G < 17 is complete enough for the
  //  luminosity function to mean something. Beyond that the sample is
  //  magnitude-limited and the faint end silently disappears.
  const cmd = await tapAsync(
    `SELECT TOP 400000 phot_g_mean_mag, bp_rp, parallax, l, b
       FROM gaiadr3.gaia_source
      WHERE parallax > 5 AND parallax_over_error > 20
        AND bp_rp IS NOT NULL AND phot_g_mean_mag IS NOT NULL
        AND ruwe < 1.4`,
    'volume-limited',
  );

  // ── 2. Gaia's own astrophysical parameters: colour → effective temperature
  //  Restricted to within ~200 pc. Interstellar dust reddens what it does not
  //  dim, so at a fixed *observed* colour a distant sample is systematically
  //  hotter than an intrinsic relation would be — measured at ~10% at solar
  //  colour before this cut. No extinction correction is applied; the cut is
  //  the correction.
  const teff = await tapAsync(
    `SELECT TOP 200000 bp_rp, teff_gspphot
       FROM gaiadr3.gaia_source
      WHERE teff_gspphot IS NOT NULL AND bp_rp IS NOT NULL
        AND parallax > 5 AND parallax_over_error > 20 AND ruwe < 1.4`,
    'teff-near',
  );

  // ── 3. the disc: vertical structure out to 2 kpc
  const disc = await tapAsync(
    `SELECT TOP 300000 parallax, b, phot_g_mean_mag
       FROM gaiadr3.gaia_source
      WHERE parallax > 0.5 AND parallax_over_error > 10
        AND phot_g_mean_mag < 16 AND ruwe < 1.4`,
    'disc',
  );

  // ── 4. how the population itself changes with height above the plane ─────
  //  A zone is not just a different shape of the same stars. The disc is young
  //  and blue near the plane and progressively older and redder above it, and
  //  the halo is older still. Reusing one colour distribution everywhere made
  //  all six zones come out at BP−RP 0.85 — identical, and wrong.
  //
  //  This is magnitude-limited, and deliberately so: at height, only the
  //  intrinsically bright are visible, and that IS what an observer receives.
  //  It is a selection effect being measured, not corrected away.
  const strata = await tapAsync(
    `SELECT TOP 500000 bp_rp, parallax, b, phot_g_mean_mag
       FROM gaiadr3.gaia_source
      WHERE parallax > 0.4 AND parallax_over_error > 10
        AND bp_rp IS NOT NULL AND ruwe < 1.4`,
    'strata',
  );

  console.log('');

  // ── colour–magnitude ridge ────────────────────────────────────────────────
  //  Absolute magnitude from the parallax directly: M = m + 5·log10(ϖ/1000) + 5
  //  with ϖ in mas. No extinction correction — within 200 pc it is small, and
  //  inventing one would be worse than declaring its absence.
  const cm: { c: number; M: number }[] = [];
  for (const r of cmd) {
    const M = r.phot_g_mean_mag + 5 * Math.log10(r.parallax / 1000) + 5;
    if (Number.isFinite(M) && r.bp_rp > -0.6 && r.bp_rp < 5.5 && M > -6 && M < 20) {
      cm.push({ c: r.bp_rp, M });
    }
  }
  // Median M per colour bin: the ridge of the main sequence, not a mean pulled
  // off it by giants and white dwarfs.
  const BIN = 0.1;
  const bins = new Map<number, number[]>();
  for (const p of cm) {
    const k = Math.round(p.c / BIN);
    const a = bins.get(k) ?? [];
    a.push(p.M);
    bins.set(k, a);
  }
  const ridge = [...bins.entries()]
    .filter(([, v]) => v.length >= 40)
    .map(([k, v]) => ({ colour: +(k * BIN).toFixed(3), absMag: +median(v).toFixed(3), n: v.length }))
    .sort((a, b) => a.colour - b.colour);
  const ridgeFit = polyfit(ridge.map((r) => r.colour), ridge.map((r) => r.absMag), 4);
  log(`main sequence: ${ridge.length} colour bins, ${cm.length.toLocaleString()} stars`);

  // ── luminosity function ───────────────────────────────────────────────────
  const lf = new Map<number, number>();
  for (const p of cm) {
    const k = Math.round(p.M);
    lf.set(k, (lf.get(k) ?? 0) + 1);
  }
  const lumFn = [...lf.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([M, n]) => ({ absMag: M, n }));
  const peak = lumFn.reduce((a, b) => (b.n > a.n ? b : a), lumFn[0]);
  log(`luminosity function: peak at M_G = ${peak.absMag}, ${peak.n.toLocaleString()} stars`);

  // ── colour → temperature ──────────────────────────────────────────────────
  const tc = teff
    .filter((r) => r.bp_rp > -0.5 && r.bp_rp < 5 && r.teff_gspphot > 2000 && r.teff_gspphot < 50000)
    .map((r) => ({ c: r.bp_rp, t: r.teff_gspphot }));

  //  A binned median, not a polynomial. The sample is overwhelmingly red, so a
  //  global least-squares fit is dragged toward the M dwarfs and was 43% wrong
  //  at BP−RP = 0 — where the data itself is perfectly well behaved. A table
  //  follows the measurement everywhere and cannot extrapolate into nonsense.
  const TBIN = 0.1;
  const tbins = new Map<number, number[]>();
  for (const p of tc) {
    const k = Math.round(p.c / TBIN);
    const a = tbins.get(k) ?? [];
    a.push(p.t);
    tbins.set(k, a);
  }
  const teffTable = [...tbins.entries()]
    .filter(([, v]) => v.length >= 25)
    .map(([k, v]) => ({ colour: +(k * TBIN).toFixed(2), teff: Math.round(median(v)), n: v.length }))
    .sort((a, b) => a.colour - b.colour);
  const lookup = (c: number) => {
    if (c <= teffTable[0].colour) return teffTable[0].teff;
    const last = teffTable[teffTable.length - 1];
    if (c >= last.colour) return last.teff;
    for (let i = 1; i < teffTable.length; i++) {
      if (teffTable[i].colour >= c) {
        const a = teffTable[i - 1];
        const b = teffTable[i];
        const f = (c - a.colour) / (b.colour - a.colour);
        return a.teff + (b.teff - a.teff) * f;
      }
    }
    return last.teff;
  };
  const resid = tc.slice(0, 20000).map((p) => Math.abs(lookup(p.c) - p.t) / p.t);
  log(
    `colour → temperature: ${tc.length.toLocaleString()} pairs → ${teffTable.length} bins, ` +
      `median |Δ|/T = ${(median(resid) * 100).toFixed(1)}%`,
  );

  // ── vertical scale height ─────────────────────────────────────────────────
  //  ln n(z) against |z| is a straight line whose slope is −1/h_z. Only the
  //  range where the sample is not yet distance-limited is fitted.
  const zs: number[] = [];
  for (const r of disc) {
    const d = 1000 / r.parallax; // pc
    if (d > 2000) continue;
    zs.push(Math.abs(d * Math.sin((r.b * Math.PI) / 180)));
  }
  const ZBIN = 25;
  const zhist = new Map<number, number>();
  for (const z of zs) {
    const k = Math.floor(z / ZBIN);
    zhist.set(k, (zhist.get(k) ?? 0) + 1);
  }
  const zpoints = [...zhist.entries()]
    .map(([k, n]) => ({ z: k * ZBIN + ZBIN / 2, n }))
    .filter((p) => p.z >= 50 && p.z <= 600 && p.n > 30)
    .sort((a, b) => a.z - b.z);
  const zfit = linefit(zpoints.map((p) => p.z), zpoints.map((p) => Math.log(p.n)));
  const scaleHeight = zfit.b < 0 ? -1 / zfit.b : 300;
  log(
    `vertical structure: h_z = ${scaleHeight.toFixed(0)} pc ` +
      `(r² = ${zfit.r2.toFixed(3)}, ${zs.length.toLocaleString()} stars)`,
  );

  // ── colour distribution, for generating a population that looks right ─────
  const colourHist = new Map<number, number>();
  for (const p of cm) {
    const k = Math.round(p.c / 0.2);
    colourHist.set(k, (colourHist.get(k) ?? 0) + 1);
  }
  const colours = [...colourHist.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, n]) => ({ colour: +(k * 0.2).toFixed(2), n }));

  // ── colour by height ──────────────────────────────────────────────────────
  //  Three bands, not four. The parallax cut caps the sample at ~2.5 kpc, so a
  //  band above 1200 pc caught a single star — a bin with no statistics is
  //  worse than no bin.
  const BANDS = [
    { id: 'plane', maxZ: 100 },
    { id: 'disc', maxZ: 400 },
    { id: 'upper', maxZ: 1e9 },
  ];
  const byBand = new Map<string, Map<number, number>>(BANDS.map((b) => [b.id, new Map()]));
  const bandN = new Map<string, number>(BANDS.map((b) => [b.id, 0]));
  for (const r of strata) {
    const d = 1000 / r.parallax;
    if (d > 4000) continue;
    const z = Math.abs(d * Math.sin((r.b * Math.PI) / 180));
    const band = BANDS.find((b) => z <= b.maxZ)!;
    if (r.bp_rp < -0.5 || r.bp_rp > 5) continue;
    const h = byBand.get(band.id)!;
    const k = Math.round(r.bp_rp / 0.2);
    h.set(k, (h.get(k) ?? 0) + 1);
    bandN.set(band.id, (bandN.get(band.id) ?? 0) + 1);
  }
  const strataOut = BANDS.map((b) => {
    const h = byBand.get(b.id)!;
    const bins = [...h.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([k, n]) => ({ colour: +(k * 0.2).toFixed(2), n }));
    const total = bins.reduce((s2, x) => s2 + x.n, 0) || 1;
    const mean = bins.reduce((s2, x) => s2 + x.colour * x.n, 0) / total;
    return { id: b.id, maxZPc: b.maxZ > 1e8 ? null : b.maxZ, n: total, meanColour: +mean.toFixed(3), bins };
  });
  for (const b of strataOut) {
    log(
      `|z| ≤ ${b.maxZPc ?? '∞'} pc: ${b.n.toLocaleString()} stars, ` +
        `mean BP−RP = ${b.meanColour.toFixed(3)}`,
    );
  }

  await mkdir(OUT, { recursive: true });
  const payload = {
    source: 'Gaia DR3 · gaiadr3.gaia_source · ESA TAP',
    fittedAt: new Date().toISOString(),
    samples: { colourMagnitude: cm.length, teff: tc.length, disc: zs.length },
    cuts: 'parallax_over_error > 20 (10 for the disc), ruwe < 1.4, no extinction correction',
    mainSequence: { bin: BIN, ridge, polyG: ridgeFit.map((v) => +v.toExponential(6)) },
    luminosityFunction: lumFn,
    colourDistribution: colours,
    colourToTeff: {
      form: 'binned median of teff_gspphot, linearly interpolated',
      table: teffTable,
      medianRelativeError: +median(resid).toFixed(4),
      caveat:
        'teff_gspphot is unreliable above ~9000 K, where GSP-Phot assumes low ' +
        'extinction; the hot end of this table carries that bias.',
    },
    colourByHeight: {
      note:
        'Magnitude-limited by construction: at height only the intrinsically ' +
        'bright are visible. That selection is what an observer actually ' +
        'receives, so it is measured rather than corrected away.',
      bands: strataOut,
    },
    disc: {
      form: 'n(z) ∝ exp(−|z| / h_z)',
      scaleHeightPc: +scaleHeight.toFixed(1),
      r2: +zfit.r2.toFixed(4),
      fittedRangePc: [50, 600],
    },
  };
  await writeFile(path.join(OUT, 'astrophysics.json'), JSON.stringify(payload, null, 1));
  console.log(`\n   wrote data/sky/astrophysics.json — laws, not stars\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
