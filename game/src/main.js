/**
 * CELLULOID. Boot, the frame, and the glue between physics events and everything that reacts
 * to them: rules, sound, effects, the crowd, the camera, the interface, and the bots.
 *
 * The __GAME__ contract at the bottom is what the jam gate reads: pos is the paddle in metres,
 * fps is from real elapsed time, draws and tris come from the renderer.
 */
import * as THREE from 'three';
import { preloadAssets } from '../assetlib.js';
import { TABLE, BALL, FLOOR_Y, PLAYER, SERVE, LEVELS, LEEWAY, SWING, PADDLE, PALETTE, clamp } from './consts.js';
import { BallState, stepWorld, predict, countType } from './physics.js';
import { PlayerPaddle } from './player.js';
import { Input } from './input.js';
import { Match } from './rules.js';
import { Bot } from './bots.js';
import { AudioEngine } from './audio.js';
import { BallVisual, Impacts, Confetti } from './fx.js';
import { NetCloth } from './netcloth.js';
import { buildArena, ASSET_LIST } from './arena.js';
import { UI } from './ui.js';

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0e1a);
const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 120);

const ZERO = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3();
const _ray = new THREE.Raycaster();
const _evA = [], _evR = [], _evM = [];               // event arrays lent to the simulators, so a search makes no garbage

const G = {
  ball: new BallState(), paddle: new PlayerPaddle(), match: new Match(), bot: null, level: 'novice',
  audio: new AudioEngine(), ui: new UI(), input: null, arena: null, ballVis: null, fx: null, cloth: null,
  serveX: 0, events: [], time: 0, running: false, ballLive: false, reachZ: null, touch: false,
  camBase: new THREE.Vector3(0, 1.85, 3.4), lookBase: new THREE.Vector3(0, 0.7, -0.35), look: new THREE.Vector3(0, 0.7, -0.35), fovBase: 48,
  shake: 0, camKick: 0, padVis: [], chargeRing: null, serveMarker: null, hits: 0, overTimer: -1, lowFpsT: 0, dprDropped: false,
  lastPointT: -10, holdingBall: false, whooshT: 0, hitLog: [], gatherT: 0, focus: 1, apexCued: false,
  ndc: new THREE.Vector2(0, -0.2), hasPointer: false, serveOffset: 0, ghosts: [], padHist: [], gameTime: 0, targetRing: null,
  approach: 1, tCross: null, lastSwing: null, lastBotServe: null,
  slow: [], profAssist: 0, profServe: 0, profEv: '', botPending: null, floorHits: 0, lastFloorT: -1,
};
window.__GAME__ = { pos: [0, PLAYER.yNeutral], fps: 60, speed: 0, score: [0, 0], over: false, draws: 0, tris: 0, rally: 0, hits: 0, state: 'LOADING', ball: [0, 0, 0] };
window.__READY__ = false;

const isPhone = () => Math.min(window.innerWidth, window.innerHeight) < 600 || Input.prefersTouch();

// ---------------------------------------------------------------- boot
async function boot() {
  G.ui.loading(0.03, 'renderer');
  let n = 0;
  await Promise.all(ASSET_LIST.map((u) => preloadAssets([u]).then(() => G.ui.loading(0.05 + 0.6 * (++n / ASSET_LIST.length), u.replace('./assets/', '').replace('.js', '')))));
  G.ui.loading(0.7, 'building the venue');
  G.arena = await buildArena(scene, { phone: isPhone() });
  G.ballVis = new BallVisual(G.arena.ball, scene, camera);
  G.fx = new Impacts(scene);
  G.confetti = new Confetti(scene);
  G.cloth = new NetCloth(G.arena.net);
  setupPaddleVisuals();
  // where the ball will cross your paddle plane: a faint ring to put the blade on
  G.targetRing = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.088, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }));
  G.targetRing.visible = false; G.targetRing.renderOrder = 3;
  scene.add(G.targetRing);
  G.serveMarker = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.06, 32), new THREE.MeshBasicMaterial({ color: PALETTE.cyan, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  G.serveMarker.rotation.x = -Math.PI / 2; G.serveMarker.visible = false; G.serveMarker.renderOrder = 3;
  scene.add(G.serveMarker);
  G.ui.loading(0.92, 'warming the shaders');
  await prewarm();
  G.input = new Input(canvas, G.paddle, hooks);
  if (Input.prefersTouch()) { G.input.enableTouch(); }
  G.ui.setTouch(G.input.touch);
  wireButtons();
  G.ui.setLevel(G.level, LEVELS[G.level].name);
  G.ui.onScore = (a, b) => G.arena.setScore && G.arena.setScore(a, b);
  G.ui.setScore([0, 0], -1, false);
  resize();
  window.addEventListener('resize', resize);
  G.ui.loading(1, 'ready');
  G.ui.hideLoading();
  G.ui.showStart();
  placeIdle();
  window.__GAME__.state = 'MENU';
  window.__READY__ = true;
  window.__START__ = () => startGame(G.level);
  requestAnimationFrame(frame);
}

function wireButtons() {
  for (const b of document.querySelectorAll('.lv')) b.addEventListener('click', () => { G.level = b.dataset.level; G.ui.setLevel(G.level, LEVELS[G.level].name); G.audio.ui(); });
  G.ui.e.startb.addEventListener('click', () => startGame(G.level));
  G.ui.e.overb.addEventListener('click', () => startGame(G.level));
  G.ui.e.menub.addEventListener('click', () => { G.running = false; document.body.classList.remove('playing'); G.ui.hideOver(); G.ui.showStart(); placeIdle(); window.__GAME__.state = 'MENU'; });
  G.ui.e.mute.addEventListener('click', () => hooks.mute());
}

const hooks = {
  // where the cursor is, in normalised device coordinates; projected onto the paddle plane each frame
  pointer(nx, ny) { G.ndc.set(nx, ny); G.hasPointer = true; },
  chargeStart() {
    if (!G.running) return;
    // holding the button when it is your serve tosses and charges in one gesture
    if (G.match.state === 'SERVE_WAIT' && G.match.server === 0) hooks.toss();
    if (G.paddle.startCharge()) { G.audio.init(); G.audio.chargeStart(); }
  },
  cancelCharge() {
    if (!G.running || !G.paddle.charging) return;
    G.paddle.charging = false; G.paddle.charge = 0;
    G.audio.chargeEnd(0, true);
  },
  release() {
    if (!G.running || !G.paddle.charging) return;
    const serve = G.match.state === 'TOSS';
    // a release made early waits for the ball (the level says how long); the swing's sound and
    // kick come when the blade actually moves, from update()
    const hold = serve ? 0 : swingHoldFor(G.paddle, G.paddle.peakFor(G.paddle.charge));
    if (!serve && !(G.lastSwing && G.lastSwing.auto && G.lastSwing.t === G.time)) G.lastSwing = { auto: false, tCross: G.tCross, hold, t: G.time, focus: G.focus, approach: G.approach };
    G.paddle.release(serve ? SERVE.power : 1, hold);
  },
  toss() {
    if (!G.running) return;
    const m = G.match;
    if (m.state !== 'SERVE_WAIT' || m.server !== 0) return;
    G.serveX = clamp(G.paddle.pos.x + G.serveOffset, -SERVE.xMax, SERVE.xMax);
    const hand = handPos(_a, G.serveX);
    G.ball.set(hand, _b.set(0, SERVE.tossV, 0));
    m.toss(); G.ballLive = true; G.holdingBall = false;
    G.audio.init(); G.audio.toss();
    G.ui.hint(''); G.ui.tossVisible(false); G.serveMarker.visible = false;
  },
  serveNudge(dx) { G.serveOffset = clamp(G.serveOffset + dx, -SERVE.offsetMax, SERVE.offsetMax); },
  level(key) { if (!G.running) { G.level = key; G.ui.setLevel(key, LEVELS[key].name); } },
  restart() { if (G.running || G.match.over) startGame(G.level); },
  mute() { G.audio.init(); G.audio.setMuted(!G.audio.muted); G.ui.e.mute.textContent = G.audio.muted ? 'SOUND OFF' : 'SOUND ON'; },
  menu() { if (!G.running) return; G.running = false; document.body.classList.remove('playing'); G.ui.showStart(); placeIdle(); window.__GAME__.state = 'MENU'; },
  touchMode(on) { G.touch = on; G.ui.setTouch(on); },
};

function handPos(out, x) { return out.set(x, TABLE.H + SERVE.handY, SERVE.handZ); }

function setupPaddleVisuals() {
  G.padVis = []; G.bladeG = [];
  for (let i = 0; i < 2; i++) {
    const inst = G.arena.paddles[i];
    const pivot = new THREE.Group(), bladeG = new THREE.Group();
    const cy = inst.userData.blade ? inst.userData.blade.centerY : PADDLE.centerY;
    inst.position.set(0, -cy, 0);
    bladeG.add(inst); pivot.add(bladeG);
    scene.add(pivot);
    G.padVis.push(pivot); G.bladeG.push(bladeG);
  }
  // two fading ghosts of the blade, shown during the forward swing
  for (let k = 0; k < 2; k++) {
    const gm = new THREE.Mesh(new THREE.CircleGeometry(0.076, 28), new THREE.MeshBasicMaterial({ color: 0xd2232a, transparent: true, opacity: 0.32 - k * 0.14, depthWrite: false, side: THREE.DoubleSide }));
    gm.matrixAutoUpdate = false; gm.visible = false; gm.renderOrder = 3;
    scene.add(gm); G.ghosts.push(gm);
  }
  for (let k = 0; k < 3; k++) G.padHist.push(new THREE.Matrix4());
  // an arc around the blade that fills as the swing winds up, vertex-coloured so it costs one draw
  const ringGeo = new THREE.RingGeometry(0.108, 0.122, 64, 1);
  ringGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(ringGeo.attributes.position.count * 3), 3));
  G.chargeRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  G.chargeRing.renderOrder = 12; G.chargeRing.visible = false;
  G.padVis[0].add(G.chargeRing);
  G.playerRubber = [];
  G.arena.paddles[0].traverse((o) => { if (o.isMesh && !o.userData.hull && o.material.name === 'fabric') G.playerRubber.push(o.material); });
}

