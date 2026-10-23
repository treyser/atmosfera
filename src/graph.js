// Редактор блупрінтів на LiteGraph (той самий рушій, що в ComfyUI). Вузли будуються з тих самих описів,
// що й тригери: події, умови, дії + розгалуження, випадковість і вибір гравців. Граф зберігається сам.
import OBR from "@owlbear-rodeo/sdk";
import "./graph.css";
import { GRAPH, TRIG_RUN } from "./state.js";
import { EVENTS, CONDS, ACTIONS, vars, tlog, TLOG, VARS } from "./trig-data.js";
import { graphs, saveGraphs, blankGraph, GRAPHS } from "./graph-data.js";
import { loadPick, nameOf, listFor, flash } from "./scene-pick.js";

const LG = window.LiteGraph;
const $ = (id) => document.getElementById(id);
let room = "";
let list = [];
let cur = null;
let graph = null;
let canvas = null;
let players = [];
let lastJson = "";

const CHOICE = {
  name: "❔ Вибір гравців",
  f: [
    { k: "text", l: "Питання", t: "text" },
    { k: "a", l: "Кнопка 1", t: "text" }, { k: "b", l: "Кнопка 2", t: "text" },
    { k: "c", l: "Кнопка 3", t: "text" }, { k: "d", l: "Кнопка 4", t: "text" },
    { k: "to", l: "Кому", t: "sel", o: { who: "тому, хто спрацював", all: "усім (хто перший)", pick: "вибраному гравцю" } },
    { k: "player", l: "Гравець", t: "player", show: (p) => p.to === "pick" },
    { k: "time", l: "Секунд на відповідь", t: "num", d: 90 },
  ],
};
const RANDOM = { name: "🎲 Випадково", f: [{ k: "n", l: "Скільки виходів (2–4)", t: "num", d: 2 }] };
const COLORS = { ev: ["#1d4a45", "#2b6b63"], if: ["#5a4415", "#7d5f1f"], flow: ["#3b2a5a", "#563f80"], act: ["#3a3324", "#51472f"] };

OBR.onReady(async () => {
  room = OBR.room.id;
  players = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role !== "GM");
  await loadPick();
  OBR.scene.items.onChange(async () => { await loadPick(); for (const n of graph?._nodes ?? []) n.onConfigure?.(); canvas?.setDirty(true, true); });
  register();
  list = graphs(room);
  if (!list.length) { list = [blankGraph()]; saveGraphs(room, list); }
  graph = new LG.LGraph();
  canvas = new LG.LGraphCanvas($("cv"), graph);
  canvas.background_image = null;
  canvas.render_canvas_border = false;
  canvas.show_info = false;
  window.atmGraph = { graph, canvas };   // для налагодження з консолі
  canvas.clear_background_color = "#0f1418";
  fit();
  window.addEventListener("resize", fit);
  palette();
  $("close").onclick = () => OBR.modal.close(GRAPH);
  $("new").onclick = () => { const g = blankGraph(); g.name = `Граф ${list.length + 1}`; list.push(g); persist(); open(g.id); };
  $("pick").onchange = () => open($("pick").value);
  $("name").oninput = () => { cur.name = $("name").value; persist(); drawPick(); };
  $("on").onchange = () => { cur.on = $("on").checked; if (cur.on) cur._reset = true; persist(); };
  $("del").onclick = () => { if (list.length < 2) return toast("Це останній граф"); list = list.filter((g) => g.id !== cur.id); persist(); open(list[0].id); };
  $("run").onclick = async () => { await OBR.broadcast.sendMessage(TRIG_RUN, { graph: cur.id }, { destination: "LOCAL" }); toast("Запущено вузли «Я натискаю кнопку»"); };
  window.addEventListener("storage", (e) => { if (e.key === TLOG(room)) drawLog(); if (e.key === VARS(room)) drawVars(); });
  setInterval(autosave, 700);
  open(list[0].id);
  drawLog(); drawVars();
});

function fit() {
  const w = $("cwrap");
  canvas.resize(w.clientWidth, w.clientHeight);
}


