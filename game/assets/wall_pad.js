/**
 * A gym wall pad: a blue vinyl-covered foam panel 1.2 wide and 1.9 tall, 8 cm proud of the
 * wall, split into three columns by stitched seams and into thirds by two cross seams, with a
 * rolled top edge, an ink base rail and a row of screw caps along the rail. Front +Z; the back
 * mounts on the wall. Base at y = 0.
 */
export default function (THREE) {
  const g = new THREE.Group();
  g.userData.mounts = 'back';
  const vinyl = new THREE.MeshStandardMaterial({ color: 0x2e5e9e, roughness: 0.6, name: 'fabric' });
  const seam = new THREE.MeshStandardMaterial({ color: 0x1e3e6e, roughness: 0.8, name: 'fabric' });
  const ink = new THREE.MeshStandardMaterial({ color: 0x141620, roughness: 0.8, name: 'metal' });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8f99, roughness: 0.4, metalness: 0.6, name: 'metal' });
  const add = (geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); mesh.rotation.set(rx, ry, rz); g.add(mesh); return mesh; };
  const box = (w, h, d, m, x, y, z) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z);
  const W = 1.2, H = 1.8, D = 0.08;
  box(W, H, D, vinyl, 0, 0.1 + H / 2, 0);
  add(new THREE.CylinderGeometry(0.042, 0.042, W, 16), vinyl, 0, 0.1 + H, 0, 0, 0, Math.PI / 2);
  for (const sx of [-W / 6, W / 6]) box(0.012, H - 0.04, 0.006, seam, sx, 0.1 + H / 2, D / 2 + 0.001);
  for (const y of [0.1 + H / 3, 0.1 + (2 * H) / 3]) box(W - 0.02, 0.012, 0.006, seam, 0, y, D / 2 + 0.001);
  box(W, 0.1, 0.1, ink, 0, 0.05, 0.01);
  for (let i = 0; i < 5; i++) add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 12), steel, -W / 2 + 0.12 + (i * (W - 0.24)) / 4, 0.05, 0.063, Math.PI / 2);
  return g;
}
