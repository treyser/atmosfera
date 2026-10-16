// Дошка розслідувань: корок, шпильки, нитки. Майстер викладає улики, уся партія розкладає їх,
// тягне нитки й лишає записки — усе наживо. Кожна дія — операція (board-data.js), яку застосовують усі.
import OBR from "@owlbear-rodeo/sdk";
import "./board.css";
import { BOARD, BOARD_OP, BOARD_REQ, BOARD_FULL, BOARD_CUR, BOARD_SHOW } from "./state.js";
import { appendLog } from "./log.js";
import { readSheet } from "./shop-data.js";
import { POINTS, REGIONS } from "./atlas-points.js";
import { inscriptions, carve } from "./runes-data.js";
import { bestiary, BIOMES } from "./best-data.js";
import { catalog, LOOT, CATS } from "./chest-data.js";
import {
  W, H, KINDS, NOTE_COLORS, YARN, STAMPS, uid, boards, saveBoards, newCase, newItem, publicCase,
  apply, seenBoards, saveSeenBoards, SEEN, BOARDS,
} from "./board-data.js";

const BASE = import.meta.env.BASE_URL;
const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let me = { id: "", name: "", color: "#e8c27a" };
let list = [];            // справи
let cur = "";             // відкрита справа
let yarnColor = "red";
let view = { x: 0, y: 0, s: 0.5 };
const els = new Map();    // id улики → елемент
let fresh = new Set();    // щойно викладені — з анімацією

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  me = {
    id: await OBR.player.getId(),
    name: (readSheet(room)?.data?.name || "").trim() || (await OBR.player.getName()),
    color: await OBR.player.getColor().catch(() => "#e8c27a"),
  };
  document.body.classList.toggle("gm", gm);
  $("who").textContent = gm ? "майстер" : me.name;
  $("close").onclick = () => OBR.modal.close(BOARD);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !editing()) { if (!$("ymenu").hidden) return hideMenu(); OBR.modal.close(BOARD); }
  });
  buildTools();
  setupView();

  OBR.broadcast.onMessage(BOARD_OP, (e) => receive(e.data));
  OBR.broadcast.onMessage(BOARD_CUR, (e) => cursor(e.data));
  if (gm) {
    list = boards().list;
    initGM();
  } else {
    list = seenBoards(room);
    OBR.broadcast.onMessage(BOARD_FULL, (e) => full(e.data));
    OBR.broadcast.sendMessage(BOARD_REQ, {}, { destination: "REMOTE" }).catch(() => {});
    window.addEventListener("storage", (e) => { if (e.key === SEEN(room)) { list = seenBoards(room); drawAll(); } });
  }
  const want = new URLSearchParams(location.search).get("k") || lastCase();
  cur = list.find((c) => c.id === want)?.id ?? list.find((c) => !c.closed && c.items.length)?.id ?? list[0]?.id ?? "";
  $("cork").style.backgroundImage = `radial-gradient(ellipse at 50% 35%, rgba(255,225,180,.16), transparent 65%), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(40,20,5,.35)), url(${makeCork()})`;
  drawAll();
  fit();
});

// остання відкрита справа — у браузері кожного
const LAST = "atmosfera.board-last";
const lastCase = () => { try { return localStorage.getItem(LAST) || ""; } catch { return ""; } };
const rememberCase = (id) => { try { localStorage.setItem(LAST, id); } catch {} };

// Корок: крихта різних відтінків на плитці без швів
function makeCork() {
  const N = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = N;
  const g = cv.getContext("2d");
  g.fillStyle = "#a66f3c";
  g.fillRect(0, 0, N, N);
  const blob = (x, y, rx, ry, a, col) => {
    for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) {
      const cx = x + dx, cy = y + dy;
      if (cx < -8 || cx > N + 8 || cy < -8 || cy > N + 8) continue;
      g.beginPath(); g.ellipse(cx, cy, rx, ry, a, 0, Math.PI * 2); g.fillStyle = col; g.fill();
    }
  };
  for (let i = 0; i < 9000; i++) {
    const t = Math.random();
    const col = t < 0.42 ? `rgba(${70 + Math.random() * 30},${38 + Math.random() * 18},${14 + Math.random() * 10},${0.25 + Math.random() * 0.45})`
      : t < 0.85 ? `rgba(${190 + Math.random() * 40},${140 + Math.random() * 35},${85 + Math.random() * 30},${0.2 + Math.random() * 0.4})`
      : `rgba(${45 + Math.random() * 20},${24 + Math.random() * 10},${8},${0.5 + Math.random() * 0.4})`;
    const r = t > 0.85 ? 0.6 + Math.random() * 1.2 : 0.8 + Math.random() * 3.2;
    blob(Math.random() * N, Math.random() * N, r, r * (0.5 + Math.random() * 0.6), Math.random() * Math.PI, col);
  }
  const img = g.getImageData(0, 0, N, N);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    img.data[i] += n; img.data[i + 1] += n * 0.8; img.data[i + 2] += n * 0.6;
  }
  g.putImageData(img, 0, 0);
  return cv.toDataURL("image/png");
}

