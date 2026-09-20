/**
 * Arena wall section: 8.0 x 4.0 x 0.30 m. Navy ground split into 2 m panels by ink joints (a
 * half joint at each end so a run of sections tiles), a court-red-dark kick plate 0.6 high with
 * an ink lip, a raised band at 2.4 m of accent cyan over accent orange, and a line-white cap.
 * Front faces +Z. The back is flat by design: it mounts against the arena shell.
 */
export default function (THREE) {
  const g = new THREE.Group();
  g.userData.mounts = 'back';
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const navy = mat(0x1e2a48, 'plaster', 0.85);
  const redDark = mat(0x6f2a2c, 'plaster', 0.85);
  const cyan = mat(0x4fe3ff, 'plaster', 0.6);
  const orange = mat(0xff7a30, 'plaster', 0.6);
  const white = mat(0xf2f2ee, 'plaster', 0.6);
  const ink = mat(0x141620, 'metal', 0.6);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  const W = 8.0, H = 4.0, D = 0.30, BACK = -D / 2;
  const SLAB = 0.26, F = BACK + SLAB;             // the ground's front face, z = 0.11
  const KICK = 0.6, LIP = 0.025, CAP = 0.06, BAND = 2.4, S = 0.25, PT = 0.02;

  add(new THREE.BoxGeometry(W, H - CAP, SLAB), navy, 0, (H - CAP) / 2, BACK + SLAB / 2);   // ground slab
  add(new THREE.BoxGeometry(W, CAP, D), white, 0, H - CAP / 2, 0);                          // white cap, flush with the band
  add(new THREE.BoxGeometry(W, KICK, 0.04), redDark, 0, KICK / 2, F + 0.02);                // kick plate, front at 0.15
  add(new THREE.BoxGeometry(W, LIP, 0.04), ink, 0, KICK + LIP / 2, F + 0.02);               // ink lip on top of it
  add(new THREE.BoxGeometry(W, S, 0.04), orange, 0, BAND - S / 2, F + 0.02);                // band: orange below 2.4
  add(new THREE.BoxGeometry(W, S, 0.04), cyan, 0, BAND + S / 2, F + 0.02);                  // cyan above it

  // raised navy panels in 2 m modules, 2 cm proud, with 6 cm joints between them and a half
  // joint at each end; the band sits 2 cm proud of the panels
  const J = 0.06, PW = 2.0 - J;
  const rows = [[KICK + LIP + 0.03, BAND - S - 0.03], [BAND + S + 0.03, H - CAP - 0.03]];
  for (const [y0, y1] of rows) for (const cx of [-3, -1, 1, 3]) {
    add(new THREE.BoxGeometry(PW, y1 - y0, PT), navy, cx, (y0 + y1) / 2, F + PT / 2);
  }
  // ink joint strips in the gaps, a touch proud of the slab so they read as a dark seam
  const jy0 = KICK + LIP, jy1 = H - CAP, jy = (jy0 + jy1) / 2, jh = jy1 - jy0;
  for (const jx of [-2, 0, 2]) add(new THREE.BoxGeometry(0.03, jh, 0.01), ink, jx, jy, F + 0.005);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.015, jh, 0.01), ink, s * (W / 2 - 0.0075), jy, F + 0.005);

  recentre(THREE, g);
  return g;
}

function recentre(THREE, g) {
  const box = new THREE.Box3(), v = new THREE.Vector3(), m = new THREE.Matrix4(), im = new THREE.Matrix4();
  g.updateMatrixWorld(true);
  g.traverse((n) => {
    const p = n.isMesh && n.geometry.attributes.position; if (!p) return;
    const put = (mat) => { for (let i = 0; i < p.count; i++) box.expandByPoint(v.fromBufferAttribute(p, i).applyMatrix4(mat)); };
    if (n.isInstancedMesh) { for (let c = 0; c < n.count; c++) { n.getMatrixAt(c, im); put(m.multiplyMatrices(n.matrixWorld, im)); } return; }
    put(n.matrixWorld);
  });
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((o) => { o.position.x -= c.x; o.position.y -= box.min.y; o.position.z -= c.z; });
}
