// Бестіарій: майстер бачить усі сторінки й вирішує, що знає партія; гравці — лише те, що вже дізналися.
// Рівні знання: Бачили → Вивчили → Перемогли (див. best-data.js). Сторінки живуть у браузері майстра,
// гравцям приходять повідомленнями й лишаються в їхньому браузері.
import OBR from "@owlbear-rodeo/sdk";
import "./bestiary.css";
import { BEST, BEST_REQ, BEST_DATA, BEST_SHOW } from "./state.js";
import { appendLog } from "./log.js";
import {
  BIOMES, RANKS, ROMAN, LEVELS, SEED, BOOK, FOCUS, bestiary, saveBestiary, known, saveKnown, newCreature,
  cache, CACHE, page, isAttack, mergeCache, packPages,
} from "./best-data.js";

const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let list = [];          // майстер: усі істоти
let know = {};          // майстер: { id: рівень } для цієї кімнати
let seen = { known: {}, pages: {} };   // гравець: що знає
let sel = null;         // id вибраної істоти
let biome = "all";
let editing = false;

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  document.body.classList.toggle("gm", gm);
  $("show").hidden = !gm;
  $("add").hidden = !gm;
  $("close").onclick = () => OBR.modal.close(BEST);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) OBR.modal.close(BEST);
  });
  $("q").oninput = drawGrid;
  $("show").onchange = drawGrid;
  drawBiomes();

  if (gm) initGM();
  else initPlayer();
  drawGrid();
  drawPage();
});

// ---------- гравець ----------

function initPlayer() {
  seen = cache(room);
  const f = focusNow();
  if (f) sel = f;
  // сторінки приносить фоновий скрипт; про всяк випадок слухаємо й тут
  OBR.broadcast.onMessage(BEST_DATA, (event) => {
    mergeCache(room, event.data);
    seen = cache(room);
    drawGrid(); drawPage();
  });
  OBR.broadcast.sendMessage(BEST_REQ, {}, { destination: "REMOTE" }).catch(() => {});
  window.addEventListener("storage", (e) => {
    if (e.key === CACHE(room)) { seen = cache(room); drawGrid(); drawPage(); }
    if (e.key === FOCUS) { const f = focusNow(); if (f) { sel = f; drawGrid(); drawPage(); } }
  });
}

function focusNow() {
  try {
    const f = JSON.parse(localStorage.getItem(FOCUS) || "null");
    return f && Date.now() - f.at < 60000 ? f.id : null;
  } catch { return null; }
}

// ---------- майстер ----------

function initGM() {
  list = bestiary();
  know = known(room);
  $("add").onclick = () => {
    const c = newCreature(list);
    list.push(c);
    saveBestiary(list);
    sel = c.id;
    $("show").value = "all"; biome = "all"; $("q").value = "";
    drawBiomes(); drawGrid(); openEditor();
  };
  $("reveal").onclick = reveal;
  $("edit-btn").onclick = openEditor;
  $("edit-done").onclick = closeEditor;
  initEditor();
  window.addEventListener("storage", (e) => {
    if (e.key === BOOK && !editing) { list = bestiary(); drawGrid(); drawPage(); }
  });
}

const creature = (id) => (gm ? list.find((c) => c.id === id) : seen.pages[id]) ?? null;
const levelOf = (id) => (gm ? know[id] ?? 0 : seen.known[id] ?? 0);

function send(data) {
  return OBR.broadcast.sendMessage(BEST_DATA, { ...data, total: list.length }, { destination: "REMOTE" }).catch(() => {});
}

async function setLevel(id, lvl) {
  const c = creature(id);
  const old = know[id] ?? 0;
  if (!c || old === lvl) return;
  if (lvl) know[id] = lvl; else delete know[id];
  saveKnown(room, know);
  await send({ known: { [id]: lvl }, pages: lvl ? [page(c, lvl)] : [] });
  if (lvl > old) {
    const what = ["", "зустріли", "вивчили", "перемогли"][lvl];
    appendLog({ k: "g", t: `Бестіарій: герої ${what} — «${c.name}».`, w: "Майстер" }).catch(() => {});
  }
  toast(lvl ? `Гравці тепер знають: ${LEVELS[lvl].name.toLowerCase()} — «${c.name}»` : `«${c.name}» прибрано з бестіарію гравців`);
  drawGrid(); drawPage();
}

