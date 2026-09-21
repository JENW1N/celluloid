/**
 * The interface: a broadcast scorebug whose digits slide out and snap in, a restrained set of
 * toasts, the charge bar, the serve hint, the game-point strip, and the start and result
 * screens. Everything is DOM, nothing here touches the scene.
 */
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.e = {
      load: $('load'), barf: $('barf'), loadmsg: $('loadmsg'), start: $('start'), startb: $('startb'), hud: $('hud'),
      over: $('over'), overh: $('overh'), overp: $('overp'), overb: $('overb'), menub: $('menub'),
      s0: $('s0'), s1: $('s1'), d0: $('d0'), d1: $('d1'), cpu: $('cpuname'), rally: $('rally'), toast: $('toast'),
      quality: $('quality'), hint: $('hint'), gp: $('gp'), charge: $('charge'), chargef: $('chargef'), flash: $('flash'),
      vig: $('vig'), touch: $('touch'), toss: $('toss'), mute: $('mute'), perf: $('perf'),
    };
    this.last = [-1, -1];
    this.toastT = null; this.qualT = null;
  }
  loading(f, msg) { this.e.barf.style.width = `${Math.round(f * 100)}%`; if (msg) this.e.loadmsg.textContent = msg; }
  hideLoading() { this.e.load.classList.add('off'); }
  showStart() { this.e.start.classList.add('on'); this.e.hud.classList.remove('on'); this.e.over.classList.remove('on'); }
  hideStart() { this.e.start.classList.remove('on'); this.e.hud.classList.add('on'); }
  setLevel(key, name) {
    for (const b of document.querySelectorAll('.lv')) b.classList.toggle('sel', b.dataset.level === key);
    this.e.cpu.textContent = name;
  }
  setTouch(on) { document.body.classList.toggle('touch', on); }
  tossVisible(v) { this.e.toss.classList.toggle('on', v); }
  digit(el, value) {
    const cur = el.querySelector('.cur');
    if (cur.textContent === String(value)) return;
    const old = cur.cloneNode(true); old.className = 'out';
    el.appendChild(old);
    cur.textContent = value;
    cur.classList.remove('in'); void cur.offsetWidth; cur.classList.add('in');
    setTimeout(() => old.remove(), 600);
  }
  setScore(score, server, animate = true) {
    if (this.onScore) this.onScore(score[0], score[1]);
    if (!animate) { this.e.s0.querySelector('.cur').textContent = score[0]; this.e.s1.querySelector('.cur').textContent = score[1]; }
    else { this.digit(this.e.s0, score[0]); this.digit(this.e.s1, score[1]); }
    this.e.d0.classList.toggle('on', server === 0); this.e.d1.classList.toggle('on', server === 1);
    this.last = [score[0], score[1]];
  }
  pulseSide(i) { const el = i === 0 ? this.e.s0 : this.e.s1; el.classList.remove('won'); void el.offsetWidth; el.classList.add('won'); }
  toast(text, kind = '', ms = 1300) {
    const t = this.e.toast;
    t.innerHTML = `<span>${text}</span>`; t.className = `on ${kind}`;
    void t.offsetWidth; t.classList.add('anim');
    clearTimeout(this.toastT); this.toastT = setTimeout(() => { t.className = ''; }, ms);
  }
  quality(kind) {
    const q = this.e.quality;
    q.innerHTML = `<span>${kind}</span>`; q.className = `on q-${kind.toLowerCase()}`;
    void q.offsetWidth; q.classList.add('anim');
    clearTimeout(this.qualT); this.qualT = setTimeout(() => { q.className = ''; }, 700);
  }
  rally(n) { this.e.rally.classList.toggle('on', n >= 4); this.e.rally.textContent = n >= 4 ? `${n}` : ''; this.e.rally.classList.toggle('hot', n >= 10); }
  hint(text) { this.e.hint.innerHTML = text ? `<span>${text}</span>` : ''; this.e.hint.classList.toggle('on', !!text); }
  gamePoint(who) { this.e.gp.classList.toggle('on', who >= 0); this.e.gp.textContent = who === 0 ? 'GAME POINT' : who === 1 ? 'GAME POINT · CPU' : ''; this.e.vig.classList.toggle('on', who >= 0); }
  charge(level, charging) {
    this.e.charge.classList.toggle('on', charging);
    this.e.chargef.style.transform = `scaleX(${level.toFixed(3)})`;
    this.e.charge.classList.toggle('full', level >= 0.999);
  }
  focus(level) { this.e.vig.style.opacity = Math.max(this.e.gp.classList.contains('on') ? 1 : 0, 0.22 + level * 0.6); }
  flash(color = 'rgba(255,255,255,0.35)') { const f = this.e.flash; f.style.background = color; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  showOver(win, score, stats) {
    this.e.overh.textContent = win ? 'GAME' : 'GAME · CPU';
    this.e.overp.innerHTML = `${score[0]} · ${score[1]}<br><small>longest rally ${stats.longestRally} · winners ${stats.winners[0]} · errors ${stats.errors[0]}</small>`;
    this.e.over.classList.add('on');
  }
  hideOver() { this.e.over.classList.remove('on'); }
  perf(text) { this.e.perf.textContent = text; }
}
