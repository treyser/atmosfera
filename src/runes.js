// Руни й написи: рунна бібліотека Ґрундура, написи рунною абеткою і сама абетка.
// Майстер відкриває руни, їхні ступені й літери абетки; гравці бачать, що вже відомо партії.
// Повні описи ступенів бачить лише рунний коваль (гравець Ґрундура) і майстер.
import OBR from "@owlbear-rodeo/sdk";
import "./runes.css";
import { RUNE, RUNE_REQ, RUNE_DATA, RUNE_SHOW } from "./state.js";
import { appendLog, uid } from "./log.js";
import {
  ABC, LETTERS, carve, lettersIn, GROUPS, TIERS, ROMAN, RUNES, CRAFT, sigil, short,
  inscriptions, saveInscriptions, runeState, saveRuneState, packState, STATE_KEY, INSC,
  seenState, saveSeen, SEEN_KEY, guesses, saveGuesses, GUESS, RFOCUS, sheetOwner,
} from "./runes-data.js";

const SHEETS = "com.nikita.character-sheet/sheets";
const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let st = null;          // майстер: стан партії; гравець: остання копія від майстра
let insc = [];          // написи: у майстра — усі, у гравця — показані
let tab = "lib";
let selRune = null;     // r1…r20 або k1…k15
let selInsc = null;
let editing = false;

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  document.body.classList.toggle("gm", gm);
  $("close").onclick = () => OBR.modal.close(RUNE);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { if (!$("guess").hidden) return closeGuess(); if (!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) OBR.modal.close(RUNE); }
  });
  for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => setTab(b.dataset.t);
  document.addEventListener("click", (e) => { if (!$("guess").hidden && !e.target.closest("#guess") && !e.target.closest(".cell") && !e.target.closest(".ab")) closeGuess(); });
  $("g-clear").onclick = () => setGuess("");

  if (gm) await initGM(); else initPlayer();
  const f = focus();
  if (f) { if (f.tab === "insc") selInsc = f.id; else selRune = f.id; tab = f.tab || "lib"; }
  setTab(tab);
});

// ---------- гравець ----------

function initPlayer() {
  st = seenState(room);
  insc = st.insc ?? [];
  OBR.broadcast.onMessage(RUNE_DATA, (event) => { if (event.data) { saveSeen(room, event.data); reload(); } });
  OBR.broadcast.sendMessage(RUNE_REQ, {}, { destination: "REMOTE" }).catch(() => {});
  window.addEventListener("storage", (e) => {
    if (e.key === SEEN_KEY(room)) reload();
    if (e.key === GUESS) draw();
    if (e.key === RFOCUS) { const f = focus(); if (f) { if (f.tab === "insc") selInsc = f.id; else selRune = f.id; setTab(f.tab || "lib"); } }
  });
}
function reload() {
  st = seenState(room);
  insc = st.insc ?? [];
  draw();
}
function focus() {
  try {
    const f = JSON.parse(localStorage.getItem(RFOCUS) || "null");
    return f && Date.now() - f.at < 60000 ? f : null;
  } catch { return null; }
}
const isOwner = () => !gm && Boolean(st.owner) && st.owner === sheetOwner();
const full = () => gm || isOwner();

// ---------- майстер ----------