function placeIdle() {
  G.paddle.pos.set(0, PLAYER.yNeutral, PLAYER.z0); G.paddle.posPrev.copy(G.paddle.pos);
  G.ball.set(_a.set(0.2, TABLE.H + 0.12, -SERVE.handZ), ZERO);
  G.ballLive = false; G.holdingBall = true;
}

function startGame(level) {
  G.level = level;
  G.audio.init();
  G.ui.hideStart(); G.ui.hideOver();
  G.ui.setLevel(level, LEVELS[level].name);
  G.match.startGame(1);
  G.bot = new Bot(level);
  G.paddle.assist = LEVELS[level].assist; G.paddle.wrist = LEVELS[level].wrist;
  G.running = true; G.hits = 0; G.overTimer = -1; G.reachZ = null; G.serveX = 0; G.serveOffset = 0;
  document.body.classList.add('playing');
  G.ui.setScore([0, 0], G.match.server, false);
  G.ui.gamePoint(-1); G.ui.rally(0);
  G.arena.setLevel(0);
  onNewServe();
  window.__GAME__.state = 'PLAY';
}

function onNewServe() {
  const m = G.match;
  G.ballLive = false; G.holdingBall = true; G.reachZ = null; G.floorHits = 0;
  G.ui.setScore(m.score, m.server);
  G.ui.gamePoint(m.gamePoint());
  if (m.server === 0) {
    G.serveX = clamp(G.serveX, -SERVE.xMax, SERVE.xMax);
    G.ui.hint(G.input.touch ? 'HOLD TOSS · LIFT AT THE TOP OF THE TOSS' : 'HOLD CLICK TO TOSS · RELEASE AT THE TOP OF THE TOSS · ← → PLACE');
    G.ui.tossVisible(true);
    G.serveMarker.visible = false;                 // the toss follows the paddle; no marker needed
  } else {
    G.ui.hint(''); G.ui.tossVisible(false); G.serveMarker.visible = false;
  }
}

// ---------------------------------------------------------------- the frame
let prevT = null, fpsAcc = 0, fpsN = 0, fpsShow = 60;
function frame(tMs) {
  requestAnimationFrame(frame);
  const now = tMs / 1000;
  const realDt = prevT === null ? 1 / 60 : Math.min(0.25, now - prevT);
  prevT = now;
  fpsAcc += realDt; fpsN++;
  if (fpsAcc >= 0.5) { fpsShow = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; adaptQuality(); }
  const dt = Math.min(realDt, 1 / 30);
  G.time += dt;
  const tA = performance.now();
  if (G.running) update(dt, now, realDt); else idle(dt, now);
  updateCamera(dt);
  const tB = performance.now();
  renderer.render(scene, camera);
  const tC = performance.now();
  // slow frames are kept with what ran in them, so a stutter can be read off the telemetry
  if (tC - tA > 11) { G.slow.push({ t: +now.toFixed(2), up: +(tB - tA).toFixed(1), rd: +(tC - tB).toFixed(1), as: +G.profAssist.toFixed(1), sv: +G.profServe.toFixed(1), ev: G.profEv }); if (G.slow.length > 30) G.slow.shift(); }
  G.profAssist = 0; G.profServe = 0; G.profEv = '';
  telemetry();
}

