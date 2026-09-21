/**
 * The net is not a wall. Its mesh is the 41 x 7 plane the net asset publishes on userData.cloth,
 * driven here as a damped wave field: each free node is pulled back to its rest position and
 * toward the mean of its neighbours, so a ball that clips the tape sends a ripple along the
 * cord, a ball into the net bellies it and it shudders back. The top tape is a separate spring.
 */
import * as THREE from 'three';
import { TABLE } from './consts.js';

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
      prev[i * 3 + 2] -= dir * strength * f * f;
    }
    this.tv += dir * strength * 6 * Math.max(0, 1 - Math.abs(lp.y - 0.07) / 0.1);
    this.active = 3;
  }
  update(dt) {
    if (!this.cloth) return;
    const h = Math.min(dt, 1 / 30);
    this.t += h;
    const pos = this.pos, prev = this.prev, base = this.base, cols = this.cols, rows = this.rows;
    let energy = 0;
    for (let iy = 1; iy < rows; iy++) for (let ix = 1; ix < cols - 1; ix++) {
      const i = (iy * cols + ix) * 3 + 2;
      const z = pos[i], vz = (z - prev[i]) * 0.978;
      const nb = (pos[i - 3] + pos[i + 3] + pos[i - cols * 3] + (iy < rows - 1 ? pos[i + cols * 3] : z)) * 0.25;
      // a breath of air moves the mesh all the time, more toward the bottom, so it is never rigid
      const sag = iy / (rows - 1);
      const wind = 0.9 * sag * Math.sin(this.t * 1.7 + base[i - 2] * 3.1) + 0.5 * sag * Math.sin(this.t * 2.9 - base[i - 2] * 5.3);
      const acc = 140 * (base[i] - z) + 1100 * (nb - z) + wind;
      prev[i] = z;
      pos[i] = z + vz + acc * h * h;
      energy += Math.abs(vz) + Math.abs(pos[i] - base[i]);
    }
    if (this.pressing) {
      const { x, y, dir, depth } = this.pressing, r = 0.11;
      for (let i = 0; i < this.n; i++) {
        const dx = base[i * 3] - x, dy = base[i * 3 + 1] - y, d = Math.hypot(dx, dy);
        if (d > r) continue;
        const want = dir * (depth + 0.02) * (1 - (d / r) * (d / r));
        if (dir * pos[i * 3 + 2] < dir * want) { pos[i * 3 + 2] = want; prev[i * 3 + 2] = want - dir * 0.005; }
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
