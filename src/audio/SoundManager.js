// Synthesized sound effects using the Web Audio API.
// No audio files needed — all sounds are generated procedurally.

let ctx = null;

function getContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
  return ctx;
}

function playTone(frequency, duration, type = 'square', volume = 0.15, decay = true) {
  const ac = getContext();
  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;

  if (decay) {
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
  }

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(ac.currentTime);
  osc.stop(ac.currentTime + duration);
}

function playNoise(duration, volume = 0.1) {
  const ac = getContext();
  const bufferSize = ac.sampleRate * duration;
  const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1);
  }

  const source = ac.createBufferSource();
  source.buffer = buffer;

  const gain = ac.createGain();
  gain.gain.value = volume;
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);

  // Bandpass filter for shaped noise
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1000;
  filter.Q.value = 0.5;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ac.destination);
  source.start(ac.currentTime);
}

export const SoundManager = {
  punch() {
    playTone(200, 0.08, 'square', 0.12);
    playNoise(0.06, 0.1);
  },

  kick() {
    playTone(140, 0.12, 'square', 0.15);
    playNoise(0.1, 0.12);
    // Lower thump
    playTone(80, 0.1, 'sine', 0.2);
  },

  special() {
    const ac = getContext();
    // Rising sweep
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 150;
    osc.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.2);
    gain.gain.value = 0.12;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.3);
    playNoise(0.15, 0.1);
  },

  block() {
    playTone(400, 0.06, 'triangle', 0.08);
    playTone(300, 0.08, 'triangle', 0.06);
  },

  hit() {
    playTone(160, 0.1, 'square', 0.15);
    playNoise(0.08, 0.15);
    playTone(60, 0.15, 'sine', 0.2);
  },

  ko() {
    // Dramatic descending tone
    const ac = getContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 400;
    osc.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 0.8);
    gain.gain.value = 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.8);

    playNoise(0.4, 0.12);
  },

  roundStart() {
    // Two short beeps then a higher beep
    playTone(440, 0.1, 'square', 0.08);
    setTimeout(() => playTone(440, 0.1, 'square', 0.08), 200);
    setTimeout(() => playTone(880, 0.2, 'square', 0.1), 400);
  },

  menuSelect() {
    playTone(660, 0.08, 'square', 0.08);
    setTimeout(() => playTone(880, 0.1, 'square', 0.1), 60);
  },

  victory() {
    // Ascending fanfare
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => playTone(freq, 0.2, 'square', 0.1), i * 150);
    });
  },

  jump() {
    const ac = getContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 250;
    osc.frequency.exponentialRampToValueAtTime(500, ac.currentTime + 0.1);
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.12);
  },

  land() {
    playTone(80, 0.06, 'sine', 0.08);
  },

  whoosh() {
    playNoise(0.1, 0.04);
  },

  boom() {
    const ac = getContext();
    // Deep explosion
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 60;
    osc.frequency.exponentialRampToValueAtTime(20, ac.currentTime + 0.4);
    gain.gain.value = 0.25;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.4);
    playNoise(0.3, 0.18);
  },

  warp() {
    const ac = getContext();
    // Quick pitch-shift warp
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sine';
    osc.frequency.value = 800;
    osc.frequency.exponentialRampToValueAtTime(100, ac.currentTime + 0.15);
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.15);
    // Reappear
    setTimeout(() => {
      const osc2 = ac.createOscillator();
      const gain2 = ac.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = 100;
      osc2.frequency.exponentialRampToValueAtTime(600, ac.currentTime + 0.1);
      gain2.gain.value = 0.1;
      gain2.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.12);
      osc2.connect(gain2);
      gain2.connect(ac.destination);
      osc2.start(ac.currentTime);
      osc2.stop(ac.currentTime + 0.12);
    }, 100);
  },

  electric() {
    const ac = getContext();
    // Crackling electric sound
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = 'square';
        osc.frequency.value = 800 + Math.random() * 1200;
        gain.gain.value = 0.06;
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(ac.currentTime);
        osc.stop(ac.currentTime + 0.05);
      }, i * 30);
    }
    playNoise(0.12, 0.08);
  },

  heavyImpact() {
    playTone(50, 0.2, 'sine', 0.25);
    playTone(100, 0.15, 'square', 0.12);
    playNoise(0.12, 0.15);
  },

  iceSlide() {
    const ac = getContext();
    // Crystalline sliding sound
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 1200;
    osc.frequency.exponentialRampToValueAtTime(400, ac.currentTime + 0.2);
    gain.gain.value = 0.06;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.25);
    playNoise(0.15, 0.04);
  },

  flurryHit() {
    playTone(300 + Math.random() * 200, 0.04, 'square', 0.08);
    playNoise(0.03, 0.06);
  },

  risingAttack() {
    const ac = getContext();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = 200;
    osc.frequency.exponentialRampToValueAtTime(800, ac.currentTime + 0.15);
    gain.gain.value = 0.1;
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.2);
  },
};
