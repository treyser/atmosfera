// Крамниця: вітрина для гравців, редактор і пропозиції для майстра.
// Купівля: гравець натискає «Купити» → майстер (його фоновий скрипт) знімає товар з полиці → у покупця
// фоновий скрипт сам списує гроші й кладе річ у спорядження листа персонажа.
import OBR from "@owlbear-rodeo/sdk";
import "./shop.css";
import { SHOP, SHOP_DATA, SHOP_REQ, SHOP_BUY, SHOP_SOLD, SHOP_OFFER, SHOP_DEAL } from "./state.js";
import { local, saveLocal, uid, bytes, LIMIT } from "./log.js";
import {
  SHOPS, OFFERS, SEEN, CATS, RARITY, shops, saveShops, syncShops, newShop, newItem,
  priceCp, money, purse, readSheet, sheetKey,
} from "./shop-data.js";

const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let me = { id: "", name: "" };
let meta = {};          // з кімнати: { open, id, name, discount, rev }
let shop = null;        // крамниця, яку зараз показуємо
let cat = "all";
let pick = null;        // id вибраного товару
let mode = "view";
let waiting = false;    // чекаємо відповіді на купівлю

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  me = { id: await OBR.player.getId(), name: await OBR.player.getName() };
  meta = (await OBR.room.getMetadata())[SHOP] ?? {};

  $("gmbar").hidden = !gm;
  $("pclose").hidden = gm;
  document.body.classList.toggle("gm", gm);
  for (const b of [$("close"), $("pclose")]) b.onclick = () => OBR.modal.close(SHOP);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) OBR.modal.close(SHOP); });
  $("buy").onclick = buy;
  $("sell").onclick = () => { $("sellbox").hidden = !$("sellbox").hidden; fillSell(); };
  $("sell-go").onclick = offer;

  OBR.room.onMetadataChange((m) => { meta = m[SHOP] ?? {}; if (!gm) loadPlayer(); else drawGM(); });
  window.addEventListener("storage", (e) => {
    if (e.key === sheetKey(room)) drawPurse();
    if (!gm && e.key === SEEN) loadPlayer();
    if (gm && e.key === SHOPS) { shop = shops().find((s) => s.id === shop?.id) ?? shops()[0]; drawGM(); }
    if (gm && e.key === OFFERS) drawOffers();
  });
  OBR.broadcast.onMessage(SHOP_SOLD, (event) => {
    const d = event.data ?? {};
    if (d.to !== me.id) return;
    waiting = false;
    toast(d.ok ? `Куплено: ${d.item.name} за ${money(d.cp)}` : d.why || "Не вийшло купити");
    drawDetail();
  });
  OBR.broadcast.onMessage(SHOP_DEAL, (event) => {
    const d = event.data ?? {};
    if (d.to !== me.id) return;
    toast(d.ok ? `${shop?.owner || "Торговець"} купує «${d.name}» за ${money(d.cp)}` : `${shop?.owner || "Торговець"} не хоче купувати «${d.name}»`);
  });

  if (gm) initGM();
  else loadPlayer();
});

// ---------- Гравець ----------

function loadPlayer() {
  if (!meta.open) { shop = null; drawStore(); return; }
  const seen = local(SEEN, null);
  if (seen?.id === meta.id) { shop = seen; drawStore(); return; }
  OBR.broadcast.sendMessage(SHOP_REQ, {}, { destination: "REMOTE" }).catch(() => {});
  $("closed").textContent = "Розкладаємо товар…";
  $("closed").hidden = false;
}

const discount = () => Number(meta.discount) || 0;