/**
 * Every material compiled and every texture uploaded behind the loading screen, including the
 * things that only appear in play, so the first point does not stutter on first use.
 */
async function prewarm() {
  const shown = [];
  scene.traverse((o) => { if ((o.isMesh || o.isPoints || o.isLine) && !o.visible) { o.visible = true; shown.push(o); } });
  scene.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of ms) for (const k of ['map', 'emissiveMap', 'alphaMap', 'gradientMap']) if (m[k] && m[k].isTexture) renderer.initTexture(m[k]);
  });
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); else renderer.compile(scene, camera); } catch (err) { console.warn('prewarm', err); }
  renderer.render(scene, camera);
  for (const o of shown) o.visible = false;
}

function idle(dt, now) {
  if (G.hasPointer && !G.input.touch) projectPointer();
  G.paddle.update(dt);
  updatePaddleVisual(0, G.paddle.pos, G.paddle.normal, -1, G.paddle.flip);
  if (G.bot) updatePaddleVisual(1, G.bot.visualPos(_a), G.bot.normal, 1, G.bot.flip);
  else updatePaddleVisual(1, _a.set(0.2, TABLE.H + 0.24, -PLAYER.z0), _n.set(0, 0, 1), 1, 0);
  G.ballVis.update(dt, G.ball, now, true, TABLE.H);
  G.fx.update(dt);
  G.confetti.update(dt);
  G.cloth.update(dt);
  G.arena.crowd.update(dt, 0.1, 0);
  G.arena.atmosphere.update(dt);
  if (G.arena.flip) G.arena.flip.update(dt, null);
  G.audio.update(dt, { rally: 0, tension: false, live: false, running: false });
}

function update(dt, now, realDt) {
  const { ball, paddle, match, bot } = G;
  G.input.update(dt);
  if (G.hasPointer && !G.input.touch) projectPointer();
  // the player serves: the ball waits in the hand, beside the paddle
  if (match.state === 'SERVE_WAIT' && match.server === 0) {
    G.serveX = clamp(paddle.pos.x + G.serveOffset, -SERVE.xMax, SERVE.xMax);
    ball.set(handPos(_a, G.serveX), ZERO);
    G.serveMarker.position.set(G.serveX, TABLE.H + 0.003, TABLE.halfL - 0.04);
  }
  // paddles
  paddle.reachZ = G.reachZ;
  if (paddle.charging) G.audio.chargeLevel(paddle.charge);
  const serving = match.state === 'TOSS' && match.server === 0;
  if (serving && G.ballLive) {
    // the blade is drawn to the tossed ball, and the top of the toss is called out
    const dx = ball.p.x - paddle.target.x, dy = ball.p.y - paddle.target.y;
    if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.24) paddle.setTarget(paddle.target.x + dx * 0.65, paddle.target.y + dy * 0.65);
    if (!G.apexCued && ball.v.y < 0.35) { G.apexCued = true; G.audio.tick(); G.ballVis.flash(); }
  } else G.apexCued = false;
  // leeway: where the ball will cross the blade's plane, how soon, and what the level makes of it
  const L = LEVELS[G.level];
  let mx = 0, my = 0, approachT = 1;
  const meetZ = paddle.meetZ();
  const incoming = G.ballLive && match.state === 'IN_PLAY' && match.lastHitter === 1 && ball.v.z > 0.5 && ball.p.z < meetZ;
  G.tCross = null;
  if (incoming && (L.magnet > 0 || L.approachSlow > 0 || L.autoSwing)) {
    const zp = meetZ - BALL.R;                                 // where the ball will be met, not where the blade rests
    const r = predict(ball, { maxT: 0.7, h: 1 / 300, ev: _evM, until: (b, t, ev) => b.p.z >= zp || ev.some((x) => x.type === 'floor' || x.type === 'netin') });
    if (r.stop && r.state.p.z >= zp - 0.02) {
      const tb = r.t;
      G.tCross = tb;
      if (L.approachSlow > 0 && tb < LEEWAY.approachT) approachT = 1 - L.approachSlow * (1 - tb / LEEWAY.approachT);
      if (L.magnet > 0 && tb < LEEWAY.magnetT) {
        const dx = r.state.p.x - paddle.target.x, dy = r.state.p.y - paddle.target.y, d = Math.hypot(dx, dy);
        if (d < L.magnetR) {
          const f = L.magnet * (1 - tb / LEEWAY.magnetT);
          mx = dx * f; my = dy * f;
          const m = Math.hypot(mx, my);
          if (m > L.magnetMax) { mx *= L.magnetMax / m; my *= L.magnetMax / m; }
        }
      }
      // a charge held as the ball arrives: the wrist snaps on its own, just in time to peak on it
      if (L.autoSwing && paddle.charging && !serving) {
        const tr = timeToPeakReal(paddle, paddle.peakFor(paddle.charge));
        if (tr !== null && tr <= SWING.forwardT * 0.5 + 0.006) { G.lastSwing = { auto: true, tCross: tb, tReal: tr, t: G.time, focus: G.focus, approach: G.approach }; hooks.release(); }
      }
    }
  }
  paddle.magnet.x += (mx - paddle.magnet.x) * (1 - Math.exp(-16 * dt));
  paddle.magnet.y += (my - paddle.magnet.y) * (1 - Math.exp(-16 * dt));
  paddle.update(realDt > 0.05 ? realDt : dt, G.ballLive && (match.lastHitter === 1 || match.state === 'TOSS') ? ball : null, serving);
  if (paddle.takeSwingStart()) { const p = paddle.swingPower; G.audio.chargeEnd(p); G.camKick += 1.5 * p; if (p > 0.85) G.shake = Math.max(G.shake, 0.012); }
  // winding up slows the world: focus. The paddle keeps real time, everything else dilates. The
  // last moments before contact slow as well, by what the level allows.
  const focusT = paddle.charging ? 1 - 0.32 * paddle.charge : 1;
  G.focus += (focusT - G.focus) * (1 - Math.exp(-14 * dt));
  G.approach += (approachT - G.approach) * (1 - Math.exp(-12 * dt));
  const gdt = dt * G.focus * G.approach * (L.slow || 1);
  G.gameTime += gdt;
  const gnow = G.gameTime;
  if (G.botPending) { const pe = G.botPending; G.botPending = null; bot.onBallEvent(pe, ball, match, gnow); }
  bot.update(gdt, ball, match, gnow, paddle.pos.x, G.events);
  if (match.state === 'TOSS' && match.server === 1) G.ballLive = true;
  // physics
  if (G.ballLive) {
    stepWorld(ball, [paddle], gdt, G.events, Math.random);
    if (ball.netHold) G.cloth.press(ball.p.x, ball.p.y, ball.netHold, Math.abs(ball.p.z));
    const out = match.checkOut(ball);
    if (out) handleOutcome(out, gnow);
    const dead = (ball.p.y - BALL.R < FLOOR_Y + 0.01 && ball.v.length() < 0.5) || (G.floorHits >= 4 && match.state !== 'IN_PLAY') || Math.abs(ball.p.x) > 7 || Math.abs(ball.p.z) > 8 || ball.p.y < -1;
    if (dead) {
      if (match.state === 'IN_PLAY') { const o = match.onEvent({ type: 'gone' }, gnow); if (o) handleOutcome(o, gnow); }
      if (match.state === 'TOSS') { match.tossFailed(); onNewServe(); }
      G.ballLive = false;
    }
  }
  for (const e of G.events) handleEvent(e, gnow);
  G.events.length = 0;
  updateTargetRing();
  const tr = match.update(gdt);
  if (tr === 'serve') onNewServe();
  if (G.overTimer >= 0) { G.overTimer -= dt; if (G.overTimer < 0) { G.overTimer = -1; G.running = false; document.body.classList.remove('playing'); G.ui.showOver(match.winner === 0, match.score, { longestRally: match.longestRally, winners: match.stats.winners, errors: match.stats.errors }); window.__GAME__.state = 'OVER'; } }
  // whoosh on a fast swing
  if (paddle.swingT >= 0 && paddle.swingT < 0.02 && G.whooshT < now - 0.2) { G.whooshT = now; }
  // visuals: the player sees the red side of their own blade; the wrist cocks while charging
  updatePaddleVisual(0, paddle.pos, paddle.normal, -1, paddle.flip, paddle.cock(), paddle.charge >= 0.999 && paddle.charging);
  updatePaddleVisual(1, bot.visualPos(_a), bot.normal, 1, bot.flip);
  updateGhosts(paddle);
  const ch = paddle.charging ? paddle.charge : 0;
  updateChargeRing(ch, paddle.charging);
  for (const m of G.playerRubber) { m.emissive.setHex(ch >= 0.999 ? PALETTE.orange : PALETTE.cyan); m.emissiveIntensity = ch * 0.35 + (ch >= 0.999 ? 0.15 + 0.1 * Math.sin(G.time * 24) : 0); }
  if (paddle.charging && G.time - G.gatherT > 0.07) { G.gatherT = G.time; G.fx.gather(paddle.pos, 1 + Math.round(ch * 3), ch >= 0.999 ? PALETTE.orange : PALETTE.cyan, 0.22 + 0.1 * ch); }
  G.ui.charge(ch, paddle.charging);
  G.ui.focus(ch);
  const showBall = G.ballLive || G.holdingBall || match.state === 'SERVE_WAIT';
  G.ballVis.update(gdt, ball, now, showBall, TABLE.H);
  G.fx.update(dt);
  G.confetti.update(dt);
  G.cloth.update(gdt);
  const rallyLvl = clamp((match.rally - 3) / 12, 0, 1);
  G.arena.crowd.update(dt, 0.15 + rallyLvl * 0.85, 0);
  G.arena.atmosphere.update(dt);
  if (G.arena.flip) G.arena.flip.update(dt, G.audio);
  G.arena.setLevel(rallyLvl);
  G.ui.rally(match.rally);
  const tension = match.gamePoint() >= 0 && match.state !== 'POINT_OVER' && match.state !== 'GAME_OVER';
  G.audio.update(dt, { rally: match.rally, tension, live: G.ballLive, running: true });
}

