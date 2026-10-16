// Зоряне небо: сузір'я, генерація нічного неба і перевірка, чи партія з'єднала сузір'я.
// Сузір'я цієї ночі стоїть над тим напрямком, куди веде (від точки, де зараз корабель).
import { POINTS } from "./atlas-points.js";

// Зорі сузір'я — у власній рамці 0..1 (y — вниз), m — яскравість 1 (найяскравіша) … 3
export const CONST = [
  { id: "anchor", name: "Якір", az: 0, alt: 34, size: 20,
    myth: "Моряки кажуть: поки Якір над щоглою, жоден шторм не зірве корабель із місця. Його першим показують юнгам.",
    stars: [[.5, 0, 2], [.28, .25, 2], [.72, .25, 2], [.5, .3, 1], [.5, .8, 1], [.14, .64, 2], [.86, .64, 2]],
    edges: [[0, 3], [1, 3], [3, 2], [3, 4], [4, 5], [4, 6]] },
  { id: "anvil", name: "Ковадло", az: 300, alt: 26, size: 22,
    myth: "Дворфи вірять, що Першоковаль вибив на небесному ковадлі перші руни, і іскри досі горять. Дивитися на нього перед куванням — на щастя.",
    stars: [[.08, .35, 2], [.72, .35, 1], [1, .22, 2], [.45, .6, 2], [.2, .92, 2], [.72, .92, 2]],
    edges: [[0, 1], [1, 2], [1, 3], [0, 3], [3, 4], [3, 5]] },
  { id: "whale", name: "Кит", az: 90, alt: 22, size: 28,
    myth: "Старий Кит пливе небом туди, де вода тепла. Хто йде за його хвостом, рідко лишається без вітру.",
    stars: [[0, .5, 1], [.2, .28, 2], [.5, .22, 2], [.75, .4, 2], [.9, .55, 2], [1, .28, 3], [1, .78, 3], [.42, .72, 2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [4, 6], [0, 7], [7, 4]] },
  { id: "light", name: "Маяк", az: 180, alt: 30, size: 18,
    myth: "Його верхня зоря ніколи не мерехтить. Кажуть, це вогонь першого маяка, який підняли на небо, коли берег пішов під воду.",
    stars: [[.3, 1, 2], [.7, 1, 2], [.4, .32, 2], [.6, .32, 2], [.5, .04, 1]],
    edges: [[0, 2], [1, 3], [2, 3], [2, 4], [3, 4], [0, 1]] },
  { id: "crown", name: "Корона Неболіусу", az: 240, alt: 40, size: 24,
    myth: "Сім зірок на честь семи королів. Після прокляття одна з них потьмяніла — котра саме, старі мореплавці сперечаються досі.",
    stars: [[0, .8, 2], [.12, .2, 2], [.3, .6, 3], [.5, 0, 1], [.7, .6, 3], [.88, .2, 2], [1, .8, 2]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [0, 6]] },
  { id: "trident", name: "Тризуб", az: 135, alt: 36, size: 20,
    myth: "Зброя морського владики, загублена в небі. Його середній зубець показує на глибину, де він її впустив.",
    stars: [[.5, 1, 2], [.5, .45, 1], [.2, .35, 2], [.14, 0, 2], [.5, 0, 2], [.8, .35, 2], [.86, 0, 2]],
    edges: [[0, 1], [1, 2], [2, 3], [1, 4], [1, 5], [5, 6]] },
  { id: "owl", name: "Сова", az: 330, alt: 44, size: 16,
    myth: "Нічна вартова. Каже, що бачить того, хто збився з дороги, — і завжди показує йому шлях додому.",
    stars: [[.2, 0, 2], [.8, 0, 2], [.32, .32, 1], [.68, .32, 1], [.5, 1, 2], [.5, .5, 3]],
    edges: [[0, 2], [2, 5], [5, 3], [3, 1], [2, 4], [3, 4]] },
  { id: "serpent", name: "Змій", az: 200, alt: 18, size: 30,
    myth: "Довгий, як мілина під час відпливу. Де Змій торкається води, там рифи й водовороти.",
    stars: [[0, .6, 2], [.2, .3, 2], [.4, .62, 3], [.6, .35, 2], [.8, .66, 2], [1, .4, 1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]] },
  { id: "sail", name: "Вітрило", az: 45, alt: 28, size: 18,
    myth: "Перше, що бачать на сході ті, хто вийшов у море до світанку. Повне Вітрило — на попутний вітер.",
    stars: [[.3, 1, 2], [.3, 0, 1], [.92, .76, 2], [.3, .76, 2], [.55, .05, 3]],
    edges: [[0, 3], [3, 1], [1, 2], [2, 3], [1, 4]] },
  { id: "key", name: "Ключ", az: 270, alt: 20, size: 22,
    myth: "Ним, кажуть, замкнули Тихе море. Хто знайде замок під цими зорями — відімкне те, що там сховане.",
    stars: [[.06, .3, 2], [.22, .08, 2], [.38, .3, 1], [.22, .52, 2], [.7, .3, 3], [1, .3, 2], [1, .56, 3]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4], [4, 5], [5, 6]] },
  { id: "eye", name: "Око Безодні", az: 160, alt: 14, size: 16,
    myth: "Низько над водою, червонувате. Моряки не люблять на нього дивитися: кажуть, воно дивиться у відповідь.",
    stars: [[0, .5, 2], [.5, .15, 2], [1, .5, 2], [.5, .85, 2], [.5, .5, 1]],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [4, 3]], red: true },
  { id: "hand", name: "Рука Вальтара", az: 120, alt: 48, size: 22,
    myth: "Це сузір'я з'явилося на небі разом із прокляттям. Пальці його тягнуться на південний схід — до вулкана.",
    stars: [[.5, .82, 1], [.1, .45, 3], [.3, .05, 2], [.52, 0, 2], [.72, .08, 2], [.95, .36, 3]],
    edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]], red: true },
];
export const constOf = (id) => CONST.find((c) => c.id === id);

