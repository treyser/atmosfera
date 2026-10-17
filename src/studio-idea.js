// «✨ З ідеї»: майстер описує задум своїми словами — текстова модель Gemini (безкоштовна)
// повертає готову картку з балансом за 5e і описом для картинки (поле art, англійською).

export const GKEY = "atmosfera.gemini-key";
export const GMODEL = "atmosfera.gemini-text-model";
const DEFAULT_MODEL = "gemini-2.5-flash";

const WORLD = `Ти — помічник майстра D&D 5e в українській кампанії «Прокляття Неболіусу»: морські мандри, кораблі й порти, прокляття, руни й зорі, нежить, вогняні демони, ліси й гори.
Пишеш українською — живо, образно й коротко, у тому ж стилі й форматі, що й приклади. Числа балансуєш за правилами D&D 5e.
Поле art пиши АНГЛІЙСЬКОЮ: конкретний опис зовнішнього вигляду (форма, матеріали, кольори, світіння, деталі) для генерації картинки — 1–2 речення, без тексту й написів.`;

const S = (type, extra = {}) => ({ type, ...extra });
const str = S("STRING"), num = S("NUMBER"), int = S("INTEGER");

export const SPECS = {
  arsenal: {
    rules: `Створи ЗБРОЮ.
- group: simple (проста), martial (бойова), ranged (дальня — луки, арбалети, праща, дротики).
- rarity: common — звичайна, без магії, mech порожній; uncommon — або «Зброя +1», або одна помірна особливість; rare — +1 чи +2 і 1–2 сильні особливості (раз на короткий/довгий відпочинок); legendary — +3 і потужні особливості.
- dmg: формат «1к8 рубаюча», з бонусом «1к8+1 рубаюча», додаткова стихія «+ 1к6 вогнем». Кубик пишемо «к».
- props: терміни 5e українською — фехтувальна, легка, важка, дворучна, досяжність, метальна (6/18 м), універсальна (1к10), боєприпаси (24/96 м), перезаряджання. Для магічної — на початку «Зброя +1; ». Якщо нічого — «—».
- weight у кг; price у золотих: common як у таблиці 5e (0,1–50), uncommon 150–600, rare 2000–6000, legendary 0 (безцінна).
- desc — 1–2 речення: як виглядає, звідки. mech — правила з конкретними числами (СК 12–17 за рідкістю), для common порожній. quote — коротка репліка когось зі світу або порожньо.`,
    schema: { type: "OBJECT", properties: { name: str, group: S("STRING", { enum: ["simple", "martial", "ranged"] }), rarity: S("STRING", { enum: ["common", "uncommon", "rare", "legendary"] }), dmg: str, props: str, weight: num, price: num, desc: str, mech: str, quote: str, art: str }, required: ["name", "group", "rarity", "dmg", "props", "weight", "price", "desc", "mech", "quote", "art"] },
    hints: { rarity: { label: "Рідкість", opts: [["", "Хай вирішить сам"], ["common", "Звичайна"], ["uncommon", "Незвичайна"], ["rare", "Рідкісна"], ["legendary", "Легендарна"]] }, group: { label: "Вид", opts: [["", "Хай вирішить сам"], ["simple", "Проста"], ["martial", "Бойова"], ["ranged", "Дальня"]] } },
    placeholder: "Напр.: кривий абордажний ніж, яким капітан-привид різав линви; трохи проклятий, холодний на дотик",
    show: [["name", "Назва"], ["rarity", "Рідкість"], ["dmg", "Шкода"], ["props", "Властивості"], ["weight", "Вага, кг"], ["price", "Ціна, зм"], ["desc", "Опис"], ["mech", "Особливість"], ["quote", "Цитата"], ["art", "Для картинки"]],
  },
  bestiary: {
    rules: `Створи ІСТОТУ для бестіарію.
- rank (ранг) і орієнтири: 1 Масовка — КД 11–14, ХП 7–22, XP 25–50; 2 Звичайний — КД 13–15, ХП 18–45, XP 100–200; 3 Еліта — КД 14–17, ХП 45–95, XP 450–700; 4 Мінібос — КД 15–18, ХП 80–130, XP 1100–2300; 5 Бос — КД 17–20, ХП 140–230, XP 2900–5900.
- type: Звір, Гуманоїд, Нежить, Фіенд, Елементаль, Аберація, Рослина, Фея, Конструкт, Велет, Монстр, Амфібія тощо.
- biome: water (вода й болота), forest (ліс), mountain (гори), fire (вогонь), undead (нежить), folk (люди й універсальні).
- speed: «9 м», «9 м / плав. 12 м», «6 м / політ 18 м».
- traits: 3–6 рядків. Атаки — «Назва: +5, 1d8+3 колючої.» (кубики через d, бонус атаки й шкода за рангом). Для рангу 2+ першим рядком «Мультиатака: …». Особливості — «Назва: опис із СК чи умовами.».
- seen — перше враження з першого погляду, 1–2 речення, без цифр. lore — звички, де живе, легенди, 2–3 речення. weak — слабкості, 1 речення.`,
    schema: { type: "OBJECT", properties: { name: str, type: str, biome: S("STRING", { enum: ["water", "forest", "mountain", "fire", "undead", "folk"] }), rank: int, ac: int, hp: int, xp: int, speed: str, traits: S("ARRAY", { items: str }), seen: str, lore: str, weak: str, art: str }, required: ["name", "type", "biome", "rank", "ac", "hp", "xp", "speed", "traits", "seen", "lore", "weak", "art"] },
    hints: { rank: { label: "Ранг", opts: [["", "Хай вирішить сам"], ["1", "I — Масовка"], ["2", "II — Звичайний"], ["3", "III — Еліта"], ["4", "IV — Мінібос"], ["5", "V — Бос"]] }, biome: { label: "Середовище", opts: [["", "Хай вирішить сам"], ["water", "Вода"], ["forest", "Ліс"], ["mountain", "Гори"], ["fire", "Вогонь"], ["undead", "Нежить"], ["folk", "Люди"]] } },
    placeholder: "Напр.: утоплений лоцман, що світить ліхтарем у тумані й заманює кораблі на скелі; невеликий бос",
    show: [["name", "Ім'я"], ["type", "Тип"], ["rank", "Ранг"], ["ac", "КД"], ["hp", "ХП"], ["xp", "XP"], ["speed", "Швидкість"], ["traits", "Вміння"], ["seen", "Перше враження"], ["lore", "Що відомо"], ["weak", "Слабкості"], ["art", "Для картинки"]],
  },
  loot: {
    rules: `Створи ЗНАХІДКУ для скрині (дрібниця, цінність, дивина, документ, зілля).
- cat: coin, gear, consum, weapon, magic, curio, food, gem, paper.
- price у золотих (0 — нічого не варта, але цікава). pools — у яких скринях трапляється: rogue (кишеня розбійника), sea (скриня моряка), captain (капітанська), undead (скарб нежиті).
- desc — 1–2 речення з гачком для історії. mech — механіка, якщо є, інакше порожньо.`,
    schema: { type: "OBJECT", properties: { name: str, cat: S("STRING", { enum: ["coin", "gear", "consum", "weapon", "magic", "curio", "food", "gem", "paper"] }), price: num, pools: S("ARRAY", { items: S("STRING", { enum: ["rogue", "sea", "captain", "undead"] }) }), desc: str, mech: str, art: str }, required: ["name", "cat", "price", "pools", "desc", "mech", "art"] },
    hints: {},
    placeholder: "Напр.: лист утопленого юнги до матері, з кривою мапою на звороті",
    show: [["name", "Назва"], ["cat", "Що це"], ["price", "Ціна, зм"], ["pools", "Скрині"], ["desc", "Опис"], ["mech", "Механіка"], ["art", "Для картинки"]],
  },
  shops: {
    rules: `Створи ТОВАР для крамниці.
- cat: consum (витратне), gear (спорядження), weapon (зброя й броня), magic (незвичайне), curio (дивини), food (харчі).
- rarity: common, uncommon, rare, trade (лише обмін, price 0). price у золотих за 5e (зілля лікування 50, незвичайні 100–500). qty — скільки в наявності (1–5).
- desc — що це. mech — правила з числами. quote — що каже продавець, з характером.`,
    schema: { type: "OBJECT", properties: { name: str, cat: S("STRING", { enum: ["consum", "gear", "weapon", "magic", "curio", "food"] }), rarity: S("STRING", { enum: ["common", "uncommon", "rare", "trade"] }), price: num, qty: int, desc: str, mech: str, quote: str, art: str }, required: ["name", "cat", "rarity", "price", "qty", "desc", "mech", "quote", "art"] },
    hints: { rarity: { label: "Рідкість", opts: [["", "Хай вирішить сам"], ["common", "Звичайне"], ["uncommon", "Незвичайне"], ["rare", "Рідкісне"], ["trade", "Лише обмін"]] } },
    placeholder: "Напр.: пляшка з туманом, у якому видно чужий корабель; продавець і сам її боїться",
    show: [["name", "Назва"], ["cat", "Розділ"], ["rarity", "Рідкість"], ["price", "Ціна, зм"], ["qty", "Кількість"], ["desc", "Опис"], ["mech", "Механіка"], ["quote", "Слова продавця"], ["art", "Для картинки"]],
  },
};