/**
 * How long a release made now should wait so the swing peaks on the ball: the ball's time to the
 * plane where the blade will be fastest, in real seconds under the slow-downs still to come,
 * less the time the swing takes to reach its peak. Zero when no ball is coming or it is late.
 */
function timeToPeakReal(paddle, Vp) {
  const L = LEVELS[G.level];
  const { ball, match } = G;
  if (!G.ballLive || match.state !== 'IN_PLAY' || match.lastHitter !== 1 || ball.v.z <= 0.5) return null;
  const zPeak = paddle.pos.z - Vp * SWING.forwardT / Math.PI - BALL.R;
  if (ball.p.z >= zPeak) return null;
  const r = predict(ball, { maxT: 0.9, h: 1 / 300, until: (b, t, ev) => b.p.z >= zPeak || ev.some((x) => x.type === 'floor' || x.type === 'netin') });
  if (!r.stop || r.state.p.z < zPeak - 0.02) return null;
  const slow = L.slow || 1, n = 8, tg = r.t;
  let real = 0;
  for (let i = 0; i < n; i++) {
    const tb = tg * (1 - (i + 0.5) / n);
    const ap = L.approachSlow > 0 ? 1 - L.approachSlow * (1 - Math.min(1, tb / LEEWAY.approachT)) : 1;
    const fo = 1 + (G.focus - 1) * Math.exp(-14 * real);
    real += (tg / n) / (slow * ap * fo);
  }
  return real;
}
function swingHoldFor(paddle, Vp) {
  const maxHold = LEVELS[G.level].swingHold || 0;
  if (maxHold <= 0) return 0;
  const real = timeToPeakReal(paddle, Vp);
  return real === null ? 0 : clamp(real - SWING.forwardT / 2 - 0.02, 0, maxHold);   // trials read a 20 ms late bias
}

function updateTargetRing() {
  const ring = G.targetRing, { ball, paddle, match } = G;
  const meetZ = paddle.meetZ();
  const want = G.running && LEVELS[G.level].aim && G.ballLive && match.state === 'IN_PLAY' && match.lastHitter === 1 && ball.v.z > 0.5 && ball.p.z < meetZ - 0.05;
  if (!want) { ring.visible = false; return; }
  const zp = meetZ - BALL.R;                                     // the plane the ball will be met on
  const r = predict(ball, { maxT: 2, until: (b, t, ev) => b.p.z >= zp - 0.01 || ev.some((x) => x.type === 'floor' || x.type === 'netin' || (x.type === 'table' && x.side === 0 && ev.filter((y) => y.type === 'table' && y.side === 0).length >= 2)) });
  if (!r.stop || r.state.p.z < zp - 0.03) { ring.visible = false; return; }
  ring.visible = true;
  ring.position.set(r.state.p.x, r.state.p.y, zp);
  const near = clamp((ball.p.z + 0.4) / 2.0, 0, 1);            // fades in as the ball crosses the net
  ring.material.opacity = 0.12 + 0.28 * near;
  const s = 1 + 0.6 * (1 - near);
  ring.scale.set(s, s, 1);
}

