// Сцени з Майстерні: майстер обирає сцену й одним кліком розгортає її на відкритій сцені Owlbear —
// мапа (по сітці), приховані пастки, скрині з лутом, NPC, настрій «Атмосфери» й титр.
import OBR, { buildImage, buildShape } from "@owlbear-rodeo/sdk";
import "./scenes.css";
import { SCENES as WIN, SCENE_ITEM, TRAP, CHEST, NPC, TITLE, PRESETS, setState } from "./state.js";
import * as SD from "./scene-data.js";
import { loadScenes, sceneOf, MOODS } from "./scene-data.js";
import { newTrap, presetOf } from "./trap-data.js";
import { newChest, putChest, fill, TEMPLATES, loadLoot } from "./chest-data.js";
import { syncShops } from "./shop-data.js";
import { fromPreset } from "./director.js";
import { appendLog } from "./log.js";
import { loadNpcs, npcCard } from "./npc-data.js";

const $ = (id) => document.getElementById(id);
const BASE = import.meta.env.BASE_URL;
const asset = (p) => new URL(BASE + p, location.origin).href;
let sel = null;
let size = {};   // id → { w, h } картинки мапи

OBR.onReady(async () => {
  await Promise.all([loadScenes(), loadNpcs().catch(() => {})]);
  sel = SD.SCENES[0]?.id ?? null;
  $("close").onclick = () => OBR.modal.close(WIN);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.activeElement?.tagName !== "INPUT") OBR.modal.close(WIN); });
  $("q").addEventListener("input", drawList);
  $("go").onclick = () => deploy().catch((e) => { console.error(e); status(`Не вдалося: ${e.message}`); });
  $("title-btn").onclick = () => showTitle(sceneOf(sel));
  $("clear").onclick = () => clear().catch(() => status("Не вдалося прибрати — відкрий сцену"));
  $("img").onload = () => { const s = sceneOf(sel); if (s) size[s.id] = { w: $("img").naturalWidth, h: $("img").naturalHeight }; marks(); };
  draw();
});

function draw() { drawList(); drawView(); }

function drawList() {
  const q = $("q").value.trim().toLowerCase();
  const box = $("list");
  box.innerHTML = "";
  $("prog").textContent = `${SD.SCENES.length} сцен`;
  for (const s of SD.SCENES) {
    if (q && !`${s.name} ${s.title} ${s.read}`.toLowerCase().includes(q)) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = `scard${s.id === sel ? " sel" : ""}`;
    b.innerHTML = `<div class="th">${s.img ? `<img alt="" loading="lazy" src="${esc(s.img)}">` : "🗺"}</div><div><div class="nm">${esc(s.name)}</div><div class="sub">${esc(MOODS[s.mood] ?? "")} · ${(s.traps ?? []).length}🔴 ${(s.chests ?? []).length}🟡 ${(s.npcs ?? []).length}🔵</div></div>`;
    b.onclick = () => { sel = s.id; draw(); };
    box.appendChild(b);
  }
}

function drawView() {
  const s = sceneOf(sel);
  $("none").hidden = Boolean(s);
  $("sheet").hidden = !s;
  if (!s) return;
  $("nomap").hidden = Boolean(s.img);
  $("img").hidden = !s.img;
  if (s.img && $("img").getAttribute("src") !== s.img) $("img").src = s.img;
  $("meta").textContent = [MOODS[s.mood], `${s.cols ?? 24}×${s.rows ?? 16} клітинок`].filter(Boolean).join(" · ");
  $("name").textContent = s.name;
  $("titr").innerHTML = s.title ? `<b>${esc(s.title)}</b>${s.sub ? `<span>${esc(s.sub)}</span>` : ""}` : "";
  $("read").textContent = s.read ?? ""; $("read-box").hidden = !s.read;
  $("notes").textContent = s.notes ?? ""; $("notes-box").hidden = !s.notes;
  const li = [
    ...(s.traps ?? []).map((t) => `🔴 ${presetOf(t.kind).icon} ${t.name || presetOf(t.kind).name} — СК ${t.dc ?? presetOf(t.kind).dc}, клітинка ${t.x}:${t.y}${t.clue ? `. Уважний помітить: ${t.clue}` : ""}`),
    ...(s.chests ?? []).map((c) => `🟡 ${c.name}${SD.CHEST_TPL[c.tpl] && c.tpl !== "none" ? ` (${SD.CHEST_TPL[c.tpl].toLowerCase()})` : " (порожня)"}${Number(c.lock) ? `, замок СК ${c.lock}` : ""}`),
  ];
  drawWho(s);
  $("objs").innerHTML = li.map((t) => `<li>${esc(t)}</li>`).join("");
  $("objs-box").hidden = !li.length;
  $("title-btn").hidden = !s.title;
  status("");
  marks();
}

