// Записник знайомств: кожен NPC, якого майстер «Представив» (картка NPC) або з ким познайомив
// в Оксамитовій книзі, сам потрапляє в записник. У майстра — повний список (резерв для гравців),
// у гравця — той самий список плюс його власні нотатки й ставлення (лише в його браузері).
import { local, saveLocal } from "./log.js";

export const LIST = (room) => `atmosfera.acq.${room}`;        // { [key]: { name, sub, img, first, last, where, n } }
export const NOTES = (room) => `atmosfera.acq-notes.${room}`; // у гравця: { [key]: { t: нотатка, m: ставлення } }
export const WHERE = "atmosfera.acq-where";                   // останній титр — «де зустріли»

export const keyOf = (name) => String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
export const acqList = (room) => local(LIST(room), {});
export const saveAcq = (room, v) => saveLocal(LIST(room), v);
export const acqNotes = (room) => local(NOTES(room), {});
export const saveAcqNotes = (room, v) => saveLocal(NOTES(room), v);

export const MOODS = { "": "—", ally: "🙂 Друг", neutral: "😐 Нейтральний", sus: "🤨 Підозрілий", foe: "😠 Ворог" };

// нове знайомство або повторна зустріч; повертає true, якщо це хтось новий
export function introduce(room, { name, sub = "", img = "" }, where = null) {
  const k = keyOf(name);
  if (!k) return false;
  const all = acqList(room);
  const now = Date.now();
  const place = where ?? lastWhere();
  const was = all[k];
  all[k] = was
    ? { ...was, sub: sub || was.sub, img: img || was.img, last: now, n: (was.n ?? 1) + 1 }
    : { name: String(name).trim(), sub, img, first: now, last: now, where: place, n: 1 };
  saveAcq(room, all);
  return !was;
}

// злити список від майстра (нічого не губимо: беремо новіше по кожному NPC)
export function mergeAcq(room, incoming) {
  const all = acqList(room);
  let changed = false;
  for (const [k, v] of Object.entries(incoming ?? {})) {
    const mine = all[k];
    if (!mine || (v.last ?? 0) > (mine.last ?? 0) || (!mine.img && v.img)) {
      all[k] = { ...mine, ...v, first: Math.min(mine?.first ?? v.first, v.first ?? Date.now()) };
      changed = true;
    }
  }
  if (changed) saveAcq(room, all);
  return changed;
}

export function lastWhere() {
  try { return localStorage.getItem(WHERE) || ""; } catch { return ""; }
}
export function setWhere(t) {
  try { if (t) localStorage.setItem(WHERE, t); } catch {}
}