function computeReach() {
  // the apex of the ball's flight after its bounce on our side, read off the flight as it is
  // simulated: no samples are kept
  let bounced = false, apexY = -1, apexZ = null, passed = false;
  const r = predict(G.ball, { maxT: 2.5, ev: _evR, until: (b, t, ev) => {
    if (!bounced) { for (let i = 0; i < ev.length; i++) if (ev[i].type === 'table' && ev[i].side === 0) { bounced = true; break; } return b.p.z > 2.3 || ev.some((x) => x.type === 'netin' || x.type === 'floor'); }
    if (b.p.z >= PLAYER.z0) { passed = true; return true; }
    if (b.p.y > apexY) { apexY = b.p.y; apexZ = b.p.z; }
    return countType(ev, 'table') >= 2 || ev.some((x) => x.type === 'floor' || x.type === 'netin');
  } });
  G.reachZ = bounced && !passed && apexZ !== null ? clamp(apexZ, PLAYER.reachMin, PLAYER.z0) : null;
}

/**
 * After the player's contact: if the ball would miss by a little, bend it into a legal shot.
 * Every trial is judged by the live integrator, so what the assist promises the table delivers.
 * A shot's fate moves one way as its elevation rises (own side or net, then too close to the
 * net, then inside, then long), so the elevation that lands it is found by bisection; the pace
 * and the spin are only changed when no elevation works. Whole search: a few dozen simulations.
 */
function applyAssist(isServe) { const t0 = performance.now(); const r = applyAssistInner(isServe); G.profAssist += performance.now() - t0; return r; }
function applyAssistInner(isServe) {
  const cfg = LEVELS[G.level];
  const b = G.ball;
  const halfL = TABLE.halfL, halfW = TABLE.halfW;
  let wideSeen = false;
  // where a shot ends, as a sign: below zero it needs more height (net, own side, too close to
  // the net), above zero less (long, wide, the edge), zero when it lands well inside the lines
  const judge = (state) => {
    const r = predict(state, { h: 1 / 360, maxT: 1.8, ev: _evA, until: (bb, t, ev) => countType(ev, 'table') >= (isServe ? 2 : 1) || ev.some((x) => x.type === 'netin' || x.type === 'floor' || x.type === 'ceiling' || x.type === 'post') });
    const ev = r.events;
    if (ev.some((x) => x.type === 'netin' || x.type === 'post' || x.type === 'netclip' || (x.type === 'nearmiss' && x.clearance < 0.012))) return -1;
    const tables = ev.filter((x) => x.type === 'table');
    if (tables.length < 1) return r.state.p.z > 0 ? -1 : 1;    // never got past the net: more height; over everything: less
    let land;
    if (isServe) {
      const first = tables[0];
      if (first.side !== 0) return 1;                          // no bounce on the server's side: too far
      if (first.z >= halfL - 0.1) return -1;                   // down almost on the end line: too steep
      if (first.z <= 0.25) return 1;                           // bounced up against the net: too far
      if (tables.length < 2) return 1;                         // over the far end after the bounce
      land = tables[1];
      if (land.side !== 1) return -1;                          // twice on the server's side: too slow
    } else {
      land = tables[0];
      if (land.side !== 1) return -1;                          // own side
    }
    if (land.z > -0.12) return -1;                             // too close to the net
    if (Math.abs(land.x) > halfW - 0.06) { wideSeen = true; return 1; }
    if (land.z < -halfL + 0.14 || land.edge) return 1;
    return 0;
  };
  let o0 = judge(b);
  if (o0 === 0) return 'clean';
  const speed = b.v.length();
  if (speed < 0.8) return 'none';
  const hl = Math.hypot(b.v.x, b.v.z);
  if (hl < 0.3) return 'none';
  // a ball brushed almost straight up is not short for want of height: the search starts from
  // a lob and works down from there
  const th0 = Math.min(Math.atan2(b.v.y, hl), 0.75);
  // a slow ball carries no skill premium: below 7 m/s the lower levels may bend it further, and
  // push it a little harder, so a block met low becomes a lob instead of a pop-up
  const slow = !isServe && speed < 7 && cfg.assistAngle >= 0.15;
  const A = isServe ? SERVE.assist : { angle: cfg.assistAngle, pace: cfg.assistPace, spin: cfg.assistSpin, yaw: cfg.assistYaw };
  const maxA = slow ? Math.max(A.angle, 0.55) : A.angle;
  // a dead block cannot reach the net from behind the end line under about 4.5 m/s, so the
  // lower levels may push a slow ball up to lob pace: the boost is a ceiling on the factor
  const boost = slow ? Math.max(1.45, Math.min(cfg.assistBoost || 1.45, 5.6 / speed)) : 1;
  // a slow ball met with the face down may be lifted to a lob whatever its angle as hit, and a
  // ball popped up may be brought down to a drive: the window is relative to the shot as hit,
  // these two are the absolute ends the lower levels may always reach
  const hiMax = slow ? Math.max(th0 + maxA, 0.62) : th0 + maxA;
  const loMin = !isServe && cfg.assistAngle >= 0.15 ? Math.min(th0 - maxA, 0.04) : th0 - maxA;
  const spinMax = A.spin || 0, paceMin = A.pace || 0.95, paceMax = slow ? boost : (isServe ? 1.25 : 1);
  const topspinSign = b.v.z < 0 ? -1 : 1;                    // topspin for a ball travelling -z is negative x
  let ux = b.v.x / hl, uz = b.v.z / hl;
  const trial = new BallState();
  let budget = 100;
  const at = (th, s, dw) => {
    budget--;
    trial.copy(b);
    trial.v.set(s * Math.cos(th) * ux, s * Math.sin(th), s * Math.cos(th) * uz);
    trial.w.x += topspinSign * dw;
    return judge(trial);
  };
  // one pace and spin: 0 when an elevation lands it (trial holds the shot), -1 when even the
  // highest elevation is short of the net (the ball needs pace), +1 when nothing lands it
  const solve = (s, dw) => {
    const oc = s === speed && dw === 0 ? o0 : at(th0, s, dw);
    if (oc === 0) return 0;
    let lo, hi;
    if (oc < 0) {
      lo = th0; hi = hiMax;
      const o = at(hi, s, dw);
      if (o === 0) return 0;
      if (o < 0) return -1;
    } else {
      hi = th0; lo = loMin;
      const o = at(lo, s, dw);
      if (o === 0) return 0;
      if (o > 0) return 1;
    }
    while (hi - lo > 0.004 && budget > 0) {
      const mid = (lo + hi) / 2, o = at(mid, s, dw);
      if (o === 0) return 0;
      if (o < 0) lo = mid; else hi = mid;
    }
    return 1;                                                  // the window is thinner than the search: too fast
  };
  const commit = () => { b.v.copy(trial.v); b.w.copy(trial.w); return 'assisted'; };
  // wide as hit: turn toward the far centre first, by the least that brings the landing in
  // (or by all the level allows), then search pace, spin and height from that direction
  if (wideSeen && (A.yaw || 0) > 0) {
    const ux0 = ux, uz0 = uz;
    const cur = Math.atan2(ux0, uz0), want = Math.atan2(-b.p.x, -1.0 - b.p.z);
    let delta = want - cur;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const sgn = Math.sign(delta), lim = Math.min(Math.abs(delta), A.yaw);
    for (const step of [0.04, 0.08, 0.12, 0.16, 0.2]) {
      if (step > lim + 0.02 || budget <= 0) break;
      const ya = sgn * Math.min(step, lim), c = Math.cos(ya), sn = Math.sin(ya);
      ux = ux0 * c + uz0 * sn; uz = uz0 * c - ux0 * sn;
      wideSeen = false;
      o0 = at(th0, speed, 0);
      if (o0 === 0) return commit();
      if (!wideSeen) break;
    }
  }
  // the search proper: pace as hit, then spin, then pace, then a coarse sweep of the height
  const run = () => {
    const r = solve(speed, 0);
    if (r === 0) return commit();
    if (r > 0) {
      // too fast: topspin first, then pace comes off (with topspin, then without): the fastest
      // pace that lands, by bisection between the level's floor and the shot as hit
      const ts = Math.min(spinMax, 320);
      if (ts > 0 && solve(speed, ts) === 0) return commit();
      if (spinMax >= 400 - 1e-6 && budget > 0 && solve(speed, 400) === 0) return commit();
      const paceDown = (dw) => {
        let lo = paceMin, hi = 1;
        const rl = solve(speed * lo, dw);
        if (rl === 0) return commit();
        if (rl > 0) return null;                                 // even the floor is too fast
        while (hi - lo > 0.05 && budget > 0) {
          const mid = (lo + hi) / 2, rm = solve(speed * mid, dw);
          if (rm === 0) return commit();
          if (rm > 0) hi = mid; else lo = mid;
        }
        return null;
      };
      if (paceMin < 1 - 1e-6) {
        if (ts > 0 && budget > 0) { const p = paceDown(ts); if (p) return p; }
        if (budget > 0) { const p = paceDown(0); if (p) return p; }
      }
    } else {
      for (const sf0 of [1.12, 1.25, 1.45, 1.7, 2.0, 2.4]) {
        if (budget <= 0) break;
        const sf = Math.min(sf0, paceMax);                     // the last rung is the boost ceiling itself
        const rr = solve(speed * sf, 0);
        if (rr === 0) return commit();
        if (rr > 0 || sf0 >= paceMax) break;
      }
    }
    // the fate is not always so tidy (a serve's two bounces): a coarse sweep with what is left
    for (let d = 0.05; d <= maxA + 1e-6 && budget > 0; d += 0.05) {
      if (th0 + d <= hiMax && at(th0 + d, speed, 0) === 0) return commit();
      if (budget > 0 && at(th0 - d, speed, 0) === 0) return commit();
    }
    return 'none';
  };
  let res = run();
  // a wide landing seen anywhere in that search: turn toward the far centre and search again
  if (res === 'none' && wideSeen && (A.yaw || 0) > 0) {
    const ux0 = ux, uz0 = uz;
    const cur = Math.atan2(ux0, uz0), want = Math.atan2(-b.p.x, -1.0 - b.p.z);
    let delta = want - cur;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const sgn = Math.sign(delta), lim = Math.min(Math.abs(delta), A.yaw);
    for (const frac of [0.5, 1]) {
      const ya = sgn * lim * frac, c = Math.cos(ya), sn = Math.sin(ya);
      ux = ux0 * c + uz0 * sn; uz = uz0 * c - ux0 * sn;
      budget = frac < 1 ? 40 : 30; wideSeen = false;             // the whole assist stays under ~170 simulations
      o0 = at(th0, speed, 0);
      if (o0 === 0) return commit();
      res = run();
      if (res === 'assisted') return res;
    }
  }
  return res;
}

