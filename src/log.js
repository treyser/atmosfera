// Корабельний журнал і листи: спільні помічники.
// Журнал живе в метаданих кімнати (їх Owlbear обмежує 16 кБ на всі розширення разом), тому туди лягають
// лише останні записи. Старіші фоновий скрипт майстра переносить у браузер майстра — в архів.
// Пише в журнал лише майстер (його фоновий скрипт), гравці надсилають записи каналом LOG_ADD.
import OBR from "@owlbear-rodeo/sdk";
import { LOG } from "./state.js";

export const LIMIT = 16000;      // межа Owlbear на всі метадані кімнати
const BUDGET = 12500;            // скільки дозволяємо зайняти, щоб лишити місце іншим розширенням
const KEEP = 12;                 // стільки останніх записів лишаються в кімнаті за будь-яких умов
export const MAX_TEXT = 400;     // найдовший запис гравця

// Локальне сховище браузера: може бути недоступне, тож усе загорнуто
export function local(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
export function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export const ARCHIVE = "atmosfera.log-archive";   // у майстра: записи, що вже не вміщаються в кімнату
export const NOTES = "atmosfera.notes";           // у майстра: надіслані листи
export const INBOX = "atmosfera.inbox";           // у гравця: отримані листи

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const bytes = (v) => new TextEncoder().encode(JSON.stringify(v ?? {})).length;

// Дописати в журнал (лише з боку майстра). Черга, щоб два записи поспіль не затерли один одного.
let queue = Promise.resolve();
export function appendLog(entry) {
  queue = queue.then(() => write((list) => [...list, { i: uid(), at: Math.floor(Date.now() / 1000), ...entry }])).catch(() => {});
  return queue;
}
export function removeLog(id, user) {
  queue = queue.then(() => write((list) => list.filter((e) => e.i !== id || (user && e.u !== user)))).catch(() => {});
  // і з архіву, якщо видаляє майстер
  if (!user) saveLocal(ARCHIVE, local(ARCHIVE, []).filter((e) => e.i !== id));
  return queue;
}

async function write(change) {
  const room = await OBR.room.getMetadata();
  let list = change(room[LOG] ?? []);
  // Не влазить — найстаріші переїжджають в архів майстра
  const others = bytes({ ...room, [LOG]: [] });
  const moved = [];
  while (list.length > KEEP && others + bytes(list) > BUDGET) moved.push(list.shift());
  if (moved.length) saveLocal(ARCHIVE, [...local(ARCHIVE, []), ...moved]);
  await OBR.room.setMetadata({ [LOG]: list });
}

// Як запис виглядає текстом (для експорту)
export function plain(e) {
  const day = e.d ? `День ${e.d}. ` : "";
  if (e.k === "a") return `${day}Прибули до №${e.n}: «${e.t}»${e.s ? ` (${e.s})` : ""}.`;
  if (e.k === "e") return `${day}${e.s ? e.s + ": " : ""}«${e.t}».`;
  return `${day}${e.w ?? "Майстер"}: ${e.t}`;
}
