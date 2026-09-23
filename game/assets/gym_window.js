/**
 * A tall gym window: a steel frame round two columns of four panes of bright sky glass, a
 * mullion and three transoms, and a deep sill. The glass is emissive so daylight reads without
 * a light behind it. Front +Z faces the room; base at y = 0.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.5, metalness: 0.2, name: 'metal' });
  const glass = new THREE.MeshStandardMaterial({ color: 0xcdeaff, emissive: 0xb8e2ff, roughness: 0.2, name: 'tile' });
  const box = (w, h, d, m, x, y, z) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  const W = 1.8, H = 2.6, F = 0.08, D = 0.12;
  box(W - 2 * F, H - 2 * F, 0.02, glass, 0, H / 2, -0.02);
  // the frame
  box(W, F, D, frame, 0, H - F / 2, 0);
  box(W, F, D, frame, 0, F / 2 + 0.06, 0);
  box(F, H, D, frame, -W / 2 + F / 2, H / 2, 0);
  box(F, H, D, frame, W / 2 - F / 2, H / 2, 0);
  // a mullion and three transoms
  box(0.04, H - 2 * F, 0.08, frame, 0, H / 2, 0);
  for (const f of [0.25, 0.5, 0.75]) box(W - 2 * F, 0.04, 0.08, frame, 0, F + 0.06 + (H - 2 * F - 0.06) * f, 0);
  // the sill
  box(W + 0.12, 0.06, 0.18, frame, 0, 0.03, 0.03);
  // glazing beads round each pane, a latch on each lower pane, and the top panes tipped open
  // on their hinges the way gym windows are left on a warm day
  const paneW = (W - 2 * F - 0.04) / 2, paneH = (H - 2 * F - 0.06) / 4;
  for (const sx of [-1, 1]) {
    const cx = sx * (paneW / 2 + 0.02);
    for (let r = 0; r < 3; r++) {
      const cy = F + 0.06 + paneH * (r + 0.5);
      box(paneW - 0.03, 0.012, 0.03, frame, cx, cy - paneH / 2 + 0.02, 0.02);
      box(0.012, paneH - 0.03, 0.03, frame, cx - paneW / 2 + 0.02, cy, 0.02);
    }
    box(0.03, 0.08, 0.04, frame, sx * 0.08, F + 0.06 + paneH * 0.5, 0.05);
    const hopper = box(paneW - 0.02, paneH - 0.02, 0.025, glass, cx, H - F - paneH / 2 - 0.02, 0.06);
    hopper.rotation.x = -0.28;
    const edge = box(paneW - 0.02, 0.03, 0.035, frame, cx, H - F - paneH + 0.02, 0.1);
    edge.rotation.x = -0.28;
  }
  g.userData.mounts = 'back';                              // set into the wall
  return g;
}
