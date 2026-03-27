/**
 * Full-spectrum note coloring.
 *
 * Every MIDI note gets a unique color derived from:
 * - Pitch class (0-11) → hue position on the color wheel
 * - Octave (0-8) → saturation and lightness shift
 *
 * Result: a bass C is a deep, dark, saturated red.
 *         a treble C6 is a light, bright, pastel coral.
 *         Same hue family, completely different visual weight.
 *
 * Pre-computed lookup table for all 128 MIDI notes.
 */

// Hue anchors per pitch class (degrees, 0-360)
const PITCH_HUES = [
  0,    // C  - red
  30,   // C# - orange-red
  55,   // D  - amber
  90,   // D# - yellow-green
  130,  // E  - green
  165,  // F  - teal
  200,  // F# - cyan
  230,  // G  - blue
  260,  // G# - indigo
  290,  // A  - violet
  320,  // A# - magenta
  345,  // B  - rose
];

function hslToRgb(h, s, l) {
  h = h / 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255));
}

// Build lookup: midiNoteColor[midiNumber] = 0xRRGGBB
const midiNoteColorTable = new Uint32Array(128);

for (let midi = 0; midi < 128; midi++) {
  const pitch = midi % 12;
  const octave = Math.floor(midi / 12); // 0-10

  const hue = PITCH_HUES[pitch];

  // Octave shifts saturation and lightness:
  // Low octaves (0-2): deep, saturated, dark → "heavy" visual feel
  // Mid octaves (3-5): balanced, vivid
  // High octaves (6-9): light, pastel, bright → "airy" visual feel
  const octNorm = Math.min(octave / 9, 1); // 0 → 1

  const saturation = 0.95 - octNorm * 0.35;        // 0.95 → 0.60
  const lightness = 0.30 + octNorm * 0.35;          // 0.30 → 0.65

  midiNoteColorTable[midi] = hslToRgb(hue, saturation, lightness);
}

/**
 * Get the unique color for a MIDI note number (0-127).
 * Encodes pitch class as hue and octave as saturation/lightness.
 */
export function noteColor(midiNote) {
  return midiNoteColorTable[Math.min(127, Math.max(0, midiNote))];
}

/**
 * Get the hue-only color for a pitch class (for lane indicators etc.)
 * at a specific octave.
 */
export function pitchOctaveColor(pitch, octave) {
  return noteColor(pitch + octave * 12);
}

/**
 * The full lookup table (for direct indexing in hot loops).
 */
export { midiNoteColorTable };
