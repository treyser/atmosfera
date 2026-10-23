// Вибір зон і токенів для тригерів і блупрінтів — списком зі сцени (вікно редактора закриває мапу,
// тож виділяти на мапі незручно). Однакові імена отримують номер: «Охоронець», «Охоронець (2)».
import OBR from "@owlbear-rodeo/sdk";

export const pick = { zones: [], tokens: [], names: new Map() };
const SHAPE_NAMES = { RECTANGLE: "прямокутник", CIRCLE: "коло", TRIANGLE: "трикутник", HEXAGON: "шестикутник" };

export async function loadPick() {
  pick.zones = []; pick.tokens = []; pick.names = new Map();
  if (!(await OBR.scene.isReady())) return pick;
  const items = await OBR.scene.items.getItems();
  const seen = new Map();
  const uniq = (base) => { const n = (seen.get(base) ?? 0) + 1; seen.set(base, n); return n > 1 ? `${base} (${n})` : base; };
  let z = 0;
  for (const it of items) {
    if (["SHAPE", "CURVE", "PATH"].includes(it.type) && it.layer !== "POPOVER") {
      const own = it.text?.plainText || (it.name && !/^(Shape|Rectangle|Circle|Curve|Path|Line|Polygon|Drawing)$/i.test(it.name) ? it.name : "");
      const label = uniq(own || `Фігура ${++z}${it.shapeType ? ` · ${SHAPE_NAMES[it.shapeType] ?? it.shapeType.toLowerCase()}` : ""}`);
      pick.zones.push({ id: it.id, label });
      pick.names.set(it.id, label);
    } else if (it.type === "IMAGE" && (it.layer === "CHARACTER" || it.layer === "PROP" || it.layer === "MOUNT")) {
      const label = uniq(it.text?.plainText || it.name || "Токен");
      pick.tokens.push({ id: it.id, label: it.visible ? label : `${label} · схований` });
      pick.names.set(it.id, label);
    }
  }
  pick.tokens.sort((a, b) => a.label.localeCompare(b.label, "uk"));
  return pick;
}
export const nameOf = (id) => pick.names.get(id) ?? "(прибрано зі сцени)";
export const listFor = (t) => (t === "zone" ? pick.zones : pick.tokens);

// показати вибране на мапі (виділення), щоб було видно, що саме вибрано
export const flash = (ids) => OBR.player.select(ids.filter(Boolean)).catch(() => {});
