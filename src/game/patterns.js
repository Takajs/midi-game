import { gameBounds, PATTERNS, TRAJ } from '../utils/constants.js';
import { angleToward, seededRandom } from '../utils/math.js';

/**
 * Pattern spawner — ALL boss bullets fire from the eye, aimed at the player.
 *
 * The boss eye tracks the player. Every pattern's base direction is
 * eye→player. Patterns add spread, rotation, and offset relative
 * to that aim direction. This means the boss can hit anywhere —
 * no safe zones above, below, or beside it.
 *
 * Boss bullets: fromBoss=1, radius scaled by velocity (some larger).
 * Ambient bullets (RAIN, side-spawns): fromBoss=0, smaller.
 */
export class PatternSpawner {
  constructor(bulletSystem) {
    this.b = bulletSystem;
    this.boss = null;
    this.spiralAngle = 0;
    this._edgeSide = 0;
  }

  getPattern(note) {
    const { midi, velocity: v, octave: o, pitch: p, track: t } = note;
    const seed = (midi * 7 + t * 13 + p * 3) & 0x7fff;
    const dur = note.duration || 0;

    if (v > 0.88) {
      if (o >= 6) return PATTERNS.FLOWER;
      if (o <= 2) return PATTERNS.VORTEX;
      if (p % 4 === 0) return PATTERNS.RING;
      return PATTERNS.SPIRAL;
    }
    if (v > 0.68) {
      if (o >= 6) return PATTERNS.AIMED;
      if (o <= 2) return PATTERNS.CASCADE;
      if (seed % 7 === 0) return PATTERNS.HELIX;
      if (seed % 5 === 0) return PATTERNS.CROSSFIRE;
      if (p % 3 === 0) return PATTERNS.SPREAD;
      return PATTERNS.ARC;
    }
    if (v > 0.4) {
      if (o >= 6) return PATTERNS.SINGLE;
      if (o <= 2) return PATTERNS.WAVE;
      if (dur > 0.8) return PATTERNS.STREAM;
      if (seed % 6 === 0) return PATTERNS.HELIX;
      if (seed % 4 === 0) return PATTERNS.CROSSFIRE;
      return PATTERNS.SPREAD;
    }
    if (o >= 5) return PATTERNS.SINGLE;
    if (seed % 5 === 0) return PATTERNS.CASCADE;
    if (p % 4 === 0) return PATTERNS.WAVE;
    return PATTERNS.RAIN;
  }

