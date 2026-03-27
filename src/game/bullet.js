import { Graphics, Container } from 'pixi.js';
import { gameBounds, BULLET_POOL_SIZE, NOTE_COLORS } from '../utils/constants.js';

/**
 * Bullet data — struct-of-arrays for cache performance.
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
    this.type = new Uint8Array(size); // 0=normal, 1=wavy, 2=accel, 3=homing-briefly
    this.param = new Float32Array(size);
    this.size = size;
  }
}

/**
 * Bullet pool and renderer.
 * Bullets are the visual centerpiece — each is a luminous orb with a
 * soft glow, saturated color ring, and bright white core.
 * Grouped by color for efficient batched rendering.
 */
export class BulletSystem {
  constructor() {
    this.data = new BulletData(BULLET_POOL_SIZE);
    this.activeCount = 0;
    this.container = new Container();
    this.container.zIndex = 50;

    // One Graphics per color bucket, reused each frame
    this.graphics = [];
    this.graphicsPool = [];

    for (let i = 0; i < 80; i++) {
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

  spawn(x, y, vx, vy, radius, colorIdx, type = 0, angularVel = 0, accelX = 0, accelY = 0, param = 0) {
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
    d.color[idx] = NOTE_COLORS[colorIdx % 12];
    d.alive[idx] = 1;
    d.age[idx] = 0;
    d.angularVel[idx] = angularVel;
    d.accelX[idx] = accelX;
    d.accelY[idx] = accelY;
    d.type[idx] = type;
    d.param[idx] = param;
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
        case 1: // Wavy
          d.vx[i] = d.param[i] * Math.sin(d.age[i] * 0.08);
          break;
        case 2: // Accelerating
          d.vx[i] += d.accelX[i] * dt;
          d.vy[i] += d.accelY[i] * dt;
          break;
        case 3: // Brief homing (first 30 frames)
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
   * Render bullets as luminous orbs.
   * Each bullet: soft wide glow → colored body → bright core.
   * Batched by color for draw-call efficiency.
   */
  render() {
    const d = this.data;

    // Return all graphics to pool
    for (const g of this.graphics) {
      this._releaseGraphics(g);
    }
    this.graphics.length = 0;

    // Group by color
    const colorBuckets = new Map();
    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;
      const color = d.color[i];
      if (!colorBuckets.has(color)) colorBuckets.set(color, []);
      colorBuckets.get(color).push(i);
    }

    for (const [color, indices] of colorBuckets) {
      for (let chunk = 0; chunk < indices.length; chunk += 250) {
        const g = this._getGraphics();
        g.visible = true;
        g.clear();

        const end = Math.min(chunk + 250, indices.length);
        for (let j = chunk; j < end; j++) {
          const i = indices[j];
          const r = d.radius[i];
          // Smooth fade-in over first few frames
          const fadeIn = Math.min(1, d.age[i] / 8);

          // Layer 1: Soft ambient glow (wide, very transparent)
          g.circle(d.x[i], d.y[i], r + 4);
          g.fill({ color, alpha: fadeIn * 0.07 });

          // Layer 2: Color halo
          g.circle(d.x[i], d.y[i], r + 1.5);
          g.fill({ color, alpha: fadeIn * 0.25 });

          // Layer 3: Solid orb body
          g.circle(d.x[i], d.y[i], r);
          g.fill({ color, alpha: fadeIn * 0.9 });

          // Layer 4: Bright white-ish core
          g.circle(d.x[i], d.y[i], r * 0.35);
          g.fill({ color: 0xffffff, alpha: fadeIn * 0.65 });
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
