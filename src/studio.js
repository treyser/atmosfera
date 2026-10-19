// Майстерня: редактор наповнення «Атмосфери» (зброя, бестіарій, крамниці, лут).
// Читає й пише public/data/*.json і картинки прямо в репозиторій GitHub — одним комітом на «Опублікувати».
// Owlbear підтягує нове сам, щойно GitHub Pages перезбере сайт (~2 хвилини).
import "./studio.css";
import { SPECS, GKEY, GMODEL, generate } from "./studio-idea.js";

const REPO = "treyser/atmosfera";
const BRANCH = "main";
const SITE = new URL(import.meta.env.BASE_URL || "/atmosfera/", location.origin).href;
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}/public/`;
const TOKEN = "atmosfera.studio.token";
const DRAFT = "atmosfera.studio.draft";
const $ = (id) => document.getElementById(id);

// ---------- довідники ----------
const WGROUP = { simple: "🗡 Проста", martial: "⚔️ Бойова", ranged: "🏹 Дальня" };
const WRAR = { common: "Звичайна", uncommon: "Незвичайна", rare: "Рідкісна", legendary: "Легендарна" };
const RARC = { common: "#c9c2b0", uncommon: "#6fbf73", rare: "#5aa9ff", legendary: "#ff9d3a", trade: "#d9a3ff" };
const BIOME = { water: "🌊 Водяні та болотні", forest: "🌲 Лісові", mountain: "⛰ Гірські", fire: "🔥 Вогняні", undead: "💀 Нежить", folk: "⚔ Люди й універсальні" };
const RANK = { 1: "I — Масовка", 2: "II — Звичайний", 3: "III — Еліта", 4: "IV — Мінібос", 5: "V — Бос" };
const SCAT = { consum: "🧪 Витратне", gear: "🧭 Спорядження", weapon: "⚔️ Зброя й броня", magic: "✨ Незвичайне", curio: "🐚 Дивини", food: "🍞 Харчі" };
const SRAR = { common: "Звичайне", uncommon: "Незвичайне", rare: "Рідкісне", trade: "Лише обмін" };
const LCAT = { coin: "🪙 Монети", gear: "🧭 Спорядження", consum: "🧪 Витратне", weapon: "⚔️ Зброя", magic: "✨ Магічне", curio: "🐚 Дивина", food: "🍞 Харчі", gem: "💎 Самоцвіт", paper: "📜 Папір" };
const POOLS = { rogue: "Кишеня розбійника", sea: "Скриня моряка", captain: "Капітанська скриня", undead: "Скарб нежиті" };

const ITEM_STYLE = (what) => `Generate an image: fantasy RPG item card illustration of ${what}. The object lies diagonally in the center, fully visible with margin around it, on a dark weathered parchment background with soft vignette and warm candlelight rim lighting. Painterly dark-fantasy style, highly detailed, square 1:1. No text, no hands, no people, no frame.`;

// ---------- розділи ----------
const KINDS = {
  arsenal: {
    title: "Арсенал", file: "data/arsenal.json", dir: "arsenal", size: 512,
    items: (d) => d.items,
    filter: { all: "Уся зброя", ...Object.fromEntries(Object.entries(WRAR).map(([k, v]) => ["r:" + k, v])), ...Object.fromEntries(Object.entries(WGROUP).map(([k, v]) => ["g:" + k, v])) },
    match: (x, f) => f === "all" || (f.startsWith("r:") ? x.rarity === f.slice(2) : x.group === f.slice(2)),
    card: (x) => ({ title: x.name, sub: x.dmg, color: RARC[x.rarity] }),
    blank: () => ({ id: "w" + stamp36(), group: "martial", rarity: "common", name: "Нова зброя", dmg: "1к8 рубаюча", props: "", weight: 1, price: 10, desc: "", mech: "", quote: "", img: "" }),
    fields: [
      { k: "name", label: "Назва", w: 2 },
      { k: "group", label: "Вид", type: "select", opts: WGROUP },
      { k: "rarity", label: "Рідкість", type: "select", opts: WRAR },
      { k: "dmg", label: "Шкода", ph: "1к8+1 рубаюча" },
      { k: "weight", label: "Вага, кг", type: "number" },
      { k: "price", label: "Ціна, зм (0 — безцінна)", type: "number" },
      { k: "props", label: "Властивості", w: 3, ph: "Фехтувальна, легка, метальна (6/18 м)" },
      { k: "desc", label: "Опис — як виглядає", type: "area", w: 3 },
      { k: "mech", label: "Особливість — механіка (для незвичайної й вище)", type: "area", w: 3 },
      { k: "quote", label: "Цитата (без лапок)", type: "area", w: 3, rows: 2 },
      { k: "art", label: "Вигляд для картинки (англійською, не обов'язково)", type: "area", w: 3, rows: 2 },
    ],
    prompt: (x) => ITEM_STYLE(x.art ? `a single weapon — ${x.art}` : `a single weapon — «${x.name}»${x.desc ? ": " + x.desc : ""}`),
  },
  bestiary: {
    title: "Бестіарій", file: "data/bestiary.json", dir: "best", size: 384, removable: true,
    items: (d) => d.items,
    filter: { all: "Усі істоти", ...Object.fromEntries(Object.entries(BIOME).map(([k, v]) => ["b:" + k, v])) },
    match: (x, f) => f === "all" || x.biome === f.slice(2),
    card: (x) => ({ title: x.name, sub: `${RANK[x.rank] ?? ""} · ${x.type ?? ""}`, color: "#e8c27a", round: true }),
    blank: (d) => {
      const n = Math.max(0, ...d.items.map((c) => Number(c.n) || 0)) + 1;
      return { id: "b" + n, n, name: "Нова істота", type: "Звір", biome: "forest", rank: 1, ac: 12, hp: 10, xp: 25, speed: "9 м", traits: [], img: "", seen: "", lore: "", weak: "" };
    },
    fields: [
      { k: "name", label: "Ім'я", w: 2 },
      { k: "type", label: "Тип", ph: "Звір, Нежить, Фіенд…" },
      { k: "biome", label: "Середовище", type: "select", opts: BIOME },
      { k: "rank", label: "Ранг", type: "select", opts: RANK, num: true },
      { k: "speed", label: "Швидкість", ph: "9 м / політ 12 м" },
      { k: "ac", label: "КД", type: "number" },
      { k: "hp", label: "ХП", type: "number" },
      { k: "xp", label: "XP", type: "number" },
      { k: "traits", label: "Вміння й атаки — кожне з нового рядка", type: "lines", w: 3, rows: 6, ph: "Укус: +5, 1d10+3.\nКривавий нюх: перевага…" },
      { k: "seen", label: "Перше враження — гравці бачать, щойно зустріли", type: "area", w: 3 },
      { k: "lore", label: "Що відомо — після «Вивчили»", type: "area", w: 3 },
      { k: "weak", label: "Слабкості", type: "area", w: 3, rows: 2 },
      { k: "art", label: "Вигляд для картинки (англійською, не обов'язково)", type: "area", w: 3, rows: 2 },
    ],
    prompt: (x) => `Generate an image: top-down circular tabletop battle-map token of a fantasy creature — ${x.art ? x.art : `«${x.name}» (${x.type || "creature"})${x.seen ? ": " + x.seen : ""}`}. The creature fills the circle, seen from above at a slight angle, dramatic lighting, painterly dark-fantasy style, highly detailed, inside an ornate copper-bronze ring border on a plain dark background. Square 1:1. No text.`,
  },
  shops: {
    title: "Крамниці", file: "data/shops.json", dir: "shop", size: 512, removable: true,
    filter: { all: "Усі товари", ...Object.fromEntries(Object.entries(SCAT).map(([k, v]) => ["c:" + k, v])) },
    match: (x, f) => x._shop || f === "all" || x.cat === f.slice(2),
    card: (x) => (x._shop ? { title: "⚙ Сама крамниця", sub: `${x.owner || "без власника"} · вітрина й опис`, color: "#e8c27a", head: true } : { title: x.name, sub: `${x.price ?? 0} зм · ${x.qty ?? 0} шт.`, color: RARC[x.rarity] }),
    blank: () => ({ id: "i" + stamp36(), cat: "gear", rarity: "common", name: "Новий товар", price: 10, qty: 1, desc: "", mech: "", quote: "", img: "" }),
    fields: [
      { k: "name", label: "Назва товару", w: 2 },
      { k: "cat", label: "Розділ", type: "select", opts: SCAT },
      { k: "rarity", label: "Рідкість", type: "select", opts: SRAR },
      { k: "price", label: "Ціна, зм", type: "number" },
      { k: "qty", label: "Скільки в наявності", type: "number" },
      { k: "desc", label: "Опис", type: "area", w: 3 },
      { k: "mech", label: "Механіка", type: "area", w: 3 },
      { k: "quote", label: "Що каже продавець (без лапок)", type: "area", w: 3, rows: 2 },
      { k: "art", label: "Вигляд для картинки (англійською, не обов'язково)", type: "area", w: 3, rows: 2 },
    ],
    shopFields: [
      { k: "name", label: "Назва крамниці", w: 2 },
      { k: "owner", label: "Власник" },
      { k: "about", label: "Опис крамниці", type: "area", w: 3 },
      { k: "greet", label: "Привітання власника", type: "area", w: 3, rows: 2 },
      { k: "buy", label: "Скуповує за частку ціни (0,5 = половина)", type: "number", step: 0.05 },
      { k: "bg", label: "Фон крамниці — адреса картинки (не обов'язково)", w: 2 },
    ],
    prompt: (x) => (x._shop
      ? `Generate an image: portrait of a fantasy shopkeeper — ${x.owner || "a merchant"}, owner of the shop «${x.name}». ${x.about || ""} Chest-up portrait behind a cluttered counter, warm candlelight, painterly dark-fantasy style, highly detailed, square 1:1. No text.`
      : ITEM_STYLE(x.art ? `a single item — ${x.art}` : `a single item — «${x.name}»${x.desc ? ": " + x.desc : ""}`)),
  },
  loot: {
    title: "Лут для скринь", file: "data/loot.json", dir: "loot", size: 512,
    items: (d) => d.items,
    filter: { all: "Усі знахідки", ...Object.fromEntries(Object.entries(POOLS).map(([k, v]) => ["p:" + k, v])) },
    match: (x, f) => f === "all" || (x.pools ?? []).includes(f.slice(2)),
    card: (x) => ({ title: x.name, sub: `${LCAT[x.cat] ?? ""} · ${x.price ?? 0} зм`, color: "#d9c9a3" }),
    blank: () => ({ id: "l" + stamp36(), name: "Нова знахідка", cat: "curio", price: 1, pools: ["rogue"], desc: "", mech: "", img: "" }),
    fields: [
      { k: "name", label: "Назва", w: 2 },
      { k: "cat", label: "Що це", type: "select", opts: LCAT },
      { k: "price", label: "Ціна, зм", type: "number" },
      { k: "pools", label: "У яких скринях трапляється", type: "checks", opts: POOLS, w: 2 },
      { k: "desc", label: "Опис", type: "area", w: 3 },
      { k: "mech", label: "Механіка (не обов'язково)", type: "area", w: 3, rows: 2 },
      { k: "art", label: "Вигляд для картинки (англійською, не обов'язково)", type: "area", w: 3, rows: 2 },
    ],
    prompt: (x) => ITEM_STYLE(x.art ? `a single found treasure item — ${x.art}` : `a single found treasure item — «${x.name}»${x.desc ? ": " + x.desc : ""}`),
  },
  court: {
    title: "Куртизанки", file: "data/court.json", dir: "court", size: 512, removable: true,
    items: (d) => d.items,
    filter: { all: "Усі дами" },
    match: () => true,
    card: (x) => ({ title: x.name, sub: [x.house, x.talent].filter(Boolean).join(" · "), color: "#d98aa8", round: true }),
    blank: () => ({ id: "c" + stamp36(), name: "Нова дама", house: "Оксамитовий Ліхтар", race: "Людина", age: "", talent: "", price: 30, desc: "", about: "", likes: "", quote: "", secret: "", img: "" }),
    fields: [
      { k: "name", label: "Ім'я", w: 2 },
      { k: "house", label: "Заклад" },
      { k: "race", label: "Раса" },
      { k: "age", label: "Вік", ph: "молода, літня, близько тридцяти…" },
      { k: "price", label: "Ціна вечора, зм (0 — за домовленістю)", type: "number" },
      { k: "talent", label: "Талант — чим славиться", w: 3, ph: "Спів і лютня, карти, чутки…" },
      { k: "desc", label: "Вигляд — перше враження", type: "area", w: 3 },
      { k: "about", label: "Характер і манери", type: "area", w: 3 },
      { k: "likes", label: "Що їй до вподоби (подарунки, теми)", type: "area", w: 3, rows: 2 },
      { k: "quote", label: "Її фраза (без лапок)", type: "area", w: 3, rows: 2 },
      { k: "secret", label: "Таємниця — бачить лише майстер (гачок для сюжету)", type: "area", w: 3 },
      { k: "art", label: "Вигляд для картинки (англійською, не обов'язково)", type: "area", w: 3, rows: 2 },
    ],
    prompt: (x) => `Generate an image: top-down circular tabletop battle-map token of a fantasy character — ${x.art ? x.art : `an elegant ${x.race || "human"} courtesan «${x.name}», fully and tastefully dressed${x.desc ? ": " + x.desc : ""}`}. Chest-up portrait filling the circle, warm candlelight, painted fantasy illustration style, rich detail, inside an ornate copper-bronze ring border on a plain dark background. Square 1:1. No text.`,
  },
};

// ---------- стан ----------
let token = "";
let kind = "arsenal";
let sel = null;          // id вибраної картки (у крамницях: "@shop" — сама крамниця)
let shopId = null;
let filter = "all";
let st = { data: {}, sha: {}, dirty: {}, images: {} };   // data — JSON розділів; images — шлях → dataURL нової картинки

const stamp36 = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 4);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const ls = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); return true; } catch { return false; } };

function saveDraft() {
  if (!lsSet(DRAFT, JSON.stringify(st))) toast("Чернетка завелика для браузера — опублікуй, щоб не загубити картинки");
}
function loadDraft() {
  try { const d = JSON.parse(ls(DRAFT) || "null"); if (d?.data) st = { data: {}, sha: {}, dirty: {}, images: {}, ...d }; } catch {}
}

// ---------- GitHub ----------
async function gh(path, opt = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
    ...opt,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opt.body ? { "Content-Type": "application/json" } : {}), ...(opt.headers ?? {}) },
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    const e = new Error(j.message || `HTTP ${r.status}`);
    e.status = r.status;
    throw e;
  }
  return r.status === 204 ? null : r.json();
}
const b64utf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), (c) => c.charCodeAt(0)));

async function fetchKind(k) {
  const meta = await gh(`/contents/public/${KINDS[k].file}?ref=${BRANCH}`).catch((e) => { if (e.status === 404) return null; throw e; });
  if (!meta) return { data: { v: 1, stamp: 0, items: [], removed: [] }, sha: null };
  let text;
  if (meta.content) text = b64utf8(meta.content);
  else text = new TextDecoder().decode(new Uint8Array(await (await fetch(meta.download_url + "?t=" + Date.now())).arrayBuffer()));
  return { data: JSON.parse(text), sha: meta.sha };
}

async function loadAll(force = false) {
  for (const k of Object.keys(KINDS)) {
    if (!force && st.dirty[k] && st.data[k]) continue;   // незбережена чернетка — не чіпаємо
    const { data, sha } = await fetchKind(k);
    st.data[k] = data; st.sha[k] = sha; st.dirty[k] = false;
  }
  if (force) st.images = {};
  saveDraft();
}

// ---------- старт ----------
init();
async function init() {
  token = ls(TOKEN);
  loadDraft();
  for (const [k, v] of Object.entries(KINDS)) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.k = k; b.textContent = v.title;
    b.onclick = () => { kind = k; sel = null; filter = "all"; $("q").value = ""; draw(); };
    $("tabs").appendChild(b);
  }
  $("gear").onclick = () => showLogin(true);
  $("save-token").onclick = connect;
  $("token").addEventListener("keydown", (e) => { if (e.key === "Enter") connect(); });
  $("forget").onclick = () => { lsSet(TOKEN, null); token = ""; showLogin(true); $("login-msg").textContent = "Ключ забуто."; };
  $("q").addEventListener("input", drawList);
  $("filter").onchange = () => { filter = $("filter").value; drawList(); };
  $("add").onclick = addItem;
  $("dup").onclick = dupItem;
  $("del").onclick = delItem;
  $("publish").onclick = publish;
  $("discard").onclick = discard;
  $("shop-pick").onchange = () => { shopId = $("shop-pick").value; sel = "@shop"; draw(); };
  $("shop-add").onclick = addShop;
  initPic();
  initIdea();
  window.addEventListener("beforeunload", (e) => { if (Object.values(st.dirty).some(Boolean)) { e.preventDefault(); e.returnValue = ""; } });
  if (!token) return showLogin(false);
  await start();
}

function showLogin(canClose) {
  $("login").hidden = false; $("work").hidden = true;
  $("forget").hidden = !token;
  $("token").value = "";
  $("login").onclick = canClose && token ? (e) => { if (e.target === $("login")) { $("login").hidden = true; $("work").hidden = false; } } : null;
}

async function connect() {
  const t = $("token").value.replace(/\s+/g, "");
  if (!t) return;
  if (/^AIza/.test(t)) { $("login-msg").textContent = "Це ключ Gemini (AIza…). Тут потрібен ключ GitHub — він починається з github_pat_."; return; }
  if (!/^(github_pat_|ghp_)/.test(t)) { $("login-msg").textContent = "Схоже, скопійовано не ключ: ключ GitHub починається з github_pat_ (або ghp_)."; return; }
  if (t.startsWith("github_pat_") && t.length < 80) { $("login-msg").textContent = `Ключ закороткий (${t.length} символів, має бути ~93) — мабуть, скопійовано не повністю. Скопіюй ще раз кнопкою копіювання поруч із ключем на GitHub.`; return; }
  $("login-msg").textContent = "Перевіряю…";
  token = t;
  try {
    const repo = await gh("");
    if (!repo.permissions?.push) throw new Error("ключ не дає права запису (Contents → Read and write)");
    lsSet(TOKEN, t);
    $("login-msg").textContent = "";
    await start();
  } catch (e) {
    token = ls(TOKEN);
    $("login-msg").textContent = e.status === 401
      ? `GitHub не прийняв ключ (${t.length} символів). Перевір, що копіюєш саме щойно створений ключ кнопкою копіювання, і що в нього не минув термін. Якщо не допомагає — створи новий.`
      : e.status === 404 || e.status === 403
        ? "Ключ дійсний, але не має доступу до atmosfera: при створенні вибери Only select repositories → atmosfera і Contents → Read and write."
        : `Не вийшло: ${e.message}`;
  }
}

async function start() {
  $("login").hidden = true; $("work").hidden = false;
  $("list").innerHTML = `<div class="dim pad">Завантажую з GitHub…</div>`;
  try {
    await loadAll(false);
  } catch (e) {
    if (e.status === 401) { lsSet(TOKEN, null); token = ""; showLogin(false); $("login-msg").textContent = "Ключ більше не діє — створи новий."; return; }
    $("list").innerHTML = `<div class="dim pad">Не вдалося завантажити: ${esc(e.message)}</div>`;
    return;
  }
  draw();
}

// ---------- списки ----------
function shopsData() { return st.data.shops?.shops ?? []; }
function curShop() {
  const list = shopsData();
  return list.find((s) => s.id === shopId) ?? list[0] ?? null;
}
function itemsOf(k = kind) {
  if (k === "shops") { const s = curShop(); return s ? s.items : []; }
  return KINDS[k].items(st.data[k] ?? { items: [] }) ?? [];
}
function current() {
  if (kind === "shops" && sel === "@shop") { const s = curShop(); return s ? Object.assign(s, { _shop: true }) : null; }
  return itemsOf().find((x) => x.id === sel) ?? null;
}

function draw() {
  for (const b of $("tabs").children) b.classList.toggle("on", b.dataset.k === kind);
  const K = KINDS[kind];
  $("filter").innerHTML = Object.entries(K.filter).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("");
  $("filter").value = filter;
  $("shopbar").hidden = kind !== "shops";
  if (kind === "shops") {
    const list = shopsData();
    shopId = curShop()?.id ?? null;
    $("shop-pick").innerHTML = list.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join("");
    $("shop-pick").value = shopId;
    $("add").textContent = "＋ Додати товар";
  } else $("add").textContent = KINDS[kind].title === "Бестіарій" ? "＋ Додати істоту" : "＋ Додати";
  drawList();
  drawForm();
  drawDirty();
}

function drawList() {
  const K = KINDS[kind];
  const q = $("q").value.trim().toLowerCase();
  const box = $("list");
  box.innerHTML = "";
  let rows = itemsOf();
  if (kind === "shops" && curShop()) rows = [{ ...curShop(), id: "@shop", _shop: true }, ...rows];
  let n = 0;
  for (const x of rows) {
    if (!K.match(x, filter)) continue;
    if (q && !x._shop && !String(x.name ?? "").toLowerCase().includes(q)) continue;
    if (!x._shop) n++;
    const c = K.card(x);
    const el = document.createElement("button");
    el.type = "button";
    el.className = `row${x.id === sel ? " sel" : ""}${c.head ? " head" : ""}`;
    el.style.setProperty("--rc", c.color || "#e8c27a");
    const src = imgSrc(x._shop ? curShop()?.img : x.img);
    el.innerHTML = `<span class="th${c.round ? " round" : ""}">${src ? `<img loading="lazy" alt="" src="${esc(src)}" onerror="this.remove()">` : ""}</span>
      <span class="tx"><b>${esc(c.title)}</b><small>${esc(c.sub)}</small></span>${isNew(x) ? `<i class="dot" title="Змінено, не опубліковано"></i>` : ""}`;
    el.onclick = () => { sel = x.id; drawList(); drawForm(); };
    box.appendChild(el);
  }
  $("count").textContent = `${n} з ${rows.length - (kind === "shops" && rows.length ? 1 : 0)}`;
}
const isNew = (x) => x._dirty;

// картинка: нова (ще не опублікована) — з чернетки, стара — свіжа з GitHub
function imgSrc(p) {
  if (!p) return "";
  if (st.images[p]) return st.images[p];
  if (/^(https?:|data:)/.test(p)) return p;
  return RAW + p;
}

// ---------- форма ----------
function drawForm() {
  const x = current();
  $("empty").hidden = Boolean(x);
  $("form").hidden = !x;
  if (!x) return;
  const K = KINDS[kind];
  const fields = x._shop ? K.shopFields : K.fields;
  const box = $("fields");
  box.innerHTML = "";
  for (const f of fields) {
    const wrap = document.createElement("label");
    wrap.className = `fld w${f.w ?? 1}`;
    wrap.innerHTML = `<span>${esc(f.label)}</span>`;
    let inp;
    const val = x[f.k];
    if (f.type === "select") {
      inp = document.createElement("select");
      for (const [k, v] of Object.entries(f.opts)) inp.appendChild(new Option(v, k));
      inp.value = String(val ?? "");
    } else if (f.type === "area" || f.type === "lines") {
      inp = document.createElement("textarea");
      inp.rows = f.rows ?? 3;
      inp.value = f.type === "lines" ? (val ?? []).join("\n") : val ?? "";
    } else if (f.type === "checks") {
      inp = document.createElement("div");
      inp.className = "checks";
      for (const [k, v] of Object.entries(f.opts)) {
        const l = document.createElement("label");
        l.innerHTML = `<input type="checkbox" value="${k}"${(val ?? []).includes(k) ? " checked" : ""}> ${esc(v)}`;
        inp.appendChild(l);
      }
    } else {
      inp = document.createElement("input");
      inp.type = f.type === "number" ? "number" : "text";
      if (f.step) inp.step = f.step;
      inp.value = val ?? "";
    }
    if (f.ph) inp.placeholder = f.ph;
    const read = () => {
      if (f.type === "checks") return [...inp.querySelectorAll("input:checked")].map((c) => c.value);
      if (f.type === "lines") return inp.value.split("\n").map((t) => t.trim()).filter(Boolean);
      if (f.type === "number" || f.num) return inp.value === "" ? 0 : Number(String(inp.value).replace(",", "."));
      return f.type === "area" ? inp.value.trim() : inp.value;
    };
    inp.addEventListener(f.type === "select" || f.type === "checks" ? "change" : "input", () => {
      x[f.k] = read();
      touch(x);
      if (f.k === "name" || f.k === "price" || f.k === "qty" || f.k === "dmg" || f.k === "rarity" || f.k === "cat" || f.k === "rank" || f.k === "type" || f.k === "owner") drawListSoon();
      if (["name", "desc", "type", "seen", "owner", "about", "art"].includes(f.k)) $("prompt").value = K.prompt(x);
    });
    wrap.appendChild(inp);
    box.appendChild(wrap);
  }
  showPic(imgSrc(x.img));
  $("prompt").value = K.prompt(x);
  $("trim").checked = false;
  $("dup").hidden = Boolean(x._shop);
  $("del").textContent = x._shop ? "Видалити крамницю" : "Видалити";
  $("item-state").textContent = x._dirty ? "змінено — не забудь «Опублікувати»" : x.rev > 1 ? `востаннє змінено ${new Date(x.rev).toLocaleString("uk-UA")}` : "";
}
let listTimer = null;
const drawListSoon = () => { clearTimeout(listTimer); listTimer = setTimeout(drawList, 250); };

// позначити картку зміненою
function touch(x) {
  x.rev = Date.now();
  x._dirty = true;
  if (x._shop) delete x._shopTmp;
  st.dirty[kind] = true;
  saveDraftSoon();
  drawDirty();
  $("item-state").textContent = "змінено — не забудь «Опублікувати»";
}
let draftTimer = null;
const saveDraftSoon = () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 400); };

function drawDirty() {
  const n = Object.values(st.dirty).filter(Boolean).length;
  const imgs = Object.keys(st.images).length;
  $("dirty").hidden = !n;
  $("dirty").textContent = n ? `Не опубліковано: ${Object.entries(st.dirty).filter(([, v]) => v).map(([k]) => KINDS[k].title).join(", ")}${imgs ? ` · картинок: ${imgs}` : ""}` : "";
  $("publish").disabled = !n;
  $("discard").hidden = !n;
}

// ---------- додати / дублювати / видалити ----------
function addItem() {
  const K = KINDS[kind];
  if (kind === "shops" && !curShop()) return addShop();
  const x = K.blank(st.data[kind]);
  itemsOf().unshift(x);
  sel = x.id;
  filter = "all"; $("q").value = "";
  touch(x);
  draw();
  setTimeout(() => $("fields").querySelector("input")?.select(), 30);
}
function dupItem() {
  const x = current();
  if (!x || x._shop) return;
  const K = KINDS[kind];
  const blank = K.blank(st.data[kind]);
  const copy = { ...structuredClone(x), id: blank.id, n: blank.n, name: x.name + " (копія)" };
  if (blank.n === undefined) delete copy.n;
  const list = itemsOf();
  list.splice(list.indexOf(x) + 1, 0, copy);
  sel = copy.id;
  touch(copy);
  draw();
}
let delArmed = 0;
function delItem() {
  const x = current();
  if (!x) return;
  if (Date.now() - delArmed > 3000) { delArmed = Date.now(); $("del").textContent = "Точно? Натисни ще раз"; return; }
  delArmed = 0;
  if (x._shop) {
    const d = st.data.shops;
    if (d.shops.length < 2) return toast("Остання крамниця — її не видаляємо");
    d.shops = d.shops.filter((s) => s.id !== x.id);
    (d.removed ??= []).push(x.id);
    shopId = d.shops[0].id;
  } else {
    if (kind === "shops") { const s = curShop(); s.items = s.items.filter((i) => i !== x); (s.removed ??= []).push(x.id); s.rev = Date.now(); }
    else {
      const d = st.data[kind];
      d.items = d.items.filter((i) => i !== x);
      if (KINDS[kind].removable) (d.removed ??= []).push(x.id);
    }
  }
  sel = null;
  st.dirty[kind] = true;
  saveDraft();
  draw();
  toast(`«${x.name}» видалено — з'явиться в Owlbear після публікації`);
}
function addShop() {
  const s = { id: "s" + stamp36(), name: "Нова крамниця", owner: "", about: "", greet: "", img: "", bg: "", buy: 0.5, items: [], removed: [], rev: Date.now(), _dirty: true };
  st.data.shops.shops.push(s);
  shopId = s.id; sel = "@shop";
  st.dirty.shops = true;
  saveDraft();
  draw();
}

