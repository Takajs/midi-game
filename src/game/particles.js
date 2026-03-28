import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';

const MAX_PARTICLES = 800;

/**
 * Particle system — blooms, embers, sparks, hit rings, graze effects.
 * Uses object arrays (kept simple — particles are visual-only, not physics-critical).
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.blooms = [];
    this.container = new Container();
    this.container.zIndex = 80;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  // ─── Spawn helpers ───

  spawnBloom(x, y, midiNote, velocity) {
    const color = noteColor(midiNote);
    this.blooms.push({
      x, y, radius: 2,
      maxRadius: 12 + velocity * 18,
      life: 20 + velocity * 10, maxLife: 30,
      color, velocity,
    });
  }

  spawnNoteEmber(midiNote, x, velocity) {
    const color = noteColor(midiNote);
    const count = 1 + Math.floor(velocity * 3);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: 4 + Math.random() * 8,
        vx: (Math.random() - 0.5) * (0.4 + velocity * 0.8),
        vy: 0.2 + Math.random() * 0.6 + velocity * 0.3,
        life: 20 + Math.random() * 15 + velocity * 10,
        maxLife: 45,
        size: 0.6 + Math.random() * 1.2 + velocity * 0.8,
        color,
      });
    }
  }

  /** Electric sparks at thunderbolt endpoints. */
  spawnBoltSpark(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.8 + Math.random() * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 8 + Math.random() * 10, maxLife: 18,
        size: 0.5 + Math.random() * 1.2,
        color: 0xffffff,
      });
    }
    // Colored core sparks
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 12 + Math.random() * 8, maxLife: 20,
        size: 1 + Math.random() * 1.5,
        color,
      });
    }
  }

  /** Beam warning shimmer particles along the beam line. */
  spawnBeamShimmer(x, color) {
    const h = gameBounds.height;
    for (let i = 0; i < 3; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 6,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -0.5 - Math.random() * 0.5,
        life: 15 + Math.random() * 10, maxLife: 25,
        size: 0.4 + Math.random() * 0.8,
        color,
      });
    }
  }

  spawnHitRing(x, y) {
    for (let i = 0; i < 20; i++) {
      const a = (Math.PI * 2 * i) / 20;
      const sp = 1.5 + Math.random() * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 35 + Math.random() * 20, maxLife: 55,
        size: 1.5 + Math.random() * 2, color: 0xf4a0c0,
      });
    }
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 15 + Math.random() * 10, maxLife: 25,
        size: 1 + Math.random() * 1.5, color: 0xffffff,
      });
    }
  }

  spawnDeathBloom(x, y) {
    for (let i = 0; i < 36; i++) {
      const a = (Math.PI * 2 * i) / 36;
      const sp = 0.5 + Math.random() * 3;
      const mn = 20 + Math.floor((i / 36) * 80);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 60 + Math.random() * 50, maxLife: 110,
        size: 1.5 + Math.random() * 3, color: noteColor(mn),
        friction: 0.985,
      });
    }
  }

  spawnGraze(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
      life: 10 + Math.random() * 8, maxLife: 18,
      size: 0.6 + Math.random(), color: 0xffffff,
    });
  }

  // ─── Update ───

  update(dt) {
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.friction) { p.vx *= p.friction; p.vy *= p.friction; }
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.blooms.length - 1; i >= 0; i--) {
      const b = this.blooms[i];
      b.life -= dt;
      b.radius = 2 + (1 - b.life / b.maxLife) * b.maxRadius;
      if (b.life <= 0) this.blooms.splice(i, 1);
    }
  }

  // ─── Render ───

  render() {
    this.gfx.clear();

    for (const b of this.blooms) {
      const t = Math.max(0, b.life / b.maxLife);
      const alpha = t * t * 0.4 * (0.5 + b.velocity * 0.5);
      this.gfx.circle(b.x, b.y, b.radius);
      this.gfx.stroke({ color: b.color, width: 1.5 + b.velocity, alpha, cap: 'round' });
      if (t > 0.5) {
        this.gfx.circle(b.x, b.y, b.radius * 0.5);
        this.gfx.fill({ color: b.color, alpha: (t - 0.5) * 0.15 });
      }
    }

    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      const alpha = t * t;
      const size = p.size * (0.4 + 0.6 * t);
      if (size < 0.3) continue;
      this.gfx.circle(p.x, p.y, size + 1.5);
      this.gfx.fill({ color: p.color, alpha: alpha * 0.12 });
      this.gfx.circle(p.x, p.y, size);
      this.gfx.fill({ color: p.color, alpha: alpha * 0.8 });
    }
  }

  clear() {
    this.particles.length = 0;
    this.blooms.length = 0;
  }
}
