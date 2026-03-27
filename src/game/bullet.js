import { Graphics, Container } from 'pixi.js';
import { gameBounds, BULLET_POOL_SIZE, TRACK_STYLES } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';

/**
 * Bullet data — struct-of-arrays for cache performance.
 *
 * Each bullet carries full musical identity:
 * - midiNote (0-127) → unique color via noteColor()
 * - noteVel (0-1) → glow intensity
 * - octave (0-9) → visual weight (size of glow, trail)
 * - duration (seconds) → trail length
 * - trackStyle (0-3) → rendering style
 */
class BulletData {
  constructor(size) {
    this.x = new Float32Array(size);
    this.y = new Float32Array(size);
    this.vx = new Float32Array(size);
    this.vy = new Float32Array(size);
    this.radius = new Float32Array(size);
    this.color = new Uint32Array(size);
    this.alive = new Uint8Array(size);
    this.age = new Float32Array(size);
    this.angularVel = new Float32Array(size);
    this.accelX = new Float32Array(size);
    this.accelY = new Float32Array(size);
    this.type = new Uint8Array(size);
    this.param = new Float32Array(size);
    this.noteVel = new Float32Array(size);
    this.octave = new Uint8Array(size);
    this.duration = new Float32Array(size);
    this.trackStyle = new Uint8Array(size);
    this.size = size;
  }
}

export class BulletSystem {
  constructor() {
    this.data = new BulletData(BULLET_POOL_SIZE);
    this.activeCount = 0;
    this.container = new Container();
    this.container.zIndex = 50;

    this.graphics = [];
    this.graphicsPool = [];
    for (let i = 0; i < 120; i++) {
      const g = new Graphics();
      g.visible = false;
      this.container.addChild(g);
      this.graphicsPool.push(g);
    }
  }

  _getGraphics() {
    if (this.graphicsPool.length > 0) return this.graphicsPool.pop();
    const g = new Graphics();
    this.container.addChild(g);
    return g;
  }

  _releaseGraphics(g) {
    g.visible = false;
    g.clear();
    this.graphicsPool.push(g);
  }

