// Редактор тригерів (лише майстер). Усе зберігається одразу в браузері майстра — виконавець у фоні бачить зміни.
import OBR from "@owlbear-rodeo/sdk";
import "./trig.css";
import { TRIGGERS, TRIG_RUN } from "./state.js";
import { loadPick, nameOf, listFor, flash } from "./scene-pick.js";
import { triggers, saveTriggers, vars, saveVars, tlog, TLOG, VARS, EVENTS, CONDS, ACTIONS, blankTrigger, blankOf, summary } from "./trig-data.js";

const $ = (id) => document.getElementById(id);
let room = "";
let list = [];
let sel = null;
let players = [];

OBR.onReady(async () => {
  room = OBR.room.id;
  list = triggers(room);
  sel = list[0]?.id ?? null;
  $("close").onclick = () => OBR.modal.close(TRIGGERS);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) OBR.modal.close(TRIGGERS); });
  for (const [k, v] of Object.entries(EVENTS)) $("ev-type").appendChild(new Option(v.name, k));
  adder("cond-add", "＋ умова…", CONDS, (k) => cur().if.push({ t: k, ...blankOf(CONDS[k]) }));
  adder("act-add", "＋ дія…", ACTIONS, (k) => cur().do.push({ t: k, ...blankOf(ACTIONS[k]) }));
  $("ev-type").onchange = () => { cur().ev = { t: $("ev-type").value, ...blankOf(EVENTS[$("ev-type").value]) }; save(); drawForm(); };
  $("t-name").oninput = () => { cur().name = $("t-name").value; save(); drawList(); };
  $("t-on").onchange = () => { cur().on = $("t-on").checked; save(); drawList(); };
  $("t-once").onchange = () => { cur().once = $("t-once").checked; save(); };
  $("t-cd").onchange = () => { cur().cd = Math.max(0, Number($("t-cd").value) || 0); save(); };
  $("add").onclick = () => { const t = blankTrigger(); list.unshift(t); sel = t.id; save(); draw(); setTimeout(() => $("t-name").select(), 30); };
  $("dup").onclick = () => { const t = { ...structuredClone(cur()), id: "t" + Date.now().toString(36), name: cur().name + " (копія)", fired: 0 }; list.unshift(t); sel = t.id; save(); draw(); };
  $("del").onclick = () => { list = list.filter((t) => t.id !== sel); sel = list[0]?.id ?? null; save(); draw(); };
  $("run").onclick = async () => { await OBR.broadcast.sendMessage(TRIG_RUN, { id: sel }, { destination: "LOCAL" }); toast("Запущено"); };
  $("var-add").onclick = () => { const v = vars(room); let n = "Змінна"; let i = 1; while (n in v) n = `Змінна ${++i}`; v[n] = 0; saveVars(room, v); drawVars(); };
  window.addEventListener("storage", (e) => {
    if (e.key === TLOG(room)) drawLog();
    if (e.key === VARS(room)) drawVars();
    if (e.key === `atmosfera.triggers.${room}`) { list = triggers(room); drawList(); $("fired").textContent = firedText(); }
  });
  players = (await OBR.party.getPlayers().catch(() => [])).filter((p) => p.role !== "GM");
  OBR.party.onChange((ps) => { players = ps.filter((p) => p.role !== "GM"); });
  await loadPick();
  OBR.scene.items.onChange(async () => { await loadPick(); if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) drawForm(); });
  draw();
});

const cur = () => list.find((t) => t.id === sel);
let saveT = null;
function save() { clearTimeout(saveT); saveT = setTimeout(() => saveTriggers(room, list), 120); }
const firedText = () => { const t = triggers(room).find((x) => x.id === sel); return t?.fired ? `спрацював ${t.fired}×` : "ще не спрацьовував"; };