// кілька наявних карток як зразок стилю й балансу (схожих за підказками, якщо є)
export function examples(kind, list, hints) {
  const strip = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => !/^(id|img|rev|n|_.*|bg|removed)$/.test(k)));
  let pool = list.filter((x) => Object.entries(hints).every(([k, v]) => !v || String(x[k]) === String(v)));
  if (pool.length < 3) pool = list;
  pool = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  return pool.map(strip);
}

export async function generate(kind, idea, hints, list, avoid = "") {
  const key = localStorage.getItem(GKEY) || "";
  if (!key) throw Object.assign(new Error("Потрібен ключ Gemini API"), { code: "nokey" });
  const model = localStorage.getItem(GMODEL) || DEFAULT_MODEL;
  const spec = SPECS[kind];
  const want = Object.entries(hints).filter(([, v]) => v).map(([k, v]) => `${k} = ${v}`).join(", ");
  const user = `Ідея майстра: ${idea}
${want ? `Обов'язково: ${want}.` : ""}
${avoid ? `Попередній варіант був «${avoid}» — зроби інший, не повторюйся.` : ""}
Ось кілька карток із цієї ж книги — тримайся їхнього стилю, довжини й формату:
${JSON.stringify(examples(kind, list, hints), null, 1)}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${WORLD}\n\n${spec.rules}` }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: spec.schema, temperature: 1 },
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(/quota|RESOURCE_EXHAUSTED/i.test(msg) ? "Gemini каже, що вичерпано ліміт — зачекай хвилину й спробуй ще (або вибери іншу модель нижче)" : /API key not valid/i.test(msg) ? "Ключ Gemini недійсний" : msg), { code: r.status });
  }
  const text = (j?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  try { return JSON.parse(text); }
  catch { throw new Error("Gemini відповів не так, як треба — спробуй ще раз"); }
}