const editing = () => document.activeElement && (/INPUT|TEXTAREA/.test(document.activeElement.tagName) || document.activeElement.isContentEditable);
const kase = () => list.find((c) => c.id === cur) ?? null;

// ---------- синхронізація ----------

// гравець: повна копія від майстра (шматками)
let incoming = null;
function full(d) {
  if (!d) return;
  if (d.reset) { incoming = []; return; }
  if (!incoming) incoming = [];
  if (d.c) incoming.push(d.c);
  if (d.k) { const c = incoming.find((x) => x.id === d.k); if (c) c.items.push(...d.items); }
  if (d.done) {
    list = incoming; incoming = null;
    saveSeenBoards(room, list);
    if (!list.some((c) => c.id === cur)) cur = list.at(-1)?.id ?? "";
    drawAll();
  }
}

// чужа операція
function receive(op) {
  if (!op) return;
  if (gm && op.op === "add" && list.find((c) => c.id === op.k)?.items.some((i) => i.id === op.item.id && i.hidden)) return;
  const isNew = op.op === "add" && !kase()?.items.some((i) => i.id === op.item.id);
  if (!apply(list, op)) return;
  if (!gm) saveSeenBoards(room, list);
  if (isNew && op.k === cur) fresh.add(op.item.id);
  if (op.op === "case" || op.k !== cur) return drawTabs();
  if (op.op === "move") return place(op.id);
  drawAll();
}

// моя операція: застосувати в себе й розіслати
function send(op, opts = {}) {
  apply(list, op);
  if (gm) saveBoards({ list });
  else saveSeenBoards(room, list);
  if (!opts.local) OBR.broadcast.sendMessage(BOARD_OP, op, { destination: "REMOTE" }).catch(() => {});
}
// для гравців — без прихованого
function sendItem(item) {
  if (item.hidden) return send({ op: "add", k: cur, item }, { local: true });
  const { gm: secret, ...pub } = item;
  apply(list, { op: "add", k: cur, item });
  if (gm) saveBoards({ list }); else saveSeenBoards(room, list);
  OBR.broadcast.sendMessage(BOARD_OP, { op: "add", k: cur, item: pub }, { destination: "REMOTE" }).catch(() => {});
}

// ---------- вигляд: зум і пересування ----------

function setupView() {
  const vp = $("vp");
  let pan = null;
  vp.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".it, .tag, .ymenu, .ycatch")) return;
    hideMenu();
    pan = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    vp.setPointerCapture(e.pointerId);
    vp.classList.add("panning");
  });
  vp.addEventListener("pointermove", (e) => {
    if (pan) { view.x = pan.vx + e.clientX - pan.x; view.y = pan.vy + e.clientY - pan.y; applyView(); }
    torch(e);
    sendCursor(e);
  });
  vp.addEventListener("pointerup", () => { pan = null; vp.classList.remove("panning"); });
  vp.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = vp.getBoundingClientRect();
    const mx = e.clientX - r.left, my = e.clientY - r.top;
    const k = Math.exp(-e.deltaY * 0.0015);
    const s = Math.min(1.6, Math.max(0.18, view.s * k));
    view.x = mx - ((mx - view.x) * s) / view.s;
    view.y = my - ((my - view.y) * s) / view.s;
    view.s = s;
    applyView();
  }, { passive: false });
  window.addEventListener("resize", () => applyView());
}
function applyView() {
  $("frame").style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
}
function fit() {
  const r = $("vp").getBoundingClientRect();
  const its = (kase()?.items ?? []).filter((i) => !i.hidden);
  // є улики — показати саме їх, крупніше; немає — усю дошку
  let x0 = 0, y0 = 0, x1 = W, y1 = H;
  if (its.length) {
    x0 = Math.min(...its.map((i) => i.x)) - 220; x1 = Math.max(...its.map((i) => i.x)) + 220;
    y0 = Math.min(...its.map((i) => i.y)) - 220; y1 = Math.max(...its.map((i) => i.y)) + 220;
  }
  const s = Math.min(0.95, (r.width - 40) / (x1 - x0), (r.height - 40) / (y1 - y0));
  view.s = s;
  view.x = r.width / 2 - ((x0 + x1) / 2 + 60) * s;
  view.y = r.height / 2 - ((y0 + y1) / 2 + 60) * s;
  applyView();
}
// екран → дошка
function toBoard(cx, cy) {
  const r = $("cork").getBoundingClientRect();
  return { x: (cx - r.left) / view.s, y: (cy - r.top) / view.s };
}
function centerOfView() {
  const r = $("vp").getBoundingClientRect();
  const p = toBoard(r.left + r.width / 2, r.top + r.height / 2);
  return { x: Math.max(160, Math.min(W - 160, p.x + (Math.random() * 160 - 80))), y: Math.max(160, Math.min(H - 160, p.y + (Math.random() * 100 - 50))) };
}

// ---------- інструменти ----------