async function initGM() {
  st = runeState(room);
  insc = inscriptions();
  $("owner-box").hidden = false;
  $("i-add").hidden = false;
  // рунний коваль — один із листів персонажів кімнати
  const fillOwners = (meta) => {
    const index = meta[SHEETS] ?? {};
    const sel = $("owner");
    sel.innerHTML = "";
    sel.appendChild(new Option("— не обрано —", ""));
    for (const [id, v] of Object.entries(index)) sel.appendChild(new Option(v?.name || "Без імені", id));
    if (!st.owner) {
      const g = Object.entries(index).find(([, v]) => /[ґг]рундур/i.test(v?.name ?? ""));
      if (g) { st.owner = g[0]; st.ownerName = g[1].name; commit(false); }
    }
    if (st.owner && !index[st.owner]) sel.appendChild(new Option(st.ownerName || "(лист не в кімнаті)", st.owner));
    sel.value = st.owner;
  };
  fillOwners(await OBR.room.getMetadata());
  OBR.room.onMetadataChange(fillOwners);
  $("owner").onchange = () => {
    st.owner = $("owner").value;
    st.ownerName = st.owner ? $("owner").selectedOptions[0].textContent : "";
    commit();
    toast(st.owner ? `Рунний коваль: ${st.ownerName}` : "Рунного коваля не обрано");
  };
  $("r-show").onclick = () => showPlayers("lib", selRune);
  $("k-show").onclick = () => showPlayers("lib", selRune);
  $("i-show").onclick = () => {
    if (!st.shown.includes(selInsc)) st.shown.push(selInsc);
    commit();
    showPlayers("insc", selInsc);
  };
  $("i-hide").onclick = () => { st.shown = st.shown.filter((x) => x !== selInsc); commit(); toast("Напис сховано від гравців"); };
  $("i-all").onclick = () => {
    const i = insc.find((x) => x.id === selInsc);
    if (!i) return;
    st.letters = [...new Set([...st.letters, ...lettersIn(i.text)])];
    commit();
    toast("Напис розгадано — ці руни тепер відомі партії в усіх написах");
  };
  $("i-edit").onclick = () => { editing = true; draw(); $("e-title").focus(); };
  $("e-done").onclick = () => { editing = false; draw(); };
  $("i-add").onclick = () => {
    const i = { id: uid(), title: "Новий напис", where: "", text: "", rune: "" };
    insc.push(i);
    saveInscriptions(insc);
    selInsc = i.id;
    editing = true;
    draw();
    $("e-title").focus();
  };
  $("e-rune").appendChild(new Option("— немає —", ""));
  for (const r of RUNES) $("e-rune").appendChild(new Option(r.name, r.id));
  for (const f of ["title", "where", "text", "rune"]) $("e-" + f).addEventListener("input", editedInsc);
  $("e-rune").addEventListener("change", editedInsc);
  let armed = 0;
  $("e-del").onclick = () => {
    if (Date.now() - armed > 3000) { armed = Date.now(); $("e-del").textContent = "Точно видалити?"; setTimeout(() => ($("e-del").textContent = "Видалити напис"), 3000); return; }
    insc = insc.filter((x) => x.id !== selInsc);
    saveInscriptions(insc);
    st.shown = st.shown.filter((x) => x !== selInsc);
    selInsc = null;
    editing = false;
    commit();
  };
  window.addEventListener("storage", (e) => {
    if (e.key === STATE_KEY(room)) { st = runeState(room); draw(); }
    if (e.key === INSC && !editing) { insc = inscriptions(); draw(); }
  });
}

// зберегти стан і розіслати гравцям
let sendTimer = null;
function commit(redraw = true) {
  saveRuneState(room, st);
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => OBR.broadcast.sendMessage(RUNE_DATA, packState(room), { destination: "REMOTE" }).catch(() => {}), 150);
  if (redraw) draw();
}
async function showPlayers(t, id) {
  if (!id) return;
  if (t === "lib" && !(st.runes[id] || st.craft[id])) return toast("Спершу відкрий цю руну партії");
  await OBR.broadcast.sendMessage(RUNE_SHOW, { tab: t, id }, { destination: "REMOTE" }).catch(() => {});
  toast("Відкрито на екранах гравців");
}
function setTier(id, tier) {
  const r = RUNES.find((x) => x.id === id);
  const old = st.runes[id] ?? 0;
  if (tier) st.runes[id] = tier; else delete st.runes[id];
  commit();
  if (tier > old) appendLog({ k: "g", t: tier === 1 ? `${st.ownerName || "Ґрундур"} відкриває «${r.name}».` : `«${r.name}» — ${TIERS[tier].toLowerCase()} (${ROMAN[tier]}).`, w: "Майстер" }).catch(() => {});
}
function setCraft(id, on) {
  const k = CRAFT.find((x) => x.id === id);
  if (on) st.craft[id] = 1; else delete st.craft[id];
  commit();
  if (on) appendLog({ k: "g", t: `${st.ownerName || "Ґрундур"} опановує ремісничу «${k.name}».`, w: "Майстер" }).catch(() => {});
}
function toggleLetter(l) {
  st.letters = st.letters.includes(l) ? st.letters.filter((x) => x !== l) : [...st.letters, l];
  commit();
}
let inscTimer = null;
function editedInsc() {
  const i = insc.find((x) => x.id === selInsc);
  if (!i) return;
  for (const f of ["title", "where", "text", "rune"]) i[f] = $("e-" + f).value;
  i.title = i.title || "Без назви";
  clearTimeout(inscTimer);
  inscTimer = setTimeout(() => { saveInscriptions(insc); if (st.shown.includes(i.id)) commit(false); drawList(); }, 400);
}

// ---------- малювання ----------

