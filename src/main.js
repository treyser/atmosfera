// Вікно майстра: пульт режисера, вибір настрою, повзунки, титр.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { PRESETS, SLIDERS, TITLE, BEAT, CUT, getState, setState, normalize, STATE } from "./state.js";
import { MAPS, PLACES, BEATS, placeOf } from "./beats.js";

const $ = (id) => document.getElementById(id);
let state = normalize();
let ready = false;
let beat = null;      // id поточного моменту
let busy = false;     // щоб подвійний клік не запускав перехід двічі

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    $("player").hidden = false;
    return;
  }
  $("gm").hidden = false;
  build();

  OBR.scene.onReadyChange((r) => { ready = r; if (r) load(); else draw(); });
  OBR.scene.onMetadataChange((m) => { state = normalize(m[STATE]); beat = m[BEAT] ?? null; draw(); });
  OBR.scene.items.onChange(() => report());
  ready = await OBR.scene.isReady();
  if (ready) await load();
  draw();
});

async function load() {
  state = await getState();
  beat = (await OBR.scene.getMetadata())[BEAT] ?? null;
  draw();
  report();
}

// Мапи пригоди в поточній сцені: ключ → елемент. Шукаємо за назвою.
async function findMaps() {
  const images = await OBR.scene.items.getItems((i) => i.layer === "MAP" && i.type === "IMAGE");
  const found = {};
  for (const [key, part] of Object.entries(MAPS)) {
    const hit = images.find((i) => i.name.toLowerCase().includes(part));
    if (hit) found[key] = hit;
  }
  return found;
}

// Підказка під пультом: чи всі мапи на місці
async function report() {
  if (!ready) { $("found").textContent = ""; return; }
  const found = await findMaps();
  const missing = Object.keys(MAPS).filter((k) => !found[k]);
  $("found").textContent = missing.length
    ? `У цій сцені бракує мап: ${missing.map((k) => MAPS[k]).join(", ")}`
    : "Усі мапи пригоди на місці.";
  for (const b of $("beats").children) {
    b.disabled = !found[BEATS.find((x) => x.id === b.dataset.id).map];
  }
}

// Один клік: потрібна мапа нагору, чужі місця сховати, камери всім, погода, титр.
async function go(next) {
  if (!ready || busy || !next) return;
  busy = true;
  try {
    const found = await findMaps();
    const target = found[next.map];
    if (!target) return;
    const place = placeOf(next.map);
    const top = Date.now();

    await OBR.scene.items.updateItems(Object.values(found), (drafts) => {
      for (const d of drafts) {
        const key = Object.keys(found).find((k) => found[k].id === d.id);
        d.visible = PLACES[place].includes(key);
        if (d.id === target.id) d.zIndex = top;
      }
    });

    const preset = PRESETS.find((p) => p.id === next.mood) ?? PRESETS[0];
    state = normalize({ preset: preset.id, rain: preset.rain, fog: preset.fog, flash: preset.flash, dark: preset.dark, amount: preset.amount, tint: preset.tint });
    beat = next.id;
    draw();
    await OBR.scene.setMetadata({ [STATE]: state, [BEAT]: beat });

    // Межі рахує майстер і шле готовими: гравець щойно показану мапу може ще не бачити.
    const bounds = await OBR.scene.items.getItemBounds([target.id]);
    await OBR.broadcast.sendMessage(CUT, { min: bounds.min, max: bounds.max }, { destination: "ALL" });

    if (next.big) {
      await new Promise((r) => setTimeout(r, 900));
      await OBR.broadcast.sendMessage(TITLE, { big: next.big, small: next.small }, { destination: "ALL" });
    }
  } finally {
    busy = false;
  }
}

function step(by) {
  const at = BEATS.findIndex((b) => b.id === beat);
  const to = at < 0 ? 0 : Math.min(BEATS.length - 1, Math.max(0, at + by));
  if (to !== at) go(BEATS[to]);
}

function build() {
  BEATS.forEach((b, n) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.id = b.id;
    const num = document.createElement("span");
    num.className = "num";
    num.textContent = String(n + 1);
    btn.append(num, b.name);
    btn.onclick = () => go(b);
    $("beats").append(btn);
  });
  $("prev").onclick = () => step(-1);
  $("next").onclick = () => step(1);

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
  for (const b of $("beats").children) b.classList.toggle("on", b.dataset.id === beat);
  const at = BEATS.findIndex((b) => b.id === beat);
  $("prev").disabled = !ready || at <= 0;
  $("next").disabled = !ready || at === BEATS.length - 1;
  for (const input of $("sliders").querySelectorAll("input")) {
    input.value = String(Math.round((state[input.dataset.key] ?? 0) * 100));
    input.disabled = !ready;
  }
}
