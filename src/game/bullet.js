import { Sprite, Container, Graphics } from 'pixi.js';
import { gameBounds, BULLET_POOL_SIZE } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';
import { getElement, ELEMENT_DEFS } from './elements.js';

/**
 * Bullet data — struct-of-arrays for cache-friendly access.
 *
 * Each bullet carries full musical identity:
 * - midiNote (0-127) → unique color via noteColor()
 * - noteVel (0-1) → glow intensity
 * - octave (0-9) → visual weight
 * - duration (seconds) → trail length
 * - element (0-4) → texture shape + behavior
 */
class BulletData {
  constructor(size) {
    this.x       = new Float32Array(size);
    this.y       = new Float32Array(size);
    this.vx      = new Float32Array(size);
    this.vy      = new Float32Array(size);
    this.radius  = new Float32Array(size);
    this.color   = new Uint32Array(size);
    this.alive   = new Uint8Array(size);
    this.age     = new Float32Array(size);
    this.type    = new Uint8Array(size);       // trajectory type: 0=normal, 1=wavy, 2=accel, 3=homing
    this.angVel  = new Float32Array(size);
    this.accelX  = new Float32Array(size);
    this.accelY  = new Float32Array(size);
    this.param   = new Float32Array(size);
    this.noteVel = new Float32Array(size);
    this.octave  = new Uint8Array(size);
    this.duration= new Float32Array(size);
    this.element = new Uint8Array(size);
    this.size    = size;
  }
}

/**
 * High-performance bullet system.
 *
 * - Pre-allocated sprite pool (no per-frame allocation)
 * - Free-list for O(1) spawn/despawn
 * - Single trail Graphics object (one line per bullet)
 * - Sprites use pre-rendered element textures with tint
 */
export class BulletSystem {
  constructor() {
    this.data = new BulletData(BULLET_POOL_SIZE);
    this.activeCount = 0;
    this.container = new Container();
    this.container.zIndex = 50;

    // Trail layer (behind sprites)
    this.trailGfx = new Graphics();
    this.container.addChild(this.trailGfx);

    // Sprite pool — pre-allocated, toggle visibility
    this.sprites = new Array(BULLET_POOL_SIZE);

    // Free-list: linked list via nextFree array
    this.nextFree = new Int32Array(BULLET_POOL_SIZE);
    this.freeHead = 0;
    for (let i = 0; i < BULLET_POOL_SIZE - 1; i++) {
      this.nextFree[i] = i + 1;
    }
    this.nextFree[BULLET_POOL_SIZE - 1] = -1;

    // Element textures — set after init via setTextures()
    this.textures = null;
  }

  /**
   * Must be called after renderer init with the 5 element textures.
   */
  setTextures(textures) {
    this.textures = textures;
    // Create all sprites now that we have textures
    for (let i = 0; i < BULLET_POOL_SIZE; i++) {
      const sprite = new Sprite(textures[0]);
      sprite.anchor.set(0.5);
      sprite.visible = false;
      this.container.addChild(sprite);
      this.sprites[i] = sprite;
    }
  }

  /**
   * Spawn a bullet. Config object for clarity.
   * Returns slot index or -1 if pool exhausted.
   */
  spawn({ x, y, vx, vy, radius, midiNote, type = 0, angVel = 0, accelX = 0, accelY = 0, param = 0, noteVel = 0.5, octave = 4, duration = 0.2 }) {
    if (this.freeHead === -1) return -1;

    const idx = this.freeHead;
    this.freeHead = this.nextFree[idx];

    const d = this.data;
    const elem = getElement(midiNote);
    const elemDef = ELEMENT_DEFS[elem];

    d.x[idx]       = x;
    d.y[idx]       = y;
    d.vx[idx]      = vx;
    d.vy[idx]      = vy;
    d.radius[idx]  = radius * elemDef.radiusScale;
    d.color[idx]   = noteColor(midiNote);
    d.alive[idx]   = 1;
    d.age[idx]     = 0;
    d.type[idx]    = type;
    d.angVel[idx]  = angVel;
    d.accelX[idx]  = accelX;
    d.accelY[idx]  = accelY;
    d.param[idx]   = param;
    d.noteVel[idx] = noteVel;
    d.octave[idx]  = octave;
    d.duration[idx]= duration;
    d.element[idx] = elem;

    // Configure sprite
    const sprite = this.sprites[idx];
    if (this.textures) {
      sprite.texture = this.textures[elem];
    }
    sprite.tint = d.color[idx];
    sprite.visible = true;

    this.activeCount++;
    return idx;
  }

  /**
   * Despawn a single bullet back to free-list.
   */
  _despawn(idx) {
    this.data.alive[idx] = 0;
    this.sprites[idx].visible = false;
    this.nextFree[idx] = this.freeHead;
    this.freeHead = idx;
  }