async function discard() {
  if (!confirm("Скасувати всі неопубліковані зміни й завантажити те, що зараз на GitHub?")) return;
  try { await loadAll(true); } catch (e) { return toast("Не вдалося: " + e.message); }
  sel = null;
  draw();
  toast("Зміни скасовано");
}

// ---------- картинки ----------
function initPic() {
  $("drop").onclick = () => $("file").click();
  $("pick-file").onclick = () => $("file").click();
  $("file").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) takeImage(f); };
  $("drop").addEventListener("dragover", (e) => { e.preventDefault(); $("drop").classList.add("over"); });
  $("drop").addEventListener("dragleave", () => $("drop").classList.remove("over"));
  $("drop").addEventListener("drop", (e) => {
    e.preventDefault(); $("drop").classList.remove("over");
    const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith("image/"));
    if (f) takeImage(f);
  });
  document.addEventListener("paste", (e) => {
    if ($("form").hidden) return;
    const f = [...(e.clipboardData?.items ?? [])].find((i) => i.type.startsWith("image/"))?.getAsFile();
    if (!f) return;
    e.preventDefault();
    takeImage(f);
  });
  $("pic-clear").onclick = () => { const x = current(); if (!x) return; x.img = ""; touch(x); showPic(""); drawList(); };
  $("copy-prompt").onclick = async () => {
    try { await navigator.clipboard.writeText($("prompt").value); toast("Підказку скопійовано — встав у Gemini"); }
    catch { $("prompt").select(); document.execCommand("copy"); toast("Підказку скопійовано"); }
  };
}
function showPic(src) {
  $("pic").hidden = !src;
  if (src) $("pic").src = src; else $("pic").removeAttribute("src");
  $("pic-hint").hidden = Boolean(src);
}

