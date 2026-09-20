/**
 * Tabletop flip scoreboard, 0.5 x 0.25 x 0.14 m: a steel tube A-frame (two side triangles, a top
 * bar, floor bars and two rest bars) with two stacks of line-white flaps hanging from rings on the
 * top bar. The left stack has rubber-red flap edges, the right stack stand-navy. The front stacks
 * lean back 15 degrees onto the front rest bar and the last few flaps are fanned open; the
 * flipped-over flaps hang on the back rest bar. Accent-cyan end caps, rest bars and front floor
 * bar. No digits anywhere. Front is +Z, base at y = 0, centred.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const steel = mat(0x8a8f99, 'metal', 0.55, 0.6);
  const white = mat(0xf2f2ee, 'plaster', 0.6);
  const red = mat(0xc81e2e, 'plaster', 0.6);
  const navy = mat(0x1e2a48, 'plaster', 0.6);
  const cyan = mat(0x4fe3ff, 'plaster', 0.55);
  const UP = new THREE.Vector3(0, 1, 0);
  const tube = (a, b, r, m, seg = 12) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const dir = to.clone().sub(from), len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), m);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    g.add(mesh); return mesh;
  };
  const boxIn = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };

  const W = 0.5, H = 0.25, D = 0.14;
  const r = 0.006;                                  // tube radius
  const X = W / 2 - 0.012;                          // side frames
  const apex = { y: H - 0.012, z: -0.02 };          // top bar axis
  const ff = { y: r, z: D / 2 - 0.02 - r };         // front feet
  const bf = { y: r, z: -D / 2 + r };               // back feet
  const zOn = (p0, p1, y) => p0.z + (p1.z - p0.z) * (y - p0.y) / (p1.y - p0.y);

  // side triangles
  for (const s of [-1, 1]) {
    tube([s * X, ff.y, ff.z], [s * X, apex.y, apex.z], r, steel);
    tube([s * X, apex.y, apex.z], [s * X, bf.y, bf.z], r, steel);
    tube([s * X, r, ff.z], [s * X, r, bf.z], r, steel);
  }
  // top bar with cyan end caps, floor bars, and the rest bars the stacks lean on
  tube([-X - r, apex.y, apex.z], [X + r, apex.y, apex.z], 0.007, steel);
  for (const s of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.014, 12), cyan);
    cap.position.set(s * (X + 0.004), apex.y, apex.z); cap.rotation.z = Math.PI / 2; g.add(cap);
  }
  tube([-X, r, ff.z], [X, r, ff.z], r, cyan);
  tube([-X, r, bf.z], [X, r, bf.z], r, steel);
  const restY = 0.06;
  tube([-X, restY, zOn(ff, apex, restY)], [X, restY, zOn(ff, apex, restY)], r, cyan);
  tube([-X, restY, zOn(bf, apex, restY)], [X, restY, zOn(bf, apex, restY)], r, cyan);

  // flaps: 0.18 wide, hung 12 mm below the bar axis. A pivot group at the bar carries each flap,
  // so rotation.x swings it about the hinge. Negative rotation.x leans the top back (-Z);
  // positive tips the bottom back, which is what a flipped flap on the back stack does.
  const fw = 0.18, fh = 0.165, drop = 0.012;
  const pivot = (rx) => { const p = new THREE.Group(); p.position.set(0, apex.y, apex.z); p.rotation.x = rx; g.add(p); return p; };
  const block = (rx, x, edge, zoff, n) => {
    // n flaps closed together read as one slab with the flap edges showing on every side
    const p = pivot(rx), t = n * 0.002;
    boxIn(p, fw, fh, t, edge, x, -drop - fh / 2, zoff);
    boxIn(p, fw - 0.014, fh - 0.014, 0.0015, white, x, -drop - fh / 2, zoff + t / 2 + 0.0005);
    boxIn(p, fw - 0.014, fh - 0.014, 0.0015, white, x, -drop - fh / 2, zoff - t / 2 - 0.0005);
  };
  const flap = (rx, x, edge, zoff) => {
    const p = pivot(rx);
    boxIn(p, fw, fh, 0.002, edge, x, -drop - fh / 2, zoff);
    boxIn(p, fw - 0.014, fh - 0.014, 0.0012, white, x, -drop - fh / 2, zoff + 0.0016);
    boxIn(p, fw - 0.014, fh - 0.014, 0.0012, white, x, -drop - fh / 2, zoff - 0.0016);
  };
  const lean = THREE.MathUtils.degToRad(15);
  const backLean = Math.atan2(apex.z - bf.z, apex.y - bf.y);
  for (const [x, edge] of [[-0.115, red], [0.115, navy]]) {
    block(-lean, x, edge, -0.005, 10);
    for (const a of [19, 23, 28]) flap(-THREE.MathUtils.degToRad(a), x, edge, 0.008);
    block(backLean, x, edge, 0.004, 6);
    flap(backLean + THREE.MathUtils.degToRad(6), x, edge, -0.006);
    // two rings per stack around the top bar
    for (const dx of [-0.06, 0.06]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 5, 10), steel);
      ring.position.set(x + dx, apex.y, apex.z); ring.rotation.y = Math.PI / 2; g.add(ring);
    }
  }

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