function buildTools() {
  for (const [k, y] of Object.entries(YARN)) {
    if (k === "gold" && !gm) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spool";
    b.title = `Нитка: ${y.name}`;
    b.style.setProperty("--y", y.color);
    b.classList.toggle("on", k === yarnColor);
    b.onclick = () => { yarnColor = k; for (const x of document.querySelectorAll(".spool")) x.classList.toggle("on", x === b); };
    $("spools").appendChild(b);
  }
  $("t-note").onclick = () => addNote("note");
  $("t-q").onclick = () => addNote("question");
  $("t-fit").onclick = fit;
  $("t-torch").onclick = () => { $("torch").hidden = !$("torch").hidden; $("t-torch").classList.toggle("on", !$("torch").hidden); };
}

function addNote(kind) {
  if (!kase()) return toast("Справи ще немає");
  if (kase().closed) return toast("Справу закрито");
  const p = centerOfView();
  const item = newItem(kind, { text: "", color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)], by: me.name, byId: me.id, byc: me.color }, p.x, p.y);
  fresh.add(item.id);
  sendItem(item);
  pinSound();
  drawItems();
  setTimeout(() => edit(item.id), 60);
}

// ---------- малювання ----------

function drawAll() {
  drawTabs();
  drawItems();
  if (gm) drawDrawer();
}

function drawTabs() {
  const box = $("cases");
  box.innerHTML = "";
  for (const c of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab" + (c.id === cur ? " on" : "") + (c.closed ? " shut" : "");
    b.textContent = c.name;
    b.onclick = () => { cur = c.id; rememberCase(cur); hideMenu(); drawAll(); fit(); };
    box.appendChild(b);
  }
  $("empty").hidden = Boolean(kase());
  $("empty").textContent = gm ? "Створи першу справу — ＋ угорі." : "Майстер ще не відкрив жодної справи.";
}

function drawItems() {
  const c = kase();
  const box = $("items");
  const items = (c?.items ?? []).filter((i) => gm || !i.hidden).filter((i) => !i.hidden);
  const ids = new Set(items.map((i) => i.id));
  for (const [id, el] of els) if (!ids.has(id)) { el.remove(); els.delete(id); }
  for (const it of items.sort((a, b) => (a.z ?? 0) - (b.z ?? 0))) {
    const sig = sigOf(it);
    let el = els.get(it.id);
    if (!el || el.dataset.sig !== sig) {
      const nel = renderItem(it);
      nel.dataset.sig = sig;
      if (el) el.replaceWith(nel); else box.appendChild(nel);
      els.set(it.id, nel);
      el = nel;
      if (fresh.has(it.id)) { el.classList.add("drop"); fresh.delete(it.id); setTimeout(() => el.classList.remove("drop"), 900); }
    }
    el.style.zIndex = String(Math.floor(((it.z ?? 0) / 1000) % 1e6));
    place(it.id);
  }
  $("closed").hidden = !c?.closed;
  requestAnimationFrame(drawYarn);
}
const sigOf = (it) => JSON.stringify({ ...it, x: 0, y: 0, z: 0 });

function place(id) {
  const it = kase()?.items.find((i) => i.id === id);
  const el = els.get(id);
  if (!it || !el) return;
  el.style.left = `${it.x}px`;
  el.style.top = `${it.y}px`;
  el.style.setProperty("--r", `${it.rot ?? 0}deg`);
  drawYarn();
}

// точка шпильки (куди чіпляється нитка)
function pinOf(id) {
  const it = kase()?.items.find((i) => i.id === id);
  const el = els.get(id);
  if (!it || !el) return null;
  return { x: it.x, y: it.y - el.offsetHeight / 2 + 14 };
}

function yarnPath(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const sag = Math.min(90, d * 0.12);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 + sag;
  return { d: `M${a.x},${a.y} Q${mx},${my + sag * 0.3} ${b.x},${b.y}`, mid: { x: mx, y: (a.y + b.y) / 2 + sag * 0.65 } };
}

function drawYarn() {
  const c = kase();
  const g = $("yarn-g"), sh = $("yarn-sh"), tags = $("tags");
  g.innerHTML = ""; sh.innerHTML = ""; tags.innerHTML = "";
  if (!c) return;
  for (const l of c.links) {
    const a = pinOf(l.a), b = pinOf(l.b);
    if (!a || !b) continue;
    const { d, mid } = yarnPath(a, b);
    const col = YARN[l.color]?.color ?? YARN.red.color;
    sh.insertAdjacentHTML("beforeend", `<path d="${d}" transform="translate(4,7)" class="ysh"/>`);
    const grp = document.createElementNS("http://www.w3.org/2000/svg", "g");
    grp.innerHTML = `<path d="${d}" class="ybase" style="stroke:${col}"/><path d="${d}" class="yfib"/><path d="${d}" class="ycatch"/>`;
    grp.querySelector(".ycatch").addEventListener("click", (e) => { e.stopPropagation(); openMenu(l, mid); });
    g.appendChild(grp);
    if (l.label) {
      const t = document.createElement("div");
      t.className = "tag";
      t.style.left = `${mid.x}px`; t.style.top = `${mid.y}px`;
      t.textContent = l.label;
      t.onclick = (e) => { e.stopPropagation(); openMenu(l, mid); };
      tags.appendChild(t);
    }
  }
}

