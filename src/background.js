// Тримає екранні ефекти відповідно до настрою сцени, грає переходи між моментами і показує титри.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { ID, STATE, GRADE_ON, TITLE, CUT, CARD, HUD, ATLAS, VISITED, MAP, VOTE_RESET, HERE, ROUTE, VOYAGE, LOG_ADD, LOG_DEL, LOG_PUSH, LOG_DROP, LOG_ALL, LOG_REQ, NOTE, NOTE_ACK, TUNE, HEARD, RIDDLE, RIDDLE_OPEN, RIDDLE_TAP, MUSIC, HUSH, NPC, NPC_CARD, FATE, FATE_CARD, SHOP, SHOP_DATA, SHOP_REQ, SHOP_BUY, SHOP_SOLD, SHOP_OFFER, SHOP_DEAL, BEST, BEST_REQ, BEST_DATA, BEST_SHOW, RUNE, RUNE_REQ, RUNE_DATA, RUNE_SHOW, STAR, STAR_REQ, STAR_LINE, STAR_STATE, CHEST, CHEST_REQ, CHEST_DATA, CHEST_TRY, CHEST_TAKE, CHEST_SPLIT, CHEST_GOT, CHEST_SHOW, BOARD, BOARD_OP, BOARD_REQ, BOARD_FULL, BOARD_SHOW, GOAL, GOAL_DATA, GOAL_REQ, GOAL_CLAIM, RUMOR, RUMOR_DATA, RUMOR_REQ, RUMOR_TELL, RUMOR_VOTE, ARSENAL, ARSENAL_REQ, ARSENAL_DATA, ARSENAL_SHOW, ARSENAL_GIVE, COURT, COURT_REQ, COURT_DATA, COURT_SHOW, COURT_RATE, ACQ_REQ, ACQ_DATA, ACQ_DEL, CHOICE, normalize, isClear, hudOf } from "./state.js";
import { appendLog, removeLog, sendAll, migrate, takeAll, book, saveLocal, BOOK, MAX_TEXT } from "./log.js";
import { receiveNote, noteAck, resendNotes } from "./notes.js";
import { setVote } from "./votes.js";
import { travel } from "./director.js";
import { SKSL, GRADE } from "./shader.js";
import { whistleNotes, audio } from "./synth.js";
import { FRAGMENTS, ANSWER } from "./melody.js";
import { routeStats } from "./route.js";
import { daysBetween } from "./atlas-points.js";
import { setTarget, targetForMood } from "./hoot.js";
import { startZones } from "./zones.js";
import { startTraps } from "./traps.js";
import { playSecret, soundOf, dirOf, preload } from "./sfx.js";
import { shops, saveShops, syncShops, OFFERS, SEEN, priceCp, money, changeSheet, addGear, takeGear, SHEET_PUSH, owner } from "./shop-data.js";
import { local } from "./log.js";
import { mergeCache, packPages, FOCUS, syncBestiary } from "./best-data.js";
import { packState, seenState, saveSeen, news, RFOCUS } from "./runes-data.js";
import { skyState, saveSky, skySeen, saveSkySeen, applyLine, constOf, dirName } from "./stars-data.js";
import { chestOf, putChest, newChest, publicView, coinCp, fromCp } from "./chest-data.js";
import { boards, saveBoards, publicList, chunks, apply as applyBoard, seenBoards, saveSeenBoards } from "./board-data.js";
import { allGoals, saveAll as saveGoals, forPlayer, myGoals, saveMine as saveMyGoals, owner as goalOwner } from "./goal-data.js";
import { rumors, saveRumors, forPlayers as rumorsForPlayers, saveHeard } from "./rumor-data.js";
import { pack as packData } from "./trap-data.js";
import { startNpcAi } from "./npc-ai.js";
import { startTriggers } from "./trig-run.js";
import { pack as packTrap } from "./trap-data.js";
import { introduce, mergeAcq, acqList, saveAcq, setWhere, keyOf } from "./acq-data.js";
import { lady, loadCourt, opened as courtOpened, saveSeen as saveCourtSeen, seen as courtSeen, rates as courtRates, saveRates as saveCourtRates, applyRate, pack as packCourt, FOCUS as CFOCUS } from "./court-data.js";
import { weapon, loadArsenal, opened, saveSeen as saveArsenalSeen, seen as arsenalSeen, FOCUS as AFOCUS, gearOf } from "./arsenal-data.js";

const BASE = import.meta.env.BASE_URL;
const url = (p) => new URL(BASE + p, window.location.origin).href;

const EFFECT = `${ID}/effect`;   // позначка ефекту поверх сцени (погода, плівка, затемнення, смуги)
const POST = `${ID}/post`;       // позначка ефекту кольорокорекції
const SHOW_MS = 12000;           // запасне закриття титру: зазвичай він закриває себе сам

let mood = normalize();          // настрій поточної сцени
let grade = false;               // чи ввімкнена кольорокорекція
const anim = { fade: 0, bars: 0 };   // затемнення і смуги: у кожного гравця свої, синхронізує їх лише сигнал

let cardTimer = null;
let timers = [];                 // відкладені кроки поточного переходу
let tweens = {};                 // активні плавні зміни anim
let ticker = null;
let hudShown = false;            // чи відкрите вікно таймера
let queue = Promise.resolve();   // щоб два оновлення ефекту не створили його двічі