// ---------- типи вузлів з описів ----------
function register() {
  const make = (type, spec, kind, ins, outs) => {
    function Node() {
      this.properties = { ...Object.fromEntries(spec.f.map((f) => [f.k, f.d ?? (f.t === "sel" ? Object.keys(f.o)[0] : f.t === "tokens" ? [] : "")])) };
      if (kind === "ev") Object.assign(this.properties, { cd: 0, once: false });
      for (const i of ins) this.addInput(i, "exec");
      for (const o of typeof outs === "function" ? outs(this.properties) : outs) this.addOutput(o, "exec");
      this.color = COLORS[kind][0]; this.bgcolor = COLORS[kind][1];
      widgets(this, spec, kind);
    }
    Node.title = spec.name;
    Node.prototype.onConfigure = function () { if (typeof outs === "function") reshape(this, outs(this.properties)); widgets(this, spec, kind); };
    LG.registerNodeType(type, Node);
  };
  for (const [k, s] of Object.entries(EVENTS)) make(`ev/${k}`, s, "ev", [], ["▶"]);
  for (const [k, s] of Object.entries(CONDS)) make(`if/${k}`, s, "if", ["▶"], ["так", "ні"]);
  for (const [k, s] of Object.entries(ACTIONS)) make(`act/${k}`, s, "act", ["▶"], ["▶"]);
  make("flow/random", RANDOM, "flow", ["▶"], (p) => Array.from({ length: Math.max(2, Math.min(4, Number(p.n) || 2)) }, (_, i) => `${i + 1}`));
  make("flow/choice", CHOICE, "flow", ["▶"], (p) => [...[p.a, p.b, p.c, p.d].map((x) => String(x ?? "").trim()).filter(Boolean).map((x) => (x.length > 24 ? x.slice(0, 23).trimEnd() + "…" : x)), "⏳ час вийшов"]);
}
function reshape(node, names2) {
  while (node.outputs.length > names2.length) node.removeOutput(node.outputs.length - 1);
  names2.forEach((n, i) => { if (node.outputs[i]) node.outputs[i].name = n; else node.addOutput(n, "exec"); });
  node.setDirtyCanvas(true, true);
}

const nameOrDash = (id) => (id ? nameOf(id) : "—");
// віджети вузла: лише ті поля, що зараз мають сенс (show), значення — з properties
function widgets(node, spec, kind) {
  node.widgets = [];
  const p = node.properties;
  for (const f of spec.f) {
    if (f.show && !f.show(p)) continue;
    const set = (v) => {
      p[f.k] = v;
      // від цього поля залежать інші (show) або виходи вузла — перебудувати
      if (spec.f.some((x) => x.show) || node.type === "flow/random" || node.type === "flow/choice") setTimeout(() => node.onConfigure(), 0);
      else fitNode(node);
    };
    let w;
    if (f.t === "sel") {
      w = node.addWidget("combo", f.l || "режим", f.o[p[f.k]] ?? Object.values(f.o)[0], (v) => set(Object.keys(f.o).find((k) => f.o[k] === v)), { values: Object.values(f.o) });
    } else if (f.t === "player") {
      w = node.addWidget("combo", f.l, players.find((x) => x.id === p[f.k])?.name ?? "—", (v) => set(players.find((x) => x.name === v)?.id ?? ""), { values: ["—", ...players.map((x) => x.name)] });
    } else if (f.t === "num") {
      w = node.addWidget("number", f.l, p[f.k] ?? 0, (v) => set(v), { precision: 0, step: 10 });
    } else if (f.t === "zone" || f.t === "token") {
      // список зі сцени (вікно на весь екран — виділяти на мапі незручно)
      w = node.addWidget("combo", f.l, nameOrDash(p[f.k]), (v) => {
        const o = listFor(f.t).find((x) => x.label === v);
        set(o?.id ?? "");
        if (o) flash([o.id]);
      }, { values: () => ["—", ...listFor(f.t).map((o) => o.label)] });
    } else if (f.t === "tokens") {
      const add = node.addWidget("combo", `＋ ${f.l}`, "додати…", (v) => {
        const o = listFor("token").find((x) => x.label === v);
        if (o && !(p[f.k] ?? []).includes(o.id)) set([...(p[f.k] ?? []), o.id]);
        add.value = "додати…";
        node.onConfigure();
      }, { values: () => listFor("token").map((o) => o.label) });
      add.draw = drawWidget;
      const ids = p[f.k] ?? [];
      w = node.addWidget("button", ids.length ? `✕  ${ids.map(nameOf).join(", ")}` : `${f.l}: нікого`, null, () => { if (ids.length) { set([]); node.onConfigure(); } });
    } else {
      w = node.addWidget("text", f.l, p[f.k] ?? "", (v) => set(v));
    }
    w.draw = drawWidget;
  }
  if (kind === "ev") {
    node.addWidget("number", "пауза, с", p.cd ?? 0, (v) => (p.cd = v), { precision: 0, step: 10 }).draw = drawWidget;
    node.addWidget("toggle", "лише раз", Boolean(p.once), (v) => (p.once = v)).draw = drawWidget;
  }
  fitNode(node);
}

