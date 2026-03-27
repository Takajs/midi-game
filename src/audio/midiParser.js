import { Midi } from '@tonejs/midi';

/**
 * Parse a MIDI file and extract note events with timing info.
 * Returns a flat sorted array of note events.
 */
export function parseMidi(arrayBuffer) {
  const midi = new Midi(arrayBuffer);

  const events = [];
  const trackCount = midi.tracks.length;

  for (let trackIdx = 0; trackIdx < trackCount; trackIdx++) {
    const track = midi.tracks[trackIdx];
    for (const note of track.notes) {
      events.push({
        time: note.time,          // seconds
        duration: note.duration,  // seconds
        midi: note.midi,          // MIDI note number 0-127
        velocity: note.velocity,  // 0-1
        pitch: note.midi % 12,    // pitch class 0-11
        octave: Math.floor(note.midi / 12) - 1,
        track: trackIdx,
        channel: track.channel,
        name: note.name,
      });
    }
  }

  // Sort by time
  events.sort((a, b) => a.time - b.time);

  return {
    events,
    duration: midi.duration,
    name: midi.name || 'Untitled',
    bpm: midi.header.tempos.length > 0 ? midi.header.tempos[0].bpm : 120,
    trackCount,
    totalNotes: events.length,
  };
}
