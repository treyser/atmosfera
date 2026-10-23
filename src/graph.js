// Редактор блупрінтів на LiteGraph (той самий рушій, що в ComfyUI). Вузли будуються з тих самих описів,
// що й тригери: події, умови, дії + розгалуження, випадковість і вибір гравців. Граф зберігається сам.
import OBR from "@owlbear-rodeo/sdk";
import "./graph.css";
import { GRAPH, TRIG_RUN } from "./state.js";
import { EVENTS, CONDS, ACTIONS, vars, tlog, TLOG, VARS } from "./trig-data.js";
import { graphs, saveGraphs, blankGraph, GRAPHS } from "./graph-data.js";

const LG = window.LiteGraph;
const $ = (id) => document.getElementById(id);
let room = "";
let list = [];
let cur = null;
let graph = null;
let canvas = null;
let players = [];
const names = new Map();
let lastJson = "";

const CHOICE = {
  name: "❔ Вибір гравців",
  f: [
    { k: "text", l: "Питання", t: "text" },
    { k: "a", l: "Кнопка 1", t: "text" }, { k: "b", l: "Кнопка 2", t: "text" },
    { k: "c", l: "Кнопка 3", t: "text" }, { k: "d", l: "Кнопка 4", t: "text" },
    { k: "to", l: "Кому", t: "sel", o: { who: "тому, хто спрацював", all: "усім (хто перший)", pick: "вибраному гравцю" } },
    { k: "player", l: "Гравець", t: "player" },
    { k: "time", l: "Секунд на відповідь", t: "num", d: 90 },
  ],
};
const RANDOM = { name: "🎲 Випадково", f: [{ k: "n", l: "Скільки виходів (2–4)", t: "num", d: 2 }] };
const COLORS = { ev: ["#1d4a45", "#2b6b63"], if: ["#5a4415", "#7d5f1f"], flow: ["#3b2a5a", "#563f80"], act: ["#3a3324", "#51472f"] };

OBR.onReady(async () => {
  room = OBR.room.id;
  players = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role !== "GM");
  await loadNames();
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

async function loadNames() {
  if (!(await OBR.scene.isReady())) return;
  for (const it of await OBR.scene.items.getItems()) names.set(it.id, it.text?.plainText || it.name || it.type);
}

// ---------- типи вузлів з описів ----------
function register() {
  const make = (type, spec, kind, ins, outs) => {
    function Node() {
      this.properties = { ...Object.fromEntries(spec.f.map((f) => [f.k, f.d ?? (f.t === "sel" ? Object.keys(f.o)[0] : f.t === "tokens" ? [] : "")])) };
      if (kind === "ev") Object.assign(this.properties, { cd: 0, once: false });
      for (const i of ins) this.addInput(i, "exec");
      for (const o of typeof outs === "function" ? outs(this.properties) : outs) this.addOutput(o, "exec");
      widgets(this, spec, kind);
      this.color = COLORS[kind][0]; this.bgcolor = COLORS[kind][1];
      this.size = this.computeSize(); this.size[0] = Math.max(this.size[0], 250);
    }
    Node.title = spec.name;
    Node.prototype.onConfigure = function () { syncWidgets(this, spec); if (typeof outs === "function") reshape(this, outs(this.properties)); };
    LG.registerNodeType(type, Node);
  };
  for (const [k, s] of Object.entries(EVENTS)) make(`ev/${k}`, s, "ev", [], ["▶"]);
  for (const [k, s] of Object.entries(CONDS)) make(`if/${k}`, s, "if", ["▶"], ["так", "ні"]);
  for (const [k, s] of Object.entries(ACTIONS)) make(`act/${k}`, s, "act", ["▶"], ["▶"]);
  make("flow/random", RANDOM, "flow", ["▶"], (p) => Array.from({ length: Math.max(2, Math.min(4, Number(p.n) || 2)) }, (_, i) => `${i + 1}`));
  make("flow/choice", CHOICE, "flow", ["▶"], (p) => [...[p.a, p.b, p.c, p.d].map((x) => String(x ?? "").trim()).filter(Boolean).map((x) => x.slice(0, 18)), "⏳ час вийшов"]);
}
function reshape(node, names2) {
  while (node.outputs.length > names2.length) node.removeOutput(node.outputs.length - 1);
  names2.forEach((n, i) => { if (node.outputs[i]) node.outputs[i].name = n; else node.addOutput(n, "exec"); });
  node.setDirtyCanvas(true, true);
}

const pickLabel = (ids) => (ids.length ? ids.map((id) => names.get(id) ?? "(прибрано)").join(", ").slice(0, 28) : "нічого");
function widgets(node, spec, kind) {
  for (const f of spec.f) {
    const set = (v) => {
      node.properties[f.k] = v;
      if (node.type === "flow/random" || node.type === "flow/choice") node.onConfigure();
    };
    if (f.t === "sel") {
      const labels = Object.values(f.o);
      node.addWidget("combo", f.l || f.k, f.o[node.properties[f.k]] ?? labels[0], (v) => set(Object.keys(f.o).find((k) => f.o[k] === v)), { values: labels });
    } else if (f.t === "player") {
      node.addWidget("combo", f.l, "—", (v) => set(players.find((p) => p.name === v)?.id ?? ""), { values: ["—", ...players.map((p) => p.name)] });
    } else if (f.t === "num") {
      node.addWidget("number", f.l, node.properties[f.k] ?? 0, (v) => set(v), { precision: 0, step: 10 });
    } else if (f.t === "zone" || f.t === "token" || f.t === "tokens") {
      const w = node.addWidget("button", `◎ ${f.l}: ${pickLabel([])}`, null, async () => {
        const s = (await OBR.player.getSelection()) ?? [];
        if (!s.length) return toast("Спершу виділи на мапі");
        await loadNames();
        set(f.t === "tokens" ? s : s[0]);
        w.name = `◎ ${f.l}: ${pickLabel(f.t === "tokens" ? s : [s[0]])}`;
        node.setDirtyCanvas(true, true);
      });
      w._pick = f;
    } else {
      node.addWidget("text", f.l, node.properties[f.k] ?? "", (v) => set(v));
    }
  }
  if (kind === "ev") {
    node.addWidget("number", "пауза, с", node.properties.cd ?? 0, (v) => (node.properties.cd = v), { precision: 0, step: 10 });
    node.addWidget("toggle", "лише раз", Boolean(node.properties.once), (v) => (node.properties.once = v));
  }
}
// після завантаження: показати збережені значення у віджетах
function syncWidgets(node, spec) {
  for (const w of node.widgets ?? []) {
    const f = spec.f.find((x) => x.l === w.name || (w._pick && w._pick === x)) ?? null;
    if (w._pick) { const v = node.properties[w._pick.k]; w.name = `◎ ${w._pick.l}: ${pickLabel(Array.isArray(v) ? v : v ? [v] : [])}`; continue; }
    if (w.name === "пауза, с") { w.value = node.properties.cd ?? 0; continue; }
    if (w.name === "лише раз") { w.value = Boolean(node.properties.once); continue; }
    if (!f) continue;
    const v = node.properties[f.k];
    w.value = f.t === "sel" ? f.o[v] ?? w.value : f.t === "player" ? players.find((p) => p.id === v)?.name ?? "—" : v ?? w.value;
  }
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