/** The same ball seen from the other end: z and the spin components in the table's plane flip. */
function mirrorZ(b) { b.p.z = -b.p.z; b.pPrev.z = -b.pPrev.z; b.v.z = -b.v.z; b.w.x = -b.w.x; b.w.y = -b.w.y; }

function handleEvent(e, now) {
  const { match, paddle, bot, audio, fx, ballVis, ui, cloth } = G;
  G.profEv += e.type[0] + (e.owner !== undefined ? e.owner : '');
  if (e.type === 'paddle' && e.owner === 1 && e.serve) G.profServe += bot.lastSolveMs || 0;
  switch (e.type) {
    case 'paddle': {
      const isPlayer = e.owner === 0;
      const res = match.onEvent(e, now);
      const timing = isPlayer ? paddle.timing() : { kind: e.quality || 'GOOD' };
      const wasPending = isPlayer && paddle.pending;
      if (wasPending) paddle.cancelSwing();
      // the opponent's serve gets the same two-bounce assist a player's serve gets, seen in the
      // mirror: a bot never faults a serve, whatever the toss gave it
      if (!isPlayer && e.serve && match.state === 'IN_PLAY') { mirrorZ(G.ball); G.lastBotServe = applyAssist(true); mirrorZ(G.ball); }
      let q = e.edge ? 'EDGE' : e.slip ? 'THIN' : timing.kind;
      if (isPlayer && e.edge) { G.hitLog.push({ q: 'EDGE', a: '-', serve: !!(res && res.serve !== undefined), speed: +G.ball.v.length().toFixed(1), rho: +e.rho.toFixed(2) }); if (G.hitLog.length > 40) G.hitLog.shift(); }
      if (isPlayer && !e.edge && match.state === 'IN_PLAY') {
        const before = G.ball.v.length();
        const a = applyAssist(!!(res && res.serve !== undefined));
        if (a === 'assisted' && q === 'PERFECT') q = 'GOOD';
        computeReachLater();
        const v = G.ball.v;
        const sw = G.lastSwing && G.time - G.lastSwing.t < 1.5 ? G.lastSwing : null;
        G.hitLog.push({ q, a, serve: !!(res && res.serve !== undefined), before: +before.toFixed(1), speed: +v.length().toFixed(1), el: +Math.atan2(v.y, Math.hypot(v.x, v.z)).toFixed(3), spin: Math.round(G.ball.w.x), wy: Math.round(G.ball.w.y), wz: Math.round(G.ball.w.z), z: +G.ball.p.z.toFixed(2), y: +G.ball.p.y.toFixed(2), pad: +e.padSpeed.toFixed(1),
          swingT: +paddle.swingT.toFixed(3), phase: +timing.phase.toFixed(2), pend: wasPending, sinceSwing: sw ? +(G.time - sw.t).toFixed(3) : null, auto: sw ? sw.auto : null, hold: sw ? +(sw.hold || 0).toFixed(3) : null, tReal: sw ? +(sw.tReal || 0).toFixed(3) : null });
        if (G.hitLog.length > 40) G.hitLog.shift();
      }
      audio.paddle(e.speedIn + e.padSpeed * 0.5, { quality: q, edge: e.edge, slip: e.slip, brush: e.brush });
      fx.impact(e.point, e.normal, q, e.speedOut);
      ballVis.impact(e.normal, clamp(e.speedIn / 30, 0.1, 0.4));
      if (e.speedOut > 17) { G.shake = Math.max(G.shake, 0.012 + (e.speedOut - 17) * 0.0015); G.camKick += 1.2; }
      if (isPlayer) { G.hits++; G.reachZ = null; if (q === 'PERFECT') ui.flash('rgba(79,227,255,0.10)'); }
      else if (e.kind === 'smash') ui.flash('rgba(255,122,48,0.08)');
      bot.onBallEvent(e, G.ball, match, now);
      if (res) handleOutcome(res, now);
      break;
    }
    case 'table': {
      audio.table(e.speed, e);
      fx.impact(_a.set(e.x, TABLE.H, e.z), UP, e.edge ? 'EDGE' : 'BOUNCE', e.speed);
      ballVis.impact(UP, clamp(e.speed / 20, 0.08, 0.3));

      const res = match.onEvent(e, now);
      G.botPending = e;                                   // the bot re-plans next frame, not in the bounce frame
      if (e.side === 0 && match.state === 'IN_PLAY' && match.lastHitter === 1) computeReachLater();
      if (res) handleOutcome(res, now);
      break;
    }
    case 'netclip': {
      audio.net('clip', e.speed);
      cloth.impulse(e.x, e.y, e.dir, 0.035 + 0.04 * e.depth, 0.2);
      fx.impact(_a.set(e.x, e.y, 0), _n.set(0, 0, -e.dir), 'NET', 6);

      const res = match.onEvent(e, now);
      bot.onBallEvent(e, G.ball, match, now);
      if (res) handleOutcome(res, now);
      break;
    }
    case 'netin': {
      audio.net('in', e.speed);
      cloth.impulse(e.x, e.y, e.dir, 0.05 + 0.06 * clamp(e.speed / 15, 0, 1), 0.3);
      const res = match.onEvent(e, now);
      if (res) handleOutcome(res, now);
      break;
    }
    case 'nearmiss': audio.net('zip', e.speed); cloth.impulse(e.x, e.y, e.dir, 0.004 + 0.004 * clamp(e.speed / 15, 0, 1), 0.2); break;
    case 'post': { audio.net('post'); const res = match.onEvent(e, now); if (res) handleOutcome(res, now); break; }
    case 'floor': { G.floorHits++; if (G.time - G.lastFloorT > 0.08 && G.floorHits <= 3) { G.lastFloorT = G.time; audio.floor(e.speed); } const res = match.onEvent(e, now); if (res) handleOutcome(res, now); break; }
    case 'ceiling': { const res = match.onEvent(e, now); if (res) handleOutcome(res, now); break; }
    case 'under': audio.table(e.speed * 0.5); break;
    case 'toss': audio.toss(); break;
    default: break;
  }
}
let reachPending = false;
function computeReachLater() { reachPending = true; }

