'use client';
// ============================================================================
//  الرِّحلة — the immersive field.
//
//  A separate renderer from the observatory, because the two want opposite
//  things. The observatory is a desk: DOM panels, a mouse, a field held at
//  arm's length. This is a vessel: no chrome, a thumb, and the field all
//  around. Sharing one renderer would have made both worse.
//
//  Everything the traveller reads is painted into a 2D canvas and sampled as a
//  texture, so the mode is WebGL to the edges and the Uthmani still shapes
//  correctly — see lib/cosmos/textures.ts for why a glyph atlas cannot.
//
//  Black and gold, and the gold is spent in one place: the āyah you are on and
//  the relations leaving it. Everything else is dust and distance.
// ============================================================================
import * as React from 'react';
import * as THREE from 'three';
import type { CosmosNode, SkyPayload } from '@/lib/cosmos';
import type { Strand } from '@/lib/cosmos/strands';
import { RADIAL_BASE } from '@/lib/cosmos/placement';
import { chooseLeg, indexStrands, legReason, type Course } from '@/lib/cosmos/voyage';
import { Plate, ensureFonts } from '@/lib/cosmos/textures';
import { drawHud, type HudState } from './rihla-hud';
import { haptic, type Capability } from '@/lib/cosmos/device';
import { BodyField, CELL } from './body-field';
import type { Immersion } from '@/lib/cosmos/immersion';

const GOLD = new THREE.Color('#C8A45C');
const PERSON: Record<number, THREE.Color> = {
  1: new THREE.Color('#E09A3E'),
  2: new THREE.Color('#3FBF8F'),
  3: new THREE.Color('#3A9BDC'),
};
const GROUND = 0x05070c;
const SKY_R = 900;
/** Side of the dust box that follows the traveller. Dust wraps inside it. */
const DUST_BOX = 320;
const ARRIVE_R = 9;

// ── dust: motion made of segments, so it can actually streak ────────────────
const DUST_VERT = /* glsl */ `
  attribute float tail;     // 0 at the head of the mote, 1 at its tail
  attribute float phase;
  attribute float bright;
  uniform vec3 uCam;
  uniform vec3 uVel;
  uniform float uTime;
  uniform float uStretch;
  uniform float uBox;
  varying float vA;

  void main() {
    // Wrap the mote into the box that travels with the camera. Nothing is
    // created or destroyed: the same motes are reused forever, which is what
    // makes the dust endless without inventing anything.
    vec3 p = position;
    vec3 rel = p - uCam + uBox * 0.5;
    rel = mod(rel, uBox);
    p = rel - uBox * 0.5 + uCam;

    // A cheap divergence-free-ish drift: three orthogonal sinusoids read off
    // the other two axes. It reads as a slow current rather than as noise.
    float t = uTime * 0.14 + phase * 6.2831;
    p += vec3(
      sin(t + p.y * 0.021) ,
      cos(t * 0.92 + p.z * 0.019),
      sin(t * 1.07 + p.x * 0.023)
    ) * 2.4;

    // The tail lags along the traveller's velocity: at rest a mote is a point,
    // at speed it is a streak, and the length is the speed.
    p -= uVel * (tail * uStretch);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float fade = smoothstep(uBox * 0.52, uBox * 0.16, length(p - uCam));
    vA = bright * fade * (1.0 - tail * 0.75);
    gl_Position = projectionMatrix * mv;
  }
`;

const DUST_FRAG = /* glsl */ `
  precision mediump float;
  varying float vA;
  uniform vec3 uTint;
  void main() { gl_FragColor = vec4(uTint * vA, 1.0); }
`;

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
    gl_PointSize = clamp(size * uScale / max(1.0, -mv.z) * 220.0, 2.0, 160.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const NODE_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vTint;
  varying float vGlow;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float core = smoothstep(0.5, 0.0, r);
    float halo = pow(core, 3.0);
    gl_FragColor = vec4(vTint * (halo + core * 0.35) * (0.5 + vGlow * 2.2), 1.0);
  }
