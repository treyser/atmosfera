// Корабельний журнал і листи: спільні помічники.
// Метадані кімнати Owlbear обмежує 16 кБ на всі розширення разом, і в цій кімнаті вони майже заповнені.
// Тому журнал зберігається в браузері майстра, а гравцям роздається повідомленнями:
// відкрив журнал — попросив увесь, далі нові записи приходять самі. У гравця лишається копія,
// тож прочитати журнал можна й без майстра. Пише в журнал лише фоновий скрипт майстра.
import OBR from "@owlbear-rodeo/sdk";
import { LOG, LOG_PUSH, LOG_DROP, LOG_ALL } from "./state.js";

export const LIMIT = 16000;      // межа Owlbear на метадані кімнати і на одне повідомлення
const CHUNK = 11000;             // скільки байтів записів кладемо в одне повідомлення
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

export const BOOK = "atmosfera.log";           // у майстра: увесь журнал; у гравця: остання копія
export const NOTES = "atmosfera.notes";        // у майстра: надіслані листи
export const INBOX = "atmosfera.inbox";        // у гравця: отримані листи

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const bytes = (v) => new TextEncoder().encode(JSON.stringify(v ?? {})).length;
export const book = () => local(BOOK, []);

// --- майстер ---

export async function appendLog(entry) {
  const e = { i: uid(), at: Math.floor(Date.now() / 1000), ...entry };
  saveLocal(BOOK, [...book(), e]);
  await OBR.broadcast.sendMessage(LOG_PUSH, e, { destination: "REMOTE" }).catch(() => {});
}

export async function removeLog(id, user) {
  const list = book();
  const e = list.find((x) => x.i === id);
  if (!e || (user && e.u !== user)) return;   // гравець викреслює лише своє
  saveLocal(BOOK, list.filter((x) => x !== e));
  await OBR.broadcast.sendMessage(LOG_DROP, { i: id }, { destination: "REMOTE" }).catch(() => {});
}

// Увесь журнал гравцям — шматками, щоб кожне повідомлення влізло в 16 кБ
export async function sendAll() {
  const list = book();
  const parts = [];
  let cur = [];
  for (const e of list) {
    if (cur.length && bytes([...cur, e]) > CHUNK) { parts.push(cur); cur = []; }
    cur.push(e);
  }
  parts.push(cur);
  const id = uid();
  for (let k = 0; k < parts.length; k++) {
    await OBR.broadcast.sendMessage(LOG_ALL, { id, k, of: parts.length, list: parts[k] }, { destination: "REMOTE" }).catch(() => {});
  }
}

// Журнал версії 0.7.0 жив у кімнаті — переносимо його до майстра й звільняємо місце
export async function migrate() {
  const room = await OBR.room.getMetadata();
  const old = room[LOG];
  if (!old) return;
  const have = new Set(book().map((e) => e.i));
  saveLocal(BOOK, [...book(), ...old.filter((e) => !have.has(e.i))].sort((a, b) => (a.at ?? 0) - (b.at ?? 0)));
  await OBR.room.setMetadata({ [LOG]: undefined });
}

// --- гравець: збирає журнал зі шматків ---

const incoming = new Map();
export function takeAll(data, done) {
  if (!data?.id) return;
  const got = incoming.get(data.id) ?? [];
  got[data.k] = data.list;
  incoming.set(data.id, got);
  if (got.filter(Boolean).length === data.of) {
    incoming.delete(data.id);
    done(got.flat());
  }
}

// Як запис виглядає текстом (для копіювання)
export function plain(e) {
  const day = e.d ? `День ${e.d}. ` : "";
  if (e.k === "a") return `${day}Прибули до №${e.n}: «${e.t}»${e.s ? ` (${e.s})` : ""}.`;
  if (e.k === "e") return `${day}${e.s ? e.s + ": " : ""}«${e.t}».`;
  return `${day}${e.w ?? "Майстер"}: ${e.t}`;
}