// крапки на прев'ю: де стоятимуть об'єкти
function grid(s) {
  const cols = Math.max(1, Number(s.cols) || 24);
  const sz = size[s.id];
  const realRows = sz ? (sz.h * cols) / sz.w : Number(s.rows) || 16;
  const rows = Math.max(1, Number(s.rows) || Math.round(realRows));
  return { cols, rows, realRows, ky: realRows / rows };   // ky — підгонка, якщо картинка іншої форми, ніж задумано
}
function marks() {
  const s = sceneOf(sel);
  const box = $("marks");
  box.innerHTML = "";
  if (!s) return;
  const g = grid(s);
  const dot = (o, cls, title, n = 1) => {
    const d = document.createElement("i");
    d.className = cls;
    d.title = title;
    d.style.left = `${((clampX(o.x, g) - 1 + n / 2) / g.cols) * 100}%`;
    d.style.top = `${((clampY(o.y, g) - 1) * g.ky + n / 2) / g.realRows * 100}%`;
    box.appendChild(d);
  };
  for (const t of s.traps ?? []) dot(t, "t", t.name, Math.max(1, Number(t.size) || 1));
  for (const c of s.chests ?? []) dot(c, "c", c.name);
  for (const n of s.npcs ?? []) dot(n, "n", n.name);
}
const clampX = (v, g) => Math.min(g.cols, Math.max(1, Number(v) || 1));
const clampY = (v, g) => Math.min(g.rows, Math.max(1, Number(v) || 1));

function imgSize(url) {
  return new Promise((ok, no) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => ok({ w: i.naturalWidth, h: i.naturalHeight });
    i.onerror = () => no(new Error("картинка мапи не завантажилась"));
    i.src = url;
  });
}

// ---------- розгортання ----------
async function deploy() {
  const s = sceneOf(sel);
  if (!s) return;
  if (!(await OBR.scene.isReady())) return status("Спершу відкрий сцену в Owlbear (можна порожню)");
  $("go").disabled = true;
  status("Розгортаю…");
  try {
    await clear(true);
    const dpi = await OBR.scene.grid.getDpi();
    const tag = { [SCENE_ITEM]: { id: s.id } };
    const items = [];
    let mapW = (Number(s.cols) || 24) * dpi, mapH = (Number(s.rows) || 16) * dpi;
    let sz = null;
    if (s.img) { sz = await imgSize(s.img); size[s.id] = sz; mapH = (sz.h * (Number(s.cols) || 24) / sz.w) * dpi; }
    const g = grid(s);

    // мапа — посеред екрана, кут по сітці, щоб клітинки мапи збіглися з сіткою сцени
    const [vw, vh, pos, scale] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight(), OBR.viewport.getPosition(), OBR.viewport.getScale()]);
    const cx = (vw / 2 - pos.x) / scale, cy = (vh / 2 - pos.y) / scale;
    const o = { x: Math.round((cx - mapW / 2) / dpi) * dpi, y: Math.round((cy - mapH / 2) / dpi) * dpi };
    const at = (x, y, n = 1) => ({ x: o.x + (clampX(x, g) - 1) * dpi, y: o.y + Math.round((clampY(y, g) - 1) * g.ky) * dpi, n });

    if (s.img) {
      items.push(buildImage({ url: s.img, width: sz.w, height: sz.h, mime: /\.png($|\?)/i.test(s.img) ? "image/png" : /\.jpe?g($|\?)/i.test(s.img) ? "image/jpeg" : "image/webp" }, { dpi: sz.w / g.cols, offset: { x: 0, y: 0 } })
        .position(o).layer("MAP").locked(true).name(`Мапа: ${s.name}`).metadata(tag).build());
    }

    for (const t of s.traps ?? []) {
      const n = Math.max(1, Math.min(6, Number(t.size) || 1));
      const p = at(t.x, t.y);
      const base = newTrap(t.kind);
      const dc = Number(t.dc) || base.dc;
      items.push(buildShape().shapeType("RECTANGLE").width(n * dpi).height(n * dpi).position({ x: p.x, y: p.y })
        .strokeColor("#ff5a4a").strokeWidth(4).strokeOpacity(0.9).fillColor("#ff5a4a").fillOpacity(0.15)
        .layer("DRAWING").visible(false).name(`Пастка: ${t.name || base.name}`)
        .metadata({ ...tag, [TRAP]: { ...base, name: t.name || base.name, dc, spot: dc + 1, clue: t.clue || base.clue } }).build());
    }

    if ((s.chests ?? []).some((c) => c.tpl && c.tpl !== "none")) { await loadLoot().catch(() => {}); await syncShops().catch(() => {}); }
    for (const c of s.chests ?? []) {
      const chest = newChest(c.name || "Скриня");
      const tpl = TEMPLATES.find((t) => t.id === c.tpl);
      if (tpl) { fill(chest, tpl); chest.name = c.name || tpl.name; }
      if (Number(c.lock) > 0) chest.lock = { ...chest.lock, on: true, dc: Number(c.lock) };
      putChest(chest);
      const p = at(c.x, c.y);
      items.push(buildImage({ url: asset("chest.svg"), width: 256, height: 256, mime: "image/svg+xml" }, { dpi: 256, offset: { x: 128, y: 128 } })
        .position({ x: p.x + dpi / 2, y: p.y + dpi / 2 }).layer("PROP").name(chest.name).metadata({ ...tag, [CHEST]: { id: chest.id } }).build());
    }

    for (const n of s.npcs ?? []) {
      const p = at(n.x, n.y);
      const card = npcCard(n.ref);
      const name = n.name || card?.name || "NPC";
      const sub = n.sub || card?.sub || "";
      // токен з картки NPC (портрет із Майстерні), інакше — силует
      let img = { url: asset("npc-token.svg"), width: 256, height: 256, mime: "image/svg+xml" };
      if (card?.img) {
        try { const z = await imgSize(card.img); img = { url: card.img, width: z.w, height: z.h, mime: /\.png($|\?)/i.test(card.img) ? "image/png" : /\.jpe?g($|\?)/i.test(card.img) ? "image/jpeg" : "image/webp" }; } catch { /* лишаємо силует */ }
      }
      items.push(buildImage(img, { dpi: img.width, offset: { x: img.width / 2, y: img.height / 2 } })
        .position({ x: p.x + dpi / 2, y: p.y + dpi / 2 }).layer("CHARACTER").name(name).plainText(name)
        .visible($("o-npc").checked).metadata({ ...tag, [NPC]: { name, sub } }).build());
    }

    await OBR.scene.items.addItems(items);
    if ($("o-mood").checked && s.mood) {
      const p = PRESETS.find((x) => x.id === s.mood);
      if (p) await setState(fromPreset(p));
    }
    if ($("o-title").checked && s.title) await showTitle(s);
    OBR.viewport.animateToBounds({ min: o, max: { x: o.x + mapW, y: o.y + mapH }, width: mapW, height: mapH, center: { x: o.x + mapW / 2, y: o.y + mapH / 2 } }).catch(() => {});
    if ($("o-title").checked && s.title) appendLog({ k: "g", t: s.title ? `${s.title}${s.sub ? ` — ${s.sub}` : ""}` : s.name, w: "Майстер" }).catch(() => {});
    const parts = [s.img ? "мапа" : "без мапи", `пасток ${(s.traps ?? []).length} (сховані)`, `скринь ${(s.chests ?? []).length}`, `NPC ${(s.npcs ?? []).length}${$("o-npc").checked ? "" : " (сховані)"}`];
    status(`Готово: ${parts.join(", ")}. Пересунь, якщо щось стало не туди.`);
    toast("Сцену розгорнуто");
  } finally {
    $("go").disabled = false;
  }
}