OBR.onReady(async () => {
  // Зони: ПКМ на намальованій фігурі → «Зона» (лише майстер); ефекти малює кожен клієнт у себе
  try {
    OBR.contextMenu.create({
      id: `${ID}/zone-menu`,
      icons: [{
        icon: url("zone.svg"),
        label: "Зона",
        // умови в some за замовчуванням з'єднуються через «і» — тут потрібне «або»
        filter: { roles: ["GM"], some: [
          { key: "type", value: "SHAPE", coordinator: "||" },
          { key: "type", value: "CURVE", coordinator: "||" },
          { key: "type", value: "PATH" },
        ] },
      }],
      embed: { url: url("zone.html"), height: 250 },
    });
  } catch (err) { console.error("Зони: меню не зареєструвалось", err); }
  startZones().catch((err) => console.error("Зони:", err));

  // Пастки: ПКМ на намальованій фігурі → «Пастка» (лише майстер)
  try {
    OBR.contextMenu.create({
      id: `${ID}/trap-menu`,
      icons: [{
        icon: url("trap.svg"),
        label: "Пастка",
        filter: { roles: ["GM"], max: 1, some: [
          { key: "type", value: "SHAPE", coordinator: "||" },
          { key: "type", value: "CURVE", coordinator: "||" },
          { key: "type", value: "PATH" },
        ] },
      }],
      embed: { url: url("trap.html"), height: 470 },
    });
  } catch (err) { console.error("Пастки: меню не зареєструвалось", err); }
  startTraps(url).catch((err) => console.error("Пастки:", err));

  // Картка персонажа: ПКМ на токені → «Представити» (лише майстер)
  try {
    OBR.contextMenu.create({
      id: `${ID}/npc-menu`,
      icons: [{
        icon: url("npc.svg"),
        label: "Представити",
        filter: { roles: ["GM"], max: 1, every: [{ key: "type", value: "IMAGE" }] },
      }],
      embed: { url: url("npc-menu.html"), height: 150 },
    });
  } catch (err) { console.error("Картка персонажа: меню не зареєструвалось", err); }
  // «Живі» NPC: ПКМ на токені(ах) → «Поведінка» (лише майстер)
  try {
    OBR.contextMenu.create({
      id: `${ID}/ai-menu`,
      icons: [{ icon: url("ai.svg"), label: "Поведінка NPC", filter: { roles: ["GM"], every: [{ key: "type", value: "IMAGE" }, { key: "layer", value: "CHARACTER" }] } }],
      embed: { url: url("npc-ai.html"), height: 430 },
    });
  } catch (err) { console.error("Живі NPC: меню не зареєструвалось", err); }
  startNpcAi().catch((err) => console.error("Живі NPC:", err));
  startTriggers().catch((err) => console.error("Тригери:", err));
  // вибір із блупрінта: вікно з кнопками в тих, кого питають
  OBR.broadcast.onMessage(CHOICE, async (event) => {
    const d = event.data ?? {};
    if ((await OBR.player.getRole()) === "GM") return;
    if (d.close) {
      await OBR.popover.close(`${CHOICE}-win`).catch(() => {});
      if (d.pick) OBR.notification.show(`${d.who ?? "Хтось"} вибирає: «${d.pick}»`).catch(() => {});
      return;
    }
    if (Array.isArray(d.to) && !d.to.includes(await OBR.player.getId())) return;
    const w = await OBR.viewport.getWidth();
    await OBR.popover.close(`${CHOICE}-win`).catch(() => {});
    OBR.popover.open({
      id: `${CHOICE}-win`, url: url(`choice.html?d=${encodeURIComponent(packTrap(d))}`), width: Math.min(520, w - 40), height: 120 + Math.ceil((d.opts?.length ?? 1) / 2) * 52 + Math.ceil(String(d.text ?? "").length / 42) * 28,
      anchorReference: "POSITION", anchorPosition: { top: 90, left: w / 2 },
      anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
      hidePaper: true, disableClickAway: true, marginThreshold: 0,
    }).catch(() => {});
  });
  OBR.broadcast.onMessage(NPC, (event) => { showNpc(event.data); meet(event.data); });
  startAcq().catch((err) => console.error("Записник знайомств:", err));
  OBR.broadcast.onMessage(FATE, (event) => showFate(event.data));
  startShop().catch((err) => console.error("Крамниця:", err));
  startBestiary().catch((err) => console.error("Бестіарій:", err));
  startRunes().catch((err) => console.error("Руни:", err));
  startStars().catch((err) => console.error("Зоряне небо:", err));
  startChests().catch((err) => console.error("Скрині:", err));
  startBoards().catch((err) => console.error("Дошка:", err));
  startGoals().catch((err) => console.error("Таємні цілі:", err));
  startRumors().catch((err) => console.error("Чутки:", err));
  startArsenal().catch((err) => console.error("Арсенал:", err));
  startCourt().catch((err) => console.error("Оксамитова книга:", err));

  OBR.scene.onReadyChange((ready) => { if (ready) refresh(); else hud(false); });
  OBR.scene.onMetadataChange((m) => { mood = normalize(m[STATE]); grade = Boolean(m[GRADE_ON]); sync(); hud(hudOf(m[HUD]).on); });
  if (await OBR.scene.isReady()) refresh();

  OBR.broadcast.onMessage(TITLE, (event) => titleOnly(event.data));
  OBR.broadcast.onMessage(CUT, (event) => cut(event.data));

  // «Пливемо сюди» з Атласу: вікно Атласу закривається одразу, а перехід веде фоновий скрипт майстра
  OBR.broadcast.onMessage(ATLAS, async (event) => {
    if ((await OBR.player.getRole()) !== "GM") return;
    const p = event.data;
    if (!p?.map) return;
    // Подія в дорозі: лише перехід на палубу з погодою й титром, маршрут не змінюється
    if (p.kind === "event") {
      if ((await travel({ id: "atlas-event", map: p.map, mood: p.mood, big: p.big, small: p.small })) && p.log) await appendLog(p.log);
      return;
    }
    if (!(await travel({ id: `atlas-${p.n}`, map: p.map, mood: p.mood, big: p.big, small: p.small }))) return;
    if (p.log) appendLog(p.log);
    const room = await OBR.room.getMetadata();
    const seen = new Set(room[VISITED] ?? []);
    seen.add(p.n);
    // Маршрут: якщо ще не почато, першою точкою стає та, звідки пливли
    let route = [...(room[ROUTE] ?? [])];
    if (!route.length && room[HERE] && room[HERE] !== p.n) route.push(room[HERE]);
    if (route.at(-1) !== p.n) route.push(p.n);
    await OBR.room.setMetadata({ [VISITED]: [...seen].sort((a, b) => a - b), [HERE]: p.n, [ROUTE]: route, [VOYAGE]: null });
    // Допливли — старі пропозиції більше не актуальні
    await OBR.broadcast.sendMessage(VOTE_RESET, {}, { destination: "ALL" });
  });

  // Майстер відкриває гравцям мапу світу; кожен знімає свою пропозицію за сигналом
  OBR.broadcast.onMessage(MAP, () => openMap());
  OBR.broadcast.onMessage(VOTE_RESET, () => setVote(null).catch(() => {}));

  // Корабельний журнал: записує лише фоновий скрипт майстра, гравці надсилають рядки сюди
  const gm = (await OBR.player.getRole()) === "GM";
  OBR.broadcast.onMessage(LOG_ADD, async (event) => {
    if ((await OBR.player.getRole()) !== "GM") return;
    const e = event.data ?? {};
    const t = String(e.t ?? "").trim().slice(0, MAX_TEXT);
    if (!t) return;
    await appendLog({ k: e.k === "g" ? "g" : "p", t, w: String(e.w ?? "").slice(0, 40), c: e.c, u: e.u, d: e.d });
  });
  OBR.broadcast.onMessage(LOG_DEL, async (event) => {
    if ((await OBR.player.getRole()) !== "GM") return;
    const { i, u } = event.data ?? {};
    if (i) await removeLog(i, u ?? null);
  });
  OBR.broadcast.onMessage(LOG_REQ, async () => {
    if ((await OBR.player.getRole()) === "GM") await sendAll();
  });
  // У гравців — копія журналу в браузері: вікно журналу читає її і чує зміни
  OBR.broadcast.onMessage(LOG_PUSH, (event) => {
    const e = event.data;
    if (e?.i && !book().some((x) => x.i === e.i)) saveLocal(BOOK, [...book(), e]);
  });
  OBR.broadcast.onMessage(LOG_DROP, (event) => saveLocal(BOOK, book().filter((x) => x.i !== event.data?.i)));
  OBR.broadcast.onMessage(LOG_ALL, (event) => takeAll(event.data, (list) => { saveLocal(BOOK, list); saveLocal(`${BOOK}.sync`, Date.now()); }));
  if (gm) migrate().catch(() => {});

  // Запечатані листи: кожен перевіряє, чи лист йому; майстер стежить, хто отримав і хто розпечатав
  OBR.broadcast.onMessage(NOTE, (event) => receiveNote(event.data));
  OBR.broadcast.onMessage(NOTE_ACK, async (event) => {
    if ((await OBR.player.getRole()) === "GM") noteAck(event.data);
  });
  // Хтось зайшов у кімнату — дошлемо листи, які йому ще не дійшли
  OBR.party.onChange(async (players) => {
    if ((await OBR.player.getRole()) === "GM") resendNotes(players);
  });
  if (gm) resendNotes(await OBR.party.getPlayers());

  // Таємний звук: грає лише в тих, кого обрав майстер; інші навіть не знають, що щось було
  const myId = await OBR.player.getId();
  if (!gm) setTimeout(preload, 15000);   // гравці тихенько завантажують записи заздалегідь
  OBR.broadcast.onMessage(HUSH, (event) => {
    const d = event.data ?? {};
    if (!Array.isArray(d.to) || !d.to.includes(myId)) return;
    playSecret(d.s, d.dir);
    const text = d.t ? d.t : `${soundOf(d.s).hear} — ${dirOf(d.dir).say}`;
    OBR.notification.show(`🔉 ${text} (це помітили лише ви)`).catch(() => {});
  });

  // --- Мелодія Маркуса: кожен чує свист у себе; майстер запам'ятовує, які уривки вже звучали ---
  OBR.broadcast.onMessage(TUNE, async (event) => {
    const d = event.data ?? {};
    const frags = d.all ? [0, 1, 2] : (d.frags ?? []).filter((k) => FRAGMENTS[k]);
    if (!frags.length) return;
    audio();
    whistleNotes(frags.flatMap((k) => FRAGMENTS[k]));
    OBR.notification.show(d.all ? "♪ Маркус насвистує свою мелодію…" : "♪ Десь звучить знайома мелодія…").catch(() => {});
    if ((await OBR.player.getRole()) !== "GM" || d.all) return;
    const room = await OBR.room.getMetadata();
    const heard = new Set(room[HEARD] ?? []);
    const fresh = frags.filter((k) => !heard.has(k));
    if (!fresh.length) return;
    for (const k of fresh) heard.add(k);
    await OBR.room.setMetadata({ [HEARD]: [...heard].sort() });
    const day = 1 + routeStats(room[ROUTE] ?? [], daysBetween).days;
    for (const k of fresh) await appendLog({ k: "m", n: k + 1, d: day });
  });

  // --- Загадка Ребер Велетня ---
  OBR.broadcast.onMessage(RIDDLE_OPEN, (event) => {
    if (event.data?.open) OBR.modal.open({ id: RIDDLE, url: url("riddle.html"), width: 980, height: 720 }).catch(() => {});
    else OBR.modal.close(RIDDLE).catch(() => {});
  });
  // Хто б не торкнувся предмета, рахує лише майстер — щоб усі бачили одну й ту саму спробу
  let riddleQueue = Promise.resolve();
  OBR.broadcast.onMessage(RIDDLE_TAP, (event) => {
    riddleQueue = riddleQueue.then(async () => {
      if ((await OBR.player.getRole()) !== "GM") return;
      const { id, who, c, reset } = event.data ?? {};
      const room = await OBR.room.getMetadata();
      const s = room[RIDDLE] ?? { seq: [], fails: 0, solved: false, k: 0 };
      if (reset) { await OBR.room.setMetadata({ [RIDDLE]: { seq: [], fails: 0, solved: false, k: (s.k ?? 0) + 1, last: null } }); return; }
      if (s.solved || !id) return;
      const ok = ANSWER[s.seq.length] === id;
      const seq = ok ? [...s.seq, id] : [];
      const solved = ok && seq.length === ANSWER.length;
      const next = { seq, fails: (s.fails ?? 0) + (ok ? 0 : 1), solved, k: (s.k ?? 0) + 1, last: { id, who, c, ok } };
      await OBR.room.setMetadata({ [RIDDLE]: next });
      if (solved) {
        const day = 1 + routeStats(room[ROUTE] ?? [], daysBetween).days;
        await appendLog({ k: "r", t: "Ребра Велетня заграли мелодію Маркуса", d: day });
      }
    }).catch((err) => console.error("Загадка:", err));
  });

  // --- Музика через Hoot: лише майстер, за настроєм сцени або за кнопками в пульті ---
  if (gm) {
    let preset = null;
    let music = {};
    const follow = () => {
      if (music.override === "silence") return setTarget({ music: null, bg: [] });
      if (music.override) return setTarget({ ...targetForMood(preset, music.sea !== false), music: music.override });
      if (music.auto && preset) return setTarget(targetForMood(preset, music.sea !== false));
      // Автоматика вимкнена, а бій чи бос щойно скінчились — гасимо їхню музику, а не лишаємо грати
      return setTarget({ music: null, bg: [] });
    };
    music = (await OBR.room.getMetadata())[MUSIC] ?? {};
    OBR.room.onMetadataChange((m) => {
      const next = m[MUSIC] ?? {};
      if (JSON.stringify(next) === JSON.stringify(music)) return;
      music = next;
      follow();
    });
    const takeMood = (m) => {
      const p = normalize(m[STATE]).preset;
      if (p === preset) return;
      preset = p;
      if (music.auto || music.override) follow();   // без автоматики настрій музики не чіпає
    };
    OBR.scene.onMetadataChange(takeMood);
    if (await OBR.scene.isReady()) takeMood(await OBR.scene.getMetadata());
  }
});