`;

const STRAND_VERT = /* glsl */ `
  attribute float u;
  attribute float born;
  attribute float seed;
  attribute vec3 tint;
  varying float vA;
  varying vec3 vTint;
  uniform float uTime;
  void main() {
    float age = max(0.0, uTime - born);
    float g = clamp(1.0 - exp(-5.5 * age) * cos(8.5 * age), 0.0, 1.0);
    float head = smoothstep(g, g - 0.12, u);
    float pulse = exp(-pow((fract(uTime * 0.2 + seed) - u) * 6.5, 2.0));
    vA = head * (0.42 + pulse * 1.6);
    vTint = tint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STRAND_FRAG = /* glsl */ `
  precision mediump float;
  varying float vA;
  varying vec3 vTint;
  void main() { gl_FragColor = vec4(vTint * vA, 1.0); }
`;

export interface RihlaHandle {
  /** Steer by a screen-space delta, in pixels. */
  steer: (dx: number, dy: number) => void;
  /** Set throttle, 0…1. */
  throttle: (v: number) => void;
  /** Take the leg now, without waiting for the reciter. */
  advance: () => void;
  /** Aim at whatever lies under the reticle — a body if one does, else an āyah. */
  lockAhead: () => void;
}

export function RihlaScene({
  nodes,
  sky,
  strands,
  cap,
  holding,
  onArrive,
  onChooseImmersion,
  immersionAt,
  activeImmersion,
  zoneHexes,
  handleRef,
  hud,
}: {
  nodes: CosmosNode[];
  sky: SkyPayload | null;
  strands: Strand[];
  cap: Capability;
  /** True while the reciter is sounding: the vessel waits at the āyah. */
  holding: boolean;
  onArrive: (index: number, reason: string) => void;
  /** A body was tapped. */
  onChooseImmersion: (imm: Immersion) => void;
  /** Body n, for any n — the sequence is unbounded and generated on demand. */
  immersionAt: ((index: number) => Immersion) | null;
  activeImmersion: number;
  /** The zones' measured starlight, for colouring the distant thousands. */
  zoneHexes: string[];
  handleRef?: React.MutableRefObject<RihlaHandle | null>;
  /** Everything the plate shows that the scene does not own. */
  hud: Omit<HudState, 'node' | 'distance' | 'sinceArrival' | 'throttle'>;
}) {
  const mount = React.useRef<HTMLDivElement>(null);
  const live = React.useRef({
    nodes, strands, cap, holding, onArrive, onChooseImmersion, immersionAt, activeImmersion,
    zoneHexes, hud,
  });
  live.current = {
    nodes, strands, cap, holding, onArrive, onChooseImmersion, immersionAt, activeImmersion,
    zoneHexes, hud,
  };

  React.useEffect(() => {
    const host = mount.current;
    if (!host || !nodes.length) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({
      antialias: cap.tier === 'high',
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(cap.dpr);
    renderer.setClearColor(GROUND, 1);
    host.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'none';

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(GROUND, 0.0022);
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 4000);

    // ── the far sky ─────────────────────────────────────────────────────────
    if (sky?.stars?.length) {
      const take = Math.min(sky.stars.length, cap.stars);
      const pos = new Float32Array(take * 3);
      const alpha = new Float32Array(take);
      const RAD = Math.PI / 180;
      for (let i = 0; i < take; i++) {
        const [ra, dec, mag] = sky.stars[i];
        const a = ra * RAD;
        const d = dec * RAD;
        pos[i * 3] = SKY_R * Math.cos(d) * Math.cos(a);
        pos[i * 3 + 1] = SKY_R * Math.sin(d);
        pos[i * 3 + 2] = SKY_R * Math.cos(d) * Math.sin(a);
        alpha[i] = Math.max(0.12, Math.min(1, (6.5 - mag) / 6));
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('size', new THREE.BufferAttribute(alpha, 1));
      g.setAttribute(
        'tint',
        new THREE.BufferAttribute(
          Float32Array.from({ length: take * 3 }, (_, i) => (i % 3 === 2 ? 0.95 : 0.88)),
          3,
        ),
      );
      g.setAttribute('glow', new THREE.BufferAttribute(new Float32Array(take).fill(0.05), 1));
      scene.add(
        new THREE.Points(
          g,
          new THREE.ShaderMaterial({
            vertexShader: NODE_VERT,
            fragmentShader: NODE_FRAG,
            uniforms: { uScale: { value: 0.4 } },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        ),
      );
    }

    // ── the figures ─────────────────────────────────────────────────────────
    //  The same 89 IAU constellations the الفرقان player draws, on the same far
    //  shell. They were absent here, which left the traveller inside a field of
    //  stars with no sky — and the برج an āyah is named for had nothing to
    //  point at. They are a celestial reference and nothing more: the figure is
    //  real astronomy, the āyah's membership in it is a label.
    if (sky?.constellations?.length && cap.tier !== 'low') {
      const seg: number[] = [];
      const RAD2 = Math.PI / 180;
      const onShell = (ra: number, dec: number) => {
        const a = ra * RAD2;
        const d = dec * RAD2;
        const r = SKY_R - 10;
        return [r * Math.cos(d) * Math.cos(a), r * Math.sin(d), r * Math.cos(d) * Math.sin(a)];
      };
      for (const con of sky.constellations) {
        for (const line of con.lines) {
          for (let i = 0; i + 1 < line.length; i++) {
            seg.push(...onShell(line[i][0], line[i][1]), ...onShell(line[i + 1][0], line[i + 1][1]));
          }
        }
      }
      const fg = new THREE.BufferGeometry();
      fg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
      scene.add(
        new THREE.LineSegments(
          fg,
          new THREE.LineBasicMaterial({
            color: 0x7dd3fc,
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
          }),
        ),
      );
    }

    // ── dust ────────────────────────────────────────────────────────────────
    const MOTES = cap.tier === 'low' ? 4000 : cap.tier === 'mid' ? 11000 : 22000;
    const dustPos = new Float32Array(MOTES * 2 * 3);
    const dustTail = new Float32Array(MOTES * 2);
    const dustPhase = new Float32Array(MOTES * 2);
    const dustBright = new Float32Array(MOTES * 2);
    for (let i = 0; i < MOTES; i++) {
      const x = (Math.random() - 0.5) * DUST_BOX;
      const y = (Math.random() - 0.5) * DUST_BOX;
      const z = (Math.random() - 0.5) * DUST_BOX;
      const b = 0.06 + Math.random() * 0.3;
      const ph = Math.random();
      for (let e = 0; e < 2; e++) {
        dustPos[(i * 2 + e) * 3] = x;
        dustPos[(i * 2 + e) * 3 + 1] = y;
        dustPos[(i * 2 + e) * 3 + 2] = z;
        dustTail[i * 2 + e] = e;
        dustPhase[i * 2 + e] = ph;
        dustBright[i * 2 + e] = b;
      }
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('tail', new THREE.BufferAttribute(dustTail, 1));
    dustGeo.setAttribute('phase', new THREE.BufferAttribute(dustPhase, 1));
    dustGeo.setAttribute('bright', new THREE.BufferAttribute(dustBright, 1));
    const dustMat = new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uVel: { value: new THREE.Vector3() },
        uTime: { value: 0 },
        uStretch: { value: 0 },
        uBox: { value: DUST_BOX },
        uTint: { value: new THREE.Color('#C8A45C') },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.LineSegments(dustGeo, dustMat));

    // ── āyah field ──────────────────────────────────────────────────────────
    const N = nodes.length;
    const nodePos = new Float32Array(N * 3);
    const nodeTint = new Float32Array(N * 3);
    const nodeSize = new Float32Array(N);
    const nodeGlow = new Float32Array(N);
    nodes.forEach((n, i) => {
      nodePos[i * 3] = n.p[0];
      nodePos[i * 3 + 1] = n.p[1];
      nodePos[i * 3 + 2] = n.p[2];
      const m = Math.max(n.v[0], n.v[1], n.v[2]);
      const dom = m <= 0 ? 0 : m === n.v[0] ? 1 : m === n.v[1] ? 2 : 3;
      const c = PERSON[dom] ?? GOLD;
      nodeTint[i * 3] = c.r;
      nodeTint[i * 3 + 1] = c.g;
      nodeTint[i * 3 + 2] = c.b;
      nodeSize[i] = 0.85 + (n.k ? 0.5 : 0) + n.tn * 0.6;
      nodeGlow[i] = 0.04;
    });
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePos, 3));
    nodeGeo.setAttribute('tint', new THREE.BufferAttribute(nodeTint, 3));
    nodeGeo.setAttribute('size', new THREE.BufferAttribute(nodeSize, 1));
    nodeGeo.setAttribute('glow', new THREE.BufferAttribute(nodeGlow, 1));
    const nodeMat = new THREE.ShaderMaterial({
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
      uniforms: { uScale: { value: 1 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(nodeGeo, nodeMat));

    // ── strands ─────────────────────────────────────────────────────────────
    const SAMPLES = cap.curveSamples;
    const VERTS = (SAMPLES - 1) * 2;
    const MAXS = cap.strandBudget;
    const sPos = new Float32Array(MAXS * VERTS * 3);
    const sTint = new Float32Array(MAXS * VERTS * 3);
    const sU = new Float32Array(MAXS * VERTS);
    const sBorn = new Float32Array(MAXS * VERTS);
    const sSeed = new Float32Array(MAXS * VERTS);
    for (let s = 0; s < MAXS; s++) {
      for (let i = 1; i < SAMPLES; i++) {
        const o = s * VERTS + (i - 1) * 2;
        sU[o] = (i - 1) / (SAMPLES - 1);
        sU[o + 1] = i / (SAMPLES - 1);
      }
    }
    const strandGeo = new THREE.BufferGeometry();
    strandGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
    strandGeo.setAttribute('tint', new THREE.BufferAttribute(sTint, 3));
    strandGeo.setAttribute('u', new THREE.BufferAttribute(sU, 1));
    strandGeo.setAttribute('born', new THREE.BufferAttribute(sBorn, 1));
    strandGeo.setAttribute('seed', new THREE.BufferAttribute(sSeed, 1));
    const strandMat = new THREE.ShaderMaterial({
      vertexShader: STRAND_VERT,
      fragmentShader: STRAND_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.LineSegments(strandGeo, strandMat));

    /** Bézier whose control point rides the mean-distance shell (see scene.tsx). */
    const curveInto = (
      out: Float32Array, at: number,
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
    ) => {
      const mx = (ax + bx) * 0.5, my = (ay + by) * 0.5, mz = (az + bz) * 0.5;
      const ml = Math.hypot(mx, my, mz);
      const want = (Math.hypot(ax, ay, az) + Math.hypot(bx, by, bz)) * 0.5;
      const k = ml > 1e-4 ? want / ml : 1;
      const cx = mx * k, cy = my * k, cz = mz * k;
      let px = ax, py = ay, pz = az;
      for (let i = 1; i < SAMPLES; i++) {
        const t = i / (SAMPLES - 1);
        const n1 = 1 - t;
        const w0 = n1 * n1, w1 = 2 * n1 * t, w2 = t * t;
        const qx = w0 * ax + w1 * cx + w2 * bx;
        const qy = w0 * ay + w1 * cy + w2 * by;
        const qz = w0 * az + w1 * cz + w2 * bz;
        const o = at + (i - 1) * 6;
        out[o] = px; out[o + 1] = py; out[o + 2] = pz;
        out[o + 3] = qx; out[o + 4] = qy; out[o + 5] = qz;
        px = qx; py = qy; pz = qz;
      }
    };

    // ── the HUD plate ───────────────────────────────────────────────────────
    //
    //  A 2D canvas laid over the WebGL one, not a texture on a quad. Both are
    //  canvases and neither is DOM chrome, so the mode is still canvas to the
    //  edges — but this one is pixel-exact by construction, needs no projection
    //  to be right, and costs no texture upload per redraw. Sampling the plate
    //  through the 3D pipeline bought nothing and cost a mapping bug.
    const plate = new Plate(host.clientWidth || 390, host.clientHeight || 780, Math.min(cap.dpr, 2));
    plate.canvas.style.position = 'absolute';
    plate.canvas.style.inset = '0';
    plate.canvas.style.width = '100%';
    plate.canvas.style.height = '100%';
    plate.canvas.style.pointerEvents = 'none';
    host.appendChild(plate.canvas);
    let fontsReady = false;
    void ensureFonts().then(() => {
      fontsReady = true;
    });

    // ── the immersion bodies ────────────────────────────────────────────────
    const bodies = new BodyField({
      slots: cap.tier === 'low' ? 7 : 12,
      radius: CELL,
      tier: cap.tier,
    });
    scene.add(bodies.group);
    let cellClock = 0;
    // The immersion last adopted, so approaching the same body twice does not
    // re-announce it.
    let adopted = -1;
    let farTinted = false;
    // How deep inside a body the traveller is, 0 outside and 1 at its centre.
    let inside = 0;

    // ── travel ──────────────────────────────────────────────────────────────
    const byNode = indexStrands(strands);
    /** The neighbourhood's strands, rebuilt when the āyah underfoot changes. */
    const nearStrands: Strand[] = [];
    let strandsFor = -1;
    const pos = new THREE.Vector3(0, 10, 210);
    const vel = new THREE.Vector3();
    const heading = new THREE.Vector3(0, 0, -1);
    const desired = new THREE.Vector3(0, 0, -1);
    const steerAcc = { yaw: 0, pitch: 0 };
    let throttle = 0.55;
    let at = Math.floor(Math.random() * N);
    let course: Course | null = null;
    let visited: number[] = [at];
    let sinceArrival = 0;
    let reason = 'مبتدأ الرحلة';
    const bornAt = new Map<string, number>();

    const target = () => (course ? course.to : at);

    const takeLeg = () => {
      const next = chooseLeg(nodes[at], nodePos, heading, byNode, visited);
      if (!next) return;
      course = next;
      reason = legReason(next);
    };

    const arrive = (i: number) => {
      at = i;
      visited.push(i);
      if (visited.length > 64) visited = visited.slice(-64);
      course = null;
      sinceArrival = 0;
      nodeGlow[i] = 1;
      haptic(18);
      live.current.onArrive(i, reason);
    };

    if (handleRef) {
      handleRef.current = {
        steer: (dx, dy) => {
          steerAcc.yaw -= dx * 0.0042;
          steerAcc.pitch -= dy * 0.0042;
        },
        throttle: (v) => {
          throttle = Math.max(0, Math.min(1, v));
        },
        advance: () => {
          if (!course) takeLeg();
          if (course) arrive(course.to);
        },
        lockAhead: () => {
          // A tap takes a body when one is being looked at — they are out in
          // the field now, so this is the same gesture as reaching an āyah.
          const ray = new THREE.Raycaster();
          ray.setFromCamera(new THREE.Vector2(0, 0), camera);
          const hit = bodies.pick(ray);
          if (hit) {
            haptic([10, 30, 10]);
            live.current.onChooseImmersion(hit);
            return;
          }
          // Whatever lies nearest the reticle becomes the destination.
          let best = -1;
          let bestDot = 0.9;
          const to = new THREE.Vector3();
          for (let i = 0; i < N; i++) {
            if (i === at) continue;
            to.set(nodePos[i * 3] - pos.x, nodePos[i * 3 + 1] - pos.y, nodePos[i * 3 + 2] - pos.z);
            const d = to.length();
            if (d < 4 || d > 260) continue;
            const dot = to.normalize().dot(heading);
            if (dot > bestDot) {
              bestDot = dot;
              best = i;
            }
          }
          if (best >= 0) {
            course = { from: at, to: best, via: null, branch: null };
            reason = 'وِجهةٌ باليد';
          }
        },
      };
    }

    // ── loop ────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock();
    let t = 0;
    let raf = 0;
    let hudDue = 0;
    const tmp = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);

    const resize = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      // updateStyle must stay on. With it off the canvas gets a drawing buffer
      // of w·dpr × h·dpr and no CSS size, so the element lays out at its buffer
      // size — three times too large on a dpr-3 phone, which magnifies and
      // offsets everything drawn over it.
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      plate.resize(w, h, Math.min(cap.dpr, 2));
      hudDue = 0;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const frame = () => {
      const dt = Math.min(0.05, clock.getDelta());
      t += dt;
      sinceArrival += dt;
      const S = live.current;

      if (!course && !S.holding) takeLeg();

      // Heading: the hand turns it, and it eases toward the course.
      const tgt = target();
      desired.set(
        nodePos[tgt * 3] - pos.x,
        nodePos[tgt * 3 + 1] - pos.y,
        nodePos[tgt * 3 + 2] - pos.z,
      );
      const dist = desired.length() || 1;
      desired.normalize();

      // Steering is an offset applied to the heading, not a replacement for it.
      // It decays, so a flick nudges the course rather than seizing it — and
      // since chooseLeg reads the heading, the nudge decides where you arrive.
      q.setFromAxisAngle(up, steerAcc.yaw * dt * 9);
      heading.applyQuaternion(q);
      tmp.crossVectors(heading, up).normalize();
      q.setFromAxisAngle(tmp, steerAcc.pitch * dt * 9);
      heading.applyQuaternion(q);
      steerAcc.yaw *= Math.pow(0.06, dt);
      steerAcc.pitch *= Math.pow(0.06, dt);
      heading.lerp(desired, Math.min(1, dt * (S.holding ? 0.9 : 1.7))).normalize();

      // Velocity: accelerate along the heading, drag, and brake on approach so
      // the vessel settles at the āyah instead of overshooting it.
      const hold = S.holding ? 0.14 : 1;
      const want = throttle * 46 * hold * Math.min(1, dist / 26);
      tmp.copy(heading).multiplyScalar(want);
      vel.lerp(tmp, Math.min(1, dt * 2.4));
      pos.addScaledVector(vel, dt);

      if (dist < ARRIVE_R && !S.holding) arrive(tgt);
      else if (dist < ARRIVE_R * 0.7) {
        // Held by the reciter: orbit rather than push through.
        pos.addScaledVector(tmp.copy(heading).multiplyScalar(-1), dt * 6);
      }

      camera.position.copy(pos);
      camera.lookAt(pos.x + heading.x, pos.y + heading.y, pos.z + heading.z);

      // Dust follows the vessel and streaks with it.
      dustMat.uniforms.uCam.value.copy(pos);
      dustMat.uniforms.uVel.value.copy(vel);
      dustMat.uniforms.uTime.value = t;
      dustMat.uniforms.uStretch.value = Math.min(0.5, vel.length() * 0.009);

      // The āyah you are on burns; the rest cool off.
      for (let i = 0; i < N; i++) nodeGlow[i] *= Math.pow(0.25, dt);
      nodeGlow[at] = 1;
      nodeGlow[tgt] = Math.max(nodeGlow[tgt], 0.55);
      nodeGeo.attributes.glow.needsUpdate = true;
      nodeMat.uniforms.uScale.value = 1;

      // Strands. Previously only those leaving the āyah underfoot, which meant
      // the curves — the whole point of the observatory — were invisible while
      // travelling. Now the neighbourhood: this āyah's relations first, then
      // those of whatever it is flying toward, then its سنابل, to the budget.
      strandMat.uniforms.uTime.value = t;
      if (at !== strandsFor) {
        strandsFor = at;
        const seen = new Set<string>();
        nearStrands.length = 0;
        const take = (list: Strand[] | undefined) => {
          for (const st of list ?? []) {
            if (nearStrands.length >= MAXS || seen.has(st.id)) continue;
            seen.add(st.id);
            nearStrands.push(st);
          }
        };
        take(byNode.get(at));
        if (course) take(byNode.get(course.to));
        for (const j of S.nodes[at].sb) take(byNode.get(j));
      }
      const here = nearStrands;
      const drawn = Math.min(here.length, MAXS);
      for (let k = 0; k < drawn; k++) {
        const st = here[k];
        let b = bornAt.get(st.id);
        if (b === undefined) {
          b = t;
          bornAt.set(st.id, b);
        }
        curveInto(
          sPos, k * VERTS * 3,
          nodePos[st.a * 3], nodePos[st.a * 3 + 1], nodePos[st.a * 3 + 2],
          nodePos[st.b * 3], nodePos[st.b * 3 + 1], nodePos[st.b * 3 + 2],
        );
        const onCourse = course && (st.a === course.to || st.b === course.to);
        const incident = st.a === at || st.b === at;
        const g = (onCourse ? 0.55 : incident ? 0.22 : 0.075) * (0.5 + st.weight * 0.9);
        const seed = (k * 0.137) % 1;
        for (let e = 0; e < VERTS; e++) {
          const vo = (k * VERTS + e) * 3;
          sTint[vo] = GOLD.r * g;
          sTint[vo + 1] = GOLD.g * g;
          sTint[vo + 2] = GOLD.b * g;
          sBorn[k * VERTS + e] = b;
          sSeed[k * VERTS + e] = seed;
        }
      }
      if (bornAt.size > MAXS * 4) bornAt.clear();
      strandGeo.setDrawRange(0, drawn * VERTS);
      strandGeo.attributes.position.needsUpdate = true;
      strandGeo.attributes.tint.needsUpdate = true;
      strandGeo.attributes.born.needsUpdate = true;
      strandGeo.attributes.seed.needsUpdate = true;

      // ── the bodies ────────────────────────────────────────────────────────
      //  Fixed in the world. Cells are re-checked a few times a second, not
      //  every frame: the traveller cannot cross a 340-unit cell faster than
      //  that, and the check walks 75 of them.
      cellClock -= dt;
      if (cellClock <= 0 && S.immersionAt) {
        cellClock = 0.3;
        bodies.occupy(camera, S.immersionAt);
        if (!farTinted && S.zoneHexes.length) {
          bodies.tintFar(S.zoneHexes);
          farTinted = true;
        }
      }
      bodies.update(dt, t, 1, camera, S.activeImmersion);

      // Adoption by arrival. There is no menu and no confirming gesture: coming
      // within reach of a body *is* choosing it, so the traveller changes what
      // the realm is by going somewhere, which is the only verb there is.
      // Inside is a place, not a boundary crossed. Depth drives the light, so
      // entering a body is a continuous arrival rather than a switch.
      const depth = bodies.depthWithin(pos);
      inside += (depth - inside) * Math.min(1, dt * 2.2);
      const body = bodies.within(pos, CELL * 0.9);
      if (body) {
        const c = new THREE.Color(body.palette.hexes[0]);
        // The body's own light takes over the dust and the fog as you go in.
        dustMat.uniforms.uTint.value.lerpColors(GOLD, c, inside * 0.9);
        (scene.fog as THREE.FogExp2).density = 0.0022 + inside * 0.004;
      } else {
        dustMat.uniforms.uTint.value.lerp(GOLD, Math.min(1, dt * 2));
        (scene.fog as THREE.FogExp2).density = 0.0022;
      }

      const inReach = bodies.within(pos, CELL * 0.42);
      if (inReach && inReach.index !== adopted) {
        adopted = inReach.index;
        haptic([8, 24, 8]);
        S.onChooseImmersion(inReach);
      }

      // The plate is a full texture upload; four times a second is plenty for
      // content that is words, and sixty would cost more than the field does.
      hudDue -= dt;
      if (fontsReady && hudDue <= 0) {
        hudDue = 0.25;
        const aimed = bodies.within(pos, CELL * 0.42) ?? bodies.nearestToward(camera, heading);
        drawHud(plate, {
          ...S.hud,
          node: nodes[at] ?? null,
          reason,
          distance: dist,
          throttle,
          sinceArrival,
          choosing: false,
          aimed,
          aimedDistance: bodies.distanceTo(aimed, pos),
          inside,
        });
      }

      renderer.render(scene, camera);
      if (!disposed) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') cancelAnimationFrame(raf);
      else {
        clock.getDelta();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
      renderer.dispose();
      dustGeo.dispose();
      dustMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      strandGeo.dispose();
      strandMat.dispose();
      bodies.dispose();
      plate.dispose();
      plate.canvas.remove();
      host.removeChild(renderer.domElement);
      if (handleRef) handleRef.current = null;
    };
  }, [nodes, sky, strands, cap, handleRef]);

  return <div ref={mount} className="absolute inset-0" />;
}
