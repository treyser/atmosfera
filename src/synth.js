// Звуки без файлів: свист Маркуса і голоси предметів у Ребрах Велетня синтезуються просто в браузері.
// Кожен гравець грає їх у себе — синхронізує лише повідомлення «зіграй це».
import { MELODY, PITCH, OBJECTS } from "./melody.js";

let ctx = null;
let master = null;

export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // легка «печера»: коротке відлуння, щоб звуки не були сухими
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    master.connect(ctx.destination);
    master.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

// Чи браузер дозволив звук (до першого кліку в цьому вікні може не дозволити)
export const canPlay = () => audio()?.state === "running";

function noiseBuffer(c, seconds) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(c, g, t, a, peak, hold, r) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.setValueAtTime(peak, t + a + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + r);
}

// --- голоси ---

// Свист: чистий тон з вібрато, легким підтягуванням до ноти й подихом
function whistle(c, f, t, d) {
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(f * 0.965, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.06);
  const lfo = c.createOscillator();
  lfo.frequency.value = 5.4;
  const depth = c.createGain();
  depth.gain.setValueAtTime(0, t);
  depth.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.3, d * 0.6));
  lfo.connect(depth).connect(o.frequency);
  const g = c.createGain();
  env(c, g, t, 0.05, 0.5, Math.max(0.01, d - 0.12), 0.12);
  o.connect(g).connect(master);
  // подих
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, d + 0.2);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f * 2;
  bp.Q.value = 6;
  const ng = c.createGain();
  env(c, ng, t, 0.03, 0.05, Math.max(0.01, d - 0.1), 0.1);
  n.connect(bp).connect(ng).connect(master);
  for (const s of [o, lfo, n]) { s.start(t); s.stop(t + d + 0.3); }
}

// Дзвін: негармонічні обертони, довге згасання
function bell(c, f, t) {
  [[1, 0.5], [2.01, 0.22], [2.42, 0.18], [3.02, 0.12], [4.17, 0.08], [5.4, 0.05]].forEach(([k, a], i) => {
    const o = c.createOscillator();
    o.frequency.value = f * k;
    const g = c.createGain();
    env(c, g, t, 0.004, a, 0, 2.6 - i * 0.3);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 3);
  });
}

// Кістка: дерев'яно-кістяний стук, як ксилофон
function bone(c, f, t) {
  [[1, 0.55, 0.7], [3.98, 0.18, 0.18], [9.2, 0.06, 0.06]].forEach(([k, a, r]) => {
    const o = c.createOscillator();
    o.frequency.value = f * k;
    const g = c.createGain();
    env(c, g, t, 0.002, a, 0, r);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + r + 0.1);
  });
}

// Снасть: щипок натягнутої мотузки (Карплус — Стронг, порахований наперед)
function rope(c, f, t) {
  const len = 1.6;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * len), c.sampleRate);
  const d = buf.getChannelData(0);
  const period = Math.round(c.sampleRate / f);
  for (let i = 0; i < period; i++) d[i] = Math.random() * 2 - 1;
  for (let i = period + 1; i < d.length; i++) d[i] = 0.497 * (d[i - period] + d[i - period - 1]);
  const s = c.createBufferSource();
  s.buffer = buf;
  const g = c.createGain();
  g.gain.value = 0.7;
  s.connect(g).connect(master);
  s.start(t);
}

// Мушля: глухий порожнистий звук, повільний вступ, як подув у мушлю
function shell(c, f, t) {
  const o = c.createOscillator();
  o.type = "triangle";
  o.frequency.value = f;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = f * 2.2;
  const g = c.createGain();
  env(c, g, t, 0.18, 0.5, 0.35, 0.5);
  o.connect(lp).connect(g).connect(master);
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 1.3);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f;
  bp.Q.value = 3;
  const ng = c.createGain();
  env(c, ng, t, 0.2, 0.12, 0.3, 0.5);
  n.connect(bp).connect(ng).connect(master);
  o.start(t); o.stop(t + 1.2); n.start(t); n.stop(t + 1.2);
}

// Порожнє ребро: вітер, що співає в кістці, — як флейта
function wind(c, f, t) {
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f * 0.98, t);
  o.frequency.linearRampToValueAtTime(f, t + 0.25);
  const g = c.createGain();
  env(c, g, t, 0.25, 0.38, 0.4, 0.6);
  o.connect(g).connect(master);
  const n = c.createBufferSource();
  n.buffer = noiseBuffer(c, 1.6);
  const bp = c.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = f;
  bp.Q.value = 12;
  const ng = c.createGain();
  env(c, ng, t, 0.3, 0.3, 0.4, 0.6);
  n.connect(bp).connect(ng).connect(master);
  o.start(t); o.stop(t + 1.5); n.start(t); n.stop(t + 1.5);
}

const VOICES = { whistle, bell, bone, rope, shell, wind };

export function note(voice, pitch, when = 0, dur = 0.5) {
  const c = audio();
  if (!c) return;
  const f = PITCH[pitch] ?? pitch;
  (VOICES[voice] ?? whistle)(c, f, c.currentTime + 0.02 + when, dur);
}

// Звук предмета Ребер Велетня
export function objectSound(id) {
  const o = OBJECTS.find((x) => x.id === id);
  if (o) note(o.voice, o.note);
}

// Свист Маркуса: уся мелодія або вибрані ноти (номери з MELODY). Повертає тривалість у секундах.
export function whistleNotes(indexes = MELODY.map((_, i) => i), voiceOf = null) {
  let t = 0;
  for (const i of indexes) {
    const m = MELODY[i];
    note(voiceOf ? voiceOf(i) : "whistle", m.p, t, m.d);
    t += m.d + 0.06;
  }
  return t;
}

// Фальшива нота: глухий розлад
export function wrong() {
  const c = audio();
  if (!c) return;
  const t = c.currentTime + 0.02;
  for (const f of [146.8, 155.6]) {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const g = c.createGain();
    env(c, g, t, 0.01, 0.18, 0.15, 0.4);
    o.connect(lp).connect(g).connect(master);
    o.start(t); o.stop(t + 0.7);
  }
}