function drawStore() {
  const open = gm || meta.open;
  $("closed").hidden = Boolean(shop && open);
  if (!shop) { $("closed").textContent = "Крамниця зачинена. Зазирніть, коли майстер її відкриє."; $("grid").replaceChildren(); $("cats").replaceChildren(); return; }
  $("sname").textContent = shop.name;
  $("sowner").textContent = shop.owner ? `торгує ${shop.owner}` : "";
  $("greet").textContent = shop.greet ? `«${shop.greet}»` : "";
  $("greet").hidden = !shop.greet;
  $("about").textContent = shop.about ?? "";
  $("store").style.setProperty("--bg", shop.bg ? `url("${shop.bg}")` : "none");
  const pic = $("portrait");
  pic.style.backgroundImage = shop.img ? `url("${shop.img}")` : "";
  $("initial").textContent = shop.img ? "" : (shop.owner || shop.name || "?").slice(0, 1);
  const d = discount();
  $("disc-note").hidden = !d;
  $("disc-note").textContent = d > 0 ? `${shop.owner || "Торговець"} поступається: −${Math.round(d * 100)}%` : `${shop.owner || "Торговець"} не в гуморі: ціни +${Math.round(-d * 100)}%`;

  // категорії, у яких щось є
  const used = Object.keys(CATS).filter((k) => shop.items.some((i) => i.cat === k));
  if (cat !== "all" && !used.includes(cat)) cat = "all";
  $("cats").replaceChildren(...["all", ...used].map((k) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = k === cat ? "on" : "";
    b.textContent = k === "all" ? "Усе" : `${CATS[k].icon} ${CATS[k].name}`;
    b.onclick = () => { cat = k; drawStore(); };
    return b;
  }));

  const list = shop.items.filter((i) => cat === "all" || i.cat === cat);
  $("grid").replaceChildren(...list.map((i) => {
    const card = document.createElement("button");
    card.type = "button";
    const out = i.qty !== null && i.qty !== "" && Number(i.qty) <= 0;
    card.className = `ware r-${i.rarity}${pick === i.id ? " on" : ""}${out ? " out" : ""}`;
    card.innerHTML = `<div class="wimg"></div><div class="wname"></div><div class="wfoot"><span class="wprice"></span><span class="wqty"></span></div>`;
    paint(card.querySelector(".wimg"), i);
    card.querySelector(".wname").textContent = i.name;
    card.querySelector(".wprice").textContent = i.rarity === "trade" ? "обмін" : money(priceCp(i, d));
    card.querySelector(".wqty").textContent = out ? "розпродано" : (i.qty === null || i.qty === "" ? "" : `×${i.qty}`);
    card.onclick = () => { pick = i.id; drawStore(); };
    return card;
  }));
  if (!list.some((i) => i.id === pick)) pick = list[0]?.id ?? null;
  for (const c of $("grid").children) c.classList.toggle("on", false);
  const idx = list.findIndex((i) => i.id === pick);
  if (idx >= 0) $("grid").children[idx].classList.add("on");
  drawDetail();
  drawPurse();
}

function paint(box, item) {
  box.replaceChildren();
  if (item.img) {
    const img = document.createElement("img");
    img.src = item.img;
    img.alt = "";
    img.onerror = () => { box.textContent = CATS[item.cat]?.icon ?? "📦"; };
    box.append(img);
  } else {
    box.textContent = CATS[item.cat]?.icon ?? "📦";
  }
}