// ---------- улики ----------

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
const nl = (s) => esc(s).replace(/\n/g, "<br>");

function renderItem(it) {
  const el = document.createElement("div");
  el.className = `it k-${it.kind}`;
  el.dataset.id = it.id;
  let body = "";
  switch (it.kind) {
    case "photo":
    case "person":
      body = `<div class="pol"><div class="ph">${it.img ? `<img src="${esc(it.img)}" alt="" draggable="false">` : `<span class="sil">👤</span>`}</div>
        <div class="cap">${esc(it.kind === "person" ? it.name : it.cap)}</div>${it.sub ? `<div class="sub">${esc(it.sub)}</div>` : ""}</div>`;
      break;
    case "letter":
      body = `<div class="paper letter"><div class="pt">${esc(it.title)}</div><div class="px">${nl(it.text)}</div>${it.sign ? `<div class="ps">— ${esc(it.sign)}</div>` : ""}<i class="seal"></i></div>`;
      break;
    case "diary":
      body = `<div class="paper diary"><div class="pt">${esc(it.title)}</div><div class="px">${nl(it.text)}</div></div>`;
      break;
    case "notice":
      body = `<div class="paper notice"><div class="nh">${esc(it.title)}</div><div class="px">${nl(it.text)}</div>${it.sign ? `<div class="ps">${esc(it.sign)}</div>` : ""}</div>`;
      break;
    case "order":
      body = `<div class="paper order"><div class="ot">${esc(it.title)}</div><div class="px">${nl(it.text)}</div>${it.sign ? `<div class="ps">${esc(it.sign)}</div>` : ""}<i class="wax"></i><i class="ribbon"></i></div>`;
      break;
    case "note":
      body = `<div class="sticky" style="--n:${esc(it.color || NOTE_COLORS[0])}"><div class="nt" data-edit>${nl(it.text) || (canEdit(it) ? "<span class=ph>двічі клікни, щоб написати…</span>" : "")}</div><div class="by" style="color:${esc(it.byc || "#555")}">${esc(it.by || "")}</div></div>`;
      break;
    case "question":
      body = `<div class="qcard"><div class="qm">?</div><div class="nt" data-edit>${nl(it.text) || (canEdit(it) ? "<span class=ph>що не сходиться?…</span>" : "")}</div><div class="by" style="color:${esc(it.byc || "#555")}">${esc(it.by || "")}</div></div>`;
      break;
    case "map": {
      const p = POINTS.find((x) => x.n === it.n) ?? { u: 0.5, v: 0.5 };
      const fw = 300, fh = 210, mw = 1402 * 1.25, mh = 1122 * 1.25;
      const bx = -(p.u * mw - fw / 2), by = -(p.v * mh - fh / 2);
      body = `<div class="mapcut"><div class="mp" style="background-image:url('${BASE}atlas-map.jpg'); background-size:${mw}px ${mh}px; background-position:${bx}px ${by}px"></div>
        <i class="ring"></i><b class="mn">№${esc(it.n)}</b><div class="mc">${esc(it.cap || REGIONS[p.r] || "")}</div></div>`;
      break;
    }
    case "rune": {
      const lines = carve(it.text).map((w) => w.map((c) => c.g || c.p).join("")).join(" ");
      body = `<div class="slab"><div class="rg">${esc(lines)}</div><div class="rt">${esc(it.title)}</div></div>`;
      break;
    }
    case "beast": {
      const col = BIOMES[it.biome]?.color ?? "#999";
      body = `<div class="bcard" style="--bc:${col}"><div class="bi">${it.img ? `<img src="${esc(it.img)}" alt="" draggable="false">` : `<span>${esc((it.name || "?")[0])}</span>`}</div><div class="bn">${esc(it.name)}</div><div class="bt">${esc(it.type || "")}</div></div>`;
      break;
    }
    case "item":
      body = `<div class="itag"><div class="ii">${it.img ? `<img src="${esc(it.img)}" alt="" draggable="false">` : esc(CATS[it.cat] ?? "🗝")}</div><div class="in">${esc(it.name)}</div><div class="id">${esc(it.desc || "")}</div><i class="string"></i></div>`;
      break;
  }
  const pinCol = it.kind === "note" || it.kind === "question" ? it.byc || "#c8202b" : "#c8202b";
  el.innerHTML = `${body}<i class="pin" style="--p:${esc(pinCol)}" title="Тягни, щоб протягнути нитку"></i>
    ${it.stamp ? `<b class="stamp s-${it.stamp}">${STAMPS[it.stamp]}</b>` : ""}
    ${gm && it.gm ? `<b class="secret" title="${esc(it.gm)}">🔒</b>` : ""}
    <div class="hov">${hoverButtons(it)}</div>`;
  wire(el, it);
  return el;
}

