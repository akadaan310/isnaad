'use client';
// ============================================================================
//  مشهد الكون الكامل — 6,236 āyāt in WebGL, and the sky as a separate lens.
//
//  Two coordinate spaces, never mixed in one frame:
//
//    isnad      universe space (lib/universe/placement.ts): direction = muṣḥaf
//               order on an equal-area spiral, radius = discourse distance.
//    celestial  equatorial space: 5,044 catalogue stars by RA/Dec on a shell of
//               radius 900. No āyah is drawn in it.
//
//  The camera is rendered relative to a floating origin: when it strays more
//  than REBASE units from the origin in force, the origin moves to it and the
//  world is shifted the other way. Positions stay small in float32 whatever
//  the flight does, and every rebase is written to the flight recorder.
//
//  Everything the shell needs to drive (fly to, voyage, replay, capture) goes
//  through an imperative handle; per-frame state rides refs, so React renders
//  nothing at frame rate.
// ============================================================================
import * as React from 'react';
import * as THREE from 'three';
import type { SkyPayload } from '@/lib/cosmos';
import { FLAG, type UniversePayload } from '@/lib/universe/types';
import type { Leg } from '@/lib/universe/relations';
import { cameraAt, standoff, type Voyage } from '@/lib/universe/voyage';
import { FlightRecorder, poseAt, type Environment, type Frame } from '@/lib/universe/recorder';

export type Lens = 'isnad' | 'celestial';
export type FlightMode = 'free' | 'orbit';

export interface FlightSettings {
  mode: FlightMode;
  /** Units per second at full stick. */
  speed: number;
  /** Look sensitivity multiplier. */
  sensitivity: number;
  near: number;
  far: number;
  /** Labels drawn at once — the level-of-detail knob for text. */
  labels: number;
  /** Point size multiplier. */
  pointScale: number;
  reduceMotion: boolean;
  collision: boolean;
  invertY: boolean;
  links: boolean;
}

export const DEFAULT_FLIGHT: FlightSettings = {
  mode: 'free',
  speed: 22,
  sensitivity: 1,
  near: 0.1,
  far: 4000,
  labels: 18,
  pointScale: 1,
  reduceMotion: false,
  collision: true,
  invertY: false,
  links: true,
};

export interface Telemetry {
  /** World position (origin + relative), universe or equatorial units. */
  world: [number, number, number];
  rel: [number, number, number];
  origin: [number, number, number];
  look: [number, number, number];
  fps: number;
  frameMs: number;
  near: number;
  far: number;
  /** Nearest āyah to the camera, and its distance. */
  nearest: number;
  nearestDist: number;
  css: [number, number];
  buffer: [number, number];
  dpr: number;
  voyageT: number | null;
  replaying: boolean;
  contextLost: boolean;
  rebases: number;
}

export interface UniverseHandle {
  flyTo(k: number): void;
  home(): void;
  playVoyage(v: Voyage, fromT?: number): void;
  pauseVoyage(): void;
  resumeVoyage(): void;
  stopVoyage(): void;
  replay(frames: Frame[]): void;
  stopReplay(): void;
  capture(): string | null;
  startVideo(): boolean;
  stopVideo(): Promise<Blob | null>;
  pose(): { p: [number, number, number]; look: [number, number, number] };
  setPose(p: [number, number, number], look: [number, number, number]): void;
  recorder(): FlightRecorder | null;
}

const PERSON = [new THREE.Color('#D97706'), new THREE.Color('#059669'), new THREE.Color('#0284C7')];
const UNATTRIBUTED = new THREE.Color('#64748B');
const LINK_COLOR: Record<string, THREE.Color> = {
  tartib: new THREE.Color('#475569'),
  root: new THREE.Color('#FB7185'),
  motif: new THREE.Color('#A78BFA'),
  discovery: new THREE.Color('#E2E8F0'),
};
const REBASE = 64;
const SKY_R = 900;
const MAX_LINKS = 96;

