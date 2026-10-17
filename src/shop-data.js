// Крамниці: дані, гаманець із листа персонажа, ціни.
// Крамниці майстра живуть у його браузері (atmosfera.shops); гравцям відкрита крамниця приходить повідомленням.
import { local, saveLocal, uid } from "./log.js";
import { art, loadContent, mergeBase } from "./content.js";

export const SHOPS = "atmosfera.shops";          // у майстра: усі крамниці
export const OFFERS = "atmosfera.shop-offers";   // у майстра: що гравці пропонують продати
export const SEEN = "atmosfera.shop-last";       // у гравця: остання відкрита крамниця

export const CATS = {
  consum: { name: "Витратне", icon: "🧪" },
  gear: { name: "Спорядження", icon: "🧭" },
  weapon: { name: "Зброя й броня", icon: "⚔️" },
  magic: { name: "Незвичайне", icon: "✨" },
  curio: { name: "Дивини", icon: "🐚" },
  food: { name: "Харчі", icon: "🍞" },
};
export const RARITY = {
  common: "Звичайне",
  uncommon: "Незвичайне",
  rare: "Рідкісне",
  trade: "Лише обмін",
};

const ART = "https://treyser.github.io/atmosfera/";   // картинки крамниці лежать на сайті «Атмосфери»

// Перша крамниця — «Солона Монета» Мейри
export const SEED = [{
  id: "salty-coin",
  name: "Солона Монета",
  owner: "Мейра",
  about: "Тісна лавка біля причалу, де пахне смолою, сіллю й ладаном. Мейра скуповує в моряків усе, що ті привозять з-за обрію, і продає тим, хто вміє платити.",
  greet: "Дивитися безкоштовно. Торкатися — теж. Але якщо щось розіб'єш — купив.",
  img: ART + "shop-meira.webp",
  bg: ART + "shop-shop-bg.webp",
  buy: 0.5,
  items: [
    { id: "i1", img: ART + "shop-i1.webp", cat: "consum", rarity: "common", name: "Червона морська вода", price: 50, qty: 4,
      desc: "Зілля лікування в пляшці з-під рому.", mech: "Відновлює 2к4+2 ХП.",
      quote: "Смак такий самий жахливий, як у справжнього. Отже, справжнє." },
    { id: "i2", img: ART + "shop-i2.webp", cat: "consum", rarity: "common", name: "Мішечок відьминої солі", price: 25, qty: 3,
      desc: "Сіль, зібрана на Морозних Пустках.",
      mech: "Коло радіусом 1,5 м. 10 хвилин нежить і духи, щоб перетнути коло, мусять пройти рятівний кидок Мудрості СК 12." },
    { id: "i3", img: ART + "shop-i3.webp", cat: "consum", rarity: "uncommon", name: "Пляшка шторму", price: 200, qty: 1,
      desc: "У закоркованій пляшці гуде вітер.",
      mech: "Розбити — 1 хвилину діє закляття «Порив вітру». Корабель у штиль жене 1 годину на повній швидкості." },
    { id: "i4", img: ART + "shop-i4.webp", cat: "gear", rarity: "common", name: "Ліхтар-медуза", price: 35, qty: 2,
      desc: "Скляна куля з живою медузою всередині.",
      mech: "Занурити в морську воду — 8 годин світить холодним синім світлом, як ліхтар із заслінкою. Олія не потрібна." },
    { id: "i5", img: ART + "shop-i5.webp", cat: "gear", rarity: "common", name: "Мотузка з волосся сирени", price: 60, qty: 1,
      desc: "15 метрів сріблястої мотузки.", mech: "Не тоне, не гниє; розірвати — перевірка Сили СК 20." },
    { id: "i6", img: ART + "shop-i6.webp", cat: "gear", rarity: "uncommon", name: "Мапа з чужих рук", price: 40, qty: 1,
      desc: "Обгорілий клапоть морської мапи з позначками незнайомою рукою.",
      mech: "Відкриває одну точку «?» в Атласі — яку, вирішує майстер.",
      quote: "Хлопець, що її продав, дуже поспішав. І більше не повертався." },
    { id: "i7", img: ART + "shop-i7.webp", cat: "magic", rarity: "uncommon", name: "Компас, що бачить недобре", price: 250, qty: 1,
      desc: "Латунний компас із тріснутою кришталевою кришкою.",
      mech: "Раз на день: протягом хвилини стрілка вказує на найближчу нежить або проклятий предмет у межах 1,5 км." },
    { id: "i8", img: ART + "shop-i8.webp", cat: "magic", rarity: "uncommon", name: "Плащ із тюленячої шкіри", price: 300, qty: 1,
      desc: "Важкий сірий плащ, що пахне морем.",
      mech: "Швидкість плавання дорівнює швидкості ходьби; власник не страждає від холодної води." },
    { id: "i9", img: ART + "shop-i9.webp", cat: "magic", rarity: "uncommon", name: "Рунний камінець", price: 150, qty: 2,
      desc: "Гладенька галька з викарбуваною руною. На звороті — ще кілька символів незнайомої абетки.",
      mech: "Одноразовий: розламати, щоб додати 1к4 до атаки або рятівного кидка.",
      quote: "Гарна прикраса, правда? Що там написано — гадки не маю." },
    { id: "i10", img: ART + "shop-i10.webp", cat: "curio", rarity: "trade", name: "Мушля Відлуння", price: 0, qty: 1,
      desc: "Велика спіральна мушля. Хто прикладе її до вуха, почує останні слова того, хто тримав її перед смертю.",
      mech: "Не продається за гроші — лише в обмін. Домовляйтесь із Мейрою.",
      quote: "Цю витягли з уламків корабля біля Морозних Пусток. Віддам тільки за історію, якої я ще не чула." },
  ],
}];

