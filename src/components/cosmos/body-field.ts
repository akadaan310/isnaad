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
  /** Where on the ring this slot sits, in radians. */
  angle: number;
  open: number;
  seed: number;
}

export interface BodyFieldOptions {
  slots: number;
  radius: number;
  tier: 'low' | 'mid' | 'high';
}

/**
 * Angular pitch between neighbouring bodies. Spread over a full circle, only
 * one body ever fell inside the field of view and the menu looked like a single
 * object; at this pitch three or four are in sight and the rest curve away, so
 * it reads as something to turn through.
 */
export const SLOT_PITCH = 0.52;

export class BodyField {
  readonly group = new THREE.Group();
  private slots: Slot[] = [];
  private cache = new Map<
    number,
    { geometry: THREE.BufferGeometry; wire: THREE.BufferGeometry; morphology: Morphology }
  >();
  private opt: BodyFieldOptions;
  /** Which immersion sits in slot 0. Advancing this scrolls the sequence. */
  offset = 0;
  private opening = 0;

  constructor(opt: BodyFieldOptions) {
    this.opt = opt;
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
        // Floor, not a half-step: with an even slot count, centring on
        // (slots−1)/2 puts no body on the axis and the nearest one always sat
        // half a pitch off the reticle.
        angle: (i - Math.floor(opt.slots / 2)) * SLOT_PITCH,
        open: 0,
        seed: Math.random(),
      });
    }
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

  /** Point each slot at its immersion, rebuilding only what changed. */
  populate(at: (index: number) => Immersion) {
    this.slots.forEach((slot, i) => {
      const index = this.offset + i;
      if (slot.immersion?.index === index) return;
      const imm = at(index);
      slot.immersion = imm;
      const surf = this.surfaceFor(index);
      slot.mesh.geometry = surf.geometry;
      slot.wire.geometry = surf.wire;
      for (const m of [slot.material, slot.wireMaterial]) {
        m.uniforms.uColor.value.set(imm.palette.hexes[0]);
        m.uniforms.uEdge.value.set(imm.palette.hexes[1] ?? imm.palette.hexes[0]);
        m.uniforms.uSeed.value = (index % 97) / 97;
      }
    });
  }

  /**
   * @param open  0 hides the field, 1 brings it fully into being.
   * @param spin  the ring's own rotation, radians.
   */
  update(dt: number, t: number, open: number, spin: number, selectedIndex: number) {
    // A damped approach rather than a cut: the bodies arrive and leave under
    // the same second-order response as everything else in the vessel.
    this.opening += (open - this.opening) * Math.min(1, dt * 4.5);
    this.group.visible = this.opening > 0.002;
    if (!this.group.visible) {
      for (const s of this.slots) {
        s.mesh.visible = false;
        s.wire.visible = false;
      }
      return;
    }

    const R = this.opt.radius;
    this.slots.forEach((slot, i) => {
      const a = slot.angle + spin;
      // Staggered, so the ring assembles rather than appearing at once.
      const delay = (i / this.slots.length) * 0.35;
      const local = Math.max(0, Math.min(1, (this.opening - delay) / (1 - delay || 1)));
      slot.open = local;
      slot.mesh.visible = local > 0.01;
      slot.wire.visible = local > 0.01;
      const chosen = slot.immersion?.index === selectedIndex ? 1 : 0;
      for (const m of [slot.material, slot.wireMaterial]) {
        m.uniforms.uOpen.value = local;
        m.uniforms.uTime.value = t;
        m.uniforms.uSelected.value = chosen;
      }

      // Laid out in the traveller's own frame — the group is parented to the
      // camera each frame — and on an arc in front of them rather than a ring
      // around the origin. A ring around the origin is invisible from a vessel
      // that is two hundred units away from it, which is where it always is.
      //
      // −Z is forward in camera space. The arc spans the view and curves away
      // at its ends, so turning brings new bodies round rather than sliding a
      // strip past.
      // The centred slot sits on the axis; its neighbours step away above and
      // below, so the row offset never pushes the aimed body off the reticle.
      const off = i - Math.floor(this.opt.slots / 2);
      slot.mesh.position.set(
        Math.sin(a) * R,
        (off % 2 === 0 ? 1 : -1) * Math.min(2, Math.abs(off)) * R * 0.075 +
          Math.sin(t * 0.3 + i) * 1.2,
        -Math.cos(a) * R,
      );
      const scale = R * 0.105 * (0.8 + (slot.immersion?.zone.density ?? 1) * 0.04);
      slot.mesh.scale.setScalar(scale);
      slot.mesh.rotation.y = t * (slot.immersion?.spin ?? 0.1) + i;
      slot.mesh.rotation.x = Math.sin(t * 0.21 + i) * 0.5;
      slot.wire.position.copy(slot.mesh.position);
      slot.wire.scale.copy(slot.mesh.scale);
      slot.wire.rotation.copy(slot.mesh.rotation);
    });
  }

  /** Which body a ray strikes, if any. */
  pick(raycaster: THREE.Raycaster): Immersion | null {
    const live = this.slots.filter((s) => s.mesh.visible);
    const hits = raycaster.intersectObjects(live.map((s) => s.mesh), false);
    if (!hits.length) return null;
    return this.slots.find((s) => s.mesh === hits[0].object)?.immersion ?? null;
  }

  /** The body nearest the centre of view, for labelling. */
  nearestToward(camera: THREE.Camera, dir: THREE.Vector3): Immersion | null {
    let best: Immersion | null = null;
    // A cone of roughly 30°. Tighter than this and nothing is ever labelled on
    // a phone, where the body is rarely dead centre; wider and a neighbour two
    // slots away claims the reticle.
    let bestDot = 0.86;
    const to = new THREE.Vector3();
    for (const s of this.slots) {
      if (!s.mesh.visible || !s.immersion) continue;
      to.copy(s.mesh.position).sub(camera.position).normalize();
      const d = to.dot(dir);
      if (d > bestDot) {
        bestDot = d;
        best = s.immersion;
      }
    }
    return best;
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
    this.cache.clear();
  }
}
