'use client';
// ============================================================================
//  المشهد — the cosmos, in WebGL.
//
//  Two shells and a graph:
//
//    the far sky      5,044 real stars and the 89 figures, at radius 900
//    the inner field  1,000 āyāt, each placed where its isnād puts it —
//                     direction is its برج realm, radius is discourse distance,
//                     so flying inward is literally moving toward المخاطب
//    السنابل          seven branches from whichever grain you are on (2:261)
//
//  The camera POV is the isnād. المتكلم seats you *at* the āyah looking out;
//  المخاطب puts it in front of you, addressing you; الغائب watches from
//  outside, orbiting. Same space, three ways of standing in it.
//
//  Arabic is drawn as DOM positioned from projected 3D, not as WebGL text:
//  Arabic needs real shaping, and a texture atlas would break the joins.
//  Labels are recycled from a pool and moved imperatively, never through
//  React state, so a thousand nodes do not cost a thousand re-renders.
// ============================================================================
import * as React from 'react';
import * as THREE from 'three';
import type { CosmosNode, SkyPayload } from '@/lib/cosmos';
import type { SelectedRibat, SelectedStrand, StrandKind } from '@/lib/cosmos/strands';
import { ribatSegment } from '@/lib/cosmos/strands';
import { RADIAL_BASE, radiusOf, type Vec3 } from '@/lib/cosmos/placement';

export type Pov = 'mutakallim' | 'mukhatab' | 'ghaib' | 'free';

const PERSON_COLOR: Record<number, THREE.Color> = {
  1: new THREE.Color('#D97706'),
  2: new THREE.Color('#059669'),
  3: new THREE.Color('#0284C7'),
};
const NEUTRAL = new THREE.Color('#94A3B8');

/**
 * One hue per strand family, chosen away from the three person colours so a
 * line never reads as an attribution. A viewer must be able to tell what kind
 * of computation put a line on the screen before knowing anything else.
 */
const STRAND_COLOR: Record<StrandKind, THREE.Color> = {
  sunbula: new THREE.Color('#C8A45C'),
  motif: new THREE.Color('#A78BFA'),
  root: new THREE.Color('#FB7185'),
  discovery: new THREE.Color('#E2E8F0'),
  resonance: new THREE.Color('#FDE68A'),
};

/** Ceilings, not targets. The field stays sparse; see selectStrands. */
const MAX_STRANDS = 640;
const MAX_RIBAT = 64;

/**
 * Samples along each strand's curve. A relation is drawn as a quadratic Bézier
 * rather than a chord, and the control point is not a styling choice: it sits
 * on the shell of the two endpoints' *mean discourse distance*.
 *
 * That comes out exactly, with no extra data. السُّلَّم rescales radius
 * affinely — `ladder(r) = 18 + (r−18)k` — so the mean of two laddered radii is
 * the laddered mean, and the mean of two radii is `radiusOf((dA+dB)/2)`. The
 * height of every arc is therefore the proximity axis itself, and a strand
 * between two near āyāt rides close in while one spanning the axis bows out.
 */
const CURVE_SAMPLES = 16;
const CURVE_VERTS = (CURVE_SAMPLES - 1) * 2;

const STRAND_VERT = /* glsl */ `
  attribute float u;      // 0…1 along the curve
  attribute float born;   // when this strand entered the selection
  attribute float seed;
  attribute vec3 tint;
  varying float vAlpha;
  varying vec3 vTint;
  uniform float uTime;

  void main() {
    // Self-forming: the curve draws itself from one āyah to the other on a
    // damped spring — it overshoots and settles, which is a real second-order
    // response, not an eased fade. The spring is on the *growth front* only.
    // It is deliberately not on the arc height: that height is a measured
    // quantity, and a bow that wobbled would be asserting a distance the text
    // does not have, for as long as the wobble lasted.
    float age = max(0.0, uTime - born);
    float g = clamp(1.0 - exp(-6.0 * age) * cos(9.0 * age), 0.0, 1.0);
    float head = smoothstep(g, g - 0.11, u);

    // A travelling pulse, seeded per strand so the field does not throb in
    // unison. It marks direction of travel and nothing else.
    float pulse = exp(-pow((fract(uTime * 0.19 + seed) - u) * 7.0, 2.0));

    vAlpha = head * (0.5 + pulse * 1.5);
    vTint = tint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STRAND_FRAG = /* glsl */ `
  precision mediump float;
  varying float vAlpha;
  varying vec3 vTint;
  void main() {
    // Additive, so colour is premultiplied by alpha rather than blended.
    gl_FragColor = vec4(vTint * vAlpha, 1.0);
  }
