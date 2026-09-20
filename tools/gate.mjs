#!/usr/bin/env node
/**
 * CELLULOID's own gate. The recipe's playtest drives forward; this one plays table tennis.
 *
 *   node tools/gate.mjs <url> [--out=_gate] [--seconds=50] [--desktop] [--level=rookie] [--style=charge|block]
 *
 * A 390x844 phone viewport with real touches (or a laptop viewport with a real mouse and keys
 * under --desktop). It steers by telemetry, reading __GAME__.ball to know where the ball is, but
 * it only ever moves the paddle with input events: one finger drags on #stick, a second finger
 * charges and releases, #toss is tapped to serve. It never calls into the game.
 *
 * What has to be true for a PASS, and why:
 *   ready      __READY__ within 20 s: the same bar the jam sets
 *   started    a real tap on #startb hides it
 *   moved      the paddle travelled >= 1 m under the finger, the jam's own test
 *   contacts   the player's paddle met the ball >= 3 times: the mechanic exists
 *   returns    >= 1 legal return landed (a rally of 1 or more): the mechanic works
 *   points     >= 4 points were decided: the rules run
 *   errors     no console errors, no 404s
 * It writes eight frames while play is happening, a filmstrip of them, and verdict.json.
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RECIPE = process.env.RECIPE || path.resolve(HERE, '..', '..', '404-game-recipe');
let puppeteer;
try { puppeteer = createRequire(path.join(RECIPE, 'package.json'))('puppeteer'); }
catch { console.error(`puppeteer not found under ${RECIPE}; set RECIPE=<path to 404-game-recipe> (run npm install there)`); process.exit(1); }

const url = process.argv[2];
if (!url || !/^https?:\/\//.test(url)) { console.error('usage: node tools/gate.mjs <url> [--out=_gate] [--seconds=50] [--desktop] [--level=rookie]'); process.exit(1); }
const arg = (k, d) => { const a = process.argv.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const DESKTOP = process.argv.includes('--desktop');
const OUT = path.resolve(arg('out', '_gate'));
const SECONDS = Number(arg('seconds', 50));
const LEVEL = arg('level', 'rookie');
const STYLE = arg('style', 'charge');      // charge: draw back on every return; block: never charge, just meet the ball
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
const VIEW = DESKTOP ? { width: 1280, height: 800, deviceScaleFactor: 1 } : { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
await page.setViewport(VIEW);
if (!DESKTOP) await page.setUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
const errors = [], missing = [];
page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text().slice(0, 200)); });
page.on('response', (r) => { if (r.status() >= 400 && !/favicon\.ico$/.test(r.url())) missing.push(`${r.status()} ${r.url()}`); });
const cdp = await page.createCDPSession();

// ---- input, all real
const fingers = new Map();   // id -> {x, y}
async function touch(type) {
  const touchPoints = [...fingers.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id, radiusX: 8, radiusY: 8, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : touchPoints });
}
async function fingerDown(id, x, y) { fingers.set(id, { x, y }); await touch('touchStart'); }
async function fingerMove(id, x, y) { const f = fingers.get(id); if (!f) return; f.x = x; f.y = y; await touch('touchMove'); }
async function fingerUp(id) {
  if (!fingers.has(id)) return;
  // the protocol describes the ACTIVE set: an empty touchEnd lifts every finger, so lift all
  // and put the survivors straight back down where they were. The game's drag is relative, so
  // the paddle does not jump.
  fingers.delete(id);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  if (fingers.size) await touch('touchStart');
}
/** A tap with our own finger set, so it does not fight the fingers already down. */
async function tapWith(id, sel) {
  const box = await page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }).catch(() => null);
  if (!box || box.w < 4) return false;
  await fingerDown(id, box.x, box.y); await sleep(60); await fingerUp(id);
  return true;
}
const game = () => page.evaluate(() => { const g = window.__GAME__; return g ? JSON.parse(JSON.stringify(g)) : null; }).catch(() => null);

// ---- 1. load
const t0 = Date.now();
let readyS = null;
try {
  await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction('window.__READY__ === true', { timeout: 30000 });
  readyS = (Date.now() - t0) / 1000;
} catch (e) { errors.push('no __READY__: ' + String(e.message).slice(0, 100)); }
await page.screenshot({ path: path.join(OUT, 'loaded.png') });

// ---- 2. pick the level and start, with a real tap or click
const press = async (sel) => {
  const box = await page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; }).catch(() => null);
  if (!box || box.w < 4) return false;
  if (DESKTOP) await page.mouse.click(box.x, box.y); else await page.touchscreen.tap(box.x, box.y);
  return true;
};
await press(`.lv[data-level="${LEVEL}"]`);
await sleep(200);
const tapped = await press('#startb');
await sleep(1500);
const startGone = await page.evaluate(() => { const e = document.querySelector('#startb'); return !e || e.offsetParent === null; });

