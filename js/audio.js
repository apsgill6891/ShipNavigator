// js/audio.js — Web Audio API Sound Engine

export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.engineGain = null;
    this.ambientGain = null;
    this.signalGain = null;
    this.engineNode = null;
    this.rainNode = null;
    this.seaNode = null;
    this.fogHornTimer = null;
    this.bellTimer = null;
    this.enabled = true;
  }

  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.4;
      this.engineGain.connect(this.masterGain);

      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.3;
      this.ambientGain.connect(this.masterGain);

      this.signalGain = this.ctx.createGain();
      this.signalGain.gain.value = 1.0;
      this.signalGain.connect(this.masterGain);

      this._startEngine(0);
      this._startSeaAmbient();
    } catch (e) {
      console.warn('AudioContext not available:', e);
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  // ── Engine Sound ────────────────────────────────────────────────────────────
  _startEngine(speedKnots) {
    if (!this.ctx) return;
    if (this.engineNode) { this.engineNode.stop(); this.engineNode = null; }

    const baseFreq = 40 + speedKnots * 4;

    // Low rumble with harmonics
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc3.type = 'square';
    osc1.frequency.value = baseFreq;
    osc2.frequency.value = baseFreq * 2.03;
    osc3.frequency.value = baseFreq * 0.5;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    filter.Q.value = 2;

    const gainNode = this.ctx.createGain();
    gainNode.gain.value = speedKnots > 0 ? 0.12 : 0.04;

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.engineGain);

    osc1.start();
    osc2.start();
    osc3.start();

    // store all three for stopping
    this._engineOscs = [osc1, osc2, osc3];
    this._engineGainNode = gainNode;
  }

  setEngineSpeed(knots) {
    if (!this.ctx || !this._engineOscs) return;
    const baseFreq = 40 + knots * 4;
    this._engineOscs[0].frequency.linearRampToValueAtTime(baseFreq, this.ctx.currentTime + 2);
    this._engineOscs[1].frequency.linearRampToValueAtTime(baseFreq * 2.03, this.ctx.currentTime + 2);
    this._engineOscs[2].frequency.linearRampToValueAtTime(baseFreq * 0.5, this.ctx.currentTime + 2);
    const vol = knots > 0 ? 0.12 : 0.04;
    this._engineGainNode.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 2);
  }

  // ── Sea Ambient ─────────────────────────────────────────────────────────────
  _startSeaAmbient() {
    if (!this.ctx) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;

    const gain = this.ctx.createGain();
    gain.gain.value = 0.06;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.seaNode = { source, gain };
  }

  // ── Rain Ambient ────────────────────────────────────────────────────────────
  startRain(intensity = 0.5) {
    if (!this.ctx || this.rainNode) return;
    const bufferSize = 2 * this.ctx.sampleRate;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 2000;

    const gain = this.ctx.createGain();
    gain.gain.value = intensity * 0.15;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.ambientGain);
    source.start();
    this.rainNode = { source, gain };
  }

  stopRain() {
    if (!this.rainNode) return;
    this.rainNode.source.stop();
    this.rainNode = null;
  }

  setRainIntensity(v) {
    if (this.rainNode) this.rainNode.gain.gain.value = v * 0.15;
  }

  // ── Navigation Sound Signals ────────────────────────────────────────────────
  // type: 'short'|'prolonged'|'bell'|'gong'|'whistle'
  _playTone(freq, duration, wave = 'sine', vol = 0.8) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.02);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime + duration - 0.05);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.signalGain);
    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration + 0.1);
  }

  playFogHorn(blasts = 1) {
    if (!this.ctx) return;
    let t = 0;
    for (let i = 0; i < blasts; i++) {
      setTimeout(() => this._playTone(110, 4.0, 'sawtooth', 0.9), t * 1000);
      t += 5;
    }
  }

  playShortBlast(count = 1) {
    if (!this.ctx) return;
    for (let i = 0; i < count; i++) {
      setTimeout(() => this._playTone(440, 0.8, 'sine', 0.7), i * 1200);
    }
  }

  playProlongedBlast() {
    this._playTone(220, 4.5, 'sawtooth', 0.8);
  }

  playBell() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
    osc.connect(gain);
    gain.connect(this.signalGain);
    osc.start(now);
    osc.stop(now + 2.6);
    // Bell overtone
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.value = 1760;
    gain2.gain.setValueAtTime(0.3, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    osc2.connect(gain2);
    gain2.connect(this.signalGain);
    osc2.start(now);
    osc2.stop(now + 1.6);
  }

  playGong() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 260;
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
    osc.connect(gain);
    gain.connect(this.signalGain);
    osc.start(now);
    osc.stop(now + 3.6);
  }

  playRapidBell(strokes = 8) {
    for (let i = 0; i < strokes; i++) {
      setTimeout(() => this.playBell(), i * 200);
    }
  }

  playDistressSignal() {
    // SOS in Morse: ... --- ...
    const morsePattern = [0.2,0.2, 0.2,0.2, 0.2,0.5, 0.6,0.2, 0.6,0.2, 0.6,0.5, 0.2,0.2, 0.2,0.2, 0.2];
    let t = 0;
    for (let i = 0; i < morsePattern.length; i += 2) {
      const start = t;
      const dur = morsePattern[i];
      setTimeout(() => this._playTone(600, dur, 'sine', 0.9), start * 1000);
      t += morsePattern[i] + (morsePattern[i + 1] || 0);
    }
  }

  // ── Automatic Fog Signals ───────────────────────────────────────────────────
  startFogSignal(vesselStatus = 'underway') {
    this.stopFogSignal();
    const interval = vesselStatus === 'stopped' ? 120000 : 120000; // 2 min
    const fn = () => {
      if (vesselStatus === 'underway') this.playProlongedBlast();
      else if (vesselStatus === 'stopped') { this.playProlongedBlast(); setTimeout(() => this.playProlongedBlast(), 2000); }
      else this.playBell();
    };
    fn();
    this.fogHornTimer = setInterval(fn, interval);
  }

  stopFogSignal() {
    if (this.fogHornTimer) { clearInterval(this.fogHornTimer); this.fogHornTimer = null; }
  }

  // ── Bell at anchor ──────────────────────────────────────────────────────────
  startAnchorBell() {
    this.stopAnchorBell();
    this.bellTimer = setInterval(() => this.playRapidBell(5), 60000);
    this.playRapidBell(5);
  }

  stopAnchorBell() {
    if (this.bellTimer) { clearInterval(this.bellTimer); this.bellTimer = null; }
  }

  // ── Volume ─────────────────────────────────────────────────────────────────
  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.masterGain) this.masterGain.gain.value = this.enabled ? 0.8 : 0;
  }
}