  spawnForNote(note, playerX, playerY) {
    const pat = this.getPattern(note);
    const { midi, velocity: vel, octave: oct, duration } = note;
    const w = gameBounds.width, h = gameBounds.height;
    const spd = 1.2 + vel * 1.5 + oct * 0.12;
    const baseRad = Math.max(2.5, 6.5 - oct * 0.4 + vel * 2);
    // Velocity-based size variation: loud notes = bigger bullets
    const bossRad = baseRad * (1.1 + vel * 0.5);  // 1.1× to 1.6× depending on velocity
    const ambRad = baseRad * 0.6;
    const rng = seededRandom(midi * 31 + Math.floor(performance.now()));
    const mn = midi, nv = vel, oc = oct, dur = duration || 0.2;

    // ── All boss bullets fire from the eye ──
    let ex, ey, aimAngle;
    if (this.boss) {
      const ep = this.boss.getEmitPoint();
      ex = ep.x;
      ey = ep.y;
      aimAngle = ep.angle; // directly toward player
      this.boss.flashEmit(midi, vel);
    } else {
      ex = w * 0.5;
      ey = -10;
      aimAngle = Math.PI / 2;
    }

    // Base aim velocity (eye → player)
    const aimVx = Math.cos(aimAngle) * spd;
    const aimVy = Math.sin(aimAngle) * spd;
    // Perpendicular direction (for spread offsets)
    const perpAngle = aimAngle + Math.PI / 2;

    switch (pat) {
      case PATTERNS.SINGLE:
        this.b.spawn(ex, ey, aimVx, aimVy, bossRad, mn, 0, 0, 0, 0, 0, nv, oc, dur, 1);
        break;

      case PATTERNS.SPREAD: {
        const cnt = 3 + Math.floor(vel * 4);
        const arc = 0.35 + vel * 0.2;
        const start = aimAngle - arc / 2;
        for (let i = 0; i < cnt; i++) {
          const a = start + (arc * i) / (cnt - 1 || 1);
          this.b.spawn(ex, ey, Math.cos(a) * spd, Math.sin(a) * spd,
            bossRad * 0.85, mn, 0, 0, 0, 0, 0, nv, oc, dur, 1);
        }
        break;
      }

      case PATTERNS.RING: {
        const cnt = 8 + Math.floor(vel * 12);
        for (let i = 0; i < cnt; i++) {
          const a = (Math.PI * 2 * i) / cnt + rng() * 0.15;
          this.b.spawn(ex, ey, Math.cos(a) * spd * 0.8, Math.sin(a) * spd * 0.8,
            bossRad * 0.55, mn, 0, 0, 0, 0, 0, nv, oc, dur, 1);
        }
        break;
      }

      case PATTERNS.AIMED: {
        // Tight cluster directly at player + homing follower
        const a = aimAngle;
        this.b.spawn(ex, ey, Math.cos(a) * spd * 1.15, Math.sin(a) * spd * 1.15,
          bossRad * 1.15, mn, 0, 0, 0, 0, 0, nv, oc, dur, 1);
        for (const off of [0.1, -0.1, 0.22, -0.22]) {
          this.b.spawn(ex, ey, Math.cos(a + off) * spd, Math.sin(a + off) * spd,
            bossRad * 0.75, mn, 0, 0, 0, 0, 0, nv, oc, dur, 1);
        }
        this.b.spawn(ex, ey, Math.cos(a) * spd * 0.45, Math.sin(a) * spd * 0.45,
          bossRad * 0.55, mn, TRAJ.HOMING, 0, 0, 0, 0, nv, oc, dur, 1);
        break;
      }

      case PATTERNS.STREAM: {
        const wm = 1.5 + rng() * 2;
        const px = Math.cos(perpAngle) * 8;
        const py = Math.sin(perpAngle) * 8;
        this.b.spawn(ex + px, ey + py, aimVx * 0.85, aimVy * 0.85,
          bossRad * 0.7, mn, TRAJ.WAVY, 0, 0, 0, wm, nv, oc, dur, 1);
        this.b.spawn(ex - px, ey - py, aimVx * 0.8, aimVy * 0.8,
          bossRad * 0.7, mn, TRAJ.WAVY, 0, 0, 0, -wm, nv, oc, dur, 1);
        break;
      }

      case PATTERNS.SPIRAL: {
        const cnt = 3 + Math.floor(vel * 4);
        for (let i = 0; i < cnt; i++) {
          const a = this.spiralAngle + (Math.PI * 2 * i) / cnt;
          const vx = Math.cos(a) * spd * 0.5;
          const vy = Math.sin(a) * spd * 0.5;
          // Bias toward player
          const bvx = vx * 0.5 + aimVx * 0.5;
          const bvy = vy * 0.5 + aimVy * 0.5;
          this.b.spawn(ex, ey, bvx, bvy, bossRad * 0.6,
            mn, 0, 0.012, 0, 0, 0, nv, oc, dur, 1);
        }
        this.spiralAngle += 0.45 + vel * 0.35;
        break;
      }

      case PATTERNS.WAVE: {
        const wm = 2 + (midi % 12 / 12) * 2.5;
        const px = Math.cos(perpAngle);
        const py = Math.sin(perpAngle);
        for (let i = 0; i < 3; i++) {
          const offset = (i - 1) * 22;
          this.b.spawn(ex + px * offset, ey + py * offset,
            aimVx * 0.75, aimVy * 0.75, bossRad * 0.55,
            mn, TRAJ.WAVY, 0, 0, 0, wm * (i % 2 === 0 ? 1 : -1), nv, oc, dur, 1);
        }
        break;
      }

      case PATTERNS.RAIN:
        // Ambient: small unfocused drops from random top positions
        for (let i = 0; i < 2; i++) {
          const rx = rng() * w;
          this.b.spawn(rx, -10, (rng() - 0.5) * 0.4, spd * 0.65, ambRad,
            mn, 0, 0, 0, 0, 0, nv, oc, dur, 0);
        }
        break;

      case PATTERNS.CROSSFIRE: {
        // Edge bullets: ambient (small)
        const side = this._edgeSide++ % 2;
        const fromX = side === 0 ? -10 : w + 10;
        const dir = side === 0 ? 1 : -1;
        const cnt = 2 + Math.floor(vel * 3);
        for (let i = 0; i < cnt; i++) {
          const yOff = (i / cnt) * h * 0.35 + rng() * 25;
          this.b.spawn(fromX, yOff,
            dir * spd * (0.6 + rng() * 0.3), spd * (0.25 + rng() * 0.2),
            ambRad, mn, TRAJ.SINE_ARC, 0, 0, 0, dir * (1 + vel), nv, oc, dur, 0);
        }
        // Boss eye bullet aimed at player
        this.b.spawn(ex, ey, aimVx, aimVy, bossRad * 0.7, mn, 0, 0, 0, 0, 0, nv, oc, dur, 1);
        break;
      }

      case PATTERNS.ARC: {
        // Edge bullets: ambient (small)
        const side = this._edgeSide++ % 2;
        const fromX = side === 0 ? -10 : w + 10;
        const dir = side === 0 ? 1 : -1;
        const cnt = 2 + Math.floor(vel * 2);
        for (let i = 0; i < cnt; i++) {
          const ys = h * 0.08 + rng() * h * 0.25;
          this.b.spawn(fromX, ys,
            dir * spd * 0.85, spd * (0.35 + rng() * 0.25),
            ambRad, mn, TRAJ.SINE_ARC, 0, 0, 0, -dir * (1.3 + vel * 0.7), nv, oc, dur, 0);
        }
        // Boss decel aimed at player
        this.b.spawn(ex, ey, aimVx * 1.2, aimVy * 1.2, bossRad * 0.85,
          mn, TRAJ.DECEL, 0, 0, 0, spd, nv, oc, dur, 1);
        break;
      }

      case PATTERNS.HELIX: {
        const cnt = 4 + Math.floor(vel * 3);
        const px = Math.cos(perpAngle);
        const py = Math.sin(perpAngle);
        for (let i = 0; i < cnt; i++) {
          const phase = i * 0.5;
          const offset = Math.sin(phase) * 25;
          this.b.spawn(ex + px * offset, ey + py * offset,
            aimVx * 0.75, aimVy * 0.75, bossRad * 0.5,
            mn, TRAJ.WAVY, 0, 0, 0, 2.5 + vel, nv, oc, dur, 1);
          this.b.spawn(ex - px * offset, ey - py * offset,
            aimVx * 0.75, aimVy * 0.75, bossRad * 0.5,
            mn, TRAJ.WAVY, 0, 0, 0, -(2.5 + vel), nv, oc, dur, 1);
        }
        break;
      }

      case PATTERNS.FLOWER: {
        const petals = 5 + Math.floor(vel * 3);
        const bpp = 2;
        // Flower biased toward player direction
        const baseOff = aimAngle;
        for (let p = 0; p < petals; p++) {
          const base = baseOff + (Math.PI * 2 * p) / petals;
          for (let b = 0; b < bpp; b++) {
            const a = base + (b - 0.5) * 0.15;
            const sp = spd * (0.6 + b * 0.3);
            this.b.spawn(ex, ey, Math.cos(a) * sp, Math.sin(a) * sp,
              bossRad * (0.5 + b * 0.15), mn, 0, 0.005 * (b % 2 === 0 ? 1 : -1), 0, 0, 0, nv, oc, dur, 1);
          }
        }
        break;
      }

      case PATTERNS.CASCADE: {
        const cnt = 3 + Math.floor(vel * 3);
        const px = Math.cos(perpAngle);
        const py = Math.sin(perpAngle);
        for (let i = 0; i < cnt; i++) {
          const xOff = (rng() - 0.5) * 80;
          this.b.spawn(ex + px * xOff, ey + py * xOff,
            aimVx * (0.5 + rng() * 0.4), aimVy * (0.5 + rng() * 0.4),
            bossRad * 0.6, mn, TRAJ.DECEL, 0, 0, 0, spd * 0.7, nv, oc, dur, 1);
        }
        break;
      }

      case PATTERNS.VORTEX: {
        const cnt = 6 + Math.floor(vel * 4);
        // Vortex converges toward player area
        const cx = playerX + (rng() - 0.5) * 60;
        const cy = playerY - 50 + (rng() - 0.5) * 40;
        for (let i = 0; i < cnt; i++) {
          const a = (Math.PI * 2 * i) / cnt + this.spiralAngle;
          const dist = 100 + rng() * 80;
          const ox = cx + Math.cos(a) * dist;
          const oy = ey;
          const toA = Math.atan2(cy - oy, cx - ox);
          this.b.spawn(ox, oy,
            Math.cos(toA) * spd * 0.7, Math.sin(toA) * spd * 0.7,
            bossRad * 0.55, mn, TRAJ.DECEL, 0.008, 0, 0, spd, nv, oc, dur, 1);
        }
        this.spiralAngle += 0.3;
        break;
      }
    }
  }
}
