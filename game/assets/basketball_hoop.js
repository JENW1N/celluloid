/**
 * A wall-mounted basketball goal for the school gym: two steel struts and braces off a wall
 * plate, a white backboard with an orange border and target square, an orange rim on a bracket
 * and a white net hanging below it as a tapered sleeve. Front +Z faces the court; the rim sits
 * 0.42 above the base (the bottom of the net), so a game places the base 2.63 up for a 3.05 m rim.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name, ...extra });
  const board = mat(0xf2f2ee, 'plaster', 0.55);
  const paint = mat(0xff7a30, 'plaster', 0.6);
  const steel = mat(0x8a8f99, 'metal', 0.4, 0.6);
  const rimM = mat(0xe8541e, 'metal', 0.5, 0.3);
  const netM = mat(0xf2f2ee, 'fabric', 0.9, 0, { side: THREE.DoubleSide });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh;
  };
  const box = (w, h, d, m, x, y, z, rx = 0) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx);

  // the backboard, bottom 0.3 up, front face at z = 0.02
  const BW = 1.8, BH = 1.05, BY = 0.3;
  box(BW, BH, 0.04, board, 0, BY + BH / 2, 0);
  const t = 0.05, fz = 0.0225;
  box(BW, t, 0.005, paint, 0, BY + BH - t / 2, fz);
  box(BW, t, 0.005, paint, 0, BY + t / 2, fz);
  box(t, BH, 0.005, paint, -BW / 2 + t / 2, BY + BH / 2, fz);
  box(t, BH, 0.005, paint, BW / 2 - t / 2, BY + BH / 2, fz);
  // the target square over the rim
  const RY = 0.45, SW = 0.59, SH = 0.45;
  box(SW, 0.04, 0.005, paint, 0, RY + 0.02, fz);
  box(SW, 0.04, 0.005, paint, 0, RY + SH - 0.02, fz);
  box(0.04, SH, 0.005, paint, -SW / 2 + 0.02, RY + SH / 2, fz);
  box(0.04, SH, 0.005, paint, SW / 2 - 0.02, RY + SH / 2, fz);
  // the rim on its bracket, and the net
  const RZ = 0.02 + 0.15 + 0.225;
  add(new THREE.TorusGeometry(0.225, 0.011, 8, 24), rimM, 0, RY, RZ, Math.PI / 2);
  box(0.14, 0.03, 0.17, rimM, 0, RY - 0.005, 0.1);
  add(new THREE.CylinderGeometry(0.22, 0.15, 0.42, 16, 1, true), netM, 0, RY - 0.21, RZ);
  // back to the wall: two struts, two braces, a wall plate
  for (const sx of [-0.4, 0.4]) {
    box(0.07, 0.07, 1.0, steel, sx, 0.95, -0.52);
    box(0.05, 0.05, 1.12, steel, sx, 0.62, -0.52, 0.62);
  }
  box(1.0, 0.9, 0.04, steel, 0, 0.8, -1.04);
  for (const o of g.children) { o.position.y -= 0.03; o.position.z += 0.2145; }   // the net's hem is the base, centred front to back
  g.userData.mounts = 'back';                              // the plate goes against the wall
  return g;
}