async function refresh() {
  const m = await OBR.scene.getMetadata();
  mood = normalize(m[STATE]);
  grade = Boolean(m[GRADE_ON]);
  sync();
  hud(hudOf(m[HUD]).on);
}

function overlayUniforms() {
  const [x, y, z] = mood.tint;
  return [
    { name: "rain", value: mood.rain },
    { name: "snow", value: mood.snow },
    { name: "fog", value: mood.fog },
    { name: "flash", value: grade ? mood.flash * 0.4 : mood.flash },
    { name: "dark", value: mood.dark },
    { name: "amount", value: grade ? 0 : mood.amount },   // з корекцією тон дає вона сама
    { name: "tint", value: { x, y, z } },
    { name: "film", value: mood.film },
    { name: "fade", value: anim.fade },
    { name: "bars", value: anim.bars },
  ];
}

function gradeUniforms() {
  const [x, y, z] = mood.tint;
  return [
    { name: "sat", value: mood.sat },
    { name: "contrast", value: mood.contrast },
    { name: "sway", value: mood.sway },
    { name: "flash", value: mood.flash },
    { name: "amount", value: mood.amount },
    { name: "tint", value: { x, y, z } },
  ];
}

const sync = () => (queue = queue.then(apply).catch(() => {}));

// Ефекти локальні: кожен клієнт малює свої, а спільним є лише настрій у метаданих сцени.
async function apply() {
  if (!(await OBR.scene.isReady())) return;
  await keep(EFFECT, !isClear(mood) || anim.fade > 0 || anim.bars > 0, overlayUniforms, () =>
    buildEffect().effectType("VIEWPORT").sksl(SKSL).layer("POINTER"));   // найвищий шар: лягає і на туман війни
  await keep(POST, grade && !isClear(mood), gradeUniforms, () =>
    buildEffect().effectType("VIEWPORT").sksl(GRADE).layer("POST_PROCESS"));
}

