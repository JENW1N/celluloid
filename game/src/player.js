/**
 * The player's paddle. Mouse or finger drive x and y on a plane behind the end line; holding
 * the button charges a backswing along z and releasing swings through. Orientation is derived
 * from position the way a coach sets a beginner's wrist: the face turns to aim at the far side
 * as you move wide, closes as you rise above the net for a slam, and opens as you drop under
 * the table to lift. Velocity is the honest finite difference of where the blade actually went,
 * so a fast flick at contact is a brush, and a brush is spin.
 */
import * as THREE from 'three';
import { PADDLE, PLAYER, SWING, TILT, TABLE, NET, RUBBER, clamp, easeOut, easeInOut } from './consts.js?v=202609232250';

const _din = new THREE.Vector3(), _dout = new THREE.Vector3(), _nb = new THREE.Vector3(), _tgt = new THREE.Vector3(), _t2 = new THREE.Vector2();

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
    this.wrist = 0.5; this.serving = false;
    this.magnet = new THREE.Vector2();                     // the leeway drift, added to the target
    this.brush = new THREE.Vector3();                      // the flick memory: the cursor's best recent motion, held then let go
    this.brushGain = PLAYER.brushGain;
    this.cursor = this.target.clone(); this.cursorPrev = this.target.clone(); this.rawVel = new THREE.Vector3();   // the cursor (or finger) itself, apart from any pull on the target
    this.pending = false; this.hold = 0; this.swingStarted = false;
  }
  setTarget(x, y) { this.target.set(clamp(x, -PLAYER.xMax, PLAYER.xMax), clamp(y, PLAYER.yMin, PLAYER.yMax)); this.cursor.copy(this.target); }
  nudge(dx, dy) { this.setTarget(this.target.x + dx, this.target.y + dy); }
  /** The serve magnet moves the target toward the toss; that motion is not a flick. */
  nudgeMagnet(dx, dy) { this.target.set(clamp(this.target.x + dx, -PLAYER.xMax, PLAYER.xMax), clamp(this.target.y + dy, PLAYER.yMin, PLAYER.yMax)); }
  startCharge() { if (this.charging || this.swingT >= 0) return false; this.charging = true; this.charge = 0; return true; }
  /** The blade speed a release at this charge would peak at. */
  peakFor(charge, maxPower = 1) { return SWING.vTap + (SWING.vFull - SWING.vTap) * Math.min(maxPower, Math.max(0.12, charge)); }
  /** Release the charge. With hold > 0 the blade stays cocked that long first, so the swing peaks on the ball. */
  release(maxPower = 1, hold = 0) {
    if (!this.charging) return null;
    this.charging = false;
    this.swingPower = Math.min(maxPower, Math.max(0.12, this.charge));
    this.swingStart = SWING.back * easeOut(this.charge) * (this.serving ? 0.3 : 1);
    this.swingPeak = this.peakFor(this.charge, maxPower);
    this.charge = 0;
    this.pending = hold > 0; this.hold = hold;
    this.swingT = this.pending ? -1 : 0;
    this.swingStarted = !this.pending;
    return this.swingPower;
  }
  /**
   * The plane the ball will be met on: while charging or waiting to swing, where the swing will
   * be fastest (the cocked blade plus the travel to its peak); otherwise where the blade is.
   */
  meetZ() {
    const Vp = this.charging ? this.peakFor(this.charge) : this.pending ? this.swingPeak : 0;
    return this.pos.z - (Vp ? Vp * SWING.forwardT / Math.PI : 0);
  }
  /** True once, the frame a swing actually starts moving. */
  takeSwingStart() { const s = this.swingStarted; this.swingStarted = false; return s; }
  /** The ball got to the cocked blade before a waiting swing did: the swing is spent. */
  cancelSwing() { this.pending = false; this.swingT = -1; }
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
  /** How far the wrist is cocked back, 0..1: the charge while charging, snapping forward after release. */
  cock() {
    if (this.charging) return this.charge;
    if (this.pending) return this.swingPower;
    if (this.swingT >= 0 && this.swingT < 0.06) return this.swingPower * (1 - this.swingT / 0.06);
    return 0;
  }
  /** How well timed a contact right now is. */
  timing() {
    if (this.pending || this.swingT < 0) return { kind: 'BLOCK', phase: 0 };
    const sw = this.swingAt(this.swingT);
    if (!sw.forward) return { kind: 'LATE', phase: 0 };
    const kind = sw.phase > 0.85 ? 'PERFECT' : sw.phase > 0.5 ? 'GOOD' : (this.swingT < SWING.forwardT / 2 ? 'EARLY' : 'LATE');
    return { kind, phase: sw.phase };
  }
  update(dt, ball = null, serving = false) {
    this.serving = serving;
    this.brushGain = PLAYER.brushGain * (serving ? PLAYER.serveBrush : 1);
    const k = 1 - Math.exp(-28 * dt);
    _t2.copy(this.target).add(this.magnet);
    this.smooth.lerp(_t2, k);
    const zT = this.reachZ == null ? PLAYER.z0 : clamp(this.reachZ, PLAYER.reachMin, PLAYER.reachMax);
    this.zBase += clamp(zT - this.zBase, -4.5 * dt, 4.5 * dt);
    let zOff = 0;
    if (this.charging) {
      this.charge = Math.min(1, this.charge + dt / SWING.chargeTime);
      zOff = SWING.back * easeOut(this.charge) * (serving ? 0.3 : 1);
    }
    if (this.pending) {
      this.hold -= dt; zOff = this.swingStart;
      if (this.hold <= 0) { this.pending = false; this.swingT = 0; this.swingStarted = true; }
    }
    if (this.swingT >= 0) {
      this.swingT += dt;
      const sw = this.swingAt(this.swingT);
      if (sw.done) this.swingT = -1; else zOff = this.swingStart - sw.s;
    }
    this.posPrev.copy(this.pos);
    this.pos.set(this.smooth.x, this.smooth.y, this.zBase + zOff);
    this.vel.copy(this.pos).sub(this.posPrev).divideScalar(Math.max(dt, 1e-4));
    // the flick memory follows the cursor itself (not the drift or the swing): a flick is kept at
    // its peak and fades over flickMemory seconds, so the brush at contact is the flick you made
    this.rawVel.set((this.cursor.x - this.cursorPrev.x) / Math.max(dt, 1e-4), (this.cursor.y - this.cursorPrev.y) / Math.max(dt, 1e-4) * PLAYER.flickYGain, 0);
    this.cursorPrev.copy(this.cursor);
    if (this.rawVel.lengthSq() >= this.brush.lengthSq()) this.brush.copy(this.rawVel);
    else this.brush.multiplyScalar(Math.exp(-dt / PLAYER.flickMemory));
    // the wrist: aim at the far side, close when high, open when low
    const yawT = -Math.atan2(this.pos.x, this.pos.z - TILT.aimZ);
    const dy = this.pos.y - TILT.yRef;
    const pitchT = TILT.ready + (dy > 0 ? -Math.min(TILT.maxClose, dy * TILT.closeRate) : Math.min(TILT.maxOpen, -dy * TILT.openRate));
    const kr = 1 - Math.exp(-20 * dt);
    this.yaw += (yawT - this.yaw) * kr;
    this.pitch += (pitchT - this.pitch) * kr;
    const cp = Math.cos(this.pitch);
    this.normal.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
    // the wrist absorbs the incoming angle: when a ball is on its way, lean the face toward the
    // bisector that would send it just over the net, by an amount the level allows. Position
    // still sets the intent (high closes, low opens); this keeps a plain block in play.
    if (serving) {
      // a serve: the blade closes a little so the falling ball is sent down onto your own half
      // first, whatever height you meet it at; the two-bounce assist does the fine tuning
      const sp = -0.22, cs = Math.cos(sp);
      this.normal.set(Math.sin(this.yaw) * cs, Math.sin(sp), -Math.cos(this.yaw) * cs);
    } else if (ball && ball.v.z > 0.5 && ball.p.z < this.pos.z && this.pos.z - ball.p.z < 1.6) {
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
