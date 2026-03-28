import { Graphics, Container } from 'pixi.js';
import { gameBounds } from '../utils/constants.js';
import { noteColor } from '../utils/noteColor.js';
import { noteToX } from '../utils/noteRange.js';

const BAR_HEIGHT = 4;
const FADE_SPEED = 0.91;

/**
 * Full-spectrum note lane indicator.
 *
 * A continuous bar across the top of the screen representing the entire
 * MIDI pitch range (0-127). Bass notes glow on the left, treble on the right.
 * Each glow uses the note's unique color (pitch + octave).
 *
 * When a violin plays C6 (midi 84), the right side glows with a bright pastel red.
 * When a bass plays C2 (midi 36), the left side glows with a deep dark red.
 * Immediately visually distinct.
 *
 * Implemented as a ring buffer of recent note events that fade out,
 * rendered as soft gaussian-ish blobs on the bar.
 */
export class NoteLanes {
  constructor() {
    this.container = new Container();
    this.container.zIndex = 90;

    this.gfx = new Graphics();
    this.container.addChild(this.gfx);

    // Active glows: array of { midiNote, velocity, intensity }
    // We use 128 bins (one per MIDI note) for O(1) triggering
    this.intensity = new Float32Array(128);
  }

  /**
   * Trigger a glow at the position of a specific MIDI note.
   */
  trigger(midiNote, velocity) {
    const n = Math.min(127, Math.max(0, midiNote));
    this.intensity[n] = Math.min(1, this.intensity[n] + 0.35 + velocity * 0.5);
  }

  update(dt) {
    for (let i = 0; i < 128; i++) {
      this.intensity[i] *= Math.pow(FADE_SPEED, dt);
      if (this.intensity[i] < 0.002) this.intensity[i] = 0;
    }
  }

  render() {
    this.gfx.clear();
    const w = gameBounds.width;

    // Dim baseline bar
    this.gfx.rect(0, 0, w, BAR_HEIGHT);
    this.gfx.fill({ color: 0x111122, alpha: 0.4 });

    // Render active note glows as soft blobs
    for (let i = 0; i < 128; i++) {
      if (this.intensity[i] < 0.005) continue;

      const intensity = this.intensity[i];
      const color = noteColor(i);
      const cx = noteToX(i); // Same mapping as spawn positions
      const blobW = w / 30; // Width of each glow blob

      // Main glow on the bar
      this.gfx.rect(cx - blobW / 2, 0, blobW, BAR_HEIGHT);
      this.gfx.fill({ color, alpha: intensity * 0.8 });

      // Soft downward light beam
      const beamH = 6 + intensity * 20;
      for (let s = 0; s < 3; s++) {
        const t = s / 3;
        const alpha = intensity * 0.1 * (1 - t);
        const segW = blobW * (1 - t * 0.3);
        this.gfx.rect(cx - segW / 2, BAR_HEIGHT + t * beamH, segW, beamH / 3);
        this.gfx.fill({ color, alpha });
      }
    }
  }
}
