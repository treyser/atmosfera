// Вікно майстра: пульт режисера, вибір настрою, повзунки, титр.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { PRESETS, SLIDERS, TITLE, BEAT, GRADE_ON, HUD, ATLAS, MAP, JOURNAL, MUSIC, HUSH, FATE, SHOP, BEST, RUNE, STAR, CHEST, BOARD, GOAL, RUMOR, ARSENAL, COURT, SCENES, getState, setState, normalize, hudOf, STATE } from "./state.js";
import { getVotes, onVotes } from "./votes.js";
import { ADVENTURES } from "./beats.js";
import { sceneMaps, match, pick, fromPreset, travel } from "./director.js";
import { inbox } from "./notes.js";
import { addAll } from "./hoot.js";
import { TRACKS_VERSION } from "./tracks.js";
import { INBOX } from "./log.js";
import { cache, CACHE } from "./best-data.js";
import { SOUNDS, DIRS, playSecret } from "./sfx.js";

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
    // відкрита крамниця — кнопка в панелі
    const shopBtn = (m) => {
      const s = m[SHOP] ?? {};
      $("crew-shop").hidden = !s.open;
      $("crew-shop-sub").textContent = s.open ? `«${s.name}» відчинена` : "";
    };
    OBR.room.onMetadataChange(shopBtn);
    shopBtn(await OBR.room.getMetadata());
    $("crew-shop").onclick = openShop;
    $("crew-best").onclick = openBest;
    $("crew-runes").onclick = openRunes;
    $("crew-board").onclick = openBoard;
    $("crew-goals").onclick = openGoals;
    $("crew-rumors").onclick = openRumors;
    $("crew-arsenal").onclick = openArsenal;
    $("crew-court").onclick = openCourt;
    $("crew-stars").onclick = openStars;
    const bestSub = () => {
      const n = Object.keys(cache(OBR.room.id).pages ?? {}).length;
      $("crew-best-sub").textContent = n ? `Записано істот: ${n}` : "Істоти, яких зустріли герої";
    };
    window.addEventListener("storage", (e) => { if (e.key === CACHE(OBR.room.id)) bestSub(); });
    bestSub();
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
  $("gm-shop").onclick = openShop;
  $("gm-best").onclick = openBest;
  $("gm-runes").onclick = openRunes;
  $("gm-stars").onclick = openStars;
  $("gm-board").onclick = openBoard;
  $("gm-goals").onclick = openGoals;
  $("gm-rumors").onclick = openRumors;
  $("gm-arsenal").onclick = openArsenal;
  $("gm-court").onclick = openCourt;
  $("gm-scenes").onclick = () => OBR.modal.open({ id: SCENES, url: url("scenes.html"), width: 1240, height: 840 });
  $("gm-chest").onclick = () => OBR.modal.open({ id: CHEST, url: url("chest.html"), width: 1000, height: 760 });
  const shopSub = (m) => {
    const s = m[SHOP] ?? {};
    $("gm-shop-sub").textContent = s.open ? `Відчинена для гравців: «${s.name}»` : "Вітрини торговців, ціни, пропозиції гравців";
    $("gm-shop").classList.toggle("ping", Boolean(s.open));
  };
  OBR.room.onMetadataChange(shopSub);
  OBR.room.getMetadata().then(shopSub);
  musicPanel();
  hushPanel();
  fatePanel();
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
  // Нові треки, яких Hoot у цьому браузері ще не бачив, — кнопка підсвічується
  const KEY = "atmosfera.hoot-tracks";
  const fresh = () => { try { return localStorage.getItem(KEY) !== TRACKS_VERSION; } catch { return true; } };
  const label = () => {
    $("mus-add").textContent = fresh() ? "Є нові треки — додати в Hoot" : "Додати треки «Атмосфери» в Hoot";
    $("mus-add").classList.toggle("ping", fresh());
  };
  label();
  $("mus-add").onclick = async () => {
    $("mus-add").disabled = true;
    $("mus-add").textContent = "Додаю…";
    await addAll();
    try { localStorage.setItem(KEY, TRACKS_VERSION); } catch { /* */ }
    $("mus-add").textContent = "Додано — перевір плейлисти в Hoot";
    setTimeout(() => { $("mus-add").disabled = false; label(); }, 4000);
  };
  show();
}

