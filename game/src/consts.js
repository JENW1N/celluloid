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

export const PLAYER = { z0: 1.62, xMax: 1.1, yMin: 0.42, yMax: 2.1, yNeutral: 0.92, reachMin: 0.55, reachMax: 2.0, brushGain: 1.8, flickMemory: 0.12, flickYGain: 1.7, serveBrush: 0.9 };   // serveBrush: the brush is scaled down at the toss, where the ball is nearly still   // flickYGain: the camera foreshortens vertical cursor motion   // brushGain: flick to brush; flickMemory: seconds a flick is held
export const SWING = { chargeTime: 0.55, back: 0.32, forwardT: 0.09, returnT: 0.26, vTap: 2.6, vFull: 10.5 };
export const TILT = { aimZ: -0.9, yRef: 0.95, closeRate: 1.25, openRate: 1.4, maxClose: 0.75, maxOpen: 0.8, ready: 0.12 };   // ready: the face sits slightly open at rest
export const SERVE = { handZ: 1.55, handY: 0.16, tossV: 2.2, xMax: 0.9, offsetMax: 0.35, power: 0.5, maxSpeed: 7.5, maxSpin: 420, maxEl: 0.15, assist: { angle: 0.35, pace: 0.5, spin: 260, yaw: 0.12 } };   // a serve is never a smash: the launch is capped before the two-bounce assist   // a 20 cm toss; a serve is never a smash

export const PALETTE = {
  tableBlue: 0x2456a8, lineWhite: 0xf2f2ee, ink: 0x141620, courtRed: 0xa8383a, courtRedDark: 0x6f2a2c,
  wood: 0xd7a56e, rubberRed: 0xc81e2e, steel: 0x8a8f99, navy: 0x1e2a48, cyan: 0x4fe3ff, orange: 0xff7a30,
  crowd: [0x2e3a5c, 0x5a2e3a, 0x3a4a3a, 0x50505e], skin: 0xd8c0a0,
  crowdVariety: [0xd94a4a, 0xf2b134, 0x4fb3e8, 0x67c27a, 0xe27d3f, 0x9b6bd6, 0xf2f2ee, 0x3b4a7a, 0xe86fa2, 0x2ec4b6, 0x8c5a3c, 0x1e2a48],
};

// The three opponents. speed is paddle metres per second, react the delay before it moves,
// sigma the landing scatter in metres, whiff the chance it swings through nothing. All three
// reach an ordinary return; what separates them is pace, spin, placement, errors and smashing.
/**
 * Leeway, the part of the game that meets a nearly-right stroke halfway. magnet: as the ball
 * closes on the blade the paddle drifts toward where the ball will cross (a fraction of the
 * miss, within magnetR, never more than magnetMax). swingHold: a release made early waits up to
 * this long so the swing peaks on the ball; autoSwing: a charge held too long fires by itself
 * as the ball arrives. approachSlow: the last approachT seconds before contact run slower.
 * assistYaw: the landing assist may turn a wide shot toward the table by this much. Every level
 * has it, PRO the least: the levels differ by the opponent, not by whether you can hit the ball.
 */
export const LEEWAY = { approachT: 0.35, magnetT: 0.4 };
// The ladder the levels are climbed in, and the rally length at which the hall turns to pencil.
export const LADDER = ['novice', 'rookie', 'club', 'pro'];
// The CPU stays back: its blade never comes within minNet of the net, and it smashes only from
// smashFrom or further, at its own end. A short ball that dies before its reach is your point.
export const BOT_REACH = { minNet: 1.0, smashFrom: 1.3, lungeZ: 0.3 };
export const INK_RALLY = 12;
export const LEVELS = {
  novice: { name: 'NOVICE', venue: 'gym', speed: 4.0, react: 0.2, sigma: 0.34, sigmaTheta: 0.06, spd: [4.3, 6.2], spin: [0, 50], smash: false, letsOut: 0, whiff: 0.2, place: 'center', early: 0, serveSpd: [4.0, 4.8], serveSpin: 0, serveToPaddle: true, serveReach: 0.12, serveDepth: [0.65, 0.95], assist: 1.9, assistAngle: 0.45, assistSpin: 420, assistPace: 0.3, assistBoost: 2.4, magnet: 0.85, magnetR: 0.32, magnetMax: 0.16, swingHold: 0.2, autoSwing: true, approachSlow: 0.25, assistYaw: 0.16, wrist: 0.75, slow: 0.8, aim: true },
  rookie: { name: 'ROOKIE', venue: 'hall', speed: 5.0, react: 0.15, sigma: 0.3, sigmaTheta: 0.05, spd: [5.0, 7.5], spin: [0, 120], smash: false, letsOut: 0, whiff: 0.14, place: 'center', early: 0, serveSpd: [4.6, 5.8], serveSpin: 0, serveToPaddle: true, serveReach: 0.25, serveDepth: [0.62, 1.0], assist: 1.75, assistAngle: 0.4, assistSpin: 420, assistPace: 0.4, assistBoost: 2.0, magnet: 0.75, magnetR: 0.28, magnetMax: 0.13, swingHold: 0.16, autoSwing: true, approachSlow: 0.2, assistYaw: 0.13, wrist: 0.65, slow: 0.86, aim: true },
  club: { name: 'CLUB', venue: 'club', speed: 6.2, react: 0.13, sigma: 0.15, sigmaTheta: 0.028, spd: [8, 14], spin: [140, 380], smash: true, letsOut: 0.25, whiff: 0.05, place: 'corners', early: 0.15, serveSpd: [6, 8], serveSpin: 120, serveToPaddle: false, serveReach: 0.45, serveDepth: [0.62, 1.15], assist: 1.45, assistAngle: 0.4, assistSpin: 420, assistPace: 0.4, assistBoost: 2.0, magnet: 0.75, magnetR: 0.28, magnetMax: 0.13, swingHold: 0.16, autoSwing: true, approachSlow: 0.2, assistYaw: 0.13, wrist: 0.45, slow: 0.94, aim: true },
  pro: { name: 'PRO', venue: 'arena', speed: 8.5, react: 0.07, sigma: 0.06, sigmaTheta: 0.012, spd: [12, 22], spin: [350, 700], smash: true, letsOut: 1, whiff: 0.012, place: 'away', early: 0.45, serveSpd: [7, 10], serveSpin: 280, serveToPaddle: false, serveReach: 0.55, serveDepth: [0.62, 1.2], assist: 1.2, assistAngle: 0.32, assistSpin: 300, assistPace: 0.5, assistBoost: 1.6, magnet: 0.6, magnetR: 0.24, magnetMax: 0.1, swingHold: 0.12, autoSwing: true, approachSlow: 0.15, assistYaw: 0.1, wrist: 0.3, slow: 1.0, aim: true},
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - (1 - t) * (1 - t);
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
