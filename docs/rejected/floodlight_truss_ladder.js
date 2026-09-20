/**
 * Floodlight truss, candidate B: a 6.0 m ladder truss in the vertical plane, two round steel
 * chords 0.35 apart with round-tube zigzag diagonals and a post every metre, and the same four
 * lamp housings hung from the bottom chord on yokes: steel bodies with an accent-orange warning
 * stripe and a line-white lens in an accent-cyan rim, facing down and pitched 17 degrees toward
 * +Z. The lamps give the 0.35 depth; the truss itself is one tube thick. Lowest point is the back
 * edge of the lamps, on y = 0.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const steel = mat(0x8a8f99, 'metal', 0.45, 0.6);
  const orange = mat(0xff7a30, 'plaster', 0.6);
  const cyan = mat(0x4fe3ff, 'plaster', 0.55);
  const white = mat(0xf2f2ee, 'plaster', 0.55);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  const Y = new THREE.Vector3(0, 1, 0);
  const tube = (r, a, b, m) => {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), m);
    mesh.position.copy(A).add(B).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(Y, dir.normalize());
    g.add(mesh); return mesh;
  };

  const L = 6.0, S = 0.35, CR = 0.03, BAYS = 12;
  const Y0 = 0.60;
  const yLo = Y0 + CR, yHi = Y0 + S - CR;
  for (const y of [yLo, yHi]) add(new THREE.CylinderGeometry(CR, CR, L, 12), steel, 0, y, 0, 0, 0, Math.PI / 2);
  const bay = L / BAYS;
  for (let i = 0; i < BAYS; i++) {
    const x0 = -L / 2 + i * bay, x1 = x0 + bay, even = i % 2 === 0;
    tube(0.014, [x0, even ? yLo : yHi, 0], [x1, even ? yHi : yLo, 0], steel);
  }
  for (let i = 0; i <= BAYS; i += 2) tube(0.016, [-L / 2 + i * bay, yLo, 0], [-L / 2 + i * bay, yHi, 0], steel);

  const TILT = -0.30;
  for (const x of [-2.25, -0.75, 0.75, 2.25]) {
    const P = Y0 - 0.32;
    add(new THREE.BoxGeometry(0.10, 0.10, 0.10), steel, x, Y0 + 0.02, 0);                    // clamp round the bottom chord
    add(new THREE.BoxGeometry(0.05, 0.14, 0.05), steel, x, Y0 - 0.06, 0);                    // stem
    add(new THREE.BoxGeometry(0.54, 0.03, 0.03), steel, x, P + 0.22, 0);                     // crossbar
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, 0.24, 0.03), steel, x + s * 0.255, P + 0.11, 0);
    const t = new THREE.Group();
    t.position.set(x, P, 0); t.rotation.x = TILT; g.add(t);
    const put = (geo, m, y, px = 0, rz = 0) => {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(px, y, 0); mesh.rotation.z = rz; t.add(mesh); return mesh;
    };
    put(new THREE.BoxGeometry(0.45, 0.26, 0.28), steel, 0);
    put(new THREE.BoxGeometry(0.46, 0.06, 0.29), orange, 0.02);
    put(new THREE.BoxGeometry(0.41, 0.02, 0.25), cyan, -0.14);
    put(new THREE.BoxGeometry(0.36, 0.02, 0.20), white, -0.155);
    for (const s of [-1, 1]) put(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 12), steel, 0, s * 0.245, Math.PI / 2);
  }

  g.userData.lamps = { count: 4, spacing: 1.5, tilt: TILT };
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
