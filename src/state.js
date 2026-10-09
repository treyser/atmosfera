// Спільний стан атмосфери: що зберігаємо і які є готові настрої.
import OBR from "@owlbear-rodeo/sdk";

export const ID = "com.nikita.atmosphere";
export const STATE = `${ID}/state`;   // настрій — у метаданих сцени, свій у кожної сцени
export const TITLE = `${ID}/title`;   // канал, яким розсилається титр
export const GRADE_ON = `${ID}/grade`; // чи ввімкнена кольорокорекція — у метаданих сцени
export const BEAT = `${ID}/beat`;     // який момент пригоди зараз — у метаданих сцени
export const CUT = `${ID}/cut`;       // канал, яким усім розсилається, куди навести камеру
export const HUD = `${ID}/hud`;       // таймер раундів і лічильник прориву — у метаданих сцени, бачать усі
export const CARD = `${ID}/card`;     // вікно титру і його текст у метаданих гравця
export const ATLAS = `${ID}/atlas`;   // вікно Атласу; він же канал «пливемо сюди» до фонового скрипту майстра
export const VISITED = `${ID}/visited`; // відвідані точки Атласу — у метаданих кімнати

// Усі величини від 0 до 1. tint — колір фільтра, amount — його сила, film — зерно й віньєтка.
// sat, contrast, sway — для кольорокорекції: насиченість, контраст, погойдування картинки.
export const CLEAR = { preset: "clear", rain: 0, snow: 0, fog: 0, flash: 0, dark: 0, amount: 0, tint: [0, 0, 0], film: 0, sat: 1, contrast: 1, sway: 0 };

export const PRESETS = [
  { id: "clear", name: "Ясно",      ...CLEAR },
  { id: "day",   name: "Кіно-день", rain: 0,    fog: 0.06, flash: 0, dark: 0.08, amount: 0.12, tint: [0.95, 0.72, 0.4],  film: 0.7, sat: 1.12, contrast: 1.08, sway: 0.25 },
  { id: "rain",  name: "Дощ",       rain: 0.55, fog: 0.18, flash: 0, dark: 0.22, amount: 0.2,  tint: [0.25, 0.35, 0.5],  film: 0.7, sat: 0.8,  contrast: 1.05, sway: 0.5 },
  { id: "storm", name: "Шторм",     rain: 1,    fog: 0.28, flash: 1, dark: 0.42, amount: 0.28, tint: [0.15, 0.25, 0.4],  film: 0.9, sat: 0.7,  contrast: 1.15, sway: 1 },
  { id: "fog",   name: "Туман",     rain: 0,    fog: 0.8,  flash: 0, dark: 0.12, amount: 0.12, tint: [0.7, 0.75, 0.8],   film: 0.6, sat: 0.75, contrast: 0.95, sway: 0.2 },
  { id: "night", name: "Ніч",       rain: 0,    fog: 0.1,  flash: 0, dark: 0.6,  amount: 0.35, tint: [0.08, 0.14, 0.35], film: 0.9, sat: 0.7,  contrast: 1.1,  sway: 0.3 },
  { id: "calm",  name: "Тихе море", rain: 0,    fog: 0.65, flash: 0, dark: 0.45, amount: 0.3,  tint: [0.05, 0.4, 0.38],  film: 1,   sat: 0.55, contrast: 1.05, sway: 0.05 },
  { id: "dusk",  name: "Захід",     rain: 0,    fog: 0.1,  flash: 0, dark: 0.2,  amount: 0.3,  tint: [0.95, 0.45, 0.18], film: 0.8, sat: 1.15, contrast: 1.1,  sway: 0.3 },
  { id: "warm",  name: "Ліхтарі",   rain: 0,    fog: 0,    flash: 0, dark: 0.3,  amount: 0.18, tint: [1, 0.6, 0.25],     film: 0.9, sat: 1.05, contrast: 1.1,  sway: 0 },
  // потяг: сніг летить горизонтально, проти руху
  { id: "frost",    name: "Сніг за вікном",  snow: 0.3,  fog: 0.05, flash: 0,   dark: 0.25, amount: 0.14, tint: [0.9, 0.7, 0.45],   film: 0.9, sat: 1,    contrast: 1.08, sway: 0.15 },
  { id: "blizzard", name: "Хуртовина",       snow: 1,    fog: 0.28, flash: 0,   dark: 0.28, amount: 0.24,  tint: [0.55, 0.68, 0.85], film: 0.9, sat: 0.65, contrast: 1.1,  sway: 0.8 },
  { id: "alarm",    name: "Аварійне світло", snow: 0,    fog: 0,    flash: 0,   dark: 0.5,  amount: 0.5,  tint: [0.9, 0.08, 0.06],  film: 1,   sat: 0.75, contrast: 1.2,  sway: 0.35 },
  { id: "breach",   name: "Пробоїна",        snow: 0.5,  fog: 0.1,  flash: 0,   dark: 0.5,  amount: 0.42, tint: [0.8, 0.1, 0.1],    film: 1,   sat: 0.7,  contrast: 1.2,  sway: 0.5 },
  { id: "core",     name: "Сердечник",       snow: 0.35, fog: 0.1,  flash: 0,   dark: 0.4,  amount: 0.38, tint: [0.3, 0.35, 0.95],  film: 1,   sat: 0.9,  contrast: 1.2,  sway: 0.6 },
  { id: "surge",    name: "Перевантаження",  snow: 0.8,  fog: 0.15, flash: 0.9, dark: 0.42, amount: 0.4,  tint: [0.4, 0.3, 0.95],   film: 1,   sat: 0.85, contrast: 1.25, sway: 1 },
];

export const SLIDERS = [
  { key: "rain",   name: "Дощ" },
  { key: "snow",   name: "Сніг" },
  { key: "fog",    name: "Туман" },
  { key: "flash",  name: "Блискавки" },
  { key: "dark",   name: "Темрява" },
  { key: "amount", name: "Фільтр" },
  { key: "film",   name: "Плівка" },
];

export function normalize(raw) {
  return { ...CLEAR, ...(raw ?? {}) };
}

export async function getState() {
  const meta = await OBR.scene.getMetadata();
  return normalize(meta[STATE]);
}

export async function setState(next) {
  await OBR.scene.setMetadata({ [STATE]: next });
}

// Чи є що малювати взагалі
export function isClear(s) {
  return !(s.rain || s.snow || s.fog || s.flash || s.dark || s.amount || s.film);
}

// Таймер і лічильник фінального прориву: скільки раундів лишилось, скільки успіхів і провалів.
export const HUD_OFF = { on: false, rounds: 10, ok: 0, fail: 0, okMax: 5, failMax: 3 };
export const hudOf = (raw) => ({ ...HUD_OFF, ...(raw ?? {}) });
