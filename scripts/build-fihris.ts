#!/usr/bin/env tsx
/* ===========================================================================
 *  build-fihris.ts — يبني الفهرس.
 *
 *  The فهرس is the machine-readable exposure of this codebase: every module,
 *  every export, every route, every data file, with the prose the source
 *  already carries about itself. It is *derived*, never hand-listed, so it
 *  cannot claim a function the tree no longer has, and cannot omit one that
 *  was added.
 *
 *  Semantics that source cannot state about itself — which layer a module
 *  belongs to, what it teaches, which invariants it stands on, the study
 *  routes, the request verbs — live in docs/fihris.meta.json and are merged
 *  in here.
 *
 *    npm run fihris          rebuild docs/fihris.json
 *    npm run fihris:check    fail if the committed فهرس has drifted
 * ======================================================================== */
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs', 'fihris.json');
const META = path.join(ROOT, 'docs', 'fihris.meta.json');

// ── the tree ────────────────────────────────────────────────────────────────

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');

// ── what a module says about itself ─────────────────────────────────────────

/** Strip comment markers line by line, so nothing joins as `// //`. */
function clean(lines: string[]): string {
  return lines
    .map((l) =>
      l
        .replace(/^\/\*+/, '')
        .replace(/\*+\/$/, '')
        .replace(/^\s*\*+\s?/, '')
        .replace(/^\s*\/\/+\s?/, '')
        .trim(),
    )
    .filter(Boolean)
    .join(' ');
}

/** The banner block at the head of a file: the module's own statement. */
function bannerOf(src: string): string | null {
  const lines = src.split('\n');
  const buf: string[] = [];
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (buf.length) break;
      continue;
    }
    if (line.startsWith('/*')) inBlock = true;
    if (inBlock || line.startsWith('//')) {
      buf.push(line);
      if (inBlock && line.includes('*/')) inBlock = false;
      continue;
    }
    break;
  }
  const text = clean(buf).replace(/[═=—─·-]{4,}/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > 12 ? text.slice(0, 500) : null;
}

/** The comment immediately above a line, which is this codebase's real doc. */
function docAbove(lines: string[], idx: number): string | undefined {
  const buf: string[] = [];
  for (let i = idx - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) break;
    if (line.startsWith('*/') || line.startsWith('*') || line.startsWith('/*') || line.startsWith('//')) {
      buf.unshift(line);
      if (line.startsWith('/*')) break;
      continue;
    }
    break;
  }
  if (!buf.length) return undefined;
  const text = clean(buf).replace(/[═=—─·-]{4,}/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, 300) : undefined;
}

interface Sym {
  name: string;
  kind: string;
  line: number;
  doc?: string;
}

const DECL =
  /^export\s+(?:declare\s+)?(const|let|var|async function\*?|function\*?|interface|type|class|enum)\s+([A-Za-z0-9_$]+)/;
const REEXPORT = /^export\s*(?:type\s*)?\{([^}]*)\}/;

function symbolsOf(src: string): Sym[] {
  const lines = src.split('\n');
  const out: Sym[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const m = DECL.exec(line);
    if (m) {
      const kind = m[1].replace('async ', '').replace('*', '');
      out.push({ name: m[2], kind: kind === 'let' || kind === 'var' ? 'const' : kind, line: i + 1, doc: docAbove(lines, i) });
      return;
    }
    const r = REEXPORT.exec(line);
    if (r) {
      for (const piece of r[1].split(',')) {
        const name = piece.trim().split(/\s+as\s+/).pop()?.trim();
        if (name) out.push({ name, kind: 're-export', line: i + 1 });
      }
      return;
    }
    if (/^export\s+default\s/.test(line)) {
      out.push({ name: 'default', kind: 'default', line: i + 1, doc: docAbove(lines, i) });
    }
  });
  return out;
}

// ── data shapes ─────────────────────────────────────────────────────────────

async function shapeOf(file: string): Promise<Record<string, unknown>> {
  const size = (await stat(file)).size;
  if (!file.endsWith('.json')) return { bytes: size, shape: 'text' };
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    if (Array.isArray(parsed)) {
      return {
        bytes: size,
        shape: 'array',
        length: parsed.length,
        row: parsed[0] && typeof parsed[0] === 'object' ? Object.keys(parsed[0] as object) : typeof parsed[0],
      };
    }
    const keys = Object.keys(parsed as object);
    return { bytes: size, shape: 'object', keys: keys.length, sample: keys.slice(0, 10) };
  } catch {
    return { bytes: size, shape: 'unparsed' };
  }
}

