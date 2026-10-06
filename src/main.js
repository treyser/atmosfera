// Вікно майстра: вибір настрою, повзунки, титр.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { PRESETS, SLIDERS, TITLE, getState, setState, normalize, STATE } from "./state.js";

const $ = (id) => document.getElementById(id);
let state = normalize();
let ready = false;

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    $("player").hidden = false;
    return;
  }
  $("gm").hidden = false;
  build();

  OBR.scene.onReadyChange((r) => { ready = r; if (r) load(); else draw(); });
  OBR.scene.onMetadataChange((m) => { state = normalize(m[STATE]); draw(); });
  ready = await OBR.scene.isReady();
  if (ready) await load();
  draw();
});

async function load() {
  state = await getState();
  draw();
}

function build() {
  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = p.id;
    b.textContent = p.name;
    b.onclick = () => save({ preset: p.id, rain: p.rain, fog: p.fog, flash: p.flash, dark: p.dark, amount: p.amount, tint: p.tint });
    $("presets").append(b);
  }

  for (const s of SLIDERS) {
    const row = document.createElement("label");
    row.className = "slide";
    const name = document.createElement("span");
    name.textContent = s.name;
    const input = document.createElement("input");
    input.type = "range";
    input.min = "0";
    input.max = "100";
    input.dataset.key = s.key;
    // зберігаємо на відпусканні, щоб не засипати метадані сцени під час руху повзунка
    input.onchange = () => save({ ...state, [s.key]: Number(input.value) / 100 });
    row.append(name, input);
    $("sliders").append(row);
  }

  $("show").onclick = async () => {
    const big = $("big").value.trim();
    if (!big) { $("big").focus(); return; }
    await OBR.broadcast.sendMessage(TITLE, { big, small: $("small").value.trim() }, { destination: "ALL" });
  };
}

async function save(next) {
  if (!ready) return;
  state = normalize(next);
  draw();
  await setState(state);
}

function draw() {
  const current = PRESETS.find((p) => p.id === state.preset);
  $("now").textContent = ready ? (current?.name ?? "") : "Відкрий сцену";
  for (const b of $("presets").children) b.classList.toggle("on", b.dataset.id === state.preset);
  for (const input of $("sliders").querySelectorAll("input")) {
    input.value = String(Math.round((state[input.dataset.key] ?? 0) * 100));
    input.disabled = !ready;
  }
}
