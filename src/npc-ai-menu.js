// Меню «Поведінка NPC» (ПКМ на одному чи кількох токенах): модель поведінки, набір реплік, зона, маршрут.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import "./trap.css";
import { AI, AI_ON, NPC } from "./state.js";
import { SETS } from "./ai-lines.js";
import { loadNpcs, npcByName } from "./npc-data.js";

const $ = (id) => document.getElementById(id);
const KINDS = [
  ["", "⏸", "Стоїть"], ["wander", "🚶", "Блукає"], ["chat", "💬", "Балакучий"],
  ["merchant", "🧺", "Торговець"], ["patrol", "🛡", "Патруль"],
];
let ids = [];
let items = [];

OBR.onReady(async () => {
  for (const [k, i, t] of KINDS) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "kind"; b.dataset.k = k;
    b.innerHTML = `<i>${i}</i><span>${t}</span>`;
    b.onclick = () => setKind(k);
    $("kinds").appendChild(b);
  }
  for (const [k, v] of Object.entries(SETS)) $("a-set").appendChild(new Option(v, k));
  $("a-set").onchange = () => patch({ set: $("a-set").value });
  $("a-radius").onchange = () => patch({ radius: Math.max(1, Number($("a-radius").value) || 4) });
  $("a-zone").onchange = () => patch({ zone: $("a-zone").value || null });
  let t = null;
  $("a-lines").oninput = () => { clearTimeout(t); t = setTimeout(() => patch({ lines: $("a-lines").value.split("\n").map((s) => s.trim()).filter(Boolean) }), 400); };
  $("r-add").onclick = async () => {
    const [it] = await OBR.scene.items.getItems([ids[0]]);
    if (!it) return;
    const r = [...(it.metadata[AI]?.route ?? []), { x: it.position.x, y: it.position.y }];
    await patch({ route: r });
  };
  $("r-clear").onclick = () => patch({ route: [] });
  $("live").onclick = async () => {
    const on = !(await OBR.scene.getMetadata())[AI_ON];
    await OBR.scene.setMetadata({ [AI_ON]: on });
    paintLive(on);
  };
  OBR.scene.onMetadataChange((m) => paintLive(Boolean(m[AI_ON])));
  paintLive(Boolean((await OBR.scene.getMetadata())[AI_ON]));
  loadNpcs().catch(() => {});
  OBR.player.onChange(() => load());
  await load();
});

function paintLive(on) {
  $("live").textContent = on ? "⏸ Зупинити NPC на сцені" : "▶ NPC на цій сцені живуть";
  $("live").className = on ? "" : "tgo";
}

async function load() {
  ids = (await OBR.player.getSelection()) ?? [];
  items = ids.length ? await OBR.scene.items.getItems(ids) : [];
  const ai = items[0]?.metadata?.[AI] ?? null;
  const same = items.every((i) => (i.metadata?.[AI]?.b ?? "") === (ai?.b ?? ""));
  for (const b of $("kinds").children) b.classList.toggle("on", same && (ai?.b ?? "") === b.dataset.k);
  $("status").textContent = items.length > 1 ? `вибрано: ${items.length}` : items[0]?.name || "";
  $("form").hidden = !ai?.b;
  if (!ai?.b) return;
  $("a-set").value = ai.set ?? "bazaar";
  $("a-radius").value = ai.radius ?? 4;
  $("radius-row").hidden = $("zone-row").hidden = !["wander", "chat"].includes(ai.b);
  $("route-row").hidden = ai.b !== "patrol" || items.length > 1;
  $("route-n").textContent = `Точок маршруту: ${(ai.route ?? []).length}`;
  if (document.activeElement !== $("a-lines")) $("a-lines").value = (ai.lines ?? []).join("\n");
  // фігури на сцені — як зони блукання
  const shapes = await OBR.scene.items.getItems((i) => ["SHAPE", "CURVE", "PATH"].includes(i.type));
  const sel = $("a-zone");
  sel.innerHTML = "";
  sel.appendChild(new Option("— ні, радіус від стартової точки —", ""));
  shapes.forEach((s, n) => sel.appendChild(new Option(s.name && s.name !== "Shape" ? s.name : `Фігура ${n + 1} (${s.shapeType ?? s.type})`, s.id)));
  sel.value = ai.zone ?? "";
}

async function setKind(k) {
  if (!ids.length) return;
  if (!k) {
    await OBR.scene.items.updateItems(ids, (its) => { for (const it of its) delete it.metadata[AI]; });
    return load();
  }
  await OBR.scene.items.updateItems(ids, (its) => {
    for (const it of its) {
      const old = it.metadata[AI] ?? {};
      // репліки за замовчуванням — з картки NPC у Майстерні, якщо ім'я збігається
      const card = npcByName(it.metadata[NPC]?.name || it.text?.plainText || it.name);
      it.metadata[AI] = { set: "bazaar", radius: 4, ...old, b: k, home: { x: it.position.x, y: it.position.y }, lines: old.lines?.length ? old.lines : card?.chatter ?? [] };
    }
  });
  await load();
}

async function patch(p) {
  if (!ids.length) return;
  await OBR.scene.items.updateItems(ids, (its) => { for (const it of its) if (it.metadata[AI]) it.metadata[AI] = { ...it.metadata[AI], ...p }; });
  await load();
}