async function reveal() {
  const c = creature(sel);
  if (!c) return;
  if (!know[c.id]) await setLevel(c.id, 1);
  await OBR.broadcast.sendMessage(BEST_SHOW, { id: c.id }, { destination: "REMOTE" }).catch(() => {});
  toast(`Сторінка «${c.name}» відкрилась у гравців`);
}

// після редагування — оновити сторінку в гравців, якщо вони її вже бачать
let pushTimer = null;
function pushLater(c) {
  clearTimeout(pushTimer);
  const lvl = know[c.id] ?? 0;
  if (!lvl) return;
  pushTimer = setTimeout(() => send({ known: { [c.id]: lvl }, pages: [page(c, lvl)] }), 900);
}

// ---------- малювання ----------

function drawBiomes() {
  const nav = $("biomes");
  nav.innerHTML = "";
  const btn = (k, label, title) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = title;
    b.classList.toggle("on", biome === k);
    if (k !== "all") b.style.setProperty("--bc", BIOMES[k].color);
    b.onclick = () => { biome = k; drawBiomes(); drawGrid(); };
    nav.appendChild(b);
  };
  btn("all", "Усі", "Усі середовища");
  for (const [k, b] of Object.entries(BIOMES)) btn(k, `${b.icon} ${b.short}`, b.name);
}

function items() {
  const q = $("q").value.trim().toLowerCase();
  const show = $("show").value;
  const all = gm ? list : Object.values(seen.pages);
  return all
    .filter((c) => biome === "all" || c.biome === biome)
    .filter((c) => !q || c.name.toLowerCase().includes(q) || String(c.type ?? "").toLowerCase().includes(q))
    .filter((c) => !gm || show === "all" || (show === "known" ? levelOf(c.id) > 0 : !levelOf(c.id)))
    .sort((a, b) => (a.n ?? 0) - (b.n ?? 0));
}

function drawGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  const shown = items();
  for (const c of shown) grid.appendChild(card(c));

  const total = gm ? list.length : seen.total ?? 0;
  const knownN = gm ? Object.values(know).filter(Boolean).length : Object.keys(seen.pages).length;
  $("prog").textContent = gm ? `Партія знає ${knownN} з ${total}` : `Записано істот: ${knownN}`;

  if (!gm) {
    const left = Math.max(0, total - knownN);
    if (!knownN) {
      grid.appendChild(Object.assign(document.createElement("div"), { className: "none", textContent: "Бестіарій ще порожній. Сторінки з'являться, коли герої зустрінуть перших істот." }));
    } else if (left && biome === "all" && !$("q").value) {
      const t = document.createElement("div");
      t.className = "card void";
      t.innerHTML = `<div class="cpic"><span class="glyph">?</span></div><div class="cname">Ще ${left} ${plural(left, "сторінка", "сторінки", "сторінок")}</div><div class="crank">чекають на зустріч</div>`;
      grid.appendChild(t);
    }
  } else if (!shown.length) {
    grid.appendChild(Object.assign(document.createElement("div"), { className: "none", textContent: "Нічого не знайдено." }));
  }
}

