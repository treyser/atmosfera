// Арсенал: картки зброї. Майстер показує картку всім, видає зброю в лист персонажа
// і вирішує, яку незвичайну зброю гравці вже бачать у довіднику.
import OBR from "@owlbear-rodeo/sdk";
import "./arsenal.css";
import { ARSENAL, ARSENAL_DATA, ARSENAL_REQ, ARSENAL_SHOW, ARSENAL_GIVE } from "./state.js";
import { appendLog } from "./log.js";
import { ARSENAL as LIST, loadArsenal, GROUPS, RARITY, weapon, isSecret, opened, saveOpened, seen, saveSeen, SEEN, FOCUS, gp } from "./arsenal-data.js";

const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let open = new Set();       // відкрита гравцям незвичайна й рідкісна зброя
let sel = LIST[0]?.id;
let group = "all";
let rar = "all";

OBR.onReady(async () => {
  await loadArsenal();
  if (!LIST.some((w) => w.id === sel)) sel = LIST[0]?.id;
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  document.body.classList.toggle("is-gm", gm);
  $("close").onclick = () => OBR.modal.close(ARSENAL);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.activeElement?.tagName !== "INPUT") OBR.modal.close(ARSENAL); });
  $("q").addEventListener("input", drawGrid);
  chips("groups", { all: { name: "Уся" }, ...GROUPS }, () => group, (k) => (group = k));
  $("rar").onchange = () => { rar = $("rar").value; drawGrid(); };

  if (gm) {
    open = new Set(opened(room));
    initGM();
  } else {
    open = new Set(seen(room));
    window.addEventListener("storage", (e) => { if (e.key === SEEN(room) || e.key === FOCUS) { open = new Set(seen(room)); focus(); draw(); } });
    OBR.broadcast.onMessage(ARSENAL_DATA, (e) => { if (Array.isArray(e.data?.ids)) { open = new Set(e.data.ids); saveSeen(room, [...open]); draw(); } });
    OBR.broadcast.sendMessage(ARSENAL_REQ, {}, { destination: "REMOTE" }).catch(() => {});
    focus();
  }
  draw();
});

// майстер показав картку — відкрити на ній
function focus() {
  try {
    const f = JSON.parse(localStorage.getItem(FOCUS) || "null");
    if (f?.id && Date.now() - f.at < 60000 && weapon(f.id)) { sel = f.id; localStorage.removeItem(FOCUS); }
  } catch {}
}

function chips(boxId, map, get, set) {
  const box = $(boxId);
  const paint = () => { for (const b of box.children) b.classList.toggle("on", b.dataset.k === get()); };
  for (const [k, v] of Object.entries(map)) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = k;
    b.textContent = `${v.icon ? v.icon + " " : ""}${v.name}`;
    if (v.color) b.style.setProperty("--rc", v.color);
    b.onclick = () => { set(k); paint(); drawGrid(); };
    box.appendChild(b);
  }
  paint();
}

const visible = (w) => gm || !isSecret(w) || open.has(w.id);

function draw() { drawGrid(); drawCard(); }

function drawGrid() {
  const q = $("q").value.trim().toLowerCase();
  const grid = $("grid");
  grid.innerHTML = "";
  const secret = LIST.filter(isSecret);
  $("prog").textContent = gm
    ? `${LIST.length} одиниць · гравцям відкрито ${secret.filter((w) => open.has(w.id)).length}/${secret.length} особливих`
    : `Знайдено особливої зброї: ${secret.filter((w) => open.has(w.id)).length}/${secret.length}`;
  for (const w of LIST) {
    if (group !== "all" && w.group !== group) continue;
    if (rar !== "all" && w.rarity !== rar) continue;
    const vis = visible(w);
    if (q && !(vis && w.name.toLowerCase().includes(q))) continue;
    const el = document.createElement("button");
    el.type = "button";
    el.className = `wcard r-${w.rarity}${vis ? "" : " locked"}${w.id === sel ? " sel" : ""}${gm && isSecret(w) && !open.has(w.id) ? " hid" : ""}`;
    el.style.setProperty("--rc", RARITY[w.rarity].color);
    el.innerHTML = `<div class="pic"><img alt="" loading="lazy" src="${w.img}">${vis ? "" : `<span class="q">?</span>`}</div>
      <div class="nm">${vis ? esc(w.name) : "Невідома зброя"}</div>
      <div class="sub">${vis ? `${GROUPS[w.group].icon} ${esc(w.dmg)}` : RARITY[w.rarity].name}</div>`;
    el.onclick = () => { sel = w.id; draw(); };
    grid.appendChild(el);
  }
}

