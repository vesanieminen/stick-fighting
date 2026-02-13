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
};
