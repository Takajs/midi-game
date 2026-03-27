import { Graphics, Container } from 'pixi.js';
import { gameBounds, NOTE_COLORS } from '../utils/constants.js';

const MAX_PARTICLES = 600;

/**
 * Elegant, restrained particle system.
 * Particles enhance the experience without overwhelming it.
 * No screen flashes. No aggressive bursts. Just tasteful accents.
 */
export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.container = new Container();
    this.container.zIndex = 80;

    // Single Graphics object for all particles (efficient batching)
    this.gfx = new Graphics();
    this.container.addChild(this.gfx);
  }

  /**
   * Small sparkle where a bullet spawns — very subtle, a few tiny motes
   * drifting down from the spawn point.
   */
  spawnNoteEmber(pitch, x) {
    const color = NOTE_COLORS[pitch % 12];
    const count = 2;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 12,
        y: 2 + Math.random() * 6,
        vx: (Math.random() - 0.5) * 0.6,
        vy: 0.3 + Math.random() * 0.5,
        life: 25 + Math.random() * 15,
        maxLife: 40,
        size: 0.8 + Math.random() * 1.2,
        color,
      });
    }
  }

  /**
   * Player hit: ring of soft particles expanding outward.
   * Elegant, not an explosion — more like petals scattering.
   */
  spawnHitRing(x, y) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 1.5 + Math.random() * 2;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 35 + Math.random() * 20,
        maxLife: 55,
        size: 1.5 + Math.random() * 2,
        color: 0xf4a0c0,
      });
    }
    // A few white sparks at center
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15 + Math.random() * 10,
        maxLife: 25,
        size: 1 + Math.random() * 1.5,
        color: 0xffffff,
      });
    }
  }

  /**
   * Final death: a larger, slower bloom of colored motes.
   */
  spawnDeathBloom(x, y) {
    const count = 36;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const speed = 0.5 + Math.random() * 3;
      // Use muted, pastel versions of note colors
      const color = NOTE_COLORS[i % 12];
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 60 + Math.random() * 50,
        maxLife: 110,
        size: 1.5 + Math.random() * 3,
        color,
        friction: 0.985,
      });
    }
  }

  /**
   * Graze sparkle — one or two tiny white dots near the bullet.
   */
  spawnGraze(x, y) {
    this.particles.push({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 1,
      vy: (Math.random() - 0.5) * 1,
      life: 10 + Math.random() * 8,
      maxLife: 18,
      size: 0.6 + Math.random() * 1,
      color: 0xffffff,
    });
  }

  update(dt) {
    // Trim excess
    if (this.particles.length > MAX_PARTICLES) {
      this.particles.splice(0, this.particles.length - MAX_PARTICLES);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      // Apply friction if set
      if (p.friction) {
        p.vx *= p.friction;
        p.vy *= p.friction;
      }

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  render() {
    this.gfx.clear();

    for (const p of this.particles) {
      const t = Math.max(0, p.life / p.maxLife);
      // Smooth fade: ease-out curve
      const alpha = t * t;
      const size = p.size * (0.4 + 0.6 * t);
      if (size < 0.3) continue;

      // Soft glow halo
      this.gfx.circle(p.x, p.y, size + 1.5);
      this.gfx.fill({ color: p.color, alpha: alpha * 0.12 });

      // Core
      this.gfx.circle(p.x, p.y, size);
      this.gfx.fill({ color: p.color, alpha: alpha * 0.8 });
    }
  }

  clear() {
    this.particles.length = 0;
  }
}
