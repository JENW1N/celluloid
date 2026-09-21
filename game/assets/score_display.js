/**
 * A seven-segment score display: two digits a side and a colon between them, on a dark housing
 * with a steel frame. Every segment is its own mesh, published by name on userData.segments
 * (l1a .. r0g, plus colon0 and colon1) so a game can light them by swapping materials. Unlit
 * segments are dark. 1.6 m wide, 0.72 m tall, 0.12 m deep; it hangs on a wall, so the back is
 * flat by declaration.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const mat = (color, name, roughness = 0.6, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness, name });
  const housing = mat(0x141620, 'metal', 0.7, 0.2);
  const face = mat(0x0b0d18, 'plaster', 0.8);
  const dark = mat(0x262b40, 'plaster', 0.8);
  const trim = mat(0x8a8f99, 'metal', 0.4, 0.6);
  const add = (geo, m, x, y, z) => { const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  const W = 1.6, H = 0.72, D = 0.12;
  add(new THREE.BoxGeometry(W, H, D), housing, 0, H / 2, -D / 2);
  add(new THREE.BoxGeometry(W - 0.06, H - 0.06, 0.01), face, 0, H / 2, 0.003);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.03, H, 0.14), trim, s * (W / 2 - 0.015), H / 2, -D / 2 + 0.01);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(W, 0.03, 0.14), trim, 0, H / 2 + s * (H / 2 - 0.015), -D / 2 + 0.01);
  const segs = {};
  const digit = (key, cx, cy, dw, dh, th) => {
    const half = dh / 2;
    const seg = (name, w, h, x, y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.014), dark); m.position.set(cx + x, cy + y, 0.015); g.add(m); segs[key + name] = m; };
    seg('a', dw - th, th, 0, half - th / 2);
    seg('g', dw - th, th, 0, 0);
    seg('d', dw - th, th, 0, -half + th / 2);
    seg('f', th, half - th, -dw / 2 + th / 2, half / 2);
    seg('b', th, half - th, dw / 2 - th / 2, half / 2);
    seg('e', th, half - th, -dw / 2 + th / 2, -half / 2);
    seg('c', th, half - th, dw / 2 - th / 2, -half / 2);
  };
  const dw = 0.24, dh = 0.44, th = 0.045, cy = H / 2;
  digit('l1', -0.58, cy, dw, dh, th); digit('l0', -0.28, cy, dw, dh, th);
  digit('r1', 0.28, cy, dw, dh, th); digit('r0', 0.58, cy, dw, dh, th);
  for (const [i, dy] of [[0, 0.1], [1, -0.1]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.014), dark); m.position.set(0, cy + dy, 0.015); g.add(m); segs['colon' + i] = m; }
  g.userData.segments = segs;
  g.userData.display = { width: W, height: H };
  g.userData.mounts = 'back';
  return g;
}
