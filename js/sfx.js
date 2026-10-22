// v3.1.0 sound effects: tiny WebAudio synth (no audio files, works offline). On by default, mute is remembered.
// iOS only plays sound after a tap, so the context is unlocked on the first pointer event.
import { prefs } from './store.js';

let ctx = null, master = null;
export const muted = () => !!prefs.get('mute', false);
export function setMuted(v) { prefs.set('mute', !!v); if (master) master.gain.value = v ? 0 : 0.5; }

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = muted() ? 0 : 0.5; master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
window.addEventListener('pointerdown', () => { try { ac(); } catch { /* no audio */ } }, { once: true, capture: true });

/** one tone: freq (Hz) or [from, to] glide, duration s, wave, volume, delay s */
function tone(f, d = 0.12, type = 'sine', vol = 0.3, delay = 0) {
  const c = ac(); if (!c || muted()) return;
  const t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  if (Array.isArray(f)) { o.frequency.setValueAtTime(f[0], t); o.frequency.exponentialRampToValueAtTime(f[1], t + d); } else o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d = 0.15, vol = 0.2, delay = 0, hp = 1200) {
  const c = ac(); if (!c || muted()) return;
  const t = c.currentTime + delay, len = Math.floor(c.sampleRate * d), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(t);
}

const safe = (fn) => (...a) => { try { fn(...a); } catch { /* sound is decoration */ } };
export const sfx = {
  hit: safe((combo = 0) => { const up = Math.min(combo, 8) * 40; noise(0.08, 0.18, 0, 2500); tone([520 + up, 880 + up], 0.12, 'triangle', 0.28); }),
  crit: safe(() => { noise(0.12, 0.22, 0, 1800); tone([660, 1320], 0.18, 'square', 0.16); tone(1760, 0.14, 'triangle', 0.18, 0.08); }),
  miss: safe(() => { tone([220, 110], 0.22, 'sawtooth', 0.14); }),
  shield: safe(() => { tone(880, 0.08, 'triangle', 0.22); tone(1175, 0.18, 'triangle', 0.22, 0.07); }),
  seal: safe(() => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'triangle', 0.24, i * 0.08)); noise(0.3, 0.1, 0.3, 4000); }),
  round: safe((stars = 0) => { [392, 523, 659, 784].slice(0, 2 + Math.min(stars, 2)).forEach((f, i) => tone(f, 0.22, 'square', 0.12, i * 0.11)); }),
  star: safe((i = 0) => { tone(1047 + i * 220, 0.16, 'triangle', 0.22); }),
  chest: safe((rarity = 'common') => {
    noise(0.25, 0.12, 0, 600);
    const notes = rarity === 'epic' ? [523, 659, 784, 1047, 1319, 1568] : rarity === 'rare' ? [523, 659, 784, 1047] : [523, 784];
    notes.forEach((f, i) => tone(f, 0.26, 'triangle', 0.22, 0.2 + i * 0.09));
  }),
  tap: safe(() => { tone(660, 0.05, 'sine', 0.12); }),
};
