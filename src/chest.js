// Скриня: майстер наповнює й замикає, гравці відмикають (справжні кубики — майстер підтверджує),
// беруть речі (хто перший) і ділять монети порівну. Узяте само лягає в лист персонажа.
import OBR, { buildImage } from "@owlbear-rodeo/sdk";
import "./chest.css";
import { CHEST, CHEST_REQ, CHEST_DATA, CHEST_TRY, CHEST_FAIL, CHEST_TAKE, CHEST_SPLIT, CHEST_SHOW } from "./state.js";
import { appendLog } from "./log.js";
import { RARITY, money, readSheet } from "./shop-data.js";
import { playSecret } from "./sfx.js";
import {
  CHESTS, CATS, LOOT, TEMPLATES, catalog, asLoot, fill, chests, saveChests, chestOf, putChest, newChest,
  publicView, coinCp,
} from "./chest-data.js";

const BASE = import.meta.env.BASE_URL;
const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let me = { id: "", name: "" };
let cid = new URLSearchParams(location.search).get("c") || "";
let view = null;          // гравець: що видно в скрині
let lastState = "";
let tried = false;

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  me = { id: await OBR.player.getId(), name: (readSheet(room)?.data?.name || "").trim() || (await OBR.player.getName()) };
  document.body.classList.toggle("gm", gm);
  const close = () => OBR.modal.close(CHEST);
  $("close").onclick = close;
  $("pclose").onclick = close;
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) close(); });
  if (gm) initGM(); else initPlayer();
});

// ---------- гравець ----------

function initPlayer() {
  $("pview").hidden = false;
  OBR.broadcast.onMessage(CHEST_DATA, (event) => {
    const d = event.data;
    if (!d?.id || d.id !== cid) return;
    view = d;
    drawPlayer();
  });
  OBR.broadcast.onMessage(CHEST_FAIL, (event) => {
    const d = event.data ?? {};
    if (d.id !== cid) return;
    tried = false;
    toast(d.who === me.name ? "Не вийшло. Замок не піддався." : `${d.who}: замок не піддався`);
    drawPlayer();
  });
  for (const b of document.querySelectorAll("[data-how]")) b.onclick = () => attempt(b.dataset.how);
  $("p-open").onclick = () => attempt("open");
  if (!cid) { $("p-name").textContent = "Скриня"; $("p-stage").innerHTML = chestSVG(false); return; }
  $("p-stage").innerHTML = chestSVG(false);
  OBR.broadcast.sendMessage(CHEST_REQ, { id: cid }, { destination: "REMOTE" }).catch(() => {});
}

function attempt(how) {
  if (tried) return;
  tried = true;
  OBR.broadcast.sendMessage(CHEST_TRY, { id: cid, how, who: me.name, to: me.id }, { destination: "REMOTE" }).catch(() => {});
  const say = { pick: "Кидай Спритність (злодійські інструменти) — і скажи майстру результат.", break: "Кидай Силу (Атлетика) — і скажи майстру результат.", key: "Покажи майстру ключ.", open: "Відчиняєш…" };
  $("p-wait").textContent = say[how] ?? "";
  $("p-wait2").textContent = say[how] ?? "";
  drawPlayer();
}

