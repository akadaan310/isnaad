'use client';
// ============================================================================
//  أجسامُ المنازل — the menu, as bodies in the field.
//
//  Not a panel over the universe. When the traveller asks to choose, solids
//  form in the space around them, each one a surface generated from its own
//  immersion — and each is tapped where it floats, by raycast, in the same
//  WebGL scene the journey happens in. There is no second surface and nothing
//  is laid on top.
//
//  The ring is a window onto an unbounded sequence, not a page of it. Steering
//  rotates the offset, bodies at the trailing edge are rebuilt as the leading
//  ones, and the sequence continues as far as it is turned.
// ============================================================================
import * as THREE from 'three';
import type { Immersion } from '@/lib/cosmos/immersion';
import { buildSurface, morphologyFor, type Morphology } from '@/lib/cosmos/morphogen';

const BODY_VERT = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  uniform float uOpen;     // 0 … 1, the spring that brings the body into being
  uniform float uTime;
  uniform float uSeed;
  void main() {
    // Forming, not fading in: the surface swells from a point and the normals
    // come with it, so the light on it is the light on the real solid at every
    // moment of its arrival.
    vec3 p = position * uOpen;
    // A slow breath along the normal — the body is never quite still.
    p += normal * sin(uTime * 0.6 + uSeed * 6.2831 + position.y * 2.0) * 0.012 * uOpen;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const BODY_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vN;
  varying vec3 vV;
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uSelected;
  void main() {
    // Fresnel: grazing angles carry the light. A solid lit this way reads as
    // volume rather than as a lit polygon, and needs no light source to place.
    float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
    float rim = pow(f, 2.6);
    float core = pow(max(0.0, dot(normalize(vN), normalize(vV))), 2.0) * 0.16;
    // Dim. Additive blending sums the near and far faces of every body and
    // then sums the bodies over each other; at the brightness a single lit
    // surface wants, a dozen of them go white.
    vec3 c = mix(uColor, uEdge, rim) * (core + rim * 0.42);
    gl_FragColor = vec4(c * (1.0 + uSelected * 1.6), 1.0);
  }
`;

interface Slot {
  mesh: THREE.Mesh;
  /** The parametric grid, which is what actually makes the form readable. */
  wire: THREE.LineSegments;
  material: THREE.ShaderMaterial;
  wireMaterial: THREE.ShaderMaterial;
  geometry: THREE.BufferGeometry;
  immersion: Immersion | null;
  /** The cell of space this slot is currently showing, or null. */
  cell: string | null;
  /** World position, fixed while the cell is occupied. */
  at: THREE.Vector3;
  radius: number;
  open: number;
  seed: number;
}

/**
 * Side of a cell of space, in field units. One body occupies one cell, so the
 * count is unbounded in exactly the way space is: there is no list of bodies
 * and no last one, only whichever cells are near enough to have formed.
 */
export const CELL = 340;

/**
 * The far field. Thousands of bodies at once cannot each be a tessellated
 * surface — that is tens of millions of triangles — so distance decides what a
 * body *is*:
 *
 *   far    one point, coloured by its zone's measured starlight
 *   near   the full parametric surface and its construction grid
 *
 * The near ones are the same objects resolved, not different objects: both are
 * placed by the same hash over the same cells, so a far point becomes the body
 * you fly into.
 */
const FAR_BOX = 11000;

const FAR_VERT = /* glsl */ `
  attribute vec3 tint;
  attribute float bright;
  varying vec3 vTint;
  varying float vA;
  uniform vec3 uCam;
  uniform float uBox;
  uniform float uScale;
  void main() {
    // Wrapped around the traveller, like the dust: the same bodies are reused
    // forever, so the field has no edge to reach and no count to exhaust.
    vec3 rel = position - uCam + uBox * 0.5;
    rel = mod(rel, uBox);
    vec3 p = rel - uBox * 0.5 + uCam;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float d = max(1.0, -mv.z);
    // Inverse-square, as light is: a body twice as far is a quarter as bright.
    vA = bright * clamp(40000.0 / (d * d), 0.02, 1.0);
    vTint = tint;
    gl_PointSize = clamp(uScale * 9000.0 / d, 1.0, 34.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FAR_FRAG = /* glsl */ `
  precision mediump float;
  varying vec3 vTint;
  varying float vA;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    if (r > 0.5) discard;
    float core = pow(smoothstep(0.5, 0.0, r), 2.2);
    gl_FragColor = vec4(vTint * core * vA, 1.0);
  }
`;

/** Deterministic per-cell hash — the same cell is the same body, forever. */
function cellHash(i: number, j: number, k: number): number {
  let h = 2166136261 ^ Math.imul(i | 0, 0x27d4eb2d);
  h = Math.imul(h ^ (j | 0), 0x165667b1);
  h = Math.imul(h ^ (k | 0), 0x9e3779b1);
  h ^= h >>> 15;
  return h >>> 0;
}

export interface BodyFieldOptions {
  slots: number;
  radius: number;
  tier: 'low' | 'mid' | 'high';
}



export class BodyField {
  readonly group = new THREE.Group();
  private far: THREE.Points | null = null;
  private farMat: THREE.ShaderMaterial | null = null;
  private slots: Slot[] = [];
  private cache = new Map<
    number,
    { geometry: THREE.BufferGeometry; wire: THREE.BufferGeometry; morphology: Morphology }
  >();
  private opt: BodyFieldOptions;
  private opening = 0;
  private scratch = new THREE.Vector3();

  constructor(opt: BodyFieldOptions) {
    this.opt = opt;
    this.buildFar();
    for (let i = 0; i < opt.slots; i++) {
      const material = new THREE.ShaderMaterial({
        vertexShader: BODY_VERT,
        fragmentShader: BODY_FRAG,
        uniforms: {
          uOpen: { value: 0 },
          uTime: { value: 0 },
          uSeed: { value: Math.random() },
          uColor: { value: new THREE.Color('#C8A45C') },
          uEdge: { value: new THREE.Color('#ffffff') },
          uSelected: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const wireMaterial = material.clone();
      wireMaterial.uniforms.uSelected = { value: 0 };
      const geometry = new THREE.BufferGeometry();
      const mesh = new THREE.Mesh(geometry, material);
      const wire = new THREE.LineSegments(geometry, wireMaterial);
      mesh.visible = false;
      wire.visible = false;
      mesh.frustumCulled = false;
      wire.frustumCulled = false;
      this.group.add(mesh);
      this.group.add(wire);
      this.slots.push({
        mesh,
        wire,
        material,
        wireMaterial,
        geometry,
        immersion: null,
        cell: null,
        at: new THREE.Vector3(),
        radius: 1,
        open: 0,
        seed: Math.random(),
      });
    }
  }

  /**
   * The distant thousands. Placed once over a volume far larger than anything
   * the traveller will cross, then wrapped, so the count is fixed and the
   * supply is not.
   */
  private buildFar() {
    const N = this.opt.tier === 'low' ? 1800 : this.opt.tier === 'mid' ? 4500 : 9000;
    const pos = new Float32Array(N * 3);
    const tint = new Float32Array(N * 3);
    const bright = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const h = cellHash(i, i * 7919, i * 104729);
      const u = ((h >>> 2) % 10000) / 10000;
      const v = ((h >>> 12) % 10000) / 10000;
      const w = ((h >>> 22) % 1000) / 1000;
      pos[i * 3] = (u - 0.5) * FAR_BOX;
      pos[i * 3 + 1] = (v - 0.5) * FAR_BOX * 0.42;
      pos[i * 3 + 2] = (w - 0.5) * FAR_BOX;
      // Colour is the zone's own measured light, set once the lights arrive.
      tint[i * 3] = 0.78;
      tint[i * 3 + 1] = 0.66;
      tint[i * 3 + 2] = 0.42;
      bright[i] = 0.35 + ((h >>> 5) % 1000) / 1000;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    g.setAttribute('bright', new THREE.BufferAttribute(bright, 1));
    this.farMat = new THREE.ShaderMaterial({
      vertexShader: FAR_VERT,
      fragmentShader: FAR_FRAG,
      uniforms: {
        uCam: { value: new THREE.Vector3() },
        uBox: { value: FAR_BOX },
        uScale: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.far = new THREE.Points(g, this.farMat);
    this.far.frustumCulled = false;
    this.group.add(this.far);
  }

  /** Paint the far field with the zones' real colours, once they are measured. */
  tintFar(hexes: string[]) {
    if (!this.far || !hexes.length) return;
    const attr = this.far.geometry.getAttribute('tint') as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < attr.count; i++) {
      c.set(hexes[cellHash(i, i * 7919, i * 104729) % hexes.length]);
      attr.setXYZ(i, c.r, c.g, c.b);
    }
    attr.needsUpdate = true;
  }

  /** Build or recall a surface. Tessellation is the expensive part; cache it. */
  private surfaceFor(index: number) {
    const hit = this.cache.get(index);
    if (hit) return hit;
    const morphology = morphologyFor((index * 2654435761) >>> 0, this.opt.tier);
    const s = buildSurface(morphology);
    const g = new THREE.BufferGeometry();
    // Normalised so a spiky harmonic and a round superformula occupy the same
    // space — otherwise the body's size would encode its exponents, which mean
    // nothing about the immersion.
    const k = 1 / s.extent;
    const scaled = new Float32Array(s.positions.length);
    for (let i = 0; i < s.positions.length; i++) scaled[i] = s.positions[i] * k;
    g.setAttribute('position', new THREE.BufferAttribute(scaled, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
    g.computeBoundingSphere();
    // The grid shares the positions and differs only in how they are joined.
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.BufferAttribute(scaled, 3));
    wireGeo.setAttribute('normal', new THREE.BufferAttribute(s.normals, 3));
    wireGeo.setIndex(new THREE.BufferAttribute(s.wire, 1));
    wireGeo.computeBoundingSphere();
    // Bounded: a long scroll would otherwise hold every body ever formed.
    if (this.cache.size > 48) {
      const oldest = this.cache.keys().next().value as number | undefined;
      if (oldest !== undefined) {
        const old = this.cache.get(oldest);
        old?.geometry.dispose();
        old?.wire.dispose();
        this.cache.delete(oldest);
      }
    }
    const entry = { geometry: g, wire: wireGeo, morphology };
    this.cache.set(index, entry);
    return entry;
  }

  /**
   * Fill the slots from the cells nearest the traveller.
   *
   * Bodies are placed in the world, not around the camera. Parented to the
   * camera they travelled with the vessel and could never be approached — they
   * were a menu wearing the costume of a place. On a spatial hash they are
   * places: each cell of space holds one, always the same one, and flying
   * somewhere else brings different ones within reach.
   */
  occupy(camera: THREE.Camera, at: (index: number) => Immersion) {
    const REACH = 3;
    const p = camera.position;
    const ci = Math.round(p.x / CELL);
    const cj = Math.round(p.y / CELL);
    const ck = Math.round(p.z / CELL);

    const near: { key: string; pos: THREE.Vector3; index: number; d: number }[] = [];
    for (let i = ci - REACH; i <= ci + REACH; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (let k = ck - REACH; k <= ck + REACH; k++) {
          const h = cellHash(i, j, k);
          // Two cells in three hold nothing. A body in every cell is a lattice;
          // the gaps are what make the field read as space with things in it.
          if (h % 3 !== 0) continue;
          const jx = ((h >>> 3) % 1000) / 1000 - 0.5;
          const jy = ((h >>> 11) % 1000) / 1000 - 0.5;
          const jz = ((h >>> 19) % 1000) / 1000 - 0.5;
          const pos = new THREE.Vector3(
            (i + jx * 0.7) * CELL,
            (j + jy * 0.5) * CELL,
            (k + jz * 0.7) * CELL,
          );
          near.push({ key: `${i},${j},${k}`, pos, index: h % 100000, d: pos.distanceTo(p) });
        }
      }
    }
    near.sort((a, b) => a.d - b.d);
    const chosen = near.slice(0, this.slots.length);
    const wanted = new Set(chosen.map((c) => c.key));

    // Slots already showing a wanted cell keep it; the rest are recycled, so a
    // body that stays in range is never rebuilt and never flickers.
    const free = this.slots.filter((s) => !s.cell || !wanted.has(s.cell));
    const held = new Set(this.slots.filter((s) => s.cell && wanted.has(s.cell)).map((s) => s.cell));

    for (const c of chosen) {
      if (held.has(c.key)) continue;
      const slot = free.shift();
      if (!slot) break;
      const imm = at(c.index);
      slot.cell = c.key;
      slot.immersion = imm;
      slot.at.copy(c.pos);
      // Large enough to be entered. A body smaller than the distance you stop
      // at is an object you look at; one this size is a place you end up
      // inside, which is what the traveller can then explore.
      slot.radius = CELL * (0.34 + imm.zone.density * 0.05);
      const surf = this.surfaceFor(c.index);
      slot.mesh.geometry = surf.geometry;
      slot.wire.geometry = surf.wire;
      for (const m of [slot.material, slot.wireMaterial]) {
        m.uniforms.uColor.value.set(imm.palette.hexes[0]);
        m.uniforms.uEdge.value.set(imm.palette.hexes[1] ?? imm.palette.hexes[0]);
        m.uniforms.uSeed.value = (c.index % 97) / 97;
      }
    }
    for (const slot of free) {
      if (slot.cell && !wanted.has(slot.cell)) slot.cell = null;
    }
  }

  /** @param open 0 hides the field, 1 brings it fully into being. */
  update(dt: number, t: number, open: number, camera: THREE.Camera, selectedIndex: number) {
    // A damped approach rather than a cut: the bodies arrive and leave under
    // the same second-order response as everything else in the vessel.
    this.opening += (open - this.opening) * Math.min(1, dt * 4.5);
    if (this.farMat) {
      this.farMat.uniforms.uCam.value.copy(camera.position);
      this.farMat.uniforms.uScale.value = this.opening;
    }
    this.group.visible = this.opening > 0.002;
    if (!this.group.visible) {
      for (const s of this.slots) {
        s.mesh.visible = false;
        s.wire.visible = false;
      }
      return;
    }

    this.slots.forEach((slot, i) => {
      const has = slot.cell !== null;
      // Each body forms on its own clock rather than the field's, so they come
      // into being scattered in time as well as in space.
      const local = has ? this.opening : 0;
      slot.open = local;
      slot.mesh.visible = has && local > 0.01;
      slot.wire.visible = slot.mesh.visible;
      if (!slot.mesh.visible) return;

      const chosen = slot.immersion?.index === selectedIndex ? 1 : 0;
      for (const m of [slot.material, slot.wireMaterial]) {
        m.uniforms.uOpen.value = local;
        m.uniforms.uTime.value = t;
        m.uniforms.uSelected.value = chosen;
      }

      // Fixed in the world. Only the drift is time-dependent, and it is small
      // enough that a body stays somewhere you can fly back to.
      slot.mesh.position.copy(slot.at);
      slot.mesh.position.y += Math.sin(t * 0.17 + i) * 3;
      slot.mesh.scale.setScalar(slot.radius);
      slot.mesh.rotation.y = t * (slot.immersion?.spin ?? 0.1) * 0.4 + i;
      slot.mesh.rotation.x = Math.sin(t * 0.11 + i) * 0.4;
      slot.wire.position.copy(slot.mesh.position);
      slot.wire.scale.copy(slot.mesh.scale);
      slot.wire.rotation.copy(slot.mesh.rotation);
    });
    void camera;
  }

  /** Which body a ray strikes, if any. */
  pick(raycaster: THREE.Raycaster): Immersion | null {
    const live = this.slots.filter((s) => s.mesh.visible);
    const hits = raycaster.intersectObjects(live.map((s) => s.mesh), false);
    if (!hits.length) return null;
    return this.slots.find((s) => s.mesh === hits[0].object)?.immersion ?? null;
  }

  /**
   * The body being looked at, for labelling — nearest along the heading rather
   * than nearest in space, and weighted toward the close ones so a distant body
   * in line does not outrank one you are about to reach.
   */
  nearestToward(camera: THREE.Camera, dir: THREE.Vector3): Immersion | null {
    let best: Immersion | null = null;
    let bestScore = 0;
    for (const s of this.slots) {
      if (!s.mesh.visible || !s.immersion) continue;
      this.scratch.copy(s.mesh.position).sub(camera.position);
      const d = this.scratch.length() || 1;
      const dot = this.scratch.divideScalar(d).dot(dir);
      if (dot < 0.8) continue;
      const score = dot / (1 + d / (CELL * 2));
      if (score > bestScore) {
        bestScore = score;
        best = s.immersion;
      }
    }
    return best;
  }

  /** The body the traveller is inside the reach of, if any. */
  within(p: THREE.Vector3, reach: number): Immersion | null {
    let best: Immersion | null = null;
    let bestD = reach;
    for (const s of this.slots) {
      if (!s.mesh.visible || !s.immersion) continue;
      const d = s.mesh.position.distanceTo(p);
      if (d < bestD) {
        bestD = d;
        best = s.immersion;
      }
    }
    return best;
  }

  /** How deep inside the nearest body the traveller is: 0 outside, 1 at centre. */
  depthWithin(p: THREE.Vector3): number {
    let deepest = 0;
    for (const s of this.slots) {
      if (!s.mesh.visible) continue;
      const d = s.mesh.position.distanceTo(p);
      if (d < s.radius) deepest = Math.max(deepest, 1 - d / s.radius);
    }
    return deepest;
  }

  /** Distance to the body being looked at, for the approach ring. */
  distanceTo(imm: Immersion | null, from: THREE.Vector3): number {
    if (!imm) return Infinity;
    const s = this.slots.find((x) => x.immersion?.index === imm.index && x.mesh.visible);
    return s ? s.mesh.position.distanceTo(from) : Infinity;
  }

  dispose() {
    for (const s of this.slots) {
      s.material.dispose();
      s.wireMaterial.dispose();
      s.geometry.dispose();
    }
    for (const c of this.cache.values()) {
      c.geometry.dispose();
      c.wire.dispose();
    }
    this.far?.geometry.dispose();
    this.farMat?.dispose();
    this.cache.clear();
  }
}
