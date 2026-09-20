/**
 * The playing floor: an 18 x 18 m dark red slab with the 7 x 14 m court laid on it in court red
 * and 5 cm white boundary lines. A floor is flat from every side by nature, and says so.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.85) => new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, name });
  const red = mat(0xa8383a, 'ground');
  const dark = mat(0x6f2a2c, 'ground', 0.9);
  const white = mat(0xf2f2ee, 'plaster', 0.7);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const SX = 18, SZ = 18, CX = 7, CZ = 14, lw = 0.05, ly = 0.0365;
  add(new THREE.BoxGeometry(SX, 0.03, SZ), dark, 0, 0.015, 0);
  add(new THREE.BoxGeometry(CX, 0.006, CZ), red, 0, 0.033, 0);
  add(new THREE.BoxGeometry(lw, 0.001, CZ), white, CX / 2 - lw / 2, ly, 0);
  add(new THREE.BoxGeometry(lw, 0.001, CZ), white, -(CX / 2 - lw / 2), ly, 0);
  add(new THREE.BoxGeometry(CX, 0.001, lw), white, 0, ly, CZ / 2 - lw / 2);
  add(new THREE.BoxGeometry(CX, 0.001, lw), white, 0, ly, -(CZ / 2 - lw / 2));
  g.userData.mounts = ['front', 'back', 'left', 'right'];
  return g;
}
