// «Живі» NPC. Фоновий скрипт майстра рухає токени з позначкою AI: блукання в зоні, торговець біля лотка,
// патруль по точках, балакучі пари сходяться й говорять. Репліки розсилаються всім, але кожен клієнт сам
// вирішує, чи показати бульбашку: гравець бачить лише те, що чує його токен (поруч), майстер — усе.
import OBR, { buildLabel } from "@owlbear-rodeo/sdk";
import { AI, AI_ON, AI_SAY, ID } from "./state.js";
import { shout, mutter, talk } from "./ai-lines.js";
import { readSheet } from "./shop-data.js";

const BUBBLE = `${ID}/ai-bubble`;
const TICK = 250;                    // мс між кроками
const SPEED = 1.3;                   // клітинок за секунду
const HEAR = { talk: 5, mutter: 4, shout: 9 };   // радіус «чутності» в клітинках

let gm = false;
let room = "";
let dpi = 150;
let on = false;
const mem = new Map();               // id токена → стан руху й розмови
let busy = false;

export async function startNpcAi() {
  room = OBR.room.id;
  gm = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(async () => { gm = (await OBR.player.getRole()) === "GM"; });
  OBR.broadcast.onMessage(AI_SAY, (e) => bubble(e.data).catch(() => {}));
  const readOn = async () => { try { on = Boolean((await OBR.scene.getMetadata())[AI_ON]); dpi = await OBR.scene.grid.getDpi(); } catch { on = false; } };
  OBR.scene.onMetadataChange((m) => { on = Boolean(m[AI_ON]); });
  OBR.scene.onReadyChange(async (r) => { mem.clear(); if (r) await readOn(); else on = false; });
  if (await OBR.scene.isReady()) await readOn();
  setInterval(() => { if (gm && on && !busy) { busy = true; tick().catch((e) => console.error("Живі NPC:", e)).finally(() => (busy = false)); } }, TICK);
}

// ---------- рух (лише майстер) ----------
const rnd = (a, b) => a + Math.random() * (b - a);
const cell = (v) => (Math.floor(v / dpi) + 0.5) * dpi;
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) / dpi;

async function tick() {
  if (!(await OBR.scene.isReady())) return;
  const now = Date.now();
  const all = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE");
  const npcs = all.filter((i) => i.metadata?.[AI]?.b);
  if (!npcs.length) return;
  const held = new Set((await OBR.player.getSelection()) ?? []);   // майстер тягне токен — не заважаємо
  const zones = await zoneBoxes(npcs);
  const moves = new Map();

  for (const tok of npcs) {
    const ai = tok.metadata[AI];
    let s = mem.get(tok.id);
    if (!s) { s = { phase: "idle", until: now + rnd(500, 4000), cool: now + rnd(5000, 20000) }; mem.set(tok.id, s); }
    if (held.has(tok.id)) { s.phase = "idle"; s.until = now + 3000; continue; }
    const home = ai.home ?? tok.position;
    const pos = tok.position;

    if (s.phase === "walk") {
      const d = Math.hypot(s.tx - pos.x, s.ty - pos.y);
      const step = (SPEED * dpi * TICK) / 1000;
      if (d <= step) {
        moves.set(tok.id, { x: s.tx, y: s.ty });
        if (s.meet) { s.phase = "talk"; startTalk(tok, s, npcs, now); }
        else { s.phase = "idle"; s.until = now + (ai.b === "patrol" ? rnd(1200, 2500) : rnd(2500, 8000)); if (Math.random() < 0.12) say(tok.id, mutter(ai.set, ai.lines ?? []), "mutter"); }
      } else {
        moves.set(tok.id, { x: pos.x + ((s.tx - pos.x) / d) * step, y: pos.y + ((s.ty - pos.y) / d) * step });
      }
      continue;
    }
    if (s.phase === "talk" || s.phase === "wait") {
      if (now > s.until) { s.phase = "idle"; s.until = now + rnd(2000, 5000); s.cool = now + rnd(30000, 60000); s.meet = null; }
      continue;
    }
    if (now < s.until) continue;

    // idle закінчився — що далі
    if (ai.b === "merchant") {
      if (Math.random() < 0.8) say(tok.id, shout(ai.set, ai.lines ?? []), "shout");
      s.until = now + rnd(10000, 25000);
      if (Math.random() < 0.3) target(s, { x: cell(home.x + rnd(-0.6, 0.6) * dpi), y: cell(home.y + rnd(-0.6, 0.6) * dpi) });
      continue;
    }
    if (ai.b === "patrol" && ai.route?.length) {
      const r = ai.route;
      s.i = s.i ?? 0; s.dir = s.dir ?? 1;
      if (s.i + s.dir >= r.length || s.i + s.dir < 0) s.dir = -s.dir;
      s.i += s.dir;
      target(s, r[Math.max(0, Math.min(r.length - 1, s.i))]);
      continue;
    }
    // балакучий: шукаємо співрозмовника поруч
    if (ai.b === "chat" && now > s.cool && Math.random() < 0.45) {
      const mate = npcs.find((o) => o.id !== tok.id && o.metadata[AI]?.b === "chat" && !held.has(o.id) && far(o.position, pos) < 9 &&
        (mem.get(o.id)?.phase ?? "idle") === "idle" && now > (mem.get(o.id)?.cool ?? 0));
      if (mate) {
        const ms = mem.get(mate.id) ?? {}; mem.set(mate.id, ms);
        Object.assign(ms, { phase: "wait", until: now + 20000, meet: tok.id });
        const dx = Math.sign(pos.x - mate.position.x) || 1;
        target(s, { x: mate.position.x + dx * dpi, y: mate.position.y });
        s.meet = mate.id;
        continue;
      }
    }
    // блукання: випадкова клітинка в зоні, не на чужій голові
    const zone = zones.get(ai.zone) ?? null;
    const R = Math.max(1, Number(ai.radius) || 4);
    for (let k = 0; k < 12; k++) {
      const p = zone
        ? { x: cell(rnd(zone.min.x, zone.max.x)), y: cell(rnd(zone.min.y, zone.max.y)) }
        : { x: cell(home.x + rnd(-R, R) * dpi), y: cell(home.y + rnd(-R, R) * dpi) };
      if (!zone && far(p, home) > R) continue;
      if (all.some((o) => o.id !== tok.id && far(o.position, p) < 0.9)) continue;
      target(s, p);
      break;
    }
    if (s.phase !== "walk") s.until = now + rnd(2000, 5000);
  }

  if (moves.size) {
    await OBR.scene.items.updateItems([...moves.keys()], (items) => {
      for (const it of items) { const p = moves.get(it.id); if (p) it.position = p; }
    });
  }
}
function target(s, p) { s.phase = "walk"; s.tx = p.x; s.ty = p.y; }

