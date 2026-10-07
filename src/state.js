// Спільний стан атмосфери: що зберігаємо і які є готові настрої.
import OBR from "@owlbear-rodeo/sdk";

export const ID = "com.nikita.atmosphere";
export const STATE = `${ID}/state`;   // настрій — у метаданих сцени, свій у кожної сцени
export const TITLE = `${ID}/title`;   // канал, яким розсилається титр
export const BEAT = `${ID}/beat`;     // який момент пригоди зараз — у метаданих сцени
export const CUT = `${ID}/cut`;       // канал, яким усім розсилається, куди навести камеру
export const CARD = `${ID}/card`;     // вікно титру і його текст у метаданих гравця

// Усі величини від 0 до 1. tint — колір фільтра, amount — його сила.
export const CLEAR = { preset: "clear", rain: 0, fog: 0, flash: 0, dark: 0, amount: 0, tint: [0, 0, 0] };

export const PRESETS = [
  { id: "clear", name: "Ясно",      ...CLEAR },
  { id: "rain",  name: "Дощ",       rain: 0.55, fog: 0.15, flash: 0,   dark: 0.2,  amount: 0.18, tint: [0.25, 0.35, 0.5] },
  { id: "storm", name: "Шторм",     rain: 1,    fog: 0.25, flash: 1,   dark: 0.4,  amount: 0.25, tint: [0.15, 0.25, 0.4] },
  { id: "fog",   name: "Туман",     rain: 0,    fog: 0.8,  flash: 0,   dark: 0.1,  amount: 0.12, tint: [0.7, 0.75, 0.8] },
  { id: "night", name: "Ніч",       rain: 0,    fog: 0.1,  flash: 0,   dark: 0.6,  amount: 0.35, tint: [0.08, 0.14, 0.35] },
  { id: "calm",  name: "Тихе море", rain: 0,    fog: 0.65, flash: 0,   dark: 0.45, amount: 0.3,  tint: [0.05, 0.4, 0.38] },
  { id: "dusk",  name: "Захід",     rain: 0,    fog: 0.1,  flash: 0,   dark: 0.15, amount: 0.28, tint: [0.95, 0.5, 0.2] },
];

export const SLIDERS = [
  { key: "rain",   name: "Дощ" },
  { key: "fog",    name: "Туман" },
  { key: "flash",  name: "Блискавки" },
  { key: "dark",   name: "Темрява" },
  { key: "amount", name: "Фільтр" },
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
  return !(s.rain || s.fog || s.flash || s.dark || s.amount);
}
