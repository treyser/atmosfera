// Зоряне небо: уся партія разом з'єднує зорі лініями й шукає сузір'я.
// Лінії бачать усі наживо. Перевіряє й зберігає майстер (його фоновий скрипт): знайдене сузір'я
// лишається в зоряному атласі назавжди й показує напрямок — а на мапі світу зорю над точкою, куди веде.
import OBR from "@owlbear-rodeo/sdk";
import "./stars.css";
import { STAR, STAR_REQ, STAR_LINE, STAR_STATE, HERE } from "./state.js";
import { appendLog } from "./log.js";
import { POINTS } from "./atlas-points.js";
import {
  CONST, constOf, DIRS, dirName, bearing, buildSky, angDiff, lineKey, MAX_ALT, rng,
  skyState, saveSky, skySeen, saveSkySeen, SKY_KEY, SKY_SEEN, applyLine,
} from "./stars-data.js";

const $ = (id) => document.getElementById(id);
const cv = $("sky");
const ctx = cv.getContext("2d");
let gm = false;
let room = "";
let s = null;              // стан неба
let sky = { stars: [], cons: [] };
let skySig = "";
let here = null;           // де зараз корабель (точка Атласу)
let view = 0;              // куди дивимося (азимут центру)
const FOV = 100;
let sel = null;            // обрана зоря (лише в мене)
let W = 0, H = 0, HY = 0, kx = 1, ky = 1;
let milky = [];
let flashTimer = null;

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  document.body.classList.toggle("gm", gm);
  $("close").onclick = () => OBR.modal.close(STAR);
  for (const b of document.querySelectorAll("#tabs button")) b.onclick = () => tab(b.dataset.t);
  window.addEventListener("keydown", (e) => {
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (e.key === "Escape") OBR.modal.close(STAR);
    if (e.key === "ArrowLeft") turn(-15);
    if (e.key === "ArrowRight") turn(15);
  });
  $("left").onclick = () => turn(-30);
  $("right").onclick = () => turn(30);
  here = (await OBR.room.getMetadata())[HERE] ?? null;
  OBR.room.onMetadataChange((m) => { here = m[HERE] ?? null; if (gm) drawGM(); });

  if (gm) initGM(); else initPlayer();
  refresh(true);
  resize();
  new ResizeObserver(resize).observe($("skybox"));
  input();
  requestAnimationFrame(frame);
});

// ---------- синхронізація ----------

function initPlayer() {
  s = skySeen(room);
  OBR.broadcast.onMessage(STAR_STATE, (event) => { if (event.data) { saveSkySeen(room, event.data); s = skySeen(room); refresh(); } });
  OBR.broadcast.sendMessage(STAR_REQ, {}, { destination: "REMOTE" }).catch(() => {});
  window.addEventListener("storage", (e) => { if (e.key === SKY_SEEN(room)) { s = skySeen(room); refresh(); } });
}

function initGM() {
  s = skyState(room);
  $("gm").hidden = false;
  $("ghost").onchange = () => {};
  $("open").onclick = () => { s.night.open = !s.night.open; commit(); toast(s.night.open ? "Небо відкрито на екранах гравців" : "Небо закрито"); };
  $("clear").onclick = () => { s.lines = []; s.found = []; commit(); toast("Усі лінії стерто"); };
  $("newnight").onclick = () => {
    s.night.seed = Math.floor(Math.random() * 1e9);
    s.lines = []; s.found = []; s.hints = {};
    commit();
    toast("Нова ніч — інше небо");
  };
  window.addEventListener("storage", (e) => { if (e.key === SKY_KEY(room)) { s = skyState(room); refresh(); } });
}

let sendTimer = null;
function commit() {
  saveSky(room, s);
  refresh();
  clearTimeout(sendTimer);
  sendTimer = setTimeout(() => OBR.broadcast.sendMessage(STAR_STATE, s, { destination: "REMOTE" }).catch(() => {}), 80);
}

