/**
 * The ball, the air, the table, the net, the floor and the paddle faces.
 *
 * One integrator, run in substeps of at most 1/600 s so a 30 m/s ball moves 5 cm a step, with
 * swept tests against every plane so nothing tunnels. The same functions are used by predict(),
 * which the bots and the assist steer by, so what the bots expect is exactly what happens.
 *
 * Impulses use the rigid hollow-sphere result: a tangential impulse J at the contact point
 * changes the contact-point velocity by J/m * (1 + 1/alpha) with alpha = I/(m r^2) = 2/3. Grip
 * asks for the contact point to rebound tangentially with restitution et (0 = pure rolling) and
 * is capped by Coulomb friction, which is what makes a thin brush slip and a heavy backspin
 * ball check on the table.
 */
import * as THREE from 'three';
import { TABLE, NET, BALL, FLOOR_Y, G, AIR, TABLE_PHYS, FLOOR_PHYS, RUBBER, clamp, lerp } from './consts.js';

const ZERO = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _vc = new THREE.Vector3();
const _j = new THREE.Vector3(), _tmp = new THREE.Vector3(), _tmp2 = new THREE.Vector3();
const _rel0 = new THREE.Vector3(), _rel1 = new THREE.Vector3(), _cp = new THREE.Vector3(), _off = new THREE.Vector3(), _nb = new THREE.Vector3();
const _pA = new THREE.Vector3(), _pB = new THREE.Vector3();

export class BallState {
  constructor() {
    this.p = new THREE.Vector3(0, 1, 0); this.pPrev = new THREE.Vector3(0, 1, 0);
    this.v = new THREE.Vector3(); this.w = new THREE.Vector3();
    this.netHold = 0;                // +1 / -1 while the net has the ball, the direction it went in
  }
  copy(o) { this.p.copy(o.p); this.pPrev.copy(o.pPrev); this.v.copy(o.v); this.w.copy(o.w); this.netHold = o.netHold; return this; }
  set(p, v, w) { this.p.copy(p); this.pPrev.copy(p); this.v.copy(v); this.w.copy(w || ZERO); this.netHold = 0; return this; }
  speed() { return this.v.length(); }
}

/** Gravity, quadratic drag, Magnus lift, a slow spin decay, then one Euler step. */
export function airStep(b, h) {
  const v = b.v, s = v.length();
  _a.set(0, -G, 0);
  if (s > 1e-6) {
    _a.addScaledVector(v, -AIR.kd * s);
    const ws = b.w.length();
    if (ws > 1e-3) {
      const S = BALL.R * ws / s;
      const CL = Math.min(AIR.clMax, 1 / (2.32 + 0.4 / S));
      _t.crossVectors(b.w, v).multiplyScalar(AIR.km * CL * s / ws);
      _a.add(_t);
    }
  }
  b.w.multiplyScalar(Math.max(0, 1 - AIR.spinDecay * h));
  // caught in the net: it stretches like a spring, damps hard, rubs the ball down its face, and
  // lets go on the hitter's side once it has pushed the ball back through the plane
  if (b.netHold) {
    const dir = b.netHold, pen = b.p.z * dir;
    if (pen < 0) { b.netHold = 0; v.z *= 0.6; }
    else {
      const capped = Math.min(pen, NET.maxDepth);
      _a.z += -(NET.k / BALL.M) * capped * dir - (NET.c / BALL.M) * v.z;
      v.x *= Math.exp(-20 * h); v.y *= Math.exp(-6 * h);
      if (pen > NET.maxDepth && v.z * dir > 0) v.z = 0;
    }
  }
  v.addScaledVector(_a, h);
  b.pPrev.copy(b.p);
  b.p.addScaledVector(v, h);
}

/**
 * Bounce off a surface whose unit normal n points from the surface toward the ball, moving at
 * surfaceV. Returns null if the ball is separating. Mutates b.v and b.w.
 */
export function surfaceImpulse(b, n, surfaceV, e, et, mu) {
  _tmp.copy(b.v).sub(surfaceV);
  const vn = _tmp.dot(n);
  if (vn >= 0) return null;
  _vc.copy(_tmp).addScaledVector(_tmp2.crossVectors(b.w, n), -BALL.R);   // contact point velocity
  _vc.addScaledVector(n, -_vc.dot(n));                                     // tangential part
  const Jn = BALL.M * (1 + e) * (-vn);
  const k = (1 + et) / (1 + 1 / BALL.ALPHA);                               // 0.4 (1 + et)
  _j.copy(_vc).multiplyScalar(-k * BALL.M);
  let slip = false;
  const jt = _j.length(), jmax = mu * Jn;
  if (jt > jmax) { _j.multiplyScalar(jmax / Math.max(jt, 1e-9)); slip = true; }
  b.v.addScaledVector(n, Jn / BALL.M).addScaledVector(_j, 1 / BALL.M);
  _tmp2.crossVectors(n, _j).multiplyScalar(-BALL.R / BALL.I);
  b.w.add(_tmp2);
  return { vn, slip, Jn, brush: _vc.length() };
}