function setTab(t) {
  tab = t;
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.t === t);
  for (const v of ["lib", "insc", "abc"]) $("v-" + v).hidden = v !== t;
  closeGuess();
  draw();
}

function draw() {
  const known = Object.keys(st.runes).length;
  const crafts = Object.keys(st.craft).length;
  const who = st.ownerName || "Ґрундур";
  $("prog").textContent = `${who}: рун ${known} з ${RUNES.length} · ремісничих ${crafts} · знаків ${st.letters.length} з ${LETTERS.length}`;
  $("insc-n").hidden = gm || !insc.length;
  $("insc-n").textContent = insc.length;
  if (tab === "lib") { drawLib(); drawRune(); }
  if (tab === "insc") { drawList(); drawInsc(); }
  if (tab === "abc") drawAbc();
}

function sigHTML(name) {
  return `<span class="sig">${sigil(name).map((g, i) => `<b class="s${i}">${g}</b>`).join("")}</span>`;
}

function drawLib() {
  const box = $("lib");
  box.innerHTML = "";
  if (!gm && !st.owner) {
    box.innerHTML = `<div class="none">Майстер ще не відкрив рунну бібліотеку.</div>`;
  }
  for (const [g, G] of Object.entries(GROUPS)) {
    const sec = document.createElement("div");
    sec.className = "grp";
    sec.innerHTML = `<h3>${G.name}<span>${G.sub}</span></h3>`;
    const row = document.createElement("div");
    row.className = "rrow";
    for (const r of RUNES.filter((x) => x.group === g)) {
      const t = st.runes[r.id] ?? 0;
      const see = t > 0 || full();
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rcard";
      b.classList.toggle("lit", t > 0);
      b.classList.toggle("on", r.id === selRune);
      b.classList.toggle("void", !see);
      b.innerHTML = see
        ? `${sigHTML(r.name)}<div class="rname">${short(r.name)}</div><div class="rcar">${r.carrier}</div><div class="tp">${[1, 2, 3].map((k) => `<i class="${t >= k ? "y" : ""}">${ROMAN[k]}</i>`).join("")}</div>`
        : `<span class="sig"><b class="q">?</b></span><div class="rname">Ще не відкрита</div><div class="rcar">${G.name}</div>`;
      if (see) b.onclick = () => { selRune = r.id; drawLib(); drawRune(); };
      row.appendChild(b);
    }
    sec.appendChild(row);
    box.appendChild(sec);
  }
  // ремісничі
  const sec = document.createElement("div");
  sec.className = "grp craft";
  sec.innerHTML = `<h3>Ремісничі руни<span>світло, тепло, тиша, сторож…</span></h3>`;
  const row = document.createElement("div");
  row.className = "krow";
  for (const k of CRAFT) {
    const on = Boolean(st.craft[k.id]);
    const see = on || full();
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kchip";
    b.classList.toggle("lit", on);
    b.classList.toggle("on", k.id === selRune);
    b.classList.toggle("void", !see);
    b.innerHTML = see ? `<b>${sigil(k.name).join("")}</b>${short(k.name)}` : `<b>?</b>невідома`;
    if (see) b.onclick = () => { selRune = k.id; drawLib(); drawRune(); };
    row.appendChild(b);
  }
  sec.appendChild(row);
  box.appendChild(sec);
}

