/**
 * Vivid full-spectrum note coloring.
 *
 * Pitch class → hue, Octave → saturation + lightness.
 * Boosted saturation and wider lightness range for maximum
 * visual distinction even on a dark background.
 */

const PITCH_HUES = [
  0, 30, 55, 90, 130, 165, 200, 230, 260, 290, 320, 345,
];

function hslToRgb(h, s, l) {
  h /= 360;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return ((Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255));
}

const midiNoteColorTable = new Uint32Array(128);

for (let midi = 0; midi < 128; midi++) {
  const pitch = midi % 12;
  const octave = Math.floor(midi / 12);
  const hue = PITCH_HUES[pitch];
  const octNorm = Math.min(octave / 9, 1);
  const saturation = 1.0 - octNorm * 0.25;   // 1.0 → 0.75 (vivid across all octaves)
  const lightness  = 0.42 + octNorm * 0.30;   // 0.42 → 0.72 (visible even for bass)
  midiNoteColorTable[midi] = hslToRgb(hue, saturation, lightness);
}

export function noteColor(midiNote) {
  return midiNoteColorTable[Math.min(127, Math.max(0, midiNote))];
}

export function pitchOctaveColor(pitch, octave) {
  return noteColor(pitch + octave * 12);
}

export { midiNoteColorTable };