function drawPlayer() {
  const v = view;
  if (!v) return;
  $("p-name").textContent = v.name;
  const open = v.state === "open";
  if (open && lastState && lastState !== "open") { playSecret("creak", "front", 0.7).catch(() => {}); }
  if (!lastState || (open !== (lastState === "open"))) $("p-stage").innerHTML = chestSVG(open, lastState && open);
  lastState = v.state;
  $("p-locked").hidden = open || !v.lock?.on;
  $("p-closed").hidden = open || v.lock?.on;
  $("p-open-box").hidden = !open;
  for (const b of document.querySelectorAll("[data-how], #p-open")) b.disabled = tried;
  if (!open) {
    $("p-lnote").textContent = `Замкнено${v.lock.dc ? ` · СК ${v.lock.dc}` : ""}${v.lock.note ? ` — ${v.lock.note}` : ""}`;
    if (!tried) { $("p-wait").textContent = ""; $("p-wait2").textContent = ""; }
    return;
  }
  // монети
  const cp = coinCp(v.coins);
  $("p-coins").innerHTML = "";
  if (cp > 0 && !v.split) {
    $("p-coins").innerHTML = `<span class="coins">🪙 ${money(cp)}</span>`;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "go";
    b.textContent = "Поділити порівну між усіма";
    b.onclick = () => { b.disabled = true; OBR.broadcast.sendMessage(CHEST_SPLIT, { id: cid, who: me.name }, { destination: "REMOTE" }).catch(() => {}); };
    $("p-coins").appendChild(b);
  } else if (v.split) {
    $("p-coins").innerHTML = `<span class="dim">Монети поділено${cp ? ` · лишилось ${money(cp)}` : ""}</span>`;
  }
  // речі
  const grid = $("p-items");
  grid.innerHTML = "";
  if (!v.items?.length) grid.innerHTML = `<div class="none">${cp && !v.split ? "Крім монет — нічого." : "Скриня порожня."}</div>`;
  for (const it of v.items ?? []) {
    const c = document.createElement("div");
    c.className = `ware r-${it.rarity || "common"}` + (it.by ? " taken" : "");
    c.innerHTML = `<div class="wimg">${it.img ? `<img alt="" src="${esc(it.img)}">` : (CATS[it.cat] ?? "📦")}</div>
      <div class="wname"></div><div class="wrar">${RARITY[it.rarity] ?? ""}</div><div class="wdesc"></div><div class="wmech"></div><div class="wfoot"></div>`;
    c.querySelector(".wname").textContent = it.name;
    c.querySelector(".wdesc").textContent = it.desc || "";
    c.querySelector(".wmech").textContent = it.mech || "";
    const foot = c.querySelector(".wfoot");
    if (it.by) foot.innerHTML = `<span class="by">Узяв: ${esc(it.by)}</span>`;
    else {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "go";
      b.textContent = "Взяти";
      b.onclick = () => { b.disabled = true; b.textContent = "…"; OBR.broadcast.sendMessage(CHEST_TAKE, { id: cid, iid: it.id, who: me.name, to: me.id }, { destination: "REMOTE" }).catch(() => {}); };
      foot.appendChild(b);
    }
    grid.appendChild(c);
  }
}

// ---------- майстер ----------

let chest = null;

