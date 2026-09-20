/**
 * A shakehand paddle: an elliptical plywood blade 0.157 tall x 0.150 wide with red rubber on the
 * +Z (forehand) face and black on the -Z face, 12 mm thick in all, and a flared 10 cm grip
 * pointing -Y. Origin after recentring is the grip's end; the blade centre is at
 * userData.blade.centerY above it so a game can pivot about the blade.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const wood = mat(0xd7a56e, 'timber', 0.6);
  const red = mat(0xc81e2e, 'fabric', 0.95);
  const black = mat(0x1a1a22, 'fabric', 0.95);
  const ink = mat(0x141620, 'timber', 0.6);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const RX = 0.075, RY = 0.0785, HL = 0.10;
  const ellipse = (rx, ry) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); return s; };
  const slab = (rx, ry, depth) => new THREE.ExtrudeGeometry(ellipse(rx, ry), { depth, bevelEnabled: false, curveSegments: 28 });

  add(slab(RX, RY, 0.006), wood, 0, 0, -0.003);                       // plywood blade
  add(slab(RX - 0.002, RY - 0.002, 0.003), red, 0, 0, 0.003);         // forehand rubber, +Z
  add(slab(RX - 0.002, RY - 0.002, 0.003), black, 0, 0, -0.006);      // backhand rubber, -Z
  add(new THREE.BoxGeometry(0.026, HL, 0.022), wood, 0, -RY - HL / 2 + 0.01, 0);        // grip
  add(new THREE.BoxGeometry(0.034, 0.028, 0.026), wood, 0, -RY - HL + 0.024, 0);        // flared end
  add(new THREE.BoxGeometry(0.028, 0.006, 0.024), ink, 0, -RY - 0.045, 0);              // ply band
  add(new THREE.BoxGeometry(0.036, 0.016, 0.014), wood, 0, -RY + 0.012, 0);             // wings where grip meets blade

  for (const o of g.children) o.position.y += RY + HL - 0.01;   // grip end on the ground
  g.userData.blade = { rx: RX, ry: RY, centerY: RY + HL - 0.01, thickness: 0.012 };
  return g;
}
