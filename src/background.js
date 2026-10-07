// Тримає екранний ефект відповідно до настрою сцени і показує титри.
import OBR, { buildEffect } from "@owlbear-rodeo/sdk";
import { ID, STATE, TITLE, CUT, CARD, normalize, isClear } from "./state.js";
import { SKSL } from "./shader.js";

const BASE = import.meta.env.BASE_URL;
const url = (p) => new URL(BASE + p, window.location.origin).href;

const EFFECT = `${ID}/effect`;   // позначка нашого ефекту в його метаданих
const SHOW_MS = 12000;           // запасне закриття: зазвичай титр закриває себе сам, коли дограє

let cardTimer = null;

OBR.onReady(async () => {
  OBR.scene.onReadyChange((ready) => { if (ready) refresh(); });
  OBR.scene.onMetadataChange((m) => apply(normalize(m[STATE])));
  if (await OBR.scene.isReady()) refresh();

  OBR.broadcast.onMessage(TITLE, (event) => showCard(event.data));
  OBR.broadcast.onMessage(CUT, (event) => lookAt(event.data));
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
    .layer("POINTER")   // найвищий шар: погода лягає і на туман війни
    .locked(true)
    .disableHit(true)
    .metadata({ [EFFECT]: true })
    .build();
  await OBR.scene.local.addItems([effect]);
}

// Наводить камеру цього гравця на показану мапу, з невеликим полем довкола.
async function lookAt(data) {
  const { min, max } = data ?? {};
  if (!min || !max) return;
  const pad = Math.max(max.x - min.x, max.y - min.y) * 0.04;
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
    width: Math.min(900, w - 40),
    height: 200,
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
    OBR.popover.close(CARD).catch(() => {});
  }, SHOW_MS);
}