`;

/**
 * Sample a quadratic Bézier into a LineSegments pair list.
 * `out` receives (CURVE_SAMPLES − 1) × 2 vertices starting at `at`.
 */
function curveInto(
  out: Float32Array,
  at: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
) {
  // Control point: the chord's midpoint pushed out to the mean of the two
  // radii — the shell of their mean discourse distance.
  const mx = (ax + bx) * 0.5;
  const my = (ay + by) * 0.5;
  const mz = (az + bz) * 0.5;
  const ml = Math.hypot(mx, my, mz);
  const want = (Math.hypot(ax, ay, az) + Math.hypot(bx, by, bz)) * 0.5;
  // Two āyāt on opposite rays have a midpoint at the origin and no direction to
  // push along; the chord is then already the honest line between them.
  const k = ml > 1e-4 ? want / ml : 1;
  const cx = mx * k;
  const cy = my * k;
  const cz = mz * k;

  let px = ax;
  let py = ay;
  let pz = az;
  for (let i = 1; i < CURVE_SAMPLES; i++) {
    const t = i / (CURVE_SAMPLES - 1);
    const n = 1 - t;
    const w0 = n * n;
    const w1 = 2 * n * t;
    const w2 = t * t;
    const qx = w0 * ax + w1 * cx + w2 * bx;
    const qy = w0 * ay + w1 * cy + w2 * by;
    const qz = w0 * az + w1 * cz + w2 * bz;
    const o = at + (i - 1) * 6;
    out[o] = px;
    out[o + 1] = py;
    out[o + 2] = pz;
    out[o + 3] = qx;
    out[o + 4] = qy;
    out[o + 5] = qz;
    px = qx;
    py = qy;
    pz = qz;
  }
}

/** `u` runs 0→1 along a strand and never changes; written once per slot. */
function fillCurveU(u: Float32Array, slots: number) {
  for (let s = 0; s < slots; s++) {
    for (let i = 1; i < CURVE_SAMPLES; i++) {
      const o = s * CURVE_VERTS + (i - 1) * 2;
      u[o] = (i - 1) / (CURVE_SAMPLES - 1);
      u[o + 1] = i / (CURVE_SAMPLES - 1);
    }
  }
}

/** Deterministic per-strand phase, so the pulses do not march in step. */
function hashSeed(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const RAD = Math.PI / 180;
const SKY_R = 900;

function dominant(v: [number, number, number]): number {
  const m = Math.max(v[0], v[1], v[2]);
  if (m <= 0) return 0;
  return m === v[0] ? 1 : m === v[1] ? 2 : 3;
}

/** RA/Dec in degrees → a point on the far shell. */
function radec(ra: number, dec: number, r = SKY_R): THREE.Vector3 {
  const a = ra * RAD;
  const d = dec * RAD;
  return new THREE.Vector3(r * Math.cos(d) * Math.cos(a), r * Math.sin(d), r * Math.cos(d) * Math.sin(a));
}

const NODE_VERT = /* glsl */ `
  attribute float size;
  attribute vec3 tint;
  attribute float dim;
  varying vec3 vTint;
  varying float vDim;
  uniform float uScale;
  void main() {
    vTint = tint;
    vDim = dim;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Perspective sizing, floored so distant āyāt stay findable rather than
    // vanishing: the far ones are the point of the far ones. The floor is
    // generous because a thousand grains at two pixels reads as empty space.
    gl_PointSize = clamp(size * uScale / max(1.0, -mv.z) * 170.0, 3.5, 90.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAG = /* glsl */ `
  varying vec3 vTint;
  varying float vDim;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    // A hot core inside a soft falloff, so a node reads as light.
    float core = smoothstep(0.5, 0.0, d);
    float halo = smoothstep(0.5, 0.14, d);
    vec3 c = mix(vTint, vec3(1.0), core * core * 0.75);
    gl_FragColor = vec4(c, (halo * 0.5 + core * core * 0.85) * vDim);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float mag;
  varying float vB;
  void main() {
    // Magnitude runs bright-to-faint downward; −1.4 is Sirius, 6 the naked eye.
    vB = clamp((6.2 - mag) / 7.6, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(1.3, 1.3 + vB * vB * 7.5);
    gl_Position = projectionMatrix * mv;
  }
`;

const STAR_FRAG = /* glsl */ `
  varying float vB;
  uniform float uBurn;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * (0.22 + vB * 1.25) * uBurn;
    gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), a);
  }
`;

export interface SceneHandle {
  flyTo: (index: number) => void;
}

export function CosmosScene({
  nodes,
  sky,
  focus,
  pov,
  sullam,
  burn,
  visible,
  showFigures,
  strands,
  ribat,
  basis,
  basisBlend,
  onPick,
  sceneRef,
}: {
  nodes: CosmosNode[];
  sky: SkyPayload | null;
  focus: number | null;
  pov: Pov;
  /** السُّلَّم — the ladder: exaggerates or compresses discourse distance. */
  sullam: number;
  /** السِّراج — how hard the field burns. */
  burn: number;
  /** Indices the current time route admits, or null for all. */
  visible: Set<number> | null;
  showFigures: boolean;
  /** Already selected — the scene draws what it is handed and never filters. */
  strands: SelectedStrand[];
  ribat: SelectedRibat[];
  /**
   * Candidate directions from a derived basis, or null to stand on the برج
   * placement the field was ingested with. Radius is never touched: it is
   * discourse distance under every basis.
   */
  basis: Vec3[] | null;
  /** 0 keeps the placement in use, 1 stands fully on the derived basis. */
  basisBlend: number;
  onPick: (index: number) => void;
  sceneRef?: React.MutableRefObject<SceneHandle | null>;
}) {
  const mount = React.useRef<HTMLDivElement>(null);
  const labelHost = React.useRef<HTMLDivElement>(null);

  // Everything the animation loop needs, without re-creating the scene.
  const live = React.useRef({
    focus, pov, sullam, burn, visible, showFigures, strands, ribat, basis, basisBlend, onPick, nodes,
  });
  live.current = {
    focus, pov, sullam, burn, visible, showFigures, strands, ribat, basis, basisBlend, onPick, nodes,
  };

  React.useEffect(() => {
    const host = mount.current;
    if (!host || !nodes.length) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x0b1120, 1);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1120, 0.0016);
    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 4000);
    camera.position.set(0, 14, 165);

    // ── the far sky ─────────────────────────────────────────────────────────
    let starPoints: THREE.Points | null = null;
    let figureLines: THREE.LineSegments | null = null;
    if (sky) {
      const g = new THREE.BufferGeometry();
      const pos = new Float32Array(sky.stars.length * 3);
      const mag = new Float32Array(sky.stars.length);
      sky.stars.forEach(([ra, dec, m], i) => {
        const v = radec(ra, dec);
        pos[i * 3] = v.x;
        pos[i * 3 + 1] = v.y;
        pos[i * 3 + 2] = v.z;
        mag[i] = m;
      });
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
      starPoints = new THREE.Points(
        g,
        new THREE.ShaderMaterial({
          vertexShader: STAR_VERT,
          fragmentShader: STAR_FRAG,
          uniforms: { uBurn: { value: 1 } },
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      scene.add(starPoints);

      const seg: number[] = [];
      for (const con of sky.constellations) {
        for (const line of con.lines) {
          for (let i = 0; i + 1 < line.length; i++) {
            const a = radec(line[i][0], line[i][1], SKY_R - 8);
            const b = radec(line[i + 1][0], line[i + 1][1], SKY_R - 8);
            seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
          }
        }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      figureLines = new THREE.LineSegments(
        lg,
        new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.22, depthWrite: false }),
      );
      scene.add(figureLines);
    }

    // ── the āyah field ──────────────────────────────────────────────────────
    const N = nodes.length;
    const basePos = new Float32Array(N * 3);
    const nodePos = new Float32Array(N * 3);
    const tint = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const dimAttr = new Float32Array(N);

    nodes.forEach((n, i) => {
      basePos[i * 3] = n.p[0];
      basePos[i * 3 + 1] = n.p[1];
      basePos[i * 3 + 2] = n.p[2];
      const c = PERSON_COLOR[dominant(n.v)] ?? NEUTRAL;
      tint[i * 3] = c.r;
      tint[i * 3 + 1] = c.g;
      tint[i * 3 + 2] = c.b;
      // A node with a finding in it is a brighter grain.
      size[i] = 0.9 + (n.k ? 0.55 : 0) + n.tn * 0.7;
      dimAttr[i] = 1;
    });
    nodePos.set(basePos);

    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    ng.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    ng.setAttribute('size', new THREE.BufferAttribute(size, 1));
    ng.setAttribute('dim', new THREE.BufferAttribute(dimAttr, 1));
    const nodeMat = new THREE.ShaderMaterial({
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nodePoints = new THREE.Points(ng, nodeMat);
    scene.add(nodePoints);

    // ── السنابل — seven branches from the grain you are on ──────────────────
    const branchGeo = new THREE.BufferGeometry();
    branchGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(7 * 2 * 3), 3));
    const branchLines = new THREE.LineSegments(
      branchGeo,
      new THREE.LineBasicMaterial({ color: 0xc8a45c, transparent: true, opacity: 0.55, depthWrite: false }),
    );
    scene.add(branchLines);

    // ── الخيوط — one layer for every family of computed relation ────────────
    //
    //  A single LineSegments, rewritten each frame from the live node
    //  positions so that السُّلَّم moves the strands with the field. Colour is
    //  the family; brightness is prominence, premultiplied because additive
    //  blending has no per-vertex alpha of its own.
    const strandGeo = new THREE.BufferGeometry();
    const strandPos = new Float32Array(MAX_STRANDS * CURVE_VERTS * 3);
    const strandTint = new Float32Array(MAX_STRANDS * CURVE_VERTS * 3);
    const strandU = new Float32Array(MAX_STRANDS * CURVE_VERTS);
    const strandBorn = new Float32Array(MAX_STRANDS * CURVE_VERTS);
    const strandSeed = new Float32Array(MAX_STRANDS * CURVE_VERTS);
    fillCurveU(strandU, MAX_STRANDS);
    strandGeo.setAttribute('position', new THREE.BufferAttribute(strandPos, 3));
    strandGeo.setAttribute('tint', new THREE.BufferAttribute(strandTint, 3));
    strandGeo.setAttribute('u', new THREE.BufferAttribute(strandU, 1));
    strandGeo.setAttribute('born', new THREE.BufferAttribute(strandBorn, 1));
    strandGeo.setAttribute('seed', new THREE.BufferAttribute(strandSeed, 1));
    const strandMat = new THREE.ShaderMaterial({
      vertexShader: STRAND_VERT,
      fragmentShader: STRAND_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const strandLines = new THREE.LineSegments(strandGeo, strandMat);
    scene.add(strandLines);

    // When a strand entered the selection. A relation that survives a change of
    // focus keeps its birth time and so keeps its drawn form: only genuinely
    // new relations grow, which is what makes the growth mean something.
    const bornAt = new Map<string, number>();

    // ── رِباط — حركة المحور, drawn as the movement it measures ───────────────
    //
    //  Each segment runs between the two person shells along the āyah's own
    //  ray (or between the two āyāt where both are placed), and is coloured
    //  from the person the attribution left to the person it arrived at. The
    //  gradient is the direction: nothing else is needed to read it.
    const ribatGeo = new THREE.BufferGeometry();
    const ribatPos = new Float32Array(MAX_RIBAT * CURVE_VERTS * 3);
    const ribatTint = new Float32Array(MAX_RIBAT * CURVE_VERTS * 3);
    const ribatU = new Float32Array(MAX_RIBAT * CURVE_VERTS);
    const ribatBorn = new Float32Array(MAX_RIBAT * CURVE_VERTS);
    const ribatSeed = new Float32Array(MAX_RIBAT * CURVE_VERTS);
    fillCurveU(ribatU, MAX_RIBAT);
    ribatGeo.setAttribute('position', new THREE.BufferAttribute(ribatPos, 3));
    ribatGeo.setAttribute('tint', new THREE.BufferAttribute(ribatTint, 3));
    ribatGeo.setAttribute('u', new THREE.BufferAttribute(ribatU, 1));
    ribatGeo.setAttribute('born', new THREE.BufferAttribute(ribatBorn, 1));
    ribatGeo.setAttribute('seed', new THREE.BufferAttribute(ribatSeed, 1));
    const ribatMat = new THREE.ShaderMaterial({
      vertexShader: STRAND_VERT,
      fragmentShader: STRAND_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const ribatLines = new THREE.LineSegments(ribatGeo, ribatMat);
    scene.add(ribatLines);

    /** Six floats of working space for a رِباط segment's two ends. */
    const scratch = new Float32Array(6);

    /** The سُلَّم transform, so strand ends track the field they connect. */
    const ladder = (x: number, y: number, z: number, k: number, out: Float32Array, at: number) => {
      const r = Math.hypot(x, y, z) || 1;
      const f = (RADIAL_BASE + (r - RADIAL_BASE) * k) / r;
      out[at] = x * f;
      out[at + 1] = y * f;
      out[at + 2] = z * f;
    };

    // ── label pool ──────────────────────────────────────────────────────────
    const MAX_LABELS = 26;
    const labels: HTMLDivElement[] = [];
    if (labelHost.current) {
      labelHost.current.innerHTML = '';
      for (let i = 0; i < MAX_LABELS; i++) {
        const el = document.createElement('div');
        el.className = 'cosmos-label';
        el.style.display = 'none';
        labelHost.current.appendChild(el);
        labels.push(el);
      }
    }

    // ── input ───────────────────────────────────────────────────────────────
    const keys = new Set<string>();
    const drag = { on: false, x: 0, y: 0 };
    const look = { yaw: 0, pitch: 0 };
    let speed = 26;
    const vel = new THREE.Vector3();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      keys.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onDown = (e: PointerEvent) => {
      drag.on = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onUp = () => (drag.on = false);
    const onMove = (e: PointerEvent) => {
      if (!drag.on) return;
      look.yaw -= (e.clientX - drag.x) * 0.0032;
      look.pitch -= (e.clientY - drag.y) * 0.0032;
      look.pitch = Math.max(-1.45, Math.min(1.45, look.pitch));
      drag.x = e.clientX;
      drag.y = e.clientY;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      speed = Math.max(4, Math.min(220, speed * (e.deltaY > 0 ? 1.14 : 0.88)));
    };

    // Click picks the nearest projected node, which is far cheaper and far more
    // forgiving than raycasting point sprites.
    const onClick = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let best = -1;
      let bestD = 34 * 34;
      const v = new THREE.Vector3();
      const vis = live.current.visible;
      for (let i = 0; i < N; i++) {
        if (vis && !vis.has(i)) continue;
        v.set(nodePos[i * 3], nodePos[i * 3 + 1], nodePos[i * 3 + 2]).project(camera);
        if (v.z > 1) continue;
        const sx = ((v.x + 1) / 2) * rect.width;
        const sy = ((1 - v.y) / 2) * rect.height;
        const d = (sx - mx) ** 2 + (sy - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best >= 0) live.current.onPick(best);
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    renderer.domElement.addEventListener('click', onClick);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // ── camera targets ──────────────────────────────────────────────────────
    const flyTarget = new THREE.Vector3();
    let flying = false;
    const tmp = new THREE.Vector3();
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();

    const flyTo = (index: number) => {
      const n = live.current.nodes[index];
      if (!n) return;
      flyTarget.set(nodePos[index * 3], nodePos[index * 3 + 1], nodePos[index * 3 + 2]);
      flying = true;
    };
    if (sceneRef) sceneRef.current = { flyTo };

    const resize = () => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ── loop ────────────────────────────────────────────────────────────────
    let raf = 0;
    let t = 0;
    let lastSullam = -1;
    let lastBlend = 0;
    let lastBasis: Vec3[] | null = null;
    const clock = new THREE.Clock();

    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());
      t += dt;
      const S = live.current;

      // السُّلَّم rescales the radius axis: climbing pushes الغيبة outward and
      // draws المناجاة in, so the ladder is a lens on the same space.
      //
      // The basis decides direction only. Blending it in eases the field from
      // the برج placement toward one derived from what the engine computed,
      // so the two can be held against each other rather than swapped.
      const blend = S.basis ? S.basisBlend : 0;
      if (blend !== lastBlend || S.basis !== lastBasis) {
        lastBlend = blend;
        lastBasis = S.basis;
        lastSullam = -1;
        for (let i = 0; i < N; i++) {
          const n = S.nodes[i];
          if (!S.basis || blend <= 0) {
            basePos[i * 3] = n.p[0];
            basePos[i * 3 + 1] = n.p[1];
            basePos[i * 3 + 2] = n.p[2];
            continue;
          }
          const r0 = Math.hypot(n.p[0], n.p[1], n.p[2]) || 1;
          const b = S.basis[i];
          // Blend the two directions, then restore the radius: discourse
          // distance must survive the morph untouched.
          let dx = (n.p[0] / r0) * (1 - blend) + b[0] * blend;
          let dy = (n.p[1] / r0) * (1 - blend) + b[1] * blend;
          let dz = (n.p[2] / r0) * (1 - blend) + b[2] * blend;
          const m = Math.hypot(dx, dy, dz) || 1;
          dx /= m;
          dy /= m;
          dz /= m;
          const r = radiusOf(n.d);
          basePos[i * 3] = dx * r;
          basePos[i * 3 + 1] = dy * r;
          basePos[i * 3 + 2] = dz * r;
        }
      }

      if (S.sullam !== lastSullam) {
        lastSullam = S.sullam;
        for (let i = 0; i < N; i++) {
          const bx = basePos[i * 3];
          const by = basePos[i * 3 + 1];
          const bz = basePos[i * 3 + 2];
          const r = Math.hypot(bx, by, bz) || 1;
          const nr = RADIAL_BASE + (r - RADIAL_BASE) * S.sullam;
          const k = nr / r;
          nodePos[i * 3] = bx * k;
          nodePos[i * 3 + 1] = by * k;
          nodePos[i * 3 + 2] = bz * k;
        }
        ng.attributes.position.needsUpdate = true;
      }

      // Route filtering dims rather than hides, so the shape of the whole
      // field stays legible while a route is programmed.
      const vis = S.visible;
      for (let i = 0; i < N; i++) dimAttr[i] = !vis || vis.has(i) ? 1 : 0.07;
      if (S.focus !== null) dimAttr[S.focus] = 1;
      ng.attributes.dim.needsUpdate = true;

      nodeMat.uniforms.uScale.value = 0.55 + S.burn * 0.85;
      if (starPoints) (starPoints.material as THREE.ShaderMaterial).uniforms.uBurn.value = 0.35 + S.burn * 0.9;
      if (figureLines) figureLines.visible = S.showFigures;

      // ── camera ────────────────────────────────────────────────────────────
      const focusNode = S.focus !== null ? S.focus : null;
      if (focusNode !== null && S.pov !== 'free') {
        tmp.set(nodePos[focusNode * 3], nodePos[focusNode * 3 + 1], nodePos[focusNode * 3 + 2]);
        const out = tmp.clone().normalize();
        let want: THREE.Vector3;
        if (S.pov === 'mutakallim') {
          // You are where it speaks from: sit at the āyah, look outward.
          want = tmp.clone().addScaledVector(out, -1.5);
        } else if (S.pov === 'mukhatab') {
          // It addresses you: stand close in front of it.
          want = tmp.clone().addScaledVector(out, -13);
        } else {
          // Observed from outside, slowly circling.
          const ang = t * 0.14;
          want = tmp
            .clone()
            .addScaledVector(out, 30)
            .add(new THREE.Vector3(Math.cos(ang) * 22, 8, Math.sin(ang) * 22));
        }
        camera.position.lerp(want, 1 - Math.pow(0.004, dt));
        const lookAt = S.pov === 'mutakallim' ? tmp.clone().addScaledVector(out, 60) : tmp;
        const m = new THREE.Matrix4().lookAt(camera.position, lookAt, camera.up);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        camera.quaternion.slerp(q, 1 - Math.pow(0.005, dt));
        look.yaw = Math.atan2(-camera.getWorldDirection(fwd).x, -fwd.z);
        look.pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
      } else {
        if (flying) {
          const want = flyTarget.clone().addScaledVector(flyTarget.clone().normalize(), -16);
          camera.position.lerp(want, 1 - Math.pow(0.02, dt));
          if (camera.position.distanceTo(want) < 1.2) flying = false;
        }
        camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw, 0, 'YXZ'));

        camera.getWorldDirection(fwd);
        right.crossVectors(fwd, camera.up).normalize();
        const acc = new THREE.Vector3();
        if (keys.has('w') || keys.has('arrowup')) acc.add(fwd);
        if (keys.has('s') || keys.has('arrowdown')) acc.sub(fwd);
        if (keys.has('a') || keys.has('arrowleft')) acc.sub(right);
        if (keys.has('d') || keys.has('arrowright')) acc.add(right);
        if (keys.has('q')) acc.y -= 1;
        if (keys.has('e')) acc.y += 1;
        if (acc.lengthSq() > 0) {
          acc.normalize().multiplyScalar(speed * dt * 3);
          vel.add(acc);
          flying = false;
        }
        vel.multiplyScalar(Math.pow(0.02, dt));
        camera.position.add(vel.clone().multiplyScalar(dt * 6));
      }

      // ── السنابل ───────────────────────────────────────────────────────────
      const bp = branchGeo.attributes.position.array as Float32Array;
      if (focusNode !== null) {
        const n = S.nodes[focusNode];
        const ax = nodePos[focusNode * 3];
        const ay = nodePos[focusNode * 3 + 1];
        const az = nodePos[focusNode * 3 + 2];
        n.sb.forEach((j, k) => {
          bp[k * 6] = ax;
          bp[k * 6 + 1] = ay;
          bp[k * 6 + 2] = az;
          bp[k * 6 + 3] = nodePos[j * 3];
          bp[k * 6 + 4] = nodePos[j * 3 + 1];
          bp[k * 6 + 5] = nodePos[j * 3 + 2];
        });
        branchLines.visible = true;
      } else {
        branchLines.visible = false;
      }
      branchGeo.attributes.position.needsUpdate = true;

      // ── الخيوط ────────────────────────────────────────────────────────────
      strandMat.uniforms.uTime.value = t;
      ribatMat.uniforms.uTime.value = t;
      const alive = new Set<string>();
      const drawn = Math.min(S.strands.length, MAX_STRANDS);
      for (let k = 0; k < drawn; k++) {
        const st = S.strands[k];
        alive.add(st.id);
        let birth = bornAt.get(st.id);
        if (birth === undefined) {
          birth = t;
          bornAt.set(st.id, birth);
        }
        curveInto(
          strandPos,
          k * CURVE_VERTS * 3,
          nodePos[st.a * 3], nodePos[st.a * 3 + 1], nodePos[st.a * 3 + 2],
          nodePos[st.b * 3], nodePos[st.b * 3 + 1], nodePos[st.b * 3 + 2],
        );
        const c = STRAND_COLOR[st.kind] ?? NEUTRAL;
        // Additive blending is unforgiving: the ambient field has to stay
        // near-subliminal so that the neighbourhood of the focused āyah is
        // what the eye actually resolves.
        const near = S.focus !== null && (st.a === S.focus || st.b === S.focus);
        const g = (0.02 + st.prominence * 0.16) * (0.4 + S.burn * 0.6) * (near ? 3.4 : 1);
        const seed = hashSeed(st.id);
        for (let e = 0; e < CURVE_VERTS; e++) {
          const vo = (k * CURVE_VERTS + e) * 3;
          strandTint[vo] = c.r * g;
          strandTint[vo + 1] = c.g * g;
          strandTint[vo + 2] = c.b * g;
          strandBorn[k * CURVE_VERTS + e] = birth;
          strandSeed[k * CURVE_VERTS + e] = seed;
        }
      }
      // A strand that left the selection forgets when it was born, so coming
      // back is a new arrival and draws itself again.
      if (bornAt.size > MAX_STRANDS * 2) {
        for (const id of bornAt.keys()) if (!alive.has(id)) bornAt.delete(id);
      }
      strandGeo.setDrawRange(0, drawn * CURVE_VERTS);
      strandGeo.attributes.position.needsUpdate = true;
      strandGeo.attributes.tint.needsUpdate = true;
      strandGeo.attributes.born.needsUpdate = true;
      strandGeo.attributes.seed.needsUpdate = true;

      // ── رِباط ─────────────────────────────────────────────────────────────
      const rDrawn = Math.min(S.ribat.length, MAX_RIBAT);
      for (let k = 0; k < rDrawn; k++) {
        const v = S.ribat[k];
        const base = k * CURVE_VERTS * 3;
        let hx: number, hy: number, hz: number, tx: number, ty: number, tz: number;
        if (v.to !== null) {
          // Both āyāt are placed: the movement is a real trajectory, so it is
          // read straight off the live positions.
          hx = nodePos[v.node * 3];
          hy = nodePos[v.node * 3 + 1];
          hz = nodePos[v.node * 3 + 2];
          tx = nodePos[v.to * 3];
          ty = nodePos[v.to * 3 + 1];
          tz = nodePos[v.to * 3 + 2];
        } else {
          // Both ends lie on the āyah's own ray, so the control point falls on
          // that ray too and the curve stays exactly radial — the extent is
          // still |حركة المحور| to the last decimal.
          const { head, tail } = ribatSegment(v, S.nodes);
          ladder(head[0], head[1], head[2], S.sullam, scratch, 0);
          ladder(tail[0], tail[1], tail[2], S.sullam, scratch, 3);
          hx = scratch[0];
          hy = scratch[1];
          hz = scratch[2];
          tx = scratch[3];
          ty = scratch[4];
          tz = scratch[5];
        }
        curveInto(ribatPos, base, hx, hy, hz, tx, ty, tz);

        const from = PERSON_COLOR[v.from] ?? NEUTRAL;
        const to = PERSON_COLOR[v.toPerson] ?? NEUTRAL;
        // Damped like the strands, and under the same السِّراج control. A
        // displacement is worth noticing, but forty-eight of them at full
        // brightness drown out the field they are meant to be movements in.
        const nearR = S.focus !== null && (v.node === S.focus || v.to === S.focus);
        const g = (0.06 + v.prominence * 0.2) * (0.4 + S.burn * 0.6) * (nearR ? 3.6 : 1);
        let birth = bornAt.get(v.id);
        if (birth === undefined) {
          birth = t;
          bornAt.set(v.id, birth);
        }
        const seed = hashSeed(v.id);
        // The gradient runs departing person → arriving person along the
        // curve's own parameter, so the colour change *is* the displacement.
        for (let e = 0; e < CURVE_VERTS; e++) {
          const f = ribatU[k * CURVE_VERTS + e];
          const vo = base + e * 3;
          ribatTint[vo] = (from.r + (to.r - from.r) * f) * g;
          ribatTint[vo + 1] = (from.g + (to.g - from.g) * f) * g;
          ribatTint[vo + 2] = (from.b + (to.b - from.b) * f) * g;
          ribatBorn[k * CURVE_VERTS + e] = birth;
          ribatSeed[k * CURVE_VERTS + e] = seed;
        }
      }
      ribatGeo.setDrawRange(0, rDrawn * CURVE_VERTS);
      ribatGeo.attributes.position.needsUpdate = true;
      ribatGeo.attributes.tint.needsUpdate = true;
      ribatGeo.attributes.born.needsUpdate = true;
      ribatGeo.attributes.seed.needsUpdate = true;

      // ── labels ────────────────────────────────────────────────────────────
      const rect = renderer.domElement.getBoundingClientRect();
      const cand: { i: number; sx: number; sy: number; d: number }[] = [];
      const v = new THREE.Vector3();
      const near = new Set<number>(focusNode !== null ? [focusNode, ...S.nodes[focusNode].sb] : []);
      for (let i = 0; i < N; i++) {
        if (vis && !vis.has(i) && !near.has(i)) continue;
        v.set(nodePos[i * 3], nodePos[i * 3 + 1], nodePos[i * 3 + 2]);
        const dist = camera.position.distanceTo(v);
        // Label only what is close enough to read, plus the current grain and
        // its seven branches wherever they are.
        if (dist > 58 && !near.has(i)) continue;
        v.project(camera);
        if (v.z > 1) continue;
        cand.push({ i, sx: ((v.x + 1) / 2) * rect.width, sy: ((1 - v.y) / 2) * rect.height, d: dist });
      }
      cand.sort((a, b) => (near.has(b.i) ? 1 : 0) - (near.has(a.i) ? 1 : 0) || a.d - b.d);

      for (let k = 0; k < labels.length; k++) {
        const el = labels[k];
        const c = cand[k];
        if (!c) {
          el.style.display = 'none';
          continue;
        }
        const n = S.nodes[c.i];
        const isFocus = c.i === focusNode;
        const isBranch = near.has(c.i) && !isFocus;
        if (el.dataset.node !== String(c.i)) {
          el.dataset.node = String(c.i);
          el.textContent = `${n.name} ${n.a}`;
        }
        el.style.display = 'block';
        el.style.transform = `translate(-50%,-50%) translate(${c.sx}px,${c.sy}px)`;
        el.style.opacity = String(isFocus ? 1 : isBranch ? 0.9 : Math.max(0.12, 1 - c.d / 62));
        el.className = `cosmos-label${isFocus ? ' is-focus' : isBranch ? ' is-branch' : ''}`;
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      renderer.domElement.removeEventListener('click', onClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.dispose();
      ng.dispose();
      nodeMat.dispose();
      branchGeo.dispose();
      strandGeo.dispose();
      strandMat.dispose();
      ribatGeo.dispose();
      ribatMat.dispose();
      host.removeChild(renderer.domElement);
      if (sceneRef) sceneRef.current = null;
    };
    // Rebuilt only when the field itself changes; everything else rides `live`.
  }, [nodes, sky, sceneRef]);

  return (
    <>
      <div ref={mount} className="absolute inset-0" />
      <div ref={labelHost} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </>
  );
}
