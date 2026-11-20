// All of Marisol Heat's sound is synthesised with WebAudio: no audio files, no
// network, nothing to load. The context is only created after a user gesture
// (unlock), so the game is silent until the player first presses a key or taps,
// and screenshot mode — which never unlocks — stays silent by construction.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engine = null;
  let siren = null;

  function unlock() {
    if (ctx !== null) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }

  /** One short tone with a quick decay; the building block of every effect. */
  function tone(freq, dur, type, vol, slideTo) {
    if (ctx === null || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Filtered noise burst for punches and crashes. */
  function noise(dur, vol, freq) {
    if (ctx === null || muted) return;
    const t = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t);
  }

  function startEngine() {
    if (ctx === null || engine !== null) return;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 55;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    engine = { osc, filter, gain };
  }

  function startSiren() {
    if (ctx === null || siren !== null) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 700;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.9;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    lfo.start();
    siren = { osc, lfo, gain };
  }

  return {
    unlock,
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.03);
      return muted;
    },
    pickup() { tone(880, 0.09, 'square', 0.16); setTimeout(() => tone(1320, 0.12, 'square', 0.14), 45); },
    shell() { tone(1180, 0.1, 'sine', 0.18, 1560); },
    punch() { noise(0.09, 0.3, 900); tone(120, 0.08, 'sine', 0.22, 60); },
    crash(strength) { noise(0.22, Math.min(0.5, 0.18 + strength * 0.3), 700); tone(70, 0.2, 'sine', 0.25, 40); },
    crime() { tone(196, 0.16, 'square', 0.12); },
    phone() { tone(1560, 0.07, 'square', 0.1); setTimeout(() => tone(1560, 0.07, 'square', 0.1), 110); },
    success() {
      tone(660, 0.12, 'square', 0.14);
      setTimeout(() => tone(880, 0.12, 'square', 0.14), 100);
      setTimeout(() => tone(1100, 0.22, 'square', 0.15), 200);
    },
    fail() { tone(320, 0.16, 'square', 0.13, 210); },
    busted() { tone(520, 0.14, 'square', 0.14, 380); setTimeout(() => tone(300, 0.3, 'square', 0.14, 190), 130); },
    wasted() { tone(392, 0.5, 'sine', 0.18, 98); },
    door() { tone(240, 0.06, 'square', 0.1, 180); },
    /** driving: whether the engine loop should sound, and how hard (0..1). wanted: siren on/off. */
    setLoops(driving, speedRatio, wanted) {
      if (ctx === null) return;
      if (driving) {
        startEngine();
        if (engine) {
          const t = ctx.currentTime;
          engine.osc.frequency.setTargetAtTime(52 + speedRatio * 130, t, 0.08);
          engine.filter.frequency.setTargetAtTime(280 + speedRatio * 700, t, 0.1);
          engine.gain.gain.setTargetAtTime(muted ? 0 : 0.05 + speedRatio * 0.06, t, 0.1);
        }
      } else if (engine) {
        engine.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      }
      if (wanted) {
        startSiren();
        if (siren) siren.gain.gain.setTargetAtTime(muted ? 0 : 0.028, ctx.currentTime, 0.2);
      } else if (siren) {
        siren.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      }
    },
  };
}
