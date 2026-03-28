import { gameBounds } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';

/**
 * Pre-analyze entire MIDI during loading.
 * Produces a frame-by-frame "script" for boss position, intensity,
 * dominant color — zero computation during gameplay.
 *
 * Boss covers wide area of screen: X spans 10%–90%, Y spans 10%–50%.
 * Multiple sinusoidal frequencies create organic, unpredictable drift.
 */

const WINDOW = 0.1; // 100ms analysis windows

export function analyzeSong(events, duration, midiMin, midiMax, bpm) {
  const N = Math.ceil(duration / WINDOW) + 1;
  const w = gameBounds.width, h = gameBounds.height;

  // ─── Per-window stats ───
  const noteCounts   = new Float32Array(N);
  const pitchSum     = new Float32Array(N);
  const velSum       = new Float32Array(N);
  const pitchHist    = new Array(N);
  for (let i = 0; i < N; i++) pitchHist[i] = new Uint8Array(12);

  for (const e of events) {
    const wi = Math.min(Math.floor(e.time / WINDOW), N - 1);
    noteCounts[wi]++;
    pitchSum[wi] += e.midi;
    velSum[wi]   += e.velocity;
    pitchHist[wi][e.midi % 12]++;
  }

  // Normalize
  let maxDensity = 1;
  for (let i = 0; i < N; i++) if (noteCounts[i] > maxDensity) maxDensity = noteCounts[i];

  const density     = new Float32Array(N);
  const register    = new Float32Array(N);
  const dynamics    = new Float32Array(N);
  const domPitch    = new Uint8Array(N);
  const complexity  = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const nc = noteCounts[i];
    density[i]  = nc / maxDensity;
    register[i] = nc > 0 ? (pitchSum[i] / nc - midiMin) / (midiMax - midiMin || 1) : 0.5;
    dynamics[i] = nc > 0 ? velSum[i] / nc : 0;

    let maxPC = 0, bestPC = 0, uniquePC = 0;
    for (let p = 0; p < 12; p++) {
      if (pitchHist[i][p] > maxPC) { maxPC = pitchHist[i][p]; bestPC = p; }
      if (pitchHist[i][p] > 0) uniquePC++;
    }
    domPitch[i]   = bestPC;
    complexity[i] = uniquePC / 12;
  }

  // ─── Boss trajectory ───
  const bossX      = new Float32Array(N);
  const bossY      = new Float32Array(N);
  const bossRadius = new Float32Array(N);
  const bossColor  = new Uint32Array(N);
  const bossVoices = new Float32Array(N);

  const beatPeriod = 60 / (bpm || 120);

  for (let i = 0; i < N; i++) {
    const t = (i * WINDOW) / duration; // song progress 0→1
    const d = density[i];
    const reg = register[i];
    const dyn = dynamics[i];

    // X: wide lateral movement driven by register + multi-frequency drift
    // register maps bass→left, treble→right across 10%–90% of screen
    const regX = w * 0.1 + reg * w * 0.8;
    // Multiple sine waves at different frequencies for organic motion
    const drift1 = Math.sin(t * Math.PI * 8) * w * 0.1;
    const drift2 = Math.sin(t * Math.PI * 3.3 + 1.7) * w * 0.06;
    const drift3 = Math.cos(t * Math.PI * 13 + 0.5) * w * 0.03;
    bossX[i] = regX + drift1 + drift2 + drift3;

    // Y: 10%–50% of screen height, pushed down by intensity
    // Density and dynamics push boss deeper into playfield
    const baseY = h * 0.12;
    const intensityPush = d * h * 0.22 + dyn * h * 0.08;
    const yDrift1 = Math.sin(t * Math.PI * 5.5 + 2.1) * h * 0.06;
    const yDrift2 = Math.cos(t * Math.PI * 9.3) * h * 0.03;
    bossY[i] = baseY + intensityPush + yDrift1 + yDrift2;

    // Radius: base 55, grows with density and complexity
    bossRadius[i] = 55 + d * 25 + complexity[i] * 15;

    // Color: dominant pitch at the average octave
    const avgOct = Math.round(register[i] * 8);
    bossColor[i] = noteColor(domPitch[i] + avgOct * 12);

    // Voices: number of unique pitch classes (for mandala points)
    bossVoices[i] = Math.max(3, Math.round(complexity[i] * 12));
  }

  // Clamp boss position to screen bounds
  for (let i = 0; i < N; i++) {
    bossX[i] = Math.max(w * 0.08, Math.min(w * 0.92, bossX[i]));
    bossY[i] = Math.max(h * 0.08, Math.min(h * 0.52, bossY[i]));
  }

  // Smooth everything
  _smooth(bossX, 10);
  _smooth(bossY, 10);
  _smooth(bossRadius, 8);
  _smooth(density, 3);

  return {
    windowSize: WINDOW, windowCount: N,
    density, register, dynamics, complexity, domPitch,
    bossX, bossY, bossRadius, bossColor, bossVoices,
    bpm: bpm || 120,
  };
}

function _smooth(arr, radius) {
  const tmp = new Float32Array(arr.length);
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, cnt = 0;
    const lo = Math.max(0, i - radius), hi = Math.min(arr.length - 1, i + radius);
    for (let j = lo; j <= hi; j++) { sum += arr[j]; cnt++; }
    tmp[i] = sum / cnt;
  }
  arr.set(tmp);
}
