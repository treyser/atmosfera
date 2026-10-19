// «Оксамитова книга»: куртизанки. Майстер знайомить героїв із дамою (картка відкривається гравцям),
// гравці ставлять оцінку 1–5 і пишуть короткий відгук — бачать усі. Таємницю бачить лише майстер.
import OBR from "@owlbear-rodeo/sdk";
import "./court.css";
import { COURT as WIN, COURT_DATA, COURT_REQ, COURT_SHOW, COURT_RATE } from "./state.js";
import * as CD from "./court-data.js";
import { loadCourt, lady, opened, saveOpened, seen, saveSeen, rates, saveRates, RATES, SEEN, FOCUS, applyRate, pack, avg, stars, gp, MAX_REVIEW } from "./court-data.js";

const $ = (id) => document.getElementById(id);
const list = () => CD.COURT;
let gm = false;
let room = "";
let me = "";
let myName = "";
let open = new Set();
let all = {};
let sel = CD.COURT[0]?.id;
let house = "all";
let pickS = 0;

OBR.onReady(async () => {
  await loadCourt();
  if (!list().some((x) => x.id === sel)) sel = list()[0]?.id;
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  me = await OBR.player.getId();
  myName = await OBR.player.getName();
  document.body.classList.toggle("is-gm", gm);
  $("close").onclick = () => OBR.modal.close(WIN);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) OBR.modal.close(WIN); });
  $("q").addEventListener("input", drawGrid);
  $("sort").onchange = drawGrid;
  houses();
  initMine();
  all = rates(room);

  if (gm) {
    open = new Set(opened(room));
    initGM();
    // відгуки гравців записує фоновий скрипт — тут лише оновлюємося
    window.addEventListener("storage", (e) => { if (e.key === RATES(room)) { all = rates(room); draw(); } });
  } else {
    open = new Set(seen(room));
    window.addEventListener("storage", (e) => {
      if (e.key === SEEN(room) || e.key === RATES(room) || e.key === FOCUS) { open = new Set(seen(room)); all = rates(room); focus(); draw(); }
    });
    OBR.broadcast.onMessage(COURT_DATA, (e) => {
      if (Array.isArray(e.data?.ids)) { open = new Set(e.data.ids); saveSeen(room, e.data.ids); }
      if (e.data?.rates) { all = e.data.rates; saveRates(room, all); }
      draw();
    });
    OBR.broadcast.sendMessage(COURT_REQ, {}, { destination: "REMOTE" }).catch(() => {});
    focus();
  }
  draw();
});

function focus() {
  try {
    const f = JSON.parse(localStorage.getItem(FOCUS) || "null");
    if (f?.id && Date.now() - f.at < 60000 && lady(f.id)) { sel = f.id; localStorage.removeItem(FOCUS); }
  } catch {}
}

function houses() {
  const box = $("houses");
  const names = [...new Set(list().map((x) => x.house).filter(Boolean))];
  box.hidden = names.length < 2;
  const opts = [["all", "Усі заклади"], ...names.map((n) => [n, n])];
  const paint = () => { for (const b of box.children) b.classList.toggle("on", b.dataset.k === house); };
  for (const [k, t] of opts) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.k = k; b.textContent = t;
    b.onclick = () => { house = k; paint(); drawGrid(); };
    box.appendChild(b);
  }
  paint();
}

const visible = (x) => gm || open.has(x.id);

function draw() { drawGrid(); drawCard(); }

function drawGrid() {
  const q = $("q").value.trim().toLowerCase();
  const grid = $("grid");
  grid.innerHTML = "";
  const known = list().filter((x) => open.has(x.id)).length;
  $("prog").textContent = gm ? `${list().length} дам · героям знайомі ${known}` : `Знайомі дами: ${known}/${list().length}`;
  const by = $("sort").value;
  const rows = [...list()].sort((a, b) => {
    if (by === "top") return (avg(all[b.id])?.v ?? -1) - (avg(all[a.id])?.v ?? -1);
    if (by === "price") return (Number(a.price) || 1e9) - (Number(b.price) || 1e9);
    return 0;
  });
  for (const x of rows) {
    if (house !== "all" && x.house !== house) continue;
    const vis = visible(x);
    if (q && !(vis && `${x.name} ${x.race} ${x.talent} ${x.house}`.toLowerCase().includes(q))) continue;
    const a = vis ? avg(all[x.id]) : null;
    const el = document.createElement("button");
    el.type = "button";
    el.className = `wcard${vis ? "" : " locked"}${x.id === sel ? " sel" : ""}${gm && !open.has(x.id) ? " hid" : ""}`;
    el.innerHTML = `<div class="pic"><img alt="" loading="lazy" src="${esc(x.img)}">${vis ? "" : `<span class="q">?</span>`}</div>
      <div class="nm">${vis ? esc(x.name) : "Незнайомка"}</div>
      <div class="sub">${vis ? esc(x.talent || x.race || "") : esc(x.house || "")}</div>
      ${a ? `<div class="rt">${stars(a.v)} <span>${a.v.toFixed(1).replace(".", ",")} · ${a.n}</span></div>` : ""}`;
    el.onclick = () => { sel = x.id; draw(); };
    grid.appendChild(el);
  }
  if (!grid.children.length) grid.innerHTML = `<div class="dim pad">${list().length ? "Нікого не знайдено." : "Книга поки порожня."}</div>`;
}