function drawRune() {
  const r = RUNES.find((x) => x.id === selRune);
  const k = CRAFT.find((x) => x.id === selRune);
  $("rune-blank").hidden = Boolean(r || k);
  $("rune-page").hidden = !r;
  $("craft-page").hidden = !k;
  $("rune-blank-text").textContent = gm ? "Обери руну — і виріши, що з неї вже знає рунний коваль." : isOwner() ? "Твій рунний шлях. Обери руну." : "Обери руну, щоб подивитися.";
  if (k) {
    const on = Boolean(st.craft[k.id]);
    $("k-sig").innerHTML = sigHTML(k.name);
    $("k-name").textContent = k.name;
    $("k-desc").textContent = k.desc;
    $("k-gm").hidden = !gm;
    if (gm) {
      $("k-lvls").innerHTML = "";
      for (const [v, label] of [[false, "Невідома"], [true, "Відкрита"]]) {
        const b = document.createElement("button");
        b.type = "button";
        b.innerHTML = `<b>${label}</b>`;
        b.classList.toggle("on", on === v);
        b.onclick = () => setCraft(k.id, v);
        $("k-lvls").appendChild(b);
      }
    }
    return;
  }
  if (!r) return;
  const t = st.runes[r.id] ?? 0;
  $("r-sig").innerHTML = sigHTML(r.name);
  $("r-sig").classList.toggle("lit", t > 0);
  $("r-num").textContent = `№ ${r.n} · ${GROUPS[r.group].name} — ${GROUPS[r.group].sub}`;
  $("r-name").textContent = r.name;
  $("r-carrier").textContent = `Носій: ${r.carrier}`;
  $("r-track").innerHTML = [1, 2, 3].map((k) => `<li class="${t >= k ? "y" : ""}">${ROMAN[k]} · ${TIERS[k]}</li>`).join("");

  $("r-gm").hidden = !gm;
  if (gm) {
    const box = $("r-lvls");
    box.innerHTML = "";
    [[0, "Невідома"], [1, "I · Відкрита"], [2, "II · Загартована"], [3, "III · Майстерна"]].forEach(([v, label]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `<b>${label}</b>`;
      b.classList.toggle("on", t === v);
      b.onclick = () => setTier(r.id, v);
      box.appendChild(b);
    });
  }

  const tiers = $("r-tiers");
  tiers.innerHTML = "";
  if (full()) {
    for (let k = 1; k <= 3; k++) {
      const d = document.createElement("div");
      d.className = "tier" + (t >= k ? " y" : "");
      d.innerHTML = `<div class="th">${ROMAN[k]} — ${TIERS[k]}${t >= k ? "" : ' <span>ще попереду</span>'}</div><p></p>`;
      d.querySelector("p").textContent = r.t[k - 1];
      tiers.appendChild(d);
    }
    $("r-facts").innerHTML = "";
    for (const [label, v] of [["Як відкрити", r.how], ["Кування", r.forge], ["Обмеження", r.limit]]) {
      const d = document.createElement("div");
      d.innerHTML = `<span>${label}</span><p></p>`;
      d.querySelector("p").textContent = v;
      $("r-facts").appendChild(d);
    }
    $("r-facts").hidden = false;
    $("r-note").textContent = gm && !st.owner ? "Обери вгорі, хто рунний коваль, — йому відкриються повні описи." : "";
  } else {
    $("r-facts").hidden = true;
    for (let k = 1; k <= t; k++) {
      const d = document.createElement("div");
      d.className = "tier y";
      d.innerHTML = `<div class="th">${ROMAN[k]} — ${TIERS[k]}</div>`;
      tiers.appendChild(d);
    }
    $("r-note").textContent = `Як саме діє руна, знає лише ${st.ownerName || "рунний коваль"}.`;
  }
}

// --- написи ---

const knownL = (l) => st.letters.includes(l);
function progress(text) {
  const ls = lettersIn(text);
  return { all: ls.length, got: ls.filter(knownL).length };
}

function drawList() {
  const box = $("ilist");
  box.innerHTML = "";
  if (!insc.length) {
    box.innerHTML = `<div class="none small">${gm ? "Написів ще немає — додай перший." : "Майстер ще не показав жодного напису."}</div>`;
  }
  for (const i of insc) {
    const p = progress(i.text);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "iitem";
    b.classList.toggle("on", i.id === selInsc);
    const shown = gm && st.shown.includes(i.id);
    b.innerHTML = `<div class="it"></div><div class="iw"></div>
      <div class="ip"><span class="pbar"><i style="width:${p.all ? Math.round((p.got / p.all) * 100) : 0}%"></i></span><span>${p.got === p.all && p.all ? "прочитано" : `${p.got} з ${p.all} знаків`}</span>${gm ? `<em class="${shown ? "y" : ""}">${shown ? "у гравців" : "прихований"}</em>` : ""}</div>`;
    b.querySelector(".it").textContent = i.title;
    b.querySelector(".iw").textContent = i.where || "";
    b.onclick = () => { selInsc = i.id; editing = false; drawList(); drawInsc(); };
    box.appendChild(b);
  }
}