async function zoneBoxes(npcs) {
  const ids = [...new Set(npcs.map((n) => n.metadata[AI].zone).filter(Boolean))];
  const out = new Map();
  for (const id of ids) { try { out.set(id, await OBR.scene.items.getItemBounds([id])); } catch { /* фігуру прибрали */ } }
  return out;
}

// розмова: репліки по черзі, кожні ~3,5 с; обидва стоять, поки не договорять
function startTalk(tok, s, npcs, now) {
  const mate = npcs.find((o) => o.id === s.meet);
  const ms = mem.get(s.meet);
  if (!mate || !ms) { s.phase = "idle"; s.until = now + 2000; return; }
  const a = tok.metadata[AI], b = mate.metadata[AI];
  const lines = talk(a.set || b.set, a.lines ?? [], b.lines ?? []);
  const dur = lines.length * 3600 + 1500;
  s.until = ms.until = now + dur;
  ms.phase = "talk";
  lines.forEach((t, i) => setTimeout(() => say(i % 2 ? mate.id : tok.id, t, "talk"), 300 + i * 3600));
}

function say(id, text, kind) {
  OBR.broadcast.sendMessage(AI_SAY, { id, text, kind, ms: Math.min(6500, 2200 + text.length * 55) }, { destination: "ALL" }).catch(() => {});
}

// ---------- бульбашки (усі) ----------
const shown = new Map();   // id токена → id бульбашки
const norm = (s) => String(s ?? "").trim().toLowerCase();
async function bubble({ id, text, kind, ms }) {
  if (!id || !text || !(await OBR.scene.isReady())) return;
  const [tok] = await OBR.scene.items.getItems([id]);
  if (!tok) return;
  const d = await OBR.scene.grid.getDpi();
  if (!gm) {
    const me = await OBR.player.getId();
    const hero = norm(readSheet(room)?.data?.name);
    const mine = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE" && !i.metadata?.[AI] &&
      (i.createdUserId === me || (hero && [norm(i.name), norm(i.text?.plainText)].some((n) => n && (n.startsWith(hero) || hero.startsWith(n))))));
    const r = (HEAR[kind] ?? 5) * d;
    if (!mine.some((m) => Math.hypot(m.position.x - tok.position.x, m.position.y - tok.position.y) <= r)) return;
  }
  const old = shown.get(id);
  if (old) await OBR.scene.local.deleteItems([old]).catch(() => {});
  const label = buildLabel()
    .plainText(wrap(text))
    .position({ x: tok.position.x, y: tok.position.y - d * 0.55 })
    .attachedTo(id)
    .layer("POPOVER")
    .pointerDirection("DOWN").pointerWidth(14).pointerHeight(10)
    .backgroundColor(kind === "shout" ? "#3a2410" : "#17130f").backgroundOpacity(0.9)
    .fillColor(kind === "mutter" ? "#cfc6b4" : "#f6ead0").fontSize(kind === "shout" ? 24 : 20).fontWeight(kind === "shout" ? 700 : 500)
    .padding(10).cornerRadius(12)
    .locked(true).disableHit(true).disableAttachmentBehavior(["ROTATION", "SCALE"])
    .metadata({ [BUBBLE]: true })
    .build();
  shown.set(id, label.id);
  await OBR.scene.local.addItems([label]);
  setTimeout(() => { if (shown.get(id) === label.id) shown.delete(id); OBR.scene.local.deleteItems([label.id]).catch(() => {}); }, ms || 4000);
}
// довгий рядок — у кілька коротших
function wrap(t, n = 34) {
  const out = [];
  let line = "";
  for (const w of String(t).split(/\s+/)) {
    if ((line + " " + w).trim().length > n && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out.join("\n");
}
