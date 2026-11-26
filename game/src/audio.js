// All sound is synthesised with WebAudio: an engine drone that follows the throttle, wind
// that follows airspeed, and short chimes for rings, warnings and landings. No audio files.
// The context starts on the first user gesture; M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      context = new (window.AudioContext || window.webkitAudioContext)();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      windSource = context.createBufferSource();
      windSource.buffer = buffer;
      windSource.loop = true;
      windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 600;
      windGain = context.createGain();
      windGain.gain.value = 0;
      windSource.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(master);
      windSource.start();
    } catch {
      context = null;
    }
  }

  function blip(frequency, seconds, type, volume) {
    if (!context || muted) return;
    try {
      const osc = context.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = frequency;
      const gain = context.createGain();
      gain.gain.setValueAtTime(volume || 0.25, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(context.currentTime + seconds);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    start,
    toggleMute() {
      muted = !muted;
      if (master && context) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() {
      return muted;
    },
    /** Called every frame with the plane's state; the drone and wind follow it. */
    update(throttle, speedKts, airborne) {
      if (!context || muted) return;
      try {
        const now = context.currentTime;
        engineOsc.frequency.setTargetAtTime(55 + throttle * 75, now, 0.1);
        engineGain.gain.setTargetAtTime(airborne ? 0.05 + throttle * 0.09 : 0, now, 0.1);
        windGain.gain.setTargetAtTime(Math.min(0.16, speedKts / 900), now, 0.2);
        windFilter.frequency.setTargetAtTime(400 + speedKts * 4, now, 0.2);
      } catch {
        // Ignore audio errors mid-flight.
      }
    },
    ring() {
      blip(880, 0.35, 'sine', 0.3);
      setTimeout(() => blip(1318, 0.4, 'sine', 0.22), 90);
    },
    warning() {
      blip(220, 0.18, 'square', 0.12);
    },
    crash() {
      blip(90, 0.7, 'sawtooth', 0.3);
    },
    land() {
      blip(523, 0.25, 'sine', 0.28);
      setTimeout(() => blip(659, 0.25, 'sine', 0.28), 140);
      setTimeout(() => blip(784, 0.5, 'sine', 0.28), 280);
    },
  };
}