// ---- 3. play: track the ball, charge, release, serve
const PX_PER_M_X = 160, PX_PER_M_Y = 250;       // the game's finger sensitivities
const pad = { x: VIEW.width * 0.5, y: VIEW.height * 0.62 };
let finger = { x: pad.x, y: pad.y };
let charging = false, tossedAt = 0, moved = 0, posPrev = null, frames = 0;
const frameTimes = [];
const stats = { contacts: 0, rally: 0, points: 0, score: [0, 0], samples: 0, log: [], hits: [] };
if (!DESKTOP) await fingerDown(0, finger.x, finger.y);
else await page.mouse.move(pad.x, pad.y);
const start = Date.now();
const frameEvery = (SECONDS * 1000) / 8;
let nextFrame = start + 2500;
while (Date.now() - start < SECONDS * 1000) {
  const g = await game();
  if (!g) { await sleep(60); continue; }
  stats.samples++;
  if (posPrev) moved += Math.hypot(g.pos[0] - posPrev[0], g.pos[1] - posPrev[1]);
  posPrev = g.pos;
  if ((g.hits || 0) > stats.contacts && g.lastHit) stats.hits.push(`${g.lastHit.serve ? 'S:' : ''}${g.lastHit.q}/${g.lastHit.a}${g.lastHit.speed ? '@' + g.lastHit.speed : ''}`);
  stats.contacts = Math.max(stats.contacts, g.hits || 0);
  stats.rally = Math.max(stats.rally, g.rally || 0);
  if ((g.points || 0) > stats.points && g.last) stats.log.push(`${g.last[0] === 0 ? 'YOU' : g.last[0] === 1 ? 'CPU' : 'LET'} ${g.last[1] || ''} r${g.last[2] || 0} ${g.score.join('-')}`);
  stats.points = g.points || 0; stats.score = g.score;
  if (g.over) break;
  const [bx, by, bz] = g.ball || [0, 0, 0];
  const [vx, vy, vz] = g.ballv || [0, 0, 0];
  const px = g.pos[0], py = g.pos[1];
  const CX = VIEW.width * 0.3, CY = VIEW.height * 0.72;      // where the charge finger lands
  const chargeOn = async () => { if (charging) return; charging = true; if (DESKTOP) await page.mouse.down(); else await fingerDown(1, CX, CY); };
  const chargeOff = async () => { if (!charging) return; charging = false; if (DESKTOP) await page.mouse.up(); else await fingerUp(1); };
  let want = { x: 0, y: 0.92 };
  const plane = g.paddleZ || 1.62;
  if (g.live && g.match === 'IN_PLAY' && bz < plane && vz > 0.3) {
    // a plain ballistic look-ahead with one table bounce: where the ball meets the paddle plane
    let x = bx, y = by, z = bz, vyy = vy, t = 0;
    while (t < 1.5 && z < plane) {
      vyy -= 9.81 / 120; x += vx / 120; y += vyy / 120; z += vz / 120; t += 1 / 120;
      if (y < 0.78 && vyy < 0 && Math.abs(x) < 0.7625 && Math.abs(z) < 1.37) { y = 0.78; vyy = -vyy * 0.9; }
    }
    want = { x, y: Math.max(0.5, Math.min(2.0, y)) };
    if (STYLE === 'charge' && bz > -0.4 && bz < plane - 0.5) await chargeOn();
    if (bz >= plane - 0.5) await chargeOff();
  } else if (g.match === 'TOSS' && g.server === 0 && g.live) {
    // our serve: follow the tossed ball, hold, and let go as it drops onto the blade
    want = { x: bx, y: Math.max(0.6, by) };
    if (vy > 0.6) await chargeOn();
    else if (vy < 0.45) await chargeOff();
  } else await chargeOff();
  // move the paddle toward want with real input, proportional to the error
  if (DESKTOP) {
    // the blade sits under the cursor: move the mouse by the world error scaled by the screen's
    // pixels-per-metre at the blade, which the telemetry reports
    const sc = g.screen;
    if (sc && sc.pad && sc.pxPerM) {
      const mx = sc.pad[0] + (want.x - px) * sc.pxPerM[0] * 0.9, my = sc.pad[1] + (want.y - py) * sc.pxPerM[1] * 0.9;
      await page.mouse.move(Math.max(2, Math.min(VIEW.width - 2, mx)), Math.max(2, Math.min(VIEW.height - 2, my)));
    }
  } else {
    const dx = (want.x - px) * PX_PER_M_X, dy = -(want.y - py) * PX_PER_M_Y;
    const nx = Math.max(10, Math.min(VIEW.width - 10, finger.x + dx * 0.9));
    const ny = Math.max(90, Math.min(VIEW.height - 40, finger.y + dy * 0.9));
    if (Math.abs(nx - finger.x) + Math.abs(ny - finger.y) > 0.5) { finger = { x: nx, y: ny }; await fingerMove(0, nx, ny); }
    // a finger that hit the edge re-grabs in the middle, like a trackpad
    if (nx <= 10 || nx >= VIEW.width - 10 || ny <= 90 || ny >= VIEW.height - 40) { await fingerUp(0); finger = { x: pad.x, y: pad.y }; await fingerDown(0, finger.x, finger.y); }
  }
  // toss when it is our serve
  if (g.match === 'SERVE_WAIT' && g.server === 0 && Date.now() - tossedAt > 2500) {
    tossedAt = Date.now();
    if (DESKTOP) await page.keyboard.press('KeyW'); else await tapWith(2, '#toss');
  }
  if (Date.now() >= nextFrame && frames < 8) {
    await page.screenshot({ path: path.join(OUT, `f${frames}.png`) });
    frameTimes.push((Date.now() - start) / 1000);
    frames++; nextFrame += frameEvery;
  }
  await sleep(30);
}
if (!DESKTOP) { await fingerUp(1); await fingerUp(0); }
const last = await game();

