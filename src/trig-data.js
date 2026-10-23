// Тригери «Коли… / Якщо… / То…» — опис подій, умов і дій (для редактора) і сховище майстра.
// Це перший крок до блупрінтів: той самий виконавець потім читатиме й графи.
import { local, saveLocal, uid } from "./log.js";

export const TRIGS = (room) => `atmosfera.triggers.${room}`;
export const VARS = (room) => `atmosfera.vars.${room}`;
export const TLOG = (room) => `atmosfera.trig-log.${room}`;
export const triggers = (room) => local(TRIGS(room), []);
export const saveTriggers = (room, v) => saveLocal(TRIGS(room), v);
export const vars = (room) => local(VARS(room), {});
export const saveVars = (room, v) => saveLocal(VARS(room), v);
export const tlog = (room) => local(TLOG(room), []);
export function addLog(room, line) { saveLocal(TLOG(room), [{ at: Date.now(), t: line }, ...tlog(room)].slice(0, 40)); }

const MOODS = { clear: "Ясно", day: "Кіно-день", rain: "Дощ", storm: "Шторм", fog: "Туман", night: "Ніч", calm: "Тихе море", dusk: "Захід", warm: "Ліхтарі", frost: "Сніг за вікном", blizzard: "Хуртовина", alarm: "Аварійне світло", breach: "Пробоїна", core: "Сердечник", surge: "Перевантаження" };
const SOUNDS = { steps: "👣 Кроки", creak: "🚪 Скрип", whisper: "🗣 Шепіт", knock: "✊ Стукіт", splash: "💧 Плюскіт", metal: "🗡 Клинок", growl: "🐺 Гарчання", breath: "💨 Подих" };
const DIRS = { left: "ліворуч", front: "попереду", right: "праворуч", back: "позаду", below: "знизу" };
const WHO = { hero: "будь-хто з героїв", any: "будь-хто (і NPC)", tokens: "лише вибрані токени" };
const TO = { who: "тому, хто спрацював", all: "усім гравцям", pick: "вибраному гравцю" };

