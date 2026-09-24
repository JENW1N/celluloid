/**
 * The net is not a wall. Its mesh is the 41 x 7 plane the net asset publishes on userData.cloth,
 * driven here as a damped wave field: each free node is pulled back to its rest position and
 * toward the mean of its neighbours, so a ball that clips the tape sends a ripple along the
 * cord, a ball into the net bellies it and it shudders back. The top tape is a separate spring.
 */
import * as THREE from 'three';
import { TABLE } from './consts.js?v=202609240115';

export class NetCloth {
  constructor(netInst) {
    this.cloth = netInst.userData.cloth || null;
    this.tape = netInst.userData.tape || null;
    if (!this.cloth) return;
    const geo = this.cloth.geometry;
    const p = geo.attributes.position;
    this.n = p.count;
    this.base = new Float32Array(p.array);
    this.pos = new Float32Array(p.array);
    this.prev = new Float32Array(p.array);
    this.cols = geo.parameters.widthSegments + 1;
    this.rows = geo.parameters.heightSegments + 1;
    this.cloth.updateMatrixWorld(true);
    this.worldToLocal = new THREE.Matrix4().copy(this.cloth.matrixWorld).invert();
    this.tapeBase = this.tape ? this.tape.position.z : 0;
    this.tz = 0; this.tv = 0; this.ty = 0; this.tvy = 0;
    this.active = 0; this.t = 0;
    this.pressing = null;
    this._v = new THREE.Vector3();
  }
  /** The ball is inside the net at this world point: the cloth wraps around it. */
  press(x, y, dir, depth) {
    if (!this.cloth) return;
    const lp = this._v.set(x, y, 0).applyMatrix4(this.worldToLocal);
    this.pressing = { x: lp.x, y: lp.y, dir, depth };
    this.active = 3;
  }
  /** An impulse at a world point: dir is +1/-1 along z, strength in metres of displacement. */
  impulse(x, y, dir, strength, radius = 0.14) {
    if (!this.cloth) return;
    const lp = this._v.set(x, y, 0).applyMatrix4(this.worldToLocal);
    const pos = this.pos, prev = this.prev;
    for (let i = 0; i < this.n; i++) {
      const dx = this.base[i * 3] - lp.x, dy = this.base[i * 3 + 1] - lp.y;
      const d = Math.hypot(dx, dy);
      if (d > radius) continue;
      const f = (1 - d / radius);
      prev[i * 3 + 2] -= dir * strength * 0.17 * f * f;      // reach `strength` in about 50 ms
    }
    this.tv += dir * strength * 2.5 * Math.max(0, 1 - Math.abs(lp.y - 0.07) / 0.1);
    this.active = 3;
  }
  update(dt) {
    if (!this.cloth) return;
    // fixed sub-steps: the springs are stiff enough that a frame's worth of time in one step
    // diverges at low frame rates, and a net that has exploded into a hammock is worse than
    // no net at all
    const H = 1 / 120, n = Math.min(6, Math.max(1, Math.round(dt / H)));
    const pos = this.pos, prev = this.prev, base = this.base, cols = this.cols, rows = this.rows;
    for (let step = 0; step < n; step++) {
      this.t += H;
      for (let iy = 1; iy < rows; iy++) for (let ix = 1; ix < cols - 1; ix++) {
        const i = (iy * cols + ix) * 3 + 2;
        const z = pos[i], vz = (z - prev[i]) * 0.955;
        const nb = (pos[i - 3] + pos[i + 3] + pos[i - cols * 3] + (iy < rows - 1 ? pos[i + cols * 3] : z)) * 0.25;
        // a breath of air moves the mesh all the time, more toward the bottom, so it is never rigid
        const sag = iy / (rows - 1);
        const wind = 0.24 * sag * Math.sin(this.t * 1.7 + base[i - 2] * 3.1) + 0.14 * sag * Math.sin(this.t * 2.9 - base[i - 2] * 5.3);
        const acc = 140 * (base[i] - z) + 700 * (nb - z) + wind;
        prev[i] = z;
        pos[i] = z + vz + acc * H * H;
      }
    }
    // a net cannot stretch more than a hand's width: if the sim ever does, it is wrong, so heal it
    let worst = 0;
    for (let i = 2; i < pos.length; i += 3) worst = Math.max(worst, Math.abs(pos[i] - base[i]));
    if (worst > 0.12) { pos.set(base); prev.set(base); this.tz = 0; this.tv = 0; }
    const h = H;
    let energy = 0;
    if (this.pressing) {
      const { x, y, dir, depth } = this.pressing, r = 0.11;
      for (let i = 0; i < this.n; i++) {
        const dx = base[i * 3] - x, dy = base[i * 3 + 1] - y, d = Math.hypot(dx, dy);
        if (d > r) continue;
        // the pocket sits a little beyond the ball's far face, so the ball and its outline are
        // always seen through the mesh, never poking out of it
        const want = dir * (depth + 0.036) * (1 - (d / r) * (d / r));
        if (dir * pos[i * 3 + 2] < dir * want) { pos[i * 3 + 2] = want; prev[i * 3 + 2] = want - dir * 0.0012; }
      }
      this.tv += dir * depth * 3 * h * 30;
      this.pressing = null;
    }
    const attr = this.cloth.geometry.attributes.position;
    attr.array.set(pos); attr.needsUpdate = true;
    if (this.tape) {
      const acc = -170 * this.tz - 8 * this.tv;
      this.tv += acc * h; this.tz += this.tv * h;
      this.tape.position.z = this.tapeBase + this.tz;
      this.tape.rotation.x = this.tz * 4;
      energy += Math.abs(this.tz) * 20;
    }
    this.active = 3;
  }
}
