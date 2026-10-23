// Виконавець тригерів і графів — лише у фоні майстра. Стежить за подіями (зони, наближення, таймери, бій,
// кнопка) і виконує дії. Тригер зі списку — це «подія → умови → дії»; граф — те саме, але з розгалуженнями,
// випадковістю, вибором гравців і будь-якою кількістю кроків. Обидва йдуть через ті самі події й дії.
import OBR from "@owlbear-rodeo/sdk";
import { TITLE, HUSH, NOTE, NPC, AI, AI_ON, AI_SAY, TRIG_RUN, TRACE, CHOICE, CHOICE_ANS, FATE, TRAP, TRAP_DMG, ZONE, PRESETS, setState } from "./state.js";
import { FX } from "./zone-fx.js";
import { fromPreset } from "./director.js";
import { appendLog, uid, local, saveLocal, NOTES } from "./log.js";
import { triggers, saveTriggers, vars, saveVars, addLog, fill } from "./trig-data.js";
import { graphs, saveGraphs, nodeEvents, nextNodes } from "./graph-data.js";

const BATTLE = "com.nikita.battle/state";
const BOPTS = "com.nikita.battle/opts";
const LINK = "com.nikita.battle/link";
const SHEETS = "com.nikita.character-sheet/sheets";
const MUSIC = "com.nikita.atmosphere/music";
let room = "";
let gm = false;
let dpi = 150;
let lastPos = new Map();            // токен → де був
let inside = new Map();             // `${слухач}|${токен}` → чи був усередині
let primed = false;
let battle = { active: false, round: 0 };
const lastRun = new Map();          // слухач → коли спрацював
const waiting = new Map();          // id вибору → resolve

// усі «слухачі» подій: тригери зі списку + вузли-події з увімкнених графів
const temps = [];                  // тимчасові «слухачі» вузлів «Чекати, доки…»
function listeners() {
  const out = [...temps, ...triggers(room).filter((t) => t.on)];
  for (const g of graphs(room)) if (g.on) out.push(...nodeEvents(g));
  return out;
}

export async function startTriggers() {
  room = OBR.room.id;
  gm = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(async () => { gm = (await OBR.player.getRole()) === "GM"; });
  OBR.scene.items.onChange(() => kick());
  OBR.scene.onReadyChange((r) => { primed = false; lastPos = new Map(); inside = new Map(); if (r) kick(); });
  OBR.broadcast.onMessage(TRIG_RUN, async (e) => {
    if (!gm) return;
    const d = e.data ?? {};
    if (d.graph) {
      const g = graphs(room).find((x) => x.id === d.graph);
      if (!g) return;
      let ctx = {};
      if (d.token) { const [tok] = await OBR.scene.items.getItems([d.token]).catch(() => []); if (tok) ctx = { token: tok, name: tok.text?.plainText || tok.name || "Хтось" }; }
      const pick = d.nodes?.length ? (x) => d.nodes.includes(x.node) : (x) => x.ev.t === "button";
      for (const l of nodeEvents(g, true).filter(pick)) run(l, ctx, true, Boolean(d.test));
      return;
    }
    const t = triggers(room).find((x) => x.id === d.id);
    if (t) run(t, {}, true);
  });
  OBR.broadcast.onMessage(CHOICE_ANS, (e) => { const d = e.data ?? {}; const r = waiting.get(d.cid); if (r) { waiting.delete(d.cid); r(d); } });
  OBR.room.onMetadataChange((m) => battleTick(m[BATTLE]));
  battleTick((await OBR.room.getMetadata())[BATTLE], true);
  setInterval(() => { if (gm) timers(); }, 5000);
  if (await OBR.scene.isReady()) kick();
}

// зміни на сцені сиплються десятками (живі NPC крокують 4 рази на секунду) — перевіряємо по черзі, не паралельно
let busy = false, again = false, kickT = null;
function kick() {
  if (kickT) return;
  kickT = setTimeout(async () => {
    kickT = null;
    if (busy) { again = true; return; }
    busy = true;
    try { await watch(); } catch (e) { console.error("Тригери:", e); }
    busy = false;
    if (again) { again = false; kick(); }
  }, 120);
}

