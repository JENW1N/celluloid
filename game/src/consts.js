// Every number the game is tuned by, in one place. Metres, seconds, radians, kilograms.
export const TABLE = { L: 2.74, W: 1.525, H: 0.76, T: 0.03, halfL: 1.37, halfW: 0.7625 };
export const NET = { H: 0.1525, halfSpan: 0.915, postR: 0.012, k: 120, c: 0.9, maxDepth: 0.12 };   // the net is a spring: 120 N/m catches a 15 m/s ball in 7 cm
export const BALL = { R: 0.02, M: 0.0027, ALPHA: 2 / 3 };
BALL.I = BALL.ALPHA * BALL.M * BALL.R * BALL.R;          // hollow sphere
export const FLOOR_Y = 0.0;                      // the floor asset is placed so its surface is y = 0
export const G = 9.81;

// Aerodynamics of a 40 mm 2.7 g ball: kd = rho*Cd*A/(2m) with Cd 0.4, km = rho*A/(2m); the lift
// coefficient follows the spin parameter S = R*w/v as 1/(2.32 + 0.4/S), capped. Terminal
// velocity comes out at 9.4 m/s and a 95 rev/s loop at 15 m/s pulls 2.3 g, both in the
// measured range for the real ball.
export const AIR = { kd: 0.1117, km: 0.2793, clMax: 0.45, spinDecay: 0.15 };
// Table: the ITTF bounce spec (30.5 cm drop, 24-26 cm return) gives e = 0.90. The ball rolls
// when grip allows and slides under heavy spin, capped by Coulomb friction.
export const TABLE_PHYS = { e: 0.90, mu: 0.25, et: 0.0 };
export const FLOOR_PHYS = { e: 0.55, mu: 0.4 };
// Competitive inverted rubber over sponge: near-total grip, a little tangential elasticity, and
// the normal restitution a real blade-and-sponge gives a ball.
export const RUBBER = { e: 0.82, et: 0.25, mu: 0.9 };
export const PADDLE = { rx: 0.075, ry: 0.0785, r: 0.077, thick: 0.013, centerY: 0.1875 };

export const PLAYER = { z0: 1.62, xMax: 1.1, yMin: 0.42, yMax: 2.1, yNeutral: 0.92, reachMin: 0.55, reachMax: 2.0 };
export const SWING = { chargeTime: 0.55, back: 0.32, forwardT: 0.09, returnT: 0.26, vTap: 2.6, vFull: 10.5 };
export const TILT = { aimZ: -0.9, yRef: 0.95, closeRate: 1.25, openRate: 1.4, maxClose: 0.75, maxOpen: 0.8, ready: 0.12 };   // ready: the face sits slightly open at rest
export const SERVE = { handZ: 1.55, handY: 0.16, tossV: 2.2, xMax: 0.9, offsetMax: 0.35, power: 0.5, assist: { angle: 0.35, pace: 0.5, spin: 260 } };   // a 20 cm toss; a serve is never a smash

export const PALETTE = {
  tableBlue: 0x2456a8, lineWhite: 0xf2f2ee, ink: 0x141620, courtRed: 0xa8383a, courtRedDark: 0x6f2a2c,
  wood: 0xd7a56e, rubberRed: 0xc81e2e, steel: 0x8a8f99, navy: 0x1e2a48, cyan: 0x4fe3ff, orange: 0xff7a30,
  crowd: [0x2e3a5c, 0x5a2e3a, 0x3a4a3a, 0x50505e], skin: 0xd8c0a0,
};

// The three opponents. speed is paddle metres per second, react the delay before it moves,
// sigma the landing scatter in metres, whiff the chance it swings through nothing. All three
// reach an ordinary return; what separates them is pace, spin, placement, errors and smashing.
export const LEVELS = {
  rookie: { name: 'ROOKIE', speed: 5.0, react: 0.15, sigma: 0.26, sigmaTheta: 0.05, spd: [5.5, 8.0], spin: [0, 120], smash: false, letsOut: 0, whiff: 0.10, place: 'center', early: 0, serveSpd: [4.8, 6.0], serveSpin: 0, assist: 1.35, assistAngle: 0.28, assistSpin: 420, assistPace: 0.6, wrist: 0.65 },
  club: { name: 'CLUB', speed: 6.2, react: 0.13, sigma: 0.15, sigmaTheta: 0.028, spd: [8, 14], spin: [140, 380], smash: true, letsOut: 0.25, whiff: 0.05, place: 'corners', early: 0.15, serveSpd: [6, 8], serveSpin: 160, assist: 1.2, assistAngle: 0.16, assistSpin: 260, assistPace: 0.8, wrist: 0.45 },
  pro: { name: 'PRO', speed: 8.5, react: 0.07, sigma: 0.06, sigmaTheta: 0.012, spd: [12, 22], spin: [350, 700], smash: true, letsOut: 1, whiff: 0.012, place: 'away', early: 0.45, serveSpd: [7, 10], serveSpin: 420, assist: 1.05, assistAngle: 0.06, assistSpin: 0, assistPace: 0.95, wrist: 0.3 },
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
