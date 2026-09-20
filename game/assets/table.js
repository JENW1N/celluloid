/**
 * Regulation table: 2.74 x 1.525 m, top surface at 0.76 m. Two halves with a hair gap so the
 * fold reads, 2 cm white edge lines and a centre line raised so the toon outline catches them,
 * a dark apron, and a folding undercarriage on castors. Castor bottoms sit at y = 0, centred,
 * symmetric front to back so +Z is the front by construction.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const blue = mat(0x2456a8, 'plaster', 0.55);
  const white = mat(0xf2f2ee, 'plaster', 0.6);
  const ink = mat(0x141620, 'metal', 0.6, 0.3);
  const rubber = mat(0x2a2d38, 'fabric', 0.9, 0);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  const L = 2.74, W = 1.525, H = 0.76, T = 0.03;

  // top slab, two halves with a 4 mm seam
  const halfL = L / 2 - 0.002;
  add(new THREE.BoxGeometry(W, T, halfL), blue, 0, H - T / 2, halfL / 2 + 0.002);
  add(new THREE.BoxGeometry(W, T, halfL), blue, 0, H - T / 2, -(halfL / 2 + 0.002));

  // lines: 2 cm edge lines, 4 mm centre line, raised 1.5 mm
  const lw = 0.02, lt = 0.0015, ly = H + lt / 2;
  add(new THREE.BoxGeometry(lw, lt, L), white, W / 2 - lw / 2, ly, 0);
  add(new THREE.BoxGeometry(lw, lt, L), white, -(W / 2 - lw / 2), ly, 0);
  add(new THREE.BoxGeometry(W, lt, lw), white, 0, ly, L / 2 - lw / 2);
  add(new THREE.BoxGeometry(W, lt, lw), white, 0, ly, -(L / 2 - lw / 2));
  add(new THREE.BoxGeometry(0.004, lt, L - 2 * lw), white, 0, ly, 0);

  // apron under the slab
  const A = 0.06, ay = H - T - A / 2;
  add(new THREE.BoxGeometry(W - 0.05, A, 0.03), ink, 0, ay, L / 2 - 0.04);
  add(new THREE.BoxGeometry(W - 0.05, A, 0.03), ink, 0, ay, -(L / 2 - 0.04));
  add(new THREE.BoxGeometry(0.03, A, L - 0.05), ink, W / 2 - 0.04, ay, 0);
  add(new THREE.BoxGeometry(0.03, A, L - 0.05), ink, -(W / 2 - 0.04), ay, 0);

  // undercarriage: each half stands on a pair of legs joined by tubes, on castors
  const legR = 0.018, wheelR = 0.045, wheelW = 0.03, legX = 0.60, legZ = 0.95;
  const legTop = H - T - A, legH = legTop - wheelR;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(new THREE.CylinderGeometry(legR, legR, legH, 12), ink, sx * legX, wheelR + legH / 2, sz * legZ);
    add(new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 16), rubber, sx * (legX + 0.035), wheelR, sz * legZ, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 8), ink, sx * (legX + 0.02), wheelR, sz * legZ, 0, 0, Math.PI / 2);
  }
  for (const sz of [-1, 1]) {
    add(new THREE.CylinderGeometry(legR, legR, 2 * legX, 12), ink, 0, 0.22, sz * legZ, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(legR, legR, 2 * legX, 12), ink, 0, legTop - 0.02, sz * legZ, 0, 0, Math.PI / 2);
  }
  for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.014, 0.014, 2 * legZ - 0.2, 10), ink, sx * legX, 0.22, 0, Math.PI / 2, 0, 0);
  // a diagonal stay per half, from the low tube up toward the apron centre.
  // rotation.x = atan2(dz, dy) maps the cylinder's +Y onto (0, dy, dz).
  for (const sz of [-1, 1]) {
    const y0 = 0.22, y1 = legTop - 0.02, z0 = sz * legZ, z1 = sz * 0.45;
    const len = Math.hypot(y1 - y0, z1 - z0);
    add(new THREE.CylinderGeometry(0.01, 0.01, len, 8), ink, 0, (y0 + y1) / 2, (z0 + z1) / 2, Math.atan2(z1 - z0, y1 - y0), 0, 0);
  }

  g.userData.table = { length: L, width: W, height: H, top: T };
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