function drawDetail() {
  const i = shop?.items.find((x) => x.id === pick);
  $("detail").hidden = !i;
  if (!i) return;
  paint($("dimg"), i);
  $("dname").textContent = i.name;
  $("drar").textContent = RARITY[i.rarity] ?? "";
  $("drar").className = `drar r-${i.rarity}`;
  $("ddesc").textContent = i.desc ?? "";
  $("dmech").textContent = i.mech ?? "";
  $("dmech").hidden = !i.mech;
  $("dquote").textContent = i.quote ? `«${i.quote}» — ${shop.owner || "торговець"}` : "";
  $("dquote").hidden = !i.quote;
  const cp = priceCp(i, discount());
  const out = i.qty !== null && i.qty !== "" && Number(i.qty) <= 0;
  $("dprice").textContent = i.rarity === "trade" ? "Лише обмін" : money(cp);
  const sheet = readSheet(room);
  const have = purse(sheet);
  let why = "";
  if (gm) why = "Так вітрину бачать гравці.";
  else if (i.rarity === "trade") why = `За гроші не продається — домовляйтесь із ${shop.owner || "торговцем"} словами.`;
  else if (out) why = "Розпродано.";
  else if (!meta.open) why = "Крамниця зачинена.";
  else if (!sheet) why = "Не знайдено твого листа персонажа в цьому браузері — відкрий «Лист персонажа» хоч раз.";
  else if (have < cp) why = `Не вистачає ${money(cp - have)}.`;
  $("buy").disabled = Boolean(why) || waiting;
  $("buy").textContent = waiting ? "Торгуємось…" : "Купити";
  $("buy-hint").textContent = why;
}

function drawPurse() {
  if (gm) { $("purse-box").hidden = true; $("sell").hidden = true; return; }
  const sheet = readSheet(room);
  $("purse").textContent = sheet ? money(purse(sheet)) : "—";
  $("purse-hint").textContent = sheet ? "з листа персонажа" : "лист персонажа не знайдено";
  if (!$("detail").hidden) drawDetail();
}

async function buy() {
  const i = shop?.items.find((x) => x.id === pick);
  if (!i || waiting) return;
  waiting = true;
  drawDetail();
  await OBR.broadcast.sendMessage(SHOP_BUY, { sid: shop.id, iid: i.id, to: me.id, who: me.name }, { destination: "REMOTE" });
  // якщо майстра немає — не висіти вічно
  setTimeout(() => { if (waiting) { waiting = false; toast("Торговець не відповідає — майстра зараз немає в кімнаті?"); drawDetail(); } }, 6000);
}

function fillSell() {
  const sheet = readSheet(room);
  const gear = (sheet?.data?.gear ?? []).filter((g) => g.name);
  $("sell-item").replaceChildren(...(gear.length ? gear.map((g) => new Option(`${g.name}${Number(g.qty) > 1 ? ` (×${g.qty})` : ""}`, g.name)) : [new Option("У спорядженні порожньо", "")]));
  $("sell-hint").textContent = `${shop?.owner || "Торговець"} зазвичай платить ${Math.round((shop?.buy ?? 0.5) * 100)}% ціни. Останнє слово — за майстром.`;
}

async function offer() {
  const name = $("sell-item").value;
  if (!name) return;
  const ask = Math.max(0, Math.round(Number($("sell-ask").value) || 0));
  await OBR.broadcast.sendMessage(SHOP_OFFER, { oid: uid(), to: me.id, who: me.name, name, ask }, { destination: "REMOTE" });
  $("sellbox").hidden = true;
  $("sell-ask").value = "";
  toast(`Ти показуєш «${name}». Чекай, що скаже ${shop?.owner || "торговець"}.`);
}

function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 4200);
}

// ---------- Майстер ----------

