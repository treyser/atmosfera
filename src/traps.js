// Пастки у фоні. Майстер (його фоновий скрипт) стежить, чи токен героя ступив у заряджену пастку,
// і запускає її для всіх. Гравці бачать вікно з рятівним кидком, а помічені ними пастки — червоним пунктиром.
import OBR, { buildShape } from "@owlbear-rodeo/sdk";
import { AI, TRAP, TRAP_FIRE, TRAP_DMG, TRAP_CHECK, TRAP_SEEN, ZONE, ID } from "./state.js";
import { FX } from "./zone-fx.js";
import { appendLog, uid } from "./log.js";
import { playSecret } from "./sfx.js";
import { changeSheet, readSheet, SHEET_PUSH, owner } from "./shop-data.js";
import { presetOf, SAVES, seenTraps, saveSeenTraps, SEEN, pack } from "./trap-data.js";

const BATTLE = "com.nikita.battle/state";
const MARK = `${ID}/trapseen`;     // позначка місцевого контуру поміченої пастки
const WIN = `${ID}/trap-win`;
const CHECK_WIN = `${ID}/trap-check-win`;

let gm = false;
let room = "";
let url = (p) => p;
let timer = null;
let queue = Promise.resolve();
let inside = new Map();     // токен → множина пасток, у яких він стоїть
let lastPos = new Map();    // токен → де був (пастка спрацьовує лише від руху токена)
let primed = false;

export async function startTraps(toUrl) {
  url = toUrl;
  room = OBR.room.id;
  gm = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(async () => { gm = (await OBR.player.getRole()) === "GM"; });
  OBR.scene.items.onChange(() => schedule());
  OBR.scene.onReadyChange((ready) => { if (ready) { primed = false; schedule(); } });
  window.addEventListener("storage", (e) => { if (e.key === SEEN(room)) schedule(); });

  // усі: пастка спрацювала — звук і вікно
  OBR.broadcast.onMessage(TRAP_FIRE, async (event) => {
    const d = event.data;
    if (!d?.fid) return;
    playSecret(presetOf(d.kind).sound || "metal", "front", 1).catch(() => {});
    const w = await OBR.viewport.getWidth();
    await OBR.popover.close(WIN).catch(() => {});
    OBR.popover.open({
      id: WIN, url: url(`trap-hit.html?d=${encodeURIComponent(pack(d))}`), width: Math.min(560, w - 40), height: 330,
      anchorReference: "POSITION", anchorPosition: { top: 90, left: w / 2 },
      anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
      hidePaper: true, disableClickAway: true, marginThreshold: 0,
    }).catch(() => {});
  });

  // шкода: гравець, чий персонаж — цей токен, сам знімає ХП у своєму листі
  OBR.broadcast.onMessage(TRAP_DMG, async (event) => {
    const d = event.data ?? {};
    if (gm) {
      if (d.n) appendLog({ k: "g", t: `${d.token} отримує ${d.n} шкоди від пастки «${d.name ?? ""}»${d.failed ? "" : " (половина — рятунок вдався)"}.`, w: "Майстер" }).catch(() => {});
      return applyCond(d);
    }
    if (!d.n || !sameName(readSheet(room)?.data?.name, d.token)) return;
    const next = changeSheet(room, (data) => { data.hp = String(Math.max(0, (Number(data.hp) || 0) - d.n)); });
    const id = owner();
    if (next && id) OBR.broadcast.sendMessage(SHEET_PUSH, { id, data: next.data, at: next.at }, { destination: "REMOTE" }).catch(() => {});
    if (next) OBR.notification.show(`${d.token}: −${d.n} ХП (лишилось ${next.data.hp})`).catch(() => {});
  });

  // гравці: майстер просить Уважність
  OBR.broadcast.onMessage(TRAP_CHECK, async (event) => {
    if (gm || !event.data?.tid) return;
    const w = await OBR.viewport.getWidth();
    await OBR.popover.close(CHECK_WIN).catch(() => {});
    OBR.popover.open({
      id: CHECK_WIN, url: url(`trap-check.html?d=${encodeURIComponent(pack(event.data))}`), width: Math.min(420, w - 40), height: 250,
      anchorReference: "POSITION", anchorPosition: { top: 90, left: w / 2 },
      anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
      hidePaper: true, disableClickAway: true, marginThreshold: 0,
    }).catch(() => {});
  });

  // майстер: хто що помітив
  OBR.broadcast.onMessage(TRAP_SEEN, async (event) => {
    if (!gm) return;
    const d = event.data ?? {};
    OBR.notification.show(`${d.who}: Уважність ${d.total} — ${d.ok ? "помічає пастку" : "нічого не помічає"}`).catch(() => {});
    if (!d.ok) return;
    try {
      await OBR.scene.items.updateItems([d.tid], (items) => {
        for (const it of items) { const t = it.metadata[TRAP]; if (t && !t.seen?.includes(d.who)) t.seen = [...(t.seen ?? []), d.who]; }
      });
    } catch { /* пастку прибрали */ }
  });

  if (await OBR.scene.isReady()) schedule();
}