export const DIRS = [
  { az: 0, name: "Пн", full: "північ" }, { az: 45, name: "ПнСх", full: "північний схід" },
  { az: 90, name: "Сх", full: "схід" }, { az: 135, name: "ПдСх", full: "південний схід" },
  { az: 180, name: "Пд", full: "південь" }, { az: 225, name: "ПдЗх", full: "південний захід" },
  { az: 270, name: "Зх", full: "захід" }, { az: 315, name: "ПнЗх", full: "північний захід" },
];
export const dirName = (az) => DIRS[Math.round((((az % 360) + 360) % 360) / 45) % 8];

// Напрямок з однієї точки Атласу на іншу (0 — північ, за годинниковою стрілкою)
export function bearing(from, to) {
  const a = POINTS.find((p) => p.n === from), b = POINTS.find((p) => p.n === to);
  if (!a || !b) return null;
  const dx = (b.u - a.u) * 1402, dy = (b.v - a.v) * 1122;
  return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360;
}

// Детермінований генератор випадкових чисел — у всіх однакове небо
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MAX_ALT = 58;
// Небо ночі: усі зорі (фонові й сузір'їв) на небесній сфері { id, az, alt, m, c? }
export function buildSky(night) {
  const seed = night?.seed ?? 1;
  const stars = [];
  const cons = [];
  for (const v of night?.vis ?? []) {
    const c = constOf(v.id);
    if (!c) continue;
    const jit = rng(seed ^ hash(c.id));
    const ids = [];
    const w = c.size, h = c.size * 0.8;
    c.stars.forEach(([x, y, m], i) => {
      const id = `${c.id}.${i}`;
      ids.push(id);
      stars.push({ id, az: (v.az + (x - 0.5) * w + 360) % 360, alt: v.alt + (0.5 - y) * h, m: m + jit() * 0.3, c: c.id, red: c.red });
    });
    cons.push({ id: c.id, ids, edges: c.edges.map(([a, b]) => lineKey(ids[a], ids[b])) });
  }
  // фонові зорі: номери залежать лише від ночі, тож лінії не ламаються, коли майстер міняє сузір'я;
  // ті, що впали надто близько до зірок сузір'їв, просто не показуємо
  const rnd = rng(seed);
  const near = (az, alt) => stars.some((s) => s.c && Math.abs(angDiff(s.az, az)) < 2.4 && Math.abs(s.alt - alt) < 2.4);
  for (let i = 0; i < 540; i++) {
    const az = rnd() * 360, alt = 3 + Math.pow(rnd(), 0.8) * (MAX_ALT - 1);
    const m = 1.3 + Math.pow(rnd(), 0.45) * 2.4;
    if (!near(az, alt)) stars.push({ id: "b" + i, az, alt, m });
  }
  return { stars, cons };
}
const hash = (str) => [...str].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7);
export const angDiff = (a, b) => ((((a - b) % 360) + 540) % 360) - 180;
export const lineKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

