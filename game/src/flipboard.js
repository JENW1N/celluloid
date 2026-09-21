/**
 * The umpire's flip scoreboard, alive. Each side keeps its stack of numbered cards on the
 * bar; when the score rises the top card lifts, goes over the bar, drops onto the pile behind
 * with a small swing, and the card underneath is the new number. A score that falls (a new
 * game) resets the stack in one flap. Numbers are drawn onto the cards with a canvas at load
 * time, so nothing is a file and any value up to the card count reads.
 */
import * as THREE from 'three';

const FLIP_T = 0.42, SETTLE_T = 0.14;

export function makeCardTexture(n, side) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192;
  const x = c.getContext('2d');
  x.fillStyle = '#f2f2ee'; x.fillRect(0, 0, 256, 192);
  x.fillStyle = side === 0 ? '#4fe3ff' : '#ff7a30'; x.fillRect(0, 176, 256, 16);
  x.fillStyle = '#141620';
  x.font = `bold ${n >= 10 ? 132 : 150}px "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(String(n), 128, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export class FlipBoard {
  constructor(inst) {
    const n = inst.userData.flip ? inst.userData.flip.n : 21;
    this.n = n;
    this.sides = [];
    for (const [key, s] of [['l', 0], ['r', 1]]) {
      const cards = [];
      for (let i = 0; i < n; i++) {
        const card = inst.userData.cards && inst.userData.cards[key + i];
        if (!card) break;
        const front = card.children[0];
        front.material = front.material.clone();
        front.material.map = makeCardTexture(i, s);
        front.material.needsUpdate = true;
        cards.push(card);
      }
      this.sides.push({ cards, shown: 0, target: 0, flip: null });
    }
    for (const S of this.sides) this.refresh(S);
  }
  refresh(S) {
    for (const c of S.cards) c.visible = false;
    const top = S.cards[Math.min(S.shown, S.cards.length - 1)];
    if (top) { top.visible = true; top.rotation.x = 0; top.position.z = 0.003; }
    const next = S.cards[S.shown + 1];
    if (next) { next.visible = true; next.rotation.x = 0; next.position.z = 0.0; }
  }
  set(a, b) { this.sides[0].target = a; this.sides[1].target = b; }
  update(dt, audio) {
    for (const S of this.sides) {
      if (S.flip) {
        S.flip.t += dt;
        const u = Math.min(1, S.flip.t / FLIP_T);
        // lifted quickly, slow over the top, dropped: then a small swing as it lands on the pile
        const e = (1 - Math.cos(u * Math.PI)) / 2;
        const tail = Math.max(0, S.flip.t - FLIP_T);
        const swing = tail > 0 ? Math.sin(Math.min(1, tail / SETTLE_T) * Math.PI) * 0.14 : 0;
        S.flip.card.rotation.x = -2 * Math.PI * e + swing;
        S.flip.card.position.z = e < 0.5 ? 0.003 : -0.007;
        if (S.flip.t >= FLIP_T + SETTLE_T) {
          S.flip.card.visible = false; S.flip = null; S.shown++;
          this.refresh(S);
          if (audio) audio.flapLand();
        }
      } else if (S.target > S.shown) {
        if (S.shown >= S.cards.length - 1) { S.shown = S.target; this.refresh(S); continue; }
        S.flip = { card: S.cards[S.shown], t: 0 };
        if (audio) audio.flap();
      } else if (S.target < S.shown) {
        S.shown = S.target; this.refresh(S);
        if (audio) audio.flap();
      }
    }
  }
}
