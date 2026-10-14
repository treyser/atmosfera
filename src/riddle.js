// Загадка Ребер Велетня: гравці торкаються предметів, кожен звучить однією нотою мелодії Маркуса.
// Треба відтворити мелодію по порядку. Звуки чують усі, рахує спроби фоновий скрипт майстра.
import OBR from "@owlbear-rodeo/sdk";
import "./riddle.css";
import { RIDDLE, RIDDLE_OPEN, RIDDLE_TAP, TUNE, HEARD } from "./state.js";
import { OBJECTS, FRAGMENTS, ANSWER, MELODY } from "./melody.js";
import { objectSound, whistleNotes, wrong, audio } from "./synth.js";

const $ = (id) => document.getElementById(id);
let state = { seq: [], fails: 0, solved: false, k: 0 };
let heard = [];
let me = { id: "", name: "", color: "#e8c27a" };
let gm = false;

// Малюнки предметів — прості силуети, щоб не тягнути картинок
const ART = {
  bell: '<path d="M50 14c-3 0-5 2-5 5v3c-12 3-19 14-19 28v14l-7 9h62l-7-9V50c0-14-7-25-19-28v-3c0-3-2-5-5-5z"/><circle cx="50" cy="80" r="6"/>',
  rope: '<path d="M30 10c25 8-15 22 10 32s-15 22 10 32 -12 18 5 22" fill="none" stroke-width="7" stroke-linecap="round"/><path d="M38 10c25 8-15 22 10 32s-15 22 10 32 -12 18 5 22" fill="none" stroke-width="2" opacity=".5"/>',
  shell: '<path d="M50 88C26 88 12 70 14 50 16 32 32 16 50 14c18 2 34 18 36 36 2 20-12 38-36 38z"/><path d="M50 88 50 20M50 88 30 26M50 88 70 26M50 88 20 44M50 88 80 44" fill="none" stroke-width="2.5" opacity=".55"/>',
  wind: '<path d="M30 92c-6-30 4-60 30-80 4 0 6 3 4 6-20 18-28 44-24 74z"/><circle cx="46" cy="40" r="4" class="hole"/><circle cx="42" cy="56" r="4" class="hole"/><circle cx="40" cy="72" r="4" class="hole"/>',
  bone: '<path d="M26 22a9 9 0 1 1 13 7l26 36a9 9 0 1 1 7 13 9 9 0 1 1-13-7L33 35a9 9 0 1 1-7-13z"/>',
};

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  const [id, name, color] = await Promise.all([OBR.player.getId(), OBR.player.getName(), OBR.player.getColor()]);
  me = { id, name, color };
  $("gmbar").hidden = !gm;
  build();
  const room = await OBR.room.getMetadata();
  take(room, true);
  OBR.room.onMetadataChange((m) => take(m, false));
});

function build() {
  for (const o of OBJECTS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `thing t-${o.id}`;
    b.dataset.id = o.id;
    b.innerHTML = `<svg viewBox="0 0 100 100" aria-hidden="true">${ART[o.id]}</svg><span>${o.name}</span>`;
    b.onclick = () => {
      audio();
      OBR.broadcast.sendMessage(RIDDLE_TAP, { id: o.id, who: me.name, c: me.color }, { destination: "ALL" });
      b.classList.add("press");
      setTimeout(() => b.classList.remove("press"), 250);
    };
    $("things").append(b);
  }
  $("close").onclick = () => OBR.modal.close(RIDDLE);
  $("hint").onclick = () => OBR.broadcast.sendMessage(TUNE, { all: true }, { destination: "ALL" });
  $("reset").onclick = () => OBR.broadcast.sendMessage(RIDDLE_TAP, { reset: true }, { destination: "ALL" });
  $("closeAll").onclick = () => OBR.broadcast.sendMessage(RIDDLE_OPEN, { open: false }, { destination: "ALL" });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") OBR.modal.close(RIDDLE); });
}

function take(room, first) {
  heard = room[HEARD] ?? [];
  const next = room[RIDDLE] ?? { seq: [], fails: 0, solved: false, k: 0 };
  const fresh = !first && (next.k ?? 0) > (state.k ?? 0) && next.last;
  const wasSolved = state.solved;
  state = next;
  if (fresh) react(next.last, !wasSolved && next.solved);
  draw();
}

// Новий дотик: звук предмета, і якщо помилка — фальшива нота; якщо розгадали — мелодія ціла
function react(last, justSolved) {
  objectSound(last.id);
  const el = document.querySelector(`.thing[data-id="${last.id}"]`);
  if (el) {
    el.style.setProperty("--who", last.c ?? "#e8c27a");
    el.classList.remove("ring"); void el.offsetWidth; el.classList.add("ring");
  }
  if (!last.ok) setTimeout(() => { wrong(); document.body.classList.add("shake"); setTimeout(() => document.body.classList.remove("shake"), 500); }, 450);
  if (justSolved) setTimeout(() => {
    // предмети грають мелодію самі, а за ними тихо вступає свист
    const voice = (i) => OBJECTS.find((o) => o.id === ANSWER[i]).voice;
    const len = whistleNotes(MELODY.map((_, i) => i), voice);
    MELODY.forEach((_, i) => {
      const at = MELODY.slice(0, i).reduce((s, m) => s + m.d + 0.06, 0);
      setTimeout(() => {
        const el2 = document.querySelector(`.thing[data-id="${ANSWER[i]}"]`);
        el2?.classList.remove("glow"); void el2?.offsetWidth; el2?.classList.add("glow");
      }, at * 1000);
    });
    setTimeout(() => whistleNotes(), (len + 0.6) * 1000);
  }, 900);
}

function draw() {
  const box = $("progress");
  box.replaceChildren(...ANSWER.map((_, i) => {
    const s = document.createElement("i");
    s.className = i < state.seq.length ? "on" : "";
    return s;
  }));
  box.classList.toggle("done", state.solved);
  const last = state.last;
  $("status").textContent = state.solved
    ? "Ребра загули всі разом — мелодія склалася. Щось у глибині острова відповіло."
    : last && !last.ok ? `${last.who ?? "Хтось"}: фальшива нота. Мелодія обірвалась — спочатку.`
    : state.seq.length ? `Звучить ${state.seq.length} з ${ANSWER.length}…`
    : state.fails >= 3 ? "Мелодія не складається. Може, хтось на кораблі її пам'ятає?"
    : "";
  document.body.classList.toggle("solved", state.solved);
  for (const b of $("things").children) b.disabled = state.solved;

  // уривки, які гравці вже чули: можна переслухати в себе
  $("frags").replaceChildren(...FRAGMENTS.map((notes, k) => {
    const b = document.createElement("button");
    b.type = "button";
    const got = heard.includes(k);
    b.className = got ? "frag" : "frag none";
    b.textContent = got ? `▶ Уривок ${k + 1}` : `Уривок ${k + 1} — ще не чули`;
    b.disabled = !got;
    b.onclick = () => { audio(); whistleNotes(notes); };
    return b;
  }));
}