function adder(id, ph, specs, push) {
  const s = $(id);
  s.appendChild(new Option(ph, ""));
  for (const [k, v] of Object.entries(specs)) s.appendChild(new Option(v.name, k));
  s.onchange = () => { if (!s.value) return; push(s.value); s.value = ""; save(); drawForm(); drawList(); };
}

function draw() { drawList(); drawForm(); drawVars(); drawLog(); }

function drawList() {
  const box = $("list");
  box.innerHTML = "";
  for (const t of list) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `trig${t.id === sel ? " sel" : ""}${t.on ? "" : " off"}`;
    b.innerHTML = `<b>${esc(t.name)}</b><span>${esc(summary(t))}</span>`;
    b.onclick = () => { sel = t.id; draw(); };
    box.appendChild(b);
  }
}

function drawForm() {
  const t = cur();
  $("empty").hidden = Boolean(t);
  $("form").hidden = !t;
  if (!t) return;
  if (document.activeElement !== $("t-name")) $("t-name").value = t.name;
  $("t-on").checked = t.on; $("t-once").checked = t.once; $("t-cd").value = t.cd ?? 0;
  $("ev-type").value = t.ev.t;
  $("ev-fields").replaceChildren(...fields(EVENTS[t.ev.t], t.ev));
  $("conds").replaceChildren(...t.if.map((c, i) => step(CONDS[c.t], c, () => { t.if.splice(i, 1); save(); drawForm(); drawList(); }, null)));
  $("acts").replaceChildren(...t.do.map((a, i) => step(ACTIONS[a.t], a, () => { t.do.splice(i, 1); save(); drawForm(); drawList(); },
    (d) => { const j = i + d; if (j < 0 || j >= t.do.length) return; [t.do[i], t.do[j]] = [t.do[j], t.do[i]]; save(); drawForm(); })));
  $("fired").textContent = firedText();
}

function step(spec, obj, del, move) {
  const row = document.createElement("div");
  row.className = "step";
  const head = document.createElement("div");
  head.className = "shead";
  head.innerHTML = `<b>${esc(spec?.name ?? obj.t)}</b>`;
  if (move) for (const [d, s] of [[-1, "↑"], [1, "↓"]]) { const b = document.createElement("button"); b.type = "button"; b.className = "mini"; b.textContent = s; b.onclick = () => move(d); head.appendChild(b); }
  const x = document.createElement("button"); x.type = "button"; x.className = "mini x"; x.textContent = "✕"; x.onclick = del; head.appendChild(x);
  row.appendChild(head);
  const f = document.createElement("div");
  f.className = "fields";
  f.replaceChildren(...fields(spec, obj));
  row.appendChild(f);
  return row;
}

