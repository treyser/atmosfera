// Книга чуток: майстер розповідає, партія вирішує, чи вірити, а будь-яку чутку можна приколоти
// до дошки розслідувань як улику.
import OBR from "@owlbear-rodeo/sdk";
import "./rumors.css";
import { RUMOR, RUMOR_DATA, RUMOR_REQ, RUMOR_TELL, RUMOR_VOTE, BOARD_OP } from "./state.js";
import { appendLog } from "./log.js";
import { readSheet } from "./shop-data.js";
import { RUMORS, HEARD, TRUTH, VOTES, uid, rumors, saveRumors, heard, saveHeard, forPlayers } from "./rumor-data.js";
import { boards, saveBoards, seenBoards, saveSeenBoards, newItem, apply, W, H } from "./board-data.js";

const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let me = { id: "", name: "", color: "#e8c27a" };
let list = [];
let filter = "all";
let editing = "";

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  me = { id: await OBR.player.getId(), name: (readSheet(room)?.data?.name || "").trim() || (await OBR.player.getName()), color: await OBR.player.getColor().catch(() => "#e8c27a") };
  document.body.classList.toggle("gm", gm);
  $("close").onclick = () => OBR.modal.close(RUMOR);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) OBR.modal.close(RUMOR); });
  for (const b of document.querySelectorAll("#filt button")) b.onclick = () => { filter = b.dataset.f; for (const x of document.querySelectorAll("#filt button")) x.classList.toggle("on", x === b); draw(); };
  document.addEventListener("click", (e) => { if (!e.target.closest("#pinmenu") && !e.target.closest("[data-a=pin]")) $("pinmenu").hidden = true; });

  if (gm) {
    list = rumors();
    window.addEventListener("storage", (e) => { if (e.key === RUMORS && !editing) { list = rumors(); draw(); } });
    $("add").onclick = () => {
      const r = { id: uid(), text: "", who: "", where: "", truth: "half", heard: false, verdict: "", votes: {}, at: 0 };
      list.unshift(r);
      saveRumors(list);
      editing = r.id;
      filter = "hidden";
      for (const x of document.querySelectorAll("#filt button")) x.classList.toggle("on", x.dataset.f === "hidden");
      draw();
    };
    $("random").onclick = () => {
      const pool = list.filter((r) => !r.heard && r.text);
      if (!pool.length) return toast("Усі чутки вже розказано");
      tell(pool[Math.floor(Math.random() * pool.length)]);
    };
  } else {
    list = heard(room);
    OBR.broadcast.onMessage(RUMOR_DATA, (e) => { if (Array.isArray(e.data)) { list = e.data; saveHeard(room, list); draw(); } });
    window.addEventListener("storage", (e) => { if (e.key === HEARD(room)) { list = heard(room); draw(); } });
    OBR.broadcast.sendMessage(RUMOR_REQ, {}, { destination: "REMOTE" }).catch(() => {});
  }
  draw();
});

// ---------- майстер ----------

function commit() {
  saveRumors(list);
  OBR.broadcast.sendMessage(RUMOR_DATA, forPlayers(list), { destination: "REMOTE" }).catch(() => {});
  draw();
}
async function tell(r) {
  r.heard = true;
  r.at = Date.now();
  commit();
  await OBR.broadcast.sendMessage(RUMOR_TELL, { r: { text: r.text, who: r.who, where: r.where } }, { destination: "REMOTE" }).catch(() => {});
  appendLog({ k: "g", t: `Чутка${r.who ? ` (${r.who})` : ""}: «${r.text.slice(0, 160)}»`, w: "Майстер" }).catch(() => {});
  toast("Розказано всім");
}

// ---------- малювання ----------

function shown() {
  if (filter === "hidden") return list.filter((r) => !r.heard);
  const h = list.filter((r) => r.heard).sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  if (filter === "open") return h.filter((r) => !r.verdict);
  if (filter === "solved") return h.filter((r) => r.verdict);
  return h;
}

function draw() {
  if (gm) $("hid-n").textContent = String(list.filter((r) => !r.heard).length);
  const wall = $("wall");
  wall.innerHTML = "";
  const items = shown();
  if (!items.length) {
    wall.innerHTML = `<div class="none">${filter === "hidden" ? "Усі чутки вже розказано. ＋ — дописати нову." : gm ? "Ще жодної чутки не розказано. Відкрий «Не розказані» або натисни 🎲." : "Поки що в тавернах тихо. Чутки з'являться, коли герої щось почують."}</div>`;
    return;
  }
  for (const r of items) wall.appendChild(slip(r));
}

