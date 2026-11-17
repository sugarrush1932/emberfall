// EMBERFALL - procedural WebAudio sounds. No assets, everything
// is synthesized, and every call is guarded so audio can never
// break the game (autoplay policies, missing devices, etc).

export function createAudio() {
  let ctx = null;
  let master = null;
  let hum = null;
  let humGain = null;
  let humFilter = null;
  let feverOn = false;

  function ensureContext() {
    try {
      if (ctx) return ctx;
      const AC = typeof window !== 'undefined'
        ? (window.AudioContext || window.webkitAudioContext)
        : null;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return ctx;
    } catch (err) {
      return null;
    }
  }

  function tone(opts) {
    try {
      if (!ctx || !master) return;
      const {
        freq = 440, endFreq = null, type = 'sine',
        dur = 0.15, vol = 0.2, delay = 0,
      } = opts;
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
      }
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (err) { /* ignore */ }
  }

  function noise(opts) {
    try {
      if (!ctx || !master) return;
      const { dur = 0.2, vol = 0.2, from = 2400, to = 300, delay = 0 } = opts;
      const t0 = ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(from, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch (err) { /* ignore */ }
  }

  function startHum() {
    try {
      if (!ctx || hum) return;
      humFilter = ctx.createBiquadFilter();
      humFilter.type = 'lowpass';
      humFilter.frequency.value = 220;
      humGain = ctx.createGain();
      humGain.gain.value = 0.018;
      const oscA = ctx.createOscillator();
      oscA.type = 'sine';
      oscA.frequency.value = 55;
      const oscB = ctx.createOscillator();
      oscB.type = 'triangle';
      oscB.frequency.value = 55.7;
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.13;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.006;
      lfo.connect(lfoGain);
      lfoGain.connect(humGain.gain);
      oscA.connect(humFilter);
      oscB.connect(humFilter);
      humFilter.connect(humGain);
      humGain.connect(master);
      oscA.start();
      oscB.start();
      lfo.start();
      hum = { oscA, oscB, lfo };
    } catch (err) { /* ignore */ }
  }

  function unlock() {
    try {
      const c = ensureContext();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      startHum();
    } catch (err) { /* ignore */ }
  }

  function pickup(combo) {
    const steps = Math.min(Math.max(combo || 1, 0), 12);
    const freq = 520 * Math.pow(2, steps / 12);
    tone({ freq, type: 'sine', dur: 0.14, vol: 0.22 });
    tone({ freq: freq * 2, type: 'sine', dur: 0.08, vol: 0.06 });
  }

  function dash() {
    noise({ dur: 0.22, vol: 0.24, from: 3200, to: 240 });
  }

  function hit() {
    tone({ freq: 160, endFreq: 50, type: 'sine', dur: 0.28, vol: 0.4 });
    noise({ dur: 0.08, vol: 0.18, from: 1800, to: 500 });
  }

  function feverStart() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    for (let i = 0; i < notes.length; i++) {
      tone({ freq: notes[i], type: 'triangle', dur: 0.22, vol: 0.2, delay: i * 0.07 });
    }
  }

  function feverEnd() {
    tone({ freq: 783.99, type: 'triangle', dur: 0.18, vol: 0.16 });
    tone({ freq: 523.25, type: 'triangle', dur: 0.26, vol: 0.16, delay: 0.1 });
  }

  function nearMiss() {
    tone({ freq: 1760, type: 'sine', dur: 0.06, vol: 0.1 });
  }

  function win() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    for (let i = 0; i < notes.length; i++) {
      tone({ freq: notes[i], type: 'triangle', dur: 0.34, vol: 0.2, delay: i * 0.11 });
    }
  }

  function lose() {
    const notes = [392, 329.63, 261.63, 196];
    for (let i = 0; i < notes.length; i++) {
      tone({ freq: notes[i], type: 'sine', dur: 0.42, vol: 0.2, delay: i * 0.22 });
    }
  }

  function setFever(on) {
    try {
      feverOn = !!on;
      if (!ctx || !humFilter || !humGain) return;
      const t = ctx.currentTime;
      humFilter.frequency.setTargetAtTime(feverOn ? 620 : 220, t, 0.2);
      humGain.gain.setTargetAtTime(feverOn ? 0.032 : 0.018, t, 0.2);
    } catch (err) { /* ignore */ }
  }

  return {
    unlock,
    pickup,
    dash,
    hit,
    feverStart,
    feverEnd,
    nearMiss,
    win,
    lose,
    setFever,
  };
}
