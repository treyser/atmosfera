// Пропозиції гравців, куди плисти: кожен тримає свою в метаданих гравця, усі бачать усі.
import OBR from "@owlbear-rodeo/sdk";
import { VOTE } from "./state.js";

// [{ id, name, color, n, at, self }] — лише ті, хто щось запропонував, найсвіжіші зверху
export async function getVotes() {
  const [others, id, name, color, meta] = await Promise.all([
    OBR.party.getPlayers(),
    OBR.player.getId(),
    OBR.player.getName(),
    OBR.player.getColor(),
    OBR.player.getMetadata(),
  ]);
  const all = [
    { id, name, color, metadata: meta, self: true },
    ...others.map((p) => ({ id: p.id, name: p.name, color: p.color, metadata: p.metadata, self: false })),
  ];
  return all
    .map((p) => ({ ...p, ...(p.metadata?.[VOTE] ?? {}) }))
    .filter((p) => Number.isInteger(p.n))
    .sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
}

// Викликає fn, щойно хтось змінив свою пропозицію (чи прийшов / пішов)
export function onVotes(fn) {
  OBR.party.onChange(fn);
  OBR.player.onChange(fn);
}

export const setVote = (n) => OBR.player.setMetadata({ [VOTE]: n == null ? undefined : { n, at: Date.now() } });

// Крапочки кольорів гравців біля точки на мапі
export function pips(dot, list) {
  dot.querySelector(".pips")?.remove();
  if (!list.length) return;
  const box = document.createElement("span");
  box.className = "pips";
  for (const v of list) {
    const i = document.createElement("i");
    i.style.background = v.color;
    i.title = v.name;
    box.append(i);
  }
  dot.append(box);
}
