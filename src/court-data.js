// «Оксамитова книга»: картки куртизанок. Майстер знайомить героїв із дамою — і тоді гравці бачать її картку
// й можуть поставити оцінку з коротким відгуком. Картки — з Майстерні (public/data/court.json);
// що відкрито і всі відгуки — у браузері майстра, гравцям роздається повідомленнями.
import { local, saveLocal } from "./log.js";
import { art, cachedContent, loadContent, SITE } from "./content.js";

export const NO_IMG = `${SITE}court.svg`;
const fromJson = (j) => (Array.isArray(j?.items) ? j.items.map((x) => ({ ...x, img: art(x.img) || NO_IMG })) : null);
export let COURT = fromJson(cachedContent("court")) ?? [];
export async function loadCourt() {
  const list = fromJson(await loadContent("court"));
  if (list) COURT = list;
  return COURT;
}
export const lady = (id) => COURT.find((x) => x.id === id) ?? null;

// у майстра: кого відкрито й відгуки; у гравця: остання копія від майстра
export const OPEN = (room) => `atmosfera.court-open.${room}`;
export const SEEN = (room) => `atmosfera.court-seen.${room}`;
export const RATES = (room) => `atmosfera.court-rates.${room}`;
export const opened = (room) => local(OPEN(room), []);
export const saveOpened = (room, ids) => saveLocal(OPEN(room), ids);
export const seen = (room) => local(SEEN(room), []);
export const saveSeen = (room, ids) => saveLocal(SEEN(room), ids);
// { [id картки]: { [id гравця]: { n: ім'я, s: 1–5, t: відгук, at } } }
export const rates = (room) => local(RATES(room), {});
export const saveRates = (room, r) => saveLocal(RATES(room), r);
export const FOCUS = "atmosfera.court-focus";
export const MAX_REVIEW = 220;

// оцінка від гравця → у книгу майстра; повертає оновлені відгуки
export function applyRate(all, from, { id, s, t, n }) {
  if (!id || !from) return all;
  const card = { ...(all[id] ?? {}) };
  const stars = Math.round(Number(s) || 0);
  if (stars < 1) delete card[from];
  else card[from] = { n: String(n ?? "Гравець").slice(0, 40), s: Math.min(5, stars), t: String(t ?? "").trim().slice(0, MAX_REVIEW), at: Date.now() };
  const next = { ...all, [id]: card };
  if (!Object.keys(card).length) delete next[id];
  return next;
}

// повідомлення Owlbear — до 16 кБ: якщо відгуків забагато, найстаріші тексти скорочуємо
export function pack(ids, all) {
  const out = { ids, rates: JSON.parse(JSON.stringify(all)) };
  const size = () => new TextEncoder().encode(JSON.stringify(out)).length;
  if (size() < 14000) return out;
  const flat = Object.values(out.rates).flatMap((c) => Object.values(c)).sort((a, b) => a.at - b.at);
  for (const r of flat) { if (size() < 14000) break; r.t = r.t.slice(0, 40) + (r.t.length > 40 ? "…" : ""); }
  for (const r of flat) { if (size() < 14000) break; r.t = ""; }
  return out;
}

export function avg(card) {
  const list = Object.values(card ?? {});
  if (!list.length) return null;
  return { v: list.reduce((a, r) => a + r.s, 0) / list.length, n: list.length };
}
export const stars = (v) => "★★★★★".slice(0, Math.round(v)) + "☆☆☆☆☆".slice(0, 5 - Math.round(v));
export const gp = (n) => (n ? `${Number(n).toLocaleString("uk-UA")} зм` : "за домовленістю");
