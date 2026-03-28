import { Graphics, Container } from 'pixi.js';
import { noteColor } from '../utils/noteColor.js';

const MAX_PARTICLES = 800;
const MAX_BLOOMS = 200;

/**
 * High-performance particle system using struct-of-arrays
 * with swap-and-pop removal (O(1) per removal vs O(n) splice).
 */
export class ParticleSystem {
  constructor() {
    this.container = new Container();
    this.container.zIndex = 80;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    // --- Particle SoA ---
    this.pCount = 0;
    this.px      = new Float32Array(MAX_PARTICLES);
    this.py      = new Float32Array(MAX_PARTICLES);
    this.pvx     = new Float32Array(MAX_PARTICLES);
    this.pvy     = new Float32Array(MAX_PARTICLES);
    this.plife   = new Float32Array(MAX_PARTICLES);
    this.pmaxLife= new Float32Array(MAX_PARTICLES);
    this.psize   = new Float32Array(MAX_PARTICLES);
    this.pcolor  = new Uint32Array(MAX_PARTICLES);
    this.pfriction = new Float32Array(MAX_PARTICLES);

    // --- Bloom SoA ---
    this.bCount = 0;
    this.bx       = new Float32Array(MAX_BLOOMS);
    this.by       = new Float32Array(MAX_BLOOMS);
    this.bradius  = new Float32Array(MAX_BLOOMS);
    this.bmaxR    = new Float32Array(MAX_BLOOMS);
    this.blife    = new Float32Array(MAX_BLOOMS);
    this.bmaxLife = new Float32Array(MAX_BLOOMS);
    this.bcolor   = new Uint32Array(MAX_BLOOMS);
    this.bvel     = new Float32Array(MAX_BLOOMS);
  }

  // --- Spawn helpers ---

  _addParticle(x, y, vx, vy, life, maxLife, size, color, friction = 0) {
    if (this.pCount >= MAX_PARTICLES) return;
    const i = this.pCount++;
    this.px[i] = x;  this.py[i] = y;
    this.pvx[i] = vx; this.pvy[i] = vy;
    this.plife[i] = life; this.pmaxLife[i] = maxLife;
    this.psize[i] = size; this.pcolor[i] = color;
    this.pfriction[i] = friction;
  }

  _addBloom(x, y, maxRadius, life, maxLife, color, velocity) {
    if (this.bCount >= MAX_BLOOMS) return;
    const i = this.bCount++;
    this.bx[i] = x;  this.by[i] = y;
    this.bradius[i] = 2; this.bmaxR[i] = maxRadius;
    this.blife[i] = life; this.bmaxLife[i] = maxLife;
    this.bcolor[i] = color; this.bvel[i] = velocity;
  }

  /**
   * Bloom at bullet birth point. Full MIDI note color.
   */
  spawnBloom(x, y, midiNote, velocity) {
    const color = noteColor(midiNote);
    this._addBloom(x, y, 12 + velocity * 18, 20 + velocity * 10, 30, color, velocity);
  }

  /**
   * Embers drifting from spawn point with full note color.
   */
  spawnNoteEmber(midiNote, x, velocity) {
    const color = noteColor(midiNote);
    const count = 1 + Math.floor(velocity * 3);
    for (let i = 0; i < count; i++) {
      this._addParticle(
        x + (Math.random() - 0.5) * 16,
        4 + Math.random() * 8,
        (Math.random() - 0.5) * (0.4 + velocity * 0.8),
        0.2 + Math.random() * 0.6 + velocity * 0.3,
        20 + Math.random() * 15 + velocity * 10,
        45,
        0.6 + Math.random() * 1.2 + velocity * 0.8,
        color,
      );
    }
  }

