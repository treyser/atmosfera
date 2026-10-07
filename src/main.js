// Вікно майстра: пульт режисера, вибір настрою, повзунки, титр.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { PRESETS, SLIDERS, TITLE, BEAT, CUT, GRADE_ON, HUD, getState, setState, normalize, hudOf, STATE } from "./state.js";
import { ADVENTURES, placeOf } from "./beats.js";

const $ = (id) => document.getElementById(id);
let state = normalize();
let ready = false;
let beat = null;      // id поточного моменту
let grade = false;    // кольорокорекція
let busy = false;     // щоб подвійний клік не запускав перехід двічі
let adv = ADVENTURES[0];   // пригода відкритої сцени
let timer = hudOf();  // таймер раундів і лічильник прориву

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    $("player").hidden = false;
    return;
  }
  $("gm").hidden = false;
  build();

  OBR.scene.onReadyChange((r) => { ready = r; if (r) load(); else draw(); });
  OBR.scene.onMetadataChange((m) => { state = normalize(m[STATE]); beat = m[BEAT] ?? null; grade = Boolean(m[GRADE_ON]); timer = hudOf(m[HUD]); draw(); });
  OBR.scene.items.onChange(() => report());
  ready = await OBR.scene.isReady();
  if (ready) await load();
  draw();
});

async function load() {
  state = await getState();
  const meta = await OBR.scene.getMetadata();
  beat = meta[BEAT] ?? null;
  grade = Boolean(meta[GRADE_ON]);
  timer = hudOf(meta[HUD]);
  await report();
  draw();
}

// Мапи пригоди в поточній сцені: ключ → елемент. Шукаємо за назвою.
function match(adventure, images) {
  const found = {};
  for (const [key, part] of Object.entries(adventure.maps)) {
    const hit = images.find((i) => i.name.toLowerCase().includes(part));
    if (hit) found[key] = hit;
  }
  return found;
}

const sceneMaps = () => OBR.scene.items.getItems((i) => i.layer === "MAP" && i.type === "IMAGE");

async function findMaps() {
  return match(adv, await sceneMaps());
}

// Пригода сцени — та, чиїх мап у ній найбільше. Якщо змінилась, перебудовуємо список моментів.
async function detect() {
  const images = await sceneMaps();
  let best = ADVENTURES[0];
  let most = -1;
  for (const a of ADVENTURES) {
    const n = Object.keys(match(a, images)).length;
    if (n > most) { most = n; best = a; }
  }
  if (best !== adv || !$("beats").children.length) {
    adv = best;
    buildBeats();
  }
}

// Підказка під пультом: чи всі мапи на місці
async function report() {
  if (!ready) { $("found").textContent = ""; return; }
  await detect();
  const found = await findMaps();
  const missing = Object.keys(adv.maps).filter((k) => !found[k]);
  $("adv").textContent = adv.name;
  $("found").textContent = missing.length
    ? `У цій сцені бракує мап: ${missing.map((k) => adv.maps[k]).join(", ")}`
    : "Усі мапи пригоди на місці.";
  for (const b of $("beats").children) {
    b.disabled = !found[adv.beats.find((x) => x.id === b.dataset.id).map];
  }
  draw();
}

// Один клік: усім сигнал на затемнення, під ним — потрібна мапа нагору, чужі місця сховати,
// погода; далі в кожного сама наводиться камера, проявляється картинка й виходить титр.
async function go(next) {
  if (!ready || busy || !next) return;
  busy = true;
  try {
    const found = await findMaps();
    const target = found[next.map];
    if (!target) return;
    const place = placeOf(adv, next.map);
    const top = Date.now();

    // Межі рахує майстер і шле готовими: гравець сховану мапу не бачить.
    const bounds = await OBR.scene.items.getItemBounds([target.id]);
    await OBR.broadcast.sendMessage(CUT, { min: bounds.min, max: bounds.max, big: next.big, small: next.small }, { destination: "ALL" });
    await new Promise((r) => setTimeout(r, 850));   // чекаємо, поки екран потемніє

    await OBR.scene.items.updateItems(Object.values(found), (drafts) => {
      for (const d of drafts) {
        const key = Object.keys(found).find((k) => found[k].id === d.id);
        d.visible = adv.places[place].includes(key);
        if (d.id === target.id) d.zIndex = top;
      }
    });

    await OBR.scene.grid.setOpacity(next.grid ?? 0.15);
    state = fromPreset(PRESETS.find((p) => p.id === next.mood) ?? PRESETS[0]);
    beat = next.id;
    draw();
    await OBR.scene.setMetadata({ [STATE]: state, [BEAT]: beat });
    await new Promise((r) => setTimeout(r, 1800));   // не даємо запустити наступний перехід, поки цей не проявився
  } finally {
    busy = false;
  }
}

// Настрій із готового набору: усе, крім службових полів
function fromPreset(p) {
  const { id, name, ...values } = p;
  return normalize({ preset: id, ...values });
}

function step(by) {
  const at = adv.beats.findIndex((b) => b.id === beat);
  const to = at < 0 ? 0 : Math.min(adv.beats.length - 1, Math.max(0, at + by));
  if (to !== at) go(adv.beats[to]);
}

// Список моментів поточної пригоди
function buildBeats() {
  $("beats").replaceChildren();
  adv.beats.forEach((b, n) => {
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
}

// Зміна таймера чи лічильника: одразу в метадані сцени, вікно в гравців перемалюється само
function setTimer(patch) {
  if (!ready) return;
  timer = { ...timer, ...patch };
  draw();
  OBR.scene.setMetadata({ [HUD]: timer });
}

const clamp = (n, max) => Math.max(0, Math.min(max, n));

function build() {
  buildBeats();
  $("hud-on").onchange = () => setTimer({ on: $("hud-on").checked });
  $("hud-reset").onclick = () => setTimer({ rounds: 10, ok: 0, fail: 0 });
  for (const [key, max] of [["rounds", 99], ["ok", 5], ["fail", 3]]) {
    $(`${key}-less`).onclick = () => setTimer({ [key]: clamp(timer[key] - 1, max) });
    $(`${key}-more`).onclick = () => setTimer({ [key]: clamp(timer[key] + 1, max) });
  }
  $("prev").onclick = () => step(-1);
  $("next").onclick = () => step(1);

  for (const p of PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.id = p.id;
    b.textContent = p.name;
    b.onclick = () => save(fromPreset(p));
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

  $("grade").onchange = () => { if (ready) OBR.scene.setMetadata({ [GRADE_ON]: $("grade").checked }); };

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
  $("grade").checked = grade;
  $("grade").disabled = !ready;
  const at = adv.beats.findIndex((b) => b.id === beat);
  $("prev").disabled = !ready || at <= 0;
  $("next").disabled = !ready || at === adv.beats.length - 1;
  $("hud-on").checked = timer.on;
  $("hud-on").disabled = !ready;
  for (const key of ["rounds", "ok", "fail"]) $(key).textContent = String(timer[key]);
  for (const input of $("sliders").querySelectorAll("input")) {
    input.value = String(Math.round((state[input.dataset.key] ?? 0) * 100));
    input.disabled = !ready;
  }
}
