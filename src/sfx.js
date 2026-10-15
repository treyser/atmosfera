// Таємні звуки для уважних: справжні записи (BigSoundBank, CC0), які збірка кладе в /audio/.
// Грає кожен обраний гравець у себе; напрямок — стерео, «позаду» й «знизу» — приглушено.
import { SFX } from "./tracks.js";

const BASE = import.meta.env.BASE_URL;
let ctx = null;
let out = null;
const cache = new Map();   // ключ звуку → розкодований запис (Promise)

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.9;
    out.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

export const SOUNDS = [
  { k: "steps",   name: "Кроки",    icon: "👣", hear: "Чиїсь повільні кроки по дошках" },
  { k: "creak",   name: "Скрип",    icon: "🚪", hear: "Протяжний скрип" },
  { k: "whisper", name: "Шепіт",    icon: "🗣", hear: "Ледь чутний шепіт" },
  { k: "knock",   name: "Стукіт",   icon: "✊", hear: "Три глухі удари" },
  { k: "splash",  name: "Плюскіт",  icon: "💧", hear: "Сплеск, ніби щось важке впало у воду" },
  { k: "metal",   name: "Клинок",   icon: "🗡", hear: "Тихий шелест клинка, що виходить з піхов" },
  { k: "growl",   name: "Гарчання", icon: "🐺", hear: "Низьке гарчання" },
  { k: "breath",  name: "Подих",    icon: "💨", hear: "Чийсь повільний подих зовсім поруч" },
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

function load(def) {
  if (!cache.has(def.k)) {
    const p = fetch(new URL(`${BASE}audio/${def.file}`, window.location.origin))
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer(); })
      .then((b) => new Promise((ok, fail) => audio().decodeAudioData(b, ok, fail)));
    p.catch(() => cache.delete(def.k));   // не вдалося — наступного разу спробуємо знову
    cache.set(def.k, p);
  }
  return cache.get(def.k);
}

// Заздалегідь завантажити всі звуки (щоб гравець почув одразу, а не за секунду)
export function preload() {
  if (!audio()) return;
  for (const def of SFX) load(def).catch(() => {});
}

// Зіграти шматок запису з напрямку; повертає тривалість у секундах (0 — не вдалося)
export async function playSecret(k, dir = "front", volume = 1) {
  const c = audio();
  const def = SFX.find((s) => s.k === k);
  if (!c || !def) return 0;
  let buf;
  try { buf = await load(def); } catch (err) { console.error("Таємний звук не завантажився:", err); return 0; }
  const dur = Math.min(def.dur, Math.max(0.1, buf.duration - def.off));
  const t = c.currentTime + 0.03;
  const muffled = dir === "back" || dir === "below";

  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  const peak = def.gain * volume * (muffled ? 0.8 : 1);
  // м'який вхід і вихід, щоб шматок не обривався клацанням
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.06);
  g.gain.setValueAtTime(peak, t + Math.max(0.07, dur - 0.5));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(g);

  let node = g;
  if (muffled) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = dir === "below" ? 700 : 1800;
    node.connect(lp);
    node = lp;
  }
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.pan.value = dir === "left" ? -0.8 : dir === "right" ? 0.8 : 0;
    node.connect(p);
    p.connect(out);
  } else {
    node.connect(out);
  }
  src.start(t, def.off, dur + 0.05);
  return dur;
}