function drawCard() {
  const w = weapon(sel);
  if (!w) return;
  const vis = visible(w);
  const card = $("card");
  card.className = `card r-${w.rarity}${vis ? "" : " locked"}`;
  card.style.setProperty("--rc", RARITY[w.rarity].color);
  $("img").src = w.img;
  $("lock").hidden = vis;
  $("meta").textContent = `${RARITY[w.rarity].name} · ${GROUPS[w.group].name.toLowerCase()} зброя`;
  $("name").textContent = vis ? w.name : "Невідома зброя";
  $("stats").innerHTML = vis
    ? `<div><span>Шкода</span><b>${esc(w.dmg)}</b></div><div><span>Вага</span><b>${String(w.weight).replace(".", ",")} кг</b></div><div><span>Ціна</span><b>${gp(w.price)}</b></div>`
    : "";
  $("props").textContent = vis ? w.props : "";
  $("desc").textContent = vis ? w.desc : "Про цю зброю ходять лише чутки. Можливо, герої ще знайдуть її.";
  $("mech").textContent = w.mech;
  $("mech-box").hidden = !vis || !w.mech;
  $("quote").textContent = w.quote ? `«${w.quote}»` : "";
  $("quote").hidden = !vis || !w.quote;
  if (gm) {
    $("open-row").hidden = !isSecret(w);
    $("open").checked = open.has(w.id);
    $("gm-hint").textContent = isSecret(w)
      ? (open.has(w.id) ? "Гравці бачать цю картку." : "Гравці бачать лише «?» — доки ти не покажеш чи не видаси.")
      : "Звичайну зброю гравці бачать завжди.";
  }
}

// ---------- майстер ----------

function initGM() {
  $("gm").hidden = false;
  $("open").onchange = () => { setOpen(sel, $("open").checked); };
  $("show").onclick = async () => {
    const w = weapon(sel);
    setOpen(w.id, true);
    await OBR.broadcast.sendMessage(ARSENAL_SHOW, { id: w.id }, { destination: "REMOTE" }).catch(() => {});
    toast(`«${w.name}» — показано гравцям`);
  };
  const fill = async () => {
    const who = $("who");
    const players = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role !== "GM");
    who.innerHTML = `<option value="">${players.length ? "Видати…" : "Видати… (нікого немає)"}</option>`;
    for (const p of players) who.appendChild(new Option(p.name, p.id));
  };
  fill();
  OBR.party.onChange(fill);
  $("who").onchange = async () => {
    const to = $("who").value;
    const name = $("who").selectedOptions[0]?.textContent;
    $("who").value = "";
    if (!to) return;
    const w = weapon(sel);
    setOpen(w.id, true);
    await OBR.broadcast.sendMessage(ARSENAL_GIVE, { id: w.id, to }, { destination: "REMOTE" }).catch(() => {});
    appendLog({ k: "g", t: `${name} отримує «${w.name}».`, w: "Майстер" }).catch(() => {});
    toast(`«${w.name}» → ${name}: додано в лист персонажа`);
  };
}

function setOpen(id, on) {
  const w = weapon(id);
  if (!w || !isSecret(w)) return;
  if (on) open.add(id); else open.delete(id);
  saveOpened(room, [...open]);
  OBR.broadcast.sendMessage(ARSENAL_DATA, { ids: [...open] }, { destination: "REMOTE" }).catch(() => {});
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
