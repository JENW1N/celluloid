# PONG PING

Cel-shaded table tennis for the [404 game jam 001](https://github.com/404-Repo/404-game-jam), built
with the [404 game recipe](https://github.com/404-Repo/404-game-recipe): every 3D object in it is a
Three.js module that builds its geometry from constructors. There are no meshes, no textures and no
sound files anywhere in `game/`. The sound is synthesised from the physics at the moment of contact.

**Play:** `game/index.html` served from any static host (the live link is in `entry.json`).

## How it plays

The paddle is your hand. On a laptop the mouse is the paddle on the plane behind your end line;
hold the left button to draw back a swing along the depth axis, release to swing through. On a
phone one finger drags the paddle like a trackpad and a second finger anywhere charges while held
and swings when lifted. A flick at the moment of contact is a brush, and a brush is spin: up for
topspin, down for backspin, sideways for sidespin.

The wrist is set for you the way a coach sets a beginner's: the face turns to aim at the far side as
you move wide, closes as you rise above the net so a high ball is slammed, and opens as you drop under
the table so a low ball is lifted. What it does not do is hit the ball for you. Serve with `W` (or
the TOSS button), place the toss with the arrow keys, and hit it yourself.

Four opponents, an order of magnitude apart. NOVICE feeds the ball back to the middle and misses
plenty. ROOKIE blocks and pushes. CLUB loops the corners. PRO takes the ball on the rise and puts
it where you are not. First to 11, two clear, the CPU serves first.

## The physics, because the pitch was "as if the rubber and the ball were real"

`game/src/physics.js`, all in SI units, sub-stepped at 1/600 s with swept tests so a 30 m/s ball
cannot pass through a face.

- The ball is 40 mm, 2.7 g, a hollow sphere (I = 2/3 m r²). Quadratic drag with Cd 0.4 gives a
  terminal velocity of 9.4 m/s; Magnus lift follows the spin parameter S = rω/v with
  C_L = 1/(2.32 + 0.4/S), capped, so a 95 rev/s loop at 15 m/s pulls 2.3 g downward.
- Table bounce uses the ITTF spec (a 30.5 cm drop returns 24–26 cm, e = 0.90). The contact point
  is asked to roll; the impulse that would do it is capped by Coulomb friction, so heavy topspin
  kicks forward and heavy backspin checks and slides.
- The rubber is inverted competition rubber over sponge: normal restitution 0.82, near-total grip
  (μ 0.9) with a little tangential elasticity. A thin brush that exceeds the grip slips, and you
  hear it. Every impulse uses the rigid-sphere result that a tangential impulse changes the contact
  point's velocity by J/m · (1 + 1/α).
- The net is a damped wave field over the plane the net asset publishes: a ball that clips the
  tape ripples the cord and dribbles over, one that hits the body bellies the net and drops back.
  A ball that clears by under 4.5 cm makes a zip.
- The bots plan with the same integrator (`predict()`), solving the launch elevation by bisection
  against drag and Magnus, then add their own error. Nothing about the ball is faked in flight.

The one concession to being a game is leeway, and every level has it, PRO the least. A stroke
that is nearly right is met halfway: as the ball closes, the paddle drifts a little toward where
the ball will cross the plane the swing will meet it on; a button released early waits so the
swing peaks on the ball, and a charge still held as the ball arrives fires itself; the last third
of a second before contact runs a little slower; and a return that would miss by a little is
bent into a legal one (a few degrees of elevation, a turn toward the table, a pace cut, the
topspin a real stroke would have brushed on). The opponent's serve gets the same two-bounce
assist, seen in the mirror, so a bot never faults. Spin does not need a frame-perfect flick: the
paddle keeps the best flick of the last tenth of a second and brushes with it at contact, so a
small upward, downward or sideways flick as the ball arrives is topspin, backspin or sidespin
you can watch curve. Serving cannot be mistimed: hold to toss, and from the release the blade is
locked onto the ball and waits for the top of the toss, and a charge held too long fires itself as
the ball drops. Move the cursor while the ball is up and an arrow on the ball shows the spin you are
asking for, up for topspin, down for backspin, sideways for sidespin, in the trail's colours. The
CPU's serves land deep and must carry back to your end, so none dies short of your reach. Every number is in `LEVELS` in `game/src/consts.js`, and `tools/leeway.mjs`
proves each piece in headless Chrome: a paddle parked 28 cm off the ball still blocks it, an
early release still hits at the peak, a brush leaves the ball spinning at 100 to 200 rad/s, and
thirteen CPU serves in a row are legal.

A point is not a word on the screen: confetti in the arena's colours falls on the half that won
it and settles on the table and the floor beside it.

## Four halls, a song, a pencil

Each opponent plays in a hall of its own, and every hall is the same kit re-dressed: NOVICE in a
school gym in daylight, with goals on the end walls, tall windows and blue wall pads; ROOKIE in a
community hall under strip lights, bunting overhead and neighbours on folding chairs; CLUB on a
wooden floor under low green lamps with two more tables beside yours; PRO in the arena. Picking a
level on the menu shows its hall behind the menu.

The rally is the music. Every contact that counts plays a note as well as its knock: yours ping,
the CPU's pong a little lower, and the pair climbs a pentatonic scale one step per exchange. The
beat is the rally's own tempo: a kick on each hit from the fourth, an off-beat hat from the sixth,
a bass root under each pong from the eighth, a pad from the twelfth. The point ends the song with
a crash and an arpeggio before the applause.

Past a dozen shots the hall drains to pencil on paper, hatched in the shade, and only the table,
the net, the ball and the two blades keep their colour. The point snaps the colour back with the
confetti. At match point the light closes onto the table, the crowd falls silent under a
heartbeat, and the camera drops low for the last point.

A game ends in a match report: the winner's name, the score riffling up on two flip cards, a
rubber stamp on the beaten opponent's card, the numbers that happened as paper tags, and the next
rung of the ladder unlocked. Beaten levels keep their stamp on the menu. Locked levels show a
padlock but stay playable, so nobody is kept from the arena.

## How it was made

- `STYLE.md` is the style lock handed to everything that generated geometry.
- `game/assets/` holds the fifteen asset modules, each with a `.expect.json` giving its real size.
  Five (table, net, paddle, ball, floor) were written by hand against the rules; ten were written
  by two agents working in parallel from the style lock, each producing two candidates for its
  hero object and keeping the better after looking at the verifier's sheet. The rejected candidates
  and the one-line reasons are under `docs/rejected/`.
- Every asset passed `harness/verify.mjs` (four sides, measured size). The sheets are in `docs/`.
- Cel shading is applied at load time (`game/src/toon.js`): a three-step toon material and an
  inverted-hull outline with position-merged normals, so the assets stay on the recipe's contract.
- Sound is `game/src/audio.js`, synthesised: no files. ElevenLabs was considered and not needed.
- `tools/gate.mjs` is the game's own gate: a phone viewport, two real fingers, a real toss tap;
  it asserts contacts, a landed return and decided points, and writes a filmstrip.
- `_jam/` and `_gate/` runs are recorded under `docs/`.

## Credits and rights

- Written for this entry by Claude Fable 5.1 and Claude Opus 5.5 in Claude Code, directed by
  JENW1N. Every 3D object is an asset module in `game/assets/` built from Three.js constructors;
  every texture is drawn into a canvas at load; every sound is synthesised with WebAudio as it
  happens. The game folder holds no image, sound, model or music file.
- Three.js 0.169 (MIT licence), loaded from jsDelivr.
- Barlow Condensed by Jeremy Tribby (SIL Open Font License 1.1), loaded from Google Fonts.
- `assetlib.js`, `surfaces.js` and `rig.js` are the 404 recipe's harness files, copied unchanged as
  the recipe asks. Nothing from any 404 reference game is used.
- How each of the jam's rules is met, with the evidence for it: [docs/RULES.md](docs/RULES.md).

## Running the gates locally

```
git clone https://github.com/404-Repo/404-game-recipe && cd 404-game-recipe && npm install
node harness/serve.mjs ../celluloid/game 9000          # then open the URL it prints
node harness/verify.mjs ../celluloid/game/assets
node harness/ship.mjs ../celluloid/game
node harness/jam.mjs http://localhost:9000/__game__/game/
cd ../celluloid && node tools/gate.mjs http://localhost:9000/__game__/game/
```

## Tools

Built with Claude Code (Claude Fable 5.1) for code, assets, critique and this text; no image or
sound generator was used.