  update(dt, playerX, playerY) {
    const d = this.data;
    const margin = 50;
    let active = 0;

    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;
      d.age[i] += dt;

      // Trajectory behaviors
      switch (d.type[i]) {
        case 1: // wavy
          d.vx[i] = d.param[i] * Math.sin(d.age[i] * 0.08);
          break;
        case 2: // accelerating
          d.vx[i] += d.accelX[i] * dt;
          d.vy[i] += d.accelY[i] * dt;
          break;
        case 3: // brief homing
          if (d.age[i] < 30) {
            const ax = playerX - d.x[i];
            const ay = playerY - d.y[i];
            const dist = Math.sqrt(ax * ax + ay * ay) || 1;
            d.vx[i] += (ax / dist) * 0.05 * dt;
            d.vy[i] += (ay / dist) * 0.05 * dt;
          }
          break;
        case 4: { // decel-burst: slows to near-stop then accelerates forward
          const phase = d.age[i];
          if (phase < 25) {
            // Decelerate
            d.vx[i] *= Math.pow(0.96, dt);
            d.vy[i] *= Math.pow(0.96, dt);
          } else if (phase < 28) {
            // Burst — restore speed in original direction
            const sp = Math.sqrt(d.vx[i] * d.vx[i] + d.vy[i] * d.vy[i]) || 0.01;
            const targetSpeed = d.param[i] || 2;
            d.vx[i] = (d.vx[i] / sp) * targetSpeed * 0.4 * dt;
            d.vy[i] = (d.vy[i] / sp) * targetSpeed * 0.4 * dt;
          }
          break;
        }
        case 5: // sine-arc: perpendicular oscillation for curving paths
          d.vx[i] += d.param[i] * Math.cos(d.age[i] * 0.06) * 0.08 * dt;
          break;
      }

      // Angular velocity
      if (d.angVel[i] !== 0) {
        const cos = Math.cos(d.angVel[i] * dt);
        const sin = Math.sin(d.angVel[i] * dt);
        const nvx = d.vx[i] * cos - d.vy[i] * sin;
        const nvy = d.vx[i] * sin + d.vy[i] * cos;
        d.vx[i] = nvx;
        d.vy[i] = nvy;
      }

      d.x[i] += d.vx[i] * dt;
      d.y[i] += d.vy[i] * dt;

      // Out-of-bounds check
      if (d.x[i] < -margin || d.x[i] > gameBounds.width + margin ||
          d.y[i] < -margin || d.y[i] > gameBounds.height + margin) {
        this._despawn(i);
        continue;
      }
      active++;
    }
    this.activeCount = active;
  }

  /**
   * Render: update sprite transforms + draw trails.
   *
   * Sprites handle bullet bodies (zero geometry cost — just position/scale/alpha).
   * Single Graphics object for all trails (one line segment per bullet).
   */
  render() {
    const d = this.data;
    this.trailGfx.clear();

    for (let i = 0; i < d.size; i++) {
      if (!d.alive[i]) continue;

      const r = d.radius[i];
      const fadeIn = Math.min(1, d.age[i] / 8);
      const vel = d.noteVel[i];
      const elem = d.element[i];
      const elemDef = ELEMENT_DEFS[elem];

      // --- Sprite transform ---
      const sprite = this.sprites[i];
      sprite.position.set(d.x[i], d.y[i]);
      // Scale sprite to match desired radius (texture is 64px wide → 32px radius)
      const desiredSize = (r + elemDef.glowMul * 2) * 2;
      const texSize = 64;
      sprite.scale.set(desiredSize / texSize);
      sprite.alpha = fadeIn * (0.6 + vel * 0.35);

      // --- Trail ---
      const speed = Math.sqrt(d.vx[i] * d.vx[i] + d.vy[i] * d.vy[i]);
      if (speed > 0.3 && d.age[i] > 3) {
        const durFactor = 0.5 + Math.min(d.duration[i], 2) * 0.5;
        const trailLen = (4 + speed * 3) * elemDef.trailMul * durFactor;
        const nx = d.vx[i] / speed;
        const ny = d.vy[i] / speed;
        const tx = d.x[i] - nx * trailLen;
        const ty = d.y[i] - ny * trailLen;

        this.trailGfx.moveTo(d.x[i], d.y[i]);
        this.trailGfx.lineTo(tx, ty);
        this.trailGfx.stroke({
          color: d.color[i],
          width: Math.max(0.5, r * 0.6),
          alpha: fadeIn * 0.2 * (0.5 + vel * 0.5),
          cap: 'round',
        });
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
        this._despawn(i);
        return true;
      }
    }
    return false;
  }

  clearAll() {
    const d = this.data;
    for (let i = 0; i < d.size; i++) {
      if (d.alive[i]) {
        this._despawn(i);
      }
    }
    this.activeCount = 0;
  }
}
