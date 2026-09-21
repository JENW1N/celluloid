/**
 * Three opponents, an order of magnitude apart, all playing the same physics the player does.
 * A bot never cheats the ball in flight: it reads where the ball will be with predict(), picks
 * a landing point and a shot, solves the launch elevation against drag and Magnus by bisection
 * on the same integrator, then adds its own error. What separates ROOKIE from PRO is how far
 * its paddle can move in the time it has, how late it reacts, how wide its error is, whether
 * it smashes a high ball, and whether it takes the ball on the rise.
 */
import * as THREE from 'three';
const _evB = [];                                   // lent to every flight the bot simulates
import { TABLE, BALL, PLAYER, LEVELS, SERVE, TILT, clamp, lerp } from './consts.js?v=202609212236';
import { BallState, predict, countType } from './physics.js?v=202609212236';

const ZERO = new THREE.Vector3();
const _b = new BallState(), _v = new THREE.Vector3(), _hand = new THREE.Vector3(), _tmp = new THREE.Vector3(), _d = new THREE.Vector3();
const gauss = () => { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const rr = (a, b) => a + Math.random() * (b - a);
const decisive = (events) => { for (const e of events) if (e.type !== 'nearmiss') return e; return null; };

/**
 * The launch elevation that lands a ball fired from P at speed spd with spin w on T, which is
 * on `side` (0 = the player's half). Bisection on the along-track landing error, which is
 * monotone enough in elevation: short, net and own-side count as negative, long as positive.
 */
export function solveShot(P, T, spd, w, side) {
  const hx = T.x - P.x, hz = T.z - P.z, hl = Math.hypot(hx, hz);
  const ux = hx / hl, uz = hz / hl;
  const along = (x, z) => (x - P.x) * ux + (z - P.z) * uz;
  const err = (theta) => {
    const c = Math.cos(theta);
    _b.set(P, _v.set(spd * ux * c, spd * Math.sin(theta), spd * uz * c), w);
    const r = predict(_b, { ev: _evB, maxT: 2.5, until: (bb, t, ev) => decisive(ev) });
    const e = decisive(r.events);
    if (!e) return 1;
    if (e.type === 'table') return e.side === side ? along(e.x, e.z) - hl : -0.9;
    if (e.type === 'netin' || e.type === 'netclip' || e.type === 'post') return -0.5;
    return 0.8;
  };
  const grid = [-0.45, -0.3, -0.18, -0.08, 0.02, 0.12, 0.24, 0.38, 0.55, 0.75];
  let lo = null, hi = null, elo = 0, ehi = 0, prev = null, eprev = 0;
  for (const th of grid) {
    const e = err(th);
    if (prev !== null && eprev < 0 && e >= 0) { lo = prev; elo = eprev; hi = th; ehi = e; break; }
    prev = th; eprev = e;
  }
  if (lo === null) return null;
  for (let i = 0; i < 7; i++) {
    const mid = (lo + hi) / 2, e = err(mid);
    if (e < 0) { lo = mid; elo = e; } else { hi = mid; ehi = e; }
  }
  const theta = Math.abs(elo) < Math.abs(ehi) ? lo : hi;
  const c = Math.cos(theta);
  return { v: new THREE.Vector3(spd * ux * c, spd * Math.sin(theta), spd * uz * c), theta, ux, uz, err: Math.min(Math.abs(elo), Math.abs(ehi)) };
}

export class Bot {
  constructor(levelKey) {
    this.level = levelKey; this.cfg = LEVELS[levelKey];
    this.home = new THREE.Vector3(0.2, TABLE.H + 0.24, -PLAYER.z0);
    this.pos = this.home.clone(); this.posPrev = this.pos.clone(); this.vel = new THREE.Vector3();
    this.normal = new THREE.Vector3(0, 0, 1);
    this.plan = null; this.moveDelay = 0;
    this.swing = -1; this.swingV = new THREE.Vector3(0, 0, 1); this.swingOff = 0; this.swingPower = 0;
    this.flip = 0; this.flipTarget = 0; this.yaw = 0; this.pitch = 0;
    this.servePhase = 'idle'; this.serveTimer = 0; this.serveT = 0; this.serveX = 0;
    this.playerX = 0; this.owner = 1;
  }
  reset() { this.plan = null; this.swing = -1; this.servePhase = 'idle'; this.pos.copy(this.home); }

  /** Called on every physics event so the plan tracks what the ball actually did. */
  onBallEvent(e, ball, match, now) {
    if (match.state !== 'IN_PLAY' || match.lastHitter !== 0) return;
    if (e.type === 'paddle' || e.type === 'table' || e.type === 'netclip' || e.type === 'post') this.planReturn(ball, now, e.type === 'paddle', match);
  }

  planReturn(ball, now, fresh, match) {
    const cfg = this.cfg;
    // if the ball has already bounced on our side, the flight we are reading starts now and the
    // next table contact is the second bounce, which ends the point
    const bounced = match.bounces[1] === 1;
    const r = predict(ball, {
      maxT: 2.6, sample: true,
      until: (b, t, ev) => b.p.z < -2.6 || countType(ev, 'table') >= (bounced ? 1 : 2) || ev.some((x) => x.type === 'netin' || x.type === 'floor'),
    });
    let tb = 0;
    if (!bounced) {
      const first = r.events.find((e) => e.type === 'table');
      if (!first || first.side !== 1) { this.plan = null; return; }
      tb = first.t;
    }
    const second = r.events.find((e) => e.t > tb && (e.type === 'table' || e.type === 'floor' || e.type === 'netin'));
    const t2 = second ? second.t : r.t;
    const after = r.samples.filter((s) => s.t > tb && s.t < t2);
    if (after.length < 2) { this.plan = null; return; }
    let apex = after[0];
    for (const s of after) if (s.y > apex.y) apex = s;
    const cross = after.find((s) => s.z <= -PLAYER.z0);
    // the same rule the player lives by: the blade's plane follows the apex but never comes
    // past the reach line, so the ball is met where it crosses that plane, or not at all
    const zMeet = clamp(apex.z, -PLAYER.z0, -PLAYER.reachMin);
    const reach = after.find((s) => s.z <= zMeet);
    const lob = apex.y > TABLE.H + 0.95;
    let pick;
    if (lob) pick = after.find((s) => s.t > apex.t && s.y <= TABLE.H + 0.6 && s.z <= zMeet) || reach || cross || null;
    else {
      const tEarly = tb + (apex.t - tb) * (1 - cfg.early);
      const early = after.find((s) => s.t >= tEarly && s.z <= zMeet) || reach || null;
      pick = early && cross && cross.t < early.t ? cross : early;
    }
    if (!pick) { this.plan = null; return; }                      // it never comes to the blade: a short ball is the player's point
    const P = new THREE.Vector3(pick.x, pick.y, pick.z);
    const tc = pick.t;
    const dist = P.distanceTo(this.pos);
    let miss = (fresh ? cfg.react : 0) + dist / cfg.speed > tc + 0.03 || Math.abs(P.x) > 1.3;
    const incoming = Math.hypot(pick.vz, pick.vy);
    if (!miss && fresh && Math.random() < cfg.whiff * (1 + incoming / 15)) miss = true;
    if (!fresh && this.plan && this.plan.miss) miss = true;          // a whiff decided is a whiff
    const shot = miss ? null : this.chooseShot(P, ball, lob);
    this.plan = { tc: now + tc, P, v: shot ? shot.v : null, w: shot ? shot.w : ZERO.clone(), miss: miss || !shot, planned: fresh ? now : (this.plan ? this.plan.planned : now), kind: shot ? shot.kind : 'none', power: shot ? shot.power : 0, done: false };
    if (fresh) this.moveDelay = cfg.react;
  }

  chooseShot(P, ball, lob) {
    const cfg = this.cfg;
    const height = P.y - TABLE.H;
    const T = new THREE.Vector3();
    if (cfg.place === 'center') T.set(gauss() * 0.25, TABLE.H, rr(0.45, 1.05));
    else if (cfg.place === 'corners') T.set((Math.random() < 0.5 ? -1 : 1) * rr(0.35, 0.6), TABLE.H, rr(0.8, 1.25));
    else T.set(-Math.sign(this.playerX || 0.01) * rr(0.45, 0.65), TABLE.H, rr(1.0, 1.28));
    if (cfg.place === 'away' && Math.random() < 0.12) T.set(gauss() * 0.3, TABLE.H, rr(0.25, 0.45));
    T.x = clamp(T.x + gauss() * cfg.sigma, -0.7, 0.7);
    T.z = clamp(T.z + gauss() * cfg.sigma * 0.6, 0.2, 1.3);
    let kind, spd, spin;
    const backspinComing = ball.w.x > 150;
    if (cfg.smash && (height > 0.32 || lob)) { kind = 'smash'; spd = lob ? rr(18, 24) : rr(20, 27); spin = rr(50, 150); T.z = rr(0.9, 1.3); }
    else if (height < 0.06 || (backspinComing && cfg.spin[1] > 0)) { kind = 'loop'; spd = rr(cfg.spd[0], lerp(cfg.spd[0], cfg.spd[1], 0.6)); spin = rr(cfg.spin[0], cfg.spin[1]); }
    else { kind = 'drive'; spd = rr(cfg.spd[0], cfg.spd[1]); spin = rr(cfg.spin[0] * 0.5, cfg.spin[1] * 0.8); }
    const w = new THREE.Vector3(spin, Math.random() < 0.3 ? gauss() * spin * 0.5 : 0, 0);
    let sol = null;
    for (let i = 0; i < 4 && !sol; i++) { sol = solveShot(P, T, spd, w, 0); if (!sol) spd *= kind === 'smash' ? 0.85 : 1.12; }
    if (!sol) return null;
    const th = sol.theta + gauss() * cfg.sigmaTheta;
    const c = Math.cos(th), sp = spd * (1 + gauss() * 0.03);
    return { v: new THREE.Vector3(sp * sol.ux * c, sp * Math.sin(th), sp * sol.uz * c), w, kind, power: clamp(sp / 26, 0, 1) };
  }

  /** Per-frame. Mutates the ball when it hits or serves; pushes events like the physics does. */
  update(dt, ball, match, now, playerX, ev) {
    this.playerX = playerX;
    this.posPrev.copy(this.pos);
    if (match.state === 'SERVE_WAIT' && match.server === 1) this.serveWait(dt, ball, match, ev);
    else if (match.state === 'TOSS' && match.server === 1) this.serveToss(dt, ball, match, ev);
    else if (this.servePhase !== 'idle' && match.state !== 'IN_PLAY') this.servePhase = 'idle';

    const plan = this.plan;
    if (plan && match.state === 'IN_PLAY') {
      if (now - plan.planned >= this.moveDelay) {
        _d.copy(plan.P).sub(this.pos);
        const dist = _d.length(), step = this.cfg.speed * dt;
        if (dist > 1e-4) this.pos.addScaledVector(_d, Math.min(1, step / dist));
      }
      if (this.swing < 0 && now >= plan.tc - 0.09) { this.swing = 0; this.swingV.copy(plan.v || _tmp.set(0, 0.2, 1)).normalize(); this.swingPower = plan.miss ? 0.3 : plan.power; }
      const passed = plan.P.z < -TABLE.halfL && ball.p.z <= plan.P.z + 0.015 && ball.v.z < 0;
      if (!plan.done && (now >= plan.tc || passed)) {
        plan.done = true;
        if (!plan.miss && plan.v && ball.p.distanceTo(plan.P) < 0.35) {
          const speedIn = ball.v.length();
          ball.set(ball.p, plan.v, plan.w);
          ev.push({ type: 'paddle', owner: 1, speedIn, edge: false, slip: false, rho: 0.3, point: ball.p.clone(), normal: plan.v.clone().normalize(), padSpeed: plan.v.length() * 0.6, brush: plan.w.length() * BALL.R, spin: plan.w.length(), speedOut: plan.v.length(), quality: plan.kind === 'smash' ? 'PERFECT' : 'GOOD', kind: plan.kind });
        }
        this.plan = null;
      }
    } else if (match.state !== 'SERVE_WAIT' && match.state !== 'TOSS') {
      this.pos.lerp(this.home, 1 - Math.exp(-3 * dt));
    }
    // the swing: a lunge along the shot, then back
    if (this.swing >= 0) {
      this.swing += dt;
      const T1 = 0.09, T2 = 0.32, amp = 0.1 + 0.12 * this.swingPower;   // a short lunge: the blade stays on its own half
      if (this.swing < T1) this.swingOff = amp * Math.sin(Math.PI * this.swing / T1 / 2);
      else if (this.swing < T1 + T2) { const u = (this.swing - T1) / T2; this.swingOff = amp * (1 - u * u * (3 - 2 * u)); }
      else { this.swing = -1; this.swingOff = 0; }
    }
    this.vel.copy(this.pos).sub(this.posPrev).divideScalar(Math.max(dt, 1e-4));
    // the wrist, mirrored: aim at the far side, close when high, open when low
    const yawT = Math.atan2(this.pos.x, -this.pos.z + TILT.aimZ);
    const dy = this.pos.y - TILT.yRef;
    const pitchT = dy > 0 ? -Math.min(TILT.maxClose, dy * TILT.closeRate) : Math.min(TILT.maxOpen, -dy * TILT.openRate);
    const kr = 1 - Math.exp(-14 * dt);
    this.yaw += (yawT - this.yaw) * kr; this.pitch += (pitchT - this.pitch) * kr;
    const cp = Math.cos(this.pitch);
    this.normal.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    if (this.pos.x > 0.14) this.flipTarget = 1; else if (this.pos.x < -0.14) this.flipTarget = 0;
    this.flip += (this.flipTarget - this.flip) * (1 - Math.exp(-14 * dt));
  }
  /** Where the blade is drawn: the tracked position plus the lunge. */
  visualPos(out) { return out.copy(this.pos).addScaledVector(this.swingV, this.swingOff); }

  serveWait(dt, ball, match, ev) {
    if (this.servePhase === 'idle') { this.servePhase = 'wait'; this.serveTimer = rr(1.0, 1.8) + (match.totalPoints === 0 ? 1.6 : 0); this.serveX = rr(-0.5, 0.5); }
    _hand.set(this.serveX, TABLE.H + 0.12, -SERVE.handZ);
    ball.set(_hand, ZERO);
    this.pos.lerp(_tmp.set(this.serveX + 0.26, TABLE.H + 0.22, -SERVE.handZ - 0.12), 1 - Math.exp(-5 * dt));
    this.serveTimer -= dt;
    if (this.serveTimer <= 0) {
      ball.set(_hand, _v.set(0, 1.7, 0));
      match.toss();
      ev.push({ type: 'toss', owner: 1 });
      this.servePhase = 'toss'; this.serveT = 0;
    }
  }
  serveToss(dt, ball, match, ev) {
    this.serveT += dt;
    if (this.servePhase !== 'toss' || this.serveT < 0.27) return;
    this.servePhase = 'hit';
    const t0 = performance.now();
    const sol = this.solveServe(ball.p);
    this.lastSolveMs = performance.now() - t0;
    const speedIn = ball.v.length();
    ball.set(ball.p, sol.v, sol.w);
    ev.push({ type: 'paddle', owner: 1, serve: true, speedIn, edge: false, slip: false, rho: 0.2, point: ball.p.clone(), normal: sol.v.clone().normalize(), padSpeed: sol.v.length() * 0.7, brush: 0, spin: sol.w.length(), speedOut: sol.v.length(), quality: 'GOOD', kind: 'serve' });
    this.swing = 0; this.swingV.copy(sol.v).normalize(); this.swingPower = 0.35;
  }
  /** A serve that bounces on our side then the player's: pick the best of a small grid. */
  solveServe(P) {
    const cfg = this.cfg;
    const spinMag = cfg.serveSpin * rr(0.5, 1);
    const w = new THREE.Vector3(-spinMag * rr(0.3, 1), (Math.random() < 0.5 ? -1 : 1) * spinMag * rr(0, 0.8), 0);
    // where it should land on the player's side: the easy levels serve to the paddle, the hard
    // ones anywhere; and how deep
    const reach = cfg.serveReach === undefined ? 0.45 : cfg.serveReach;
    const tx = clamp((cfg.serveToPaddle ? this.playerX : 0) + rr(-reach, reach), -0.55, 0.55);
    const tz2 = cfg.serveDepth ? rr(cfg.serveDepth[0], cfg.serveDepth[1]) : rr(0.5, 1.15);
    const base = rr(cfg.serveSpd[0], cfg.serveSpd[1]);
    let best = null, fallback = null;
    // a grid of first-bounce depths, aim heights and speeds; a clean two-bounce serve wins, and
    // the nearest miss is kept so the bot always hits something
    const judge = (v, w2) => {
      _b.set(P, v, w2);
      const r = predict(_b, { ev: _evB, maxT: 2.5, until: (b, t, ev) => countType(ev, 'table') >= 2 || ev.some((x) => x.type === 'netin' || x.type === 'floor' || x.type === 'netclip') });
      const tables = r.events.filter((e) => e.type === 'table');
      if (!tables.length || tables[0].side !== 1) return null;
      const far = tables[1] && tables[1].side === 0 ? Math.abs(tables[1].z - tz2) + Math.abs(tables[1].x - tx) * 0.5 : 2;
      const clean = tables.length >= 2 && tables[1].side === 0 && !r.events.some((e) => e.type === 'netclip' || (e.type === 'nearmiss' && e.clearance < 0.012)) && Math.abs(tables[1].x) < TABLE.halfW - 0.08 && tables[1].z > 0.15 && tables[1].z < TABLE.halfL - 0.1;
      return { far, clean };
    };
    const consider = (spd, z1, h, w2) => {
      // the first bounce lies on the straight line from the hand to the landing spot
      const x1 = P.x + (tx - P.x) * (z1 - P.z) / (tz2 - P.z);
      _d.set(x1 - P.x, TABLE.H + BALL.R + h - P.y, z1 - P.z).normalize();
      _v.copy(_d).multiplyScalar(spd);
      const j = judge(_v, w2);
      if (!j) return;
      if (!fallback || j.far < fallback.score) fallback = { score: j.far, v: _v.clone(), w: w2.clone() };
      if (j.clean && (!best || j.far < best.score)) best = { score: j.far, v: _v.clone(), w: w2.clone() };
    };
    for (const z1 of [-1.05, -0.9, -0.75, -0.6, -0.45]) for (const f of [0.65, 0.8, 1.0, 1.2, 1.45, 1.7, 1.95]) consider(base * f, z1, 0, w);
    if (!best) for (const h of [0.05, 0.12, 0.2]) for (const z1 of [-1.05, -0.85, -0.65, -0.45]) for (const f of [0.7, 0.9, 1.1, 1.35, 1.6, 1.9]) consider(base * f, z1, h, w);
    // still nothing: spin off, which a real server would also drop rather than fault
    if (!best && w.lengthSq() > 0) for (const h of [0, 0.1, 0.2]) for (const z1 of [-1.0, -0.8, -0.6, -0.45]) for (const f of [0.7, 0.9, 1.1, 1.35, 1.6]) consider(base * f, z1, h, ZERO);
    if (best) return best;
    if (fallback) return fallback;
    _d.set(0, -0.35, 1).normalize();
    return { score: 9, v: _d.clone().multiplyScalar(4.5), w: new THREE.Vector3() };
  }
}
