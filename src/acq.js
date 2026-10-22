// Записник знайомств: усі NPC, з якими познайомились герої. Гравець веде власні нотатки й ставлення —
// вони лишаються лише в його браузері. Майстер бачить сам список і може прибрати помилковий запис.
import OBR from "@owlbear-rodeo/sdk";
import "./acq.css";
import { ACQ, ACQ_REQ, ACQ_DATA, ACQ_DEL } from "./state.js";
import { acqList, saveAcq, acqNotes, saveAcqNotes, mergeAcq, LIST, MOODS, keyOf } from "./acq-data.js";

const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let mood = "all";

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  document.body.classList.toggle("is-gm", gm);
  $("close").onclick = () => OBR.modal.close(ACQ);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) OBR.modal.close(ACQ); });
  $("q").addEventListener("input", draw);
  $("sort").onchange = draw;
  chips();
  window.addEventListener("storage", (e) => { if (e.key === LIST(room)) draw(); });
  if (!gm) {
    OBR.broadcast.onMessage(ACQ_DATA, (e) => { if (mergeAcq(room, e.data?.list)) draw(); });
    OBR.broadcast.sendMessage(ACQ_REQ, {}, { destination: "REMOTE" }).catch(() => {});
  }
  draw();
});

function chips() {
  const box = $("moods");
  box.hidden = gm;
  const all = { all: "Усі", ...MOODS };
  delete all[""];
  for (const [k, v] of Object.entries(all)) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.k = k; b.textContent = v;
    b.onclick = () => { mood = k; for (const c of box.children) c.classList.toggle("on", c.dataset.k === mood); draw(); };
    box.appendChild(b);
  }
  box.firstChild.classList.add("on");
}

const day = (t) => (t ? new Date(t).toLocaleDateString("uk-UA", { day: "numeric", month: "long" }) : "");

function draw() {
  const list = acqList(room);
  const notes = gm ? {} : acqNotes(room);
  const q = $("q").value.trim().toLowerCase();
  const by = $("sort").value;
  const rows = Object.entries(list)
    .filter(([k, v]) => (mood === "all" || (notes[k]?.m ?? "") === mood) && (!q || `${v.name} ${v.sub} ${v.where} ${notes[k]?.t ?? ""}`.toLowerCase().includes(q)))
    .sort(([, a], [, b]) => (by === "name" ? a.name.localeCompare(b.name, "uk") : by === "first" ? a.first - b.first : b.last - a.last));
  const n = Object.keys(list).length;
  $("prog").textContent = n ? `Знайомих: ${n}` : "";
  const grid = $("grid");
  if (!rows.length) {
    grid.innerHTML = `<div class="empty">${n ? "Нікого не знайдено." : gm
      ? "Поки порожньо. Записи з'являються самі, коли ти «Представляєш» NPC усім (ПКМ на токені → «Представити» → «Показати всім») або знайомиш героїв із дамою в Оксамитовій книзі."
      : "Поки порожньо. Коли майстер представить вам когось — він з'явиться тут, і ти зможеш записати, що про нього думаєш."}</div>`;
    return;
  }
  // не перемальовуємо картку, в якій гравець саме пише
  const active = document.activeElement?.closest?.(".acq")?.dataset.k;
  if (active && grid.querySelector(`.acq[data-k="${CSS.escape(active)}"]`) && rows.length === grid.children.length) return;
  grid.innerHTML = "";
  for (const [k, v] of rows) grid.appendChild(card(k, v, notes[k] ?? {}));
}

function card(k, v, note) {
  const el = document.createElement("article");
  el.className = `acq m-${note.m || "none"}`;
  el.dataset.k = k;
  el.innerHTML = `
    <div class="ph">${v.img ? `<img alt="" src="${esc(v.img)}" onerror="this.remove()">` : ""}<span>${esc(v.name.slice(0, 1))}</span></div>
    <div class="tx">
      <h2>${esc(v.name)}</h2>
      ${v.sub ? `<div class="sub">${esc(v.sub)}</div>` : ""}
      <div class="met">Вперше: ${esc(day(v.first))}${v.where ? ` · ${esc(v.where)}` : ""}${(v.n ?? 1) > 1 ? ` · зустрічей: ${v.n}` : ""}</div>
    </div>`;
  if (gm) {
    const del = document.createElement("button");
    del.type = "button"; del.className = "del"; del.title = "Прибрати із записника (в усіх)"; del.textContent = "✕";
    del.onclick = () => remove(k, v.name);
    el.appendChild(del);
    return el;
  }
  const mine = document.createElement("div");
  mine.className = "mine";
  const sel = document.createElement("select");
  for (const [m, t] of Object.entries(MOODS)) sel.appendChild(new Option(m ? t : "Ставлення…", m));
  sel.value = note.m ?? "";
  const ta = document.createElement("textarea");
  ta.rows = 3; ta.maxLength = 600; ta.placeholder = "Мої нотатки: що знаю, що обіцяв, чого чекати…";
  ta.value = note.t ?? "";
  const save = () => {
    const all = acqNotes(room);
    all[k] = { t: ta.value, m: sel.value };
    saveAcqNotes(room, all);
    el.className = `acq m-${sel.value || "none"}`;
  };
  sel.onchange = save;
  let t = null;
  ta.oninput = () => { clearTimeout(t); t = setTimeout(save, 400); };
  ta.onblur = save;
  mine.append(sel, ta);
  el.appendChild(mine);
  return el;
}

async function remove(k, name) {
  const all = acqList(room);
  delete all[keyOf(k)];
  saveAcq(room, all);
  await OBR.broadcast.sendMessage(ACQ_DEL, { k }, { destination: "REMOTE" }).catch(() => {});
  toast(`«${name}» прибрано із записника`);
  draw();
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
