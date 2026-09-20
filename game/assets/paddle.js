/**
 * A shakehand paddle with a flared grip. The blade is a 0.157 x 0.150 plywood ellipse, 5.5 mm,
 * with a 4 mm wood lip showing around the rubber; each face carries a sponge layer under its
 * topsheet so the rim reads as two layers: red on +Z, black on -Z, 13 mm in all. The grip is a
 * flared profile with darker scales on both faces, a collar at the blade and a rounded butt.
 * After recentring the grip's butt is on the ground and the blade centre sits at
 * userData.blade.centerY above it, so a game can pivot about the blade.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const ply = mat(0xdcb888, 'timber', 0.6);
  const grip = mat(0xc79a5e, 'timber', 0.65);
  const scale = mat(0x8a5a33, 'timber', 0.7);
  const red = mat(0xd2232a, 'fabric', 0.95);
  const redSponge = mat(0x7a1b22, 'fabric', 0.95);
  const black = mat(0x17171c, 'fabric', 0.95);
  const blackSponge = mat(0x2b2b3a, 'fabric', 0.95);
  const ink = mat(0x141620, 'timber', 0.6);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  const RX = 0.075, RY = 0.0785, HL = 0.10, T = 0.0055;
  const ellipse = (rx, ry) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); return s; };
  const slab = (rx, ry, depth) => new THREE.ExtrudeGeometry(ellipse(rx, ry), { depth, bevelEnabled: false, curveSegments: 28 });

  add(slab(RX, RY, T), ply, 0, 0, -T / 2);                                        // plywood
  add(slab(RX - 0.004, RY - 0.004, 0.0018), redSponge, 0, 0, T / 2);              // +Z sponge
  add(slab(RX - 0.004, RY - 0.004, 0.002), red, 0, 0, T / 2 + 0.0018);            // +Z topsheet
  add(slab(RX - 0.004, RY - 0.004, 0.0018), blackSponge, 0, 0, -T / 2 - 0.0018);  // -Z sponge
  add(slab(RX - 0.004, RY - 0.004, 0.002), black, 0, 0, -T / 2 - 0.0038);         // -Z topsheet

  // the grip: a flared profile in the blade's plane, extruded through the thickness
  const top = -RY + 0.014, bottom = -RY - HL;
  const profile = (w0, w1, wMid) => {
    const s = new THREE.Shape();
    s.moveTo(-w0, top); s.lineTo(w0, top);
    s.quadraticCurveTo(wMid, top - 0.055, w1, bottom + 0.012);
    s.lineTo(w1 * 0.8, bottom); s.lineTo(-w1 * 0.8, bottom); s.lineTo(-w1, bottom + 0.012);
    s.quadraticCurveTo(-wMid, top - 0.055, -w0, top);
    return s;
  };
  const gripGeo = new THREE.ExtrudeGeometry(profile(0.012, 0.018, 0.013), { depth: 0.022, bevelEnabled: false, curveSegments: 6 });
  add(gripGeo, grip, 0, 0, -0.011);
  const scaleGeo = new THREE.ExtrudeGeometry(profile(0.0095, 0.0155, 0.011), { depth: 0.002, bevelEnabled: false, curveSegments: 6 });
  add(scaleGeo, scale, 0, 0, 0.011);
  add(scaleGeo, scale, 0, 0, -0.013);
  add(new THREE.BoxGeometry(0.03, 0.012, 0.028), ink, 0, top - 0.006, 0);           // collar
  const butt = add(new THREE.SphereGeometry(0.0165, 10, 6), grip, 0, bottom, 0);      // rounded butt
  butt.scale.set(1, 0.55, 0.7);

  g.userData.blade = { rx: RX, ry: RY, centerY: RY + HL + 0.0165 * 0.55, thickness: 0.0131 };
  for (const o of g.children) o.position.y += RY + HL + 0.0165 * 0.55;             // butt on the ground
  return g;
}