// Створює, оновлює або прибирає один ефект
async function keep(mark, wanted, uniforms, make) {
  const mine = await OBR.scene.local.getItems((i) => i.metadata?.[mark]);
  if (!wanted) {
    if (mine.length) await OBR.scene.local.deleteItems(mine.map((i) => i.id));
    return;
  }
  if (mine.length) {
    await OBR.scene.local.updateItems(mine, (drafts) => {
      for (const d of drafts) d.uniforms = uniforms();
    });
    return;
  }
  const item = make().uniforms(uniforms()).locked(true).disableHit(true).metadata({ [mark]: true }).build();
  await OBR.scene.local.addItems([item]);
}

// --- плавні зміни затемнення і смуг ---

const ease = (t) => t * t * (3 - 2 * t);

function tween(key, to, ms) {
  tweens[key] = { from: anim[key], to, start: performance.now(), ms };
  if (ticker) return;
  sync();   // ефект має існувати, поки щось рухається
  ticker = setInterval(() => {
    const now = performance.now();
    for (const [k, t] of Object.entries(tweens)) {
      const p = Math.min(1, (now - t.start) / t.ms);
      anim[k] = t.from + (t.to - t.from) * ease(p);
      if (p >= 1) delete tweens[k];
    }
    OBR.scene.local.updateItems((i) => i.metadata?.[EFFECT], (drafts) => {
      for (const d of drafts) d.uniforms = overlayUniforms();
    }, true).catch(() => {});
    if (!Object.keys(tweens).length) {
      clearInterval(ticker);
      ticker = null;
      sync();   // прибрати ефект, якщо він більше не потрібен
    }
  }, 33);
}

function later(ms, fn) {
  timers.push(setTimeout(fn, ms));
}

function cancel() {
  timers.forEach(clearTimeout);
  timers = [];
}

// Перехід між моментами: затемнення, камера під ним, проявлення, титр, смуги геть.
function cut(data) {
  cancel();
  tween("fade", 1, 600);
  tween("bars", 1, 700);
  later(950, () => lookAt(data));
  later(1750, () => tween("fade", 0, 1200));
  const big = String(data?.big ?? "").trim();
  if (big) later(2500, () => showCard(data));
  later(big ? 8600 : 4200, () => tween("bars", 0, 1000));
}

// Титр без зміни моменту: смуги зʼїжджаються лише на нього
function titleOnly(data) {
  if (!String(data?.big ?? "").trim()) return;
  cancel();
  tween("bars", 1, 700);
  later(500, () => showCard(data));
  later(6600, () => tween("bars", 0, 1000));
}

// Наводить камеру цього гравця на показану мапу, з невеликим полем довкола.
async function lookAt(data) {
  const { min, max } = data ?? {};
  if (!min || !max) return;
  const pad = Math.max(max.x - min.x, max.y - min.y) * 0.02;
  const box = {
    min: { x: min.x - pad, y: min.y - pad },
    max: { x: max.x + pad, y: max.y + pad },
  };
  box.width = box.max.x - box.min.x;
  box.height = box.max.y - box.min.y;
  box.center = { x: (box.min.x + box.max.x) / 2, y: (box.min.y + box.max.y) / 2 };
  await OBR.viewport.animateToBounds(box);
}

async function showCard(data) {
  const big = String(data?.big ?? "").trim();
  if (!big) return;
  setWhere(big);   // записник знайомств: «де зустріли»
  const small = String(data?.small ?? "").trim();

  if (cardTimer) {
    clearTimeout(cardTimer);
    cardTimer = null;
    await OBR.popover.close(CARD).catch(() => {});   // міг уже закритись сам
  }

  // Текст кладемо в метадані гравця: адресу вікна Owlbear доповнює сам, тож на неї покладатись не можна.
  await OBR.player.setMetadata({ [CARD]: { big, small } });

  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);

  await OBR.popover.open({
    id: CARD,
    url: url("title.html"),
    width: Math.min(1100, w - 40),
    height: 220,
    anchorReference: "POSITION",
    anchorPosition: { top: h * 0.5, left: w / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });

  cardTimer = setTimeout(() => {
    cardTimer = null;
    OBR.popover.close(CARD).catch(() => {});
  }, SHOW_MS);
}

// Картка персонажа внизу ліворуч: дані — в метадані гравця, вікно саме їх прочитає
async function showNpc(data) {
  const name = String(data?.name ?? "").trim().slice(0, 40);
  if (!name) return;
  await OBR.popover.close(NPC).catch(() => {});
  await OBR.player.setMetadata({ [NPC_CARD]: { name, sub: String(data?.sub ?? "").slice(0, 60), img: String(data?.img ?? "") } });
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const width = Math.min(720, w - 40);
  await OBR.popover.open({
    id: NPC,
    url: url("npc.html"),
    width,
    height: 170,
    anchorReference: "POSITION",
    anchorPosition: { top: h - 200, left: 20 },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });
}