function handleOutcome(res, now) {
  const { match, ui, audio, arena } = G;
  if (res.serve !== undefined) { ui.hint(''); ui.tossVisible(false); G.serveMarker.visible = false; return; }
  if (res.tossFailed) { onNewServe(); return; }
  if (res.legal !== undefined) {
    return;
  }
  if (res.let) return;
  if (res.point !== undefined) {
    const win = res.point === 0;
    const gp = match.lastPoint && match.lastPoint.gamePoint >= 0;
    G.confetti.shower(res.point, TABLE.H, !!res.gameOver);
    ui.setScore(match.score, match.server);
    ui.pulseSide(res.point);
    audio.point(win, gp || !!res.gameOver);
    audio.cheer(win ? (gp ? 1 : 0.55) : 0.25);
    arena.crowd.update(0, 0, win ? 1 : 0.7);
    ui.flash(win ? 'rgba(79,227,255,0.22)' : 'rgba(255,122,48,0.12)');
    G.shake = Math.max(G.shake, win ? 0.02 : 0.008);
    G.lastPointT = now; G.reachZ = null;
    ui.gamePoint(-1);
    if (res.gameOver) { audio.gameOver(win); G.overTimer = 2.4; window.__GAME__.over = true; }
  }
}

const _ringCol = new THREE.Color();
function updateChargeRing(ch, charging) {
  const ring = G.chargeRing;
  ring.visible = charging && ch > 0.02;
  if (!ring.visible) return;
  const geo = ring.geometry, col = geo.attributes.color, n = col.count;
  _ringCol.setHex(PALETTE.cyan).lerp(new THREE.Color(PALETTE.orange), ch * ch);
  const pulse = ch >= 0.999 ? 0.6 + 0.4 * Math.abs(Math.sin(G.time * 18)) : 1;
  // RingGeometry lays vertices out ring by ring around theta; two rings of 65 vertices each
  const per = n / 2;
  for (let i = 0; i < n; i++) {
    const f = (i % per) / (per - 1);
    const lit = f <= ch ? pulse : (f - ch < 0.03 ? 0.4 : 0);
    col.setXYZ(i, _ringCol.r * lit, _ringCol.g * lit, _ringCol.b * lit);
  }
  col.needsUpdate = true;
}

/**
 * faceToward: +1 shows the red face along the normal (the far side), -1 shows it to the player.
 * flip 0..1 turns the blade in the hand for a backhand; the handle leans toward the hand.
 */
function updatePaddleVisual(i, pos, normal, faceToward, flip, cock = 0, tremble = false) {
  const pivot = G.padVis[i];
  pivot.position.copy(pos);
  _n.copy(normal).normalize();
  _f.copy(_n).multiplyScalar(faceToward);
  _b.copy(pos).add(_f);
  pivot.up.set(0, 1, 0);
  pivot.lookAt(_b);
  const side = 1 - 2 * flip;                       // +1 forehand, -1 backhand
  // a ready position: the blade leans back so its top rim shows and the grip comes toward
  // you, foreshortened; the handle leans a little toward the hand that is not drawn
  pivot.rotateX(-0.22);
  pivot.rotateZ((i === 0 ? 1 : -1) * side * 0.18);
  G.bladeG[i].rotation.y = flip * Math.PI;         // the other face comes round on a backhand
  if (cock > 0) {
    // the wrist cocks: the blade tilts back and swings out to the side, then whips through
    pivot.rotateX(-0.85 * cock);
    pivot.rotateZ(0.5 * cock);
    pivot.position.addScaledVector(_c.crossVectors(_u, _n), 0.07 * cock).y += 0.03 * cock;
  }
  if (tremble) { pivot.position.x += (Math.random() - 0.5) * 0.006; pivot.position.y += (Math.random() - 0.5) * 0.006; }
}