// ---------- події ----------
function battleTick(b, init = false) {
  const now = { active: Boolean(b?.active), round: Number(b?.round) || 0 };
  const was = battle;
  battle = now;
  if (init || !gm) return;
  if (now.active && !was.active) fire("battle", () => true, {});
  if (now.active && now.round && now.round !== was.round) fire("round", (ev) => !Number(ev.n) || Number(ev.n) === now.round, {});
}
function timers() {
  for (const t of listeners()) {
    if (t.ev?.t !== "timer") continue;
    const every = Math.max(1, Number(t.ev.every) || 15) * 60000;
    const last = lastRun.get(t.id) ?? (lastRun.set(t.id, Date.now()), Date.now());
    if (Date.now() - last >= every) { lastRun.set(t.id, Date.now()); run(t, {}); }
  }
}
function fire(type, match, ctx) {
  for (const t of listeners()) if (t.ev?.t === type && match(t.ev)) run(t, ctx);
}

// зони й наближення: як у пасток — по всьому шляху токена, лише від руху
async function watch() {
  if (!gm || !(await OBR.scene.isReady())) return;
  const list = listeners().filter((t) => t.ev?.t === "enter" || t.ev?.t === "near");
  dpi = await OBR.scene.grid.getDpi();
  const tokens = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE");
  const boxes = new Map();
  for (const t of list) {
    const id = t.ev.t === "enter" ? t.ev.zone : t.ev.target;
    if (id && !boxes.has(id)) boxes.set(id, await shapeOf(id));
  }
  const hits = [];
  for (const tok of tokens) {
    const p = tok.position;
    const was = lastPos.get(tok.id);
    lastPos.set(tok.id, { x: p.x, y: p.y });
    const moved = Boolean(was) && (was.x !== p.x || was.y !== p.y);
    for (const t of list) {
      const ev = t.ev;
      if (!who(ev, tok)) continue;
      const z = boxes.get(ev.t === "enter" ? ev.zone : ev.target);
      if (!z || (ev.t === "near" && tok.id === ev.target)) continue;
      const test = (q) => (ev.t === "enter" ? inZone(z, q) : Math.hypot(q.x - z.pos.x, q.y - z.pos.y) < Math.max(0.5, Number(ev.dist) || 2) * dpi);
      const key = `${t.id}|${tok.id}`;
      const now = test(p);
      let crossed = now;
      if (!crossed && moved) {
        const steps = Math.min(2000, Math.ceil(Math.hypot(p.x - was.x, p.y - was.y) / 6));
        for (let k = 1; k < steps && !crossed; k++) crossed = test({ x: was.x + ((p.x - was.x) * k) / steps, y: was.y + ((p.y - was.y) * k) / steps });
      }
      const before = inside.get(key) ?? false;
      inside.set(key, now);
      if (primed && moved && crossed && !before) hits.push([t, tok]);
    }
  }
  primed = true;
  for (const [t, tok] of hits) run(t, { token: tok, name: tok.text?.plainText || tok.name || "Хтось" });
}
async function shapeOf(id) {
  try {
    const [it] = await OBR.scene.items.getItems([id]);
    if (!it) return null;
    return { b: await OBR.scene.items.getItemBounds([id]), circle: it.type === "SHAPE" && it.shapeType === "CIRCLE", pos: it.position };
  } catch { return null; }
}
function who(ev, tok) {
  if (ev.who === "tokens") return (ev.tokens ?? []).includes(tok.id);
  if (ev.who === "any") return true;
  return tok.visible && !tok.metadata?.[AI];   // герої: видимі й не «живі» NPC
}
function inZone(z, p) {
  const b = z.b;
  if (z.circle) {
    const dx = (p.x - b.center.x) / (b.width / 2), dy = (p.y - b.center.y) / (b.height / 2);
    return dx * dx + dy * dy <= 1;
  }
  return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

// ---------- виконання ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export async function run(t, ctx, manual = false, test = false) {
  if (t.temp) return t.temp(ctx);
  if (!manual) {
    const last = lastRun.get(t.id) ?? 0;
    if (t.ev?.t !== "timer" && Date.now() - last < (Number(t.cd) || 0) * 1000) return;
  }
  if (!t.graph) { for (const c of t.if ?? []) if (!(await check(c, ctx))) return; }
  lastRun.set(t.id, Date.now());
  if (!test) markFired(t);
  addLog(room, `${test ? "🧪 " : ""}«${t.name}»${ctx.name ? ` — ${ctx.name}` : ""}${manual && !test ? " (вручну)" : ""}`);
  if (t.graph) { trace(t.graph, t.node); return flow(t.graph, t.node, 0, ctx); }
  for (const a of t.do ?? []) {
    try { await act(a, ctx); } catch (e) { console.error("Тригер:", t.name, e); addLog(room, `  ⚠ ${a.t}: ${e.message}`); }
  }
}
function markFired(t) {
  if (t.graph) {
    if (!t.once) return;
    const all = graphs(room); const g = all.find((x) => x.id === t.graph.id);
    if (g) { g.off = { ...(g.off ?? {}), [t.node]: true }; saveGraphs(room, all); }
    return;
  }
  const all = triggers(room);
  const me = all.find((x) => x.id === t.id);
  if (me) { me.fired = (me.fired ?? 0) + 1; if (me.once) me.on = false; saveTriggers(room, all); }
}
async function check(c, ctx) {
  const vs = vars(room);
  if (c.t === "battle") { const b = (await OBR.room.getMetadata())[BATTLE]; return Boolean(b?.active) === (c.on !== "no"); }
  if (c.t === "visible") { const [it] = c.tok ? await OBR.scene.items.getItems([c.tok]) : []; return Boolean(it?.visible); }
  if (c.t === "inzone") {
    const z = c.zone ? await shapeOf(c.zone) : null;
    if (!z) return false;
    if (c.who === "any") { const all = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE" && i.visible && !i.metadata?.[AI]); return all.some((i) => inZone(z, i.position)); }
    const id = c.who === "tok" ? c.tok : ctx.token?.id;
    const [it] = id ? await OBR.scene.items.getItems([id]) : [];
    return Boolean(it && inZone(z, it.position));
  }
  if (c.t === "chance") return Math.random() * 100 < (Number(c.p) || 0);
  if (c.t === "name") return String(ctx.name ?? "").toLowerCase().includes(String(c.name ?? "").trim().toLowerCase());
  if (c.t === "var") {
    const v = Number(vs[c.v] ?? 0), n = Number(c.n) || 0;
    return Boolean(({ ">=": v >= n, "<=": v <= n, "==": v === n, "!=": v !== n })[c.op ?? ">="]);
  }
  return true;
}

// граф: від вузла по виходу slot — далі по зв'язках, крок за кроком (до 300 кроків, щоб петля не зависла)
async function flow(g, nodeId, slot, ctx, budget = { n: 300 }) {
  for (const { node, kind, props } of nextNodes(g, nodeId, slot)) {
    if (--budget.n < 0) { addLog(room, `  ⚠ «${g.name}»: забагато кроків — можливо, петля`); return; }
    let out = 0;
    trace(g, node, nodeId, slot);
    try {
      if (kind === "if") out = (await check(props, ctx)) ? 0 : 1;
      else if (kind === "random") out = Math.floor(Math.random() * Math.max(2, Math.min(4, Number(props.n) || 2)));
      else if (kind === "choice") out = await choose(props, ctx);
      else if (kind === "wait") ({ out, ctx } = await waitFor(props, ctx));
      else if (kind === "once") out = memo(g, node, (m) => (m.n = (m.n ?? 0) + 1)) === 1 ? 0 : 1;
      else if (kind === "every") { const n = Math.max(1, Number(props.n) || 2); out = memo(g, node, (m) => (m.n = (m.n ?? 0) + 1)) % n === 0 ? 0 : 1; }
      else if (kind === "roll") out = await rollFate(props, ctx);
      else await act(props, ctx);
    } catch (e) { console.error("Граф:", g.name, e); addLog(room, `  ⚠ ${props.t}: ${e.message}`); }
    await flow(g, node, out, ctx, budget);
  }
}

// підсвітка в редакторі: який вузол щойно спрацював і яким проводом прийшов потік
function trace(g, node, from = null, slot = 0) {
  OBR.broadcast.sendMessage(TRACE, { g: g.id, node, from, slot }, { destination: "LOCAL" }).catch(() => {});
}
// пам'ять вузлів «Лише перший раз» / «Кожен N-й раз»
const MEM = () => `atmosfera.graph-mem.${room}`;
function memo(g, node, fn) {
  const all = local(MEM(), {});
  const k = `${g.id}:${node}`;
  const m = all[k] ?? {};
  fn(m);
  all[k] = m;
  saveLocal(MEM(), all);
  return m.n;
}
// «Чекати, доки…»: граф стоїть, поки хтось не зайде в зону / не підійде / змінна не досягне значення; вихід 1 — час вийшов
function waitFor(p, ctx) {
  const secs = Math.max(5, Math.min(7200, Number(p.secs) || 300));
  return new Promise((resolve) => {
    let done = false;
    const finish = (out, c = ctx) => { if (done) return; done = true; const i = temps.indexOf(l); if (i >= 0) temps.splice(i, 1); clearInterval(poll); clearTimeout(tm); resolve({ out, ctx: c }); };
    const l = p.what === "var" ? null : { id: "wait:" + uid(), name: "чекання", ev: { t: p.what === "near" ? "near" : "enter", zone: p.zone, target: p.target, dist: p.dist, who: p.who ?? "hero" }, temp: (c) => finish(0, c.token ? c : ctx) };
    if (l) { temps.push(l); kick(); }
    const poll = p.what === "var" ? setInterval(async () => { if (await check({ t: "var", v: p.v, op: p.op, n: p.n }, ctx)) finish(0); }, 1000) : null;
    const tm = setTimeout(() => finish(1), secs * 1000);
  });
}
// кидок долі d20: майстер бачить число, гравці — анімацію й настрій (якщо показувати)
async function rollFate(p, ctx) {
  const n = 1 + Math.floor(Math.random() * 20);
  const total = n + (Number(p.mod) || 0);
  const dc = Number(p.dc) || 11;
  const tier = n === 20 ? "crit" : n === 1 ? "fumble" : total >= dc ? "good" : "bad";
  if (p.show !== "no") await OBR.broadcast.sendMessage(FATE, { tier, q: fill(p.q, ctx, vars(room)).slice(0, 80) }, { destination: "ALL" }).catch(() => {});
  addLog(room, `  🎲 d20 ${n}${Number(p.mod) ? ` ${Number(p.mod) > 0 ? "+" : ""}${Number(p.mod)} = ${total}` : ""} проти СК ${dc} — ${tier === "good" || tier === "crit" ? "успіх" : "провал"}`);
  return tier === "good" || tier === "crit" ? 0 : 1;
}
const rollDice = (expr) => {
  const m = String(expr ?? "").replace(/\s+/g, "").match(/^([+-]?)(\d*)[кd](\d+)([+-]\d+)?$/i);
  if (!m) return Number(String(expr).replace(",", ".")) || 0;
  let s = 0;
  for (let i = 0; i < (Number(m[2]) || 1); i++) s += 1 + Math.floor(Math.random() * Number(m[3]));
  s += Number(m[4]) || 0;
  return m[1] === "-" ? -s : s;
};

// вибір гравців: вікно з кнопками; хто перший відповів — той і вирішив. Вихід — номер кнопки, останній — «час вийшов»
async function choose(p, ctx) {
  const opts = [p.a, p.b, p.c, p.d].map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!opts.length) return 0;
  let to = [];
  if (p.to === "who") { const id = await playerOf({ to: "who" }, ctx); to = id ? [id] : []; }
  else if (p.to === "pick") to = p.player ? [p.player] : [];
  if (p.to !== "all" && !to.length) to = (await OBR.party.getPlayers()).map((x) => x.id);
  const cid = uid();
  const secs = Math.max(10, Math.min(600, Number(p.time) || 90));
  const vs = vars(room);
  OBR.broadcast.sendMessage(CHOICE, { cid, to: p.to === "all" ? null : to, text: fill(p.text, ctx, vs), opts: opts.map((o) => fill(o, ctx, vs)), secs }, { destination: "REMOTE" }).catch(() => {});
  OBR.notification.show(`❔ Гравці вибирають: ${fill(p.text, ctx, vs).slice(0, 60)}`).catch(() => {});
  const ans = await Promise.race([new Promise((r) => waiting.set(cid, r)), sleep(secs * 1000).then(() => null)]);
  waiting.delete(cid);
  if (!ans) { addLog(room, "  ⏳ ніхто не вибрав — «час вийшов»"); OBR.broadcast.sendMessage(CHOICE, { cid, close: true }, { destination: "REMOTE" }).catch(() => {}); return opts.length; }
  addLog(room, `  ❔ ${ans.who ?? "Гравець"}: «${opts[ans.i] ?? "?"}»`);
  OBR.broadcast.sendMessage(CHOICE, { cid, close: true, who: ans.who, pick: opts[ans.i] }, { destination: "REMOTE" }).catch(() => {});
  return Math.max(0, Math.min(opts.length - 1, Number(ans.i) || 0));
}

