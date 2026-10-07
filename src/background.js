// Тримає екранні ефекти відповідно до настрою сцени, грає переходи між моментами і показує титри.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { ID, STATE, GRADE_ON, TITLE, CUT, CARD, normalize, isClear } from "./state.js";
import { SKSL, GRADE } from "./shader.js";

const BASE = import.meta.env.BASE_URL;
const url = (p) => new URL(BASE + p, window.location.origin).href;

const EFFECT = `${ID}/effect`;   // позначка ефекту поверх сцени (погода, плівка, затемнення, смуги)
const POST = `${ID}/post`;       // позначка ефекту кольорокорекції
const SHOW_MS = 12000;           // запасне закриття титру: зазвичай він закриває себе сам

let mood = normalize();          // настрій поточної сцени
let grade = 0;
let lastGrade = 0;
const anim = { fade: 0, bars: 0 };   // затемнення і смуги: у кожного гравця свої, синхронізує їх лише сигнал

let cardTimer = null;
let timers = [];                 // відкладені кроки поточного переходу
let tweens = {};                 // активні плавні зміни anim
let ticker = null;
let queue = Promise.resolve();   // щоб два оновлення ефекту не створили його двічі

OBR.onReady(async () => {
  OBR.scene.onReadyChange((ready) => { if (ready) refresh(); });
  OBR.scene.onMetadataChange((m) => { mood = normalize(m[STATE]); grade = Number(m[GRADE_ON]) || 0; sync(); });
  if (await OBR.scene.isReady()) refresh();

  OBR.broadcast.onMessage(TITLE, (event) => titleOnly(event.data));
  OBR.broadcast.onMessage(CUT, (event) => cut(event.data));
});

async function refresh() {
  const m = await OBR.scene.getMetadata();
  mood = normalize(m[STATE]);
  grade = Number(m[GRADE_ON]) || 0;
  sync();
}

function overlayUniforms() {
  const [x, y, z] = mood.tint;
  return [
    { name: "rain", value: mood.rain },
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
  if (grade !== lastGrade) {
    lastGrade = grade;
    await keep(POST, false);
  }
  const UV = {
    1: "vec2 uv = coord;",
    2: "vec2 uv = (vec3(coord, 1) * view).xy;",
    3: "vec2 uv = (modelView * vec3(coord, 1)).xy;",
    4: "vec2 uv = (view * vec3(coord, 1)).xy;",
  };
  const variant = GRADE.replace("uniform mat3 modelView;", "uniform mat3 modelView;\nuniform mat3 view;").replace("vec2 uv = (vec3(coord, 1) * modelView).xy;", UV[grade] ?? "vec2 uv = coord;");
  await keep(POST, grade > 0 && !isClear(mood), gradeUniforms, () =>
    buildEffect().effectType("VIEWPORT").sksl(variant).layer("POST_PROCESS"));
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