// поля: k — ключ, t — тип (text, area, num, sel, zone, token, tokens, player), o — варіанти для sel
export const EVENTS = {
  enter: { name: "🚪 Хтось заходить у зону", f: [{ k: "zone", l: "Зона (фігура на мапі)", t: "zone" }, { k: "who", l: "Хто", t: "sel", o: WHO }, { k: "tokens", l: "Які токени", t: "tokens", show: (e) => e.who === "tokens" }] },
  near: { name: "👣 Хтось підходить до токена", f: [{ k: "target", l: "До кого / чого", t: "token" }, { k: "dist", l: "Ближче ніж, клітинок", t: "num", d: 2 }, { k: "who", l: "Хто", t: "sel", o: WHO }, { k: "tokens", l: "Які токени", t: "tokens", show: (e) => e.who === "tokens" }] },
  button: { name: "▶ Я натискаю кнопку", f: [] },
  timer: { name: "⏱ Кожні N хвилин", f: [{ k: "every", l: "Хвилин", t: "num", d: 15 }] },
  battle: { name: "⚔ Починається бій", f: [] },
  round: { name: "🔁 Новий раунд бою", f: [{ k: "n", l: "Лише раунд № (0 — кожен)", t: "num", d: 0 }] },
};
export const CONDS = {
  chance: { name: "🎲 Шанс", f: [{ k: "p", l: "%", t: "num", d: 50 }] },
  name: { name: "👤 Це саме він", f: [{ k: "name", l: "Ім'я токена містить", t: "text" }] },
  var: { name: "🔢 Змінна", f: [{ k: "v", l: "Назва", t: "text" }, { k: "op", l: "", t: "sel", o: { ">=": "≥", "<=": "≤", "==": "=", "!=": "≠" } }, { k: "n", l: "Число", t: "num", d: 1 }] },
  inzone: { name: "📍 Стоїть у зоні", f: [{ k: "who", l: "Хто", t: "sel", o: { who: "той, хто спрацював", tok: "вибраний токен", any: "будь-який герой" } }, { k: "tok", l: "Токен", t: "token", show: (c) => c.who === "tok" }, { k: "zone", l: "Зона", t: "zone" }] },
  battle: { name: "⚔ Іде бій", f: [{ k: "on", l: "", t: "sel", o: { yes: "так, бій іде", no: "ні, бою немає" } }] },
  visible: { name: "👁 Токен видно гравцям", f: [{ k: "tok", l: "Токен", t: "token" }] },
};
export const ACTIONS = {
  title: { name: "🎬 Титр усім", f: [{ k: "big", l: "Великий рядок", t: "text" }, { k: "small", l: "Малий рядок", t: "text" }] },
  mood: { name: "🌫 Настрій сцени", f: [{ k: "m", l: "Настрій", t: "sel", o: MOODS }] },
  sound: { name: "🔉 Таємний звук", f: [{ k: "s", l: "Звук", t: "sel", o: SOUNDS }, { k: "dir", l: "Звідки", t: "sel", o: DIRS }, { k: "to", l: "Кому", t: "sel", o: TO }, { k: "player", l: "Гравець", t: "player", show: (a) => a.to === "pick" }, { k: "text", l: "Що чує (не обов'язково)", t: "text" }] },
  letter: { name: "✉ Таємний лист", f: [{ k: "to", l: "Кому", t: "sel", o: { who: "тому, хто спрацював", pick: "вибраному гравцю" } }, { k: "player", l: "Гравець", t: "player", show: (a) => a.to === "pick" }, { k: "text", l: "Текст листа", t: "area" }] },
  say: { name: "💬 NPC каже", f: [{ k: "token", l: "Хто", t: "token" }, { k: "text", l: "Репліка", t: "text" }] },
  show: { name: "👁 Показати / сховати", f: [{ k: "tokens", l: "Що", t: "tokens" }, { k: "vis", l: "", t: "sel", o: { show: "показати гравцям", hide: "сховати" } }] },
  log: { name: "📖 Запис у журнал", f: [{ k: "text", l: "Текст", t: "text" }] },
  var: { name: "🔢 Змінна", f: [{ k: "v", l: "Назва", t: "text" }, { k: "op", l: "", t: "sel", o: { add: "додати", set: "встановити" } }, { k: "n", l: "Число", t: "num", d: 1 }] },
  battle: { name: "⚔ Почати бій", f: [
    { k: "foes", l: "Хто вороги", t: "sel", o: { near: "усі не-герої поруч із героями", zone: "усі не-герої в зоні", tokens: "лише вибрані токени", all: "усі не-герої на сцені" } },
    { k: "dist", l: "Поруч — у межах клітинок", t: "num", d: 8, show: (a) => (a.foes ?? "near") === "near" },
    { k: "zone", l: "Зона", t: "zone", show: (a) => a.foes === "zone" },
    { k: "tokens", l: "Вороги", t: "tokens", show: (a) => a.foes === "tokens" },
    { k: "reveal", l: "Сховані вороги", t: "sel", o: { yes: "показати гравцям", no: "лишити схованими" } },
    { k: "npc", l: "Живих NPC", t: "sel", o: { skip: "не брати в бій", foe: "брати як ворогів" } },
  ] },
  battleEnd: { name: "🏳 Завершити бій", f: [] },
  move: { name: "🚶 Пересунути токен", f: [
    { k: "who", l: "Кого", t: "sel", o: { who: "того, хто спрацював", tok: "вибраний токен" } }, { k: "tok", l: "Токен", t: "token", show: (a) => a.who === "tok" },
    { k: "to", l: "Куди", t: "sel", o: { token: "до токена", zone: "у центр зони" } },
    { k: "target", l: "До кого", t: "token", show: (a) => (a.to ?? "token") === "token" }, { k: "zone", l: "Зона", t: "zone", show: (a) => a.to === "zone" },
  ] },
  ai: { name: "🤖 Поведінка NPC", f: [{ k: "tokens", l: "Кому", t: "tokens" }, { k: "b", l: "Поведінка", t: "sel", o: { "": "⏸ стоїть", wander: "🚶 блукає", chat: "💬 балакучий", merchant: "🧺 торговець", patrol: "🛡 патруль" } }, { k: "live", l: "Рух на сцені", t: "sel", o: { keep: "не чіпати", on: "увімкнути", off: "зупинити всіх" } }] },
  damage: { name: "💥 Шкода / лікування", f: [{ k: "who", l: "Кому", t: "sel", o: { who: "тому, хто спрацював", tok: "вибраному токену" } }, { k: "tok", l: "Токен", t: "token", show: (a) => a.who === "tok" }, { k: "dice", l: "Скільки (2к6+1; мінус — лікування)", t: "text" }] },
  music: { name: "🎵 Музика", f: [{ k: "m", l: "", t: "sel", o: { battle: "⚔ бойова", boss: "☠ бос", silence: "🤫 тиша", mood: "↩ за настроєм" } }] },
  card: { name: "🪪 Картка NPC усім", f: [{ k: "tok", l: "Хто", t: "token" }, { k: "sub", l: "Підпис (не обов'язково)", t: "text" }] },
  fx: { name: "✨ Ефект зони", f: [{ k: "zone", l: "Зона", t: "zone" }, { k: "fx", l: "Ефект", t: "sel", o: { fire: "🔥 вогонь", fog: "🌫 туман", poison: "☠ отрута", dark: "🌑 темрява", ice: "❄ крига", water: "💧 вода", magic: "✨ магічне коло", off: "✕ прибрати ефект" } }] },
  trap: { name: "🪤 Пастка", f: [{ k: "zone", l: "Пастка (фігура)", t: "zone" }, { k: "arm", l: "", t: "sel", o: { on: "зарядити", off: "знешкодити", show: "показати гравцям" } }] },
  remind: { name: "📌 Нагадати мені", f: [{ k: "text", l: "Що нагадати", t: "text" }] },
  wait: { name: "⏳ Зачекати", f: [{ k: "s", l: "Секунд", t: "num", d: 3 }] },
};

export const blankTrigger = () => ({ id: "t" + uid(), name: "Новий тригер", on: true, once: false, cd: 0, ev: { t: "enter", who: "hero" }, if: [], do: [], fired: 0 });
export const blankOf = (spec) => Object.fromEntries(spec.f.map((f) => [f.k, f.d ?? (f.t === "sel" ? Object.keys(f.o)[0] : f.t === "tokens" ? [] : "")]));

// {хто} — ім'я того, хто спрацював; {назва змінної} — її значення
export function fill(text, ctx, vs) {
  return String(text ?? "").replace(/\{([^{}]+)\}/g, (m, k) => (k === "хто" ? ctx.name ?? "хтось" : k in vs ? String(vs[k]) : m));
}

// коротко для списку: «Коли … → дії»
export function summary(t) {
  const ev = EVENTS[t.ev?.t]?.name ?? "?";
  const acts = (t.do ?? []).map((a) => ACTIONS[a.t]?.name.split(" ")[0]).join(" ");
  return `${ev}${t.if?.length ? ` · умов: ${t.if.length}` : ""} → ${acts || "нічого"}`;
}