function collideTable(b, ev, rnd) {
  const R = BALL.R;
  const yb0 = b.pPrev.y - R, yb1 = b.p.y - R;
  if (yb0 >= TABLE.H - 1e-5 && yb1 < TABLE.H) {
    const t = (yb0 - TABLE.H) / Math.max(1e-9, yb0 - yb1);
    const x = lerp(b.pPrev.x, b.p.x, t), z = lerp(b.pPrev.z, b.p.z, t);
    const inX = Math.abs(x) <= TABLE.halfW, inZ = Math.abs(z) <= TABLE.halfL;
    const edgeX = !inX && Math.abs(x) <= TABLE.halfW + R * 0.75;
    const edgeZ = !inZ && Math.abs(z) <= TABLE.halfL + R * 0.75;
    if ((inX || edgeX) && (inZ || edgeZ)) {
      let edge = false;
      _n.set(0, 1, 0);
      if (!inX || !inZ) {
        edge = true;
        _n.set(!inX ? Math.sign(x) * 0.9 : 0, 1, !inZ ? Math.sign(z) * 0.9 : 0);
        _n.x += (rnd() - 0.5) * 0.5; _n.z += (rnd() - 0.5) * 0.5; _n.normalize();
      }
      b.p.set(x, TABLE.H + R + 1e-4, z); b.pPrev.copy(b.p);
      const r = surfaceImpulse(b, _n, ZERO, edge ? 0.62 : TABLE_PHYS.e, TABLE_PHYS.et, TABLE_PHYS.mu);
      ev.push({ type: 'table', x, z, side: z > 0 ? 0 : 1, speed: r ? -r.vn : 0, slip: !!(r && r.slip), edge, spin: b.w.length() });
      return true;
    }
  }
  const yt0 = b.pPrev.y + R, yt1 = b.p.y + R, under = TABLE.H - TABLE.T;
  if (yt0 <= under && yt1 > under && Math.abs(b.p.x) < TABLE.halfW && Math.abs(b.p.z) < TABLE.halfL) {
    b.p.y = under - R - 1e-4; b.pPrev.copy(b.p);
    _n.set(0, -1, 0);
    surfaceImpulse(b, _n, ZERO, 0.5, 0, 0.3);
    ev.push({ type: 'under', speed: b.v.length() });
    return true;
  }
  return false;
}

function collideNet(b, ev, rnd) {
  const z0 = b.pPrev.z, z1 = b.p.z;
  if (b.netHold) return false;
  if ((z0 > 0) === (z1 > 0) || z0 === z1) return false;
  const t = z0 / (z0 - z1);
  const x = lerp(b.pPrev.x, b.p.x, t), y = lerp(b.pPrev.y, b.p.y, t);
  const R = BALL.R, top = TABLE.H + NET.H;
  if (Math.abs(x) > NET.halfSpan + R) return false;
  if (y + R < TABLE.H) return false;
  const dir = Math.sign(z1 - z0);
  const clearance = (y - R) - top;
  if (clearance >= 0) {
    if (clearance < 0.045) ev.push({ type: 'nearmiss', clearance, x, y, dir, speed: b.v.length() });
    return false;
  }
  const speed = b.v.length();
  if (Math.abs(x) > NET.halfSpan - 0.03) {
    b.p.set(x, y, -dir * (R + 0.005)); b.pPrev.copy(b.p);
    _n.set((rnd() - 0.5) * 0.8, (rnd() - 0.5) * 0.4, -dir).normalize();
    surfaceImpulse(b, _n, ZERO, 0.55, 0, 0.3);
    ev.push({ type: 'post', x, y, speed, dir });
    return true;
  }
  const depth = -clearance;
  if (depth < 0.85 * R) {
    const f = depth / (0.85 * R);
    b.v.z *= (1 - 0.7 * f);
    b.v.y = Math.max(b.v.y, 0) * 0.3 + 0.5 + 1.4 * f;
    b.v.x += (rnd() - 0.5) * 0.8;
    b.w.multiplyScalar(0.35);
    b.p.set(x, Math.max(y, top + R * 0.4), dir * R * 0.6); b.pPrev.copy(b.p);
    ev.push({ type: 'netclip', x, y, depth: f, dir, speed });
    return true;
  }
  // into the body of the net: the spring in airStep takes it from here
  b.p.set(x, y, dir * 0.004); b.pPrev.copy(b.p);
  b.v.x *= 0.5; b.v.y = Math.min(b.v.y, 0.5); b.v.z *= 0.9;
  b.w.multiplyScalar(0.2);
  b.netHold = dir;
  ev.push({ type: 'netin', x, y, speed, dir, depth: depth / R });
  return true;
}

function collideFloor(b, ev) {
  if (b.p.y - BALL.R < FLOOR_Y && b.v.y < 0) {
    b.p.y = FLOOR_Y + BALL.R; b.pPrev.copy(b.p);
    const r = surfaceImpulse(b, UP, ZERO, FLOOR_PHYS.e, 0, FLOOR_PHYS.mu);
    ev.push({ type: 'floor', speed: r ? -r.vn : 0, x: b.p.x, z: b.p.z });
    return true;
  }
  if (b.p.y > 7.5 && b.v.y > 0) {
    b.v.y = -b.v.y * 0.3; b.v.x *= 0.5; b.v.z *= 0.5;
    ev.push({ type: 'ceiling', x: b.p.x, z: b.p.z });
    return true;
  }
  return false;
}