async function act(a, ctx) {
  const vs = vars(room);
  const text = (s) => fill(s, ctx, vs);
  switch (a.t) {
    case "title": return OBR.broadcast.sendMessage(TITLE, { big: text(a.big), small: text(a.small) }, { destination: "ALL" });
    case "mood": { const p = PRESETS.find((x) => x.id === a.m); if (p) await setState(fromPreset(p)); return; }
    case "sound": {
      const to = a.to === "all" ? (await OBR.party.getPlayers()).map((p) => p.id) : [await playerOf(a, ctx)].filter(Boolean);
      if (!to.length) return OBR.notification.show(`Тригер: не знаю, кому програти звук (${ctx.name ?? "?"})`);
      return OBR.broadcast.sendMessage(HUSH, { to, s: a.s, dir: a.dir, t: text(a.text).slice(0, 120) }, { destination: "REMOTE" });
    }
    case "letter": {
      const to = await playerOf(a, ctx);
      if (!to) return OBR.notification.show(`Тригер: не знаю, кому лист (${ctx.name ?? "?"}) — вибери гравця в дії`);
      const players = await OBR.party.getPlayers();
      const note = { id: uid(), to, name: players.find((p) => p.id === to)?.name ?? "", t: text(a.text), quiet: false, at: Date.now(), st: "sent" };
      saveLocal(NOTES, [...local(NOTES, []), note]);
      return OBR.broadcast.sendMessage(NOTE, note, { destination: "REMOTE" });
    }
    case "say": {
      if (!a.token) return;
      const t = text(a.text);
      return OBR.broadcast.sendMessage(AI_SAY, { id: a.token, text: t, kind: "talk", ms: Math.min(7000, 2500 + t.length * 55) }, { destination: "ALL" });
    }
    case "show": {
      const ids = a.tokens ?? [];
      if (ids.length) await OBR.scene.items.updateItems(ids, (its) => { for (const it of its) it.visible = a.vis !== "hide"; });
      return;
    }
    case "log": return appendLog({ k: "g", t: text(a.text), w: "Майстер" });
    case "var": {
      const v = vars(room);
      v[a.v] = a.op === "set" ? Number(a.n) || 0 : Number(v[a.v] ?? 0) + (Number(a.n) || 0);
      saveVars(room, v);
      return;
    }
    case "remind": return OBR.notification.show(`📌 ${text(a.text)}`, "WARNING");
    case "wait": return sleep(Math.min(600, Math.max(0, Number(a.s) || 0)) * 1000);
    case "move": {
      const id = a.who === "tok" ? a.tok : ctx.token?.id;
      if (!id) return;
      let to = null;
      if (a.to === "zone") { const z = await shapeOf(a.zone); if (z) to = z.b.center; }
      else if (a.target) { const [t] = await OBR.scene.items.getItems([a.target]); if (t) to = { x: t.position.x + (await OBR.scene.grid.getDpi()), y: t.position.y }; }
      if (to) await OBR.scene.items.updateItems([id], (its) => { for (const it of its) it.position = { x: to.x, y: to.y }; });
      return;
    }
    case "ai": {
      const ids = a.tokens ?? [];
      if (ids.length) await OBR.scene.items.updateItems(ids, (its) => {
        for (const it of its) {
          if (!a.b) delete it.metadata[AI];
          else it.metadata[AI] = { set: "bazaar", radius: 4, ...(it.metadata[AI] ?? {}), b: a.b, home: { x: it.position.x, y: it.position.y } };
        }
      });
      if (a.live === "on") await OBR.scene.setMetadata({ [AI_ON]: true });
      if (a.live === "off") await OBR.scene.setMetadata({ [AI_ON]: false });
      return;
    }
    case "damage": {
      const id = a.who === "tok" ? a.tok : ctx.token?.id;
      const [tok] = id ? await OBR.scene.items.getItems([id]) : [];
      if (!tok) return;
      const n = rollDice(a.dice);
      const name = tok.text?.plainText || tok.name || "";
      addLog(room, `  💥 ${name}: ${n >= 0 ? `−${n}` : `+${-n}`} ХП`);
      return OBR.broadcast.sendMessage(TRAP_DMG, { n, token: name, tokenId: tok.id, name: "", failed: false, src: "graph" }, { destination: "ALL" });
    }
    case "music": {
      const m = (await OBR.room.getMetadata())[MUSIC] ?? {};
      return OBR.room.setMetadata({ [MUSIC]: { ...m, override: a.m === "mood" ? null : a.m } });
    }
    case "card": {
      const [tok] = a.tok ? await OBR.scene.items.getItems([a.tok]) : [];
      if (!tok) return;
      const saved = tok.metadata?.[NPC] ?? {};
      return OBR.broadcast.sendMessage(NPC, { img: tok.image?.url ?? "", name: saved.name || tok.text?.plainText || tok.name || "", sub: text(a.sub) || saved.sub || "", intro: true }, { destination: "ALL" });
    }
    case "fx": {
      if (!a.zone) return;
      return OBR.scene.items.updateItems([a.zone], (its) => {
        for (const d of its) {
          if (a.fx === "off") {
            const sv = d.metadata[ZONE]?.saved;
            delete d.metadata[ZONE];
            if (sv && d.style) { d.style.fillOpacity = sv.fill; d.style.strokeOpacity = sv.stroke; }
            continue;
          }
          const fx = FX[a.fx]; if (!fx) continue;
          const old = d.metadata[ZONE];
          d.metadata[ZONE] = { fx: a.fx, cond: fx.cond ?? "", saved: old?.saved ?? (d.style ? { fill: d.style.fillOpacity, stroke: d.style.strokeOpacity } : null) };
          if (d.style) { d.style.fillOpacity = 0.01; d.style.strokeOpacity = 0; }
        }
      });
    }
    case "trap": {
      if (!a.zone) return;
      return OBR.scene.items.updateItems([a.zone], (its) => {
        for (const it of its) {
          const t = it.metadata[TRAP];
          if (!t) continue;
          if (a.arm === "show") it.visible = true;
          else { it.metadata[TRAP] = { ...t, armed: a.arm !== "off", fired: a.arm === "on" ? 0 : t.fired }; if (a.arm === "on") it.visible = false; }
        }
      });
    }
    case "battle": return startBattle(a, ctx);
    case "battleEnd": return endBattle();
  }
}