const sameName = (a, b) => {
  const x = String(a ?? "").trim().toLowerCase(), y = String(b ?? "").trim().toLowerCase();
  return Boolean(x && y && (x === y || x.startsWith(y) || y.startsWith(x)));
};

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { queue = queue.then(sync).catch((err) => console.error("Пастки:", err)); }, 150);
}

async function sync() {
  if (!(await OBR.scene.isReady())) return;
  const traps = await OBR.scene.items.getItems((i) => Boolean(i.metadata?.[TRAP]));
  if (gm) await watch(traps);
  else await drawSeen(traps);
}

const isCircle = (i) => i.type === "SHAPE" && i.shapeType === "CIRCLE";
function contains(b, p, circle) {
  if (circle) {
    const rx = b.width / 2, ry = b.height / 2;
    const dx = (p.x - b.center.x) / rx, dy = (p.y - b.center.y) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}

// --- майстер: хто ступив у пастку ---
async function watch(traps) {
  const armed = traps.filter((t) => t.metadata[TRAP].armed);
  const boxes = new Map();
  for (const t of armed) { try { boxes.set(t.id, await OBR.scene.items.getItemBounds([t.id])); } catch { /* щойно видалили */ } }
  const tokens = await OBR.scene.items.getItems((i) => i.layer === "CHARACTER" && i.type === "IMAGE" && i.visible && !i.metadata?.[AI]);
  const next = new Map();
  const fire = [];
  for (const tok of tokens) {
    const p = tok.position;
    const here = new Set();
    for (const t of armed) { const b = boxes.get(t.id); if (b && contains(b, p, isCircle(t))) here.add(t.id); }
    next.set(tok.id, here);
    const was = lastPos.get(tok.id);
    const moved = was && (was.x !== p.x || was.y !== p.y);
    lastPos.set(tok.id, { x: p.x, y: p.y });
    if (!primed || !moved) continue;
    const before = inside.get(tok.id) ?? new Set();
    // пастки на всьому шляху токена, а не лише там, де він зупинився: Owlbear пересуває токен
    // з точки в точку, тож перевіряємо відрізок «звідки → куди» з кроком у кілька пікселів
    const crossed = new Set(here);
    const dist = Math.hypot(p.x - was.x, p.y - was.y);
    const steps = Math.min(4000, Math.ceil(dist / 6));
    for (let k = 1; k < steps; k++) {
      const q = { x: was.x + ((p.x - was.x) * k) / steps, y: was.y + ((p.y - was.y) * k) / steps };
      for (const t of armed) { const b = boxes.get(t.id); if (b && !crossed.has(t.id) && contains(b, q, isCircle(t))) crossed.add(t.id); }
    }
    for (const tid of crossed) if (!before.has(tid)) fire.push([armed.find((t) => t.id === tid), tok]);
  }
  inside = next;
  primed = true;
  const done = new Set();
  for (const [trap, tok] of fire) {
    if (done.has(trap.id)) continue;   // одна пастка — один раз за рух
    done.add(trap.id);
    await trigger(trap, tok);
  }
}

async function trigger(trap, tok) {
  const t = trap.metadata[TRAP];
  const p = presetOf(t.kind);
  const fid = uid();
  await OBR.scene.items.updateItems([trap.id], (items) => {
    for (const it of items) {
      const m = it.metadata[TRAP];
      m.fired = (m.fired ?? 0) + 1;
      if (m.once) m.armed = false;
      it.visible = true;
      if (m.after && FX[m.after]) it.metadata[ZONE] = { fx: m.after, cond: FX[m.after].cond ?? "" };
    }
  });
  const name = tok.text?.plainText || tok.name || "Хтось";
  const d = { fid, tid: trap.id, kind: t.kind, icon: p.icon, name: t.name, token: name, tokenId: tok.id, save: t.save, dc: t.dc, dmg: t.dmg, half: t.half, cond: t.cond };
  await OBR.broadcast.sendMessage(TRAP_FIRE, d, { destination: "ALL" }).catch(() => {});
  appendLog({ k: "g", t: `${name} натрапляє на пастку «${t.name}» — рятівний кидок ${SAVES[t.save] ?? ""}, СК ${t.dc}.`, w: "Майстер" }).catch(() => {});
}

// --- майстер: провалив рятунок — стан у «Бою» ---
async function applyCond(d) {
  if (!d.failed || !d.cond || !d.tokenId) return;
  const s = (await OBR.room.getMetadata())[BATTLE];
  if (!s?.order?.some((e) => e.id === d.tokenId)) return;
  const order = s.order.map((e) => (e.id === d.tokenId && !(e.conds ?? []).some((c) => c.k === d.cond) ? { ...e, conds: [...(e.conds ?? []), { k: d.cond, r: null }] } : e));
  await OBR.room.setMetadata({ [BATTLE]: { ...s, order } });
}

// --- гравець: помічені пастки — червоним пунктиром, лише в нього ---
async function drawSeen(traps) {
  const seen = new Set(seenTraps(room));
  const want = traps.filter((t) => seen.has(t.id) && !t.visible && t.metadata[TRAP].armed);
  const mine = await OBR.scene.local.getItems((i) => Boolean(i.metadata?.[MARK]));
  const geo = new Map();
  for (const t of want) {
    try { const b = await OBR.scene.items.getItemBounds([t.id]); geo.set(t.id, `${Math.round(b.min.x)},${Math.round(b.min.y)},${Math.round(b.width)},${Math.round(b.height)},${isCircle(t) ? 1 : 0}`); } catch { /* */ }
  }
  const stale = mine.filter((m) => geo.get(m.metadata[MARK].tid) !== m.metadata[MARK].geo);
  if (stale.length) await OBR.scene.local.deleteItems(stale.map((m) => m.id));
  const have = new Set(mine.filter((m) => !stale.includes(m)).map((m) => m.metadata[MARK].tid));
  const add = [];
  for (const t of want) {
    const g = geo.get(t.id);
    if (!g || have.has(t.id)) continue;
    const [x, y, w, h, c] = g.split(",").map(Number);
    add.push(buildShape()
      .shapeType(c ? "CIRCLE" : "RECTANGLE")
      .width(w).height(h)
      .position(c ? { x: x + w / 2, y: y + h / 2 } : { x, y })
      .strokeColor("#ff5a4a").strokeWidth(5).strokeDash([18, 12]).strokeOpacity(0.95)
      .fillColor("#ff5a4a").fillOpacity(0.12)
      .layer("DRAWING").locked(true).disableHit(true)
      .name("Помічена пастка")
      .metadata({ [MARK]: { tid: t.id, geo: g } })
      .build());
  }
  if (add.length) await OBR.scene.local.addItems(add);
}

// для вікна перевірки: запам'ятати помічену пастку
export function remember(tid) {
  const s = new Set(seenTraps(room || OBR.room.id));
  s.add(tid);
  saveSeenTraps(room || OBR.room.id, [...s]);
}
