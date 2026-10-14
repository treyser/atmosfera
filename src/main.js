// Вікно майстра: пульт режисера, вибір настрою, повзунки, титр.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { PRESETS, SLIDERS, TITLE, BEAT, GRADE_ON, HUD, ATLAS, MAP, JOURNAL, MUSIC, getState, setState, normalize, hudOf, STATE } from "./state.js";
import { getVotes, onVotes } from "./votes.js";
import { ADVENTURES } from "./beats.js";
import { sceneMaps, match, pick, fromPreset, travel } from "./director.js";
import { inbox } from "./notes.js";
import { addAll } from "./hoot.js";
import { INBOX } from "./log.js";

const $ = (id) => document.getElementById(id);
const url = (p) => new URL(import.meta.env.BASE_URL + p, window.location.origin).href;
let state = normalize();
let ready = false;
let beat = null;      // id поточного моменту
let grade = false;    // кольорокорекція
let adv = ADVENTURES[0];   // пригода відкритої сцени
let timer = hudOf();  // таймер раундів і лічильник прориву

OBR.onReady(async () => {
  const role = await OBR.player.getRole();
  if (role !== "GM") {
    $("player").hidden = false;
    $("crew-map").onclick = () => OBR.modal.open({ id: MAP, url: url("map.html"), width: 1280, height: 860 });
    $("crew-log").onclick = openJournal;
    // Нерозпечатані листи — видно просто на кнопці
    const mail = () => {
      const n = inbox().filter((x) => !x.read).length;
      $("crew-log-sub").textContent = n ? `Нерозпечатаних листів: ${n}` : "Записи плавання й твої листи";
      $("crew-log").classList.toggle("ping", n > 0);
    };
    window.addEventListener("storage", (e) => { if (e.key === INBOX) mail(); });
    mail();
    return;
  }
  // Скільки гравців уже запропонували курс — видно просто на кнопці Атласу
  const count = async () => {
    const n = (await getVotes()).length;
    $("atlas-sub").textContent = n ? `51 точка · пропозицій гравців: ${n}` : "51 точка на мапі світу";
    $("atlas").classList.toggle("ping", n > 0);
  };
  onVotes(count);
  count();
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

async function findMaps() {
  return match(adv, await sceneMaps(), false);
}

// Пригода сцени — та, чиїх мап у ній найбільше. Якщо змінилась, перебудовуємо список моментів.
async function detect() {
  const best = pick(await sceneMaps());
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

// Один клік — перехід до моменту (сама логіка — у director.js, спільна з Атласом)
async function go(next) {
  if (!ready || !next) return;
  const was = beat;
  beat = next.id;
  draw();
  if (!(await travel(next, adv))) { beat = was; draw(); }
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
  $("atlas").onclick = () => OBR.modal.open({ id: ATLAS, url: url("atlas.html"), width: 1280, height: 860 });
  $("gm-log").onclick = openJournal;
  musicPanel();
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

// Музика через Hoot: налаштування лежать у кімнаті, а вмикає треки фоновий скрипт майстра
async function musicPanel() {
  let music = (await OBR.room.getMetadata())[MUSIC] ?? {};
  const NAMES = { battle: "бойова музика", boss: "музика боса", silence: "тиша" };
  const show = () => {
    $("mus-auto").checked = Boolean(music.auto);
    $("mus-sea").checked = music.sea !== false;
    for (const k of ["battle", "boss"]) $(`mus-${k}`).classList.toggle("on", music.override === k);
    $("mus-quiet").classList.toggle("on", music.override === "silence");
    $("mus-now").textContent = music.override
      ? `Зараз: ${NAMES[music.override]}. Натисни ту саму кнопку ще раз, щоб повернутись до музики настрою.`
      : music.auto ? "Музика змінюється разом із настроєм сцени." : "Автоматика вимкнена — Hoot у твоїх руках.";
  };
  const save = (patch) => { music = { ...music, ...patch }; show(); OBR.room.setMetadata({ [MUSIC]: music }); };
  OBR.room.onMetadataChange((m) => { music = m[MUSIC] ?? {}; show(); });
  $("mus-auto").onchange = () => save({ auto: $("mus-auto").checked });
  $("mus-sea").onchange = () => save({ sea: $("mus-sea").checked });
  $("mus-battle").onclick = () => save({ override: music.override === "battle" ? null : "battle" });
  $("mus-boss").onclick = () => save({ override: music.override === "boss" ? null : "boss" });
  $("mus-quiet").onclick = () => save({ override: music.override === "silence" ? null : "silence" });
  $("mus-add").onclick = async () => {
    $("mus-add").disabled = true;
    $("mus-add").textContent = "Додаю…";
    await addAll();
    $("mus-add").textContent = "Додано — перевір плейлисти в Hoot";
    setTimeout(() => { $("mus-add").disabled = false; $("mus-add").textContent = "Додати треки «Атмосфери» в Hoot"; }, 4000);
  };
  show();
}

function openJournal() {
  return OBR.modal.open({ id: JOURNAL, url: url("journal.html"), width: 1100, height: 820 });
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
