/**
 * The ball as a character, and what happens at every contact.
 *
 * BallVisual wraps the loaded ball: it spins at a capped rate so the band reads, squashes along
 * the impact normal with a damped spring, stretches along its velocity when fast, wears a halo
 * ring perpendicular to its spin axis, and drags a camera-facing ribbon coloured by spin type
 * (orange topspin, cyan backspin, green sidespin). Impacts owns the pooled contact rings and
 * sparks. Everything here is built from Three.js constructors; nothing is a file.
 */
import * as THREE from 'three';
import { BALL, PALETTE, clamp } from './consts.js';

const UP = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _col = new THREE.Color();
const TOP = new THREE.Color(PALETTE.orange), BACK = new THREE.Color(PALETTE.cyan), SIDE = new THREE.Color(0x9cff5a), NONE = new THREE.Color(0xffffff);

class Trail {
  constructor(scene, n = 22) {
    this.n = n; this.pts = [];
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.colors = new Float32Array(n * 2 * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const idx = [];
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.mesh.visible = false;
  }
  push(p, t, speed) {
    const last = this.pts[0];
    if (last && last.p.distanceToSquared(p) < 1e-6) return;
    this.pts.unshift({ p: p.clone(), t, s: speed });
    while (this.pts.length > this.n) this.pts.pop();
  }
  clear() { this.pts.length = 0; this.mesh.visible = false; }
  update(now, camera, color, strength) {
    while (this.pts.length && now - this.pts[this.pts.length - 1].t > 0.14) this.pts.pop();
    const n = this.pts.length;
    if (n < 2 || strength <= 0.01) { this.mesh.visible = false; return; }
    this.mesh.visible = true;
    const camDir = _c;
    for (let i = 0; i < this.n; i++) {
      const k = Math.min(i, n - 1), pt = this.pts[k];
      const prev = this.pts[Math.max(0, k - 1)].p, next = this.pts[Math.min(n - 1, k + 1)].p;
      _a.copy(prev).sub(next);
      if (_a.lengthSq() < 1e-8) _a.set(0, 0, 1);
      camDir.copy(camera.position).sub(pt.p);
      _b.crossVectors(_a, camDir).normalize();
      const fade = 1 - k / Math.max(1, n - 1);
      const w = (0.018 + 0.03 * strength) * (0.25 + 0.75 * fade);
      const o = i * 6;
      this.pos[o] = pt.p.x + _b.x * w; this.pos[o + 1] = pt.p.y + _b.y * w; this.pos[o + 2] = pt.p.z + _b.z * w;
      this.pos[o + 3] = pt.p.x - _b.x * w; this.pos[o + 4] = pt.p.y - _b.y * w; this.pos[o + 5] = pt.p.z - _b.z * w;
      const f = Math.pow(fade, 1.6) * strength;
      for (let j = 0; j < 2; j++) { this.colors[o + j * 3] = color.r * f; this.colors[o + j * 3 + 1] = color.g * f; this.colors[o + j * 3 + 2] = color.b * f; }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}

export class BallVisual {
  constructor(asset, scene, camera) {
    this.camera = camera;
    this.root = new THREE.Group();          // world position
    this.squashG = new THREE.Group();       // oriented along the squash/stretch axis
    this.spinG = new THREE.Group();         // rotates with the ball
    this.root.add(this.squashG); this.squashG.add(this.spinG);
    asset.position.set(0, -BALL.R, 0);      // the loader rests it on y = 0; centre it
    this.spinG.add(asset);
    // where the ball is hidden behind something, a glowing ring shows through: the ring is
    // drawn only where the depth buffer already holds something nearer (GreaterDepth)
    this.xray = new THREE.Mesh(new THREE.RingGeometry(BALL.R * 1.15, BALL.R * 1.6, 32), new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.9, depthTest: true, depthWrite: false, depthFunc: THREE.GreaterDepth, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.xray.renderOrder = 12;
    scene.add(this.xray);
    scene.add(this.root);
    this.halo = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0025, 6, 32), new THREE.MeshBasicMaterial({ color: PALETTE.orange, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.halo.renderOrder = 4;
    this.root.add(this.halo);
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = 1;
    scene.add(this.shadow);
    this.trail = new Trail(scene);
    this.squash = 0; this.sqA = 0; this.sqT = 9; this.axis = new THREE.Vector3(0, 1, 0);
    this.spinColor = new THREE.Color(0xffffff);
    this.haloAngle = 0; this.flashT = 0;
  }
  /** A white pop of the halo: the timing cue at the top of a toss. */
  flash() { this.flashT = 0.25; }
  impact(normal, strength) {
    this.axis.copy(normal).normalize();
    this.sqA = Math.max(this.sqA * Math.exp(-this.sqT * 12), clamp(strength, 0.08, 0.4));
    this.sqT = 0;
  }
  /** Colour by what the spin does to a ball travelling along v. */
  colorFor(w, v) {
    const ws = w.length();
    if (ws < 25 || v.lengthSq() < 0.01) return NONE;
    _a.copy(v).normalize();
    const side = Math.abs(w.y) / ws;
    _b.crossVectors(w, _a);                       // Magnus direction
    const lift = _b.y / ws;                       // +: floats (backspin), -: dives (topspin)
    _col.copy(NONE);
    if (side > 0.6) _col.copy(SIDE);
    else if (lift < -0.15) _col.copy(TOP);
    else if (lift > 0.15) _col.copy(BACK);
    else _col.lerpColors(NONE, SIDE, side);
    return _col;
  }
  update(dt, ball, now, visible, tableY) {
    this.root.visible = visible; this.shadow.visible = visible; this.xray.visible = visible;
    if (!visible) { this.trail.clear(); this.halo.material.opacity = 0; return; }
    this.root.position.copy(ball.p);
    this.xray.position.copy(ball.p);
    this.xray.lookAt(this.camera.position);
    this.xray.material.opacity = 0.7 + 0.25 * Math.sin(now * 14);
    // spin: real axis, capped visual rate so direction reads instead of strobing
    const ws = ball.w.length();
    if (ws > 1) {
      _a.copy(ball.w).divideScalar(ws);
      this.spinG.getWorldQuaternion(_q).invert();
      _b.copy(_a).applyQuaternion(_q);
      this.spinG.rotateOnAxis(_b, Math.min(ws, 28) * dt);
    }
    // squash: a closed-form damped wobble, stable at any frame rate
    this.sqT += dt;
    this.squash = this.sqT < 0.5 ? this.sqA * Math.exp(-this.sqT * 12) * Math.cos(this.sqT * 30) : 0;
    const speed = ball.v.length();
    const stretch = clamp(speed / 75, 0, 0.28);
    if (Math.abs(this.squash) > 0.01) {
      this.squashG.quaternion.setFromUnitVectors(Z, this.axis);
      const s = this.squash;
      this.squashG.scale.set(1 + s * 0.5, 1 + s * 0.5, 1 - s);
    } else if (speed > 4) {
      _a.copy(ball.v).normalize();
      this.squashG.quaternion.setFromUnitVectors(Z, _a);
      this.squashG.scale.set(1 - stretch * 0.4, 1 - stretch * 0.4, 1 + stretch);
    } else { this.squashG.quaternion.identity(); this.squashG.scale.set(1, 1, 1); }
    // halo: perpendicular to the spin axis, brighter with spin
    const col = this.colorFor(ball.w, ball.v);
    this.spinColor.lerp(col, 1 - Math.exp(-10 * dt));
    let haloOp = clamp((ws - 60) / 450, 0, 0.75);
    this.halo.material.color.copy(this.spinColor);
    if (this.flashT > 0) { this.flashT -= dt; haloOp = Math.max(haloOp, 0.9 * (this.flashT / 0.25)); this.halo.material.color.setHex(0xffffff); this.halo.scale.setScalar(1.6 - this.flashT); }
    this.halo.material.opacity = haloOp;
    if (ws > 1) { _a.copy(ball.w).normalize(); this.halo.quaternion.setFromUnitVectors(Z, _a); }
    this.haloAngle += dt * 4;
    if (!(this.flashT > 0)) this.halo.scale.setScalar(1 + 0.08 * Math.sin(this.haloAngle * 3));
    // ground shadow
    const overTable = Math.abs(ball.p.x) < 0.7625 && Math.abs(ball.p.z) < 1.37 && ball.p.y > tableY;
    const gy = overTable ? tableY + 0.002 : 0.003;
    const h = Math.max(0, ball.p.y - gy);
    this.shadow.position.set(ball.p.x, gy, ball.p.z);
    const sc = 1 + h * 1.4;
    this.shadow.scale.set(sc, sc, 1);
    this.shadow.material.opacity = clamp(0.4 - h * 0.18, 0.06, 0.4);
    // trail
    this.trail.push(ball.p, now, speed);
    const strength = clamp((speed - 3) / 16, 0, 1);
    this.trail.update(now, this.camera, this.spinColor, strength);
  }
}

export class Impacts {
  constructor(scene) {
    this.scene = scene;
    this.rings = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false; m.renderOrder = 6;
      scene.add(m);
      this.rings.push({ m, t: 1, life: 0.25, size: 0.1 });
    }
    this.sparks = [];
    const sg = new THREE.BoxGeometry(0.004, 0.004, 0.035);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      m.visible = false; m.renderOrder = 6;
      scene.add(m);
      this.sparks.push({ m, v: new THREE.Vector3(), t: 1, life: 0.3 });
    }
  }
  ring(point, normal, color, size, life = 0.25) {
    let r = this.rings.find((x) => x.t >= 1) || this.rings[0];
    r.t = 0; r.life = life; r.size = size;
    r.m.position.copy(point); r.m.quaternion.setFromUnitVectors(Z, _a.copy(normal).normalize());
    r.m.material.color.set(color); r.m.visible = true;
  }
  burst(point, normal, color, n, speed) {
    let made = 0;
    for (const s of this.sparks) {
      if (s.t < 1) continue;
      s.t = 0; s.life = 0.22 + Math.random() * 0.18; s.gravity = true;
      s.v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2).addScaledVector(normal, 2.2).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      s.m.position.copy(point); s.m.material.color.set(color); s.m.visible = true;
      if (++made >= n) break;
    }
  }
  /** Sparks born on a shell around a point that fly into it: energy gathering. */
  gather(point, n, color, radius = 0.28) {
    let made = 0;
    for (const s of this.sparks) {
      if (s.t < 1) continue;
      s.t = 0; s.life = 0.22 + Math.random() * 0.1;
      _a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(radius);
      s.m.position.copy(point).add(_a);
      s.v.copy(_a).multiplyScalar(-1 / s.life);
      s.m.material.color.set(color); s.m.visible = true; s.gravity = false;
      if (++made >= n) break;
    }
  }
  /** kind: PERFECT | GOOD | EARLY | LATE | BLOCK | EDGE | THIN | BOUNCE | NET */
  impact(point, normal, kind, speed) {
    const big = clamp(speed / 22, 0.2, 1.2);
    if (kind === 'PERFECT') { this.ring(point, normal, PALETTE.cyan, 0.16 * big, 0.28); this.ring(point, normal, 0xffffff, 0.09 * big, 0.2); this.burst(point, normal, PALETTE.cyan, 14, 3 + 3 * big); }
    else if (kind === 'GOOD') { this.ring(point, normal, 0xffffff, 0.11 * big, 0.22); this.burst(point, normal, 0xffffff, 6, 2 + 2 * big); }
    else if (kind === 'EDGE') { this.ring(point, normal, PALETTE.orange, 0.08, 0.2); this.burst(point, normal, PALETTE.orange, 10, 3); }
    else if (kind === 'THIN') this.ring(point, normal, 0xffffff, 0.06, 0.16);
    else if (kind === 'BOUNCE') this.ring(point, normal, 0xffffff, 0.05 + 0.06 * big, 0.18);
    else if (kind === 'NET') { this.ring(point, normal, PALETTE.cyan, 0.07, 0.2); this.burst(point, normal, 0xffffff, 5, 1.5); }
    else this.ring(point, normal, 0xffffff, 0.07 * big, 0.18);
  }
  update(dt) {
    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t = Math.min(1, r.t + dt / r.life);
      const e = 1 - Math.pow(1 - r.t, 2.2);
      const s = r.size * (0.25 + e);
      r.m.scale.set(s, s, s); r.m.material.opacity = (1 - r.t) * 0.9;
      if (r.t >= 1) r.m.visible = false;
    }
    for (const s of this.sparks) {
      if (s.t >= 1) continue;
      s.t = Math.min(1, s.t + dt / s.life);
      if (s.gravity !== false) { s.v.y -= 9.8 * dt; s.v.multiplyScalar(1 - 3 * dt); }
      s.m.position.addScaledVector(s.v, dt);
      if (s.v.lengthSq() > 1e-4) { _a.copy(s.m.position).add(s.v); s.m.lookAt(_a); }
      s.m.material.opacity = 1 - s.t;
      if (s.t >= 1) s.m.visible = false;
    }
  }
}
