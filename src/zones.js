// Зони: майстер малює фігуру й через ПКМ → «Зона» обирає ефект. Кожен клієнт малює ефект у себе
// поверх фігури. Майстер, крім того, стежить за учасниками бою: хто стоїть у зоні — отримує її стан.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { ID, ZONE } from "./state.js";
import { FX, ZONE_CONDS, LINGER } from "./zone-fx.js";

const MARK = `${ID}/zonefx`;                    // позначка локального ефекту
const BATTLE = "com.nikita.battle/state";        // стан розширення «Бій»
const CONDS = Object.fromEntries(ZONE_CONDS.filter(([k]) => k).map(([k, v]) => [k, v.replace(/^\S+\s/, "")]));

let gm = false;
let timer = null;
let queue = Promise.resolve();
let inside = new Map();   // id токена → множина id зон, де він стоїть (щоб помічати входи)

export async function startZones() {
  gm = (await OBR.player.getRole()) === "GM";
  OBR.player.onChange(async () => { gm = (await OBR.player.getRole()) === "GM"; schedule(); });
  OBR.scene.onReadyChange((ready) => { if (ready) schedule(); });
  OBR.scene.items.onChange(() => schedule());
  // бій почався чи хтось доєднався — перевірити, хто вже стоїть у зонах
  let last = "";
  OBR.room.onMetadataChange((m) => {
    const b = m[BATTLE];
    const key = b ? `${b.active}|${(b.order ?? []).map((e) => e.id).join(",")}` : "";
    if (gm && key !== last) { last = key; schedule(); }
  });
  if (await OBR.scene.isReady()) schedule();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => { queue = queue.then(sync).catch((err) => console.error("Зони:", err)); }, 120);
}

const isCircle = (i) => i.type === "SHAPE" && i.shapeType === "CIRCLE";
const seedOf = (id) => [...id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 997, 7) / 37;

async function sync() {
  if (!(await OBR.scene.isReady())) return;
  const zones = await OBR.scene.items.getItems((i) => i.metadata?.[ZONE]?.fx && FX[i.metadata[ZONE].fx]);
  // гравці не бачать прихованих зон; майстер бачить їх блідими
  const wanted = new Map();
  for (const z of zones) {
    if (!z.visible && !gm) continue;
    const g = await geometry(z);
    if (!g) continue;
    wanted.set(z.id, { fx: z.metadata[ZONE].fx, ghost: z.visible ? 1 : 0.35, circle: isCircle(z), ...g });
  }

  const mine = await OBR.scene.local.getItems((i) => i.metadata?.[MARK]);
  const stale = mine.filter((e) => {
    const w = wanted.get(e.metadata[MARK].id);
    const m = e.metadata[MARK];
    return !w || w.fx !== m.fx || w.ghost !== m.ghost || w.circle !== m.circle || w.geo !== m.geo;
  });
  if (stale.length) await OBR.scene.local.deleteItems(stale.map((e) => e.id));
  const have = new Set(mine.filter((e) => !stale.includes(e)).map((e) => e.metadata[MARK].id));

  const add = [];
  for (const [id, w] of wanted) {
    if (have.has(id)) continue;
    const free = FX[w.fx].free;   // магічне коло: завжди повне коло, не обрізане контуром фігури
    let b = buildEffect()
      .attachedTo(id)
      .sksl(FX[w.fx].sksl)
      .uniforms([
        { name: "shape", value: w.circle ? 1 : 0 },
        { name: "ghost", value: w.ghost },
        { name: "seed", value: seedOf(id) },
        { name: "box", value: free ? { x: w.ww, y: w.wh } : { x: w.bw, y: w.bh } },
        { name: "off", value: free ? { x: 0, y: 0 } : { x: w.ox, y: w.oy } },
      ])
      .layer(FX[w.fx].layer)
      .locked(true)
      .disableHit(true)
      .metadata({ [MARK]: { id, ...w } });
    b = free
      ? b.effectType("STANDALONE").position({ x: w.mx, y: w.my }).width(w.ww).height(w.wh)
      : b.effectType("ATTACHMENT");
    add.push(b.build());
  }
  if (add.length) await OBR.scene.local.addItems(add);

  if (gm) await watchFight(zones);
}

