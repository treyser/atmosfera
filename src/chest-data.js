// Скрині з лутом: вміст живе в браузері майстра, на токені — лише номер скрині.
// Речі гравці беруть самі (хто перший), монети діляться порівну між гравцями в кімнаті.
import { local, saveLocal, uid } from "./log.js";
import { shops } from "./shop-data.js";
import { art, cachedContent, loadContent } from "./content.js";

export const CHESTS = "atmosfera.chests";

export const CATS = { coin: "🪙", gear: "🧭", consum: "🧪", weapon: "⚔️", magic: "✨", curio: "🐚", food: "🍞", gem: "💎", paper: "📜" };

// Власні знахідки — те, чого немає в крамницях
const BUILTIN_LOOT = [
  { name: "Срібний компас без стрілки", cat: "curio", price: 15, pools: ["sea", "captain"], desc: "Корпус гарний, а всередині порожньо. Хтось вийняв стрілку навмисно." },
  { name: "Пляшка рому «Чорний Причал»", cat: "food", price: 2, pools: ["sea", "rogue"], desc: "Міцний, як канат, і такий самий на смак." },
  { name: "Клапоть морської мапи", cat: "paper", price: 10, pools: ["sea", "captain"], desc: "Частина узбережжя з позначкою «тут не ставати на якір»." },
  { name: "Велика перлина", cat: "gem", price: 50, pools: ["sea", "captain", "undead"], desc: "Рівна, молочно-біла, тепла на дотик." },
  { name: "Набір відмичок", cat: "gear", price: 25, pools: ["rogue"], desc: "Злодійські інструменти в шкіряному згортку.", mech: "Дає майстерність злодійськими інструментами, якщо вона вже є." },
  { name: "Кинджал із кістяним руків'ям", cat: "weapon", price: 4, pools: ["rogue", "undead"], desc: "Лезо тонке, рукоять — з чиєїсь кістки.", mech: "Кинджал: 1к4 колючої, фехтувальна, метальна (6/18 м)." },
  { name: "Бурштин із комахою", cat: "gem", price: 20, pools: ["captain", "undead"], desc: "Усередині застиг крихітний крилатий жук, якого ніхто не впізнає." },
  { name: "Корабельний дзвоник", cat: "curio", price: 5, pools: ["sea"], desc: "На ньому вибито назву корабля, якого вже давно немає." },
  { name: "Лист із печаткою церкви", cat: "paper", price: 0, pools: ["captain", "rogue"], desc: "Печатку зламано. Лист адресовано «тому, хто знає ціну тиші»." },
  { name: "В'язка сушеної риби", cat: "food", price: 1, pools: ["sea", "rogue"], desc: "Харчі на кілька днів. Запах — на всі тижні." },
  { name: "Амулет з акулячого зуба", cat: "curio", price: 8, pools: ["sea"], desc: "Моряки носять такі від утоплення. Допомагає не завжди." },
  { name: "Порожня пляшечка з-під отрути", cat: "curio", price: 0, pools: ["rogue", "undead"], desc: "На денці — темний осад і запах гіркого мигдалю." },
  { name: "Судновий журнал", cat: "paper", price: 5, pools: ["captain"], desc: "Сторінки розмиті водою. Читається лише останній запис: «Вона знову співає під кілем»." },
  { name: "Кістяні гральні кості", cat: "curio", price: 1, pools: ["rogue", "sea"], desc: "Одна з них, здається, завжди падає шісткою." },
  { name: "Перстень із гербом Неболіусу", cat: "gem", price: 40, pools: ["captain", "undead"], desc: "Срібний, з королівським гербом. Такі носили лише при дворі." },
  { name: "Жменя дрібних самоцвітів", cat: "gem", price: 25, pools: ["undead", "captain", "rogue"], desc: "Гранати, бірюза, кілька шматочків гірського кришталю." },
  { name: "Зілля лікування", cat: "consum", price: 50, pools: ["sea", "captain", "rogue", "undead"], desc: "Червона рідина, що ледь світиться.", mech: "Відновлює 2к4+2 ХП." },
  { name: "Похоронний жетон", cat: "curio", price: 1, pools: ["undead"], desc: "Мідна пластинка з іменем і датою. Дата — завтрашня." },
  { name: "Свічки з чорного воску", cat: "gear", price: 2, pools: ["undead"], desc: "П'ять свічок. Горять синім полум'ям і майже не дають тепла." },
  { name: "Мотузка, 15 м", cat: "gear", price: 1, pools: ["sea", "rogue"], desc: "Пенькова, міцна, трохи пахне смолою." },
];

