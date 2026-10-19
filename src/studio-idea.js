// «✨ З ідеї»: майстер описує задум своїми словами — текстова модель Gemini (безкоштовна)
// повертає готову картку з балансом за 5e і описом для картинки (поле art, англійською).

export const GKEY = "atmosfera.gemini-key";
export const GMODEL = "atmosfera.gemini-text-model";
const DEFAULT_MODEL = "gemini-3.8-flash";

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
  scenes: {
    rules: `Створи СЦЕНУ для гри в Owlbear: бойову чи дослідницьку локацію з мапою, настроєм, титром, пастками, скринями й NPC.
- name — коротка назва для майстра. title — титр, 2–5 слів (назва місця). sub — малий рядок титру: час, обставини, натяк (до 8 слів).
- mood — настрій «Атмосфери»: clear, day, rain, storm, fog, night, calm (тихе море), dusk, warm (ліхтарі, таверна, інтер'єр), frost (сніг за вікном потяга), blizzard, alarm (аварійне світло), breach (пробоїна), core, surge.
- shape — форма мапи: «3:2» (типово), «4:3», «16:9», «1:1», «2:3». cols — клітинок ушир (16–32, типово 24); rows рахуй як cols × друге число / перше (3:2 і 24 → 16).
- read — 3–5 речень, які майстер читає гравцям уголос, коли вони заходять: що бачать, чують, чим пахне. Без механік.
- notes — для майстра: що тут насправді, хто чого хоче, як може розвернутися сцена, 3–5 речень.
- art — АНГЛІЙСЬКОЮ, опис мапи згори для генерації: місце, підлога, головні об'єкти з розташуванням («a collapsed bridge across the center», «an altar in the upper-left corner»), світло. 2–4 речення.
- traps — 0–4 пастки. kind: spikes, bolt, fire, needle, gas, net, pit, rocks. name — назва українською. dc 12–16. x, y — клітинка (від 1 до cols, від 1 до rows, від лівого верхнього кута), узгоджена з описом у art (де вузьке місце, двері, скарб). size — 1–3 клітинки. clue — що помітить уважний, 1 речення.
- chests — 0–3 скрині. tpl: none (порожня), rogue, sea, captain, undead. lock — СК замка або 0. x, y — як у пасток.
- npcs — 0–4 NPC: name, sub (хто це, 2–5 слів), x, y, note (його роль саме в цій сцені — для майстра).
  ref — id наявного NPC зі списку нижче, або порожньо для нового. Для НОВОГО NPC заповни його картку: race, look (вигляд, 1 речення), manner (характер і як говорить), wants (чого хоче), knows (що знає), secret (таємниця або порожньо), quote (характерна фраза), art (англійською: зовнішність, одяг, вираз — для токена). Для наявного ці поля порожні.
Пастки став там, де герої ходитимуть: проходи, двері, біля скринь.`,
    schema: { type: "OBJECT", properties: {
      name: str, title: str, sub: str, mood: S("STRING", { enum: ["clear", "day", "rain", "storm", "fog", "night", "calm", "dusk", "warm", "frost", "blizzard", "alarm", "breach", "core", "surge"] }),
      shape: S("STRING", { enum: ["3:2", "4:3", "16:9", "1:1", "2:3"] }), cols: int, rows: int, read: str, notes: str, art: str,
      traps: S("ARRAY", { items: S("OBJECT", { properties: { kind: S("STRING", { enum: ["spikes", "bolt", "fire", "needle", "gas", "net", "pit", "rocks"] }), name: str, dc: int, x: int, y: int, size: int, clue: str }, required: ["kind", "name", "dc", "x", "y", "size", "clue"] }) }),
      chests: S("ARRAY", { items: S("OBJECT", { properties: { name: str, tpl: S("STRING", { enum: ["none", "rogue", "sea", "captain", "undead"] }), lock: int, x: int, y: int }, required: ["name", "tpl", "lock", "x", "y"] }) }),
      npcs: S("ARRAY", { items: S("OBJECT", { properties: { ref: str, name: str, sub: str, x: int, y: int, note: str, race: str, look: str, manner: str, wants: str, knows: str, secret: str, quote: str, art: str }, required: ["ref", "name", "sub", "x", "y", "note", "race", "look", "manner", "wants", "knows", "secret", "quote", "art"] }) }),
    }, required: ["name", "title", "sub", "mood", "shape", "cols", "rows", "read", "notes", "art", "traps", "chests", "npcs"] },
    hints: { mood: { label: "Настрій", opts: [["", "Хай вирішить сам"], ["warm", "Ліхтарі (інтер'єр)"], ["night", "Ніч"], ["fog", "Туман"], ["rain", "Дощ"], ["storm", "Шторм"], ["frost", "Сніг за вікном"], ["blizzard", "Хуртовина"], ["calm", "Тихе море"], ["dusk", "Захід"], ["day", "День"]] } },
    placeholder: "Напр.: вантажний вагон Полярного Експреса, бочки з печатками, двоє охоронців Ордену грають у кості; пастка-сітка над дверима",
    show: [["name", "Назва"], ["title", "Титр"], ["sub", "Підзаголовок"], ["mood", "Настрій"], ["shape", "Форма"], ["read", "Уголос"], ["notes", "Для майстра"], ["traps", "Пастки"], ["chests", "Скрині"], ["npcs", "NPC"], ["art", "Для мапи"]],
  },
  npcs: {
    rules: `Створи NPC для кампанії — живого персонажа, якого майстер легко відіграє.
- name — ім'я (пасує світу: моряки, портові міста, північ, церква й Орден). sub — хто це, 2–5 слів («боцман „Сірої Чайки“»). race — раса 5e українською. place — де його зустріти.
- look — вигляд, 1–2 речення, те, що одразу бачать гравці. manner — характер і манера говорити: звички, слівця, жести, 1–2 речення — щоб майстер одразу «почув» голос.
- wants — чого хоче саме зараз. knows — що знає й може розповісти героям (1–3 факти, зачіпки). secret — таємниця для майстра або порожньо. quote — характерна фраза.
- art — англійською: зовнішність, одяг, аксесуари, вираз обличчя, світло — для токена.`,
    schema: { type: "OBJECT", properties: { name: str, sub: str, race: str, place: str, look: str, manner: str, wants: str, knows: str, secret: str, quote: str, art: str }, required: ["name", "sub", "race", "place", "look", "manner", "wants", "knows", "secret", "quote", "art"] },
    hints: {},
    placeholder: "Напр.: провідник Полярного Експреса, гном-пліткар, бере хабарі чаєм; знає, у якому вагоні їде Орден",
    show: [["name", "Ім'я"], ["sub", "Хто це"], ["race", "Раса"], ["place", "Де"], ["look", "Вигляд"], ["manner", "Манера"], ["wants", "Хоче"], ["knows", "Знає"], ["secret", "Таємниця"], ["quote", "Фраза"], ["art", "Для токена"]],
  },
  court: {
    rules: `Створи КУРТИЗАНКУ — NPC елітного закладу втіх у портовому місті (усе пристойно, без відвертих сцен: шарм, розмова, таємниці).
- house — назва закладу (якщо не сказано — «Оксамитовий Ліхтар»). race — раса 5e українською. age — словами («молода», «близько тридцяти», «літня»).
- talent — чим славиться, 2–4 слова. price — ціна вечора в золотих (15–120).
- desc — вигляд і перше враження, 1–2 речення. about — характер і манери, 1–2 речення. likes — що любить отримувати чи про що говорити.
- quote — її характерна фраза. secret — таємниця для майстра: що вона знає чи приховує, як це чіпляє сюжет (кораблі, порти, Орден, контрабанда), 1–2 речення.
- art — англійською: зовнішність, одяг (повністю й елегантно вдягнена), аксесуари, вираз обличчя, світло.`,
    schema: { type: "OBJECT", properties: { name: str, house: str, race: str, age: str, talent: str, price: num, desc: str, about: str, likes: str, quote: str, secret: str, art: str }, required: ["name", "house", "race", "age", "talent", "price", "desc", "about", "likes", "quote", "secret", "art"] },
    hints: {},
    placeholder: "Напр.: стара гномка-ворожка з колодою карт, що бачила корабель-привид; знає більше, ніж каже",
    show: [["name", "Ім'я"], ["house", "Заклад"], ["race", "Раса"], ["age", "Вік"], ["talent", "Талант"], ["price", "Ціна, зм"], ["desc", "Вигляд"], ["about", "Характер"], ["likes", "До вподоби"], ["quote", "Фраза"], ["secret", "Таємниця"], ["art", "Для картинки"]],
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

export async function generate(kind, idea, hints, list, avoid = "", roster = null) {
  const key = (localStorage.getItem(GKEY) || "").replace(/\s+/g, "");
  if (!key) throw Object.assign(new Error("Потрібен ключ Gemini API"), { code: "nokey" });
  let model = localStorage.getItem(GMODEL) || DEFAULT_MODEL;
  const spec = SPECS[kind];
  const want = Object.entries(hints).filter(([, v]) => v).map(([k, v]) => `${k} = ${v}`).join(", ");
  const user = `Ідея майстра: ${idea}
${want ? `Обов'язково: ${want}.` : ""}
${avoid ? `Попередній варіант був «${avoid}» — зроби інший, не повторюйся.` : ""}
${roster ? (roster.length ? `NPC, які вже є в кампанії (якщо котрийсь пасує сцені — використай його: ref = його id, name і sub як тут, решту полів NPC залиш порожніми):
${JSON.stringify(roster)}` : "Готових NPC у кампанії ще немає — усі NPC нові.") : ""}
${list.length ? `Ось кілька карток із цієї ж книги — тримайся їхнього стилю, довжини й формату:
${JSON.stringify(examples(kind, list, hints), null, 1)}` : ""}`;
  const call = () => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${WORLD}\n\n${spec.rules}` }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: spec.schema, temperature: 1 },
    }),
  });
  let r = await call();
  let j = await r.json().catch(() => ({}));
  // Google зняв модель і сам підказує нову — переходимо на неї й запам'ятовуємо
  const next = /no longer available|not found/i.test(j?.error?.message || "") && (j.error.message.match(/models\/([\w.-]+)\s+for/) || [])[1];
  if (!r.ok && next && next !== model) {
    model = next;
    r = await call();
    j = await r.json().catch(() => ({}));
    if (r.ok) localStorage.setItem(GMODEL, model);
  }
  if (!r.ok) {
    const msg = j?.error?.message || `HTTP ${r.status}`;
    throw Object.assign(new Error(/quota|RESOURCE_EXHAUSTED/i.test(msg) ? "Gemini каже, що вичерпано ліміт — зачекай хвилину й спробуй ще (або вибери іншу модель нижче)" : /API key not valid|ACCESS_TOKEN_TYPE_UNSUPPORTED|UNAUTHENTICATED/i.test(msg) ? `Google не прийняв ключ (${key.slice(0, 3)}…, ${key.length} символів). Скопіюй його ще раз кнопкою копіювання в AI Studio. Відповідь Google: ${msg}` : /not found|no longer available/i.test(msg) ? `Модель «${model}» недоступна — впиши іншу в полі «Модель» нижче (наприклад, gemini-3.8-flash). Відповідь Google: ${msg}` : msg), { code: r.status });
  }
  const text = (j?.candidates?.[0]?.content?.parts ?? []).filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  try { return JSON.parse(text); }
  catch { throw new Error("Gemini відповів не так, як треба — спробуй ще раз"); }
}