function slip(r) {
  const el = document.createElement("div");
  el.className = `slip${r.verdict ? ` v-${r.verdict}` : ""}${!r.heard ? " hid" : ""}`;
  el.style.setProperty("--r", `${((r.id.charCodeAt(r.id.length - 1) % 7) - 3) * 0.7}deg`);
  if (gm && editing === r.id) {
    el.innerHTML = `<textarea class="et" rows="4" maxlength="400" placeholder="Що кажуть…"></textarea>
      <input class="ew" maxlength="60" placeholder="Хто розповів"><input class="ep" maxlength="60" placeholder="Де (не обов'язково)">
      <label class="tr">Насправді: <select class="es">${Object.entries(TRUTH).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}</select></label>
      <div class="acts"><button type="button" class="go sm" data-a="done">Готово</button></div>`;
    el.querySelector(".et").value = r.text; el.querySelector(".ew").value = r.who; el.querySelector(".ep").value = r.where || ""; el.querySelector(".es").value = r.truth;
    el.querySelector("[data-a=done]").onclick = () => {
      r.text = el.querySelector(".et").value.trim(); r.who = el.querySelector(".ew").value.trim(); r.where = el.querySelector(".ep").value.trim(); r.truth = el.querySelector(".es").value;
      editing = "";
      if (!r.text) list = list.filter((x) => x !== r);
      commit();
    };
    setTimeout(() => el.querySelector(".et").focus(), 30);
    return el;
  }
  const votes = Object.entries(r.votes ?? {});
  el.innerHTML = `<i class="tack"></i>
    <div class="rk">кажуть, що…</div>
    <div class="rx"></div>
    <div class="rw"></div>
    ${gm ? `<div class="truth t-${r.truth}">🔒 насправді: ${TRUTH[r.truth] ?? "?"}</div>` : ""}
    ${r.heard ? `<div class="votes">${votes.map(([n, v]) => `<span class="vo v${v}" title="${VOTES[v]}">${esc(n)}: ${VOTES[v]}</span>`).join("")}</div>` : ""}
    ${r.verdict ? `<b class="stamp s-${r.verdict}">${(TRUTH[r.verdict] ?? "").toUpperCase()}</b>` : ""}
    <div class="acts"></div>`;
  el.querySelector(".rx").textContent = r.text || "(порожньо)";
  el.querySelector(".rw").textContent = `— ${r.who || "хтось у таверні"}${r.where ? `, ${r.where}` : ""}`;
  const acts = el.querySelector(".acts");
  const btn = (label, cls, fn, a) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; if (a) b.dataset.a = a; b.onclick = fn; acts.appendChild(b); };
  if (!gm && r.heard && !r.verdict) {
    const mine = r.votes?.[me.name];
    for (const [k, v] of Object.entries(VOTES)) btn(v, `vote${mine === k ? " on" : ""}`, () => vote(r, k));
  }
  if (r.heard) btn("📌 На дошку", "ghost sm", (e) => pinMenu(r, e.currentTarget), "pin");
  if (gm) {
    if (!r.heard) btn("Розповісти всім", "go sm", () => tell(r));
    else if (!r.verdict) for (const [k, v] of Object.entries(TRUTH)) btn(`= ${v}`, "ghost sm", () => verdict(r, k));
    else btn("Зняти штамп", "ghost sm", () => { r.verdict = ""; commit(); });
    btn("✎", "ghost sm", () => { editing = r.id; draw(); });
    let armed = 0;
    btn("🗑", "ghost sm", () => { if (Date.now() - armed > 3000) { armed = Date.now(); return toast("Ще раз — і чутку видалено"); } list = list.filter((x) => x !== r); commit(); });
  }
  return el;
}

function vote(r, v) {
  r.votes = { ...(r.votes ?? {}), [me.name]: v };
  saveHeard(room, list);
  draw();
  OBR.broadcast.sendMessage(RUMOR_VOTE, { id: r.id, who: me.name, v }, { destination: "REMOTE" }).catch(() => {});
}

function verdict(r, k) {
  r.verdict = k;
  commit();
  appendLog({ k: "g", t: `Чутка «${r.text.slice(0, 80)}» — ${TRUTH[k].toLowerCase()}.`, w: "Майстер" }).catch(() => {});
}

// ---------- на дошку розслідувань ----------

function pinMenu(r, anchor) {
  const cases = (gm ? boards().list : seenBoards(room)).filter((c) => !c.closed);
  const box = $("pm-cases");
  box.innerHTML = "";
  if (!cases.length) box.innerHTML = `<div class="dim">${gm ? "Спершу створи справу на дошці розслідувань." : "Майстер ще не відкрив жодної справи."}</div>`;
  for (const c of cases) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = c.name;
    b.onclick = () => { pin(r, c.id); $("pinmenu").hidden = true; };
    box.appendChild(b);
  }
  const rr = anchor.getBoundingClientRect();
  const m = $("pinmenu");
  m.hidden = false;
  m.style.left = `${Math.min(window.innerWidth - 230, rr.left)}px`;
  m.style.top = `${Math.min(window.innerHeight - 160, rr.bottom + 6)}px`;
}

function pin(r, k) {
  const item = newItem("rumor", { text: r.text, who: r.who, where: r.where, by: me.name, byId: me.id, byc: me.color }, W / 2 + (Math.random() * 600 - 300), H / 2 + (Math.random() * 400 - 200));
  const op = { op: "add", k, item };
  if (gm) { const b = boards(); apply(b.list, op); saveBoards(b); }
  else { const l = seenBoards(room); apply(l, op); saveSeenBoards(room, l); }
  OBR.broadcast.sendMessage(BOARD_OP, op, { destination: "REMOTE" }).catch(() => {});
  toast("Приколото на дошку розслідувань");
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
