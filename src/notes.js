// Запечатані листи від майстра одному гравцеві.
// Owlbear не вміє слати повідомлення лише одному, тому лист іде всім, а відкриває його тільки адресат.
// Майстер тримає надіслані листи у своєму браузері, адресат — отримані у своєму.
import OBR from "@owlbear-rodeo/sdk";
import { NOTE, NOTE_ACK } from "./state.js";
import { local, saveLocal, uid, NOTES, INBOX } from "./log.js";

const url = (p) => new URL(import.meta.env.BASE_URL + p, window.location.origin).href;
const resent = new Set();   // кому вже дослали за цей вхід у кімнату

// --- майстер ---

export const sentNotes = () => local(NOTES, []);

export async function sendNote({ to, name, t, quiet }) {
  const note = { id: uid(), to, name, t, quiet: Boolean(quiet), at: Date.now(), st: "sent" };
  saveLocal(NOTES, [...sentNotes(), note]);
  await OBR.broadcast.sendMessage(NOTE, note, { destination: "REMOTE" });
  return note;
}

export function forgetNote(id) {
  saveLocal(NOTES, sentNotes().filter((n) => n.id !== id));
}

// Гравець підтвердив: «got» — дійшов, «read» — розпечатав
export function noteAck({ id, st } = {}) {
  const rank = { sent: 0, got: 1, read: 2 };
  const list = sentNotes();
  const n = list.find((x) => x.id === id);
  if (!n || (rank[st] ?? 0) <= (rank[n.st] ?? 0)) return;
  n.st = st;
  saveLocal(NOTES, list);
  window.dispatchEvent(new Event("notes-changed"));
}

export async function resendNotes(players) {
  const here = new Set(players.map((p) => p.id));
  for (const n of sentNotes()) {
    if (n.st !== "sent" || !here.has(n.to) || resent.has(n.id)) continue;
    resent.add(n.id);
    // дослане — без сповіщення для інших, вони його вже бачили
    await OBR.broadcast.sendMessage(NOTE, { ...n, quiet: true }, { destination: "REMOTE" }).catch(() => {});
  }
}

// --- гравець ---

export const inbox = () => local(INBOX, []);

export async function receiveNote(note) {
  if (!note?.id) return;
  const me = await OBR.player.getId();
  if (note.to !== me) {
    if (!note.quiet) OBR.notification.show(`${note.name} отримує запечатаний лист…`).catch(() => {});
    return;
  }
  const list = inbox();
  if (!list.some((x) => x.id === note.id)) {
    saveLocal(INBOX, [...list, { id: note.id, t: note.t, at: note.at, read: false }]);
  }
  await OBR.broadcast.sendMessage(NOTE_ACK, { id: note.id, st: "got" }, { destination: "REMOTE" }).catch(() => {});
  await openEnvelope();
}

export async function openEnvelope() {
  await OBR.modal.open({ id: NOTE, url: url("envelope.html"), width: 620, height: 640, hidePaper: true });
}

export async function markRead(id) {
  const list = inbox();
  const n = list.find((x) => x.id === id);
  if (!n || n.read) return;
  n.read = true;
  saveLocal(INBOX, list);
  await OBR.broadcast.sendMessage(NOTE_ACK, { id, st: "read" }, { destination: "REMOTE" }).catch(() => {});
}