// провести чи стерти лінію
function line(d) {
  if (gm) {
    const fresh = applyLine(s, d);
    commit();   // святкування — у refresh()
    logFound(fresh);
  } else {
    // одразу показати в себе; майстер перевірить і розішле всім
    const key = d.add || d.del;
    if (d.add && !s.lines.includes(key)) s.lines.push(key);
    if (d.del) s.lines = s.lines.filter((x) => x !== key);
    OBR.broadcast.sendMessage(STAR_LINE, d, { destination: "REMOTE" }).catch(() => {});
  }
}
function logFound(ids) {
  for (const id of ids) {
    const c = constOf(id), v = s.night.vis.find((x) => x.id === id);
    appendLog({ k: "g", t: `Зоряне небо: знайдено сузір'я «${c.name}» — веде на ${dirName(v?.az ?? c.az).full}${v?.lead ? `, до №${v.lead}` : ""}.`, w: "Майстер" }).catch(() => {});
  }
}

// ---------- стан → малювання ----------

let prevFound = null;
function refresh(first = false) {
  const sig = JSON.stringify(s.night.vis) + s.night.seed;
  if (sig !== skySig) {
    skySig = sig;
    sky = buildSky(s.night);
    milky = makeMilky(s.night.seed);
    if (sel && !sky.stars.some((x) => x.id === sel)) sel = null;
  }
  // святкування нового сузір'я (і в майстра, коли знайшли гравці)
  if (prevFound && !first) for (const id of s.found) if (!prevFound.includes(id)) celebrate(id);
  prevFound = [...s.found];
  $("sub").textContent = s.night.open ? "Ніч ясна — шукайте знайомі сузір'я" : gm ? "Гравці цього неба поки не бачать" : "Майстер ще не відкрив небо";
  drawTonight();
  drawKnown();
  if (gm) drawGM();
}

function tab(t) {
  for (const b of document.querySelectorAll("#tabs button")) b.classList.toggle("on", b.dataset.t === t);
  $("p-night").hidden = t !== "night";
  $("p-atlas").hidden = t !== "atlas";
}

function turn(deg) { view = (view + deg + 360) % 360; }

// ---------- небо ----------

function resize() {
  const r = $("skybox").getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  W = r.width; H = r.height;
  cv.width = W * dpr; cv.height = H * dpr;
  cv.style.width = W + "px"; cv.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  HY = H * 0.8;
  kx = W / FOV;
  ky = Math.max(0.5, Math.min(kx, (HY - 70) / MAX_ALT));
}
const X = (az) => W / 2 + angDiff(az, view) * kx;
const Y = (alt) => HY - alt * ky;
const onScreen = (az) => Math.abs(angDiff(az, view)) < FOV / 2 + 6;

function makeMilky(seed) {
  const r = rng((seed ?? 1) ^ 0x9e37);
  return Array.from({ length: 300 }, () => {
    const az = r() * 360;
    return { az, alt: 28 + 16 * Math.sin((az * Math.PI) / 90) + (r() - 0.5) * 14, rad: 3 + r() * 6, a: 0.01 + r() * 0.025 };
  });
}

function frame(t) {
  requestAnimationFrame(frame);
  try { draw(t / 1000); } catch (err) { console.error(err); }
}

