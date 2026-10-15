// Таємні звуки для уважних: синтезуються в браузері гравця, без файлів.
// Напрямок — стерео: ліворуч / праворуч; «позаду» і «знизу» — приглушено й тихіше.
let ctx = null;
let out = null;

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export const SOUNDS = [
  { k: "steps",   name: "Кроки",        icon: "👣", hear: "Чиїсь обережні кроки" },
  { k: "creak",   name: "Скрип",        icon: "🪵", hear: "Протяжний скрип дощок" },
  { k: "whisper", name: "Шепіт",        icon: "🗣", hear: "Ледь чутний шепіт" },
  { k: "knock",   name: "Стукіт",       icon: "✊", hear: "Глухий стукіт" },
  { k: "splash",  name: "Плюскіт",      icon: "💧", hear: "Плюскіт води, ніби щось пірнуло" },
  { k: "metal",   name: "Дзенькіт",     icon: "🗡", hear: "Тихий дзенькіт металу" },
  { k: "growl",   name: "Гарчання",     icon: "🐺", hear: "Низьке гарчання" },
  { k: "breath",  name: "Подих",        icon: "💨", hear: "Чийсь подих зовсім поруч" },
];

export const DIRS = [
  { k: "left",  name: "Ліворуч", say: "ліворуч від вас" },
  { k: "front", name: "Попереду", say: "десь попереду" },
  { k: "right", name: "Праворуч", say: "праворуч від вас" },
  { k: "back",  name: "Позаду",  say: "за вашою спиною" },
  { k: "below", name: "Знизу",   say: "десь унизу, під ногами" },
];

export const soundOf = (k) => SOUNDS.find((s) => s.k === k) ?? SOUNDS[0];
export const dirOf = (k) => DIRS.find((d) => d.k === k) ?? DIRS[1];

function noise(c, sec) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * sec), c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource();
  s.buffer = b;
  return s;
}

function env(g, t, a, peak, r) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + r);
}

function filt(c, type, f, q = 1) {
  const x = c.createBiquadFilter();
  x.type = type;
  x.frequency.value = f;
  x.Q.value = q;
  return x;
}

// --- голоси ---

function thump(c, dst, t, low, vol) {
  const n = noise(c, 0.3);
  const lp = filt(c, "lowpass", low);
  const g = c.createGain();
  env(g, t, 0.008, vol, 0.18);
  n.connect(lp).connect(g).connect(dst);
  const o = c.createOscillator();
  o.frequency.setValueAtTime(90, t);
  o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
  const og = c.createGain();
  env(og, t, 0.005, vol * 0.8, 0.16);
  o.connect(og).connect(dst);
  n.start(t); n.stop(t + 0.3); o.start(t); o.stop(t + 0.3);
}