// поля одного кроку за його описом
function fields(spec, obj) {
  const out = [];
  for (const fd of spec?.f ?? []) {
    if (fd.show && !fd.show(obj)) continue;
    const l = document.createElement("label");
    l.className = `fld t-${fd.t}`;
    if (fd.l) l.innerHTML = `<span>${esc(fd.l)}</span>`;
    let el;
    const redraw = () => { save(); drawForm(); drawList(); };
    if (fd.t === "sel") {
      el = document.createElement("select");
      for (const [k, v] of Object.entries(fd.o)) el.appendChild(new Option(v, k));
      el.value = obj[fd.k] ?? "";
      el.onchange = () => { obj[fd.k] = el.value; redraw(); };
    } else if (fd.t === "player") {
      el = document.createElement("select");
      el.appendChild(new Option(players.length ? "— вибери —" : "— гравців немає в кімнаті —", ""));
      for (const p of players) el.appendChild(new Option(p.name, p.id));
      if (obj[fd.k] && !players.some((p) => p.id === obj[fd.k])) el.appendChild(new Option("(гравець не в кімнаті)", obj[fd.k]));
      el.value = obj[fd.k] ?? "";
      el.onchange = () => { obj[fd.k] = el.value; save(); };
    } else if (fd.t === "zone" || fd.t === "token" || fd.t === "tokens") {
      // список зі сцени + «з виділеного»
      el = document.createElement("div");
      el.className = "pick";
      const many = fd.t === "tokens";
      const ids = many ? obj[fd.k] ?? [] : obj[fd.k] ? [obj[fd.k]] : [];
      const sel = document.createElement("select");
      const opts = listFor(fd.t);
      sel.appendChild(new Option(many ? "＋ додати…" : opts.length ? "— вибери —" : fd.t === "zone" ? "— на сцені немає фігур —" : "— на сцені немає токенів —", ""));
      for (const o of opts) if (!many || !ids.includes(o.id)) sel.appendChild(new Option(o.label, o.id));
      if (!many && ids[0] && !opts.some((o) => o.id === ids[0])) sel.appendChild(new Option("(прибрано зі сцени)", ids[0]));
      if (!many) sel.value = ids[0] ?? "";
      sel.onchange = () => {
        if (!sel.value) return;
        obj[fd.k] = many ? [...ids, sel.value] : sel.value;
        flash([sel.value]);
        redraw();
      };
      el.appendChild(sel);
      if (many) for (const id of ids) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = nameOf(id);
        const x = document.createElement("button"); x.type = "button"; x.textContent = "✕";
        x.onclick = () => { obj[fd.k] = ids.filter((i) => i !== id); redraw(); };
        chip.appendChild(x);
        el.appendChild(chip);
      }
      const b = document.createElement("button");
      b.type = "button"; b.className = "ghost sm"; b.title = "Взяти те, що зараз виділено на мапі"; b.textContent = "◎";
      b.onclick = async () => {
        const s = (await OBR.player.getSelection()) ?? [];
        if (!s.length) return toast(fd.t === "zone" ? "Нічого не виділено — вибери фігуру зі списку" : "Нічого не виділено — вибери токен зі списку");
        await loadPick();
        obj[fd.k] = many ? [...new Set([...ids, ...s])] : s[0];
        redraw();
      };
      el.appendChild(b);
    } else {
      el = document.createElement(fd.t === "area" ? "textarea" : "input");
      if (fd.t === "area") el.rows = 3;
      if (fd.t === "num") { el.type = "number"; el.className = "num"; }
      el.value = obj[fd.k] ?? "";
      el.oninput = () => { obj[fd.k] = fd.t === "num" ? Number(el.value) || 0 : el.value; save(); };
      el.onchange = () => drawList();
    }
    l.appendChild(el);
    out.push(l);
  }
  return out;
}

function drawVars() {
  const v = vars(room);
  const box = $("vars");
  box.innerHTML = "";
  for (const [k, n] of Object.entries(v)) {
    const row = document.createElement("div");
    row.className = "var";
    const name = document.createElement("input"); name.value = k;
    const num = document.createElement("input"); num.type = "number"; num.value = n; num.className = "num";
    const x = document.createElement("button"); x.type = "button"; x.className = "mini x"; x.textContent = "✕";
    name.onchange = () => { const all = vars(room); const val = all[k]; delete all[k]; all[name.value.trim() || k] = val; saveVars(room, all); drawVars(); };
    num.onchange = () => { const all = vars(room); all[k] = Number(num.value) || 0; saveVars(room, all); };
    x.onclick = () => { const all = vars(room); delete all[k]; saveVars(room, all); drawVars(); };
    row.append(name, num, x);
    box.appendChild(row);
  }
  if (!box.children.length) box.innerHTML = `<div class="dim">Лічильники для умов: «Тривога Ордену», «Довіра Ольвена»…</div>`;
}

function drawLog() {
  const l = tlog(room);
  $("log").innerHTML = l.length ? l.slice(0, 15).map((x) => `<div><i>${new Date(x.at).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}</i> ${esc(x.t)}</div>`).join("") : `<div class="dim">Поки нічого.</div>`;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
let toastTimer = null;
function toast(text) { const t = $("toast"); t.textContent = text; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2400); }