// ---- 4. filmstrip
const imgs = [];
for (let i = 0; i < frames; i++) imgs.push('data:image/png;base64,' + fs.readFileSync(path.join(OUT, `f${i}.png`)).toString('base64'));
const strip = await browser.newPage();
const w = DESKTOP ? 320 : 195, h = DESKTOP ? 200 : 422;
await strip.setViewport({ width: w * Math.max(1, frames) + 8 * (frames + 1), height: h + 40, deviceScaleFactor: 1 });
await strip.setContent(`<body style="margin:0;background:#111;display:flex;gap:8px;padding:8px;font:11px monospace;color:#aaa">${imgs.map((s, i) => `<div><img src="${s}" style="width:${w}px;height:${h}px;object-fit:cover;display:block"><div>${frameTimes[i].toFixed(1)} s</div></div>`).join('')}</body>`);
await strip.screenshot({ path: path.join(OUT, 'strip.png') });
await browser.close();

// ---- 5. verdict
const fails = [];
if (readyS === null) fails.push('never ready'); else if (readyS > 20) fails.push(`ready in ${readyS.toFixed(1)} s`);
if (!tapped || !startGone) fails.push('the start control did not go away after a real tap');
if (moved < 1) fails.push(`paddle moved ${moved.toFixed(2)} m under the finger, needs 1`);
if (stats.contacts < 3) fails.push(`only ${stats.contacts} player contact(s), needs 3`);
if (stats.rally < 1) fails.push('no legal return ever landed');
if (stats.points < 4) fails.push(`only ${stats.points} point(s) decided, needs 4`);
if (errors.length) fails.push(`${errors.length} console error(s): ${errors[0]}`);
if (missing.length) fails.push(`${missing.length} 404(s): ${missing[0]}`);
const verdict = { url, utc: new Date().toISOString(), desktop: DESKTOP, level: LEVEL, style: STYLE, ready_s: readyS, tapped, startGone, moved_m: +moved.toFixed(2), contacts: stats.contacts, longest_rally: stats.rally, points: stats.points, score: stats.score, samples: stats.samples, log: stats.log, hits: stats.hits, final: last, errors, missing, frames: frameTimes, fails, result: fails.length ? 'FAIL' : 'PASS' };
fs.writeFileSync(path.join(OUT, 'verdict.json'), JSON.stringify(verdict, null, 2));
console.log(`=== CELLULOID GATE (${DESKTOP ? 'laptop, mouse and keys' : 'phone, real touch'}) ===`);
console.log(`url         ${url}`);
console.log(`ready       ${readyS === null ? 'never' : readyS.toFixed(1) + ' s'}`);
console.log(`started     ${tapped && startGone ? 'yes' : 'no'}`);
console.log(`moved       ${moved.toFixed(2)} m`);
console.log(`contacts    ${stats.contacts}   longest rally ${stats.rally}   points ${stats.points} (${stats.score.join('-')})`);
console.log(`points      ${stats.log.join(' | ') || 'none'}`);
console.log(`hits        ${stats.hits.join(' | ') || 'none'}`);
console.log(`errors      ${errors.length}   404s ${missing.length}`);
console.log(`filmstrip   ${path.join(OUT, 'strip.png')}`);
console.log(`RESULT: ${verdict.result}${fails.length ? ' (' + fails.join('; ') + ')' : ''}`);
process.exit(fails.length ? 1 : 0);
