import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';

const MAX_PARTICLES = 1500;

/**
 * Particle system — blooms, embers, sparks, hit rings, graze streaks,
 * bass impact rings, ambient motes, death blooms.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.blooms = [];
    this.rings = []; // expanding ring effects
    this.container = new Container();
    this.container.zIndex = 80;
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  // ─── Spawn helpers ───

  spawnBloom(x, y, midiNote, velocity) {
    const color = noteColor(midiNote);
    this.blooms.push({
      x, y, radius: 3,
      maxRadius: 18 + velocity * 25,
      life: 22 + velocity * 12, maxLife: 34,
      color, velocity,
    });
  }

  spawnNoteEmber(midiNote, x, velocity) {
    const color = noteColor(midiNote);
    const count = 2 + Math.floor(velocity * 4);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: 4 + Math.random() * 10,
        vx: (Math.random() - 0.5) * (0.5 + velocity * 1.0),
        vy: 0.3 + Math.random() * 0.8 + velocity * 0.4,
        life: 25 + Math.random() * 18 + velocity * 12,
        maxLife: 55,
        size: 0.8 + Math.random() * 1.5 + velocity * 1.0,
        color,
      });
    }
  }

  /** Electric sparks at thunderbolt endpoints. */
  spawnBoltSpark(x, y, color) {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.0 + Math.random() * 2.5;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 10 + Math.random() * 12, maxLife: 22,
        size: 0.6 + Math.random() * 1.5,
        color: 0xffffff,
      });
    }
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.8;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 14 + Math.random() * 10, maxLife: 24,
        size: 1.2 + Math.random() * 2,
        color,
      });
    }
  }

  /** Beam warning shimmer particles along the beam line. */
  spawnBeamShimmer(x, color) {
    const h = gameBounds.height;
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.4,
        vy: -0.6 - Math.random() * 0.6,
        life: 18 + Math.random() * 12, maxLife: 30,
        size: 0.5 + Math.random() * 1.0,
        color,
      });
    }
  }

  /** Player was hit — dramatic expanding ring of particles. */
  spawnHitRing(x, y) {
    // Main ring burst
    for (let i = 0; i < 30; i++) {
      const a = (Math.PI * 2 * i) / 30;
      const sp = 1.8 + Math.random() * 2.5;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 40 + Math.random() * 25, maxLife: 65,
        size: 2 + Math.random() * 2.5, color: 0xf4a0c0,
      });
    }
    // White star particles
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.6 + Math.random() * 1.8;
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 18 + Math.random() * 12, maxLife: 30,
        size: 1.5 + Math.random() * 2, color: 0xffffff,
      });
    }
    // Central flash
    this.particles.push({
      x, y, vx: 0, vy: 0,
      life: 6, maxLife: 6,
      size: 10, color: 0xffffff,
    });
    // Expanding ring
    this.rings.push({
      x, y, radius: 5, maxRadius: 80,
      life: 20, maxLife: 20, color: 0xf4a0c0,
    });
  }

  /** Full death explosion. */
  spawnDeathBloom(x, y) {
    // Colorful burst
    for (let i = 0; i < 60; i++) {
      const a = (Math.PI * 2 * i) / 60;
      const sp = 0.5 + Math.random() * 3.5;
      const mn = 20 + Math.floor((i / 60) * 80);
      this.particles.push({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 70 + Math.random() * 60, maxLife: 130,
        size: 2 + Math.random() * 3.5, color: noteColor(mn),
        friction: 0.985,
      });
    }
    // Slow bloom particles
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.1 + Math.random() * 0.5;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 150 + Math.random() * 60, maxLife: 210,
        size: 4 + Math.random() * 3, color: 0xf4a0c0,
        friction: 0.995,
      });
    }
    // Expanding ring
    this.rings.push({
      x, y, radius: 5, maxRadius: 150,
      life: 35, maxLife: 35, color: 0xffffff,
    });
  }

  /** Graze spark — streak perpendicular to bullet path. */
  spawnGraze(bx, by) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1.5 + Math.random() * 2;
      this.particles.push({
        x: bx + (Math.random() - 0.5) * 8,
        y: by + (Math.random() - 0.5) * 8,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 8 + Math.random() * 8, maxLife: 16,
        size: 0.8 + Math.random() * 1.2, color: 0xffffff,
      });
    }
  }

  /** Bass note impact — expanding ring + heavy particles. */
  spawnBassImpact(x, y, intensity, color) {
    this.rings.push({
      x, y, radius: 8, maxRadius: 50 + intensity * 60,
      life: 18, maxLife: 18, color,
    });
    const count = 4 + Math.floor(intensity * 4);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.3 + Math.random() * 0.8;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 30 + Math.random() * 20, maxLife: 50,
        size: 2 + Math.random() * 2, color,
        friction: 0.99,
      });
    }
  }

  /** High note sparkle — tiny fast-fading white specks. */
  spawnHighSparkle(x, y) {
    for (let i = 0; i < 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: y + (Math.random() - 0.5) * 12,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 5 + Math.random() * 6, maxLife: 11,
        size: 0.5 + Math.random() * 0.8, color: 0xffffff,
      });
    }
  }

  /** Ambient floating mote — slow, long-lived, firefly-like. */
  spawnAmbientMote(color) {
    const w = gameBounds.width, h = gameBounds.height;
    this.particles.push({
      x: Math.random() * w,
      y: h * 0.3 + Math.random() * h * 0.6,
      vx: (Math.random() - 0.5) * 0.05,
      vy: -0.03 - Math.random() * 0.06,
      life: 200 + Math.random() * 120, maxLife: 320,
      size: 0.5 + Math.random() * 0.8,
      color,
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
      b.radius = 3 + (1 - b.life / b.maxLife) * b.maxRadius;
      if (b.life <= 0) this.blooms.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const progress = 1 - r.life / r.maxLife;
      r.radius = r.maxRadius * (0.1 + progress * 0.9);
      if (r.life <= 0) this.rings.splice(i, 1);
    }
  }

  // ─── Render ───

  render() {
    this.gfx.clear();

    // Rings (expanding)
    for (const r of this.rings) {
      const t = Math.max(0, r.life / r.maxLife);
      this.gfx.circle(r.x, r.y, r.radius);
      this.gfx.stroke({ color: r.color, width: 1.5 + t * 2, alpha: t * 0.35 });
    }

    // Blooms
    for (const b of this.blooms) {
      const t = Math.max(0, b.life / b.maxLife);
      const alpha = t * t * 0.4 * (0.5 + b.velocity * 0.5);
      this.gfx.circle(b.x, b.y, b.radius);
      this.gfx.stroke({ color: b.color, width: 2 + b.velocity * 1.5, alpha, cap: 'round' });
      if (t > 0.5) {
        this.gfx.circle(b.x, b.y, b.radius * 0.5);
        this.gfx.fill({ color: b.color, alpha: (t - 0.5) * 0.18 });
      }
    }

    // Particles
    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      const alpha = t * t;
      const size = p.size * (0.4 + 0.6 * t);
      if (size < 0.3) continue;
      // Glow
      this.gfx.circle(p.x, p.y, size + 2);
      this.gfx.fill({ color: p.color, alpha: alpha * 0.1 });
      // Core
      this.gfx.circle(p.x, p.y, size);
      this.gfx.fill({ color: p.color, alpha: alpha * 0.8 });
    }
  }

  clear() {
    this.particles.length = 0;
    this.blooms.length = 0;
    this.rings.length = 0;
  }
}
