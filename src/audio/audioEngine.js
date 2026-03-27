import * as Tone from 'tone';

/**
 * Handles MIDI playback using Tone.js synthesizers.
 * Pre-schedules all notes for gapless, accurate playback.
 */
export class AudioEngine {
  constructor() {
    this.synths = [];
    this.isPlaying = false;
    this.startTime = 0;
    this.scheduledEvents = [];
  }

  async init() {
    // Don't call Tone.start() here — it requires a user gesture.
    // We'll start it lazily on the first loadSong call.
    Tone.getTransport().bpm.value = 120;
    this._started = false;
  }

  async _ensureStarted() {
    if (this._started) return;
    await Tone.start();
    this._started = true;
  }

  /**
   * Pre-schedule all MIDI events for playback.
   */
  async loadSong(midiData) {
    await this._ensureStarted();
    this.stop();
    this.dispose();

    // Create synths per track (up to 16)
    const trackCount = Math.min(midiData.trackCount, 16);
    for (let i = 0; i < trackCount; i++) {
      const synth = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 32,
        voice: Tone.Synth,
        options: {
          oscillator: { type: 'triangle8' },
          envelope: {
            attack: 0.02,
            decay: 0.3,
            sustain: 0.4,
            release: 0.8,
          },
          volume: -12,
        },
      }).toDestination();

      this.synths.push(synth);
    }

    // Schedule all notes on the Transport
    const transport = Tone.getTransport();
    transport.cancel();

    for (const event of midiData.events) {
      const synthIdx = Math.min(event.track, this.synths.length - 1);
      const synth = this.synths[synthIdx];
      if (!synth) continue;

      const id = transport.schedule((time) => {
        const dur = Math.max(event.duration, 0.05);
        const vel = Math.max(event.velocity * 0.7, 0.05);
        try {
          synth.triggerAttackRelease(
            Tone.Frequency(event.midi, 'midi').toFrequency(),
            dur,
            time,
            vel
          );
        } catch {
          // Ignore notes that fail (e.g., too many simultaneous)
        }
      }, event.time);

      this.scheduledEvents.push(id);
    }
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.startTime = Tone.now();
    Tone.getTransport().start('+0.05');
  }

  stop() {
    this.isPlaying = false;
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
  }

  pause() {
    this.isPlaying = false;
    Tone.getTransport().pause();
  }

  getCurrentTime() {
    if (!this.isPlaying) return 0;
    return Tone.getTransport().seconds;
  }

  dispose() {
    const transport = Tone.getTransport();
    for (const id of this.scheduledEvents) {
      transport.clear(id);
    }
    this.scheduledEvents = [];
    for (const synth of this.synths) {
      synth.dispose();
    }
    this.synths = [];
  }
}
