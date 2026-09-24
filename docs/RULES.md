# The jam's rules, checked

Each rule from the 404 game jam README, and where the evidence for it lives in this repo.

| Rule | How this entry meets it | Evidence |
|---|---|---|
| Every 3D object is Three.js code written through the recipe | Every object in the hall is an asset module in `game/assets/` that builds its geometry from Three.js constructors and passes the recipe's `harness/verify.mjs`. Effects (the trail, the confetti, the rings) are built in code at runtime. | `docs/verify/arena-assets-v4.png`, the verify sheet of every module |
| No mesh smuggled in as data | `harness/ship.mjs` finds no array of more than 64 numeric literals and no base64 in any module. There is no model, image, sound or music file in the game folder. | `docs/gate/ship-2026-09-24.txt` |
| Textures, sound and music declared | None are files. The canvas textures (the net's mesh, the rubber, the flip cards' digits) are drawn in code at load, and every sound is synthesised with WebAudio at runtime. `own_art` is false and the list is empty. | `game/src/arena.js`, `game/src/flipboard.js`, `game/src/audio.js` |
| Team of one to four, one entry per person | One person, JENW1N. | `entry.json` |
| Source public, first commit on or after 11 Sep 2026 | The repo is public. The first commit is dated 20 Sep 2026. | the commit history |
| The work is in the commits | Development is spread over dozens of commits, each with its own gate receipts. | the commit history, `docs/gate/` |
| No copying a 404 reference game | Nothing from Drive, Rust 17, Costa Verde, the warehouse example or Lantern Run is used. `assetlib.js`, `surfaces.js` and `rig.js` are the recipe's harness files, copied unchanged as the recipe's GAME.md tells every entrant to do. | byte-identical to `404-game-recipe/harness/` |
| Tools named | Claude Code as the agent; Claude Fable 5.1 and Claude Opus 5.5 as the models. No image or sound generator. | `entry.json` |
| Rights to everything in the entry | The only third-party pieces are Three.js (MIT) and the Barlow Condensed font (SIL Open Font License 1.1), both loaded from CDNs the gate allows. | `README.md`, Credits and rights |
| The gate, against the live URL, on a phone profile | PASS: ready 3.7 s, 1.7 MB, 154 draws, 290k triangles, 0 errors, 0 404s. | `docs/gate/jam-live-8cd5bfa-2026-09-23.txt` |