function draw(t) {
  if (W < 50 || H < 50) return;
  // небо
  const g = ctx.createLinearGradient(0, 0, 0, HY);
  g.addColorStop(0, "#03060d");
  g.addColorStop(0.65, "#0a1426");
  g.addColorStop(1, "#1a2c45");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, HY);
  // чумацький шлях
  for (const b of milky) {
    if (!onScreen(b.az)) continue;
    const x = X(b.az), y = Y(b.alt), r = b.rad * ky;
    const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(170,190,230,${b.a})`);
    rg.addColorStop(1, "rgba(170,190,230,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  const pos = new Map();
  for (const st of sky.stars) if (onScreen(st.az)) pos.set(st.id, [X(st.az), Y(st.alt), st]);

  // майстер бачить сузір'я тьмяним пунктиром
  const found = new Set(s.found);
  const knownOld = new Set(s.known.filter((id) => !found.has(id)));
  for (const c of sky.cons) {
    const ghost = gm && $("ghost").checked && !found.has(c.id);
    const recall = !gm && knownOld.has(c.id) && s.night.open;   // знайоме з минулих ночей — гравці впізнають одразу
    if (!ghost && !recall) continue;
    ctx.save();
    ctx.setLineDash(ghost ? [3, 5] : [2, 6]);
    ctx.strokeStyle = ghost ? "rgba(255,180,120,.35)" : "rgba(232,194,122,.28)";
    ctx.lineWidth = 1;
    for (const e of c.edges) segment(pos, e);
    ctx.restore();
  }

  // лінії партії
  const goldEdges = new Set(sky.cons.filter((c) => found.has(c.id)).flatMap((c) => c.edges));
  for (const k of s.lines) {
    const gold = goldEdges.has(k);
    ctx.save();
    ctx.strokeStyle = gold ? "rgba(255,214,140,.95)" : "rgba(200,215,240,.6)";
    ctx.lineWidth = gold ? 2 : 1.3;
    if (gold) { ctx.shadowColor = "rgba(255,190,110,.9)"; ctx.shadowBlur = 10; }
    segment(pos, k);
    ctx.restore();
  }

  // зорі
  for (const [, [x, y, st]] of pos) {
    const tw = 0.75 + 0.25 * Math.sin(t * (1.3 + (st.m % 1) * 2) + x * 0.05);
    const size = Math.max(0.6, 3.4 - st.m * 0.85);
    const a = Math.min(1, (1.25 - st.m * 0.22) * tw);
    if (size > 1.6) {
      const rg = ctx.createRadialGradient(x, y, 0, x, y, size * 4);
      rg.addColorStop(0, st.red ? `rgba(255,150,130,${a * 0.5})` : `rgba(210,225,255,${a * 0.45})`);
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = rg;
      ctx.fillRect(x - size * 4, y - size * 4, size * 8, size * 8);
    }
    ctx.fillStyle = st.red ? `rgba(255,190,175,${a})` : `rgba(240,244,255,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // підказки майстра: пульсують кільця на перших зорях сузір'я
  for (const [cid, n] of Object.entries(s.hints ?? {})) {
    const c = sky.cons.find((x) => x.id === cid);
    if (!c || found.has(cid)) continue;
    for (const id of c.ids.slice(0, n)) {
      const p = pos.get(id);
      if (!p) continue;
      ctx.strokeStyle = `rgba(255,200,120,${0.45 + 0.35 * Math.sin(t * 3)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], 9 + 2 * Math.sin(t * 3), 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // обрана зоря
  if (sel && pos.has(sel)) {
    const [x, y] = pos.get(sel);
    ctx.strokeStyle = "rgba(255,226,170,.95)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y, 8 + Math.sin(t * 5), 0, Math.PI * 2);
    ctx.stroke();
  }

  // назви знайдених і знайомих сузір'їв + куди ведуть
  for (const c of sky.cons) {
    const show = found.has(c.id) || (!gm && knownOld.has(c.id) && s.night.open) || (gm && $("ghost").checked);
    if (!show) continue;
    const pts = c.ids.map((id) => pos.get(id)).filter(Boolean);
    if (!pts.length) continue;
    const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const top = Math.min(...pts.map((p) => p[1]));
    const meta = constOf(c.id);
    ctx.textAlign = "center";
    ctx.font = "700 17px 'Cormorant Garamond', Georgia, serif";
    ctx.fillStyle = found.has(c.id) ? "rgba(255,222,160,.95)" : "rgba(232,194,122,.55)";
    ctx.fillText(meta.name, cx, top - 14);
    if (found.has(c.id)) {
      const v = s.night.vis.find((x) => x.id === c.id);
      const d = dirName(v?.az ?? meta.az);
      ctx.font = "12px Inter, system-ui, sans-serif";
      ctx.fillStyle = "rgba(255,200,130,.85)";
      ctx.fillText(`веде на ${d.full}${v?.lead ? ` · до №${v.lead}` : ""}`, cx, top - 32 + 0);
      // стовп світла до обрію — видно, куди тримати курс
      const x = X(v?.az ?? meta.az);
      const lg = ctx.createLinearGradient(0, top, 0, HY);
      lg.addColorStop(0, "rgba(255,200,120,0)");
      lg.addColorStop(1, "rgba(255,200,120,.35)");
      ctx.strokeStyle = lg;
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.moveTo(x, Math.max(...pts.map((p) => p[1])) + 12); ctx.lineTo(x, HY); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  // море й обрій
  const sea = ctx.createLinearGradient(0, HY, 0, H);
  sea.addColorStop(0, "#0c1a2a");
  sea.addColorStop(1, "#03070c");
  ctx.fillStyle = sea;
  ctx.fillRect(0, HY, W, H - HY);
  ctx.strokeStyle = "rgba(160,190,220,.25)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, HY + 0.5); ctx.lineTo(W, HY + 0.5); ctx.stroke();
  // відблиски на воді
  for (let i = 0; i < 40; i++) {
    const x = ((i * 97 + view * kx * 0.6) % (W + 60)) - 30;
    const y = HY + 8 + ((i * 37) % (H - HY - 16));
    ctx.fillStyle = `rgba(170,200,235,${0.04 + 0.04 * Math.sin(t * 1.5 + i)})`;
    ctx.fillRect(x, y, 14 + (i % 4) * 6, 1);
  }
  // компас на обрії
  ctx.textAlign = "center";
  for (let az = 0; az < 360; az += 15) {
    if (!onScreen(az)) continue;
    const x = X(az), main = az % 45 === 0;
    ctx.strokeStyle = main ? "rgba(232,194,122,.6)" : "rgba(232,194,122,.25)";
    ctx.beginPath(); ctx.moveTo(x, HY); ctx.lineTo(x, HY + (main ? 10 : 5)); ctx.stroke();
    if (main) {
      ctx.font = `${az % 90 === 0 ? "700 15px" : "600 12px"} Inter, system-ui, sans-serif`;
      ctx.fillStyle = az === 0 ? "#ffcf8a" : "rgba(232,194,122,.85)";
      ctx.fillText(dirName(az).name, x, HY + 26);
    }
  }
  $("facing").textContent = `Дивимося на ${dirName(view).full}`;
}

function segment(pos, key) {
  const [a, b] = key.split("|");
  const pa = pos.get(a) ?? project(a), pb = pos.get(b) ?? project(b);
  if (!pa || !pb) return;
  if (Math.abs(pa[0] - pb[0]) > W * 0.8) return;   // через «шов» неба
  ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
}
function project(id) {
  const st = sky.stars.find((x) => x.id === id);
  return st ? [X(st.az), Y(st.alt), st] : null;
}

// для перевірки в моку: де на екрані зоря
if (import.meta.env.MODE === "mock") window.__star = (id) => { const st = sky.stars.find((x) => x.id === id); if (st) view = st.az; return st ? [X(st.az), Y(st.alt)] : null; };

// ---------- миша ----------

function input() {
  let down = null;
  cv.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, v: view, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", (e) => {
    if (!down) { cv.style.cursor = hitStar(e.offsetX, e.offsetY) ? "pointer" : "grab"; return; }
    const dx = e.clientX - down.x;
    if (Math.abs(dx) > 4 || Math.abs(e.clientY - down.y) > 4) down.moved = true;
    if (down.moved) { view = (down.v - dx / kx + 720) % 360; cv.style.cursor = "grabbing"; }
  });
  cv.addEventListener("pointerup", (e) => {
    const d = down;
    down = null;
    if (!d || d.moved) return;
    click(e.offsetX, e.offsetY);
  });
}

function hitStar(x, y) {
  let best = null, bd = 13;
  for (const st of sky.stars) {
    if (!onScreen(st.az)) continue;
    const d = Math.hypot(X(st.az) - x, Y(st.alt) - y);
    if (d < bd) { bd = d; best = st; }
  }
  return best;
}
function hitLine(x, y) {
  for (const k of s.lines) {
    const [a, b] = k.split("|").map(project);
    if (!a || !b || Math.abs(a[0] - b[0]) > W * 0.8) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1], len = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len));
    if (Math.hypot(a[0] + u * dx - x, a[1] + u * dy - y) < 5) return k;
  }
  return null;
}

function click(x, y) {
  if (!s.night.open && !gm) return toast("Майстер ще не відкрив небо");
  const st = hitStar(x, y);
  if (st) {
    if (!sel) { sel = st.id; return; }
    if (sel === st.id) { sel = null; return; }
    const key = lineKey(sel, st.id);
    if (s.lines.includes(key)) line({ del: key }); else line({ add: key });
    sel = st.id;   // ланцюжок: наступна лінія — від цієї зорі
    return;
  }
  const k = hitLine(x, y);
  if (k) { line({ del: k }); return; }
  sel = null;
}

// ---------- панель ----------

function celebrate(id) {
  const c = constOf(id);
  const v = s.night.vis.find((x) => x.id === id);
  $("f-name").textContent = c.name;
  $("f-dir").textContent = `веде на ${dirName(v?.az ?? c.az).full}${v?.lead ? ` — до №${v.lead}` : ""}`;
  $("flash").hidden = false;
  $("flash").classList.remove("pop"); void $("flash").offsetWidth; $("flash").classList.add("pop");
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => ($("flash").hidden = true), 4200);
  view = v?.az ?? c.az;   // повернутися до нього
}

function card(id, opts = {}) {
  const c = constOf(id);
  const v = s.night.vis.find((x) => x.id === id);
  const lead = opts.tonight ? v?.lead : s.leads?.[id];
  const d = document.createElement("div");
  d.className = "ccard" + (opts.dim ? " dim" : "");
  d.innerHTML = `<div class="ch"><b></b><span></span></div><p></p>`;
  d.querySelector("b").textContent = c.name;
  d.querySelector("span").textContent = opts.tonight ? `${dirName(v?.az ?? c.az).full}${lead ? ` · №${lead}` : ""}` : lead ? `веде до №${lead}` : "";
  d.querySelector("p").textContent = c.myth;
  if (opts.tonight) d.onclick = () => { view = v?.az ?? c.az; };
  return d;
}

function drawTonight() {
  const box = $("tonight");
  box.innerHTML = "";
  const h = document.createElement("div");
  h.className = "ttl";
  const total = s.night.vis.length;
  h.innerHTML = `<b>Знайдено цієї ночі: ${s.found.length}${gm ? ` з ${total}` : ""}</b>`;
  box.appendChild(h);
  if (!s.found.length) {
    box.appendChild(Object.assign(document.createElement("p"), { className: "dim", textContent: gm ? "Гравці ще нічого не знайшли. Підказку можна дати кнопкою «+ зоря» біля сузір'я." : "Шукайте фігури серед зірок. Знайдене сузір'я покаже, куди тримати курс." }));
  }
  for (const id of s.found) box.appendChild(card(id, { tonight: true }));
  const recall = s.night.vis.map((v) => v.id).filter((id) => s.known.includes(id) && !s.found.includes(id));
  if (recall.length && !gm && s.night.open) {
    box.appendChild(Object.assign(document.createElement("div"), { className: "ttl small", textContent: "Знайомі з минулих ночей" }));
    for (const id of recall) box.appendChild(card(id, { tonight: true, dim: true }));
  }
}

function drawKnown() {
  const box = $("known");
  box.innerHTML = "";
  box.appendChild(Object.assign(document.createElement("div"), { className: "ttl", innerHTML: `<b>Відомо сузір'їв: ${s.known.length}${gm ? ` з ${CONST.length}` : ""}</b>` }));
  if (!s.known.length) box.appendChild(Object.assign(document.createElement("p"), { className: "dim", textContent: "Зоряний атлас порожній. Кожне знайдене сузір'я лишиться тут назавжди." }));
  for (const id of s.known) box.appendChild(card(id));
}

// --- майстер: які сузір'я на небі цієї ночі, куди ведуть ---

function drawGM() {
  $("open").textContent = s.night.open ? "Закрити небо" : "Відкрити небо гравцям";
  $("open").classList.toggle("live", s.night.open);
  $("here-note").textContent = here ? `Корабель зараз біля №${here}: сузір'я з точкою стає над напрямком на неї.` : "Корабель ще не на мапі Атласу — напрямок береться з налаштувань сузір'я.";
  const box = $("clist");
  box.innerHTML = "";
  for (const c of CONST) {
    const v = s.night.vis.find((x) => x.id === c.id);
    const row = document.createElement("div");
    row.className = "crow" + (v ? " on" : "") + (s.found.includes(c.id) ? " got" : "");
    row.innerHTML = `
      <label class="chk"><input type="checkbox" ${v ? "checked" : ""}><b></b>${s.found.includes(c.id) ? "<em>знайдено</em>" : s.known.includes(c.id) ? "<em class=k>відоме</em>" : ""}</label>
      <div class="cset" ${v ? "" : "hidden"}>
        <select class="lead" title="Куди веде"><option value="">не веде до точки</option>${POINTS.slice().sort((a, b) => a.n - b.n).map((p) => `<option value="${p.n}" ${v?.lead === p.n ? "selected" : ""}>до №${p.n}</option>`).join("")}</select>
        <select class="dir" title="Де на небі">${[["", "напрямок: авто"], ...DIRS.map((d) => [d.az, d.full])].map(([a, n]) => `<option value="${a}" ${v?.dir !== undefined && v?.dir !== null && String(v.dir) === String(a) ? "selected" : ""}>${n}</option>`).join("")}</select>
        <button type="button" class="ghost hint" title="Підсвітити гравцям ще одну зорю цього сузір'я">+ зоря${s.hints?.[c.id] ? ` (${s.hints[c.id]})` : ""}</button>
        <button type="button" class="ghost look" title="Повернутися до нього">👁</button>
      </div>`;
    row.querySelector("b").textContent = c.name;
    const [chk] = row.querySelectorAll("input");
    chk.onchange = () => {
      if (chk.checked) s.night.vis.push(place({ id: c.id, lead: null, dir: null }));
      else { s.night.vis = s.night.vis.filter((x) => x.id !== c.id); s.found = s.found.filter((x) => x !== c.id); }
      commit();
    };
    if (v) {
      row.querySelector(".lead").onchange = (e) => { v.lead = Number(e.target.value) || null; Object.assign(v, place(v)); commit(); };
      row.querySelector(".dir").onchange = (e) => { v.dir = e.target.value === "" ? null : Number(e.target.value); Object.assign(v, place(v)); commit(); };
      row.querySelector(".hint").onclick = () => { s.hints[c.id] = Math.min(c.stars.length, (s.hints[c.id] ?? 0) + 1); commit(); };
      row.querySelector(".look").onclick = () => { view = v.az; };
    }
    box.appendChild(row);
  }
}

// де стоїть сузір'я: вручну обраний напрямок → напрямок на точку від корабля → його звичне місце
function place(v) {
  const c = constOf(v.id);
  let az = c.az;
  if (v.dir !== null && v.dir !== undefined) az = v.dir;
  else if (v.lead && here) az = bearing(here, v.lead) ?? c.az;
  // не накладати на сусідів: трохи підняти, якщо поруч уже є сузір'я
  const busy = s.night.vis.filter((x) => x.id !== v.id && Math.abs(angDiff(x.az, az)) < 26);
  const alt = busy.length ? Math.min(MAX_ALT - 10, c.alt + 16 * busy.length) : c.alt;
  return { ...v, az: Math.round(az), alt };
}

let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