function card(c) {
  const lvl = levelOf(c.id);
  const b = document.createElement("button");
  b.type = "button";
  b.className = "card";
  b.classList.toggle("on", c.id === sel);
  b.classList.toggle("hid", gm && !lvl);
  b.style.setProperty("--bc", BIOMES[c.biome]?.color ?? "#999");
  b.innerHTML = `
    <div class="cpic">${c.img ? `<img alt="" src="${esc(c.img)}">` : `<span class="glyph">${esc(initial(c.name))}</span>`}
      <span class="cnum">№${String(c.n ?? "").padStart(2, "0")}</span>
      <span class="cbio" title="${esc(BIOMES[c.biome]?.name ?? "")}">${BIOMES[c.biome]?.icon ?? ""}</span></div>
    <div class="cname">${esc(c.name)}</div>
    <div class="crow"><span class="crank">${pips(c.rank)}</span><span class="know" title="${LEVELS[lvl].name}">${[1, 2, 3].map((k) => `<i class="${lvl >= k ? "y" : ""}"></i>`).join("")}</span></div>`;
  b.onclick = () => { sel = c.id; if (editing) closeEditor(); drawGrid(); drawPage(); };
  return b;
}

function drawPage() {
  const c = creature(sel);
  $("blank").hidden = Boolean(c);
  $("sheet").hidden = !c || editing;
  $("editor").hidden = !c || !editing;
  if (!c) {
    $("blank-text").textContent = gm ? "Обери істоту ліворуч — і виріши, що про неї знає партія." : "Обери істоту ліворуч.";
    return;
  }
  const lvl = levelOf(c.id);
  const bio = BIOMES[c.biome] ?? { name: "", color: "#999", icon: "" };
  $("page").style.setProperty("--bc", bio.color);

  $("img").hidden = !c.img;
  if (c.img) $("img").src = c.img; else $("img").removeAttribute("src");
  $("glyph").hidden = Boolean(c.img);
  $("glyph").textContent = initial(c.name);
  $("num").textContent = `№ ${String(c.n ?? "").padStart(2, "0")} · ${bio.icon} ${bio.name}`;
  $("name").textContent = c.name;
  $("kind").textContent = c.type || "";
  $("rank").innerHTML = `<span class="pips">${pips(c.rank)}</span> Ранг ${ROMAN[c.rank] ?? ""} — ${RANKS[c.rank] ?? ""}`;

  $("track").innerHTML = LEVELS.slice(1).map((L) => `<li class="${lvl >= L.k ? "y" : ""}">${L.name}</li>`).join("");

  // майстер бачить усе; що гравцям ще закрито — приглушено
  for (const sec of document.querySelectorAll(".sec")) {
    const need = Number(sec.dataset.l);
    sec.classList.toggle("locked", !gm && lvl < need);
    sec.classList.toggle("gmhide", gm && lvl < need);
  }
  const say = (id, text, empty) => {
    $(id).textContent = text || (gm ? empty : "");
    $(id).classList.toggle("ph", !text);
  };
  say("seen", c.seen, "Порожньо — допиши в редакторі, що герої бачать з першого погляду.");
  $("s-seen").hidden = !gm && !c.seen;
  say("lore", c.lore, "Порожньо — звички, легенди, де живе.");
  $("lore").hidden = !gm && !c.lore;
  $("speed").textContent = c.speed ?? "";
  $("weak-box").hidden = !gm && !c.weak;
  say("weak", c.weak, "Порожньо — чого боїться, до чого вразлива.");

  const traits = c.traits ?? [];
  fillTraits($("abil"), traits.filter((t) => !isAttack(t)));
  fillTraits($("atk"), traits.filter(isAttack));
  $("ac").textContent = c.ac ?? "?";
  $("hp").textContent = c.hp ?? "?";
  $("xp").textContent = c.xp ?? "?";

  if (gm) {
    $("gmctl").hidden = false;
    const box = $("lvls");
    box.innerHTML = "";
    for (const L of LEVELS) {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<b>${L.name}</b><span>${L.hint}</span>`;
      b.classList.toggle("on", lvl === L.k);
      b.onclick = () => setLevel(c.id, L.k);
      box.appendChild(b);
    }
    $("gm-hint").textContent = !lvl ? "Гравці цієї істоти поки не бачать зовсім." : lvl < 3 ? "Приглушене гравці ще не бачать." : "Гравці бачать усю сторінку.";
  }
}

function fillTraits(ul, arr) {
  ul.innerHTML = "";
  for (const t of arr) {
    const li = document.createElement("li");
    const i = t.indexOf(":");
    if (i > 0 && i < 40) {
      const b = document.createElement("b");
      b.textContent = t.slice(0, i + 1);
      li.append(b, document.createTextNode(t.slice(i + 1)));
    } else li.textContent = t;
    ul.appendChild(li);
  }
  ul.hidden = !arr.length;
}

// ---------- редактор (майстер) ----------

const FIELDS = ["name", "type", "biome", "rank", "ac", "hp", "xp", "speed", "img", "seen", "lore", "weak"];

function initEditor() {
  for (const [k, b] of Object.entries(BIOMES)) $("e-biome").appendChild(new Option(b.name, k));
  for (let r = 1; r <= 5; r++) $("e-rank").appendChild(new Option(`${ROMAN[r]} — ${RANKS[r]}`, r));
  for (const f of FIELDS) $("e-" + f).addEventListener("input", edited);
  $("e-biome").addEventListener("change", edited);
  $("e-rank").addEventListener("change", edited);
  $("e-traits").addEventListener("input", edited);
  $("e-img-sel").onclick = async () => {
    try {
      const ids = (await OBR.player.getSelection()) ?? [];
      const it = (await OBR.scene.items.getItems(ids)).find((i) => i.image?.url);
      if (!it) return toast("Виділи на мапі токен з картинкою");
      $("e-img").value = it.image.url;
      edited();
    } catch { toast("Не вдалося взяти картинку — відкрий сцену"); }
  };
  let armed = 0;
  $("e-del").onclick = () => {
    if (Date.now() - armed > 3000) { armed = Date.now(); $("e-del").textContent = "Точно видалити?"; setTimeout(() => ($("e-del").textContent = "Видалити істоту"), 3000); return; }
    const c = creature(sel);
    if (!c) return;
    if (know[c.id]) { delete know[c.id]; saveKnown(room, know); send({ known: { [c.id]: 0 }, pages: [] }); }
    list = list.filter((x) => x.id !== c.id);
    saveBestiary(list);
    sel = null;
    closeEditor();
    drawGrid();
    toast(`«${c.name}» видалено`);
  };
  $("e-reset").onclick = () => {
    const c = creature(sel);
    const s = SEED.find((x) => x.id === c?.id);
    if (!s) return toast("Це твоя істота — картки для неї немає");
    Object.assign(c, { name: s.name, type: s.type, biome: s.biome, rank: s.rank, ac: s.ac, hp: s.hp, xp: s.xp, speed: s.speed, traits: [...s.traits] });
    fillEditor(c);
    edited();
  };
}

function openEditor() {
  const c = creature(sel);
  if (!c) return;
  editing = true;
  fillEditor(c);
  drawPage();
  $("e-name").focus();
}
function closeEditor() {
  editing = false;
  drawPage();
}
function fillEditor(c) {
  for (const f of FIELDS) $("e-" + f).value = c[f] ?? "";
  $("e-traits").value = (c.traits ?? []).join("\n");
}

let saveTimer = null;
function edited() {
  const c = creature(sel);
  if (!c) return;
  for (const f of FIELDS) {
    const v = $("e-" + f).value;
    c[f] = ["rank", "ac", "hp", "xp"].includes(f) ? Number(v) || 0 : v.trim() === "" ? "" : v;
  }
  c.name = c.name || "Без імені";
  c.traits = $("e-traits").value.split("\n").map((t) => t.trim()).filter(Boolean);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveBestiary(list); drawGrid(); }, 350);
  pushLater(c);
}

// ---------- дрібниці ----------

function pips(rank) {
  const r = Number(rank) || 1;
  return [1, 2, 3, 4, 5].map((k) => `<i class="${k <= r ? "y" : ""}"></i>`).join("");
}
const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
function plural(n, one, few, many) {
  const a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return one;
  if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return few;
  return many;
}
let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
