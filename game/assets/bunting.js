/**
 * One scallop of bunting for the community hall: a 2 m cord sagging between two hooks, with
 * six cloth pennants in five colours hanging from it, each tilted and turned a little as if
 * hung by hand. A hall strings scallops end to end. Base at y = 0 (the lowest tip), centred.
 */
export default function (THREE) {
  const g = new THREE.Group();
  const cord = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9, name: 'fabric' });
  const cols = [0xd94a4a, 0xf2b134, 0x4fb3e8, 0x67c27a, 0xe86fa2].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, name: 'fabric' }));
  const L = 2, SAG = 0.18, TOP = 0.5, N = 6, FW = 0.24, FH = 0.28;
  const yAt = (x) => TOP - SAG * (1 - (2 * x / L) * (2 * x / L));
  const pts = [];
  for (let i = 0; i <= 8; i++) { const x = -L / 2 + (L * i) / 8; pts.push(new THREE.Vector3(x, yAt(x), 0)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.006, 6, false), cord));
  const tri = new THREE.Shape();
  tri.moveTo(-FW / 2, 0); tri.lineTo(FW / 2, 0); tri.lineTo(0, -FH); tri.closePath();
  const flagGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.004, bevelEnabled: false });
  flagGeo.translate(0, 0, -0.002);
  for (let i = 0; i < N; i++) {
    const x = -L / 2 + 0.2 + ((L - 0.4) * i) / (N - 1);
    const m = new THREE.Mesh(flagGeo, cols[i % cols.length]);
    m.position.set(x, yAt(x), 0);
    m.rotation.z = ((i * 7) % 5 - 2) * 0.03;               // hung by hand: none quite straight
    m.rotation.y = ((i * 3) % 5 - 2) * 0.17;               // and each turned a little on the cord
    g.add(m);
  }
  g.updateMatrixWorld(true);
  const low = new THREE.Box3().setFromObject(g).min.y;
  for (const o of g.children) o.position.y -= low;        // the lowest pennant tip is the base
  return g;
}