// будь-яка картинка → квадрат webp (центр), за бажанням без країв
async function takeImage(file) {
  const x = current();
  if (!x) return;
  const K = KINDS[kind];
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const m = $("trim").checked ? Math.round(side * 0.05) : 0;
    const sx = (bmp.width - side) / 2 + m, sy = (bmp.height - side) / 2 + m, s = side - 2 * m;
    const n = Math.min(K.size, s);
    const c = document.createElement("canvas");
    c.width = c.height = n;
    c.getContext("2d").drawImage(bmp, sx, sy, s, s, 0, 0, n, n);
    const url = c.toDataURL("image/webp", 0.84);
    const slug = x._shop ? `${x.id}` : kind === "shops" ? `${curShop().id}-${x.id}` : x.id;
    const path = `${K.dir}/${slug}-${stamp36()}.webp`;   // нове ім'я щоразу — щоб ніде не залишилась стара з кешу
    if (st.images[x.img]) delete st.images[x.img];
    st.images[path] = url;
    x.img = path;
    touch(x);
    showPic(url);
    drawList();
    toast(`Картинку додано (${Math.round(url.length * 0.75 / 1024)} КБ)`);
  } catch (e) {
    toast("Не вдалося прочитати картинку");
  }
}

// ---------- публікація ----------
async function publish() {
  const kinds = Object.keys(st.dirty).filter((k) => st.dirty[k]);
  if (!kinds.length) return;
  const btn = $("publish");
  btn.disabled = true;
  btn.textContent = "Публікую…";
  try {
    const ref = await gh(`/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const commit = await gh(`/git/commits/${head}`);
    // хтось змінив файл на GitHub, поки ти редагував?
    for (const k of kinds) {
      const meta = await gh(`/contents/public/${KINDS[k].file}?ref=${head}`).catch(() => null);
      if (meta && st.sha[k] && meta.sha !== st.sha[k]) throw new Error(`«${KINDS[k].title}» змінено на GitHub з іншого місця. Натисни «Скасувати зміни», щоб завантажити свіжу версію (твої правки зникнуть), або напиши Claude.`);
    }
    const tree = [];
    const used = new Set(kinds.flatMap((k) => JSON.stringify(st.data[k]).match(/[a-z]+\/[\w-]+\.webp/g) ?? []));
    for (const [path, url] of Object.entries(st.images)) {
      if (!used.has(path)) continue;
      const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify({ content: url.split(",")[1], encoding: "base64" }) });
      tree.push({ path: "public/" + path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const now = Date.now();
    for (const k of kinds) {
      st.data[k].stamp = now;
      tree.push({ path: "public/" + KINDS[k].file, mode: "100644", type: "blob", content: JSON.stringify(clean(st.data[k]), null, 1) + "\n" });
    }
    const t = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
    const names = kinds.map((k) => KINDS[k].title).join(", ");
    const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: `Майстерня: ${names}`, tree: t.sha, parents: [head] }) });
    await gh(`/git/refs/heads/${BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
    // нові sha файлів, чистимо позначки
    for (const k of kinds) {
      const meta = await gh(`/contents/public/${KINDS[k].file}?ref=${c.sha}`);
      st.sha[k] = meta.sha;
      st.dirty[k] = false;
      st.data[k] = clean(st.data[k]);
    }
    for (const p of [...used]) delete st.images[p];
    if (!Object.values(st.dirty).some(Boolean)) st.images = {};
    saveDraft();
    draw();
    toast(`Опубліковано: ${names}. Сайт оновиться за ~2 хвилини`, 6000);
    watchSite(kinds, now);
  } catch (e) {
    toast("Не опубліковано: " + e.message, 9000);
  } finally {
    btn.textContent = "Опублікувати";
    drawDirty();
  }
}
// без службових позначок редактора
function clean(d) {
  return JSON.parse(JSON.stringify(d, (k, v) => (k === "_dirty" || k === "_shop" || k === "_shopTmp" ? undefined : v)));
}

// чекаємо, доки GitHub Pages віддасть нову версію
async function watchSite(kinds, stamp) {
  const pill = $("dirty");
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 15000));
    try {
      const ok = await Promise.all(kinds.map(async (k) => (await (await fetch(`${SITE}${KINDS[k].file}?t=${Date.now()}`, { cache: "no-store" })).json()).stamp === stamp));
      if (ok.every(Boolean)) {
        toast("✓ Уже на сайті — в Owlbear нове з'явиться, щойно відкриєш відповідне вікно", 8000);
        return;
      }
    } catch {}
    if (pill.hidden) { pill.hidden = false; pill.textContent = "Сайт оновлюється…"; pill.classList.add("wait"); }
  }
}

