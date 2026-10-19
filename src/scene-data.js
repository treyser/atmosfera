// Сцени з Майстерні (public/data/scenes.json): мапа, настрій, титр, пастки, скрині й NPC.
// Тут — лише довідники й завантаження, без Owlbear, щоб Майстерня могла це імпортувати.
import { art, cachedContent, loadContent } from "./content.js";

// настрої «Атмосфери» (id як у state.js PRESETS)
export const MOODS = {
  clear: "Ясно", day: "Кіно-день", rain: "Дощ", storm: "Шторм", fog: "Туман", night: "Ніч", calm: "Тихе море", dusk: "Захід",
  warm: "Ліхтарі", frost: "Сніг за вікном", blizzard: "Хуртовина", alarm: "Аварійне світло", breach: "Пробоїна", core: "Сердечник", surge: "Перевантаження",
};
export const SHAPES = { "3:2": "Широка 3:2", "4:3": "4:3", "16:9": "Дуже широка 16:9", "1:1": "Квадрат", "2:3": "Висока 2:3" };
export const CHEST_TPL = { none: "Порожня (наповниш сам)", rogue: "Кишеня розбійника", sea: "Скриня моряка", captain: "Капітанська скриня", undead: "Скарб нежиті" };

const fromJson = (j) => (Array.isArray(j?.items) ? j.items.map((x) => ({ ...x, img: art(x.img) })) : null);
export let SCENES = fromJson(cachedContent("scenes")) ?? [];
export async function loadScenes() {
  const list = fromJson(await loadContent("scenes"));
  if (list) SCENES = list;
  return SCENES;
}
export const sceneOf = (id) => SCENES.find((s) => s.id === id) ?? null;
