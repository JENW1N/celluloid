/**
 * Table tennis scoring the way the handbook has it, as a state machine fed by physics events.
 * Games to 11, two clear; the serve changes every two points and every point from 10-10. A
 * serve must bounce on the server's side then the receiver's; a return must bounce on the
 * opponent's side; a serve that clips the net and lands is a let; a ball that passes the far
 * end line without touching the table is out the moment it does.
 */
import { TABLE } from './consts.js?v=202609211609';

export class Match {
  constructor() { this.reset(); }
  reset() {
    this.score = [0, 0];
    this.server = 1; this.firstServer = 1;
    this.state = 'IDLE';
    this.rally = 0; this.hits = 0; this.longestRally = 0; this.totalPoints = 0;
    this.lastHitter = -1; this.bounces = [0, 0];
    this.serving = false; this.serveBounced = false; this.letPending = false; this.unreturned = false;
    this.pointTimer = 0; this.lastPoint = null; this.winner = -1;
    this.lastContactT = [-1, -1];
    this.stats = { winners: [0, 0], errors: [0, 0], aces: [0, 0] };
  }
  startGame(firstServer = 1) {
    this.reset();
    this.firstServer = firstServer; this.server = firstServer;
    this.state = 'SERVE_WAIT';
  }
  get over() { return this.state === 'GAME_OVER'; }
  get inPlay() { return this.state === 'IN_PLAY'; }
  /** Index of the player at game point, or -1. */
  gamePoint() {
    const [a, b] = this.score;
    if (a >= 10 && a - b >= 1) return 0;
    if (b >= 10 && b - a >= 1) return 1;
    return -1;
  }
  toss() { if (this.state === 'SERVE_WAIT') this.state = 'TOSS'; }
  tossFailed() { if (this.state === 'TOSS') this.state = 'SERVE_WAIT'; }

  /** Feed a physics event. Returns an outcome object or null. */
  onEvent(e, now = 0) {
    if (this.state === 'TOSS') {
      if (e.type === 'paddle' && e.owner === this.server) {
        this.state = 'IN_PLAY'; this.serving = true; this.serveBounced = false; this.letPending = false; this.unreturned = true;
        this.lastHitter = e.owner; this.bounces = [0, 0]; this.lastContactT[e.owner] = now;
        return { serve: e.owner };
      }
      if (e.type === 'table' || e.type === 'floor') { this.state = 'SERVE_WAIT'; return { tossFailed: true }; }
      return null;
    }
    if (this.state !== 'IN_PLAY') return null;
    const me = this.lastHitter, other = 1 - me;
    switch (e.type) {
      case 'paddle': {
        if (e.owner === me) {
          if (now - this.lastContactT[me] < 0.25) return null;      // the same contact, twice
          return this.award(other, 'DOUBLE HIT');
        }
        if (this.bounces[e.owner] === 1) {
          this.lastHitter = e.owner; this.bounces = [0, 0]; this.serving = false; this.letPending = false; this.unreturned = false;
          this.rally++; this.hits++; this.longestRally = Math.max(this.longestRally, this.rally);
          this.lastContactT[e.owner] = now;
          return { legal: e.owner, rally: this.rally };
        }
        // hit before it bounced on their side
        if (Math.abs(e.point.z) < TABLE.halfL + 0.02) return this.award(me, 'VOLLEY');
        return this.award(e.owner, 'LONG');
      }
      case 'table': {
        const side = e.side;
        if (this.serving && !this.serveBounced) {
          if (side === me) { this.serveBounced = true; return null; }
          return this.award(other, 'SERVE FAULT');
        }
        if (this.serving && this.serveBounced && side === me) return this.award(other, 'SERVE FAULT');
        if (side === me) return this.award(other, 'OWN SIDE');
        this.bounces[side]++;
        if (this.serving) {
          this.serving = false;
          if (this.letPending) { this.letPending = false; return this.let(); }
          return { serveLanded: true };
        }
        if (this.bounces[side] >= 2) return this.award(me, 'DOUBLE BOUNCE');
        return { landed: side };
      }
      case 'netin': return this.award(other, 'NET');
      case 'netclip': if (this.serving) this.letPending = true; return null;
      case 'floor': case 'gone': {
        if (this.bounces[other] === 1) return this.award(me, this.unreturned ? 'ACE' : 'WINNER');
        if (this.serving && !this.serveBounced) return this.award(other, 'SERVE FAULT');
        return this.award(other, 'OUT');
      }
      case 'ceiling': return this.award(other, 'OUT');
      default: return null;
    }
  }
  /** A ball that passed the receiver's end line without bouncing is already out. */
  checkOut(ball) {
    if (this.state !== 'IN_PLAY') return null;
    const other = 1 - this.lastHitter;
    const zEnd = TABLE.halfL + 0.65;
    const passed = other === 0 ? ball.p.z > zEnd : ball.p.z < -zEnd;
    if (!passed || this.bounces[other] !== 0) return null;
    if (this.serving && !this.serveBounced) return this.award(other, 'SERVE FAULT');
    return this.award(other, 'LONG');
  }
  let() {
    this.state = 'POINT_OVER'; this.pointTimer = 1.1; this.lastPoint = { let: true };
    return { let: true };
  }
  award(winner, reason) {
    const wasGamePoint = this.gamePoint();
    this.score[winner]++; this.totalPoints++;
    const loser = 1 - winner;
    if (reason === 'WINNER' || reason === 'DOUBLE BOUNCE' || reason === 'ACE') this.stats.winners[winner]++;
    else this.stats.errors[loser]++;
    if (reason === 'ACE') this.stats.aces[winner]++;
    this.lastPoint = { winner, reason, rally: this.rally, gamePoint: wasGamePoint };
    this.rally = 0;
    const [a, b] = this.score;
    if ((a >= 11 || b >= 11) && Math.abs(a - b) >= 2) {
      this.state = 'GAME_OVER'; this.winner = winner; this.pointTimer = 0;
      return { point: winner, reason, gameOver: true };
    }
    this.server = this.totalPoints >= 20
      ? (this.firstServer + this.totalPoints) % 2
      : (this.firstServer + Math.floor(this.totalPoints / 2)) % 2;
    this.state = 'POINT_OVER';
    this.pointTimer = 1.7;
    return { point: winner, reason };
  }
  /** Advance timers. Returns 'serve' on the frame a new serve begins. */
  update(dt) {
    if (this.state !== 'POINT_OVER') return null;
    this.pointTimer -= dt;
    if (this.pointTimer > 0) return null;
    this.state = 'SERVE_WAIT';
    this.serving = false; this.letPending = false; this.bounces = [0, 0]; this.lastHitter = -1;
    return 'serve';
  }
}
