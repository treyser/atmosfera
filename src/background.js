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
    .layer("POST_PROCESS")
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