// Готові скрині: монети (кубики) і скільки речей із якого пулу
export const TEMPLATES = [
  { id: "rogue", name: "Кишеня розбійника", coins: { gp: "1к6", sp: "2к6" }, items: [1, 2], pool: "rogue", shop: 0 },
  { id: "sea", name: "Скриня моряка", coins: { gp: "3к10", sp: "2к6" }, items: [2, 3], pool: "sea", shop: 0 },
  { id: "captain", name: "Капітанська скриня", coins: { gp: "6к10", sp: "2к10" }, items: [3, 4], pool: "captain", shop: 1 },
  { id: "undead", name: "Скарб нежиті", coins: { gp: "4к20" }, items: [2, 3], pool: "undead", shop: 1 },
];

// Справжній список знахідок — із Майстерні (public/data/loot.json); вбудований — запасний
const lootOf = (j) => (Array.isArray(j?.items) && j.items.length ? j.items.map((x) => ({ ...x, pools: x.pools ?? [], img: art(x.img) })) : null);
export let LOOT = lootOf(cachedContent("loot")) ?? BUILTIN_LOOT;
export async function loadLoot() {
  const l = lootOf(await loadContent("loot"));
  if (l) LOOT = l;
  return LOOT;
}

export function roll(expr) {
  const m = String(expr ?? "").match(/^(\d+)\s*[кd]\s*(\d+)$/i);
  if (!m) return Number(expr) || 0;
  let s = 0;
  for (let i = 0; i < Number(m[1]); i++) s += 1 + Math.floor(Math.random() * Number(m[2]));
  return s;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Усі товари крамниць — як каталог
export function catalog() {
  const out = [];
  for (const s of shops()) for (const it of s.items ?? []) out.push({ ...it, from: s.name });
  return out;
}

export const asLoot = (it) => ({
  id: uid(), name: it.name, desc: it.desc || "", mech: it.mech || "", img: it.img || "", cat: it.cat || "gear",
  rarity: it.rarity || "common", price: Number(it.price) || 0, by: "",
});

export function fill(chest, tpl) {
  chest.name = chest.name && chest.name !== "Скриня" ? chest.name : tpl.name;
  chest.coins = { gp: roll(tpl.coins.gp), sp: roll(tpl.coins.sp), cp: roll(tpl.coins.cp) };
  const n = tpl.items[0] + Math.floor(Math.random() * (tpl.items[1] - tpl.items[0] + 1));
  const pool = LOOT.filter((x) => x.pools.includes(tpl.pool));
  const got = new Set();
  const items = [];
  while (items.length < n && got.size < pool.length) {
    const it = pick(pool);
    if (got.has(it.name)) continue;
    got.add(it.name);
    items.push(asLoot(it));
  }
  const cat = catalog().filter((x) => x.rarity === "uncommon" && Number(x.price) > 0);
  for (let i = 0; i < tpl.shop && cat.length; i++) items.push(asLoot(pick(cat)));
  chest.items = items;
  return chest;
}

// --- сховище майстра ---
export const chests = () => local(CHESTS, {});
export const saveChests = (all) => saveLocal(CHESTS, all);
export const chestOf = (id) => chests()[id] ?? null;
export function putChest(c) {
  const all = chests();
  all[c.id] = c;
  saveChests(all);
  return c;
}
export function newChest(name = "Скриня") {
  return { id: "c" + uid(), name, lock: { on: false, dc: 15, note: "", showDc: false }, state: "closed", coins: { gp: 0, sp: 0, cp: 0 }, items: [], tries: [], split: false, at: Date.now() };
}

// Що бачать гравці: поки скриня замкнена — лише вигляд і замок
export function publicView(c) {
  if (!c) return null;
  const base = { id: c.id, name: c.name, state: c.state, lock: { on: c.lock?.on, note: c.lock?.note ?? "", dc: c.lock?.showDc ? c.lock.dc : null } };
  if (c.state !== "open") return base;
  return { ...base, coins: c.coins, split: c.split, items: c.items.map(({ id, name, desc, mech, img, cat, rarity, by }) => ({ id, name, desc, mech, img, cat, rarity, by })) };
}

export const coinCp = (c) => (Number(c?.gp) || 0) * 100 + (Number(c?.sp) || 0) * 10 + (Number(c?.cp) || 0);
export function fromCp(cp) {
  return { gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 };
}