// Таємний звук: майстер обирає звук, напрямок і тих, хто пройшов перевірку; чують лише вони
function hushPanel() {
  let sound = SOUNDS[0].k;
  let dir = "front";
  const picked = new Set();
  const mark = (box, key) => { for (const b of $(box).children) b.classList.toggle("on", b.dataset.k === key); };

  for (const s of SOUNDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = s.k;
    b.title = s.hear;
    b.innerHTML = "<i></i><span></span>";
    b.querySelector("i").textContent = s.icon;
    b.querySelector("span").textContent = s.name;
    b.onclick = () => { sound = s.k; mark("hush-sounds", sound); };
    $("hush-sounds").append(b);
  }
  for (const d of DIRS) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.k = d.k;
    b.textContent = d.name;
    b.onclick = () => { dir = d.k; mark("hush-dirs", dir); };
    $("hush-dirs").append(b);
  }
  mark("hush-sounds", sound);
  mark("hush-dirs", dir);

  const who = async () => {
    const players = await OBR.party.getPlayers();
    for (const id of [...picked]) if (!players.some((p) => p.id === id)) picked.delete(id);
    $("hush-who").replaceChildren(...(players.length ? players.map((p) => {
      const l = document.createElement("label");
      l.className = picked.has(p.id) ? "on" : "";
      l.innerHTML = '<input type="checkbox"><i></i><span></span>';
      l.querySelector("i").style.setProperty("--c", p.color);
      l.querySelector("span").textContent = p.name;
      const box = l.querySelector("input");
      box.checked = picked.has(p.id);
      box.onchange = () => { if (box.checked) picked.add(p.id); else picked.delete(p.id); l.classList.toggle("on", box.checked); };
      return l;
    }) : [Object.assign(document.createElement("div"), { className: "empty", textContent: "У кімнаті немає гравців" })]));
  };
  OBR.party.onChange(who);
  who();

  $("hush-try").onclick = () => playSecret(sound, dir);
  $("hush-send").onclick = async () => {
    if (!picked.size) { $("hush-note").textContent = "Спершу позначте, хто почув."; return; }
    const players = await OBR.party.getPlayers();
    const names = players.filter((p) => picked.has(p.id)).map((p) => p.name);
    await OBR.broadcast.sendMessage(HUSH, { to: [...picked], s: sound, dir, t: $("hush-text").value.trim().slice(0, 120) }, { destination: "REMOTE" });
    $("hush-note").textContent = `Почули: ${names.join(", ")}. Решта нічого не помітила.`;
    // після надсилання — чистий аркуш для наступної перевірки
    picked.clear();
    $("hush-text").value = "";
    who();
  };
}

// Кидок долі: d20 бачить лише майстер, гравцям — анімація кубика й настрій
function fatePanel() {
  const NAMES = { crit: "доля усміхається", good: "вдача", bad: "невдача", fumble: "доля відвернулася" };
  const log = [];
  $("fate-roll").onclick = async () => {
    const dc = Math.max(2, Math.min(20, Number($("fate-dc").value) || 11));
    const n = 1 + Math.floor(Math.random() * 20);
    const tier = n === 20 ? "crit" : n === 1 ? "fumble" : n >= dc ? "good" : "bad";
    const q = $("fate-q").value.trim().slice(0, 80);
    log.unshift({ n, dc, tier, q, show: $("fate-show").checked });
    log.length = Math.min(log.length, 5);
    $("fate-log").replaceChildren(...log.map((x) => {
      const row = document.createElement("div");
      row.className = x.tier;
      row.innerHTML = "<b></b><span></span>";
      row.querySelector("b").textContent = String(x.n);
      row.querySelector("span").textContent = `${NAMES[x.tier]} · поріг ${x.dc}${x.q ? ` · ${x.q}` : ""}${x.show ? "" : " · потай"}`;
      return row;
    }));
    if ($("fate-show").checked) await OBR.broadcast.sendMessage(FATE, { tier, q }, { destination: "ALL" });
  };
}

function openShop() {
  return OBR.modal.open({ id: SHOP, url: url("shop.html"), width: 1180, height: 760 });
}

function openArsenal() {
  return OBR.modal.open({ id: ARSENAL, url: url("arsenal.html"), width: 1180, height: 780 });
}

function openCourt() {
  return OBR.modal.open({ id: COURT, url: url("court.html"), width: 1180, height: 800 });
}

function openRumors() {
  return OBR.modal.open({ id: RUMOR, url: url("rumors.html"), width: 1180, height: 780 });
}

function openGoals() {
  return OBR.modal.open({ id: GOAL, url: url("goals.html"), width: 1000, height: 700 });
}

function openBoard() {
  return OBR.modal.open({ id: BOARD, url: url("board.html"), fullScreen: true });
}

function openStars() {
  return OBR.modal.open({ id: STAR, url: url("stars.html"), width: 1280, height: 800 });
}

function openRunes() {
  return OBR.modal.open({ id: RUNE, url: url("runes.html"), width: 1180, height: 780 });
}

function openBest() {
  return OBR.modal.open({ id: BEST, url: url("bestiary.html"), width: 1180, height: 780 });
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