function drawCard() {
  const x = lady(sel);
  $("none").hidden = Boolean(x);
  $("sheet").hidden = !x;
  if (!x) return;
  const vis = visible(x);
  $("card").classList.toggle("locked", !vis);
  $("img").src = x.img;
  $("lock").hidden = vis;
  $("meta").textContent = vis ? [x.house, x.race, x.age].filter(Boolean).join(" · ") : (x.house || "");
  $("name").textContent = vis ? x.name : "Незнайомка";
  const a = vis ? avg(all[x.id]) : null;
  $("score").innerHTML = a ? `<span class="st">${stars(a.v)}</span> <b>${a.v.toFixed(1).replace(".", ",")}</b> <span class="dim">· відгуків: ${a.n}</span>` : vis ? `<span class="dim">Ще ніхто не оцінив</span>` : "";
  $("stats").innerHTML = vis
    ? `<div><span>Талант</span><b>${esc(x.talent || "—")}</b></div><div><span>Вечір</span><b>${esc(gp(x.price))}</b></div>`
    : "";
  $("desc").textContent = vis ? x.desc || "" : "Про неї лише шепочуться. Можливо, герої ще з нею познайомляться.";
  $("about").textContent = vis ? x.about || "" : "";
  $("about").hidden = !vis || !x.about;
  $("likes").textContent = x.likes || "";
  $("likes-box").hidden = !vis || !x.likes;
  $("quote").textContent = x.quote ? `«${x.quote}»` : "";
  $("quote").hidden = !vis || !x.quote;
  drawReviews(x, vis);
  if (gm) {
    $("secret").textContent = x.secret || "";
    $("secret-box").hidden = !x.secret;
    $("open").checked = open.has(x.id);
    $("gm-hint").textContent = open.has(x.id) ? "Гравці бачать картку й можуть ставити оцінки." : "Гравці бачать лише «Незнайомка» — доки ти їх не познайомиш.";
  }
}

function drawReviews(x, vis) {
  const box = $("reviews");
  const card = all[x.id] ?? {};
  const rows = Object.entries(card).sort((a, b) => b[1].at - a[1].at);
  box.innerHTML = vis && rows.length ? `<b class="h">Відгуки</b>` : "";
  if (!vis) { $("mine").hidden = true; return; }
  for (const [pid, r] of rows) {
    const d = document.createElement("div");
    d.className = "rev";
    d.innerHTML = `<div class="who"><span class="st">${stars(r.s)}</span> <b>${esc(r.n)}</b>${gm ? `<button type="button" class="x" title="Прибрати відгук">✕</button>` : ""}</div>${r.t ? `<p>${esc(r.t)}</p>` : ""}`;
    if (gm) d.querySelector(".x").onclick = () => moderate(x.id, pid);
    box.appendChild(d);
  }
  if (!gm) {
    $("mine").hidden = false;
    const mine = card[me];
    pickS = mine?.s ?? 0;
    $("review").value = mine?.t ?? "";
    $("unrate").hidden = !mine;
    paintPick();
  }
}

// ---------- гравець: оцінка ----------
function initMine() {
  const box = $("pick");
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = "★"; b.dataset.s = i; b.title = `${i} з 5`;
    b.onclick = () => { pickS = i; paintPick(); };
    box.appendChild(b);
  }
  $("rate").onclick = () => {
    if (!pickS) return toast("Вибери від 1 до 5 зірок");
    sendRate(pickS, $("review").value.slice(0, MAX_REVIEW));
  };
  $("unrate").onclick = () => sendRate(0, "");
}
function paintPick() { for (const b of $("pick").children) b.classList.toggle("on", Number(b.dataset.s) <= pickS); }
async function sendRate(s, t) {
  const x = lady(sel);
  if (!x) return;
  const msg = { id: x.id, s, t, n: myName, from: me };
  all = applyRate(all, me, msg);   // одразу в себе; майстер розішле всім
  saveRates(room, all);
  draw();
  await OBR.broadcast.sendMessage(COURT_RATE, msg, { destination: "REMOTE" }).catch(() => {});
  toast(s ? "Оцінку збережено" : "Оцінку прибрано");
}

// ---------- майстер ----------
function initGM() {
  $("gm").hidden = false;
  $("open").onchange = () => setOpen(sel, $("open").checked);
  $("show").onclick = async () => {
    const x = lady(sel);
    setOpen(x.id, true);
    await OBR.broadcast.sendMessage(COURT_SHOW, { id: x.id }, { destination: "REMOTE" }).catch(() => {});
    toast(`Герої знайомляться: ${x.name}`);
  };
}
function broadcast() {
  OBR.broadcast.sendMessage(COURT_DATA, pack([...open], all), { destination: "REMOTE" }).catch(() => {});
}
function setOpen(id, on) {
  if (on) open.add(id); else open.delete(id);
  saveOpened(room, [...open]);
  broadcast();
  draw();
}
function moderate(id, pid) {
  all = rates(room);
  if (all[id]) { delete all[id][pid]; if (!Object.keys(all[id]).length) delete all[id]; }
  saveRates(room, all);
  broadcast();
  draw();
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
