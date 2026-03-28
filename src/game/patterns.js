import { gameBounds, PATTERNS } from '../utils/constants.js';
import { angleToward, seededRandom } from '../utils/math.js';

/**
 * Bullet pattern spawner.
 *
 * Spawn position uses the full MIDI note number (0-127) mapped across
 * the screen width: bass notes spawn left, treble right.
 *
 * Edge coverage: many patterns also fire mirror/edge bullets so corners
 * are never safe. Side-wall spawns, diagonal curtains, and arcing shots
 * ensure the entire screen is contested.
 */
export class PatternSpawner {
  constructor(bulletSystem) {
    this.bullets = bulletSystem;
    this.spiralAngle = 0;
    this._edgeCounter = 0; // cycles edge spawn side
  }

  _spawnX(midi) {
    return (midi / 127) * gameBounds.width * 0.85 + gameBounds.width * 0.075;
  }

  _base(note) {
    return {
      midiNote: note.midi,
      noteVel: note.velocity,
      octave: note.octave,
      duration: note.duration || 0.2,
    };
  }

  getPattern(note) {
    const { velocity, octave, pitch, midi, track } = note;
    const seed = midi * 7 + track * 13;

    if (velocity > 0.8) {
      if (octave >= 5) return PATTERNS.RING;
      if (octave <= 2) return PATTERNS.CROSSFIRE;
      if (pitch % 3 === 0) return PATTERNS.SPIRAL;
      return PATTERNS.SPREAD;
    }
    if (velocity > 0.5) {
      if (octave >= 5) return PATTERNS.AIMED;
      if (octave <= 2) return PATTERNS.WAVE;
      if (seed % 7 === 0) return PATTERNS.ARC;
      if (seed % 5 === 0) return PATTERNS.STREAM;
      return PATTERNS.SPREAD;
    }
    if (octave >= 6) return PATTERNS.ARC;
    if (octave >= 5) return PATTERNS.SINGLE;
    if (pitch % 4 === 0) return PATTERNS.WAVE;
    if (seed % 6 === 0) return PATTERNS.CROSSFIRE;
    return PATTERNS.RAIN;
  }

