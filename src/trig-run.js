// Виконавець тригерів — лише у фоні майстра. Стежить за подіями (зони, наближення, таймери, бій,
// кнопка) і виконує дії по черзі. Тригери, змінні й журнал спрацювань — у браузері майстра.
import OBR from "@owlbear-rodeo/sdk";
import { TITLE, HUSH, NOTE, NPC, AI, AI_SAY, TRIG_RUN, PRESETS, setState } from "./state.js";
import { fromPreset } from "./director.js";
import { appendLog, uid, local, saveLocal, NOTES } from "./log.js";
import { triggers, saveTriggers, vars, saveVars, addLog, fill, EVENTS } from "./trig-data.js";

const BATTLE = "com.nikita.battle/state";
let room = "";
let gm = false;
let dpi = 150;
let timer = null;
let lastPos = new Map();            // токен → де був
let inside = new Map();             // `${trigger}|${token}` → true, якщо вже всередині (щоб спрацьовувати на вхід)
let primed = false;
let battle = { active: false, round: 0 };
const lastRun = new Map();          // тригер → коли спрацював (для паузи між спрацюваннями й таймерів)

export async function startTriggers() {
  room = OBR.room.id;
  gm = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(async () => { gm = (await OBR.player.getRole()) === "GM"; });
  OBR.scene.items.onChange(() => { clearTimeout(timer); timer = setTimeout(() => watch().catch((e) => console.error("Тригери:", e)), 150); });
  OBR.scene.onReadyChange((r) => { primed = false; lastPos = new Map(); inside = new Map(); if (r) watch().catch(() => {}); });
  OBR.broadcast.onMessage(TRIG_RUN, async (e) => { if (!gm) return; const t = triggers(room).find((x) => x.id === e.data?.id); if (t) run(t, {}, true); });
  OBR.room.onMetadataChange((m) => battleTick(m[BATTLE]));
  battleTick((await OBR.room.getMetadata())[BATTLE], true);
  setInterval(() => { if (gm) timers(); }, 5000);
  if (await OBR.scene.isReady()) watch().catch(() => {});
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
  for (const t of triggers(room)) {
    if (!t.on || t.ev?.t !== "timer") continue;
    const every = Math.max(1, Number(t.ev.every) || 15) * 60000;
    const last = lastRun.get(t.id) ?? (lastRun.set(t.id, Date.now()), Date.now());
    if (Date.now() - last >= every) { lastRun.set(t.id, Date.now()); run(t, {}); }
  }
}
function fire(type, match, ctx) {
  for (const t of triggers(room)) if (t.on && t.ev?.t === type && match(t.ev)) run(t, ctx);
}

// зони й наближення: як у пасток — по всьому шляху токена, лише від руху
async function watch() {
  if (!gm || !(await OBR.scene.isReady())) return;
  const list = triggers(room).filter((t) => t.on && (t.ev?.t === "enter" || t.ev?.t === "near"));
  dpi = await OBR.scene.grid.getDpi();
  const tokens = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE");
  const boxes = new Map();
  for (const t of list) {
    const id = t.ev.t === "enter" ? t.ev.zone : t.ev.target;
    if (id && !boxes.has(id)) { try { const [it] = await OBR.scene.items.getItems([id]); if (it) boxes.set(id, { b: await OBR.scene.items.getItemBounds([id]), circle: it.type === "SHAPE" && it.shapeType === "CIRCLE", pos: it.position }); } catch { /* прибрали */ } }
  }
  const hits = [];
  for (const tok of tokens) {
    const p = tok.position;
    const was = lastPos.get(tok.id);
    lastPos.set(tok.id, { x: p.x, y: p.y });
    for (const t of list) {
      const ev = t.ev;
      if (!who(ev, tok)) continue;
      const z = boxes.get(ev.t === "enter" ? ev.zone : ev.target);
      if (!z || (ev.t === "near" && tok.id === ev.target)) continue;
      const test = (q) => (ev.t === "enter" ? inZone(z, q) : Math.hypot(q.x - z.pos.x, q.y - z.pos.y) < Math.max(0.5, Number(ev.dist) || 2) * dpi);
      const key = `${t.id}|${tok.id}`;
      const now = test(p);
      let crossed = now;
      if (!crossed && was && (was.x !== p.x || was.y !== p.y)) {
        const steps = Math.min(2000, Math.ceil(Math.hypot(p.x - was.x, p.y - was.y) / 6));
        for (let k = 1; k < steps && !crossed; k++) crossed = test({ x: was.x + ((p.x - was.x) * k) / steps, y: was.y + ((p.y - was.y) * k) / steps });
      }
      const before = inside.get(key) ?? false;
      inside.set(key, now);
      const moved = was && (was.x !== p.x || was.y !== p.y);
      if (primed && moved && crossed && !before) hits.push([t, tok]);
    }
  }
  primed = true;
  for (const [t, tok] of hits) run(t, { token: tok, name: tok.text?.plainText || tok.name || "Хтось" });
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
export async function run(t, ctx, manual = false) {
  if (!manual) {
    const last = lastRun.get(t.id) ?? 0;
    if (t.ev?.t !== "timer" && Date.now() - last < (Number(t.cd) || 0) * 1000) return;
  }
  const vs = vars(room);
  for (const c of t.if ?? []) {
    if (c.t === "chance" && Math.random() * 100 >= (Number(c.p) || 0)) return;
    if (c.t === "name" && !String(ctx.name ?? "").toLowerCase().includes(String(c.name ?? "").trim().toLowerCase())) return;
    if (c.t === "var") {
      const v = Number(vs[c.v] ?? 0), n = Number(c.n) || 0;
      if (!({ ">=": v >= n, "<=": v <= n, "==": v === n, "!=": v !== n })[c.op ?? ">="]) return;
    }
  }
  lastRun.set(t.id, Date.now());
  const all = triggers(room);
  const me = all.find((x) => x.id === t.id);
  if (me) { me.fired = (me.fired ?? 0) + 1; if (me.once) me.on = false; saveTriggers(room, all); }
  addLog(room, `«${t.name}»${ctx.name ? ` — ${ctx.name}` : ""}${manual ? " (вручну)" : ""}`);
  for (const a of t.do ?? []) {
    try { await act(a, ctx); } catch (e) { console.error("Тригер:", t.name, e); addLog(room, `  ⚠ ${a.t}: ${e.message}`); }
  }
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
  }
}

// гравець: вибраний у дії, або той, чий токен спрацював (поставив сам чи його ім'я схоже на токен)
async function playerOf(a, ctx) {
  if (a.to === "pick") return a.player || null;
  const tok = ctx.token;
  if (!tok) return null;
  const players = await OBR.party.getPlayers();
  if (players.some((p) => p.id === tok.createdUserId)) return tok.createdUserId;
  const n = String(ctx.name ?? "").trim().toLowerCase();
  const p = players.find((x) => { const m = x.name.trim().toLowerCase(); return n && m && (n.includes(m) || m.includes(n)); });
  return p?.id ?? null;
}
export { EVENTS };
