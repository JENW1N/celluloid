/**
 * Mouse, keys and touch, turned into paddle targets and a handful of actions. Real DOM events
 * only, nothing drives the game through a hook.
 *
 * Desktop: the mouse position is the paddle position, the left button charges while held and
 * swings on release (Space does the same), W tosses the serve, the arrow keys slide the serve
 * along the end line, 1/2/3 pick the opponent, R restarts, M mutes.
 *
 * Touch: the first finger on #stick drags the paddle like a trackpad, a second finger anywhere
 * charges while held and swings when lifted, and #toss serves.
 */
import { PLAYER } from './consts.js?v=202609232318';

/** Some drivers send key without code; take either. */
const KEYS = { w: 'KeyW', r: 'KeyR', m: 'KeyM', ' ': 'Space', 1: 'Digit1', 2: 'Digit2', 3: 'Digit3', 4: 'Digit4', arrowleft: 'ArrowLeft', arrowright: 'ArrowRight', escape: 'Escape' };
function keyCode(e) {
  if (e.code) return e.code;
  const k = String(e.key || '');
  return KEYS[k.length === 1 ? k.toLowerCase() : k.toLowerCase()] || k;
}

export class Input {
  constructor(canvas, paddle, hooks) {
    this.canvas = canvas; this.paddle = paddle; this.hooks = hooks;
    this.keys = new Set();
    this.touch = false; this.primary = null; this.chargeId = null; this.tossAt = -1;
    this.last = { x: 0, y: 0 };
    this.mouse = { x: 0.5, y: 0.55 };
    this.SX = 160; this.SY = 250;          // finger pixels per metre, x and y
    this.bind();
  }
  static prefersTouch() {
    return (('ontouchstart' in window) || navigator.maxTouchPoints > 0) && !window.matchMedia('(pointer:fine)').matches;
  }
  enableTouch() {
    if (this.touch) return;
    this.touch = true;
    document.body.classList.add('touch');
    this.hooks.touchMode && this.hooks.touchMode(true);
  }
  applyMouse() {
    // normalised device coordinates; the game projects them onto the paddle's plane so the
    // blade's centre sits under the cursor
    this.hooks.pointer((this.mouse.x - 0.5) * 2, (0.5 - this.mouse.y) * 2);
  }
  bind() {
    const h = this.hooks;
    window.addEventListener('mousemove', (e) => {
      if (this.touch) return;
      this.mouse.x = e.clientX / window.innerWidth; this.mouse.y = e.clientY / window.innerHeight;
      this.applyMouse();
    });
    this.canvas.addEventListener('mousedown', (e) => { if (e.button !== 0 || this.touch) return; e.preventDefault(); h.chargeStart(); });
    window.addEventListener('mouseup', (e) => { if (e.button !== 0 || this.touch) return; h.release(); });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = keyCode(e);
      this.keys.add(code);
      switch (code) {
        case 'KeyW': h.toss(); break;
        case 'Space': e.preventDefault(); h.chargeStart(); break;
        case 'Digit1': h.level('novice'); break;
        case 'Digit2': h.level('rookie'); break;
        case 'Digit3': h.level('club'); break;
        case 'Digit4': h.level('pro'); break;
        case 'KeyR': h.restart(); break;
        case 'KeyM': h.mute(); break;
        case 'Escape': h.menu(); break;
        default: break;
      }
    });
    window.addEventListener('keyup', (e) => { const code = keyCode(e); this.keys.delete(code); if (code === 'Space') h.release(); });

    const pad = document.getElementById('stick');
    const start = (e) => {
      this.enableTouch();
      for (const t of e.changedTouches) {
        if (this.primary === null) { this.primary = t.identifier; this.last.x = t.clientX; this.last.y = t.clientY; }
        else if (this.chargeId === null) { this.chargeId = t.identifier; h.chargeStart(); }
      }
      e.preventDefault();
    };
    const move = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier !== this.primary) continue;
        const dx = t.clientX - this.last.x, dy = t.clientY - this.last.y;
        this.last.x = t.clientX; this.last.y = t.clientY;
        this.paddle.nudge(dx / this.SX, -dy / this.SY);
      }
      e.preventDefault();
    };
    const lift = () => {
      // lifted within a blink of the toss: it was a tap, not a hold. Toss only, no swing.
      this.chargeId = null;
      if (this.tossAt >= 0 && performance.now() - this.tossAt < 180) { this.tossAt = -1; h.cancelCharge(); }
      else { this.tossAt = -1; h.release(); }
    };
    const end = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.primary) this.primary = null;
        else if (t.identifier === this.chargeId) lift();
      }
      if (e.cancelable) e.preventDefault();
    };
    pad.addEventListener('touchstart', start, { passive: false });
    pad.addEventListener('touchmove', move, { passive: false });
    pad.addEventListener('touchend', end, { passive: false });
    pad.addEventListener('touchcancel', end, { passive: false });
    // a second finger that lands off the pad still charges
    document.addEventListener('touchstart', (e) => {
      if (!this.touch || this.chargeId !== null) return;
      const t = e.changedTouches[0];
      if (!t || (t.target.closest && (t.target.closest('#stick') || t.target.closest('button')))) return;
      if (this.primary === null) return;
      this.chargeId = t.identifier; h.chargeStart();
    }, { passive: true });
    const docEnd = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.chargeId) lift();
    };
    document.addEventListener('touchend', docEnd, { passive: true });
    document.addEventListener('touchcancel', docEnd, { passive: true });
    const toss = document.getElementById('toss');
    // holding TOSS tosses and draws the swing back in one gesture; lifting the thumb swings
    toss.addEventListener('touchstart', (e) => {
      e.preventDefault(); e.stopPropagation(); this.enableTouch();
      h.toss();
      const t = e.changedTouches[0];
      if (t && this.chargeId === null) { this.chargeId = t.identifier; this.tossAt = performance.now(); h.chargeStart(); }
    }, { passive: false });
    toss.addEventListener('click', () => h.toss());
  }
  /** Held keys that repeat: the serve slides while an arrow is down. */
  update(dt) {
    if (this.keys.has('ArrowLeft')) this.hooks.serveNudge(-1.4 * dt);
    if (this.keys.has('ArrowRight')) this.hooks.serveNudge(1.4 * dt);
  }
}