function drawInsc() {
  const i = insc.find((x) => x.id === selInsc);
  $("i-blank").hidden = Boolean(i);
  $("i-page").hidden = !i || editing;
  $("i-editor").hidden = !i || !editing;
  $("i-blank-text").textContent = gm ? "Обери напис або додай новий. Гравці бачать лише ті, що ти показав." : "Обери напис ліворуч.";
  if (!i) return;
  if (editing) {
    for (const f of ["title", "where", "text", "rune"]) $("e-" + f).value = i[f] ?? "";
    return;
  }
  $("i-where").textContent = i.where || "";
  $("i-title").textContent = i.title;
  const g = guesses();
  const stone = $("stone");
  stone.innerHTML = "";
  for (const word of carve(i.text)) {
    const w = document.createElement("span");
    w.className = "word";
    for (const c of word) {
      if (c.p) { const s = document.createElement("span"); s.className = "punct"; s.textContent = c.p; w.appendChild(s); continue; }
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      const k = knownL(c.l);
      const guess = !k && !gm ? g[c.g] : "";
      cell.classList.toggle("k", k);
      cell.classList.toggle("gs", Boolean(guess));
      cell.innerHTML = `<b>${c.g}</b><i>${k ? c.l : gm ? c.l : guess || "&nbsp;"}</i>`;
      cell.onclick = (e) => (gm ? toggleLetter(c.l) : !k && openGuess(c.g, e.currentTarget));
      w.appendChild(cell);
    }
    stone.appendChild(w);
  }
  const p = progress(i.text);
  const done = p.all && p.got === p.all;
  $("readout").innerHTML = "";
  const line = carve(i.text).map((word) => word.map((c) => (c.p ? c.p : knownL(c.l) ? c.l : "·")).join("")).join(" ");
  $("readout").textContent = done ? `«${i.text}»` : line;
  $("readout").classList.toggle("done", Boolean(done));
  const rune = RUNES.find((r) => r.id === i.rune);
  $("i-hint").textContent = done && rune ? `Це креслення: «${rune.name}».` : done ? "Напис прочитано." : gm ? "" : "Клікни на руну, щоб записати свою здогадку олівцем.";
  if (gm) {
    $("i-gm").hidden = false;
    const shown = st.shown.includes(i.id);
    $("i-show").textContent = shown ? "Відкрити на екранах гравців" : "Показати гравцям";
    $("i-hide").hidden = !shown;
    const can = rune && !(st.runes[rune.id] > 0);
    $("i-rune").hidden = !can;
    if (can) {
      $("i-rune").textContent = done ? `Напис прочитано — відкрити «${rune.name}»` : `Відкрити «${rune.name}» (напис ще не прочитано)`;
      $("i-rune").onclick = () => { setTier(rune.id, 1); toast(`«${rune.name}» відкрито`); };
    }
  } else $("i-gm").hidden = true;
}

// --- абетка ---

function drawAbc() {
  const g = guesses();
  $("abc-lead").textContent = `Розгадано ${st.letters.length} з ${LETTERS.length} рун. Розгадана руна читається в усіх написах.`;
  const box = $("abc");
  box.innerHTML = "";
  // порядок — за самими рунами, не за абеткою, інакше шифр розгадується з місця знака
  const order = [...LETTERS].sort((a, b) => ABC[a].codePointAt(0) - ABC[b].codePointAt(0));
  for (const l of order) {
    const k = knownL(l);
    const guess = !k && !gm ? Object.entries(g).find(([gl]) => gl === ABC[l])?.[1] : "";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "ab";
    b.classList.toggle("k", k);
    b.classList.toggle("gs", Boolean(guess));
    b.innerHTML = `<b>${ABC[l]}</b><i>${k ? l.toUpperCase() : gm ? l.toUpperCase() : guess ? guess.toUpperCase() : "?"}</i>`;
    b.onclick = (e) => (gm ? toggleLetter(l) : !k && openGuess(ABC[l], e.currentTarget));
    box.appendChild(b);
  }
  $("abc-hint").textContent = gm ? "Клік по руні — відкрити чи сховати її значення для партії. Приглушені — ще не розгадані." : "Сірим — твої здогадки олівцем. Золотим — те, що розгадала партія.";
}

// --- олівець гравця ---

let guessFor = "";
function openGuess(g, el) {
  guessFor = g;
  $("g-glyph").textContent = g;
  const keys = $("g-keys");
  keys.innerHTML = "";
  for (const l of LETTERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = l.toUpperCase();
    b.disabled = knownL(l);
    b.onclick = () => setGuess(l);
    keys.appendChild(b);
  }
  const box = $("guess");
  box.hidden = false;
  const r = el.getBoundingClientRect();
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  box.style.top = (r.bottom + h + 8 < window.innerHeight ? r.bottom + 6 : Math.max(8, r.top - h - 6)) + "px";
}
function setGuess(l) {
  const g = guesses();
  if (l) g[guessFor] = l; else delete g[guessFor];
  saveGuesses(g);
  closeGuess();
  draw();
}
function closeGuess() { $("guess").hidden = true; }

let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