// --- Крамниця ---
// Майстер: тримає полиці (у своєму браузері), продає, приймає пропозиції.
// Гравець: отримує крамницю, а коли купівлю підтверджено — сам міняє свій лист персонажа.
async function startShop() {
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const myId = await OBR.player.getId();
  const room = OBR.room.id;
  const openShop = async () => {
    const m = (await OBR.room.getMetadata())[SHOP] ?? {};
    return m.open ? shops().find((s) => s.id === m.id) ?? null : null;
  };

  // гравці: крамниця приходить повідомленням і лежить у браузері
  OBR.broadcast.onMessage(SHOP_DATA, (event) => { if (event.data?.id) saveLocal(SEEN, event.data); });
  OBR.broadcast.onMessage(SHOP_REQ, async () => {
    if (!(await isGM())) return;
    const s = await openShop();
    if (s) OBR.broadcast.sendMessage(SHOP_DATA, s, { destination: "REMOTE" }).catch(() => {});
  });

  // майстер: продаж
  OBR.broadcast.onMessage(SHOP_BUY, async (event) => {
    if (!(await isGM())) return;
    const d = event.data ?? {};
    const reply = (msg) => OBR.broadcast.sendMessage(SHOP_SOLD, { to: d.to, ...msg }, { destination: "REMOTE" }).catch(() => {});
    const meta = (await OBR.room.getMetadata())[SHOP] ?? {};
    const list = shops();
    const shop = list.find((s) => s.id === d.sid);
    if (!meta.open || meta.id !== d.sid || !shop) return reply({ ok: false, why: "Крамниця вже зачинена" });
    const item = shop.items.find((i) => i.id === d.iid);
    if (!item) return reply({ ok: false, why: "Цього товару вже немає" });
    if (item.rarity === "trade") return reply({ ok: false, why: "Це не продається за гроші" });
    const limited = item.qty !== null && item.qty !== "" && item.qty !== undefined;
    if (limited && Number(item.qty) <= 0) return reply({ ok: false, why: "Хтось уже купив останній" });
    if (limited) item.qty = Number(item.qty) - 1;
    saveShops(list);
    const cp = priceCp(item, Number(meta.discount) || 0);
    reply({ ok: true, cp, item: { name: item.name, desc: item.desc, mech: item.mech } });
    OBR.broadcast.sendMessage(SHOP_DATA, shop, { destination: "REMOTE" }).catch(() => {});
    appendLog({ k: "g", t: `${d.who || "Хтось"} купує «${item.name}» у крамниці «${shop.name}» за ${money(cp)}.`, w: "Майстер" }).catch(() => {});
    OBR.notification.show(`${d.who}: купив «${item.name}» за ${money(cp)}`).catch(() => {});
  });

  // майстер: гравець пропонує щось продати
  OBR.broadcast.onMessage(SHOP_OFFER, async (event) => {
    if (!(await isGM())) return;
    const o = event.data ?? {};
    if (!o.oid || !o.name) return;
    saveLocal(OFFERS, [...local(OFFERS, []), o]);
    OBR.notification.show(`${o.who} пропонує продати «${o.name}»${o.ask ? ` за ${o.ask} зм` : ""} — див. «Крамниці» → «Пропозиції»`).catch(() => {});
  });

  // покупець: гроші й річ — у лист персонажа
  const pushSheet = (next) => {
    const id = owner();
    if (next && id) OBR.broadcast.sendMessage(SHEET_PUSH, { id, data: next.data, at: next.at }, { destination: "REMOTE" }).catch(() => {});
  };
  OBR.broadcast.onMessage(SHOP_SOLD, (event) => {
    const d = event.data ?? {};
    if (d.to !== myId || !d.ok) return;
    const next = changeSheet(room, (data, { pay }) => { pay(d.cp); addGear(data, d.item); });
    pushSheet(next);
    if (!next) OBR.notification.show(`Куплено «${d.item.name}», але листа персонажа тут немає — допиши в спорядження сам`).catch(() => {});
  });
  OBR.broadcast.onMessage(SHOP_DEAL, (event) => {
    const d = event.data ?? {};
    if (d.to !== myId || !d.ok) return;
    const next = changeSheet(room, (data, { earn }) => { if (takeGear(data, d.name)) earn(d.cp); });
    pushSheet(next);
  });

  // гравці: майстер відкрив крамницю — вітрина відкривається сама; зачинив — закривається
  if (!(await isGM())) {
    let shown = null;
    const follow = (m) => {
      const s = m[SHOP] ?? {};
      if (s.open && s.rev !== shown) {
        shown = s.rev;
        OBR.modal.open({ id: SHOP, url: url("shop.html"), width: 1180, height: 760 }).catch(() => {});
      } else if (!s.open && shown) {
        shown = null;
        OBR.modal.close(SHOP).catch(() => {});
      }
    };
    OBR.room.onMetadataChange(follow);
    const m0 = await OBR.room.getMetadata();
    if (m0[SHOP]?.open) shown = m0[SHOP].rev;   // уже відкрита — не вискакувати при вході, є кнопка в панелі
  }
}

// Бестіарій: майстер роздає сторінки, гравці зберігають їх у себе
async function startBestiary() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  if (await isGM()) { syncBestiary().catch(() => {}); syncShops().catch(() => {}); }
  const SAY = ["", "нова сторінка", "вивчено звички й слабкості", "переможено — відкрито бойові записи"];

  // майстер: гравець просить усе, що знає партія
  OBR.broadcast.onMessage(BEST_REQ, async () => {
    if (!(await isGM())) return;
    for (const msg of packPages(room)) await OBR.broadcast.sendMessage(BEST_DATA, msg, { destination: "REMOTE" }).catch(() => {});
  });

  // гравець: нові сторінки — у браузер і коротке сповіщення
  OBR.broadcast.onMessage(BEST_DATA, async (event) => {
    if (await isGM()) return;
    const fresh = mergeCache(room, event.data);
    if (event.data?.full) return;   // повний список приходить при вході — без сповіщень
    for (const f of fresh.slice(0, 3)) OBR.notification.show(`Бестіарій: «${f.name}» — ${SAY[f.lvl] ?? ""}`).catch(() => {});
  });

  // майстер показує сторінку — відкрити бестіарій на ній
  OBR.broadcast.onMessage(BEST_SHOW, async (event) => {
    if (await isGM()) return;
    try { localStorage.setItem(FOCUS, JSON.stringify({ id: event.data?.id, at: Date.now() })); } catch {}
    await OBR.modal.close(BEST).catch(() => {});
    OBR.modal.open({ id: BEST, url: url("bestiary.html"), width: 1180, height: 780 }).catch(() => {});
  });

  // гравець щойно зайшов — попросити свіжі сторінки
  if (!(await isGM())) setTimeout(() => OBR.broadcast.sendMessage(BEST_REQ, {}, { destination: "REMOTE" }).catch(() => {}), 4000);
}

// Руни й написи: майстер роздає стан, гравці зберігають і дізнаються про нове
async function startRunes() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  OBR.broadcast.onMessage(RUNE_REQ, async () => {
    if (!(await isGM())) return;
    OBR.broadcast.sendMessage(RUNE_DATA, packState(room), { destination: "REMOTE" }).catch(() => {});
  });
  let first = true;
  OBR.broadcast.onMessage(RUNE_DATA, async (event) => {
    if (await isGM() || !event.data) return;
    const prev = seenState(room);
    saveSeen(room, event.data);
    const quiet = first && !prev.insc?.length && !Object.keys(prev.runes ?? {}).length;   // перший раз — без шквалу сповіщень
    first = false;
    if (quiet) return;
    for (const line of news(prev, event.data).slice(0, 3)) OBR.notification.show(line).catch(() => {});
  });
  OBR.broadcast.onMessage(RUNE_SHOW, async (event) => {
    if (await isGM()) return;
    try { localStorage.setItem(RFOCUS, JSON.stringify({ tab: event.data?.tab, id: event.data?.id, at: Date.now() })); } catch {}
    await OBR.modal.close(RUNE).catch(() => {});
    OBR.modal.open({ id: RUNE, url: url("runes.html"), width: 1180, height: 780 }).catch(() => {});
  });
  if (!(await isGM())) setTimeout(() => OBR.broadcast.sendMessage(RUNE_REQ, {}, { destination: "REMOTE" }).catch(() => {}), 4500);
}

