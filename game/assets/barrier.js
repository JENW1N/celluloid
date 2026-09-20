/**
 * Court surround barrier: a 2.33 x 0.75 m white panel 5 cm thick with a navy 12 cm stripe along
 * the bottom, navy end strips, a navy rounded top rail, and an ink foot plate at each end 30 cm
 * deep with a clamp block and a through bolt so it stands. Identical front and back, so +Z is
 * the front by construction. The foot plates are the lowest points, on y = 0.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const white = mat(0xf2f2ee, 'plaster', 0.6);
  const navy = mat(0x1e2a48, 'fabric', 0.85);
  const ink = mat(0x141620, 'metal', 0.6);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  const L = 2.33, H = 0.75, T = 0.05, STRIPE = 0.12, FOOT = 0.30, PLATE = 0.02, R = 0.03;

  // ink foot plates flat on the ground, a clamp block gripping the panel's bottom edge, and a
  // bolt through the clamp that shows on both faces
  for (const s of [-1, 1]) {
    const x = s * (L / 2 - 0.10);
    add(new THREE.BoxGeometry(0.18, PLATE, FOOT), ink, x, PLATE / 2, 0);
    add(new THREE.BoxGeometry(0.07, 0.11, T + 0.03), ink, x, PLATE + 0.055, 0);
    add(new THREE.CylinderGeometry(0.014, 0.014, T + 0.06, 12), ink, x, PLATE + 0.075, 0, Math.PI / 2, 0, 0);
  }
  // navy base stripe, a hair thicker than the panel so its top edge steps
  add(new THREE.BoxGeometry(L, STRIPE, T + 0.006), navy, 0, PLATE + STRIPE / 2, 0);
  // white panel from the stripe up to the rail's centre line, framed by navy end strips
  const panelH = H - R - PLATE - STRIPE, panelY = PLATE + STRIPE + panelH / 2;
  add(new THREE.BoxGeometry(L, panelH, T), white, 0, panelY, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, panelH, T + 0.006), navy, s * (L / 2 - 0.015), panelY, 0);
  // rounded navy top rail
  add(new THREE.CylinderGeometry(R, R, L, 12), navy, 0, H - R, 0, 0, 0, Math.PI / 2);

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
