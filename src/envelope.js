// Запечатаний лист: печатка, конверт, текст. Показує перший нерозпечатаний або вказаний лист.
import OBR from "@owlbear-rodeo/sdk";
import "./journal.css";
import { NOTE } from "./state.js";
import { local, saveLocal } from "./log.js";
import { inbox, markRead } from "./notes.js";

const $ = (id) => document.getElementById(id);
const PICK = "atmosfera.inbox.open";   // який лист перечитати (ставить вкладка «Мої листи»)
let note = null;

OBR.onReady(() => {
  show();
  $("seal").onclick = open;
  $("hide").onclick = () => OBR.modal.close(NOTE);
  $("more").onclick = () => { reset(); show(); };
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") OBR.modal.close(NOTE); });
});

function show() {
  const list = inbox();
  const want = local(PICK, null);
  saveLocal(PICK, null);
  note = list.find((n) => n.id === want) ?? list.find((n) => !n.read) ?? null;
  if (!note) { OBR.modal.close(NOTE); return; }
  $("text").textContent = note.t;
  $("when").textContent = new Date(note.at).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  if (note.read) open();   // перечитування — без печатки
}

async function open() {
  $("letter").classList.add("broken");
  setTimeout(() => {
    $("letter").hidden = true;
    $("paper").hidden = false;
    $("paper").classList.add("in");
  }, note?.read ? 0 : 650);
  if (note && !note.read) await markRead(note.id);
  $("more").hidden = !inbox().some((n) => !n.read);
}

function reset() {
  $("letter").classList.remove("broken");
  $("letter").hidden = false;
  $("paper").hidden = true;
  $("paper").classList.remove("in");
}