function initGM() {
  syncShops().then((changed) => { if (changed && mode !== "edit") { shop = shops().find((s) => s.id === shop?.id) ?? shops()[0]; drawGM(); } }).catch(() => {});
  const list = shops();
  shop = list.find((s) => s.id === meta.id) ?? list[0];
  for (const b of $("mtabs").children) b.onclick = () => { mode = b.dataset.m; drawGM(); };
  $("pick").onchange = () => { shop = shops().find((s) => s.id === $("pick").value); pick = null; drawGM(); };
  $("add").onclick = () => { const s = newShop(); saveShops([...shops(), s]); shop = s; mode = "edit"; drawGM(); };
  $("dup").onclick = () => {
    const s = { ...JSON.parse(JSON.stringify(shop)), id: uid(), name: `${shop.name} (копія)` };
    saveShops([...shops(), s]); shop = s; drawGM();
  };
  $("del").onclick = () => {
    if (shops().length < 2) { toast("Остання крамниця — її не видаляємо"); return; }
    if (!confirm(`Видалити крамницю «${shop.name}»?`)) return;
    saveShops(shops().filter((s) => s.id !== shop.id));
    shop = shops()[0];
    drawGM();
  };
  $("disc").onchange = () => setMeta({ discount: Number($("disc").value) });
  $("open").onclick = toggleOpen;
  $("export").onclick = async () => {
    $("io-text").hidden = false;
    $("io-text").value = JSON.stringify(shops());
    $("io-text").select();
    try { await navigator.clipboard.writeText($("io-text").value); toast("Скопійовано"); } catch { toast("Виділено — Ctrl+C"); }
  };
  $("import").onclick = () => {
    const box = $("io-text");
    if (box.hidden || !box.value.trim()) { box.hidden = false; box.value = ""; box.placeholder = "Встав сюди скопійовані крамниці й натисни «Вставити з тексту» ще раз"; box.focus(); return; }
    try {
      const list = JSON.parse(box.value);
      if (!Array.isArray(list) || list.some((s) => !s.id || !Array.isArray(s.items))) throw new Error();
      saveShops(list); shop = list[0]; box.hidden = true; drawGM(); toast("Крамниці завантажено");
    } catch { toast("Це не схоже на скопійовані крамниці"); }
  };
  buildEditor();
  drawGM();
}

async function setMeta(patch) {
  const cur = (await OBR.room.getMetadata())[SHOP] ?? {};
  await OBR.room.setMetadata({ [SHOP]: { ...cur, ...patch } });
}

async function toggleOpen() {
  if (meta.open && meta.id === shop.id) { await setMeta({ open: false }); toast("Крамницю зачинено"); return; }
  if (bytes(shop) > LIMIT - 1000) { toast("Крамниця завелика, щоб надіслати гравцям: скоротіть описи"); return; }
  await OBR.broadcast.sendMessage(SHOP_DATA, shop, { destination: "REMOTE" });
  await setMeta({ open: true, id: shop.id, name: shop.name, rev: Date.now() });
  toast(`«${shop.name}» відкрито для гравців`);
}

function drawGM() {
  const list = shops();
  if (!list.some((s) => s.id === shop?.id)) shop = list[0];
  $("pick").replaceChildren(...list.map((s) => new Option(s.name + (meta.open && meta.id === s.id ? " · відкрита" : ""), s.id)));
  $("pick").value = shop.id;
  $("disc").value = String(Number(meta.discount) || 0);
  const live = Boolean(meta.open && meta.id === shop.id);
  $("open").textContent = live ? "Зачинити" : meta.open ? "Відкрити цю замість іншої" : "Відкрити для гравців";
  $("open").classList.toggle("live", live);
  for (const b of $("mtabs").children) b.classList.toggle("on", b.dataset.m === mode);
  $("store").hidden = mode !== "view";
  $("editor").hidden = mode !== "edit";
  $("offers").hidden = mode !== "offers";
  const n = local(OFFERS, []).length;
  $("ocount").hidden = !n;
  $("ocount").textContent = String(n);
  if (mode === "view") drawStore();
  if (mode === "edit") fillEditor();
  if (mode === "offers") drawOffers();
}

// Зберегти зміни крамниці; якщо вона відкрита — гравці одразу бачать нове
let pushTimer = null;
function commit() {
  shop._at = Date.now();
  saveShops(shops().map((s) => (s.id === shop.id ? shop : s)));
  if (meta.open && meta.id === shop.id) {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => OBR.broadcast.sendMessage(SHOP_DATA, shop, { destination: "REMOTE" }).catch(() => {}), 700);
  }
  $("pick").options[$("pick").selectedIndex].text = shop.name + (meta.open && meta.id === shop.id ? " · відкрита" : "");
}