const canEdit = (it) => (it.kind === "note" || it.kind === "question") && (gm || it.byId === me.id);
const canDel = (it) => gm || ((it.kind === "note" || it.kind === "question") && it.byId === me.id);

function hoverButtons(it) {
  const b = [];
  if (gm) {
    b.push(`<button data-a="yes" title="Підтверджено">✔</button>`, `<button data-a="no" title="Хибний слід">✘</button>`);
    if (it.stamp) b.push(`<button data-a="clear" title="Зняти штамп">⌫</button>`);
    b.push(`<button data-a="hide" title="Назад у шухляду">🗄</button>`);
  }
  if (canEdit(it)) b.push(`<button data-a="edit" title="Написати">✎</button>`);
  if (it.kind === "note") b.push(`<button data-a="color" title="Інший колір">🎨</button>`);
  if (canDel(it)) b.push(`<button data-a="del" title="Прибрати з дошки">🗑</button>`);
  return b.join("");
}

function wire(el, it) {
  // перетягування улики
  el.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".hov") || e.target.closest(".pin") || e.target.isContentEditable) return;
    if (kase()?.closed && !gm) return;
    e.stopPropagation();
    hideMenu();
    const c = kase();
    const item = c.items.find((i) => i.id === it.id);
    const start = { x: e.clientX, y: e.clientY, ix: item.x, iy: item.y };
    item.z = Date.now();
    el.style.zIndex = String(Math.floor((item.z / 1000) % 1e6));
    el.classList.add("lift");
    el.setPointerCapture(e.pointerId);
    let last = 0;
    const move = (ev) => {
      item.x = Math.round(Math.max(60, Math.min(W - 60, start.ix + (ev.clientX - start.x) / view.s)));
      item.y = Math.round(Math.max(60, Math.min(H - 60, start.iy + (ev.clientY - start.y) / view.s)));
      place(it.id);
      if (Date.now() - last > 60) { last = Date.now(); OBR.broadcast.sendMessage(BOARD_OP, { op: "move", k: cur, id: it.id, x: item.x, y: item.y, z: item.z }, { destination: "REMOTE" }).catch(() => {}); }
      sendCursor(ev);
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.classList.remove("lift");
      if (item.x !== start.ix || item.y !== start.iy) { send({ op: "move", k: cur, id: it.id, x: item.x, y: item.y, z: item.z }); pinSound(0.5); }
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  });
  // нитка від шпильки
  el.querySelector(".pin").addEventListener("pointerdown", (e) => {
    if (kase()?.closed && !gm) return;
    e.stopPropagation();
    const a = pinOf(it.id);
    const tmp = $("yarn-tmp");
    tmp.style.stroke = YARN[yarnColor].color;
    const moveT = (ev) => { const p = toBoard(ev.clientX, ev.clientY); tmp.setAttribute("d", yarnPath(a, p).d); };
    const upT = (ev) => {
      window.removeEventListener("pointermove", moveT);
      window.removeEventListener("pointerup", upT);
      tmp.setAttribute("d", "");
      const target = document.elementsFromPoint(ev.clientX, ev.clientY).map((x) => x.closest?.(".it")).find((x) => x && x.dataset.id !== it.id);
      if (!target) return;
      const b = target.dataset.id;
      const c = kase();
      if (c.links.some((l) => (l.a === it.id && l.b === b) || (l.a === b && l.b === it.id))) return toast("Ці улики вже пов'язані");
      send({ op: "link", k: cur, link: { id: "l" + uid(), a: it.id, b, color: yarnColor, label: "", by: me.name } });
      pinSound(0.8);
      drawYarn();
    };
    window.addEventListener("pointermove", moveT);
    window.addEventListener("pointerup", upT);
  });
  // кнопки при наведенні
  el.querySelector(".hov").addEventListener("click", (e) => {
    const a = e.target.closest("button")?.dataset.a;
    if (!a) return;
    e.stopPropagation();
    const item = kase().items.find((i) => i.id === it.id);
    if (a === "yes" || a === "no") { send({ op: "upd", k: cur, id: it.id, patch: { stamp: a } }); stampSound(); logStamp(item, a); }
    if (a === "clear") send({ op: "upd", k: cur, id: it.id, patch: { stamp: "" } });
    if (a === "hide") { send({ op: "del", k: cur, id: it.id }, { local: false }); item.hidden = true; apply(list, { op: "add", k: cur, item }); saveBoards({ list }); }
    if (a === "del") send({ op: "del", k: cur, id: it.id });
    if (a === "edit") return edit(it.id);
    if (a === "color") { const i = NOTE_COLORS.indexOf(item.color); send({ op: "upd", k: cur, id: it.id, patch: { color: NOTE_COLORS[(i + 1) % NOTE_COLORS.length] } }); }
    drawAll();
  });
  el.addEventListener("dblclick", (e) => { if (canEdit(it)) { e.stopPropagation(); edit(it.id); } });
}