// Зоряне небо: майстер перевіряє лінії й роздає небо; гравцям воно відкривається само
async function startStars() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const send = (st) => OBR.broadcast.sendMessage(STAR_STATE, st, { destination: "REMOTE" }).catch(() => {});
  OBR.broadcast.onMessage(STAR_REQ, async () => { if (await isGM()) send(skyState(room)); });
  OBR.broadcast.onMessage(STAR_LINE, async (event) => {
    if (!(await isGM())) return;
    const st = skyState(room);
    if (!st.night.open) return;
    const fresh = applyLine(st, event.data);
    saveSky(room, st);
    send(st);
    for (const id of fresh) {
      const c = constOf(id), v = st.night.vis.find((x) => x.id === id);
      const where = `${dirName(v?.az ?? c.az).full}${v?.lead ? `, до №${v.lead}` : ""}`;
      OBR.notification.show(`Гравці знайшли сузір'я «${c.name}» — веде на ${where}`).catch(() => {});
      appendLog({ k: "g", t: `Зоряне небо: знайдено сузір'я «${c.name}» — веде на ${where}.`, w: "Майстер" }).catch(() => {});
    }
  });
  // гравці: зберегти небо; майстер відкрив — вікно відкривається само, закрив — закривається
  if (!(await isGM())) {
    let open = skySeen(room).night?.open ?? false;
    OBR.broadcast.onMessage(STAR_STATE, (event) => {
      const st = event.data;
      if (!st?.night) return;
      const prev = skySeen(room);
      saveSkySeen(room, st);
      for (const id of st.found ?? []) {
        if ((prev.found ?? []).includes(id)) continue;
        const c = constOf(id), v = st.night.vis.find((x) => x.id === id);
        if (c) OBR.notification.show(`Знайдено сузір'я «${c.name}» — веде на ${dirName(v?.az ?? c.az).full}${v?.lead ? `, до №${v.lead}` : ""}`).catch(() => {});
      }
      if (st.night.open && !open) OBR.modal.open({ id: STAR, url: url("stars.html"), width: 1280, height: 800 }).catch(() => {});
      if (!st.night.open && open) OBR.modal.close(STAR).catch(() => {});
      open = st.night.open;
    });
    setTimeout(() => OBR.broadcast.sendMessage(STAR_REQ, {}, { destination: "REMOTE" }).catch(() => {}), 5000);
  }
}

// Скрині: правий клік по токену; майстер (його фоновий скрипт) веде облік, хто що взяв
async function startChests() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const openWin = (id) => OBR.modal.open({ id: CHEST, url: url(`chest.html?c=${encodeURIComponent(id)}`), width: 1000, height: 760 }).catch(() => {});
  try {
    OBR.contextMenu.create({
      id: `${ID}/chest-open`,
      icons: [{ icon: url("chest.svg"), label: "Скриня", filter: { max: 1, every: [{ key: ["metadata", CHEST], value: undefined, operator: "!=" }] } }],
      onClick: (ctx) => { const id = ctx.items[0]?.metadata?.[CHEST]?.id; if (id) openWin(id); },
    });
    OBR.contextMenu.create({
      id: `${ID}/chest-make`,
      icons: [{ icon: url("chest.svg"), label: "Зробити скринею", filter: { roles: ["GM"], max: 1, every: [{ key: "type", value: "IMAGE" }, { key: ["metadata", CHEST], value: undefined }] } }],
      onClick: async (ctx) => {
        const it = ctx.items[0];
        if (!it) return;
        const c = putChest(newChest(it.name || "Скриня"));
        await OBR.scene.items.updateItems([it.id], (items) => { for (const x of items) x.metadata[CHEST] = { id: c.id }; });
        openWin(c.id);
      },
    });
  } catch (err) { console.error("Скрині: меню не зареєструвалось", err); }

  const send = (c) => OBR.broadcast.sendMessage(CHEST_DATA, publicView(c), { destination: "REMOTE" }).catch(() => {});
  OBR.broadcast.onMessage(CHEST_REQ, async (event) => {
    if (!(await isGM())) return;
    const c = chestOf(event.data?.id);
    if (c) send(c);
  });
  OBR.broadcast.onMessage(CHEST_TRY, async (event) => {
    if (!(await isGM())) return;
    const d = event.data ?? {};
    const c = chestOf(d.id);
    if (!c || c.state === "open") return c && send(c);
    if (!c.lock?.on) {
      c.state = "open"; c.tries = [];
      putChest(c); send(c);
      appendLog({ k: "g", t: `${d.who || "Хтось"} відкрив скриню «${c.name}».`, w: "Майстер" }).catch(() => {});
      return;
    }
    c.tries = [...(c.tries ?? []).filter((t) => t.who !== d.who), { who: d.who || "Хтось", how: d.how, at: Date.now() }];
    putChest(c);
    const how = { pick: "відмикає відмичками", break: "ламає замок", key: "каже, що має ключ" }[d.how] ?? "пробує відкрити";
    OBR.notification.show(`${d.who}: ${how} скрині «${c.name}» (СК ${c.lock.dc}) — відкрий «Скрині», щоб підтвердити`).catch(() => {});
  });
  OBR.broadcast.onMessage(CHEST_TAKE, async (event) => {
    if (!(await isGM())) return;
    const d = event.data ?? {};
    const c = chestOf(d.id);
    const it = c?.items.find((x) => x.id === d.iid);
    if (!c || c.state !== "open" || !it || it.by) return c && send(c);
    it.by = d.who || "Хтось";
    putChest(c);
    send(c);
    OBR.broadcast.sendMessage(CHEST_GOT, { to: d.to, item: { name: it.name, desc: it.desc, mech: it.mech } }, { destination: "REMOTE" }).catch(() => {});
    appendLog({ k: "g", t: `${it.by} бере зі скрині «${c.name}»: ${it.name}.`, w: "Майстер" }).catch(() => {});
  });
  OBR.broadcast.onMessage(CHEST_SPLIT, async (event) => {
    if (!(await isGM())) return;
    const c = chestOf(event.data?.id);
    if (!c || c.state !== "open" || c.split) return;
    const total = coinCp(c.coins);
    const crew = (await OBR.party.getPlayers()).filter((p) => p.role !== "GM");
    if (!total || !crew.length) return;
    const share = Math.floor(total / crew.length);
    for (const p of crew) OBR.broadcast.sendMessage(CHEST_GOT, { to: p.id, cp: share, from: c.name }, { destination: "REMOTE" }).catch(() => {});
    c.coins = fromCp(total - share * crew.length);
    c.split = true;
    putChest(c);
    send(c);
    appendLog({ k: "g", t: `Монети зі скрині «${c.name}» поділено порівну між ${crew.length}: кожному по ${moneyOf(share)}.`, w: "Майстер" }).catch(() => {});
  });

  // гравець: узяте — у лист персонажа; майстер показує скриню — вікно відкривається
  if (!(await isGM())) {
    const myId = await OBR.player.getId();
    OBR.broadcast.onMessage(CHEST_GOT, (event) => {
      const d = event.data ?? {};
      if (d.to !== myId) return;
      const next = changeSheet(room, (data, { earn }) => { if (d.item) addGear(data, d.item); if (d.cp) earn(d.cp); });
      const id = owner();
      if (next && id) OBR.broadcast.sendMessage(SHEET_PUSH, { id, data: next.data, at: next.at }, { destination: "REMOTE" }).catch(() => {});
      const what = d.item ? `«${d.item.name}»` : `${moneyOf(d.cp)} зі скрині «${d.from}»`;
      OBR.notification.show(next ? `Отримано ${what} — уже в листі персонажа` : `Отримано ${what}, але листа персонажа тут немає — допиши сам`).catch(() => {});
    });
    OBR.broadcast.onMessage(CHEST_SHOW, (event) => { if (event.data?.id) openWin(event.data.id); });
  }
}
const moneyOf = (cp) => money(cp);