// ── assembly ────────────────────────────────────────────────────────────────

async function build() {
  const meta = JSON.parse(await readFile(META, 'utf8')) as {
    universe: Record<string, unknown>;
    addressing: Record<string, unknown>;
    verbs: unknown[];
    invariants: { id: string; cite: string[] }[];
    curricula: unknown[];
    modules: Record<string, { layer?: string; role?: string; teaches?: string[]; stands_on?: string[] }>;
    layers: { id: string; label: string; gloss: string }[];
    vocabularies?: Record<string, unknown>;
  };

  const codeFiles = [
    ...(await walk(path.join(ROOT, 'src'))),
    ...(await walk(path.join(ROOT, 'scripts'))),
  ].filter((f) => /\.tsx?$/.test(f));

  const modules = [] as Record<string, unknown>[];
  const routes = [] as Record<string, unknown>[];
  const pages = [] as Record<string, unknown>[];

  const sources = new Map<string, string>();

  for (const file of codeFiles) {
    const src = await readFile(file, 'utf8');
    const r = rel(file);
    sources.set(r, src);
    const syms = symbolsOf(src);
    const m = meta.modules[r] ?? {};
    const entry = {
      address: addressOf(r),
      path: r,
      lines: src.split('\n').length,
      layer: m.layer ?? defaultLayer(r),
      role: m.role ?? null,
      says: bannerOf(src),
      teaches: m.teaches ?? [],
      stands_on: m.stands_on ?? [],
      imports: [...new Set([...src.matchAll(/from\s+'(@\/[^']+|\.\.?\/[^']+)'/g)].map((x) => x[1]))].sort(),
      exports: syms,
    };
    modules.push(entry);

    if (/^src\/app\/api\/.+\/route\.ts$/.test(r)) {
      routes.push({
        address: `isnaad://api/${r.replace(/^src\/app\/api\//, '').replace(/\/route\.ts$/, '')}`,
        url: '/' + r.replace(/^src\/app\//, '').replace(/\/route\.ts$/, ''),
        path: r,
        methods: syms.filter((s) => ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].includes(s.name)).map((s) => s.name),
        says: bannerOf(src) ?? syms.find((s) => s.doc)?.doc ?? null,
        params: [...new Set([...src.matchAll(/searchParams\.get\('([^']+)'\)/g)].map((x) => x[1]))].sort(),
      });
    }
    if (/^src\/app\/.*page\.tsx$/.test(r)) {
      pages.push({
        address: `isnaad://page/${r.replace(/^src\/app\//, '').replace(/\/?page\.tsx$/, '') || ''}`,
        url: '/' + r.replace(/^src\/app\//, '').replace(/\/?page\.tsx$/, ''),
        path: r,
      });
    }
  }

  const dataFiles = (await walk(path.join(ROOT, 'data'))).filter((f) => !/\/corpus\/\d+\.txt$/.test(f));
  const data = [] as Record<string, unknown>[];
  for (const f of dataFiles) {
    data.push({ address: `isnaad://data/${rel(f).replace(/^data\//, '')}`, path: rel(f), ...(await shapeOf(f)) });
  }
  const corpusShards = (await walk(path.join(ROOT, 'data', 'corpus'))).filter((f) => /\/\d+\.txt$/.test(f));
  data.unshift({
    address: 'isnaad://data/corpus/<surah>.txt',
    path: 'data/corpus/<n>.txt',
    shape: 'sharded-text',
    shards: corpusShards.length,
    row: 'ayah:word:seg \\t form \\t class \\t features',
  });

  // ── the فهرس must not be able to lie ──────────────────────────────────────
  // Every citation and every vocabulary id is checked against the tree. A
  // claim that no longer resolves fails the build rather than shipping.
  const byPath = new Map(modules.map((m) => [m.path as string, m]));
  const complaints: string[] = [];

  const checkCite = (cite: string, owner: string) => {
    const [file, symbol] = cite.split('#');
    const mod = byPath.get(file);
    if (!mod) {
      if (!dataFiles.some((f) => rel(f) === file)) complaints.push(`${owner}: no such file ${file}`);
      return;
    }
    if (!symbol) return;
    if ((mod.exports as Sym[]).some((s) => s.name === symbol)) return;
    // Internal declarations are citable too — a heuristic worth pointing at is
    // often not exported. It must still exist.
    const declared = new RegExp(`\\b(const|let|function|interface|type|class|enum)\\s+${symbol}\\b`);
    if (!declared.test(sources.get(file) ?? '')) {
      complaints.push(`${owner}: ${file} no longer declares ${symbol}`);
    }
  };

  for (const inv of meta.invariants) {
    for (const cite of inv.cite) checkCite(cite, `invariant/${inv.id}`);
  }
  for (const [name, vocab] of Object.entries(meta.vocabularies ?? {})) {
    const v = vocab as { source: string; ids: string[] };
    const src = await readFile(path.join(ROOT, v.source), 'utf8').catch(() => '');
    if (!src) {
      complaints.push(`vocabulary/${name}: no such file ${v.source}`);
      continue;
    }
    for (const id of v.ids) {
      if (!src.includes(id)) complaints.push(`vocabulary/${name}: '${id}' is not in ${v.source}`);
    }
  }
  for (const declared of Object.keys(meta.modules)) {
    if (!byPath.has(declared)) complaints.push(`modules: ${declared} is annotated but no longer exists`);
  }
  const unclassified = modules.filter((m) => m.layer === 'unclassified' && /^src\/lib\/|^scripts\//.test(m.path as string));
  for (const m of unclassified) complaints.push(`modules: ${m.path} has no layer in docs/fihris.meta.json`);

  if (complaints.length) {
    console.error('\n  الفهرس يدّعي ما ليس في الشجرة — the فهرس claims what the tree does not hold:\n');
    for (const c of complaints) console.error(`    · ${c}`);
    console.error('');
    process.exit(1);
  }

  const manifest = JSON.parse(await readFile(path.join(ROOT, 'data', 'index', 'manifest.json'), 'utf8'));
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));

  return {
    protocol: 'fihris/1.0',
    generated_by: 'scripts/build-fihris.ts',
    generated_from: 'the source tree, not by hand',
    universe: { ...meta.universe, package: pkg.name, version: pkg.version },
    corpus: manifest,
    addressing: meta.addressing,
    verbs: meta.verbs,
    invariants: meta.invariants,
    layers: meta.layers,
    curricula: meta.curricula,
    vocabularies: meta.vocabularies ?? {},
    commands: pkg.scripts,
    dependencies: pkg.dependencies,
    counts: {
      modules: modules.length,
      exports: modules.reduce((n, m) => n + (m.exports as unknown[]).length, 0),
      routes: routes.length,
      pages: pages.length,
      data_files: data.length,
      code_lines: modules.reduce((n, m) => n + (m.lines as number), 0),
    },
    routes,
    pages,
    data,
    modules,
  };
}

/** Surfaces and routes are classified by where they live; libraries are not. */
function defaultLayer(r: string): string {
  if (r.startsWith('src/components/')) return 'mashhad';
  if (/^src\/app\/api\//.test(r)) return 'khidma';
  if (r.startsWith('src/app/')) return 'mashhad';
  return 'unclassified';
}

function addressOf(r: string): string {
  if (r.startsWith('src/lib/engine/')) return `isnaad://engine/${path.basename(r).replace(/\.tsx?$/, '')}`;
  if (r.startsWith('src/lib/')) return `isnaad://module/${r.replace('src/lib/', '').replace(/\.tsx?$/, '')}`;
  if (r.startsWith('src/components/')) return `isnaad://surface/${r.replace('src/components/', '').replace(/\.tsx?$/, '')}`;
  if (r.startsWith('scripts/')) return `isnaad://script/${path.basename(r).replace(/\.ts$/, '')}`;
  return `isnaad://app/${r.replace('src/app/', '').replace(/\.tsx?$/, '')}`;
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';

async function main() {
  const built = await build();
  if (process.argv.includes('--check')) {
    const current = await readFile(OUT, 'utf8').catch(() => '');
    if (current !== json(built)) {
      console.error('\n  الفهرس قد تخلّف — the فهرس has drifted from the tree. Run: npm run fihris\n');
      process.exit(1);
    }
    console.log(
      `\n  الفهرس مطابق — ${built.counts.modules} modules, ${built.counts.exports} exports, in step with the tree.\n`,
    );
    return;
  }
  await writeFile(OUT, json(built));
  console.log(
    `\n  docs/fihris.json — ${built.counts.modules} modules · ${built.counts.exports} exports · ` +
      `${built.counts.routes} routes · ${built.counts.data_files} data files · ${built.counts.code_lines} lines\n`,
  );
}

void main();
