/**
 * Leeway trials: does a nearly-right stroke become a hit? Headless Chrome at a real frame rate
 * runs the game, lets the CPU serve, and for each trial parks the paddle a set distance from
 * where the ball will cross the blade's plane, with the stroke played one of three ways:
 *   block  - no click at all (the magnet alone must close the gap)
 *   auto   - the button held as the ball arrives (the level's automatic swing must fire)
 *   hold   - the button released early, 0.24 s of game time before the ball (the held swing must wait)
 * Each trial reports HIT with the quality and assist tags, or MISS. Run at NOVICE and PRO
 * side by side: the leeway should show at NOVICE and be absent at PRO.
 *
 *   node tools/leeway.mjs http://localhost:9000/__game__/game/ [--trials=novice:block:0.2,pro:block:0.2,...]
 */
import { createRequire } from 'node:module';
import path from 'node:path';
const RECIPE = process.env.RECIPE || path.resolve(process.cwd(), '..', '404-game-recipe');
const puppeteer = createRequire(path.join(RECIPE, 'package.json'))('puppeteer');
const url = process.argv[2] || 'http://localhost:9000/__game__/game/';
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const trials = arg('trials', 'novice:block:0.2,pro:block:0.2,novice:block:0.28,novice:auto:0,pro:auto:0,novice:hold:0,pro:hold:0,novice:hold:0.12,club:block:0.16,club:hold:0')
  .split(',').map((t) => { const [level, mode, off] = t.split(':'); return { level, mode, off: +off }; });

// the same launch as the jam harness: on a box with a GPU that is hardware ANGLE, so a 90 ms swing spans real frames
const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--mute-audio'] });
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle0' });
await page.waitForSelector('#startb', { visible: true, timeout: 30000 });
await page.click('#startb');
await new Promise((r) => setTimeout(r, 1500));

