/**
 * A tabletop flip scoreboard: a steel A-frame carrying a bar, and on each side a run of
 * cards hanging from rings. The cards are plain white here; the game draws the numbers on
 * them at load time and flips the top card over the bar when the score changes. Every card
 * is a Group whose origin is on the bar, so rotating it about x swings it over; the card's
 * children are, in order, the front face, the back face and the coloured edge strip. Cards
 * are published by name on userData.cards (l0 .. l20, r0 .. r20). Only the first card on
 * each side is visible as built. A blank pile hangs behind each stack.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const steel = mat(0x8a8f99, 'metal', 0.4, 0.6);
  const ink = mat(0x141620, 'metal', 0.6, 0.2);
  const white = mat(0xf2f2ee, 'plaster', 0.85);
  const cyan = mat(0x4fe3ff, 'plaster', 0.6);
  const orange = mat(0xff7a30, 'plaster', 0.6);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
  };
  const BAR_Y = 0.21, W = 0.22, H = 0.16, N = 21;

  // the frame: two pairs of legs meeting at the bar, feet, the bar, its caps and the rings
  for (const s of [-1, 1]) {
    for (const f of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.006, 0.006, 0.222, 10), steel, s * 0.3, 0.105, f * 0.035, -f * 0.32, 0, 0);
      add(new THREE.BoxGeometry(0.03, 0.012, 0.04), ink, s * 0.3, 0.006, f * 0.07);
    }
    add(new THREE.SphereGeometry(0.01, 10, 8), cyan, s * 0.325, BAR_Y, 0);
    for (const r of [-0.06, 0.06]) add(new THREE.TorusGeometry(0.012, 0.0022, 6, 14), steel, s * 0.15 + r, BAR_Y, 0, 0, Math.PI / 2, 0);
  }
  add(new THREE.CylinderGeometry(0.006, 0.006, 0.64, 10), steel, 0, BAR_Y, 0, 0, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.005, 0.005, 0.64, 8), steel, 0, 0.03, 0, 0, 0, Math.PI / 2);

  const cards = {};
  for (const [key, s, edgeMat] of [['l', -1, cyan], ['r', 1, orange]]) {
    // the pile the flipped cards land on
    add(new THREE.BoxGeometry(W, H, 0.014), white, s * 0.15, BAR_Y - H / 2 - 0.006, -0.014);
    for (let i = 0; i < N; i++) {
      const card = new THREE.Group();
      card.position.set(s * 0.15, BAR_Y, 0.003);
      const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), white);
      front.position.set(0, -H / 2 - 0.006, 0.0007);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), white);
      back.position.set(0, -H / 2 - 0.006, -0.0007); back.rotation.y = Math.PI;
      const edge = new THREE.Mesh(new THREE.BoxGeometry(W, 0.016, 0.003), edgeMat);
      edge.position.set(0, -H - 0.006 + 0.008, 0);
      card.add(front); card.add(back); card.add(edge);
      card.visible = i === 0;
      g.add(card);
      cards[key + i] = card;
    }
  }
  g.userData.cards = cards;
  g.userData.flip = { n: N, barY: BAR_Y, w: W, h: H };
  return g;
}
