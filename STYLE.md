# CELLULOID — the locked style

> Chunky cel-shaded sports gear: every object is built from clean Three.js primitives with slightly
> rounded, slightly oversized proportions, flat saturated colours that will be rendered in two-step
> toon shading behind a dark ink outline, and no printed text or glyphs anywhere.

Cel shading and outlines are applied at LOAD TIME by `game/src/toon.js`. Asset modules stay exactly
on the recipe contract: `MeshStandardMaterial`, flat colours, no textures, no imports. Do not add
outlines or toon materials inside an asset.

| role | hex | where it belongs |
|---|---|---|
| table blue | `0x2456a8` | table top, umpire table cloth |
| line white | `0xf2f2ee` | table lines, net top tape, barrier panels, the ball, bleacher edge trim |
| ink | `0x141620` | table undercarriage, paddle backhand rubber, net cord, chair seats, cable |
| court red | `0xa8383a` | the playing floor |
| court red dark | `0x6f2a2c` | floor border, bleacher risers |
| wood | `0xd7a56e` | paddle blade, handles, bleacher seats, umpire table top |
| rubber red | `0xc81e2e` | paddle forehand rubber, ball bucket, scoreboard flaps |
| steel | `0x8a8f99` | net posts, floodlight trusses, chair and stand frames, bucket rim |
| stand navy | `0x1e2a48` | bleacher structure, barrier base stripe, banner ground |
| accent cyan | `0x4fe3ff` | banner stripes, floodlight lens rims, scoreboard trim |
| accent orange | `0xff7a30` | banner stripes, towel, floodlight housings' warning stripe |
| crowd A | `0x3b4a7a` | spectator bodies |
| crowd B | `0x8a3b4a` | spectator bodies |
| crowd C | `0xe0b040` | spectator bodies |
| crowd D | `0x3f8f6a` | spectator bodies |
| crowd skin | `0xe6c9a8` | spectator heads |

## Fixed decisions
- Metres. Base at y = 0, centred on x and z, front faces +Z.
- Table 2.74 long (z) x 1.525 wide (x), top surface at 0.76 high, top slab 0.03 thick, dark apron 0.06.
- Net 0.1525 high above the table, 1.83 long (0.1525 past each side), posts 0.02 thick at x = +-0.9125.
- Paddle blade 0.157 tall x 0.150 wide, 0.012 thick with rubber, handle 0.10 long x 0.028 wide; the
  blade's centre is the module's origin on x/z and the handle points -Y then is lifted to y = 0.
- Ball 0.040 diameter, one tinted equatorial band 0.006 wide so spin reads.
- Barrier 2.33 long x 0.75 high x 0.05 thick, white panel, navy stripe along the bottom 0.12.
- Bleacher block 4.0 wide, 5 rows, 0.40 rise and 0.80 depth per row (2.0 high, 4.0 deep).
- Spectator: seated figure 1.05 high, 0.45 wide, capsule torso, sphere head, no face.
- Floodlight truss 6.0 long with four lamp housings, 0.35 deep.
- Umpire table 1.2 x 0.6 x 0.76 high, blue cloth to the floor on the front and sides.
- Flat colours, roughness 0.55 to 0.9, metalness 0 except steel (0.6). Surfaces are NOT applied at
  load time in this game (the toon pass replaces materials), so put every readable detail in
  geometry: chamfers, gaps between parts, grooves.
- Material names from the contract's list only: plaster | stone | timber | tile | metal | fabric | foliage | ground.
- Segment counts: cylinders 12 to 24, spheres 16 to 24, never more. Whole set under 300k triangles.
- No glyphs, letters, numbers or logos anywhere. A scoreboard is flaps and trim, a banner is stripes.
