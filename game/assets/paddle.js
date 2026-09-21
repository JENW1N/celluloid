/**
 * A shakehand racket. The blade is a 0.157 x 0.150 plywood ellipse, 6.5 mm, with a 3.5 mm wood lip
 * showing around the rubber; each face carries a sponge layer under its topsheet so the rim
 * reads as two layers: red on +Z, black on -Z, 13.5 mm in all. The grip is a flared profile
 * with darker scales on both faces, two wood wings where it meets the blade, and a rounded
 * butt. After recentring the butt is on the ground and the blade centre sits at
 * userData.blade.centerY above it, so a game can pivot about the blade.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.7, metalness = 0) =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const ply = mat(0xeed2a4, 'timber', 0.55);
  const grip = mat(0xc9a06a, 'timber', 0.6);
  const scale = mat(0x7d4f2b, 'timber', 0.7);
  const red = mat(0xc8202b, 'fabric', 0.9);
  const redSponge = mat(0x8c1f26, 'fabric', 0.95);
  const black = mat(0x1a1a1f, 'fabric', 0.9);
  const blackSponge = mat(0x30303f, 'fabric', 0.95);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };

  const RX = 0.075, RY = 0.0785, HL = 0.08, T = 0.0065, LIP = 0.0035;
  const ellipse = (rx, ry) => { const s = new THREE.Shape(); s.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0); return s; };
  const slab = (rx, ry, depth) => new THREE.ExtrudeGeometry(ellipse(rx, ry), { depth, bevelEnabled: false, curveSegments: 32 });

  add(slab(RX, RY, T), ply, 0, 0, -T / 2);
  add(slab(RX - LIP, RY - LIP, 0.0018), redSponge, 0, 0, T / 2);
  add(slab(RX - LIP, RY - LIP, 0.0022), red, 0, 0, T / 2 + 0.0018);
  add(slab(RX - LIP, RY - LIP, 0.0018), blackSponge, 0, 0, -T / 2 - 0.0018);
  add(slab(RX - LIP, RY - LIP, 0.0022), black, 0, 0, -T / 2 - 0.004);

  // the grip: a flared profile in the blade's plane, extruded through the thickness
  const top = -RY + 0.012, bottom = -RY - HL;
  const profile = (w0, w1) => {
    const s = new THREE.Shape();
    s.moveTo(-w0, top); s.lineTo(w0, top);
    s.bezierCurveTo(w0 * 0.95, top - 0.04, w1 * 0.9, bottom + 0.035, w1, bottom + 0.008);
    s.lineTo(w1 * 0.7, bottom); s.lineTo(-w1 * 0.7, bottom); s.lineTo(-w1, bottom + 0.008);
    s.bezierCurveTo(-w1 * 0.9, bottom + 0.035, -w0 * 0.95, top - 0.04, -w0, top);
    return s;
  };
  add(new THREE.ExtrudeGeometry(profile(0.012, 0.018), { depth: 0.020, bevelEnabled: false, curveSegments: 8 }), grip, 0, 0, -0.010);
  const scaleGeo = new THREE.ExtrudeGeometry(profile(0.0085, 0.0145), { depth: 0.0025, bevelEnabled: false, curveSegments: 8 });
  add(scaleGeo, scale, 0, 0, 0.010);
  add(scaleGeo, scale, 0, 0, -0.0125);
  // wings: the wood widens into the blade
  const wing = new THREE.Shape();
  wing.moveTo(-0.024, top + 0.012); wing.lineTo(0.024, top + 0.012); wing.lineTo(0.011, top - 0.018); wing.lineTo(-0.011, top - 0.018); wing.closePath();
  add(new THREE.ExtrudeGeometry(wing, { depth: 0.022, bevelEnabled: false }), ply, 0, 0, -0.011);
  const butt = add(new THREE.SphereGeometry(0.0165, 12, 8), grip, 0, bottom, 0);
  butt.scale.set(1, 0.5, 0.65);

  const drop = 0.0165 * 0.5;
  g.userData.blade = { rx: RX, ry: RY, centerY: RY + HL + drop, thickness: 0.0135, gripMidY: -RY - 0.046 };
  for (const o of g.children) o.position.y += RY + HL + drop;
  return g;
}
