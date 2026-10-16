// Меню пастки (ПКМ на фігурі → «Пастка»): тип, рятунок, шкода, що лишає, перевірка Уважності.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import "./trap.css";
import { TRAP, TRAP_CHECK, ZONE } from "./state.js";
import { FX, ZONE_CONDS } from "./zone-fx.js";
import { PRESETS, SAVES, newTrap, presetOf } from "./trap-data.js";

const $ = (id) => document.getElementById(id);
let target = null;   // id фігури
let trap = null;

OBR.onReady(async () => {
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "kind";
    b.dataset.k = p.kind;
    b.innerHTML = `<i>${p.icon}</i><span>${p.name}</span>`;
    b.onclick = () => pick(p.kind);
    $("kinds").appendChild(b);
  }
  for (const [k, v] of Object.entries(SAVES)) $("t-save").appendChild(new Option(v, k));
  for (const [k, v] of ZONE_CONDS) $("t-cond").appendChild(new Option(v, k));
  $("t-after").appendChild(new Option("нічого", ""));
  for (const [k, f] of Object.entries(FX)) if (!f.free) $("t-after").appendChild(new Option(`зону «${f.name}»`, k));

  for (const id of ["name", "dc", "dmg", "spot", "clue"]) $("t-" + id).addEventListener("input", edited);
  for (const id of ["save", "cond", "after", "half", "once"]) $("t-" + id).addEventListener("change", edited);
  $("arm").onclick = () => {
    if (trap.armed) save({ armed: false }, "Пастку знешкоджено");
    else update((it) => { it.metadata[TRAP] = { ...trap, armed: true, fired: 0 }; it.visible = false; delete it.metadata[ZONE]; });
  };
  $("off").onclick = () => update((it) => { delete it.metadata[TRAP]; });
  $("check").onclick = async () => {
    await OBR.broadcast.sendMessage(TRAP_CHECK, { tid: target, dc: trap.spot, clue: trap.clue }, { destination: "REMOTE" });
    $("status").textContent = "Гравці кидають Уважність…";
  };

  OBR.player.onChange(() => load());
  OBR.scene.items.onChange(() => load());
  await load();
  setTimeout(load, 250);
});

async function load() {
  const sel = (await OBR.player.getSelection()) ?? [];
  target = sel[0] ?? null;
  const [it] = target ? await OBR.scene.items.getItems([target]) : [];
  trap = it?.metadata?.[TRAP] ?? null;
  $("form").hidden = !trap;
  for (const b of document.querySelectorAll(".kind")) b.classList.toggle("on", trap?.kind === b.dataset.k);
  if (!trap) { $("status").textContent = "обери, що тут сховано"; return; }
  if (document.activeElement && /INPUT|SELECT/.test(document.activeElement.tagName)) return;
  $("t-name").value = trap.name ?? "";
  $("t-save").value = trap.save ?? "dex";
  $("t-dc").value = trap.dc ?? 13;
  $("t-dmg").value = trap.dmg ?? "";
  $("t-cond").value = trap.cond ?? "";
  $("t-after").value = trap.after ?? "";
  $("t-spot").value = trap.spot ?? 14;
  $("t-clue").value = trap.clue ?? "";
  $("t-half").checked = Boolean(trap.half);
  $("t-once").checked = trap.once !== false;
  $("arm").textContent = trap.armed ? "Знешкодити" : "Зарядити знову";
  $("arm").className = trap.armed ? "" : "tgo";
  const seen = trap.seen?.length ? ` · помітили: ${trap.seen.join(", ")}` : "";
  $("status").textContent = `${trap.armed ? "заряджена" : "знешкоджена"}${trap.fired ? ` · спрацювала ${trap.fired}×` : ""}${seen}`;
}

async function update(fn) {
  if (!target) return;
  await OBR.scene.items.updateItems([target], (items) => { for (const it of items) fn(it); });
  await load();
}
function save(patch) { return update((it) => { it.metadata[TRAP] = { ...it.metadata[TRAP], ...patch }; }); }

// нова пастка: заготовка + фігура ховається від гравців
function pick(kind) {
  if (trap) {
    const p = presetOf(kind);
    return save({ kind, name: p.name, save: p.save, dc: p.dc, dmg: p.dmg, half: p.half, cond: p.cond, after: p.after, clue: p.clue, spot: p.dc + 1 });
  }
  return update((it) => { it.metadata[TRAP] = newTrap(kind); it.visible = false; });
}

let t = null;
function edited() {
  clearTimeout(t);
  t = setTimeout(() => save({
    name: $("t-name").value || "Пастка", save: $("t-save").value, dc: Number($("t-dc").value) || 10, dmg: $("t-dmg").value,
    cond: $("t-cond").value, after: $("t-after").value, spot: Number($("t-spot").value) || 10, clue: $("t-clue").value,
    half: $("t-half").checked, once: $("t-once").checked,
  }), 300);
}
