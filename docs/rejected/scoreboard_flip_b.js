/**
 * Tabletop flip scoreboard, candidate B: a folded sheet-steel A-frame (front plate leaning back
 * 15 degrees, back plate leaning forward, joined by a cyan hinge tube along the apex) with two
 * stacks of line-white flaps hung from rings on the hinge and lying on the plates. Left stack
 * rubber-red edges, right stack stand-navy. The last few flaps are fanned open at the front, the
 * flipped ones lie on the back plate. Cyan trim along both feet and a cyan band across the back.
 * No digits. Front is +Z, base at y = 0, centred.
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
  const boxIn = (parent, w, h, d, m, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  };
  const deg = THREE.MathUtils.degToRad;

  const W = 0.5, H = 0.25, D = 0.14;
  const pt = 0.008;                               // plate thickness
  const lean = deg(15);                           // front plate leans back
  const apexY = H - 0.012, apexZ = -0.03;

  // front plate: a group whose +Y runs up the plate. Negative rotation.x sends the top to -Z.
  const plateLen = apexY / Math.cos(lean);
  const front = new THREE.Group();
  front.position.set(0, 0, apexZ + apexY * Math.tan(lean));
  front.rotation.x = -lean;
  g.add(front);
  boxIn(front, W, plateLen, pt, steel, 0, plateLen / 2, 0);
  boxIn(front, W, 0.014, 0.014, cyan, 0, 0.007, pt / 2 + 0.004);

  // back plate leans forward to the same apex; its outside is local -Z
  const bz = -D / 2 + 0.012;
  const bl = Math.atan2(apexZ - bz, apexY);
  const backLen = apexY / Math.cos(bl);
  const back = new THREE.Group();
  back.position.set(0, 0, bz);
  back.rotation.x = bl;
  g.add(back);
  boxIn(back, W, backLen, pt, steel, 0, backLen / 2, 0);
  boxIn(back, W, 0.014, 0.014, cyan, 0, 0.007, -pt / 2 - 0.004);
  boxIn(back, W - 0.04, 0.02, 0.004, cyan, 0, backLen * 0.5, -pt / 2 - 0.002);
  for (const s of [-1, 1]) boxIn(back, 0.02, backLen - 0.06, 0.006, steel, s * 0.21, backLen / 2, -pt / 2 - 0.003);

  // hinge tube along the apex, cyan, with steel rings that carry the flaps
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, W + 0.01, 12), cyan);
  hinge.position.set(0, apexY, apexZ); hinge.rotation.z = Math.PI / 2; g.add(hinge);

  // flaps hang from pivot groups on the hinge axis: rotation.x negative leans the top back onto
  // the front plate, positive tips the bottom back onto the back plate
  const fw = 0.18, fh = 0.165, drop = 0.014;
  const pivot = (rx) => { const p = new THREE.Group(); p.position.set(0, apexY, apexZ); p.rotation.x = rx; g.add(p); return p; };
  const slab = (rx, x, edge, zoff, n) => {
    const p = pivot(rx), t = n * 0.002;
    boxIn(p, fw, fh, t, edge, x, -drop - fh / 2, zoff);
    boxIn(p, fw - 0.014, fh - 0.014, 0.0015, white, x, -drop - fh / 2, zoff + t / 2 + 0.0005);
    boxIn(p, fw - 0.014, fh - 0.014, 0.0015, white, x, -drop - fh / 2, zoff - t / 2 - 0.0005);
  };
  for (const [x, edge] of [[-0.115, red], [0.115, navy]]) {
    slab(-lean, x, edge, pt / 2 + 0.011, 10);                          // closed stack on the front plate
    [18, 21, 25].forEach((a, i) => slab(-deg(a), x, edge, pt / 2 + 0.026 + i * 0.002, 1));
    slab(bl, x, edge, -pt / 2 - 0.007, 6);                             // flipped flaps on the back plate
    slab(bl + deg(5), x, edge, -pt / 2 - 0.016, 1);
    for (const dx of [-0.06, 0.06]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0025, 5, 12), steel);
      ring.position.set(x + dx, apexY, apexZ); ring.rotation.y = Math.PI / 2; g.add(ring);
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