// --- крамниці майстра ---
export function shops() {
  const list = local(SHOPS, null);
  if (!list) { saveLocal(SHOPS, SEED); return SEED; }
  // крамниця з комплекту отримала картинки пізніше — домалюємо їх, якщо майстер не поставив своїх
  let changed = false;
  for (const seed of SEED) {
    const s = list.find((x) => x.id === seed.id);
    if (!s) continue;
    for (const k of ["img", "bg"]) if (!s[k] && seed[k]) { s[k] = seed[k]; changed = true; }
    for (const it of s.items) {
      const si = seed.items.find((x) => x.id === it.id);
      if (si?.img && !it.img) { it.img = si.img; changed = true; }
    }
  }
  if (changed) saveLocal(SHOPS, list);
  return list;
}
export const saveShops = (list) => saveLocal(SHOPS, list);

// майстер: підтягнути крамниці з Майстерні (нові крамниці й товари, правки, видалені)
export async function syncShops() {
  const j = await loadContent("shops");
  if (!Array.isArray(j?.shops)) return false;
  const list = shops();
  const fixItem = (it) => ({ ...it, img: art(it.img) });
  let changed = false;
  for (const b of j.shops) {
    const { items = [], removed = [], ...fields } = b;
    fields.img = art(fields.img); fields.bg = art(fields.bg);
    const i = list.findIndex((x) => x.id === b.id);
    if (i < 0) {
      list.push({ ...fields, items: items.map((it) => ({ ...fixItem(it), _rev: it.rev ?? 0 })), _rev: b.rev ?? 0, _base: true });
      changed = true;
      continue;
    }
    const one = [list[i]];
    if (mergeBase(one, [{ ...fields, items: list[i].items }])) changed = true;
    list[i] = one[0];
    list[i].items = list[i].items ?? [];
    if (mergeBase(list[i].items, items, removed, fixItem)) changed = true;
  }
  for (const id of j.removed ?? []) {
    const k = list.findIndex((x) => x.id === id);
    if (k >= 0 && list.length > 1 && !((list[k]._at ?? 0) > (list[k]._rev ?? 0))) { list.splice(k, 1); changed = true; }
  }
  if (changed) saveShops(list);
  return changed;
}
export const findShop = (id) => shops().find((s) => s.id === id) ?? null;
export function newShop() {
  return { id: uid(), name: "Нова крамниця", owner: "", about: "", greet: "", img: "", bg: "", buy: 0.5, items: [] };
}
export function newItem() {
  return { id: uid(), cat: "gear", rarity: "common", name: "Новий товар", price: 10, qty: 1, desc: "", mech: "", quote: "" };
}

// --- гроші: усе рахуємо в мідяках ---
export const cpOf = (gp) => Math.round(Number(gp || 0) * 100);
export function priceCp(item, discount = 0) {
  return Math.max(0, Math.round(cpOf(item.price) * (1 - discount)));
}
export function money(cp) {
  const g = Math.floor(cp / 100), s = Math.floor((cp % 100) / 10), c = cp % 10;
  return [g && `${g} зм`, s && `${s} см`, c && `${c} мм`].filter(Boolean).join(" ") || "0 зм";
}

// --- лист персонажа (розширення «Лист персонажа», той самий сайт — спільне сховище браузера) ---
const SHEET_ID = "com.nikita.character-sheet";
export const sheetKey = (room) => `lyst.mine.${room}`;
export const owner = () => { try { return localStorage.getItem("sheet-owner"); } catch { return null; } };
export const readSheet = (room) => local(sheetKey(room), null);
export function purse(sheet) {
  const d = sheet?.data ?? {};
  return (Number(d.gp) || 0) * 100 + (Number(d.sp) || 0) * 10 + (Number(d.cp) || 0);
}
function setPurse(data, cp) {
  data.gp = String(Math.floor(cp / 100));
  data.sp = String(Math.floor((cp % 100) / 10));
  data.cp = String(cp % 10);
}
// Змінити лист: гроші й спорядження; повертає новий лист або null, якщо листа немає
export function changeSheet(room, fn) {
  const sheet = readSheet(room);
  if (!sheet?.data) return null;
  const data = JSON.parse(JSON.stringify(sheet.data));
  data.gear = Array.isArray(data.gear) ? data.gear : [];
  fn(data, { pay: (cp) => setPurse(data, purse({ data }) - cp), earn: (cp) => setPurse(data, purse({ data }) + cp) });
  const next = { data, at: Date.now() };
  saveLocal(sheetKey(room), next);
  return next;
}
export const SHEET_PUSH = `${SHEET_ID}/push`;   // щоб копія листа в майстра теж оновилась

export function addGear(data, item) {
  const have = data.gear.find((g) => g.name === item.name);
  if (have) have.qty = String((Number(have.qty) || 0) + 1);
  else data.gear.push({ name: item.name, qty: "1", note: [item.desc, item.mech].filter(Boolean).join(" ").slice(0, 200) });
}
export function takeGear(data, name) {
  const i = data.gear.findIndex((g) => g.name === name);
  if (i < 0) return false;
  const q = (Number(data.gear[i].qty) || 1) - 1;
  if (q > 0) data.gear[i].qty = String(q);
  else data.gear.splice(i, 1);
  return true;
}