function initGM() {
  $("gmbar").hidden = false;
  $("gmview").hidden = false;
  let all = chests();
  if (!cid || !all[cid]) cid = Object.values(all).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))[0]?.id ?? "";
  if (!cid) { chest = putChest(newChest("Скриня")); cid = chest.id; }
  chest = chestOf(cid);

  for (const t of TEMPLATES) $("tpl").appendChild(new Option(t.name, t.id));
  $("tpl").onchange = () => {
    const t = TEMPLATES.find((x) => x.id === $("tpl").value);
    $("tpl").value = "";
    if (!t) return;
    if (chest.items.some((i) => i.by)) return toast("Із цієї скрині вже щось узяли — створи нову");
    fill(chest, t);
    chest.split = false;
    save();
    drawGM();
    toast(`Наповнено: «${t.name}»`);
  };
  $("add").onclick = () => { chest = putChest(newChest(`Скриня ${Object.keys(chests()).length + 1}`)); cid = chest.id; drawGM(); };
  let armed = 0;
  $("del").onclick = () => {
    if (Date.now() - armed > 3000) { armed = Date.now(); toast("Натисни ще раз, щоб видалити скриню"); return; }
    const all = chests();
    delete all[cid];
    saveChests(all);
    const next = Object.values(all)[0];
    chest = next ?? putChest(newChest("Скриня"));
    cid = chest.id;
    drawGM();
  };
  $("pick").onchange = () => { cid = $("pick").value; chest = chestOf(cid); drawGM(); };
  $("show").onclick = async () => {
    await OBR.broadcast.sendMessage(CHEST_DATA, publicView(chest), { destination: "REMOTE" }).catch(() => {});
    await OBR.broadcast.sendMessage(CHEST_SHOW, { id: cid }, { destination: "REMOTE" }).catch(() => {});
    toast("Скриня відкрилась на екранах гравців");
  };
  $("bind").onclick = bind;
  $("place").onclick = place;

  // поля
  $("e-name").oninput = () => { chest.name = $("e-name").value || "Скриня"; saveSoon(); fillPick(); };
  $("e-lock").onchange = () => { chest.lock.on = $("e-lock").checked; if (chest.lock.on && chest.state === "open") chest.state = "closed"; save(); drawGM(); };
  $("e-dc").oninput = () => { chest.lock.dc = Number($("e-dc").value) || 10; saveSoon(); };
  $("e-showdc").onchange = () => { chest.lock.showDc = $("e-showdc").checked; save(); };
  $("e-note").oninput = () => { chest.lock.note = $("e-note").value; saveSoon(); };
  for (const k of ["gp", "sp", "cp"]) $("e-" + k).oninput = () => { chest.coins[k] = Math.max(0, Number($("e-" + k).value) || 0); saveSoon(); };

  // каталог: товари крамниць + власні знахідки
  const cat = $("cat-pick");
  const og1 = document.createElement("optgroup"); og1.label = "Знахідки";
  LOOT.forEach((x, i) => og1.appendChild(new Option(`${CATS[x.cat] ?? ""} ${x.name}`, "l" + i)));
  cat.appendChild(og1);
  const shopItems = catalog();
  const og2 = document.createElement("optgroup"); og2.label = "З крамниць";
  shopItems.forEach((x, i) => og2.appendChild(new Option(`${x.name} — ${x.from}`, "s" + i)));
  if (shopItems.length) cat.appendChild(og2);
  $("cat-add").onclick = () => {
    const v = cat.value;
    if (!v) return;
    const src = v[0] === "l" ? LOOT[Number(v.slice(1))] : shopItems[Number(v.slice(1))];
    chest.items.push(asLoot(src));
    save(); drawGM();
  };
  $("n-add").onclick = () => {
    const name = $("n-name").value.trim();
    if (!name) return;
    chest.items.push(asLoot({ name, price: Number($("n-price").value) || 0, cat: "gear" }));
    $("n-name").value = ""; $("n-price").value = "";
    save(); drawGM();
  };

  window.addEventListener("storage", (e) => {
    if (e.key !== CHESTS) return;
    const fresh = chestOf(cid);
    if (fresh) { chest = fresh; if (!document.activeElement || !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) drawGM(); else { drawStates(); drawTries(); drawItems(); } }
  });
  drawGM();
}

function save() {
  putChest(chest);
  OBR.broadcast.sendMessage(CHEST_DATA, publicView(chest), { destination: "REMOTE" }).catch(() => {});
}
let saveTimer = null;
function saveSoon() { clearTimeout(saveTimer); saveTimer = setTimeout(save, 400); }

function fillPick() {
  const sel = $("pick");
  sel.innerHTML = "";
  for (const c of Object.values(chests()).sort((a, b) => (b.at ?? 0) - (a.at ?? 0))) sel.appendChild(new Option(c.name, c.id));
  sel.value = cid;
}

function drawGM() {
  fillPick();
  $("e-name").value = chest.name;
  $("e-lock").checked = Boolean(chest.lock?.on);
  $("lockset").hidden = !chest.lock?.on;
  $("e-dc").value = chest.lock?.dc ?? 15;
  $("e-showdc").checked = Boolean(chest.lock?.showDc);
  $("e-note").value = chest.lock?.note ?? "";
  for (const k of ["gp", "sp", "cp"]) $("e-" + k).value = chest.coins?.[k] || "";
  $("g-stage").innerHTML = chestSVG(chest.state === "open");
  drawStates();
  drawTries();
  drawItems();
}