// ширина вузла — під найдовший рядок, але в межах 260…460 px; решту тексту обрізає «…»
const meas = document.createElement("canvas").getContext("2d");
const FONT = "12px Inter, Arial, sans-serif";
meas.font = FONT;
const tw = (s) => meas.measureText(String(s)).width;
function fitNode(node) {
  let need = tw(node.title) + 70;
  for (const w of node.widgets ?? []) {
    const v = valueText(w);
    need = Math.max(need, (w.type === "button" ? tw(w.name) + 40 : tw(w.label || w.name) + tw(v) + 90));
  }
  for (const o of node.outputs ?? []) need = Math.max(need, tw(o.name) + 80);
  const h = node.computeSize()[1];
  node.size = [Math.round(Math.min(460, Math.max(260, need))), h];
  node.setDirtyCanvas?.(true, true);
}
const valueText = (w) => (w.type === "number" ? String(Math.round(Number(w.value) || 0)) : w.type === "toggle" ? (w.value ? "так" : "ні") : String(w.value ?? ""));
function clip(ctx, s, max) {
  s = String(s);
  if (max <= 8) return "";
  if (ctx.measureText(s).width <= max) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ctx.measureText(s.slice(0, mid) + "…").width <= max) lo = mid; else hi = mid - 1; }
  return s.slice(0, lo).trimEnd() + "…";
}
// власне малювання віджета: підпис ліворуч, значення праворуч — без накладання, довге обрізається
function drawWidget(ctx, node, width, y, H) {
  const w = this;
  const x = 15, ww = width - 30;
  ctx.save();
  ctx.font = FONT;
  ctx.textBaseline = "middle";
  ctx.fillStyle = LG.WIDGET_BGCOLOR; ctx.strokeStyle = LG.WIDGET_OUTLINE_COLOR;
  ctx.beginPath(); (ctx.roundRect ? ctx.roundRect(x, y, ww, H, H / 2) : ctx.rect(x, y, ww, H)); ctx.fill(); ctx.stroke();
  const cy = y + H / 2;
  if (w.type === "button") {
    ctx.fillStyle = LG.WIDGET_TEXT_COLOR; ctx.textAlign = "center";
    ctx.fillText(clip(ctx, w.name, ww - 20), x + ww / 2, cy);
    ctx.restore(); return;
  }
  const arrows = w.type === "combo" || w.type === "number";
  if (arrows) {
    ctx.fillStyle = LG.WIDGET_TEXT_COLOR;
    ctx.beginPath(); ctx.moveTo(x + 16, cy - 5); ctx.lineTo(x + 6, cy); ctx.lineTo(x + 16, cy + 5); ctx.fill();
    ctx.beginPath(); ctx.moveTo(x + ww - 16, cy - 5); ctx.lineTo(x + ww - 6, cy); ctx.lineTo(x + ww - 16, cy + 5); ctx.fill();
  }
  const pad = arrows ? 22 : 12;
  const inner = ww - pad * 2;
  let val = valueText(w);
  if (w.type === "toggle") {
    ctx.fillStyle = w.value ? "#7fd1c7" : "#555";
    ctx.beginPath(); ctx.arc(x + ww - 14, cy, H * 0.3, 0, Math.PI * 2); ctx.fill();
  }
  const right = w.type === "toggle" ? 18 : 0;
  const label = w.label || w.name;
  const lw = Math.min(tw(label), val ? inner * 0.5 : inner);
  ctx.textAlign = "left"; ctx.fillStyle = LG.WIDGET_SECONDARY_TEXT_COLOR;
  ctx.fillText(clip(ctx, label, lw), x + pad, cy);
  ctx.textAlign = "right"; ctx.fillStyle = LG.WIDGET_TEXT_COLOR;
  ctx.fillText(clip(ctx, val, inner - lw - 12 - right), x + ww - pad - right, cy);
  ctx.restore();
}

