// Меню фігури: який ефект показати в її межах, який стан вона накладає, чи бачать її гравці.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { ZONE } from "./state.js";
import { FX, ZONE_CONDS } from "./zone-fx.js";

const $ = (id) => document.getElementById(id);
let targets = [];

OBR.onReady(async () => {
  targets = (await OBR.player.getSelection()) ?? [];
  if (!targets.length) return;
  const items = await OBR.scene.items.getItems(targets);
  const first = items[0];
  const cur = first?.metadata?.[ZONE] ?? {};
  $("count").textContent = items.length > 1 ? `фігур: ${items.length}` : "";

  for (const [k, v] of ZONE_CONDS) $("cond").append(new Option(v, k));
  $("cond").value = cur.cond ?? "";
  $("hide").checked = first ? !first.visible : false;

  for (const [key, fx] of Object.entries(FX)) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "fxbtn" + (cur.fx === key ? " on" : "");
    b.innerHTML = `<i></i><span></span>`;
    b.querySelector("i").style.background = fx.color;
    b.querySelector("span").textContent = fx.name;
    b.onclick = () => apply(key);
    $("fx").append(b);
  }

  $("cond").onchange = () => update((m) => ({ ...m, cond: $("cond").value }));
  $("hide").onchange = () => OBR.scene.items.updateItems(targets, (ds) => { for (const d of ds) d.visible = !$("hide").checked; });
  $("off").onclick = remove;
});

// Обрати ефект: контур фігури ховаємо (запам'ятавши, яким він був), стан за замовчуванням — від ефекту
async function apply(key) {
  const fx = FX[key];
  await OBR.scene.items.updateItems(targets, (ds) => {
    for (const d of ds) {
      const old = d.metadata[ZONE];
      const saved = old?.saved ?? (d.style ? { fill: d.style.fillOpacity, stroke: d.style.strokeOpacity } : null);
      d.metadata[ZONE] = { fx: key, cond: old && old.fx === key ? old.cond : fx.cond, saved };
      if (d.style) { d.style.fillOpacity = 0.01; d.style.strokeOpacity = 0; }  // ледь-ледь заливки — щоб фігуру можна було клацнути
    }
  });
  for (const b of $("fx").children) b.classList.toggle("on", b.querySelector("span").textContent === fx.name);
  if (!$("cond").value || $("cond").value !== fx.cond) $("cond").value = fx.cond;
}

async function update(fn) {
  await OBR.scene.items.updateItems(targets, (ds) => {
    for (const d of ds) if (d.metadata[ZONE]) d.metadata[ZONE] = fn(d.metadata[ZONE]);
  });
}

// Прибрати ефект і повернути фігурі її контур
async function remove() {
  await OBR.scene.items.updateItems(targets, (ds) => {
    for (const d of ds) {
      const saved = d.metadata[ZONE]?.saved;
      if (d.style && saved) { d.style.fillOpacity = saved.fill ?? 0.5; d.style.strokeOpacity = saved.stroke ?? 1; }
      delete d.metadata[ZONE];
    }
  });
  for (const b of $("fx").children) b.classList.remove("on");
}