async function fromSelection() {
  const sel = (await OBR.player.getSelection()) ?? [];
  if (!sel.length) { toast("Спершу виділи на мапі токен чи картинку"); return ""; }
  const [it] = await OBR.scene.items.getItems([sel[0]]);
  if (!it?.image?.url) { toast("У виділеного немає зображення"); return ""; }
  return it.image.url;
}

function buildEditor() {
  const bind = (id, key, num) => { $(id).oninput = () => { shop[key] = num ? Number($(id).value) : $(id).value; commit(); }; };
  bind("e-name", "name"); bind("e-owner", "owner"); bind("e-greet", "greet"); bind("e-about", "about"); bind("e-img", "img"); bind("e-bg", "bg");
  $("e-buy").onchange = () => { shop.buy = Number($("e-buy").value); commit(); };
  $("e-img-sel").onclick = async () => { const u = await fromSelection(); if (u) { shop.img = u; $("e-img").value = u; commit(); } };
  $("e-bg-sel").onclick = async () => { const u = await fromSelection(); if (u) { shop.bg = u; $("e-bg").value = u; commit(); } };
  $("e-add").onclick = () => { const it = newItem(); shop.items.push(it); commit(); fillEditor(it.id); };
}

function fillEditor(openId) {
  $("e-name").value = shop.name ?? "";
  $("e-owner").value = shop.owner ?? "";
  $("e-greet").value = shop.greet ?? "";
  $("e-about").value = shop.about ?? "";
  $("e-img").value = shop.img ?? "";
  $("e-bg").value = shop.bg ?? "";
  $("e-buy").value = String(shop.buy ?? 0.5);
  const box = $("e-items");
  const opened = new Set([...box.querySelectorAll(".erow.open")].map((r) => r.dataset.id));
  if (openId) opened.add(openId);
  box.replaceChildren(...shop.items.map((it, n) => itemRow(it, n, opened.has(it.id))));
}

function itemRow(it, n, open) {
  const row = document.createElement("div");
  row.className = "erow" + (open ? " open" : "");
  row.dataset.id = it.id;
  row.innerHTML = `
    <div class="etop">
      <div class="eic"></div>
      <input class="en" maxlength="60">
      <span class="ep"><input type="number" min="0" step="0.1" class="eprice"> зм</span>
      <span class="eq">×<input type="number" min="0" class="eqty" placeholder="∞"></span>
      <button type="button" class="ghost mini" data-a="up" title="Вище">↑</button>
      <button type="button" class="ghost mini" data-a="down" title="Нижче">↓</button>
      <button type="button" class="ghost mini" data-a="more" title="Подробиці">⋯</button>
      <button type="button" class="ghost mini danger" data-a="del" title="Прибрати товар">✕</button>
    </div>
    <div class="emore">
      <label>Розділ<select class="ecat"></select></label>
      <label>Рідкісність<select class="erar"></select></label>
      <label class="wide">Зображення (посилання)<span class="imgrow"><input class="eimg" placeholder="https://…"><button type="button" class="ghost" data-a="img">З виділеного на мапі</button></span></label>
      <label class="wide">Опис<textarea class="edesc" rows="2" maxlength="300"></textarea></label>
      <label class="wide">Що робить (механіка)<textarea class="emech" rows="2" maxlength="300"></textarea></label>
      <label class="wide">Що каже торговець<input class="equote" maxlength="200"></label>
    </div>`;
  const q = (s) => row.querySelector(s);
  paint(q(".eic"), it);
  q(".en").value = it.name;
  q(".eprice").value = String(it.price ?? 0);
  q(".eqty").value = it.qty === null || it.qty === "" ? "" : String(it.qty);
  for (const [k, v] of Object.entries(CATS)) q(".ecat").append(new Option(`${v.icon} ${v.name}`, k));
  for (const [k, v] of Object.entries(RARITY)) q(".erar").append(new Option(v, k));
  q(".ecat").value = it.cat;
  q(".erar").value = it.rarity;
  q(".eimg").value = it.img ?? "";
  q(".edesc").value = it.desc ?? "";
  q(".emech").value = it.mech ?? "";
  q(".equote").value = it.quote ?? "";
  const set = (sel, key, fn = (v) => v) => { q(sel).oninput = q(sel).onchange = () => { it[key] = fn(q(sel).value); commit(); if (key === "cat" || key === "img") paint(q(".eic"), it); }; };
  set(".en", "name"); set(".eprice", "price", (v) => Math.max(0, Number(v) || 0));
  set(".eqty", "qty", (v) => (v === "" ? null : Math.max(0, Math.round(Number(v)))));
  set(".ecat", "cat"); set(".erar", "rarity"); set(".eimg", "img"); set(".edesc", "desc"); set(".emech", "mech"); set(".equote", "quote");
  row.querySelectorAll("[data-a]").forEach((b) => {
    b.onclick = async () => {
      const a = b.dataset.a;
      if (a === "more") { row.classList.toggle("open"); return; }
      if (a === "img") { const u = await fromSelection(); if (u) { it.img = u; q(".eimg").value = u; paint(q(".eic"), it); commit(); } return; }
      if (a === "del") { if (!confirm(`Прибрати «${it.name}»?`)) return; shop.items = shop.items.filter((x) => x !== it); }
      if (a === "up" && n > 0) [shop.items[n - 1], shop.items[n]] = [shop.items[n], shop.items[n - 1]];
      if (a === "down" && n < shop.items.length - 1) [shop.items[n + 1], shop.items[n]] = [shop.items[n], shop.items[n + 1]];
      commit();
      fillEditor();
    };
  });
  return row;
}