// ---------- палітра ----------
function palette() {
  const box = $("pal");
  const group = (title, entries) => {
    const h = document.createElement("h4"); h.textContent = title; box.appendChild(h);
    for (const [type, label] of entries) {
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.className = type.split("/")[0];
      b.onclick = () => add(type);
      box.appendChild(b);
    }
  };
  group("Коли", Object.entries(EVENTS).map(([k, s]) => [`ev/${k}`, s.name]));
  group("Якщо", Object.entries(CONDS).map(([k, s]) => [`if/${k}`, s.name]));
  group("Потік", [["flow/random", RANDOM.name], ["flow/choice", CHOICE.name]]);
  group("То", Object.entries(ACTIONS).map(([k, s]) => [`act/${k}`, s.name]));
}
function add(type) {
  const n = LG.createNode(type);
  const ds = canvas.ds;
  const cx = ($("cwrap").clientWidth / 2) / ds.scale - ds.offset[0];
  const cy = ($("cwrap").clientHeight / 2) / ds.scale - ds.offset[1];
  n.pos = [cx - 120 + Math.random() * 60, cy - 60 + Math.random() * 60];
  graph.add(n);
  canvas.selectNode(n);
  help();
}

// ---------- графи ----------
function open(id) {
  cur = list.find((g) => g.id === id) ?? list[0];
  graph.clear();
  if (cur.data) graph.configure(cur.data);
  lastJson = JSON.stringify(graph.serialize());
  $("name").value = cur.name;
  $("on").checked = cur.on;
  drawPick();
  help();
  canvas.setDirty(true, true);
}
function drawPick() {
  $("pick").replaceChildren(...list.map((g) => new Option(g.name, g.id)));
  $("pick").value = cur.id;
}
function autosave() {
  if (!cur) return;
  const json = JSON.stringify(graph.serialize());
  if (json === lastJson) return;
  lastJson = json;
  cur.data = JSON.parse(json);
  persist();
  help();
}
function persist() {
  const fresh = graphs(room);
  // «лише раз» вимикає вузол у фоні — беремо цю позначку зі сховища; увімкнення графа її скидає
  for (const g of list) { const f = fresh.find((x) => x.id === g.id); g.off = g._reset ? {} : f?.off ?? g.off ?? {}; delete g._reset; }
  saveGraphs(room, list);
}
function help() {
  const empty = !graph._nodes?.length;
  $("help").hidden = !empty;
  $("help").innerHTML = empty ? `<b>Порожній граф</b><br>Додай вузол «Коли…» з палітри ліворуч (або ПКМ на полотні → Add Node).<br>Тягни від <b>▶</b> одного вузла до <b>▶</b> іншого. Умови мають виходи «так» і «ні».<br>Зону чи токен вибирай кнопкою ◎: спершу виділи їх на мапі.` : "";
}

function drawVars() {
  const v = vars(room);
  $("vars").innerHTML = Object.keys(v).length ? Object.entries(v).map(([k, n]) => `<div><span>${esc(k)}</span><b>${n}</b></div>`).join("") : `<div class="dim">Змінні з'являться, щойно граф їх змінить (або додай у «Тригерах»).</div>`;
}
function drawLog() {
  const l = tlog(room);
  $("log").innerHTML = l.length ? l.slice(0, 18).map((x) => `<div><i>${new Date(x.at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</i> ${esc(x.t)}</div>`).join("") : `<div class="dim">Поки нічого.</div>`;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
let toastTimer = null;
function toast(text) { const t = $("toast"); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2400); }
export { GRAPHS };