const VOICE = {
  steps(c, dst, t) {
    let at = t;
    for (let i = 0; i < 5; i++) {
      thump(c, dst, at, 500 + Math.random() * 250, 0.5 + Math.random() * 0.15);
      at += 0.48 + Math.random() * 0.12;
    }
    return at + 0.4;
  },
  creak(c, dst, t) {
    const d = 1.4;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(150, t + d * 0.55);
    o.frequency.linearRampToValueAtTime(120, t + d);
    // нерівність тертя — швидке «зубчасте» тремтіння гучності
    const am = c.createOscillator();
    am.type = "square";
    am.frequency.setValueAtTime(28, t);
    am.frequency.linearRampToValueAtTime(40, t + d);
    const amg = c.createGain();
    amg.gain.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.2);
    g.gain.setValueAtTime(0.28, t + d - 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    am.connect(amg).connect(g.gain);
    const bp = filt(c, "bandpass", 900, 3);
    o.connect(bp).connect(g).connect(dst);
    o.start(t); o.stop(t + d); am.start(t); am.stop(t + d);
    return t + d + 0.2;
  },
  whisper(c, dst, t) {
    let at = t;
    for (let i = 0; i < 7; i++) {
      const len = 0.09 + Math.random() * 0.18;
      const n = noise(c, len + 0.1);
      const bp = filt(c, "bandpass", 2400 + Math.random() * 2600, 1.4);
      const g = c.createGain();
      env(g, at, len * 0.35, 0.22 + Math.random() * 0.12, len * 0.8);
      n.connect(bp).connect(g).connect(dst);
      n.start(at); n.stop(at + len + 0.1);
      at += len + (Math.random() < 0.3 ? 0.22 : 0.05);
    }
    return at + 0.3;
  },
  knock(c, dst, t) {
    const times = [0, 0.32, 0.64];
    for (const dt of times) {
      const at = t + dt;
      const n = noise(c, 0.12);
      const bp = filt(c, "bandpass", 700, 2);
      const g = c.createGain();
      env(g, at, 0.003, 0.7, 0.09);
      n.connect(bp).connect(g).connect(dst);
      const o = c.createOscillator();
      o.frequency.value = 160;
      const og = c.createGain();
      env(og, at, 0.003, 0.45, 0.12);
      o.connect(og).connect(dst);
      n.start(at); n.stop(at + 0.15); o.start(at); o.stop(at + 0.15);
    }
    return t + 1.1;
  },
  splash(c, dst, t) {
    const n = noise(c, 1.0);
    const hp = filt(c, "highpass", 700);
    const lp = filt(c, "lowpass", 5000);
    const g = c.createGain();
    env(g, t, 0.02, 0.45, 0.7);
    n.connect(hp).connect(lp).connect(g).connect(dst);
    n.start(t); n.stop(t + 1.0);
    // краплі
    for (let i = 0; i < 4; i++) {
      const at = t + 0.35 + i * 0.17 + Math.random() * 0.1;
      const o = c.createOscillator();
      o.frequency.setValueAtTime(900 + Math.random() * 500, at);
      o.frequency.exponentialRampToValueAtTime(2200 + Math.random() * 800, at + 0.05);
      const og = c.createGain();
      env(og, at, 0.004, 0.18, 0.06);
      o.connect(og).connect(dst);
      o.start(at); o.stop(at + 0.1);
    }
    return t + 1.3;
  },
  metal(c, dst, t) {
    for (const [f, a, r] of [[1180, 0.22, 1.1], [1730, 0.16, 0.8], [2690, 0.12, 0.6], [3970, 0.08, 0.4]]) {
      const o = c.createOscillator();
      o.frequency.value = f * (0.99 + Math.random() * 0.02);
      const g = c.createGain();
      env(g, t, 0.002, a, r);
      o.connect(g).connect(dst);
      o.start(t); o.stop(t + r + 0.1);
    }
    return t + 1.3;
  },
  growl(c, dst, t) {
    const d = 1.8;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(62, t);
    o.frequency.linearRampToValueAtTime(70, t + d * 0.6);
    o.frequency.linearRampToValueAtTime(55, t + d);
    const am = c.createOscillator();
    am.frequency.value = 23;
    const amg = c.createGain();
    amg.gain.value = 0.35;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.35);
    g.gain.setValueAtTime(0.5, t + d - 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    am.connect(amg).connect(g.gain);
    const lp = filt(c, "lowpass", 380, 2);
    o.connect(lp).connect(g).connect(dst);
    const n = noise(c, d);
    const nb = filt(c, "bandpass", 250, 1);
    const ng = c.createGain();
    env(ng, t, 0.3, 0.12, d - 0.3);
    n.connect(nb).connect(ng).connect(dst);
    for (const s of [o, am, n]) { s.start(t); s.stop(t + d); }
    return t + d + 0.2;
  },
  breath(c, dst, t) {
    let at = t;
    for (const [len, f, v] of [[0.9, 900, 0.25], [1.1, 650, 0.3]]) {
      const n = noise(c, len + 0.1);
      const bp = filt(c, "bandpass", f, 0.8);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(v, at + len * 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      n.connect(bp).connect(g).connect(dst);
      n.start(at); n.stop(at + len + 0.1);
      at += len + 0.25;
    }
    return at;
  },
};

// Зіграти звук з напрямку; повертає тривалість у секундах
export function playSecret(k, dir = "front", volume = 1) {
  const c = audio();
  if (!c) return 0;
  const t = c.currentTime + 0.05;
  const g = c.createGain();
  let node = g;
  const muffled = dir === "back" || dir === "below";
  g.gain.value = volume * (muffled ? 0.75 : 1);
  if (muffled) {
    const lp = filt(c, "lowpass", dir === "below" ? 600 : 1500);
    g.connect(lp);
    node = lp;
  }
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = dir === "left" ? -0.85 : dir === "right" ? 0.85 : 0;
    node.connect(p);
    p.connect(out);
  } else {
    node.connect(out);
  }
  const end = (VOICE[k] ?? VOICE.steps)(c, g, t);
  return end - t;
}