function drawStates() {
  const box = $("states");
  box.innerHTML = "";
  for (const [k, label] of [["closed", chest.lock?.on ? "Замкнена" : "Зачинена"], ["open", "Відкрита"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.classList.toggle("on", chest.state === k);
    b.onclick = () => { setOpen(k === "open", "Майстер"); };
    box.appendChild(b);
  }
  $("split-note").textContent = chest.split ? "уже поділено між гравцями" : coinCp(chest.coins) ? "гравці поділять порівну" : "";
}

function setOpen(on, who, how) {
  chest.state = on ? "open" : "closed";
  chest.tries = [];
  save();
  drawGM();
  const verb = how === "break" ? "зламав замок і відкрив" : how === "pick" ? "відімкнув" : how === "key" ? "відімкнув ключем" : "відкрив";
  if (on) appendLog({ k: "g", t: `${who} ${verb} скриню «${chest.name}».`, w: "Майстер" }).catch(() => {});
}

function drawTries() {
  const box = $("tries");
  box.innerHTML = "";
  for (const t of chest.tries ?? []) {
    const d = document.createElement("div");
    d.className = "try";
    const how = { pick: "відмикає відмичками", break: "ламає замок", key: "каже, що має ключ", open: "відчиняє" }[t.how] ?? t.how;
    d.innerHTML = `<div><b></b> ${how}${chest.lock?.on ? ` · СК ${chest.lock.dc}` : ""}</div><div class="tb"><button type="button" class="go">Вдалося</button><button type="button" class="ghost">Ні</button></div>`;
    d.querySelector("b").textContent = t.who;
    const [ok, no] = d.querySelectorAll("button");
    ok.onclick = () => setOpen(true, t.who, t.how);
    no.onclick = () => {
      chest.tries = chest.tries.filter((x) => x !== t);
      save(); drawTries();
      OBR.broadcast.sendMessage(CHEST_FAIL, { id: cid, who: t.who }, { destination: "REMOTE" }).catch(() => {});
    };
    box.appendChild(d);
  }
}

function drawItems() {
  const box = $("erows");
  box.innerHTML = "";
  if (!chest.items.length) box.innerHTML = `<div class="none">Порожньо. Додай речі нижче або «Наповнити…» вгорі.</div>`;
  chest.items.forEach((it, i) => {
    const r = document.createElement("div");
    r.className = "erow" + (it.by ? " taken" : "");
    r.innerHTML = `<span class="eic">${it.img ? `<img alt="" src="${esc(it.img)}">` : (CATS[it.cat] ?? "📦")}</span>
      <div class="ebody"><input class="en" maxlength="60"><input class="ed" maxlength="200" placeholder="Опис"></div>
      <span class="ep">${it.price ? `${it.price} зм` : ""}</span>
      <span class="eby">${it.by ? `узяв ${esc(it.by)}` : ""}</span>
      <button type="button" class="ghost" title="${it.by ? "Повернути в скриню" : "Прибрати"}">${it.by ? "↩" : "✕"}</button>`;
    const [n, d] = r.querySelectorAll("input");
    n.value = it.name; d.value = it.desc || "";
    n.oninput = () => { it.name = n.value; saveSoon(); };
    d.oninput = () => { it.desc = d.value; saveSoon(); };
    r.querySelector("button").onclick = () => { if (it.by) it.by = ""; else chest.items.splice(i, 1); save(); drawItems(); };
    box.appendChild(r);
  });
}

// зробити виділений токен цією скринею
async function bind() {
  try {
    const ids = (await OBR.player.getSelection()) ?? [];
    if (!ids.length) return toast("Виділи токен на мапі");
    await OBR.scene.items.updateItems(ids.slice(0, 1), (items) => { for (const it of items) it.metadata[CHEST] = { id: cid }; });
    toast("Цей токен тепер — скриня. Гравці відкриють її правим кліком.");
  } catch { toast("Не вдалося — відкрий сцену"); }
}

// поставити токен скрині посеред екрана
async function place() {
  try {
    const [w, h, pos, scale] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight(), OBR.viewport.getPosition(), OBR.viewport.getScale()]);
    const center = { x: (w / 2 - pos.x) / scale, y: (h / 2 - pos.y) / scale };
    const item = buildImage({ url: new URL(BASE + "chest.svg", location.origin).href, width: 256, height: 256, mime: "image/svg+xml" }, { dpi: 256, offset: { x: 128, y: 128 } })
      .position(center)
      .layer("PROP")
      .name(chest.name)
      .metadata({ [CHEST]: { id: cid } })
      .build();
    await OBR.scene.items.addItems([item]);
    toast("Скриню поставлено посеред екрана");
  } catch (err) { console.error(err); toast("Не вдалося поставити — відкрий сцену"); }
}