function edit(id) {
  const el = els.get(id);
  const it = kase()?.items.find((i) => i.id === id);
  if (!el || !it || !canEdit(it)) return;
  const t = el.querySelector("[data-edit]");
  t.textContent = it.text || "";
  t.contentEditable = "true";
  t.focus();
  document.getSelection()?.selectAllChildren(t);
  document.getSelection()?.collapseToEnd();
  const done = () => {
    t.removeEventListener("blur", done);
    t.contentEditable = "false";
    const text = t.innerText.trim().slice(0, 300);
    if (text !== (it.text || "")) send({ op: "upd", k: cur, id, patch: { text } });
    drawItems();
  };
  t.addEventListener("blur", done);
  t.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); t.blur(); } if (e.key === "Escape") t.blur(); });
}

function logStamp(item, a) {
  const what = item.title || item.name || item.cap || item.text || KINDS[item.kind]?.name;
  appendLog({ k: "g", t: `Дошка «${kase().name}»: «${String(what).slice(0, 60)}» — ${a === "yes" ? "підтверджено" : "хибний слід"}.`, w: "Майстер" }).catch(() => {});
}

// ---------- меню нитки ----------

let menuLink = null;
function openMenu(l, mid) {
  if (kase()?.closed && !gm) return;
  menuLink = l;
  const m = $("ymenu");
  const cols = $("ym-colors");
  cols.innerHTML = "";
  for (const [k, y] of Object.entries(YARN)) {
    if (k === "gold" && !gm) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "spool sm" + (l.color === k ? " on" : "");
    b.style.setProperty("--y", y.color);
    b.title = y.name;
    b.onclick = () => { send({ op: "lupd", k: cur, id: l.id, patch: { color: k } }); drawYarn(); openMenu(kase().links.find((x) => x.id === l.id), mid); };
    cols.appendChild(b);
  }
  $("ym-label").value = l.label || "";
  $("ym-label").onchange = () => { send({ op: "lupd", k: cur, id: l.id, patch: { label: $("ym-label").value.trim() } }); drawYarn(); };
  $("ym-del").onclick = () => { send({ op: "unlink", k: cur, id: l.id }); hideMenu(); drawYarn(); };
  const r = $("cork").getBoundingClientRect();
  const dr = $("desk").getBoundingClientRect();
  m.hidden = false;
  m.style.left = `${Math.min(dr.width - 230, Math.max(10, r.left - dr.left + mid.x * view.s - 110))}px`;
  m.style.top = `${Math.min(dr.height - 130, r.top - dr.top + mid.y * view.s + 14)}px`;
}
function hideMenu() { $("ymenu").hidden = true; menuLink = null; }

// ---------- курсори інших ----------

let lastCur = 0;
function sendCursor(e) {
  if (Date.now() - lastCur < 110 || !cur) return;
  lastCur = Date.now();
  const p = toBoard(e.clientX, e.clientY);
  OBR.broadcast.sendMessage(BOARD_CUR, { k: cur, id: me.id, n: me.name, c: me.color, x: Math.round(p.x), y: Math.round(p.y) }, { destination: "REMOTE" }).catch(() => {});
}
const curs = new Map();
function cursor(d) {
  if (!d || d.k !== cur || d.id === me.id) return;
  let el = curs.get(d.id);
  if (!el) {
    el = document.createElement("div");
    el.className = "cur";
    el.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 2 L20 12 L12 13.5 L8.5 21 Z"/></svg><span></span>`;
    $("cursors").appendChild(el);
    curs.set(d.id, el);
  }
  el.style.setProperty("--c", d.c || "#e8c27a");
  el.querySelector("span").textContent = d.n || "";
  el.style.left = `${d.x}px`; el.style.top = `${d.y}px`;
  el.style.opacity = "1";
  clearTimeout(el._t);
  el._t = setTimeout(() => (el.style.opacity = "0"), 4000);
}

// ---------- ліхтарик ----------

function torch(e) {
  if ($("torch").hidden) return;
  const r = $("desk").getBoundingClientRect();
  $("torch").style.setProperty("--x", `${e.clientX - r.left}px`);
  $("torch").style.setProperty("--y", `${e.clientY - r.top}px`);
}

// ---------- звуки (короткі, тихі) ----------

let actx = null;
function noise(dur, freq, vol) {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const n = Math.floor(actx.sampleRate * dur);
    const buf = actx.createBuffer(1, n, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 4);
    const src = actx.createBufferSource();
    src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2;
    const g = actx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(actx.destination);
    src.start();
  } catch { /* без звуку */ }
}
const pinSound = (v = 1) => noise(0.05, 2400, 0.35 * v);
const stampSound = () => { noise(0.12, 180, 0.9); setTimeout(() => noise(0.05, 900, 0.3), 30); };

// ---------- майстер: справи й шухляда ----------

const DTABS = [
  ["person", "Особа"], ["photo", "Фото"], ["letter", "Документ"], ["map", "Мапа"], ["rune", "Напис"], ["beast", "Істота"], ["item", "Річ"],
];
let dtab = "person";