/**
 * A paddle is { pos, posPrev, vel, normal, radius, thick, owner, active, cooldown, assist }.
 * normal is the face direction; either face is rubber, so the side the ball arrives from is the
 * side that hits it. fa/fb are the fractions of the frame this substep covers, so the paddle's
 * motion over the frame is swept as well as the ball's.
 */
export function collidePaddle(b, pad, ev, rnd, fa, fb) {
  if (!pad.active || pad.cooldown > 0) return false;
  const n = _n.copy(pad.normal);
  const R = BALL.R + pad.thick * 0.5;
  _pA.copy(pad.posPrev).lerp(pad.pos, fa);
  _pB.copy(pad.posPrev).lerp(pad.pos, fb);
  _rel0.copy(b.pPrev).sub(_pA);
  _rel1.copy(b.p).sub(_pB);
  const d0 = _rel0.dot(n), d1 = _rel1.dot(n);
  const side = d0 >= 0 ? 1 : -1;
  const s0 = side * d0, s1 = side * d1;
  const crossing = s0 > R && s1 <= R;
  const inside = Math.abs(d1) <= R && (s1 - s0) < 0;
  if (!crossing && !inside) return false;
  const t = crossing ? clamp((s0 - R) / Math.max(1e-9, s0 - s1), 0, 1) : 1;
  _cp.copy(_rel0).lerp(_rel1, t);
  _off.copy(_cp).addScaledVector(n, -_cp.dot(n));
  const rho = _off.length();
  const Reff = pad.radius * (pad.assist || 1);
  if (rho > Reff + BALL.R) return false;
  const edge = rho > Reff;
  _nb.copy(n).multiplyScalar(side);
  if (edge) { _nb.x += (rnd() - 0.5) * 0.9; _nb.y += (rnd() - 0.5) * 0.9; _nb.z += (rnd() - 0.5) * 0.4; _nb.normalize(); }
  _tmp.copy(b.v).sub(pad.vel);
  if (_tmp.dot(_nb) >= -0.05) return false;
  const r = surfaceImpulse(b, _nb, pad.vel, edge ? 0.45 : RUBBER.e, edge ? 0 : RUBBER.et, edge ? 0.3 : RUBBER.mu);
  b.p.copy(_pB).add(_off).addScaledVector(_nb, R + 0.002);
  b.pPrev.copy(b.p);
  pad.cooldown = 0.05;
  ev.push({
    type: 'paddle', owner: pad.owner, speedIn: r ? -r.vn : 0, edge, slip: !!(r && r.slip), rho: rho / Reff,
    point: b.p.clone(), normal: _nb.clone(), padSpeed: pad.vel.length(), brush: r ? r.brush : 0,
    spin: b.w.length(), speedOut: b.v.length(),
  });
  return true;
}

/** Advance the live ball by dt against the paddles given, pushing every contact into ev. */
export function stepWorld(b, pads, dt, ev, rnd) {
  const N = Math.max(1, Math.ceil(dt / (1 / 600))), h = dt / N;
  for (let i = 0; i < N; i++) {
    airStep(b, h);
    const fa = i / N, fb = (i + 1) / N;
    for (const pad of pads) {
      pad.cooldown -= h;
      collidePaddle(b, pad, ev, rnd, fa, fb);
    }
    collideNet(b, ev, rnd) || collideTable(b, ev, rnd) || collideFloor(b, ev);
  }
}

const _pb = new BallState();
/**
 * Run the ball forward without paddles and without randomness. Stops when `until(b, t, ev)`
 * returns truthy, when the ball lands on the floor, or after maxT. Events carry .t. The
 * returned state is a shared scratch object: copy what you keep.
 */
export function predict(b0, opts = {}) {
  const b = _pb.copy(b0);
  const ev = [];
  const h = opts.h || 1 / 300, maxT = opts.maxT || 3;
  const rnd = () => 0.5;
  const samples = opts.sample ? [] : null;
  let t = 0, stop = null, floorHits = 0;
  while (t < maxT) {
    airStep(b, h); t += h;
    const before = ev.length;
    collideNet(b, ev, rnd) || collideTable(b, ev, rnd) || collideFloor(b, ev);
    for (let k = before; k < ev.length; k++) { ev[k].t = t; if (ev[k].type === 'floor') floorHits++; }
    if (samples) samples.push({ t, x: b.p.x, y: b.p.y, z: b.p.z, vy: b.v.y, vz: b.v.z });
    if (opts.until && (stop = opts.until(b, t, ev))) break;
    if (floorHits > 0) break;
    if (Math.abs(b.p.x) > 5 || Math.abs(b.p.z) > 6) break;
  }
  return { events: ev, state: b, t, samples, stop };
}