// ---------- бій (розширення «Бій») ----------
const d20 = () => 1 + Math.floor(Math.random() * 20);
const norm = (s) => String(s ?? "").trim().toLowerCase();
async function startBattle(a, ctx) {
  if (!(await OBR.scene.isReady())) return;
  const meta = await OBR.room.getMetadata();
  const sheets = meta[SHEETS] ?? {};
  const s = { active: false, round: 0, turn: 0, order: [], ...(meta[BATTLE] ?? {}) };
  if (s.active) return OBR.notification.show("Бій уже йде");
  const all = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE");
  const nameOf = (i) => i.text?.plainText || i.name || "Учасник";
  // герой: прив'язаний до листа в «Бою» або має ім'я персонажа з листа
  const sheetOf = (i) => {
    if (i.metadata?.[LINK] && sheets[i.metadata[LINK]]) return i.metadata[LINK];
    const n = norm(nameOf(i));
    return Object.entries(sheets).find(([, sh]) => { const m = norm(sh?.name); return m && n && (n === m || n.startsWith(m) || m.startsWith(n)); })?.[0] ?? null;
  };
  const heroes = all.filter((i) => sheetOf(i));
  const rest = all.filter((i) => !sheetOf(i) && (a.npc === "foe" || !i.metadata?.[AI]));
  let foes = [];
  const mode = a.foes ?? "near";
  if (mode === "tokens") foes = all.filter((i) => (a.tokens ?? []).includes(i.id));
  else if (mode === "all") foes = rest;
  else if (mode === "zone") { const z = await shapeOf(a.zone); foes = z ? rest.filter((i) => inZone(z, i.position)) : []; }
  else {
    const R = Math.max(1, Number(a.dist) || 8) * (await OBR.scene.grid.getDpi());
    const near = heroes.length ? heroes : ctx.token ? [ctx.token] : [];
    foes = rest.filter((i) => near.some((h) => Math.hypot(h.position.x - i.position.x, h.position.y - i.position.y) <= R));
  }
  if (!foes.length && !heroes.length) return OBR.notification.show("Тригер «Почати бій»: нікого не знайшов на сцені");
  const order = [...s.order];
  const dexOf = (sh) => Math.floor(((Number(sh?.stats?.dex) || 10) - 10) / 2);
  for (const h of heroes) {
    if (order.some((e) => e.id === h.id)) continue;
    const sid = sheetOf(h);
    order.push({ id: h.id, sheetId: sid, name: sheets[sid]?.name?.trim() || nameOf(h), side: "hero", dex: dexOf(sheets[sid]), bonus: 0, init: null, roll: null, health: 0, conds: [] });
  }
  for (const f of foes) {
    if (order.some((e) => e.id === f.id)) continue;
    const r = d20();
    order.push({ id: f.id, sheetId: null, name: nameOf(f), side: "foe", dex: 0, bonus: 0, init: r, roll: r, health: 0, conds: [] });
  }
  if (a.reveal !== "no") { const hidden = foes.filter((f) => !f.visible).map((f) => f.id); if (hidden.length) await OBR.scene.items.updateItems(hidden, (its) => { for (const it of its) it.visible = true; }); }
  await OBR.room.setMetadata({ [BATTLE]: { ...s, active: true, round: 1, turn: 0, now: null, started: Date.now(), order } });
  // як у самому «Бою»: титр і бойова музика (якщо там увімкнено зв'язок з «Атмосферою»)
  const opts = { atm: true, boss: false, ...(meta[BOPTS] ?? {}) };
  if (opts.atm) {
    await OBR.broadcast.sendMessage(TITLE, { big: opts.boss ? "Бій не на життя" : "До бою!", small: "Раунд перший" }, { destination: "ALL" }).catch(() => {});
    const m = meta[MUSIC] ?? {};
    await OBR.room.setMetadata({ [MUSIC]: { ...m, before: m.override ?? null, override: opts.boss ? "boss" : "battle" } }).catch(() => {});
  }
  addLog(room, `  ⚔ бій: героїв ${heroes.length}, ворогів ${foes.length} — герої кидають ініціативу`);
}
async function endBattle() {
  const meta = await OBR.room.getMetadata();
  const s = meta[BATTLE];
  if (!s?.active) return;
  await OBR.room.setMetadata({ [BATTLE]: { ...s, active: false, round: 0, turn: 0, now: null, order: (s.order ?? []).map((e) => ({ ...e, init: null, roll: null })) } });
  const m = meta[MUSIC] ?? {};
  if (m.override === "battle" || m.override === "boss") { const { before, ...rest } = m; await OBR.room.setMetadata({ [MUSIC]: { ...rest, override: before ?? null } }).catch(() => {}); }
}

// гравець: вибраний у дії, або той, чий токен спрацював (поставив сам чи його ім'я схоже на токен)
async function playerOf(a, ctx) {
  if (a.to === "pick") return a.player || null;
  const tok = ctx.token;
  if (!tok) return null;
  const players = await OBR.party.getPlayers();
  if (players.some((p) => p.id === tok.createdUserId)) return tok.createdUserId;
  const n = norm(ctx.name);
  const p = players.find((x) => { const m = norm(x.name); return n && m && (n.includes(m) || m.includes(n)); });
  return p?.id ?? null;
}