function initGM() {
  $("case-add").hidden = false;
  $("case-add").onclick = () => {
    const c = newCase(`Справа ${list.length + 1}`);
    send({ op: "case", c: publicCase(c) });
    cur = c.id;
    drawAll();
    $("drawer").hidden = false;
    $("case-name").focus();
    $("case-name").select();
  };
  $("t-drawer").onclick = () => { $("drawer").hidden = !$("drawer").hidden; $("t-drawer").classList.toggle("on", !$("drawer").hidden); };
  $("t-show").onclick = () => {
    if (!cur) return;
    OBR.broadcast.sendMessage(BOARD_SHOW, { k: cur }, { destination: "REMOTE" }).catch(() => {});
    toast("Дошку відкрито на екранах гравців");
  };
  $("case-name").oninput = () => { const c = kase(); if (!c) return; c.name = $("case-name").value || "Справа"; send({ op: "case", c: { id: c.id, name: c.name, closed: c.closed } }); drawTabs(); };
  $("case-close").onclick = () => {
    const c = kase(); if (!c) return;
    send({ op: "case", c: { id: c.id, name: c.name, closed: !c.closed } });
    if (c.closed) { stampSound(); appendLog({ k: "g", t: `Справу «${c.name}» закрито.`, w: "Майстер" }).catch(() => {}); }
    drawAll();
  };
  let armed = 0;
  $("case-del").onclick = () => {
    if (Date.now() - armed > 3000) { armed = Date.now(); toast("Натисни ще раз — справу буде видалено"); return; }
    send({ op: "case", c: { id: cur }, del: true });
    cur = list.at(-1)?.id ?? "";
    drawAll();
  };
  for (const [k, n] of DTABS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = n;
    b.dataset.k = k;
    b.onclick = () => { dtab = k; drawForm(); };
    $("dtabs").appendChild(b);
  }
  $("d-add").onclick = addEvidence;
  $("d-now").onchange = () => { $("d-add").textContent = $("d-now").checked ? "Приколоти на дошку" : "Покласти в шухляду"; };
  drawForm();
  window.addEventListener("storage", (e) => { if (e.key === BOARDS) { list = boards().list; drawAll(); } });
}

function drawDrawer() {
  const c = kase();
  $("case-name").value = c?.name ?? "";
  $("case-close").textContent = c?.closed ? "Відкрити справу знову" : "Справу закрито";
  const hidden = (c?.items ?? []).filter((i) => i.hidden);
  $("drawer-n").hidden = !hidden.length;
  $("drawer-n").textContent = hidden.length;
  const box = $("dlist");
  box.innerHTML = hidden.length ? "" : `<div class="dim">Порожньо. Додай улику нижче.</div>`;
  for (const it of hidden) {
    const r = document.createElement("div");
    r.className = "drow-it";
    r.innerHTML = `<span class="di">${KINDS[it.kind]?.icon ?? "•"}</span><span class="dn"></span><button type="button" class="go sm">Викласти</button><button type="button" class="ghost sm">✕</button>`;
    r.querySelector(".dn").textContent = it.title || it.name || it.cap || (it.n ? `№${it.n}` : "") || KINDS[it.kind]?.name;
    const [show, del] = r.querySelectorAll("button");
    show.onclick = () => reveal(it);
    del.onclick = () => { send({ op: "del", k: cur, id: it.id }, { local: true }); drawDrawer(); };
    box.appendChild(r);
  }
}

// вільне місце біля інших улик (спіраллю від центру купи)
function freeSpot() {
  const its = (kase()?.items ?? []).filter((i) => !i.hidden);
  if (!its.length) return centerOfView();
  const cx = its.reduce((a, i) => a + i.x, 0) / its.length, cy = its.reduce((a, i) => a + i.y, 0) / its.length;
  for (let r = 0; r < 1600; r += 70) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / Math.max(4, r / 60)) {
      const x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a) * r;
      if (x < 200 || x > W - 200 || y < 200 || y > H - 200) continue;
      if (its.every((i) => Math.abs(i.x - x) > 290 || Math.abs(i.y - y) > 300)) return { x, y };
    }
  }
  return centerOfView();
}

function reveal(it) {
  const p = freeSpot();
  const item = { ...it, hidden: false, x: Math.round(p.x), y: Math.round(p.y), z: Date.now() };
  fresh.add(item.id);
  sendItem(item);
  pinSound();
  appendLog({ k: "g", t: `Дошка «${kase().name}»: нова улика — ${item.title || item.name || item.cap || (item.n ? `шматок мапи з №${item.n}` : KINDS[item.kind]?.name)}.`, w: "Майстер" }).catch(() => {});
  drawAll();
}

