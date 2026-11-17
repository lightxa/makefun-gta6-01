// Solmar Bay sound: every sound is synthesized live with WebAudio.
// No audio files exist anywhere in the game; the music is a small
// bass-and-keys loop scheduled ahead of time, and effects are short
// oscillator and noise bursts. Nothing here touches the network.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.musicTimer = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.step = 0;
  }

  // Browsers only allow audio after a user gesture; call from the first
  // key or click and everything after it just works.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startMusic();
    this.startEngine();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, vol, lowpass) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = vol || 0.25;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass || 1200;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  }

  click() { this.tone(660, 0.07, 'square', 0.12); }
  pickup() { this.tone(880, 0.12, 'sine', 0.2); this.tone(1320, 0.18, 'sine', 0.16); }
  punch() { this.noise(0.09, 0.3, 700); this.tone(140, 0.1, 'sine', 0.25, 60); }
  gunshot() { this.noise(0.16, 0.5, 2600); this.tone(220, 0.08, 'square', 0.2, 55); }
  crash() { this.noise(0.3, 0.45, 500); this.tone(90, 0.25, 'sawtooth', 0.2, 40); }
  carDoor() { this.tone(320, 0.08, 'square', 0.14, 180); }
  horn() { this.tone(370, 0.22, 'square', 0.16); this.tone(466, 0.22, 'square', 0.12); }
  missionDone() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => this.tone(n, 0.22, 'triangle', 0.22), i * 110));
  }
  missionFail() {
    [392, 330, 262].forEach((n, i) => setTimeout(() => this.tone(n, 0.3, 'sawtooth', 0.14), i * 160));
  }
  busted() { this.tone(220, 0.7, 'sawtooth', 0.2, 110); }

  // A looping two-tone police siren that fades in with the wanted level.
  setSiren(level) {
    if (!this.ctx) return;
    if (level <= 0) {
      if (this.sirenGain) this.sirenGain.gain.value = 0;
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      let hi = false;
      setInterval(() => {
        if (this.sirenOsc && this.sirenGain && this.sirenGain.gain.value > 0.005) {
          hi = !hi;
          this.sirenOsc.frequency.setTargetAtTime(hi ? 950 : 650, this.ctx.currentTime, 0.05);
        }
      }, 420);
    }
    this.sirenGain.gain.setTargetAtTime(Math.min(0.05, 0.015 * level), this.ctx.currentTime, 0.4);
  }

  // Engine hum: pitch follows the player's speed.
  startEngine() {
    if (!this.ctx || this.engineOsc) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(f); f.connect(this.engineGain); this.engineGain.connect(this.master);
    this.engineOsc.start();
  }

  setEngine(speedFrac, inCar) {
    if (!this.engineOsc || !this.engineGain) return;
    const target = inCar ? 0.05 + 0.06 * speedFrac : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + 130 * speedFrac, this.ctx.currentTime, 0.1);
  }

  // A lazy sunset groove: a 8-step bass line with a soft key stab.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [110, 0, 110, 0, 131, 0, 98, 0];
    const keys = [330, 0, 0, 392, 0, 0, 294, 0];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const b = bass[this.step % 8];
      const k = keys[this.step % 8];
      if (b) this.tone(b, 0.24, 'triangle', 0.12);
      if (k) this.tone(k, 0.3, 'sine', 0.06);
      this.step++;
    }, 300);
  }
}