  /**
   * Spawn a bullet with full musical identity.
   * midiNote is the raw MIDI note number (0-127) — used for unique color.
   */
  spawn(x, y, vx, vy, radius, midiNote, type = 0, angularVel = 0, accelX = 0, accelY = 0, param = 0, noteVel = 0.5, octave = 4, duration = 0.2, track = 0) {
    const d = this.data;
    let idx = -1;
    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) { idx = i; break; }
    }
    if (idx === -1) return -1;

    d.x[idx] = x;
    d.y[idx] = y;
    d.vx[idx] = vx;
    d.vy[idx] = vy;
    d.radius[idx] = radius;
    d.color[idx] = noteColor(midiNote);
    d.alive[idx] = 1;
    d.age[idx] = 0;
    d.angularVel[idx] = angularVel;
    d.accelX[idx] = accelX;
    d.accelY[idx] = accelY;
    d.type[idx] = type;
    d.param[idx] = param;
    d.noteVel[idx] = noteVel;
    d.octave[idx] = octave;
    d.duration[idx] = duration;
    d.trackStyle[idx] = track % TRACK_STYLES;
    this.activeCount++;
    return idx;
  }

  update(dt, playerX, playerY) {
    const d = this.data;
    const margin = 50;
    let active = 0;

    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;
      d.age[i] += dt;

      switch (d.type[i]) {
        case 1:
          d.vx[i] = d.param[i] * Math.sin(d.age[i] * 0.08);
          break;
        case 2:
          d.vx[i] += d.accelX[i] * dt;
          d.vy[i] += d.accelY[i] * dt;
          break;
        case 3:
          if (d.age[i] < 30) {
            const ax = playerX - d.x[i];
            const ay = playerY - d.y[i];
            const dist = Math.sqrt(ax * ax + ay * ay) || 1;
            d.vx[i] += (ax / dist) * 0.05 * dt;
            d.vy[i] += (ay / dist) * 0.05 * dt;
          }
          break;
      }

      if (d.angularVel[i] !== 0) {
        const cos = Math.cos(d.angularVel[i] * dt);
        const sin = Math.sin(d.angularVel[i] * dt);
        const nvx = d.vx[i] * cos - d.vy[i] * sin;
        const nvy = d.vx[i] * sin + d.vy[i] * cos;
        d.vx[i] = nvx;
        d.vy[i] = nvy;
      }

      d.x[i] += d.vx[i] * dt;
      d.y[i] += d.vy[i] * dt;

      if (d.x[i] < -margin || d.x[i] > gameBounds.width + margin ||
          d.y[i] < -margin || d.y[i] > gameBounds.height + margin) {
        d.alive[i] = 0;
        continue;
      }
      active++;
    }
    this.activeCount = active;
  }

  /**
   * Render each bullet according to its full musical identity.
   *
   * Track style controls shape:
   *   0: Filled orb with soft glow (melodic, warm)
   *   1: Hollow ring (airy, transparent — great for high strings)
   *   2: Rimmed orb (solid with bright outline — punchy, brass-like)
   *   3: Compact dense bullet (small, bright core — percussive)
   *
   * Octave controls visual weight: low = wide glow + long trail, high = tight.
   * Velocity controls brightness/saturation.
   * Duration controls trail length: sustained = long ethereal tail, staccato = compact.
   */
  render() {
    const d = this.data;

    for (const g of this.graphics) {
      this._releaseGraphics(g);
    }
    this.graphics.length = 0;

    // Group by color for batching
    const colorBuckets = new Map();
    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;
      const color = d.color[i];
      if (!colorBuckets.has(color)) colorBuckets.set(color, []);
      colorBuckets.get(color).push(i);
    }

    for (const [color, indices] of colorBuckets) {
      for (let chunk = 0; chunk < indices.length; chunk += 180) {
        const g = this._getGraphics();
        g.visible = true;
        g.clear();

        const end = Math.min(chunk + 180, indices.length);
        for (let j = chunk; j < end; j++) {
          const idx = indices[j];
          const r = d.radius[idx];
          const fadeIn = Math.min(1, d.age[idx] / 8);
          const vel = d.noteVel[idx];
          const oct = d.octave[idx];
          const dur = d.duration[idx];
          const style = d.trackStyle[idx];
          const glowMul = 0.5 + vel * 0.5;
          const bx = d.x[idx];
          const by = d.y[idx];

          // --- Trail ---
          const speed = Math.sqrt(d.vx[idx] * d.vx[idx] + d.vy[idx] * d.vy[idx]);
          if (speed > 0.1 && d.age[idx] > 3) {
            // Duration factor: sustained notes (>0.5s) get longer trails
            const durFactor = 0.5 + Math.min(dur, 2) * 0.5; // 0.5 – 1.5
            const octFactor = Math.max(0.3, 1.2 - oct * 0.12);
            const trailLen = (6 + speed * 4) * octFactor * durFactor;
            const nx = d.vx[idx] / speed;
            const ny = d.vy[idx] / speed;

            for (let s = 0; s < 3; s++) {
              const t0 = s / 3;
              const t1 = (s + 1) / 3;
              const sx = bx - nx * trailLen * t0;
              const sy = by - ny * trailLen * t0;
              const ex = bx - nx * trailLen * t1;
              const ey = by - ny * trailLen * t1;
              const segAlpha = fadeIn * glowMul * 0.25 * (1 - t0);
              const segWidth = r * (1.2 - t0 * 0.8);
              g.moveTo(sx, sy);
              g.lineTo(ex, ey);
              g.stroke({ color, width: segWidth, alpha: segAlpha, cap: 'round' });
            }
          }

          // --- Bullet body by track style ---
          const glowExtra = (8 - oct) * 0.5 + 2;

          if (style === 0) {
            // Filled orb with soft glow
            g.circle(bx, by, r + glowExtra);
            g.fill({ color, alpha: fadeIn * 0.06 * glowMul });
            g.circle(bx, by, r + 1.5);
            g.fill({ color, alpha: fadeIn * 0.2 * glowMul });
            g.circle(bx, by, r);
            g.fill({ color, alpha: fadeIn * (0.6 + vel * 0.35) });
            g.circle(bx, by, r * (0.25 + vel * 0.15));
            g.fill({ color: 0xffffff, alpha: fadeIn * (0.4 + vel * 0.35) });

          } else if (style === 1) {
            // Hollow ring — outline only, no solid fill
            g.circle(bx, by, r + glowExtra * 0.7);
            g.fill({ color, alpha: fadeIn * 0.04 * glowMul });
            g.circle(bx, by, r);
            g.stroke({ color, width: 1.5 + vel, alpha: fadeIn * (0.6 + vel * 0.3) });
            // Tiny center dot
            g.circle(bx, by, r * 0.2);
            g.fill({ color: 0xffffff, alpha: fadeIn * 0.5 });

          } else if (style === 2) {
            // Rimmed orb — solid core with bright outline
            g.circle(bx, by, r + glowExtra * 0.5);
            g.fill({ color, alpha: fadeIn * 0.05 * glowMul });
            g.circle(bx, by, r);
            g.fill({ color, alpha: fadeIn * (0.5 + vel * 0.3) });
            g.circle(bx, by, r + 0.5);
            g.stroke({ color: 0xffffff, width: 0.8 + vel * 0.5, alpha: fadeIn * (0.3 + vel * 0.3) });
            g.circle(bx, by, r * 0.3);
            g.fill({ color: 0xffffff, alpha: fadeIn * (0.3 + vel * 0.3) });

          } else {
            // Style 3: Compact dense — smaller apparent size, very bright core
            g.circle(bx, by, r * 0.7 + 1);
            g.fill({ color, alpha: fadeIn * (0.7 + vel * 0.25) });
            g.circle(bx, by, r * 0.45);
            g.fill({ color: 0xffffff, alpha: fadeIn * (0.6 + vel * 0.3) });
          }
        }

        this.graphics.push(g);
      }
    }
  }

  checkCollision(px, py, hitboxRadius) {
    const d = this.data;
    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;
      const dx = d.x[i] - px;
      const dy = d.y[i] - py;
      const distSq = dx * dx + dy * dy;
      const minDist = d.radius[i] + hitboxRadius;
      if (distSq < minDist * minDist) {
        d.alive[i] = 0;
        this.activeCount--;
        return true;
      }
    }
    return false;
  }

  clearAll() {
    this.data.alive.fill(0);
    this.activeCount = 0;
  }
}
