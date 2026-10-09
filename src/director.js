// Перехід «одним кліком»: спільний для пульта й Атласу.
// Затемнення в усіх, під ним — потрібна мапа нагору, чужі місця сховати, погода, титр.
import OBR from "@owlbear-rodeo/sdk";
import { PRESETS, STATE, BEAT, CUT, normalize } from "./state.js";
import { ADVENTURES, placeOf } from "./beats.js";

export const sceneMaps = () => OBR.scene.items.getItems((i) => i.layer === "MAP" && i.type === "IMAGE");

// Мапи пригоди в сцені: ключ → елемент. Шукаємо за шматком назви, регістр не важить.
export function match(adventure, images, withExtra = true) {
  const all = withExtra ? { ...adventure.maps, ...(adventure.extra ?? {}) } : adventure.maps;
  const found = {};
  for (const [key, part] of Object.entries(all)) {
    const hit = images.find((i) => i.name.toLowerCase().includes(part));
    if (hit) found[key] = hit;
  }
  return found;
}

// Пригода сцени — та, чиїх основних мап у ній найбільше
export function pick(images) {
  let best = ADVENTURES[0];
  let most = -1;
  for (const a of ADVENTURES) {
    const n = Object.keys(match(a, images, false)).length;
    if (n > most) { most = n; best = a; }
  }
  return best;
}

// Настрій із готового набору: усе, крім службових полів
export function fromPreset(p) {
  const { id, name, ...values } = p;
  return normalize({ preset: id, ...values });
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let busy = false;

// next: { id, map, mood, big, small, grid }. Повертає false, якщо мапи немає в сцені або перехід уже йде.
export async function travel(next, adventure) {
  if (busy || !next) return false;
  busy = true;
  try {
    const images = await sceneMaps();
    const adv = adventure ?? pick(images);
    const found = match(adv, images);
    const target = found[next.map];
    if (!target) return false;
    const keep = placeOf(adv, next.map);
    const top = Date.now();

    // Межі рахує майстер і шле готовими: гравець сховану мапу не бачить.
    const bounds = await OBR.scene.items.getItemBounds([target.id]);
    await OBR.broadcast.sendMessage(CUT, { min: bounds.min, max: bounds.max, big: next.big ?? "", small: next.small ?? "" }, { destination: "ALL" });
    await wait(850);   // чекаємо, поки екран потемніє

    await OBR.scene.items.updateItems(Object.values(found), (drafts) => {
      for (const d of drafts) {
        const key = Object.keys(found).find((k) => found[k].id === d.id);
        d.visible = keep.includes(key);
        if (d.id === target.id) d.zIndex = top;
      }
    });

    await OBR.scene.grid.setOpacity(next.grid ?? 0.15);
    const state = fromPreset(PRESETS.find((p) => p.id === next.mood) ?? PRESETS[0]);
    await OBR.scene.setMetadata({ [STATE]: state, [BEAT]: next.id ?? null });
    await wait(1800);   // не даємо запустити наступний перехід, поки цей не проявився
    return true;
  } finally {
    busy = false;
  }
}