let toastTimer = null;
function toast(text, ms = 3200) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), ms);
  if (/Уже на сайті/.test(text)) { $("dirty").classList.remove("wait"); drawDirty(); }
}

// ---------- ✨ З ідеї ----------
let idea = null;   // останній результат
function initIdea() {
  $("idea-open").onclick = openIdea;
  $("idea-close").onclick = () => ($("idea").hidden = true);
  $("idea").addEventListener("click", (e) => { if (e.target === $("idea")) $("idea").hidden = true; });
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("idea").hidden) $("idea").hidden = true; });
  $("idea-key").onchange = () => { lsSet(GKEY, $("idea-key").value.replace(/\s+/g, "") || null); keyState(); };
  $("idea-model").onchange = () => lsSet(GMODEL, $("idea-model").value.trim() || null);
  $("idea-go").onclick = () => runIdea("");
  $("idea-again").onclick = () => runIdea(idea?.name ?? "");
  $("idea-text").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) runIdea(""); });
  $("idea-new").onclick = () => applyIdea(true);
  $("idea-fill").onclick = () => applyIdea(false);
}
function keyState() {
  const has = Boolean(ls(GKEY));
  $("idea-keystate").textContent = has ? "· збережено" : "· потрібен";
  if (!has) $("idea-keybox").open = true;
}
function openIdea() {
  const spec = SPECS[kind];
  if (kind === "shops" && !curShop()) return toast("Спершу створи крамницю");
  $("idea-title").textContent = `✨ ${{ arsenal: "Зброя", bestiary: "Істота", loot: "Знахідка", shops: "Товар", court: "Дама" }[kind]} з ідеї`;
  $("idea-text").placeholder = spec.placeholder;
  const box = $("idea-hints");
  box.innerHTML = "";
  for (const [k, h] of Object.entries(spec.hints)) {
    const l = document.createElement("label");
    l.innerHTML = `<span>${esc(h.label)}</span>`;
    const sel = document.createElement("select");
    sel.dataset.k = k;
    for (const [v, t] of h.opts) sel.appendChild(new Option(t, v));
    l.appendChild(sel);
    box.appendChild(l);
  }
  $("idea-key").value = ls(GKEY);
  $("idea-model").value = ls(GMODEL);
  keyState();
  $("idea-result").hidden = true; $("idea-acts").hidden = true; $("idea-status").textContent = "";
  $("idea-fill").hidden = !current() || Boolean(current()?._shop);
  $("idea").hidden = false;
  setTimeout(() => $("idea-text").focus(), 30);
}
async function runIdea(avoid) {
  const text = $("idea-text").value.trim();
  if (!text) { $("idea-text").focus(); return; }
  const hints = Object.fromEntries([...$("idea-hints").querySelectorAll("select")].map((s) => [s.dataset.k, s.value]));
  $("idea-go").disabled = true; $("idea-again").disabled = true;
  $("idea-status").innerHTML = `<i class="spin"></i>Gemini думає… (10–30 с)`;
  try {
    const list = itemsOf().filter((x) => !x._shop);
    idea = await generate(kind, text, hints, list.length ? list : itemsOf("arsenal"), avoid);
    showIdea();
    $("idea-status").textContent = "";
  } catch (e) {
    $("idea-status").textContent = e.message;
    if (e.code === "nokey" || /ключ/i.test(e.message)) { $("idea-keybox").open = true; $("idea-key").focus(); }
  } finally {
    $("idea-go").disabled = false; $("idea-again").disabled = false;
  }
}
function label(k, v) {
  const f = [...(KINDS[kind].fields ?? [])].find((x) => x.k === k);
  if (Array.isArray(v)) return f?.opts ? v.map((x) => f.opts[x] ?? x).join(", ") : v.join("\n");
  if (f?.opts) return f.opts[v] ?? v;
  return v;
}
function showIdea() {
  const box = $("idea-result");
  box.innerHTML = "";
  for (const [k, t] of SPECS[kind].show) {
    const v = idea[k];
    if (v === "" || v == null || (Array.isArray(v) && !v.length)) continue;
    box.insertAdjacentHTML("beforeend", `<dt>${esc(t)}</dt><dd class="${k === "name" ? "big" : ""}">${esc(label(k, v))}</dd>`);
  }
  box.hidden = false;
  $("idea-acts").hidden = false;
  setTimeout(() => $("idea-acts").scrollIntoView({ behavior: "smooth", block: "end" }), 60);
  $("idea-fill").hidden = !current() || Boolean(current()?._shop);
}
function applyIdea(asNew) {
  if (!idea) return;
  const K = KINDS[kind];
  const data = { ...idea };
  if (kind === "bestiary") data.rank = Math.min(5, Math.max(1, Number(data.rank) || 1));
  if (asNew) {
    const x = { ...K.blank(st.data[kind]), ...data };
    itemsOf().unshift(x);
    sel = x.id;
    filter = "all"; $("q").value = "";
    touch(x);
  } else {
    const x = current();
    if (!x || x._shop) return;
    Object.assign(x, data);
    touch(x);
  }
  $("idea").hidden = true;
  draw();
  setTimeout(() => $("form").scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  toast(asNew ? "Картку створено — додай картинку й натисни «Опублікувати»" : "Картку заповнено");
}
