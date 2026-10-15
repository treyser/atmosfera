// Меню фігури: який ефект показати в її межах, який стан вона накладає, чи бачать її гравці.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { ZONE } from "./state.js";
import { FX, ZONE_CONDS } from "./zone-fx.js";

const $ = (id) => document.getElementById(id);
let targets = [];

// Меню могло лишитися відкритим із попереднього разу, а Owlbear інколи віддає виділення із запізненням.
// Тому ціль беремо щоразу заново: при відкритті, при зміні виділення і безпосередньо перед кожною дією.
let built = false;
let lastKey = "";

OBR.onReady(async () => {
  for (const [k, v] of ZONE_CONDS) $("cond").append(new Option(v, k));
  for (const [key, fx] of Object.entries(FX)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fxbtn";
    b.dataset.fx = key;
    b.innerHTML = `<i></i><span></span>`;
    b.querySelector("i").style.background = fx.color;
    b.querySelector("span").textContent = fx.name;
    b.onclick = () => apply(key);
    $("fx").append(b);
  }
  $("cond").onchange = async () => { const c = $("cond").value; await update((m) => ({ ...m, cond: c })); };
  $("hide").onchange = async () => {
    const hide = $("hide").checked;
    await fresh();
    if (targets.length) await OBR.scene.items.updateItems(targets, (ds) => { for (const d of ds) d.visible = !hide; });
  };
  $("off").onclick = remove;
  built = true;

  OBR.player.onChange((p) => { if (key(p.selection) !== lastKey) show(p.selection ?? []); });
  await show((await OBR.player.getSelection()) ?? []);
  // підстраховка: виділення могло оновитися вже після відкриття
  setTimeout(async () => show((await OBR.player.getSelection()) ?? []), 250);
});

const key = (sel) => (sel ?? []).slice().sort().join(",");

async function fresh() {
  targets = (await OBR.player.getSelection()) ?? [];
  return targets;
}

// Показати стан саме тієї фігури, яку зараз виділено
async function show(sel) {
  if (!built) return;
  targets = sel;
  lastKey = key(sel);
  const items = sel.length ? await OBR.scene.items.getItems(sel) : [];
  const first = items[0];
  const cur = first?.metadata?.[ZONE] ?? {};
  $("count").textContent = items.length > 1 ? `фігур: ${items.length}` : (first?.name || "");
  $("cond").value = cur.cond ?? "";
  $("hide").checked = first ? !first.visible : false;
  for (const b of $("fx").children) b.classList.toggle("on", b.dataset.fx === cur.fx);
}

// Обрати ефект: контур фігури ховаємо (запам'ятавши, яким він був), стан за замовчуванням — від ефекту
async function apply(key) {
  const fx = FX[key];
  if (!(await fresh()).length) return;
  await OBR.scene.items.updateItems(targets, (ds) => {
    for (const d of ds) {
      const old = d.metadata[ZONE];
      const saved = old?.saved ?? (d.style ? { fill: d.style.fillOpacity, stroke: d.style.strokeOpacity } : null);
      d.metadata[ZONE] = { fx: key, cond: old && old.fx === key ? old.cond : fx.cond, saved };
      if (d.style) { d.style.fillOpacity = 0.01; d.style.strokeOpacity = 0; }  // ледь-ледь заливки — щоб фігуру можна було клацнути
    }
  });
  for (const b of $("fx").children) b.classList.toggle("on", b.dataset.fx === key);
  if (!$("cond").value || $("cond").value !== fx.cond) $("cond").value = fx.cond;
}

async function update(fn) {
  if (!(await fresh()).length) return;
  await OBR.scene.items.updateItems(targets, (ds) => {
    for (const d of ds) if (d.metadata[ZONE]) d.metadata[ZONE] = fn(d.metadata[ZONE]);
  });
}

// Прибрати ефект і повернути фігурі її контур
async function remove() {
  if (!(await fresh()).length) return;
  await OBR.scene.items.updateItems(targets, (ds) => {
    for (const d of ds) {
      const saved = d.metadata[ZONE]?.saved;
      if (d.style && saved) { d.style.fillOpacity = saved.fill ?? 0.5; d.style.strokeOpacity = saved.stroke ?? 1; }
      delete d.metadata[ZONE];
    }
  });
  for (const b of $("fx").children) b.classList.remove("on");
}
