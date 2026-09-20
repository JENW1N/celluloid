/**
 * The player's paddle. Mouse or finger drive x and y on a plane behind the end line; holding
 * the button charges a backswing along z and releasing swings through. Orientation is derived
 * from position the way a coach sets a beginner's wrist: the face turns to aim at the far side
 * as you move wide, closes as you rise above the net for a slam, and opens as you drop under
 * the table to lift. Velocity is the honest finite difference of where the blade actually went,
 * so a fast flick at contact is a brush, and a brush is spin.
 */
import * as THREE from 'three';
import { PADDLE, PLAYER, SWING, TILT, TABLE, NET, RUBBER, clamp, easeOut, easeInOut } from './consts.js';

const _din = new THREE.Vector3(), _dout = new THREE.Vector3(), _nb = new THREE.Vector3(), _tgt = new THREE.Vector3();

export class PlayerPaddle {
  constructor() {
    this.pos = new THREE.Vector3(0, PLAYER.yNeutral, PLAYER.z0);
    this.posPrev = this.pos.clone();
    this.vel = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 0, -1);
    this.target = new THREE.Vector2(0, PLAYER.yNeutral);
    this.smooth = new THREE.Vector2(0, PLAYER.yNeutral);
    this.radius = PADDLE.r; this.thick = PADDLE.thick; this.owner = 0; this.active = true; this.cooldown = 0; this.assist = 1.3;
    this.charge = 0; this.charging = false;
    this.swingT = -1; this.swingPower = 0; this.swingStart = 0; this.swingPeak = 0;
    this.zBase = PLAYER.z0; this.reachZ = null;
    this.yaw = 0; this.pitch = 0; this.flip = 0; this.flipTarget = 0;
    this.wrist = 0.5;
  }
  setTarget(x, y) { this.target.set(clamp(x, -PLAYER.xMax, PLAYER.xMax), clamp(y, PLAYER.yMin, PLAYER.yMax)); }
  nudge(dx, dy) { this.setTarget(this.target.x + dx, this.target.y + dy); }
  startCharge() { if (this.charging || this.swingT >= 0) return false; this.charging = true; this.charge = 0; return true; }
  release() {
    if (!this.charging) return null;
    this.charging = false;
    this.swingPower = Math.max(0.12, this.charge);
    this.swingStart = SWING.back * easeOut(this.charge);
    this.swingPeak = SWING.vTap + (SWING.vFull - SWING.vTap) * this.swingPower;
    this.swingT = 0; this.charge = 0;
    return this.swingPower;
  }
  /** Where the swing is at time t after release: forward travel s, speed v, and its phase. */
  swingAt(t) {
    const Tf = SWING.forwardT, Tr = SWING.returnT, Vp = this.swingPeak;
    const sEnd = 2 * Vp * Tf / Math.PI;
    if (t < Tf) {
      const u = Math.PI * t / Tf;
      return { s: Vp * Tf / Math.PI * (1 - Math.cos(u)), v: Vp * Math.sin(u), phase: Math.sin(u), done: false, forward: true };
    }
    if (t < Tf + Tr) {
      const u = (t - Tf) / Tr;
      return { s: sEnd + (this.swingStart - sEnd) * easeInOut(u), v: 0, phase: 0, done: false, forward: false };
    }
    return { s: this.swingStart, v: 0, phase: 0, done: true, forward: false };
  }
  /** How well timed a contact right now is. */
  timing() {
    if (this.swingT < 0) return { kind: 'BLOCK', phase: 0 };
    const sw = this.swingAt(this.swingT);
    if (!sw.forward) return { kind: 'LATE', phase: 0 };
    const kind = sw.phase > 0.85 ? 'PERFECT' : sw.phase > 0.5 ? 'GOOD' : (this.swingT < SWING.forwardT / 2 ? 'EARLY' : 'LATE');
    return { kind, phase: sw.phase };
  }
  update(dt, ball = null) {
    const k = 1 - Math.exp(-28 * dt);
    this.smooth.lerp(this.target, k);
    const zT = this.reachZ == null ? PLAYER.z0 : clamp(this.reachZ, PLAYER.reachMin, PLAYER.reachMax);
    this.zBase += clamp(zT - this.zBase, -4.5 * dt, 4.5 * dt);
    let zOff = 0;
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / SWING.chargeTime);
      zOff = SWING.back * easeOut(this.charge);
    }
    if (this.swingT >= 0) {
      this.swingT += dt;
      const sw = this.swingAt(this.swingT);
      if (sw.done) this.swingT = -1; else zOff = this.swingStart - sw.s;
    }
    this.posPrev.copy(this.pos);
    this.pos.set(this.smooth.x, this.smooth.y, this.zBase + zOff);
    this.vel.copy(this.pos).sub(this.posPrev).divideScalar(Math.max(dt, 1e-4));
    // the wrist: aim at the far side, close when high, open when low
    const yawT = -Math.atan2(this.pos.x, this.pos.z - TILT.aimZ);
    const dy = this.pos.y - TILT.yRef;
    const pitchT = dy > 0 ? -Math.min(TILT.maxClose, dy * TILT.closeRate) : Math.min(TILT.maxOpen, -dy * TILT.openRate);
    const kr = 1 - Math.exp(-20 * dt);
    this.yaw += (yawT - this.yaw) * kr;
    this.pitch += (pitchT - this.pitch) * kr;
    const cp = Math.cos(this.pitch);
    this.normal.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    // the wrist absorbs the incoming angle: when a ball is on its way, lean the face toward the
    // bisector that would send it just over the net, by an amount the level allows. Position
    // still sets the intent (high closes, low opens); this keeps a plain block in play.
    if (ball && ball.v.z > 0.5 && ball.p.z < this.pos.z && this.pos.z - ball.p.z < 1.6) {
      _din.copy(ball.v).normalize();
      const sOut = Math.max(4, RUBBER.e * ball.v.length() + (1 + RUBBER.e) * Math.max(0, -this.vel.z));
      const dNet = Math.max(0.2, this.pos.z);
      const drop = 0.5 * 9.81 * (dNet / sOut) * (dNet / sOut);
      _tgt.set(this.pos.x * 0.35, TABLE.H + NET.H + 0.07 + drop, 0);
      _dout.copy(_tgt).sub(this.pos).normalize();
      _nb.copy(_dout).sub(_din).normalize();
      if (_nb.z > 0) _nb.negate();
      this.normal.lerp(_nb, this.wrist).normalize();
    }
    if (this.pos.x < -0.14) this.flipTarget = 1; else if (this.pos.x > 0.14) this.flipTarget = 0;
    this.flip += (this.flipTarget - this.flip) * (1 - Math.exp(-14 * dt));
  }
}