async function clear(quiet = false) {
  const s = sceneOf(sel);
  if (!s || !(await OBR.scene.isReady())) return;
  const mine = await OBR.scene.items.getItems((i) => i.metadata?.[SCENE_ITEM]?.id === s.id);
  if (mine.length) await OBR.scene.items.deleteItems(mine.map((i) => i.id));
  if (!quiet) status(mine.length ? `Прибрано з мапи: ${mine.length}` : "На мапі нічого з цієї сцени немає");
}

async function showTitle(s) {
  if (!s?.title) return;
  await OBR.broadcast.sendMessage(TITLE, { big: s.title, small: s.sub ?? "" }, { destination: "ALL" }).catch(() => {});
}

// хто в сцені: картки NPC — як відігравати, що знають
function drawWho(s) {
  const box = $("who");
  box.innerHTML = "";
  for (const n of s.npcs ?? []) {
    const c = npcCard(n.ref) ?? {};
    const name = n.name || c.name || "NPC";
    const d = document.createElement("div");
    d.className = "npc";
    const row = (t, v) => (v ? `<div><i>${t}</i> ${esc(v)}</div>` : "");
    d.innerHTML = `<div class="ph">${c.img ? `<img alt="" src="${esc(c.img)}">` : "👤"}</div><div class="tx">
      <b>${esc(name)}</b>${n.sub || c.sub ? `<span> · ${esc(n.sub || c.sub)}</span>` : ""}${n.ref ? "" : `<em> · без картки</em>`}
      ${row("У цій сцені:", n.note)}${row("Вигляд:", c.look)}${row("Манера:", c.manner)}${row("Хоче:", c.wants)}${row("Знає:", c.knows)}${row("Таємниця:", c.secret)}
      ${c.quote ? `<q>${esc(c.quote)}</q>` : ""}</div>`;
    box.appendChild(d);
  }
  $("who-box").hidden = !box.children.length;
}

function status(t) { $("status").textContent = t; }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