// Дошка розслідувань: майстер зберігає справи й роздає їх; гравці лише відкривають вікно
async function startBoards() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  OBR.broadcast.onMessage(BOARD_REQ, async () => {
    if (!(await isGM())) return;
    const send = (d) => OBR.broadcast.sendMessage(BOARD_FULL, d, { destination: "REMOTE" }).catch(() => {});
    await send({ reset: true });
    for (const part of chunks(publicList(boards()))) await send(part);
    await send({ done: true });
  });
  // зміни від гравців: майстер зберігає (гравцям дозволено записки, нитки й пересування)
  const PLAYER_OPS = new Set(["move", "link", "lupd", "unlink", "add", "upd", "del"]);
  OBR.broadcast.onMessage(BOARD_OP, async (event) => {
    const op = event.data;
    if (!op) return;
    if (!(await isGM())) {
      const list = seenBoards(room);
      if (applyBoard(list, op)) saveSeenBoards(room, list);
      return;
    }
    if (!PLAYER_OPS.has(op.op)) return;
    const b = boards();
    const c = b.list.find((x) => x.id === op.k);
    if (!c || c.closed) return;
    const target = c.items.find((i) => i.id === op.id || i.id === op.item?.id);
    const mine = (i) => i && (i.kind === "note" || i.kind === "question" || i.kind === "rumor");
    if (op.op === "add" && (!mine(op.item) || (target && !mine(target)))) return;
    if (op.op === "del" && !mine(target)) return;
    if (op.op === "upd" && (!mine(target) || Object.keys(op.patch ?? {}).some((k) => !["text", "color"].includes(k)))) return;
    if (op.op === "lupd" && op.patch?.color === "gold") return;
    if (applyBoard(b.list, op)) saveBoards(b);
  });
  if (!(await isGM())) {
    OBR.broadcast.onMessage(BOARD_SHOW, async (event) => {
      await OBR.modal.close(BOARD).catch(() => {});
      OBR.modal.open({ id: BOARD, url: url(`board.html?k=${encodeURIComponent(event.data?.k ?? "")}`), fullScreen: true }).catch(() => {});
    });
  }
}

// Таємні цілі: майстер зберігає; кожен гравець отримує лише свої (за власником листа персонажа)
async function startGoals() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const send = (to, fresh) => OBR.broadcast.sendMessage(GOAL_DATA, { to, goals: forPlayer(allGoals()[to]), fresh }, { destination: "REMOTE" }).catch(() => {});
  OBR.broadcast.onMessage(GOAL_REQ, async (e) => { if (await isGM() && e.data?.to) send(e.data.to); });
  OBR.broadcast.onMessage(GOAL_CLAIM, async (e) => {
    if (!(await isGM())) return;
    const d = e.data ?? {};
    const all = allGoals();
    const g = all[d.to]?.find((x) => x.id === d.gid);
    if (!g || g.status !== "active") return;
    g.status = "claimed";
    saveGoals(all);
    send(d.to);
    OBR.notification.show(`${d.who || g.hero}: каже, що виконав таємну ціль «${g.title}» — «Таємні цілі», щоб вирішити`).catch(() => {});
  });
  if (!(await isGM())) {
    OBR.broadcast.onMessage(GOAL_DATA, async (e) => {
      const d = e.data ?? {};
      if (!d.to || d.to !== goalOwner()) return;
      const prev = myGoals(room);
      saveMyGoals(room, d.goals ?? []);
      if (d.fresh) { await OBR.modal.close(GOAL).catch(() => {}); OBR.modal.open({ id: GOAL, url: url("goals.html"), width: 1000, height: 700 }).catch(() => {}); return; }
      for (const g of d.goals ?? []) {
        const was = prev.find((x) => x.id === g.id);
        if (was && was.status !== g.status && (g.status === "done" || g.status === "failed")) OBR.notification.show(`Таємна ціль «${g.title}»: ${g.status === "done" ? "виконано!" : "провалено"}`).catch(() => {});
      }
    });
    setTimeout(() => { const me = goalOwner(); if (me) OBR.broadcast.sendMessage(GOAL_REQ, { to: me }, { destination: "REMOTE" }).catch(() => {}); }, 5500);
  }
}

// Чутки: майстер зберігає; розказана чутка вискакує в усіх із тихим шепотом
async function startRumors() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const send = () => OBR.broadcast.sendMessage(RUMOR_DATA, rumorsForPlayers(rumors()), { destination: "REMOTE" }).catch(() => {});
  OBR.broadcast.onMessage(RUMOR_REQ, async () => { if (await isGM()) send(); });
  OBR.broadcast.onMessage(RUMOR_VOTE, async (e) => {
    if (!(await isGM())) return;
    const d = e.data ?? {};
    const list = rumors();
    const r = list.find((x) => x.id === d.id);
    if (!r || !d.who) return;
    r.votes = { ...(r.votes ?? {}), [d.who]: d.v };
    saveRumors(list);
    send();
  });
  if (!(await isGM())) {
    const WIN = `${ID}/rumor-win`;
    OBR.broadcast.onMessage(RUMOR_DATA, (e) => { if (Array.isArray(e.data)) saveHeard(room, e.data); });
    OBR.broadcast.onMessage(RUMOR_TELL, async (e) => {
      const r = e.data?.r;
      if (!r) return;
      playSecret("whisper", "front", 0.7).catch(() => {});
      const w = await OBR.viewport.getWidth();
      await OBR.popover.close(WIN).catch(() => {});
      OBR.popover.open({
        id: WIN, url: url(`rumor-tell.html?d=${encodeURIComponent(packData(r))}`), width: Math.min(520, w - 40), height: 290,
        anchorReference: "POSITION", anchorPosition: { top: 80, left: w / 2 },
        anchorOrigin: { horizontal: "CENTER", vertical: "TOP" }, transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
        hidePaper: true, marginThreshold: 0,
      }).catch(() => {});
    });
  }
}