  spawnForNote(note, playerX, playerY) {
    const pattern = this.getPattern(note);
    const { midi, velocity, pitch, octave } = note;
    const w = gameBounds.width;
    const h = gameBounds.height;
    const baseSpeed = 1.2 + velocity * 1.5 + octave * 0.15;
    const radius = Math.max(3, 7 - octave * 0.5 + velocity * 2);
    const spawnX = this._spawnX(midi);
    const rng = seededRandom(midi * 31 + Math.floor(performance.now()));
    const base = this._base(note);

    switch (pattern) {
      case PATTERNS.SINGLE:
        this.bullets.spawn({ ...base, x: spawnX, y: -10, vx: 0, vy: baseSpeed, radius });
        // Mirror: one from opposite edge angled inward
        this._spawnEdgeSingle(base, spawnX, w, baseSpeed, radius * 0.7, rng);
        break;

      case PATTERNS.SPREAD: {
        const count = 3 + Math.floor(velocity * 4);
        const totalAngle = Math.PI * 0.4;
        const startAngle = Math.PI / 2 - totalAngle / 2;
        for (let i = 0; i < count; i++) {
          const angle = startAngle + (totalAngle * i) / (count - 1 || 1);
          this.bullets.spawn({
            ...base, x: spawnX, y: -10,
            vx: Math.cos(angle) * baseSpeed,
            vy: Math.sin(angle) * baseSpeed,
            radius: radius * 0.8,
          });
        }
        break;
      }

      case PATTERNS.RING: {
        const count = 8 + Math.floor(velocity * 10);
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + rng() * 0.3;
          this.bullets.spawn({
            ...base, x: spawnX, y: -10,
            vx: Math.cos(angle) * baseSpeed * 0.8,
            vy: Math.sin(angle) * baseSpeed * 0.8,
            radius: radius * 0.6,
          });
        }
        break;
      }

      case PATTERNS.AIMED: {
        const angle = angleToward(spawnX, -10, playerX, playerY);
        this.bullets.spawn({
          ...base, x: spawnX, y: -10,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed, radius,
        });
        const off = 0.15;
        for (const sign of [1, -1]) {
          this.bullets.spawn({
            ...base, x: spawnX, y: -10,
            vx: Math.cos(angle + off * sign) * baseSpeed,
            vy: Math.sin(angle + off * sign) * baseSpeed,
            radius: radius * 0.7,
          });
        }
        break;
      }

      case PATTERNS.STREAM: {
        const waveMag = 1.5 + rng() * 2;
        this.bullets.spawn({
          ...base, x: spawnX, y: -10, vx: 0, vy: baseSpeed,
          radius: radius * 0.7, type: 1, param: waveMag,
        });
        this.bullets.spawn({
          ...base, x: spawnX + 20, y: -10, vx: 0, vy: baseSpeed * 0.9,
          radius: radius * 0.7, type: 1, param: -waveMag,
        });
        break;
      }

      case PATTERNS.SPIRAL: {
        const count = 3 + Math.floor(velocity * 3);
        const cx = w / 2;
        for (let i = 0; i < count; i++) {
          const angle = this.spiralAngle + (Math.PI * 2 * i) / count;
          const vx = Math.cos(angle) * baseSpeed * 0.7;
          const vy = Math.sin(angle) * baseSpeed * 0.7;
          this.bullets.spawn({
            ...base, x: cx, y: -10,
            vx, vy: Math.abs(vy) + baseSpeed * 0.5,
            radius: radius * 0.65, angVel: 0.01,
          });
        }
        this.spiralAngle += 0.5 + velocity * 0.3;
        break;
      }

      case PATTERNS.WAVE: {
        const waveMag = 2 + (pitch / 12) * 2;
        for (let i = 0; i < 3; i++) {
          this.bullets.spawn({
            ...base, x: spawnX + (i - 1) * 25, y: -10,
            vx: 0, vy: baseSpeed * 0.8,
            radius: radius * 0.6, type: 1,
            param: waveMag * (i % 2 === 0 ? 1 : -1),
          });
        }
        break;
      }

      case PATTERNS.RAIN:
        for (let i = 0; i < 2; i++) {
          const rx = rng() * w;
          this.bullets.spawn({
            ...base, x: rx, y: -10,
            vx: (rng() - 0.5) * 0.5, vy: baseSpeed * 0.7,
            radius: radius * 0.5,
          });
        }
        break;

      // --- NEW: edge-coverage patterns ---

      case PATTERNS.CROSSFIRE: {
        // Diagonal curtain from alternating sides
        const side = this._edgeCounter++ % 2;
        const fromX = side === 0 ? -10 : w + 10;
        const dirX = side === 0 ? 1 : -1;
        const count = 2 + Math.floor(velocity * 3);
        for (let i = 0; i < count; i++) {
          const yOff = (i / count) * h * 0.4;
          const spread = (rng() - 0.5) * 0.3;
          this.bullets.spawn({
            ...base, x: fromX, y: yOff + rng() * 30,
            vx: dirX * baseSpeed * (0.7 + rng() * 0.3),
            vy: baseSpeed * (0.3 + spread),
            radius: radius * 0.7,
            type: 5, param: dirX * (1 + velocity),
          });
        }
        // Also a top-down one from the note position for musicality
        this.bullets.spawn({ ...base, x: spawnX, y: -10, vx: 0, vy: baseSpeed, radius: radius * 0.6 });
        break;
      }

      case PATTERNS.ARC: {
        // Arcing shots from sides that curve across the screen
        const side = this._edgeCounter++ % 2;
        const fromX = side === 0 ? -10 : w + 10;
        const dirX = side === 0 ? 1 : -1;
        const arcCount = 2 + Math.floor(velocity * 2);
        for (let i = 0; i < arcCount; i++) {
          const yStart = h * 0.1 + rng() * h * 0.3;
          this.bullets.spawn({
            ...base, x: fromX, y: yStart,
            vx: dirX * baseSpeed * 0.9,
            vy: baseSpeed * 0.4 + rng() * 0.3,
            radius: radius * 0.65,
            type: 5, param: -dirX * (1.5 + velocity * 0.8),
          });
        }
        // Decel-burst from top for visual drama
        this.bullets.spawn({
          ...base, x: spawnX, y: -10, vx: 0, vy: baseSpeed * 1.3,
          radius: radius * 0.8, type: 4, param: baseSpeed,
        });
        break;
      }
    }
  }

  /**
   * Mirror bullet from the edge opposite to the main spawn X.
   * Prevents corners from being safe by sending angled shots from walls.
   */
  _spawnEdgeSingle(base, mainX, w, speed, radius, rng) {
    // Only fire ~40% of the time to keep it musical, not overwhelming
    if (rng() > 0.4) return;

    const side = mainX > w / 2 ? 0 : 1; // opposite side
    const fromX = side === 0 ? -10 : w + 10;
    const dirX = side === 0 ? 1 : -1;
    this.bullets.spawn({
      ...base, x: fromX, y: rng() * 80,
      vx: dirX * speed * 0.6,
      vy: speed * 0.5,
      radius,
      type: 5, param: -dirX * 0.8,
    });
  }
}