  spawnHitRing(x, y) {
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = 1.5 + Math.random() * 2;
      this._addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        35 + Math.random() * 20, 55, 1.5 + Math.random() * 2, 0xf4a0c0);
    }
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      this._addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        15 + Math.random() * 10, 25, 1 + Math.random() * 1.5, 0xffffff);
    }
  }

  spawnDeathBloom(x, y) {
    for (let i = 0; i < 36; i++) {
      const angle = (Math.PI * 2 * i) / 36;
      const speed = 0.5 + Math.random() * 3;
      const midiNote = 20 + Math.floor((i / 36) * 80);
      this._addParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed,
        60 + Math.random() * 50, 110, 1.5 + Math.random() * 3, noteColor(midiNote), 0.985);
    }
  }

  spawnGraze(x, y) {
    this._addParticle(
      x + (Math.random() - 0.5) * 6,
      y + (Math.random() - 0.5) * 6,
      (Math.random() - 0.5), (Math.random() - 0.5),
      10 + Math.random() * 8, 18,
      0.6 + Math.random(), 0xffffff,
    );
  }

  // --- Update with swap-and-pop ---

  update(dt) {
    // Update particles
    let i = 0;
    while (i < this.pCount) {
      this.px[i] += this.pvx[i] * dt;
      this.py[i] += this.pvy[i] * dt;
      this.plife[i] -= dt;

      if (this.pfriction[i]) {
        this.pvx[i] *= this.pfriction[i];
        this.pvy[i] *= this.pfriction[i];
      }

      if (this.plife[i] <= 0) {
        // Swap-and-pop: move last element here
        const last = this.pCount - 1;
        if (i < last) {
          this.px[i] = this.px[last];  this.py[i] = this.py[last];
          this.pvx[i] = this.pvx[last]; this.pvy[i] = this.pvy[last];
          this.plife[i] = this.plife[last]; this.pmaxLife[i] = this.pmaxLife[last];
          this.psize[i] = this.psize[last]; this.pcolor[i] = this.pcolor[last];
          this.pfriction[i] = this.pfriction[last];
        }
        this.pCount--;
        continue; // re-check swapped element at same index
      }
      i++;
    }

    // Update blooms
    i = 0;
    while (i < this.bCount) {
      this.blife[i] -= dt;
      this.bradius[i] = 2 + (1 - this.blife[i] / this.bmaxLife[i]) * this.bmaxR[i];

      if (this.blife[i] <= 0) {
        const last = this.bCount - 1;
        if (i < last) {
          this.bx[i] = this.bx[last]; this.by[i] = this.by[last];
          this.bradius[i] = this.bradius[last]; this.bmaxR[i] = this.bmaxR[last];
          this.blife[i] = this.blife[last]; this.bmaxLife[i] = this.bmaxLife[last];
          this.bcolor[i] = this.bcolor[last]; this.bvel[i] = this.bvel[last];
        }
        this.bCount--;
        continue;
      }
      i++;
    }
  }

  render() {
    this.gfx.clear();

    // Blooms
    for (let i = 0; i < this.bCount; i++) {
      const t = Math.max(0, this.blife[i] / this.bmaxLife[i]);
      const alpha = t * t * 0.4 * (0.5 + this.bvel[i] * 0.5);
      const color = this.bcolor[i];

      this.gfx.circle(this.bx[i], this.by[i], this.bradius[i]);
      this.gfx.stroke({ color, width: 1.5 + this.bvel[i], alpha, cap: 'round' });

      if (t > 0.5) {
        this.gfx.circle(this.bx[i], this.by[i], this.bradius[i] * 0.5);
        this.gfx.fill({ color, alpha: (t - 0.5) * 0.15 });
      }
    }

    // Particles
    for (let i = 0; i < this.pCount; i++) {
      const t = Math.max(0, this.plife[i] / this.pmaxLife[i]);
      const alpha = t * t;
      const size = this.psize[i] * (0.4 + 0.6 * t);
      if (size < 0.3) continue;
      const color = this.pcolor[i];

      this.gfx.circle(this.px[i], this.py[i], size + 1.5);
      this.gfx.fill({ color, alpha: alpha * 0.12 });
      this.gfx.circle(this.px[i], this.py[i], size);
      this.gfx.fill({ color, alpha: alpha * 0.8 });
    }
  }

  clear() {
    this.pCount = 0;
    this.bCount = 0;
  }
}
