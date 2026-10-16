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

// ---------- портрет із токена через Gemini ----------

const KEY = "atmosfera.gemini-key", MODEL = "atmosfera.gemini-model";
const ls = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
let lastToken = null;   // { data, mime } — картинка токена для «Ще раз»
let made = "";          // згенерований портрет (dataURL), ще не збережений

function initAI() {
  $("ai-key").value = ls(KEY);
  $("ai-model").value = ls(MODEL);
  const keyState = () => { $("ai-keystate").textContent = ls(KEY) ? "· збережено" : "· потрібен для генерації"; $("ai-keybox").open = !ls(KEY); };
  keyState();
  $("ai-key").onchange = () => { lsSet(KEY, $("ai-key").value.trim()); keyState(); };
  $("ai-model").onchange = () => lsSet(MODEL, $("ai-model").value.trim());
  $("ai-gen").onclick = async () => {
    try {
      const ids = (await OBR.player.getSelection()) ?? [];
      const [it] = ids.length ? await OBR.scene.items.getItems(ids) : [];
      if (!it?.image?.url) return status("Виділи на мапі токен ворога з картинкою");
      status("Беру картинку токена…");
      lastToken = await fromUrl(it.image.url);
      generate();
    } catch (err) {
      console.error(err);
      status("Не вдалося взяти картинку токена напряму — натисни «Токен із файлу…» і обери її з комп'ютера");
    }
  };
  $("ai-file").onclick = () => $("ai-input").click();
  $("ai-input").onchange = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    lastToken = await fromBlob(f);
    generate();
  };
  $("ai-again").onclick = () => lastToken && generate();
  $("ai-save").onclick = () => {
    if (!made) return;
    $("e-img").value = made;
    edited();
    made = "";
    $("ai-row").hidden = true;
    status("Портрет збережено — гравці побачать його, щойно знатимуть істоту");
  };
  $("ai-clear").onclick = () => { $("e-img").value = ""; edited(); showPic(""); status(""); };
}
const status = (t) => { $("ai-status").textContent = t; };
function showPic(url) {
  $("ai-img").hidden = !url;
  if (url) $("ai-img").src = url; else $("ai-img").removeAttribute("src");
  $("ai-ph").hidden = Boolean(url);
}

async function fromUrl(url) {
  const r = await fetch(url, { mode: "cors" });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return fromBlob(await r.blob());
}
// токен → квадратний PNG до 768 пікселів, base64
function fromBlob(blob) {
  return new Promise((ok, fail) => {
    const src = URL.createObjectURL(blob);
    const im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(src);
      const n = Math.min(768, Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = c.height = n;
      const g = c.getContext("2d");
      const s = n / Math.max(im.width, im.height);
      g.drawImage(im, (n - im.width * s) / 2, (n - im.height * s) / 2, im.width * s, im.height * s);
      ok({ data: c.toDataURL("image/png").split(",")[1], mime: "image/png" });
    };
    im.onerror = () => { URL.revokeObjectURL(src); fail(new Error("не картинка")); };
    im.src = src;
  });
}

async function generate() {
  const key = ls(KEY);
  if (!key) { $("ai-keybox").open = true; return status("Спершу встав ключ Gemini API нижче"); }
  const c = creature(sel);
  if (!c || !lastToken) return;
  $("ai-gen").disabled = true; $("ai-again").disabled = true;
  status("Gemini малює портрет… (10–30 секунд)");
  const prompt = `This image is a top-down tabletop battle-map token of a fantasy creature. Using it as the reference for the creature's design, colors, markings, gear and silhouette, paint a dramatic bestiary portrait of the SAME creature: front three-quarter view, head and upper body filling the frame, eye-level, expressive, menacing. Style: painterly dark-fantasy illustration like a D&D Monster Manual plate, rich lighting, moody dark background that fits its habitat. Square image. No text, no letters, no border, no token ring, no frame. Creature: "${c.name}" (${c.type || "creature"}).`;
  try {
    const model = ls(MODEL) || "gemini-2.5-flash-image";
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: lastToken.mime, data: lastToken.data } }, { text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
    const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inline_data || p.inlineData);
    const d = part?.inline_data ?? part?.inlineData;
    if (!d?.data) throw new Error(j?.candidates?.[0]?.finishReason ? `Gemini не дав картинку (${j.candidates[0].finishReason})` : "Gemini не дав картинку — спробуй «Ще раз»");
    made = await shrink(`data:${d.mime_type || d.mimeType || "image/png"};base64,${d.data}`);
    showPic(made);
    $("ai-row").hidden = false;
    status("Подобається? «Зберегти» — або «Ще раз»");
  } catch (err) {
    console.error(err);
    status(`Не вийшло: ${String(err.message || err).slice(0, 160)}`);
  } finally {
    $("ai-gen").disabled = false; $("ai-again").disabled = false;
  }
}

// стиснути до маленького webp, щоб сторінка влізла в одне повідомлення гравцям (16 кБ)
function shrink(url) {
  return new Promise((ok, fail) => {
    const im = new Image();
    im.onload = () => {
      for (const [n, q] of [[320, 0.72], [288, 0.62], [256, 0.58], [224, 0.52], [192, 0.5], [160, 0.45]]) {
        const c = document.createElement("canvas");
        c.width = c.height = n;
        const g = c.getContext("2d");
        const s = Math.max(n / im.width, n / im.height);
        g.drawImage(im, (n - im.width * s) / 2, (n - im.height * s) / 2, im.width * s, im.height * s);
        const out = c.toDataURL("image/webp", q);
        if (out.length <= 12500) return ok(out);
      }
      fail(new Error("портрет завеликий"));
    };
    im.onerror = () => fail(new Error("не вдалося прочитати портрет"));
    im.src = url;
  });
}

function initEditor() {
  initAI();
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
  showPic(c.img || "");
  made = ""; $("ai-row").hidden = true; status("");
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