const results = [];
for (const t of trials) {
  const line = await page.evaluate(async ({ level, mode, off }) => {
    const D = window.__DBG, G = D.G;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const until = async (fn, ms) => { const t0 = Date.now(); while (!fn() && Date.now() - t0 < ms) await sleep(8); return fn(); };
    G.hasPointer = false;
    G.level = level;
    const P = G.paddle;
    P.charging = false; P.pending = false; P.swingT = -1; P.magnet.set(0, 0);
    if (G.match.state === 'GAME_OVER' || !G.running) { document.getElementById('startb').click(); await sleep(1500); }
    if (mode === 'serve' || mode === 'serveflick' || mode === 'serveflickside' || mode === 'serveflickdown') {
      // the player's own serve: a steady cursor sits by the hand (the way a mouse does), hold to
      // toss, release at the top; in a flick mode the cursor moves 9 cm over the last four
      // frames before the release, up, down or sideways; the spin the ball leaves with is the measure
      if (!(await until(() => G.match.state === 'SERVE_WAIT', 12000))) return `${level} ${mode}: no serve wait (${G.match.state})`;
      G.match.server = 0;
      // the cursor settles by the hand, where the toss will peak, well before the toss: a mouse
      // does not jump, and the flick memory must hold nothing but the flick
      const cur = { x: G.serveX, y: 0.76 + 0.16 + 0.2 };
      const hold = async (ms) => { const t1 = Date.now(); while (Date.now() - t1 < ms) { P.setTarget(cur.x, cur.y); await sleep(8); } };
      await hold(500);
      const hits0 = G.hits;
      D.hooks.chargeStart();
      const t2 = Date.now();
      while (!(G.ballLive && G.ball.v.y < 0.55 && G.ball.v.y > -5) && Date.now() - t2 < 3000) { P.setTarget(cur.x, cur.y); await sleep(8); }
      const dx = mode === 'serveflickside' ? 0.022 : 0, dy = mode === 'serveflick' ? 0.022 : mode === 'serveflickdown' ? -0.022 : 0;
      for (let k = 1; k <= 4; k++) { P.setTarget(cur.x + dx * k, cur.y + dy * k); await sleep(8); }
      D.hooks.release();
      await until(() => G.hits > hits0 || !G.ballLive, 3000);
      const h = G.hitLog[G.hitLog.length - 1];
      const res = G.hits > hits0 ? `HIT ${h.q}/${h.a}@${h.speed} spin ${h.spin},${h.wy},${h.wz} (at contact ${h.spin0},${h.wy0}) el${h.el}` : `NO CONTACT (${G.match.state})`;
      await until(() => G.match.state !== 'IN_PLAY' && G.match.state !== 'TOSS', 8000);
      return `${level.padEnd(6)} ${mode.padEnd(14)} ${res}`;
    }
    if (!(await until(() => G.match.state === 'SERVE_WAIT', 12000))) return `${level} ${mode} off${off}: no serve wait (${G.match.state})`;
    G.match.server = 1;
    if (!(await until(() => G.match.state === 'IN_PLAY' && G.match.lastHitter === 1 && G.ball.v.z > 0.5, 14000))) return `${level} ${mode} off${off}: no serve came (${G.match.state})`;
    // where the ball will cross the blade's plane, and the paddle parked off it
    const zp = P.zBase - 0.02;
    const r = D.predict(G.ball, { maxT: 2, until: (b) => b.p.z >= zp });
    const cx = r.state.p.x, cy = r.state.p.y, tc = r.t;
    P.setTarget(cx + off, cy); P.smooth.set(cx + off, cy);
    const hits0 = G.hits, t0 = Date.now();
    let magMax = 0, hold = 0;
    if (mode === 'auto') P.startCharge();
    if (mode === 'hold') {
      P.startCharge();
      await until(() => G.tCross !== null && G.tCross < 0.24, 3000);
      hold = D.swingHoldFor(P, P.peakFor(P.charge));
      D.hooks.release();
    }
    // track the live crossing the way a player tracks the ring, always the same distance off it;
    // in flick mode the cursor snaps upward (or sideways) in the last tenth of a second, the way
    // a player brushes for spin, and the spin the ball leaves with is the measure
    let flickK = 0;
    while (G.hits === hits0 && G.ballLive && G.match.state === 'IN_PLAY' && Date.now() - t0 < 5000) {
      if (G.ball.v.z > 0.5 && G.ball.p.z < P.meetZ() - 0.05) {
        const zq = P.meetZ() - 0.02;
        const q = D.predict(G.ball, { maxT: 1.5, until: (b) => b.p.z >= zq });
        if (q.stop) {
          let fx = 0, fy = 0;
          if ((mode === 'flickup' || mode === 'flickside') && G.tCross !== null && G.tCross < 0.1) { flickK = Math.min(flickK + 1, 4); if (mode === 'flickup') fy = 0.022 * flickK; else fx = 0.022 * flickK; }
          P.setTarget(q.state.p.x + off + fx, q.state.p.y + fy);
        }
      }
      magMax = Math.max(magMax, P.magnet.length());
      await sleep(8);
    }
    const h = G.hitLog[G.hitLog.length - 1];
    const lp = G.match.lastPoint;
    const res = G.hits > hits0 ? `HIT ${h.q}/${h.a}@${h.speed}${h.el !== undefined ? ` (in${h.before} el${h.el} z${h.z} y${h.y} pad${h.pad} spin ${h.spin},${h.wy},${h.wz})` : ''}`
      : `MISS(${G.match.state}${lp ? ' ' + (lp.let ? 'LET' : lp.reason + ' to ' + lp.winner) : ''} ball z${G.ball.p.z.toFixed(2)} y${G.ball.p.y.toFixed(2)} vz${G.ball.v.z.toFixed(1)} tCross ${G.tCross === null ? 'null' : G.tCross.toFixed(2)} meet ${P.meetZ().toFixed(2)})`;
    const sw = G.hits > hits0 && h.swingT !== undefined ? ` swingT ${h.swingT} phase ${h.phase} pending ${h.pend} sinceSwing ${h.sinceSwing} auto ${h.auto} tReal ${h.tReal}` : '';
    P.charging = false; P.pending = false; P.swingT = -1;
    await until(() => G.match.state !== 'IN_PLAY', 6000);
    return `${level.padEnd(6)} ${mode.padEnd(5)} off${off.toFixed(2)}  ${res.padEnd(28)} cross ${tc.toFixed(2)}s  magnet ${magMax.toFixed(3)} m  hold ${hold.toFixed(2)} s  serve:${G.lastBotServe}${sw}`;
  }, t);
  results.push(line);
  console.log(line);
}
const fps = await page.evaluate(() => window.__GAME__.fps);
console.log(`fps ${fps}  errors ${errors.length}${errors.length ? ' ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
