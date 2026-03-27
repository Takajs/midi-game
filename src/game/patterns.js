import { gameBounds, PATTERNS } from '../utils/constants.js';
import { angleToward, randomRange, seededRandom } from '../utils/math.js';

/**
 * Bullet pattern spawner.
 * Maps MIDI note properties to bullet patterns.
 */
export class PatternSpawner {
  constructor(bulletSystem) {
    this.bullets = bulletSystem;
    this.spiralAngle = 0;
  }

  getPattern(note) {
    const { midi, velocity, octave, pitch, track } = note;
    const seed = midi * 7 + track * 13;

    if (velocity > 0.8) {
      if (octave >= 5) return PATTERNS.RING;
      if (pitch % 3 === 0) return PATTERNS.SPIRAL;
      return PATTERNS.SPREAD;
    }

    if (velocity > 0.5) {
      if (octave >= 5) return PATTERNS.AIMED;
      if (octave <= 2) return PATTERNS.WAVE;
      if (seed % 5 === 0) return PATTERNS.STREAM;
      return PATTERNS.SPREAD;
    }

    if (octave >= 5) return PATTERNS.SINGLE;
    if (pitch % 4 === 0) return PATTERNS.WAVE;
    return PATTERNS.RAIN;
  }

  spawnForNote(note, playerX, playerY) {
    const pattern = this.getPattern(note);
    const { midi, velocity, pitch, octave } = note;
    const w = gameBounds.width;

    const baseSpeed = 1.2 + velocity * 1.5 + octave * 0.15;
    const radius = Math.max(3, 7 - octave * 0.5 + velocity * 2);
    const spawnX = (pitch / 12) * w * 0.8 + w * 0.1;
    const rng = seededRandom(midi * 31 + Math.floor(performance.now()));

    switch (pattern) {
      case PATTERNS.SINGLE:
        this._spawnSingle(spawnX, radius, baseSpeed, pitch);
        break;
      case PATTERNS.SPREAD:
        this._spawnSpread(spawnX, radius, baseSpeed, pitch, velocity);
        break;
      case PATTERNS.RING:
        this._spawnRing(spawnX, radius, baseSpeed, pitch, velocity, rng);
        break;
      case PATTERNS.AIMED:
        this._spawnAimed(spawnX, radius, baseSpeed, pitch, playerX, playerY);
        break;
      case PATTERNS.STREAM:
        this._spawnStream(spawnX, radius, baseSpeed, pitch, rng);
        break;
      case PATTERNS.SPIRAL:
        this._spawnSpiral(radius, baseSpeed, pitch, velocity);
        break;
      case PATTERNS.WAVE:
        this._spawnWave(spawnX, radius, baseSpeed, pitch);
        break;
      case PATTERNS.RAIN:
        this._spawnRain(radius, baseSpeed, pitch, rng);
        break;
    }
  }

  _spawnSingle(x, radius, speed, pitch) {
    this.bullets.spawn(x, -10, 0, speed, radius, pitch);
  }

  _spawnSpread(x, radius, speed, pitch, velocity) {
    const count = 3 + Math.floor(velocity * 4);
    const totalAngle = Math.PI * 0.4;
    const startAngle = Math.PI / 2 - totalAngle / 2;

    for (let i = 0; i < count; i++) {
      const angle = startAngle + (totalAngle * i) / (count - 1 || 1);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      this.bullets.spawn(x, -10, vx, vy, radius * 0.8, pitch);
    }
  }

  _spawnRing(x, radius, speed, pitch, velocity, rng) {
    const count = 8 + Math.floor(velocity * 10);
    const y = -10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rng() * 0.3;
      const vx = Math.cos(angle) * speed * 0.8;
      const vy = Math.sin(angle) * speed * 0.8;
      this.bullets.spawn(x, y, vx, vy, radius * 0.6, pitch);
    }
  }

  _spawnAimed(x, radius, speed, pitch, playerX, playerY) {
    const angle = angleToward(x, -10, playerX, playerY);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    this.bullets.spawn(x, -10, vx, vy, radius, pitch, 0);
    const offset = 0.15;
    this.bullets.spawn(x, -10,
      Math.cos(angle + offset) * speed,
      Math.sin(angle + offset) * speed,
      radius * 0.7, pitch);
    this.bullets.spawn(x, -10,
      Math.cos(angle - offset) * speed,
      Math.sin(angle - offset) * speed,
      radius * 0.7, pitch);
  }

  _spawnStream(x, radius, speed, pitch, rng) {
    const waveMag = 1.5 + rng() * 2;
    this.bullets.spawn(x, -10, 0, speed, radius * 0.7, pitch, 1, 0, 0, 0, waveMag);
    this.bullets.spawn(x + 20, -10, 0, speed * 0.9, radius * 0.7, pitch, 1, 0, 0, 0, -waveMag);
  }

  _spawnSpiral(radius, speed, pitch, velocity) {
    const count = 3 + Math.floor(velocity * 3);
    const cx = gameBounds.width / 2;

    for (let i = 0; i < count; i++) {
      const angle = this.spiralAngle + (Math.PI * 2 * i) / count;
      const vx = Math.cos(angle) * speed * 0.7;
      const vy = Math.sin(angle) * speed * 0.7;
      this.bullets.spawn(cx, -10, vx, Math.abs(vy) + speed * 0.5, radius * 0.65, pitch, 0, 0.01);
    }
    this.spiralAngle += 0.5 + velocity * 0.3;
  }

  _spawnWave(x, radius, speed, pitch) {
    const waveMag = 2 + (pitch / 12) * 2;
    for (let i = 0; i < 3; i++) {
      this.bullets.spawn(
        x + (i - 1) * 25, -10,
        0, speed * 0.8,
        radius * 0.6, pitch,
        1, 0, 0, 0, waveMag * (i % 2 === 0 ? 1 : -1)
      );
    }
  }

  _spawnRain(radius, speed, pitch, rng) {
    const count = 2;
    for (let i = 0; i < count; i++) {
      const x = rng() * gameBounds.width;
      const vx = (rng() - 0.5) * 0.5;
      this.bullets.spawn(x, -10, vx, speed * 0.7, radius * 0.5, pitch);
    }
  }
}
