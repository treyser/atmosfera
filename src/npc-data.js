// NPC з Майстерні (public/data/npcs.json) і куртизанки — щоб сцени могли посилатися на готові картки
import { art, cachedContent, loadContent } from "./content.js";

const list = (j) => (Array.isArray(j?.items) ? j.items.map((x) => ({ ...x, img: art(x.img) })) : []);
let NPCS = list(cachedContent("npcs"));
let LADIES = list(cachedContent("court"));
export async function loadNpcs() {
  const [a, b] = await Promise.all([loadContent("npcs"), loadContent("court")]);
  NPCS = list(a); LADIES = list(b);
}
// ref: id NPC або "court:<id>" — повертає картку в одному форматі
export function npcCard(ref) {
  if (!ref) return null;
  if (String(ref).startsWith("court:")) {
    const c = LADIES.find((x) => x.id === ref.slice(6));
    return c ? { name: c.name, sub: [c.house, c.talent].filter(Boolean).join(" · "), race: c.race, look: c.desc, manner: c.about, wants: c.likes ? `До вподоби: ${c.likes}` : "", knows: "", secret: c.secret, quote: c.quote, img: c.img, chatter: c.chatter ?? [] } : null;
  }
  return NPCS.find((x) => x.id === ref) ?? null;
}

// за ім'ям (токен NPC → картка з Майстерні): для реплік «живого» NPC
export function npcByName(name) {
  const k = String(name ?? "").trim().toLowerCase();
  if (!k) return null;
  return NPCS.find((x) => x.name?.trim().toLowerCase() === k) ?? null;
}
