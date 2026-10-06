// Тримає екранний ефект відповідно до настрою сцени і показує титри.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { ID, STATE, TITLE, normalize, isClear } from "./state.js";
import { SKSL } from "./shader.js";

const BASE = import.meta.env.BASE_URL;
const url = (p) => new URL(BASE + p, window.location.origin).href;

const EFFECT = `${ID}/effect`;   // позначка нашого ефекту в його метаданих
const CARD = `${ID}/card`;
const SHOW_MS = 5200;            // скільки висить титр, разом із появою і зникненням

let cardTimer = null;

// ТИМЧАСОВО: перевірочні варіанти шейдера замість настроїв.
const STORM = { rain: 1, fog: 0.25, flash: 1, dark: 0.4, amount: 0.25, tint: [0.15, 0.25, 0.4] };
const noTime = SKSL.replace("uniform float time;", "const float time = 0.0;");
const modTime = SKSL.replace("uniform float time;", "uniform float time;\nfloat T() { return mod(time, 1000.0); }").replaceAll("time *", "T() *").replaceAll("time /", "T() /");
const ownClock = SKSL.replace("uniform float time;", "uniform float clock;").replaceAll("time", "clock");
const TESTS = {
  rain:  { sksl: `uniform float time; half4 main(float2 c) { float big = time > 1000000.0 ? 0.5 : 0.0; return half4(big, fract(time) * 0.5, 0.0, 0.5); }`, uniforms: () => [] },
  storm: { sksl: noTime, uniforms: () => uniformsOf(STORM) },
  fog:   { sksl: modTime, uniforms: () => uniformsOf(STORM) },
  night: { sksl: ownClock, uniforms: () => [...uniformsOf(STORM), { name: "clock", value: 0 }], clock: true },
  calm:  { sksl: SKSL, uniforms: () => uniformsOf(STORM) },
  dusk:  { sksl: `uniform vec2 size; float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); } half4 main(float2 c) { vec2 p = c / size; float h = hash(floor(p * 40.0)); return half4(h * 0.5, h * 0.5, h * 0.5, 0.5); }`, uniforms: () => [] },
};
let ticker = null;
const started = Date.now();
function runClock(on) {
  if (ticker) { clearInterval(ticker); ticker = null; }
  if (!on) return;
  ticker = setInterval(() => {
    const t = ((Date.now() - started) / 1000) % 3600;
    OBR.scene.local.updateItems((i) => i.metadata?.[EFFECT], (drafts) => {
      for (const d of drafts) for (const u of d.uniforms) if (u.name === "clock") u.value = t;
    }, true);
  }, 40);
}


OBR.onReady(async () => {
  OBR.scene.onReadyChange((ready) => { if (ready) refresh(); });
  OBR.scene.onMetadataChange((m) => apply(normalize(m[STATE])));
  if (await OBR.scene.isReady()) refresh();

  OBR.broadcast.onMessage(TITLE, (event) => showCard(event.data));
});

async function refresh() {
  const meta = await OBR.scene.getMetadata();
  await apply(normalize(meta[STATE]));
}

function uniformsOf(s) {
  const [x, y, z] = s.tint;
  return [
    { name: "rain", value: s.rain },
    { name: "fog", value: s.fog },
    { name: "flash", value: s.flash },
    { name: "dark", value: s.dark },
    { name: "amount", value: s.amount },
    { name: "tint", value: { x, y, z } },
  ];
}

// Ефект локальний: кожен клієнт малює свій, а спільним є лише настрій у метаданих сцени.
async function apply(s) {
  const mine = await OBR.scene.local.getItems((i) => i.metadata?.[EFFECT]);

  if (isClear(s)) {
    if (mine.length) await OBR.scene.local.deleteItems(mine.map((i) => i.id));
    return;
  }

  runClock(false);
  const test = TESTS[s.preset];
  if (test) {
    if (mine.length) await OBR.scene.local.deleteItems(mine.map((i) => i.id));
    const probe = buildEffect()
      .effectType("VIEWPORT")
      .sksl(test.sksl)
      .uniforms(test.uniforms(s))
      .layer("POINTER")
      .locked(true)
      .disableHit(true)
      .metadata({ [EFFECT]: true })
      .build();
    await OBR.scene.local.addItems([probe]);
    runClock(Boolean(test.clock));
    return;
  }

  if (mine.length) {
    await OBR.scene.local.updateItems(mine, (drafts) => {
      for (const d of drafts) d.uniforms = uniformsOf(s);
    });
    return;
  }

  const effect = buildEffect()
    .effectType("VIEWPORT")
    .sksl(SKSL)
    .uniforms(uniformsOf(s))
    .layer("POINTER")   // найвищий шар: погода лягає і на туман війни
    .locked(true)
    .disableHit(true)
    .metadata({ [EFFECT]: true })
    .build();
  await OBR.scene.local.addItems([effect]);
}

async function showCard(data) {
  const big = String(data?.big ?? "").trim();
  if (!big) return;
  const small = String(data?.small ?? "").trim();

  if (cardTimer) {
    clearTimeout(cardTimer);
    await OBR.popover.close(CARD);
  }

  const [w, h] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const q = new URLSearchParams({ big, small });

  await OBR.popover.open({
    id: CARD,
    url: `${url("title.html")}?${q}`,
    width: Math.min(900, w - 40),
    height: 220,
    anchorReference: "POSITION",
    anchorPosition: { top: h * 0.3, left: w / 2 },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    hidePaper: true,
    disableClickAway: true,
    marginThreshold: 0,
  });

  cardTimer = setTimeout(() => {
    cardTimer = null;
    OBR.popover.close(CARD);
  }, SHOW_MS);
}