const NODE_VERT = /* glsl */ `
  attribute float size;
  attribute vec3 tint;
  attribute float glow;
  varying vec3 vTint;
  varying float vGlow;
  uniform float uScale;
  void main() {
    vTint = tint;
    vGlow = glow;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // Perspective size with a floor, so the far side of the field stays legible.
    gl_PointSize = clamp(size * uScale * (1.0 + glow * 1.8) * 120.0 / max(0.5, -mv.z), 2.0, 72.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vTint;
  varying float vGlow;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float core = smoothstep(0.5, 0.0, d);
    vec3 c = mix(vTint, vec3(1.0), core * core * (0.5 + vGlow * 0.5));
    gl_FragColor = vec4(c, (smoothstep(0.5, 0.12, d) * 0.55 + core * core * 0.6) * (0.55 + vGlow * 0.45));
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float mag;
  varying float vB;
  void main() {
    vB = clamp((6.2 - mag) / 7.6, 0.0, 1.0);
    gl_PointSize = 1.3 + vB * vB * 7.5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const STAR_FRAG = /* glsl */ `
  precision mediump float;
  varying float vB;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vec3(0.97, 0.98, 1.0), smoothstep(0.5, 0.0, d) * (0.25 + vB * 1.2));
  }
`;

function dominant(v: ArrayLike<number>, k: number): number {
  const a = v[k * 3];
  const b = v[k * 3 + 1];
  const c = v[k * 3 + 2];
  const m = Math.max(a, b, c);
  if (m <= 0) return -1;
  return m === a ? 0 : m === b ? 1 : 2;
}

function readEnvironment(renderer: THREE.WebGLRenderer, simulated: boolean): Environment {
  const gl = renderer.getContext();
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const hp = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
  return {
    userAgent: navigator.userAgent,
    platform: (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform,
    device: simulated ? 'simulated' : 'unknown',
    viewport: [window.innerWidth, window.innerHeight],
    gpu: {
      vendor: ext ? String(gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR)),
      renderer: ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER)),
      webgl: String(gl.getParameter(gl.VERSION)),
      maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      highpFragment: !!hp && hp.precision > 0,
    },
    renderer: {
      three: THREE.REVISION,
      antialias: true,
      precision: renderer.capabilities.precision,
      logarithmicDepthBuffer: renderer.capabilities.logarithmicDepthBuffer,
      isWebGL2: renderer.capabilities.isWebGL2,
    },
    geometry: {
      transform: 'mushaf-spiral/discourse-radius',
      floatingOrigin: REBASE,
      sky: `equatorial RA/Dec, r=${SKY_R}`,
    },
  };
}

export function UniverseScene({
  universe,
  adjacency,
  sky,
  lens,
  focus,
  settings,
  onPick,
  onLeg,
  onTelemetry,
  onVoyageEnd,
  handleRef,
}: {
  universe: UniversePayload;
  adjacency: Leg[][] | null;
  sky: SkyPayload | null;
  lens: Lens;
  focus: number | null;
  settings: FlightSettings;
  onPick: (k: number) => void;
  onLeg: (legIndex: number) => void;
  onTelemetry: (t: Telemetry) => void;
  onVoyageEnd: () => void;
  handleRef: React.MutableRefObject<UniverseHandle | null>;
}) {
  const mount = React.useRef<HTMLDivElement>(null);
  const labelHost = React.useRef<HTMLDivElement>(null);
  const live = React.useRef({ lens, focus, settings, onPick, onLeg, onTelemetry, onVoyageEnd, adjacency });
  live.current = { lens, focus, settings, onPick, onLeg, onTelemetry, onVoyageEnd, adjacency };

  React.useEffect(() => {
    const host = mount.current;
    if (!host) return;
    const N = universe.count;
    const params = new URLSearchParams(window.location.search);
    const simulated = params.has('simulated') || (navigator as Navigator & { webdriver?: boolean }).webdriver === true;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    // Capped as the legacy scene did; and setSize keeps updateStyle ON — see
    // docs/studio/GLITCH.md for what happens without it.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x070b16, 1);
    renderer.domElement.setAttribute('data-engine', 'universe');
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.touchAction = 'none';
    host.appendChild(renderer.domElement);

    const recorder = new FlightRecorder(readEnvironment(renderer, simulated), 7200);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, live.current.settings.near, live.current.settings.far);
    // Everything in world space hangs off this group; it is shifted by −origin.
    const world = new THREE.Group();
    scene.add(world);
    const origin = new THREE.Vector3(); // float64 on the JS side
    let rebases = 0;

    // ── isnād lens: the field ───────────────────────────────────────────────
    const isnadGroup = new THREE.Group();
    world.add(isnadGroup);
    const pos = new Float32Array(universe.p);
    const tint = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const glow = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      const d = dominant(universe.v, k);
      const c = d < 0 ? UNATTRIBUTED : PERSON[d];
      tint[k * 3] = c.r;
      tint[k * 3 + 1] = c.g;
      tint[k * 3 + 2] = c.b;
      const f = universe.f[k];
      size[k] = 0.55 + (f & FLAG.DISCOVERY ? 0.25 : 0) + Math.min(universe.sm[k], 4) * 0.06;
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    ng.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    ng.setAttribute('size', new THREE.BufferAttribute(size, 1));
    ng.setAttribute('glow', new THREE.BufferAttribute(glow, 1));
    const nodeMat = new THREE.ShaderMaterial({
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const nodePoints = new THREE.Points(ng, nodeMat);
    isnadGroup.add(nodePoints);

    // The muṣḥaf thread: consecutive āyāt joined, faintly. It is the spiral
    // itself, so a reader can see that direction is order.
    const thread = new THREE.Line(
      (() => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        return g;
      })(),
      new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.18, depthWrite: false }),
    );
    // Consecutive āyāt often sit on different shells, so the thread zig-zags
    // radially; at full strength it read as a starburst that hid the āyāt
    // (usability run 1, docs/studio/USABILITY.md). It stays, faint.
    isnadGroup.add(thread);

    // Shells of the proximity axis, as wire rings in three planes.
    const shellMat = new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35, depthWrite: false });
    const ring = (r: number, mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial = shellMat) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 128; i++) {
        const a = (i / 128) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);
    };
    const tr = universe.transform;
    for (const d of [0, 0.5, 1]) isnadGroup.add(ring(tr.radialBase + d * tr.radialSpan));
    const unattributedRing = ring(
      tr.unattributedRadius,
      new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 2, gapSize: 2, transparent: true, opacity: 0.35 }),
    );
    unattributedRing.computeLineDistances();
    isnadGroup.add(unattributedRing);

    // Links from the focused āyah, and the voyage path.
    const linkGeo = new THREE.BufferGeometry();
    const linkPos = new Float32Array(MAX_LINKS * 6);
    const linkCol = new Float32Array(MAX_LINKS * 6);
    linkGeo.setAttribute('position', new THREE.BufferAttribute(linkPos, 3));
    linkGeo.setAttribute('color', new THREE.BufferAttribute(linkCol, 3));
    const links = new THREE.LineSegments(
      linkGeo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    links.frustumCulled = false;
    isnadGroup.add(links);
    let linksFor = -2;

    const pathGeo = new THREE.BufferGeometry();
    const pathLine = new THREE.Line(
      pathGeo,
      new THREE.LineDashedMaterial({ color: 0xc8a45c, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.8 }),
    );
    pathLine.frustumCulled = false;
    pathLine.visible = false;
    isnadGroup.add(pathLine);

    // ── celestial lens: the catalogue, in its own space ─────────────────────
    const skyGroup = new THREE.Group();
    world.add(skyGroup);
    if (sky) {
      const RAD = Math.PI / 180;
      const g = new THREE.BufferGeometry();
      const sp = new Float32Array(sky.stars.length * 3);
      const mag = new Float32Array(sky.stars.length);
      sky.stars.forEach(([ra, dec, m], i) => {
        const a = ra * RAD;
        const d = dec * RAD;
        sp[i * 3] = SKY_R * Math.cos(d) * Math.cos(a);
        sp[i * 3 + 1] = SKY_R * Math.sin(d);
        sp[i * 3 + 2] = SKY_R * Math.cos(d) * Math.sin(a);
        mag[i] = m;
      });
      g.setAttribute('position', new THREE.BufferAttribute(sp, 3));
      g.setAttribute('mag', new THREE.BufferAttribute(mag, 1));
      skyGroup.add(
        new THREE.Points(
          g,
          new THREE.ShaderMaterial({
            vertexShader: STAR_VERT,
            fragmentShader: STAR_FRAG,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
      const seg: number[] = [];
      for (const con of sky.constellations) {
        for (const line of con.lines) {
          for (let i = 0; i + 1 < line.length; i++) {
            for (const [ra, dec] of [line[i], line[i + 1]]) {
              const a = ra * RAD;
              const d = dec * RAD;
              seg.push((SKY_R - 6) * Math.cos(d) * Math.cos(a), (SKY_R - 6) * Math.sin(d), (SKY_R - 6) * Math.cos(d) * Math.sin(a));
            }
          }
        }
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      skyGroup.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.2 })));
    }

    // ── labels ──────────────────────────────────────────────────────────────
    const labels: HTMLDivElement[] = [];
    if (labelHost.current) {
      labelHost.current.innerHTML = '';
      for (let i = 0; i < 40; i++) {
        const el = document.createElement('div');
        el.className = 'cosmos-label';
        el.style.display = 'none';
        labelHost.current.appendChild(el);
        labels.push(el);
      }
    }
    const AR = '٠١٢٣٤٥٦٧٨٩';
    const ar = (n: number) => String(n).replace(/\d/g, (d) => AR[+d]);
    const surahName = (s: number) => universe.surahs[s - 1]?.name ?? String(s);

    // ── camera state ────────────────────────────────────────────────────────
    // rel: camera position relative to `origin`. World = origin + rel.
    const rel = new THREE.Vector3(0, 0, 0);
    const look = { yaw: Math.PI, pitch: 0 };
    const orbit = { target: new THREE.Vector3(), radius: 160, yaw: 0.6, pitch: 0.35 };
    const vel = new THREE.Vector3();
    const keys = new Set<string>();
    let fly: { from: THREE.Vector3; to: THREE.Vector3; lookTo: THREE.Vector3; t: number; dur: number } | null = null;
    let voyage: { v: Voyage; t: number; playing: boolean; leg: number } | null = null;
    let replay: { frames: Frame[]; t: number } | null = null;
    let contextLost = false;

    const worldPos = new THREE.Vector3();
    const getWorld = () => worldPos.copy(origin).add(rel);
    const setWorld = (x: number, y: number, z: number) => {
      rel.set(x - origin.x, y - origin.y, z - origin.z);
    };

    const home = () => {
      fly = null;
      voyage = null;
      replay = null;
      setWorld(0, 30, 170);
      orbit.target.set(0, 0, 0);
      orbit.radius = 175;
      lookAtWorld(new THREE.Vector3(0, 0, 0));
    };

    const lookAtWorld = (target: THREE.Vector3) => {
      const w = getWorld();
      const d = target.clone().sub(w);
      if (d.lengthSq() < 1e-9) return;
      d.normalize();
      look.yaw = Math.atan2(-d.x, -d.z);
      look.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    };

    const nodeWorld = (k: number) => new THREE.Vector3(pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]);

    const flyTo = (k: number) => {
      if (k < 0 || k >= N) return;
      voyage = null;
      replay = null;
      const target = nodeWorld(k);
      const s = standoff([target.x, target.y, target.z]);
      const to = new THREE.Vector3(s[0], s[1], s[2]);
      const from = getWorld().clone();
      const dur = live.current.settings.reduceMotion ? 0.01 : Math.min(3.2, 0.9 + from.distanceTo(to) / 70);
      fly = { from, to, lookTo: target, t: 0, dur };
      orbit.target.copy(target);
      orbit.radius = 14;
    };

    // ── input ───────────────────────────────────────────────────────────────
    const drag = { on: false, x: 0, y: 0, moved: 0 };
    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let pinchMove = 0;

    const cancelAuto = () => {
      fly = null;
      if (voyage) voyage.playing = false;
      replay = null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) {
        keys.add(k);
        if (k !== 'shift') cancelAuto();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag.on = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved = 0;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) {
        pinch = 0;
        pinchMove = 0;
      }
      if (pointers.size === 0) {
        if (drag.on && drag.moved < 6) pick(e.clientX, e.clientY);
        drag.on = false;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch > 0) pinchMove = (d - pinch) * 0.08;
        pinch = d;
        drag.moved += 10;
        cancelAuto();
        return;
      }
      if (!drag.on) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (drag.moved < 6) return;
      cancelAuto();
      const S = live.current.settings;
      const k = 0.0032 * S.sensitivity;
      const inv = S.invertY ? -1 : 1;
      if (S.mode === 'orbit' && live.current.lens === 'isnad') {
        orbit.yaw -= dx * k;
        orbit.pitch = THREE.MathUtils.clamp(orbit.pitch + dy * k * inv, -1.45, 1.45);
      } else {
        look.yaw += dx * k;
        look.pitch = THREE.MathUtils.clamp(look.pitch + dy * k * inv, -1.5, 1.5);
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAuto();
      if (live.current.settings.mode === 'orbit') {
        orbit.radius = THREE.MathUtils.clamp(orbit.radius * (e.deltaY > 0 ? 1.1 : 0.9), 2, 1200);
      } else {
        const f = new THREE.Vector3();
        camera.getWorldDirection(f);
        rel.addScaledVector(f, -Math.sign(e.deltaY) * live.current.settings.speed * 0.15);
      }
    };

    const pick = (cx: number, cy: number) => {
      if (live.current.lens !== 'isnad') return;
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = cx - rect.left;
      const my = cy - rect.top;
      const v = new THREE.Vector3();
      let best = -1;
      let bestD = 30 * 30;
      for (let k = 0; k < N; k++) {
        v.set(pos[k * 3] - origin.x, pos[k * 3 + 1] - origin.y, pos[k * 3 + 2] - origin.z).project(camera);
        if (v.z > 1 || v.z < -1) continue;
        const sx = ((v.x + 1) / 2) * rect.width;
        const sy = ((1 - v.y) / 2) * rect.height;
        const d = (sx - mx) ** 2 + (sy - my) ** 2;
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      if (best >= 0) {
        recorder.event(clockT, 'select', { k: best, s: universe.s[best], a: universe.a[best], via: 'pick' });
        live.current.onPick(best);
      }
    };

    const el = renderer.domElement;
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('pointermove', onMove);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    const onLost = (e: Event) => {
      e.preventDefault();
      contextLost = true;
      recorder.event(clockT, 'context-lost', {});
    };
    const onRestored = () => {
      contextLost = false;
      recorder.event(clockT, 'context-restored', {});
    };
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', onRestored);

    // ── size ────────────────────────────────────────────────────────────────
    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      renderer.setSize(w, h); // updateStyle on: the element is laid out at w×h
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const r = el.getBoundingClientRect();
      recorder.geometry(clockT, {
        hostW: w,
        hostH: h,
        cssW: Math.round(r.width),
        cssH: Math.round(r.height),
        bufW: el.width,
        bufH: el.height,
        dpr: renderer.getPixelRatio(),
        deviceDpr: window.devicePixelRatio || 1,
      });
    };
    let clockT = 0;
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    // ── video ───────────────────────────────────────────────────────────────
    let media: MediaRecorder | null = null;
    let chunks: Blob[] = [];

    // ── handle ──────────────────────────────────────────────────────────────
    handleRef.current = {
      flyTo,
      home,
      playVoyage: (v, fromT = 0) => {
        fly = null;
        replay = null;
        voyage = { v, t: fromT, playing: true, leg: -1 };
        recorder.event(clockT, 'voyage', { digest: v.digest, seed: v.config.seed, legs: v.legs.length });
        const pts: number[] = [];
        for (const leg of v.legs) pts.push(pos[leg.to * 3], pos[leg.to * 3 + 1], pos[leg.to * 3 + 2]);
        pathGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
        pathLine.computeLineDistances();
        pathLine.visible = true;
      },
      pauseVoyage: () => {
        if (voyage) voyage.playing = false;
      },
      resumeVoyage: () => {
        if (voyage) voyage.playing = true;
      },
      stopVoyage: () => {
        voyage = null;
        pathLine.visible = false;
      },
      replay: (frames) => {
        if (!frames.length) return;
        fly = null;
        voyage = null;
        replay = { frames, t: frames[0].t };
      },
      stopReplay: () => {
        replay = null;
      },
      capture: () => {
        try {
          renderer.render(scene, camera);
          return el.toDataURL('image/png');
        } catch {
          return null;
        }
      },
      startVideo: () => {
        if (typeof MediaRecorder === 'undefined' || !('captureStream' in el)) return false;
        const stream = (el as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(30);
        const type = ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t));
        if (!type) return false;
        chunks = [];
        media = new MediaRecorder(stream, { mimeType: type });
        media.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        media.start(250);
        return true;
      },
      stopVideo: () =>
        new Promise((resolve) => {
          if (!media) return resolve(null);
          const m = media;
          m.onstop = () => resolve(new Blob(chunks, { type: m.mimeType }));
          m.stop();
          media = null;
        }),
      pose: () => {
        const w = getWorld();
        const f = new THREE.Vector3();
        camera.getWorldDirection(f);
        return {
          p: [w.x, w.y, w.z],
          look: [w.x + f.x * 10, w.y + f.y * 10, w.z + f.z * 10],
        };
      },
      setPose: (p, lk) => {
        cancelAuto();
        setWorld(p[0], p[1], p[2]);
        lookAtWorld(new THREE.Vector3(lk[0], lk[1], lk[2]));
      },
      recorder: () => recorder,
    };

    home();

    // ── loop ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let raf = 0;
    let teleDue = 0;
    let fpsAcc = 0;
    let fpsN = 0;
    let fpsShown = 0;
    let lastMs = 16;
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tmp = new THREE.Vector3();
    const v3 = new THREE.Vector3();
    let lastLens: Lens | null = null;
    let nearest = -1;
    let nearestDist = Infinity;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const rawDt = clock.getDelta();
      const dt = Math.min(0.05, rawDt);
      clockT += dt;
      lastMs = rawDt * 1000;
      fpsAcc += rawDt;
      fpsN++;
      if (fpsAcc > 0.5) {
        fpsShown = fpsN / fpsAcc;
        fpsAcc = 0;
        fpsN = 0;
      }
      const L = live.current;
      const S = L.settings;

      if (L.lens !== lastLens) {
        lastLens = L.lens;
        isnadGroup.visible = L.lens === 'isnad';
        skyGroup.visible = L.lens === 'celestial';
        cancelAuto();
        if (L.lens === 'celestial') {
          // The catalogue is seen from its centre, as the sky is.
          setWorld(0, 0, 0);
        } else home();
        recorder.event(clockT, 'lens', { lens: L.lens });
      }
      if (camera.near !== S.near || camera.far !== S.far) {
        camera.near = Math.max(0.001, S.near);
        camera.far = Math.max(camera.near * 2, S.far);
        camera.updateProjectionMatrix();
      }

      // ── drive the camera ──────────────────────────────────────────────────
      let lookTarget: THREE.Vector3 | null = null;
      if (replay) {
        replay.t += dt;
        const r = poseAt(replay.frames, replay.t);
        if (r) {
          setWorld(r.p[0], r.p[1], r.p[2]);
          camera.quaternion.set(r.q[0], r.q[1], r.q[2], r.q[3]);
        }
        if (replay.t >= replay.frames[replay.frames.length - 1].t) replay = null;
      } else if (voyage) {
        if (voyage.playing) voyage.t += dt;
        const c = cameraAt(voyage.v, pos, voyage.t, S.reduceMotion);
        setWorld(c.p[0], c.p[1], c.p[2]);
        lookTarget = v3.set(c.look[0], c.look[1], c.look[2]);
        if (c.leg !== voyage.leg) {
          voyage.leg = c.leg;
          L.onLeg(c.leg);
        }
        if (voyage.t >= voyage.v.duration && voyage.playing) {
          voyage.playing = false;
          L.onVoyageEnd();
        }
      } else if (fly) {
        fly.t += dt;
        const x = Math.min(1, fly.t / fly.dur);
        const e = S.reduceMotion ? 1 : x * x * (3 - 2 * x);
        const w = tmp.copy(fly.from).lerp(fly.to, e);
        setWorld(w.x, w.y, w.z);
        lookTarget = v3.copy(fly.lookTo);
        if (x >= 1) {
          fly = null;
          lookAtWorld(orbit.target);
        }
      } else if (S.mode === 'orbit' && L.lens === 'isnad') {
        const cp = Math.cos(orbit.pitch);
        const w = tmp.set(
          orbit.target.x + orbit.radius * cp * Math.sin(orbit.yaw),
          orbit.target.y + orbit.radius * Math.sin(orbit.pitch),
          orbit.target.z + orbit.radius * cp * Math.cos(orbit.yaw),
        );
        setWorld(w.x, w.y, w.z);
        lookTarget = v3.copy(orbit.target);
      } else {
        camera.quaternion.setFromEuler(new THREE.Euler(look.pitch, look.yaw, 0, 'YXZ'));
        camera.getWorldDirection(fwd);
        right.crossVectors(fwd, up).normalize();
        const acc = tmp.set(0, 0, 0);
        if (keys.has('w') || keys.has('arrowup')) acc.add(fwd);
        if (keys.has('s') || keys.has('arrowdown')) acc.sub(fwd);
        if (keys.has('a') || keys.has('arrowleft')) acc.sub(right);
        if (keys.has('d') || keys.has('arrowright')) acc.add(right);
        if (keys.has('q')) acc.y -= 1;
        if (keys.has('e')) acc.y += 1;
        if (pinchMove) {
          acc.addScaledVector(fwd, pinchMove);
          pinchMove *= 0.6;
        }
        // Gamepad, where the browser exposes one: left stick moves, right looks.
        const pad = typeof navigator.getGamepads === 'function' ? navigator.getGamepads()[0] : null;
        if (pad && pad.connected) {
          const dz = (x: number) => (Math.abs(x) < 0.15 ? 0 : x);
          acc.addScaledVector(fwd, -dz(pad.axes[1] ?? 0)).addScaledVector(right, dz(pad.axes[0] ?? 0));
          look.yaw -= dz(pad.axes[2] ?? 0) * dt * 2.2 * S.sensitivity;
          look.pitch = THREE.MathUtils.clamp(look.pitch - dz(pad.axes[3] ?? 0) * dt * 2.2 * S.sensitivity, -1.5, 1.5);
        }
        const boost = keys.has('shift') ? 3 : 1;
        if (acc.lengthSq() > 0) vel.addScaledVector(acc.normalize(), S.speed * boost * dt * 4);
        vel.multiplyScalar(Math.pow(0.03, dt));
        rel.addScaledVector(vel, dt);
      }

      // Collision avoidance: never sit inside an āyah's sprite.
      nearest = -1;
      nearestDist = Infinity;
      if (L.lens === 'isnad') {
        const w = getWorld();
        for (let k = 0; k < N; k++) {
          const dx = pos[k * 3] - w.x;
          const dy = pos[k * 3 + 1] - w.y;
          const dz = pos[k * 3 + 2] - w.z;
          const d = dx * dx + dy * dy + dz * dz;
          if (d < nearestDist) {
            nearestDist = d;
            nearest = k;
          }
        }
        nearestDist = Math.sqrt(nearestDist);
        const MIN = 0.9;
        if (S.collision && !replay && nearest >= 0 && nearestDist < MIN && nearestDist > 1e-6) {
          const push = (MIN - nearestDist) / nearestDist;
          rel.x -= (pos[nearest * 3] - w.x) * push;
          rel.y -= (pos[nearest * 3 + 1] - w.y) * push;
          rel.z -= (pos[nearest * 3 + 2] - w.z) * push;
          vel.multiplyScalar(0.5);
        }
      }

      // Floating origin.
      if (rel.length() > REBASE) {
        origin.add(rel);
        rel.set(0, 0, 0);
        rebases++;
        recorder.event(clockT, 'rebase', { origin: origin.toArray() });
      }
      world.position.set(-origin.x, -origin.y, -origin.z);
      camera.position.copy(rel);
      if (lookTarget) camera.lookAt(lookTarget.x - origin.x, lookTarget.y - origin.y, lookTarget.z - origin.z);
      if (lookTarget || replay) {
        camera.getWorldDirection(fwd);
        look.yaw = Math.atan2(-fwd.x, -fwd.z);
        look.pitch = Math.asin(THREE.MathUtils.clamp(fwd.y, -1, 1));
      }

      // ── focus, links ─────────────────────────────────────────────────────
      const F = L.focus;
      for (let k = 0; k < N; k++) glow[k] *= Math.pow(0.2, dt);
      if (F !== null) glow[F] = 1;
      ng.attributes.glow.needsUpdate = true;
      nodeMat.uniforms.uScale.value = S.pointScale;

      if (F !== linksFor || !S.links) {
        linksFor = S.links ? (F ?? -1) : -1;
        let n = 0;
        const adj = F !== null && S.links ? (L.adjacency?.[F] ?? []) : [];
        for (const leg of adj) {
          if (n >= MAX_LINKS) break;
          const c = LINK_COLOR[leg.kind] ?? LINK_COLOR.tartib;
          linkPos.set([pos[F! * 3], pos[F! * 3 + 1], pos[F! * 3 + 2], pos[leg.to * 3], pos[leg.to * 3 + 1], pos[leg.to * 3 + 2]], n * 6);
          const g = 0.35 + leg.weight * 0.65;
          linkCol.set([c.r * g, c.g * g, c.b * g, c.r * g * 0.4, c.g * g * 0.4, c.b * g * 0.4], n * 6);
          glow[leg.to] = Math.max(glow[leg.to], 0.45);
          n++;
        }
        linkGeo.setDrawRange(0, n * 2);
        linkGeo.attributes.position.needsUpdate = true;
        linkGeo.attributes.color.needsUpdate = true;
      }

      // ── labels: nearest few, plus the focus and its links ────────────────
      const rect = el.getBoundingClientRect();
      const cand: { k: number; sx: number; sy: number; d: number; pri: number }[] = [];
      if (L.lens === 'isnad' && S.labels > 0) {
        const w = getWorld();
        const linked = new Set<number>(F !== null && S.links ? (L.adjacency?.[F] ?? []).map((l) => l.to) : []);
        for (let k = 0; k < N; k++) {
          const pri = k === F ? 2 : linked.has(k) ? 1 : 0;
          const d = Math.hypot(pos[k * 3] - w.x, pos[k * 3 + 1] - w.y, pos[k * 3 + 2] - w.z);
          if (!pri && d > 26) continue;
          v3.set(pos[k * 3] - origin.x, pos[k * 3 + 1] - origin.y, pos[k * 3 + 2] - origin.z).project(camera);
          if (v3.z > 1 || v3.z < -1 || Math.abs(v3.x) > 1.05 || Math.abs(v3.y) > 1.05) continue;
          cand.push({ k, sx: ((v3.x + 1) / 2) * rect.width, sy: ((1 - v3.y) / 2) * rect.height, d, pri });
        }
        cand.sort((a, b) => b.pri - a.pri || a.d - b.d);
      }
      const budget = Math.min(labels.length, S.labels);
      for (let i = 0; i < labels.length; i++) {
        const lab = labels[i];
        const c = i < budget ? cand[i] : undefined;
        if (!c) {
          lab.style.display = 'none';
          continue;
        }
        if (lab.dataset.k !== String(c.k)) {
          lab.dataset.k = String(c.k);
          lab.textContent = `${surahName(universe.s[c.k])} ${ar(universe.a[c.k])}`;
        }
        lab.style.display = 'block';
        lab.style.transform = `translate(-50%,-140%) translate(${c.sx}px,${c.sy}px)`;
        lab.style.opacity = String(c.pri ? 1 : Math.max(0.15, 1 - c.d / 28));
        lab.className = `cosmos-label${c.pri === 2 ? ' is-focus' : c.pri === 1 ? ' is-branch' : ''}`;
      }

      if (!contextLost) renderer.render(scene, camera);

      // ── recorder & telemetry ─────────────────────────────────────────────
      const w = getWorld();
      const q = camera.quaternion;
      recorder.frame({
        t: +clockT.toFixed(4),
        p: [w.x, w.y, w.z],
        q: [q.x, q.y, q.z, q.w],
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
        locus: F ?? -1,
        dt: +(rawDt * 1000).toFixed(2),
        origin: [origin.x, origin.y, origin.z],
      });

      teleDue -= dt;
      if (teleDue <= 0) {
        teleDue = 0.25;
        camera.getWorldDirection(fwd);
        L.onTelemetry({
          world: [w.x, w.y, w.z],
          rel: [rel.x, rel.y, rel.z],
          origin: [origin.x, origin.y, origin.z],
          look: [fwd.x, fwd.y, fwd.z],
          fps: fpsShown,
          frameMs: lastMs,
          near: camera.near,
          far: camera.far,
          nearest,
          nearestDist,
          css: [Math.round(rect.width), Math.round(rect.height)],
          buffer: [el.width, el.height],
          dpr: renderer.getPixelRatio(),
          voyageT: voyage ? voyage.t : null,
          replaying: !!replay,
          contextLost,
          rebases,
        });
      }
    };
    frame();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('pointermove', onMove);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      el.removeEventListener('webglcontextlost', onLost);
      el.removeEventListener('webglcontextrestored', onRestored);
      media?.stop();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      host.removeChild(el);
      handleRef.current = null;
    };
  }, [universe, sky, handleRef]);

  return (
    <>
      <div ref={mount} className="absolute inset-0 overflow-hidden" />
      <div ref={labelHost} className="pointer-events-none absolute inset-0 overflow-hidden" />
    </>
  );
}