// ---------- дрібниці ----------

function chestSVG(open, animate = false) {
  return `<svg viewBox="0 0 256 236" class="${open ? "open" : ""} ${animate ? "anim" : ""}" aria-hidden="true">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a5a32"/><stop offset="1" stop-color="#4a2c16"/></linearGradient>
    <linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a06a3c"/><stop offset="1" stop-color="#6a4222"/></linearGradient>
    <linearGradient id="li" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2210"/><stop offset="1" stop-color="#22140a"/></linearGradient>
    <linearGradient id="i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6d7680"/><stop offset="1" stop-color="#2f353c"/></linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe2a0"/><stop offset="1" stop-color="#c98f2e"/></linearGradient>
    <radialGradient id="glow" cx=".5" cy=".9" r=".7"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".5" stop-color="#ffb347" stop-opacity=".35"/><stop offset="1" stop-color="#ffb347" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="128" cy="218" rx="98" ry="13" fill="#000" opacity=".4"/>
  <ellipse class="glow" cx="128" cy="96" rx="120" ry="90" fill="url(#glow)"/>
  <g class="lid-in"><path d="M38 108 L218 108 L206 40 Q128 22 50 40 Z" fill="url(#li)" stroke="#2a180b" stroke-width="5"/>
    <path d="M62 104 L66 42 M194 104 L190 42" stroke="url(#i)" stroke-width="12"/></g>
  <g class="gold"><ellipse cx="128" cy="112" rx="84" ry="14" fill="#e9b44c"/>
    <circle cx="96" cy="106" r="8" fill="#ffd98a"/><circle cx="120" cy="102" r="9" fill="#ffe2a0"/><circle cx="150" cy="105" r="8" fill="#f2c25f"/><circle cx="168" cy="109" r="7" fill="#ffd98a"/>
    <path d="M106 96 l4 -10 l4 10 Z" fill="#fff6d6" opacity=".9"/></g>
  <rect x="34" y="112" width="188" height="100" rx="6" fill="url(#w)" stroke="#2a180b" stroke-width="5"/>
  <path d="M34 140 H222 M34 176 H222" stroke="#3a2210" stroke-width="3" opacity=".5"/>
  <path d="M62 112 L62 212 M194 112 L194 212" stroke="url(#i)" stroke-width="16"/>
  <rect x="34" y="106" width="188" height="12" fill="url(#i)" stroke="#1d2126" stroke-width="2"/>
  <g class="lid"><path d="M34 92 Q34 46 128 46 Q222 46 222 92 L222 112 L34 112 Z" fill="url(#l)" stroke="#2a180b" stroke-width="5"/>
    <path d="M62 50 Q60 80 62 112 M194 50 Q196 80 194 112" fill="none" stroke="url(#i)" stroke-width="16"/>
    <rect x="108" y="100" width="40" height="40" rx="6" fill="url(#g)" stroke="#6b4a12" stroke-width="4"/>
    <circle cx="128" cy="116" r="6" fill="#3a2608"/><path d="M125 118 L123 131 H133 L131 118 Z" fill="#3a2608"/></g>
  <g fill="#c8ccd2"><circle cx="62" cy="128" r="3"/><circle cx="62" cy="196" r="3"/><circle cx="194" cy="128" r="3"/><circle cx="194" cy="196" r="3"/></g>
</svg>`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}
let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
