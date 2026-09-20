/**
 * The net assembly: two steel posts on base plates, a white top tape, a navy mesh hung from the
 * tape to a bottom cord. The mesh is a 40 x 6 plane so the game can deform it as cloth at
 * runtime; it is published on userData.cloth for a keepHierarchy load. y = 0 is the table
 * surface, so place the module at the table height. Flat front and back by nature.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const navy = mat(0x1e2a48, 'fabric', 0.9); navy.side = THREE.DoubleSide;
  const white = mat(0xf2f2ee, 'fabric', 0.7);
  const steel = mat(0x8a8f99, 'metal', 0.4, 0.6);
  const ink = mat(0x141620, 'metal', 0.5, 0.3);
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz);
    g.add(mesh); return mesh;
  };
  const L = 1.83, H = 0.1525, PX = L / 2, span = L - 0.04, tapeH = 0.014;

  const cloth = new THREE.Mesh(new THREE.PlaneGeometry(span, H - tapeH, 40, 6), navy);
  cloth.position.set(0, (H - tapeH) / 2, 0);
  g.add(cloth);
  const tape = add(new THREE.BoxGeometry(span, tapeH, 0.006), white, 0, H - tapeH / 2, 0);
  add(new THREE.CylinderGeometry(0.002, 0.002, span, 6), ink, 0, 0.003, 0, 0, 0, Math.PI / 2);
  for (const s of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.01, 0.01, H + 0.02, 12), steel, s * PX, (H + 0.02) / 2, 0);
    add(new THREE.SphereGeometry(0.013, 12, 8), ink, s * PX, H + 0.02, 0);
    add(new THREE.BoxGeometry(0.05, 0.012, 0.06), ink, s * PX, 0.006, 0);
    add(new THREE.BoxGeometry(0.03, 0.02, 0.02), steel, s * (PX - 0.02), H - 0.01, 0);
    add(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 8), ink, s * (PX + 0.008), 0.09, 0.02, Math.PI / 2, 0, 0);
  }
  g.userData.cloth = cloth;
  g.userData.tape = tape;
  g.userData.net = { length: L, height: H, span };
  g.userData.mounts = ['front', 'back'];
  return g;
}
