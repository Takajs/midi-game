import { gameBounds } from './constants.js';

/**
 * Maps MIDI note numbers to screen X positions using the actual
 * note range of the loaded song (not the full 0-127 range).
 *
 * Uses a 7.5% margin on each side so bullets don't spawn at the
 * very edge of the screen, leaving room for visual effects.
 *
 * Call configure() once after parsing MIDI to set the range.
 * Call noteToX() everywhere you need a screen position from a MIDI note.
 */

let lo = 0;
let hi = 127;

export function configure(midiMin, midiMax) {
  lo = midiMin;
  hi = midiMax;
}

/**
 * Convert a MIDI note number to a screen X position.
 * The song's actual min note maps to the left margin,
 * the max note maps to the right margin.
 */
export function noteToX(midiNote) {
  const w = gameBounds.width;
  const margin = w * 0.075;
  const usable = w * 0.85;
  const t = hi > lo ? (midiNote - lo) / (hi - lo) : 0.5;
  return margin + t * usable;
}
