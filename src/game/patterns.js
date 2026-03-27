import { gameBounds, PATTERNS } from '../utils/constants.js';
import { angleToward, seededRandom } from '../utils/math.js';

/**
 * Bullet pattern spawner.
 *
 * Spawn position uses the full MIDI note number (0-127) mapped across
 * the screen width: bass notes spawn on the left, treble on the right.
 * This means when a violin and bass play the same pitch class in different
 * octaves, the bullets come from completely different screen positions.
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
    const { midi, velocity, pitch, octave, duration, track } = note;
    const w = gameBounds.width;

    const baseSpeed = 1.2 + velocity * 1.5 + octave * 0.15;
    const radius = Math.max(3, 7 - octave * 0.5 + velocity * 2);

    // Spawn X from full MIDI note number: bass (low midi) → left, treble (high) → right
    const spawnX = (midi / 127) * w * 0.85 + w * 0.075;

    const rng = seededRandom(midi * 31 + Math.floor(performance.now()));

    // Full note identity for every bullet
    const nv = velocity;
    const oc = octave;
    const dur = duration || 0.2;
    const tr = track;

    switch (pattern) {
      case PATTERNS.SINGLE:
        this._spawn(spawnX, 0, baseSpeed, radius, midi, nv, oc, dur, tr);
        break;
      case PATTERNS.SPREAD:
        this._spawnSpread(spawnX, radius, baseSpeed, midi, velocity, nv, oc, dur, tr);
        break;
      case PATTERNS.RING:
        this._spawnRing(spawnX, radius, baseSpeed, midi, velocity, rng, nv, oc, dur, tr);
        break;
      case PATTERNS.AIMED:
        this._spawnAimed(spawnX, radius, baseSpeed, midi, playerX, playerY, nv, oc, dur, tr);
        break;
      case PATTERNS.STREAM:
        this._spawnStream(spawnX, radius, baseSpeed, midi, rng, nv, oc, dur, tr);
        break;
      case PATTERNS.SPIRAL:
        this._spawnSpiral(radius, baseSpeed, midi, velocity, nv, oc, dur, tr);
        break;
      case PATTERNS.WAVE:
        this._spawnWave(spawnX, radius, baseSpeed, midi, nv, oc, dur, tr);
        break;
      case PATTERNS.RAIN:
        this._spawnRain(radius, baseSpeed, midi, rng, nv, oc, dur, tr);
        break;
    }
  }

  // spawn signature: (x, y, vx, vy, radius, midiNote, type, angVel, accelX, accelY, param, noteVel, octave, duration, track)

  _spawn(x, vx, speed, radius, mn, nv, oc, dur, tr) {
    this.bullets.spawn(x, -10, vx, speed, radius, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
  }

  _spawnSpread(x, radius, speed, mn, velocity, nv, oc, dur, tr) {
    const count = 3 + Math.floor(velocity * 4);
    const totalAngle = Math.PI * 0.4;
    const startAngle = Math.PI / 2 - totalAngle / 2;
    for (let i = 0; i < count; i++) {
      const angle = startAngle + (totalAngle * i) / (count - 1 || 1);
      this.bullets.spawn(x, -10, Math.cos(angle) * speed, Math.sin(angle) * speed,
        radius * 0.8, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
    }
  }

  _spawnRing(x, radius, speed, mn, velocity, rng, nv, oc, dur, tr) {
    const count = 8 + Math.floor(velocity * 10);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + rng() * 0.3;
      this.bullets.spawn(x, -10, Math.cos(angle) * speed * 0.8, Math.sin(angle) * speed * 0.8,
        radius * 0.6, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
    }
  }

  _spawnAimed(x, radius, speed, mn, playerX, playerY, nv, oc, dur, tr) {
    const angle = angleToward(x, -10, playerX, playerY);
    this.bullets.spawn(x, -10, Math.cos(angle) * speed, Math.sin(angle) * speed,
      radius, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
    const off = 0.15;
    this.bullets.spawn(x, -10, Math.cos(angle + off) * speed, Math.sin(angle + off) * speed,
      radius * 0.7, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
    this.bullets.spawn(x, -10, Math.cos(angle - off) * speed, Math.sin(angle - off) * speed,
      radius * 0.7, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
  }

  _spawnStream(x, radius, speed, mn, rng, nv, oc, dur, tr) {
    const waveMag = 1.5 + rng() * 2;
    this.bullets.spawn(x, -10, 0, speed, radius * 0.7, mn, 1, 0, 0, 0, waveMag, nv, oc, dur, tr);
    this.bullets.spawn(x + 20, -10, 0, speed * 0.9, radius * 0.7, mn, 1, 0, 0, 0, -waveMag, nv, oc, dur, tr);
  }

  _spawnSpiral(radius, speed, mn, velocity, nv, oc, dur, tr) {
    const count = 3 + Math.floor(velocity * 3);
    const cx = gameBounds.width / 2;
    for (let i = 0; i < count; i++) {
      const angle = this.spiralAngle + (Math.PI * 2 * i) / count;
      const vx = Math.cos(angle) * speed * 0.7;
      const vy = Math.sin(angle) * speed * 0.7;
      this.bullets.spawn(cx, -10, vx, Math.abs(vy) + speed * 0.5, radius * 0.65, mn, 0, 0.01, 0, 0, 0, nv, oc, dur, tr);
    }
    this.spiralAngle += 0.5 + velocity * 0.3;
  }

  _spawnWave(x, radius, speed, mn, nv, oc, dur, tr) {
    const pitch = mn % 12;
    const waveMag = 2 + (pitch / 12) * 2;
    for (let i = 0; i < 3; i++) {
      this.bullets.spawn(x + (i - 1) * 25, -10, 0, speed * 0.8, radius * 0.6, mn,
        1, 0, 0, 0, waveMag * (i % 2 === 0 ? 1 : -1), nv, oc, dur, tr);
    }
  }

  _spawnRain(radius, speed, mn, rng, nv, oc, dur, tr) {
    for (let i = 0; i < 2; i++) {
      const x = rng() * gameBounds.width;
      const vx = (rng() - 0.5) * 0.5;
      this.bullets.spawn(x, -10, vx, speed * 0.7, radius * 0.5, mn, 0, 0, 0, 0, 0, nv, oc, dur, tr);
    }
  }
}
