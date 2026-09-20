/**
 * Courtside towel box: a wood box 0.40 x 0.35 x 0.40 with ink corner posts standing proud of the
 * panels and the rim, two dark grooves round every side, an open top showing a stack of folded
 * accent-orange towels inside, and one towel folded over the front (+Z) edge with a rounded fold
 * and a rolled hem. Base at y = 0, centred.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name, ...extra });
  const wood = mat(0xd7a56e, 'timber', 0.75, 0, { side: THREE.DoubleSide });
  const ink = mat(0x141620, 'timber', 0.8);
  const orange = mat(0xff7a30, 'fabric', 0.9);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  const box = (w, h, d, m, x, y, z, rx = 0, ry = 0, rz = 0) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);

  const W = 0.40, H = 0.35, D = 0.40, post = 0.03, wt = 0.015;
  const px = W / 2 - post / 2, pz = D / 2 - post / 2;
  // corner posts with square caps
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    box(post, H, post, ink, sx * px, H / 2, sz * pz);
    box(post + 0.008, 0.008, post + 0.008, ink, sx * px, H + 0.004, sz * pz);
  }
  // panels between the posts, set back from the post faces, stopping a touch below the post tops
  const span = W - 2 * post, ph = H - 0.02, py = 0.01 + ph / 2, pOff = W / 2 - post / 2 - 0.0075;
  for (const s of [-1, 1]) {
    box(span, ph, wt, wood, 0, py, s * pOff);
    box(wt, ph, span, wood, s * pOff, py, 0);
  }
  box(span, wt, span, wood, 0, 0.0175, 0);
  // two ink grooves round every side, a touch proud so the outline catches them
  const gy = [0.12, 0.23], gOff = pOff + wt / 2 + 0.001;
  for (const y of gy) for (const s of [-1, 1]) {
    box(span, 0.008, 0.004, ink, 0, y, s * gOff);
    box(0.004, 0.008, span, ink, s * gOff, y, 0);
  }

  // folded towels stacked inside, slightly askew
  box(0.30, 0.05, 0.30, orange, 0.01, 0.195, -0.01, 0, 0.10, 0);
  box(0.28, 0.05, 0.29, orange, -0.02, 0.245, 0.01, 0, -0.08, 0);

  // one towel folded over the front edge, off centre: a rounded fold over the rim, a slab
  // hanging outside with a rolled hem, and a shorter slab hanging inside
  const tx = 0.05, tw = 0.20, tt = 0.022, rimY = H - 0.01, wallZ = pOff;
  const foldR = 0.03, foldZ = wallZ;
  add(new THREE.CylinderGeometry(foldR, foldR, tw, 12), orange, tx, rimY - 0.006, foldZ, 0, 0, Math.PI / 2);
  const outerZ = foldZ + foldR - tt / 2, innerZ = foldZ - foldR + tt / 2;
  box(tw, 0.24, tt, orange, tx, rimY - 0.006 - 0.12, outerZ);
  add(new THREE.CylinderGeometry(tt / 2, tt / 2, tw, 12), orange, tx, rimY - 0.006 - 0.24, outerZ, 0, 0, Math.PI / 2);
  box(tw, 0.14, tt, orange, tx, rimY - 0.006 - 0.07, innerZ);

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