// Габарити фігури в її власних координатах: ефект малюється від точки прив'язки фігури
// (у кола й багатокутника це центр, у прямокутника — кут), тож переводимо світові межі назад
async function geometry(z) {
  let b;
  try { b = await OBR.scene.items.getItemBounds([z.id]); } catch { return null; }
  const sx = Math.abs(z.scale?.x || 1), sy = Math.abs(z.scale?.y || 1);
  const r = Math.round;
  const g = {
    bw: Math.max(1, r(b.width / sx)), bh: Math.max(1, r(b.height / sy)),
    ox: r((z.position.x - b.min.x) / sx), oy: r((z.position.y - b.min.y) / sy),
    // для окремого (не обрізаного) ефекту — світові межі: квадрат по меншій стороні, по центру
    ww: r(Math.min(b.width, b.height)), wh: r(Math.min(b.width, b.height)),
  };
  g.mx = r(b.center.x - g.ww / 2); g.my = r(b.center.y - g.wh / 2);
  g.geo = `${g.bw}x${g.bh}@${g.ox},${g.oy}|${g.mx},${g.my},${g.ww}`;
  return g;
}

// --- Майстер: хто з учасників бою стоїть у зоні ---

async function watchFight(zones) {
  const room = await OBR.room.getMetadata();
  const s = room[BATTLE];
  if (!s?.active || !s.order?.length) { inside = new Map(); return; }
  const active = zones.filter((z) => z.visible);
  const boxes = new Map();
  for (const z of active) {
    try { boxes.set(z.id, await OBR.scene.items.getItemBounds([z.id])); } catch { /* фігуру щойно видалили */ }
  }
  const tokens = await OBR.scene.items.getItems(s.order.map((e) => e.id));
  let changed = false;
  const next = new Map();

  const order = await Promise.all(s.order.map(async (e) => {
    const tok = tokens.find((t) => t.id === e.id);
    if (!tok) return e;
    let c;
    try { c = (await OBR.scene.items.getItemBounds([tok.id])).center; } catch { return e; }
    const here = new Set();
    for (const z of active) {
      const b = boxes.get(z.id);
      if (b && contains(b, c, isCircle(z))) here.add(z.id);
    }
    next.set(e.id, here);
    // щойно зайшов — підказка майстрові
    const before = inside.get(e.id) ?? new Set();
    for (const zid of here) {
      if (!before.has(zid)) {
        const z = active.find((x) => x.id === zid);
        const k = z.metadata[ZONE].cond;
        OBR.notification.show(`${e.name}: у зоні «${FX[z.metadata[ZONE].fx].name}»${k && CONDS[k] ? ` — ${CONDS[k].toLowerCase()}` : ""}`).catch(() => {});
      }
    }
    // стани від зон: додати тим, хто всередині, зняти з тих, хто вийшов
    const want = new Map();
    for (const zid of here) {
      const k = active.find((x) => x.id === zid).metadata[ZONE].cond;
      if (k && CONDS[k] && !want.has(k)) want.set(k, zid);
    }
    // вийшов із зони: стан або зникає, або ще кілька раундів тримається (вогонь догорає, одяг мокрий)
    let conds = (e.conds ?? []).flatMap((x) => {
      if (!x.z || want.get(x.k) === x.z) return [x];
      return LINGER[x.k] ? [{ k: x.k, r: LINGER[x.k] }] : [];
    });
    for (const [k, zid] of want) {
      conds = conds.filter((x) => !(x.k === k && !x.z));   // повернувся в зону — знову «поки стоїть тут»
      if (!conds.some((x) => x.k === k)) conds.push({ k, r: null, z: zid });
    }
    if (JSON.stringify(conds) !== JSON.stringify(e.conds ?? [])) { changed = true; return { ...e, conds }; }
    return e;
  }));

  inside = next;
  if (changed) await OBR.room.setMetadata({ [BATTLE]: { ...s, order } });
}

function contains(b, p, circle) {
  if (circle) {
    const rx = b.width / 2, ry = b.height / 2;
    const dx = (p.x - b.center.x) / rx, dy = (p.y - b.center.y) / ry;
    return dx * dx + dy * dy <= 1;
  }
  return p.x >= b.min.x && p.x <= b.max.x && p.y >= b.min.y && p.y <= b.max.y;
}