// Кидок долі: кубик і настрій посеред екрана
async function showFate(data) {
  const tier = ["crit", "good", "bad", "fumble"].includes(data?.tier) ? data.tier : "good";
  await OBR.popover.close(FATE).catch(() => {});
  await OBR.player.setMetadata({ [FATE_CARD]: { tier, q: String(data?.q ?? "").slice(0, 80), at: Date.now() } });
  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  await OBR.popover.open({
    id: FATE,
    url: url("fate.html"),
    width: Math.min(640, w - 40),
    height: 300,
    anchorReference: "POSITION",
    anchorPosition: { top: h * 0.42, left: w / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });
}

// Таймер раундів і лічильник прориву: вузьке вікно вгорі екрана в усіх гравців.
// Саме вікно читає числа з метаданих сцени, тут його лише відкриваємо й закриваємо.
async function hud(on) {
  if (on === hudShown) return;
  hudShown = on;
  if (!on) {
    await OBR.popover.close(HUD).catch(() => {});
    return;
  }
  const w = await OBR.viewport.getWidth();
  await OBR.popover.open({
    id: HUD,
    url: url("hud.html"),
    width: Math.min(560, w - 40),
    height: 84,
    anchorReference: "POSITION",
    anchorPosition: { top: 62, left: w / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "TOP" },
    transformOrigin: { horizontal: "CENTER", vertical: "TOP" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });
}

// Мапа світу для гравців — велике вікно поверх сцени
async function openMap() {
  await OBR.modal.open({ id: MAP, url: url("map.html"), width: 1280, height: 860 });
}

// Арсенал: майстер відкриває особливу зброю, показує картки й видає зброю в лист персонажа
async function startArsenal() {
  const room = OBR.room.id;
  loadArsenal().catch(() => {});
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const openModal = () => OBR.modal.open({ id: ARSENAL, url: url("arsenal.html"), width: 1180, height: 780 }).catch(() => {});

  OBR.broadcast.onMessage(ARSENAL_REQ, async () => {
    if (!(await isGM())) return;
    OBR.broadcast.sendMessage(ARSENAL_DATA, { ids: opened(room) }, { destination: "REMOTE" }).catch(() => {});
  });
  OBR.broadcast.onMessage(ARSENAL_DATA, async (event) => {
    if (await isGM() || !Array.isArray(event.data?.ids)) return;
    saveArsenalSeen(room, event.data.ids);
  });
  OBR.broadcast.onMessage(ARSENAL_SHOW, async (event) => {
    if (await isGM() || !weapon(event.data?.id)) return;
    const ids = new Set(arsenalSeen(room)); ids.add(event.data.id); saveArsenalSeen(room, [...ids]);
    try { localStorage.setItem(AFOCUS, JSON.stringify({ id: event.data.id, at: Date.now() })); } catch {}
    await OBR.modal.close(ARSENAL).catch(() => {});
    openModal();
  });
  // гравець: майстер видав зброю саме йому — у лист персонажа
  OBR.broadcast.onMessage(ARSENAL_GIVE, async (event) => {
    const w = weapon(event.data?.id);
    if (!w || event.data.to !== (await OBR.player.getId())) return;
    const next = changeSheet(room, (data) => { data.gear = data.gear ?? []; addGear(data, gearOf(w)); });
    const id = owner();
    if (next && id) OBR.broadcast.sendMessage(SHEET_PUSH, { id, data: next.data, at: next.at }, { destination: "REMOTE" }).catch(() => {});
    const ids = new Set(arsenalSeen(room)); ids.add(w.id); saveArsenalSeen(room, [...ids]);
    try { localStorage.setItem(AFOCUS, JSON.stringify({ id: w.id, at: Date.now() })); } catch {}
    OBR.notification.show(next ? `Ти отримуєш «${w.name}» — уже в листі персонажа` : `Ти отримуєш «${w.name}» (відкрий лист персонажа, щоб записати)`, "SUCCESS").catch(() => {});
    await OBR.modal.close(ARSENAL).catch(() => {});
    openModal();
  });
  if (!(await isGM())) setTimeout(() => OBR.broadcast.sendMessage(ARSENAL_REQ, {}, { destination: "REMOTE" }).catch(() => {}), 4500);
}

// Оксамитова книга: майстер тримає, кого відкрито, і всі відгуки; гравці надсилають оцінки
async function startCourt() {
  const room = OBR.room.id;
  loadCourt().catch(() => {});
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  const openModal = () => OBR.modal.open({ id: COURT, url: url("court.html"), width: 1180, height: 800 }).catch(() => {});
  const send = () => OBR.broadcast.sendMessage(COURT_DATA, packCourt(courtOpened(room), courtRates(room)), { destination: "REMOTE" }).catch(() => {});

  OBR.broadcast.onMessage(COURT_REQ, async () => { if (await isGM()) send(); });
  // майстер: оцінка від гравця — записати й розіслати всім
  OBR.broadcast.onMessage(COURT_RATE, async (event) => {
    if (!(await isGM()) || !event.data?.id) return;
    saveCourtRates(room, applyRate(courtRates(room), event.data.from, event.data));
    send();
  });
  OBR.broadcast.onMessage(COURT_DATA, async (event) => {
    if (await isGM()) return;
    if (Array.isArray(event.data?.ids)) saveCourtSeen(room, event.data.ids);
    if (event.data?.rates) saveCourtRates(room, event.data.rates);
  });
  OBR.broadcast.onMessage(COURT_SHOW, async (event) => {
    if (await isGM()) return;
    await loadCourt().catch(() => {});
    if (!lady(event.data?.id)) return;
    const ids = new Set(courtSeen(room)); ids.add(event.data.id); saveCourtSeen(room, [...ids]);
    try { localStorage.setItem(CFOCUS, JSON.stringify({ id: event.data.id, at: Date.now() })); } catch {}
    await OBR.modal.close(COURT).catch(() => {});
    openModal();
  });
  if (!(await isGM())) setTimeout(() => OBR.broadcast.sendMessage(COURT_REQ, {}, { destination: "REMOTE" }).catch(() => {}), 5000);
}

// Записник знайомств: «Представити» й «Познайомити» самі заносять NPC у записник
async function meet(d) {
  const room = OBR.room.id;
  if (!d?.name || !d.intro) return;   // «Лише мені» — це перегляд, не знайомство
  const fresh = introduce(room, { name: d.name, sub: d.sub ?? "", img: d.img ?? "" });
  if (fresh && (await OBR.player.getRole()) !== "GM") OBR.notification.show(`📖 Новий запис у записнику знайомств: ${d.name}`).catch(() => {});
}
async function startAcq() {
  const room = OBR.room.id;
  const isGM = async () => (await OBR.player.getRole()) === "GM";
  // майстер: віддати весь список (частинами, щоб не перевищити 16 кБ на повідомлення)
  OBR.broadcast.onMessage(ACQ_REQ, async () => {
    if (!(await isGM())) return;
    const entries = Object.entries(acqList(room));
    const parts = [];
    let cur = {}, size = 0;
    for (const [k, v] of entries) {
      const b = JSON.stringify(v).length + k.length + 8;
      if (size + b > 12000 && size) { parts.push(cur); cur = {}; size = 0; }
      cur[k] = v; size += b;
    }
    parts.push(cur);
    for (const [i, list] of parts.entries()) await OBR.broadcast.sendMessage(ACQ_DATA, { list, part: i, of: parts.length }, { destination: "REMOTE" }).catch(() => {});
  });
  OBR.broadcast.onMessage(ACQ_DATA, async (event) => { if (!(await isGM())) mergeAcq(room, event.data?.list); });
  OBR.broadcast.onMessage(ACQ_DEL, async (event) => {
    if (await isGM()) return;
    const all = acqList(room); delete all[keyOf(event.data?.k)]; saveAcq(room, all);
  });
  // гравець: знайомство з дамою в Оксамитовій книзі
  OBR.broadcast.onMessage(COURT_SHOW, async (event) => {
    if (await isGM()) return;
    await loadCourt().catch(() => {});
    const l = lady(event.data?.id);
    if (l) meet({ name: l.name, sub: [l.house, l.talent].filter(Boolean).join(" · "), img: l.img });
  });
  if (!(await isGM())) setTimeout(() => OBR.broadcast.sendMessage(ACQ_REQ, {}, { destination: "REMOTE" }).catch(() => {}), 5500);
}