function field(id, label, html) { return `<label class="df"><span>${label}</span>${html}</label>`; }
function drawForm() {
  for (const b of $("dtabs").children) b.classList.toggle("on", b.dataset.k === dtab);
  const f = $("dform");
  const secret = field("e-gm", "Нотатка майстра (лише тобі)", `<input id="e-gm" maxlength="200" placeholder="Що це насправді означає">`);
  const img = (lbl) => field("e-img", lbl, `<span class="dimg"><input id="e-img" placeholder="https://…"><button type="button" class="ghost sm" id="e-sel">З токена</button></span>`);
  if (dtab === "person") f.innerHTML = field("", "Ім'я", `<input id="e-name" maxlength="50">`) + field("", "Хто це", `<input id="e-sub" maxlength="60" placeholder="капітан «Елеонори», зник безвісти">`) + img("Портрет") + secret;
  if (dtab === "photo") f.innerHTML = img("Картинка") + field("", "Підпис", `<input id="e-cap" maxlength="50">`) + secret;
  if (dtab === "letter") f.innerHTML = field("", "Вигляд", `<select id="e-style"><option value="letter">Лист із печаткою</option><option value="diary">Сторінка щоденника</option><option value="notice">Оголошення / газета</option><option value="order">Наказ із печаткою</option></select>`) +
    field("", "Заголовок", `<input id="e-title" maxlength="60">`) + field("", "Текст", `<textarea id="e-text" rows="4" maxlength="600"></textarea>`) + field("", "Підпис", `<input id="e-sign" maxlength="50">`) + secret;
  if (dtab === "map") f.innerHTML = field("", "Точка Атласу", `<select id="e-n">${POINTS.slice().sort((a, b) => a.n - b.n).map((p) => `<option value="${p.n}">№${p.n} · ${REGIONS[p.r]}</option>`).join("")}</select>`) + field("", "Підпис", `<input id="e-cap" maxlength="50" placeholder="тут бачили корабель">`) + secret;
  if (dtab === "rune") {
    const ins = inscriptions();
    f.innerHTML = field("", "Напис із «Рун і написів»", `<select id="e-ins">${ins.map((i, n) => `<option value="${n}">${esc(i.title)}</option>`).join("")}</select>`) + secret;
  }
  if (dtab === "beast") {
    const b = bestiary();
    f.innerHTML = field("", "Істота з бестіарію", `<select id="e-beast">${b.map((c, n) => `<option value="${n}">№${c.n} ${esc(c.name)}</option>`).join("")}</select>`) + secret;
  }
  if (dtab === "item") {
    const all = [...LOOT, ...catalog()];
    f.innerHTML = field("", "Річ", `<select id="e-item">${all.map((x, n) => `<option value="${n}">${esc(x.name)}</option>`).join("")}</select>`) + secret;
  }
  const sel = $("e-sel");
  if (sel) sel.onclick = async () => {
    try {
      const ids = (await OBR.player.getSelection()) ?? [];
      const [it] = ids.length ? await OBR.scene.items.getItems(ids) : [];
      if (!it?.image?.url) return toast("Виділи токен на мапі");
      $("e-img").value = it.image.url;
      if ($("e-name") && !$("e-name").value) $("e-name").value = it.text?.plainText || it.name || "";
    } catch { toast("Не вдалося — відкрий сцену"); }
  };
}

function addEvidence() {
  if (!kase()) return toast("Спершу створи справу");
  const v = (id) => $(id)?.value?.trim() ?? "";
  let item = null;
  if (dtab === "person") { if (!v("e-name")) return toast("Ім'я?"); item = newItem("person", { name: v("e-name"), sub: v("e-sub"), img: v("e-img") }); }
  if (dtab === "photo") { if (!v("e-img")) return toast("Потрібна картинка"); item = newItem("photo", { img: v("e-img"), cap: v("e-cap") }); }
  if (dtab === "letter") { if (!v("e-text") && !v("e-title")) return toast("Порожній документ"); item = newItem(v("e-style") || "letter", { title: v("e-title"), text: v("e-text"), sign: v("e-sign") }); }
  if (dtab === "map") item = newItem("map", { n: Number(v("e-n")), cap: v("e-cap") });
  if (dtab === "rune") { const i = inscriptions()[Number(v("e-ins"))]; if (!i) return; item = newItem("rune", { title: i.title, text: i.text }); }
  if (dtab === "beast") { const c = bestiary()[Number(v("e-beast"))]; if (!c) return; item = newItem("beast", { name: c.name, type: c.type, img: c.img || "", biome: c.biome }); }
  if (dtab === "item") { const x = [...LOOT, ...catalog()][Number(v("e-item"))]; if (!x) return; item = newItem("item", { name: x.name, desc: x.desc || "", img: x.img || "", cat: x.cat }); }
  if (!item) return;
  if (v("e-gm")) item.gm = v("e-gm");
  item.hidden = true;
  apply(list, { op: "add", k: cur, item });
  saveBoards({ list });
  if ($("d-now").checked) reveal(item); else { drawDrawer(); toast("Улика в шухляді — «Викласти», коли герої її знайдуть"); }
  for (const el of $("dform").querySelectorAll("input, textarea")) el.value = "";
}

let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
