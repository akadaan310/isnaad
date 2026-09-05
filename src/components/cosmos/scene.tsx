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

export type Pov = 'mutakallim' | 'mukhatab' | 'ghaib' | 'free';

const PERSON_COLOR: Record<number, THREE.Color> = {
  1: new THREE.Color('#D97706'),
  2: new THREE.Color('#059669'),
  3: new THREE.Color('#0284C7'),
};
const NEUTRAL = new THREE.Color('#94A3B8');

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
  onPick: (index: number) => void;
  sceneRef?: React.MutableRefObject<SceneHandle | null>;
}) {
  const mount = React.useRef<HTMLDivElement>(null);
  const labelHost = React.useRef<HTMLDivElement>(null);

  // Everything the animation loop needs, without re-creating the scene.
  const live = React.useRef({ focus, pov, sullam, burn, visible, showFigures, onPick, nodes });
  live.current = { focus, pov, sullam, burn, visible, showFigures, onPick, nodes };

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
    const clock = new THREE.Clock();

    const animate = () => {
      const dt = Math.min(0.05, clock.getDelta());
      t += dt;
      const S = live.current;

      // السُّلَّم rescales the radius axis: climbing pushes الغيبة outward and
      // draws المناجاة in, so the ladder is a lens on the same space.
      if (S.sullam !== lastSullam) {
        lastSullam = S.sullam;
        for (let i = 0; i < N; i++) {
          const bx = basePos[i * 3];
          const by = basePos[i * 3 + 1];
          const bz = basePos[i * 3 + 2];
          const r = Math.hypot(bx, by, bz) || 1;
          const nr = 18 + (r - 18) * S.sullam;
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