/** Where the cursor ray meets the paddle plane is where the blade's centre goes. */
function projectPointer() {
  _ray.setFromCamera(G.ndc, camera);
  const o = _ray.ray.origin, d = _ray.ray.direction;
  if (Math.abs(d.z) < 1e-4) return;
  const t = (G.paddle.zBase - o.z) / d.z;
  if (t <= 0) return;
  G.paddle.setTarget(o.x + d.x * t, o.y + d.y * t);
}

/** Two ghosts of the blade trail the forward swing. */
function updateGhosts(paddle) {
  const pivot = G.padVis[0];
  pivot.updateMatrixWorld(true);
  const forward = paddle.swingT >= 0 && paddle.swingT < 0.14;
  G.padHist[2].copy(G.padHist[1]); G.padHist[1].copy(G.padHist[0]); G.padHist[0].copy(pivot.matrixWorld);
  for (let k = 0; k < G.ghosts.length; k++) {
    const gm = G.ghosts[k];
    gm.visible = forward && paddle.swingPower > 0.3;
    if (gm.visible) { gm.matrix.copy(G.padHist[k + 1]); gm.matrixWorldNeedsUpdate = true; }
  }
}

// ---------------------------------------------------------------- camera
function layoutCamera() {
  const a = window.innerWidth / window.innerHeight;
  if (a < 0.85) { G.camBase.set(0, 2.35, 3.45); G.lookBase.set(0, 0.55, -1.0); G.fovBase = 64; }
  else if (a < 1.3) { G.camBase.set(0, 2.15, 3.5); G.lookBase.set(0, 0.6, -0.4); G.fovBase = 56; }
  else { G.camBase.set(0, 2.15, 3.35); G.lookBase.set(0, 0.6, -0.35); G.fovBase = 50; }
}
const _camT = new THREE.Vector3(), _lookT = new THREE.Vector3();
function updateCamera(dt) {
  const p = G.paddle;
  const px = G.running ? p.pos.x : 0;
  const bx = G.ballLive ? clamp(G.ball.p.x, -1, 1) : 0;
  const ch = p.charging ? p.charge : 0;
  _camT.copy(G.camBase).add(_a.set(px * 0.05 + bx * 0.04, -0.05 * ch, -0.14 * ch));
  _lookT.copy(G.lookBase).add(_a.set(px * 0.03 + bx * 0.1, 0, 0));
  const k = 1 - Math.exp(-6 * dt);
  camera.position.lerp(_camT, k); G.look.lerp(_lookT, k);
  const rallyZoom = clamp((G.match.rally - 4) / 12, 0, 1) * 4;
  const fov = G.fovBase - rallyZoom - ch * 4 + G.camKick + (ch >= 0.999 ? 1.2 * Math.abs(Math.sin(G.time * 9)) : 0);
  camera.fov += (fov - camera.fov) * (1 - Math.exp(-8 * dt));
  camera.updateProjectionMatrix();
  camera.lookAt(G.look);
  if (G.shake > 0.0005) { camera.position.x += (Math.random() - 0.5) * G.shake; camera.position.y += (Math.random() - 0.5) * G.shake; G.shake *= Math.exp(-11 * dt); }
  G.camKick *= Math.exp(-10 * dt);
}
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  layoutCamera();
  camera.updateProjectionMatrix();
}
function adaptQuality() {
  if (G.dprDropped) return;
  if (fpsShow < 28 && G.running) { G.lowFpsT += 0.5; if (G.lowFpsT >= 3) { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25)); resize(); G.dprDropped = true; } }
  else G.lowFpsT = 0;
}

// ---------------------------------------------------------------- telemetry
const _sp = new THREE.Vector3();
function screenOf(x, y, z) { _sp.set(x, y, z).project(camera); return [(_sp.x + 1) / 2 * window.innerWidth, (1 - _sp.y) / 2 * window.innerHeight]; }
function telemetry() {
  if (reachPending) { reachPending = false; if (G.match.state === 'IN_PLAY' && G.match.lastHitter === 1) computeReach(); }
  const g = window.__GAME__, r = renderer.info.render, m = G.match;
  g.pos = [G.paddle.pos.x, G.paddle.pos.y]; g.paddleZ = G.paddle.pos.z;
  // where the blade is on screen and how many pixels a metre is there, so a driver with a
  // real mouse can aim it (the game itself never reads this)
  const p = G.paddle, pad = screenOf(p.pos.x, p.pos.y, p.zBase);
  g.screen = { pad, pxPerM: [(screenOf(p.pos.x + 0.1, p.pos.y, p.zBase)[0] - pad[0]) / 0.1, (screenOf(p.pos.x, p.pos.y + 0.1, p.zBase)[1] - pad[1]) / 0.1] };
  g.fps = fpsShow; g.speed = G.ballLive ? G.ball.v.length() : 0;
  g.score = m.score; g.over = m.over; g.rally = m.rally; g.hits = G.hits; g.points = m.totalPoints;
  g.draws = r.calls; g.tris = r.triangles;
  g.ball = [G.ball.p.x, G.ball.p.y, G.ball.p.z]; g.ballv = [G.ball.v.x, G.ball.v.y, G.ball.v.z]; g.spin = G.ball.w.length();
  g.level = G.level; g.server = m.server; g.match = m.state; g.live = G.ballLive;
  g.last = m.lastPoint ? (m.lastPoint.let ? ['let'] : [m.lastPoint.winner, m.lastPoint.reason, m.lastPoint.rally]) : null;
  g.lastHit = G.hitLog.length ? G.hitLog[G.hitLog.length - 1] : null;
  g.slow = G.slow;
  if (G.ui.e.perf.classList.contains('on')) G.ui.perf(`${fpsShow} fps · ${r.calls} draws · ${(r.triangles / 1000).toFixed(0)}k tris`);
}

boot().catch((err) => { console.warn('[celluloid] boot failed', err); G.ui.loading(1, 'could not start: ' + (err && err.message)); });

// Debug handles for the console and the gate. Nothing in the game reads these.
import { solveShot } from './bots.js';
window.__DBG = { G, predict, BallState, solveShot, THREE, TABLE, PLAYER, applyAssist, hooks, swingHoldFor };