// Які сузір'я ночі вже з'єднано повністю
export function solved(sky, lines) {
  const set = new Set(lines);
  return sky.cons.filter((c) => c.edges.every((e) => set.has(e))).map((c) => c.id);
}

// ---------- стан ----------
const read = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// { night: { open, seed, vis: [{ id, az, alt, lead }] }, lines: [], found: [], hints: { id: к-сть }, known: [], leads: { id: № точки } }
export const SKY_KEY = (room) => `atmosfera.stars.${room}`;       // у майстра
export const SKY_SEEN = (room) => `atmosfera.stars-seen.${room}`; // у гравця
const EMPTY = () => ({ night: { open: false, seed: 1, vis: [] }, lines: [], found: [], hints: {}, known: [], leads: {} });
export const skyState = (room) => ({ ...EMPTY(), ...read(SKY_KEY(room), {}) });
export const saveSky = (room, s) => write(SKY_KEY(room), s);
export const skySeen = (room) => ({ ...EMPTY(), ...read(SKY_SEEN(room), {}) });
export const saveSkySeen = (room, s) => write(SKY_SEEN(room), s);

// Майстер: додати чи стерти лінію; повертає щойно знайдені сузір'я
export function applyLine(s, d) {
  const key = d?.add || d?.del;
  if (!key || !/^[\w.]+\|[\w.]+$/.test(key)) return [];
  if (d.add && !s.lines.includes(key)) s.lines.push(key);
  if (d.del) s.lines = s.lines.filter((x) => x !== key);
  const sky = buildSky(s.night);
  const now = solved(sky, s.lines);
  const fresh = now.filter((id) => !s.found.includes(id));
  for (const id of fresh) {
    s.found.push(id);
    if (!s.known.includes(id)) s.known.push(id);
    const v = s.night.vis.find((x) => x.id === id);
    if (v?.lead) s.leads[id] = v.lead; else delete s.leads[id];
  }
  return fresh;
}

// Позначки на мапі світу: зорі над точками, куди ведуть знайдені сузір'я
export function drawLeads(frame, s) {
  frame.querySelectorAll(".lead-star").forEach((x) => x.remove());
  const by = {};
  for (const [id, n] of Object.entries(s?.leads ?? {})) if (s.known?.includes(id)) (by[n] ??= []).push(constOf(id)?.name ?? id);
  for (const [n, names] of Object.entries(by)) {
    const p = POINTS.find((x) => x.n === Number(n));
    if (!p) continue;
    const el = document.createElement("div");
    el.className = "lead-star";
    el.style.left = `${p.u * 100}%`;
    el.style.top = `${p.v * 100}%`;
    el.title = `Сюди веде: ${names.join(", ")}`;
    el.innerHTML = "<b>✦</b>";
    frame.appendChild(el);
  }
}