// Пропозиції гравців: майстер вирішує, за скільки купити
function drawOffers() {
  const list = local(OFFERS, []);
  $("ocount").hidden = !list.length;
  $("ocount").textContent = String(list.length);
  if (mode !== "offers") return;
  $("olist").replaceChildren(...(list.length ? list.map((o) => {
    const row = document.createElement("div");
    row.className = "orow";
    row.innerHTML = `<div class="otext"><b></b> пропонує <i></i><span class="dim"></span></div>
      <div class="oact"><input type="number" min="0" step="1" class="oprice"> зм
      <label class="dim"><input type="checkbox" class="oshelf" checked> виставити на вітрину</label>
      <button type="button" class="go">Купити</button><button type="button" class="ghost danger">Відмовити</button></div>`;
    row.querySelector("b").textContent = o.who;
    row.querySelector("i").textContent = `«${o.name}»`;
    row.querySelector(".dim").textContent = o.ask ? ` і хоче ${o.ask} зм` : " — ціну не назвав";
    row.querySelector(".oprice").value = String(o.ask || 0);
    const [yes, no] = row.querySelectorAll("button");
    yes.onclick = async () => {
      const cp = Math.round(Math.max(0, Number(row.querySelector(".oprice").value) || 0) * 100);
      await OBR.broadcast.sendMessage(SHOP_DEAL, { to: o.to, ok: true, name: o.name, cp }, { destination: "REMOTE" });
      if (row.querySelector(".oshelf").checked) {
        shop.items.push({ ...newItem(), name: o.name, price: Math.max(1, Math.round((cp / 100) / (shop.buy || 0.5))), qty: 1, desc: "Куплено в мандрівників." });
        commit();
      }
      done(o.oid);
    };
    no.onclick = async () => {
      await OBR.broadcast.sendMessage(SHOP_DEAL, { to: o.to, ok: false, name: o.name }, { destination: "REMOTE" });
      done(o.oid);
    };
    return row;
  }) : [Object.assign(document.createElement("div"), { className: "none", textContent: "Поки ніхто нічого не пропонує. Гравці можуть запропонувати речі зі свого спорядження прямо у вітрині." })]));
}

function done(oid) {
  saveLocal(OFFERS, local(OFFERS, []).filter((o) => o.oid !== oid));
  drawOffers();
}
