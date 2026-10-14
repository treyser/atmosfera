// Нитки героїв — лише для майстра. Особисті сюжетні лінії кожного героя з кроками й прогресом.
// Зберігаються тільки в браузері майстра (не в кімнаті), тож гравці їх не побачать ніде.
// «Згадки в Атласі» — точки й події, у тексті яких згадано героя: там його нитку можна просунути.
import OBR from "@owlbear-rodeo/sdk";
import { VISITED } from "./state.js";
import { local, saveLocal, uid } from "./log.js";
import { PLACES } from "./atlas-data.js";
import { EVENTS } from "./events.js";

const KEY = "atmosfera.heroes";
let box = null;
let data = null;
let seen = new Set();
let io = false;    // відкрите поле експорту / імпорту
let refocus = null; // після перемальовки повернути курсор у поле нового кроку цієї нитки

const step = (t, n) => ({ id: uid(), t, n, done: false });
const thread = (title, steps) => ({ id: uid(), title, steps });

// Початкові нитки — з того, що вже є в Атласі. Таємні кроки майстер дописує сам: вони лишаються лише в нього.
function seed() {
  return {
    heroes: [
      { id: uid(), name: "Арторіас", stem: "Арторіас", color: "#e8c27a", note: "", threads: [
        thread("Теорія Тихого моря", [step("Доплисти до Тихого моря й перевірити теорію"), step("Уламки «Ластівки»", 10), step("Маяк Скельної Тіні: родинна реліквія", 32)]),
        thread("Листи, які не можна показувати", [step("Голуб із запискою (подія «Гість на щоглі»)"), step("Северин на Кораблі-місії впізнає його", 13), step("Острів Дзеркал: таємниця, яку бачить лише він", 44)]),
      ] },
      { id: uid(), name: "Ґрундур", stem: "Ґрундур", color: "#ef8b4b", note: "", threads: [
        thread("Тінь Залізоділа", [step("Човен із Залізоділа серед уламків", 7), step("Гарпун із Залізоділа у свіжому кістяку", 34), step("Ветеран батькової гвардії", 24), step("Пристань Залізоділа й старі борги", 28)]),
      ] },
      { id: uid(), name: "Касіан", stem: "Касіан", color: "#b18cff", note: "", threads: [
        thread("Після відречення", [step("Голос у Храмі Першого Снігу кличе на ім'я", 8), step("Погляд на Кораблі-місії", 13), step("Розписка на ім'я родини", 20), step("Мовчазне Селище приймає як свого", 48)]),
      ] },
      { id: uid(), name: "Рейден", stem: "Рейден", color: "#41b8f0", note: "", threads: [
        thread("Народ з-за моря", [step("Північне Сяйво: перше слово рідної мови", 16), step("Дзеркальна Вода", 15), step("Ще одне слово (подія «Сяйво»)"), step("Край Світу: звідки прийшов його народ", 12)]),
        thread("Щуролов", [step("Грот Щурів — особисте", 38), step("Острів Корабельних Котів", 35)]),
      ] },
      { id: uid(), name: "Маркус", stem: "Маркус", color: "#4fd18b", note: "NPC", threads: [
        thread("Хто такий Маркус?", [step("Лист на його ім'я на Вовчій Крижині", 5), step("Подвійні вузли на «Ластівці»", 10), step("Пляшечка «Маркус, день перший»", 25), step("Мелодія в Ребрах Велетня", 29), step("Рибалка, що знав «того, що свистів»", 39)]),
      ] },
    ],
  };
}

const save = () => saveLocal(KEY, data);

export async function mount(el) {
  box = el;
  data = local(KEY, null) ?? seed();
  save();
  seen = new Set((await OBR.room.getMetadata())[VISITED] ?? []);
  OBR.room.onMetadataChange((m) => { seen = new Set(m[VISITED] ?? []); draw(); });
  draw();
}

// Де в Атласі згадано героя
function mentions(stem) {
  if (!stem) return [];
  const out = [];
  for (const p of PLACES) {
    const t = [p.what, p.fight, p.reward, p.hook].join(" ");
    if (t.includes(stem)) out.push({ label: `№${p.n} ${p.name}`, n: p.n, tip: sentence(t, stem) });
  }
  for (const e of EVENTS) {
    const t = [e.what, e.check, e.after].join(" ");
    if (t.includes(stem)) out.push({ label: `подія «${e.show}»`, tip: sentence(t, stem) });
  }
  return out;
}
const sentence = (t, stem) => t.split(/(?<=[.!?…])\s+/).filter((s) => s.includes(stem)).join(" ");

const h = (tag, cls, text) => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
};

function draw() {
  const top = h("div", "htop");
  const add = h("button", "ghost", "+ Герой");
  add.type = "button";
  add.onclick = () => { data.heroes.push({ id: uid(), name: "Новий герой", stem: "", color: "#9aa3ad", note: "", threads: [] }); save(); draw(); };
  const exp = h("button", "ghost", io ? "Сховати експорт" : "Експорт / імпорт");
  exp.type = "button";
  exp.onclick = () => { io = !io; draw(); };
  top.append(h("p", "dim", "Бачиш лише ти: нитки лежать у твоєму браузері, не в кімнаті. Галочка — крок пройдено. №12 на початку нового кроку прив'яже його до точки Атласу."), add, exp);

  const parts = [top];
  if (io) parts.push(ioBox());
  const grid = h("div", "hgrid");
  for (const hero of data.heroes) grid.append(card(hero));
  parts.push(grid);
  box.replaceChildren(...parts);
  if (refocus) { box.querySelector(`[data-t="${refocus}"]`)?.focus(); refocus = null; }
}

function ioBox() {
  const wrap = h("div", "io");
  const ta = h("textarea");
  ta.rows = 5;
  ta.value = JSON.stringify(data);
  const row = h("div", "wrow");
  const copy = h("button", "ghost", "Скопіювати");
  copy.type = "button";
  copy.onclick = async () => { ta.select(); try { await navigator.clipboard.writeText(ta.value); copy.textContent = "Скопійовано ✓"; } catch { copy.textContent = "Виділено — Ctrl+C"; } };
  const load = h("button", "ghost", "Завантажити з поля");
  load.type = "button";
  load.onclick = () => {
    try {
      const next = JSON.parse(ta.value);
      if (!Array.isArray(next?.heroes)) throw new Error();
      data = next; save(); io = false; draw();
    } catch { load.textContent = "Це не схоже на експорт ниток"; }
  };
  const reset = h("button", "ghost danger", "Скинути до початкових");
  reset.type = "button";
  reset.onclick = () => {
    if (reset.dataset.sure) { data = seed(); save(); io = false; draw(); return; }
    reset.dataset.sure = "1"; reset.textContent = "Точно? Натисни ще раз";
  };
  row.append(h("span", "dim", "Щоб перенести нитки на інший комп'ютер: скопіюй тут, встав там і натисни «Завантажити»."), copy, load, reset);
  wrap.append(ta, row);
  return wrap;
}

function card(hero) {
  const c = h("article", "hero");
  c.style.setProperty("--c", hero.color);
  const all = hero.threads.flatMap((t) => t.steps);
  const done = all.filter((s) => s.done).length;

  const head = h("div", "hhead");
  const name = h("input", "hname");
  name.value = hero.name;
  name.onchange = () => { hero.name = name.value.trim() || hero.name; if (!hero.stem) hero.stem = hero.name; save(); draw(); };
  const color = h("input", "hcolor");
  color.type = "color";
  color.value = hero.color;
  color.onchange = () => { hero.color = color.value; save(); draw(); };
  head.append(color, name, h("span", "hcount", all.length ? `${done} / ${all.length}` : ""));
  c.append(head);

  for (const t of hero.threads) c.append(threadBox(hero, t));

  const more = h("button", "link", "+ нитка");
  more.type = "button";
  more.onclick = () => { hero.threads.push(thread("Нова нитка", [])); save(); draw(); };
  c.append(more);

  const note = h("textarea", "hnote");
  note.rows = 2;
  note.placeholder = "Таємне про героя — лише для тебе";
  note.value = hero.note ?? "";
  note.onchange = () => { hero.note = note.value; save(); };
  c.append(note);

  const refs = mentions(hero.stem || hero.name);
  if (refs.length) {
    const r = h("div", "refs");
    r.append(h("span", "rlbl", "Згадки в Атласі:"));
    for (const x of refs) {
      const chip = h("span", `chip${x.n && seen.has(x.n) ? " was" : ""}`, x.label);
      chip.title = x.tip;
      r.append(chip);
    }
    c.append(r);
  }

  const del = h("button", "link danger", "прибрати героя");
  del.type = "button";
  del.onclick = () => {
    if (!del.dataset.sure) { del.dataset.sure = "1"; del.textContent = "точно прибрати?"; return; }
    data.heroes = data.heroes.filter((x) => x !== hero); save(); draw();
  };
  c.append(del);
  return c;
}

function threadBox(hero, t) {
  const box = h("div", "thread");
  const done = t.steps.filter((s) => s.done).length;
  const top = h("div", "ttop");
  const title = h("input", "ttitle");
  title.value = t.title;
  title.onchange = () => { t.title = title.value.trim() || t.title; save(); };
  const x = h("button", "del", "✕");
  x.type = "button";
  x.title = "Прибрати нитку";
  x.onclick = () => {
    if (!x.dataset.sure) { x.dataset.sure = "1"; x.textContent = "?"; x.title = "Ще раз — і нитку прибрано"; return; }
    hero.threads = hero.threads.filter((y) => y !== t); save(); draw();
  };
  top.append(title, x);
  const bar = h("div", "bar");
  const fill = h("i");
  fill.style.width = t.steps.length ? `${(done / t.steps.length) * 100}%` : "0";
  bar.append(fill);
  box.append(top, bar);

  for (const s of t.steps) {
    const row = h("label", `stepr${s.done ? " done" : ""}`);
    const cb = h("input");
    cb.type = "checkbox";
    cb.checked = s.done;
    cb.onchange = () => { s.done = cb.checked; save(); draw(); };
    row.append(cb, h("span", "", s.t));
    if (s.n) {
      const b = h("b", `pt${seen.has(s.n) ? " was" : ""}`, `№${s.n}`);
      b.title = seen.has(s.n) ? "Ця точка вже відвідана" : "Точка Атласу";
      row.append(b);
    }
    const d = h("button", "del", "✕");
    d.type = "button";
    d.title = "Прибрати крок";
    d.onclick = (e) => { e.preventDefault(); t.steps = t.steps.filter((y) => y !== s); save(); draw(); };
    row.append(d);
    box.append(row);
  }

  const add = h("input", "addstep");
  add.placeholder = "+ крок (Enter)";
  add.dataset.t = t.id;
  add.onkeydown = (e) => {
    if (e.key !== "Enter") return;
    const raw = add.value.trim();
    if (!raw) return;
    const m = raw.match(/^[№#]\s*(\d{1,2})\s*[:.\-—]?\s*(.*)$/);
    const n = m ? Number(m[1]) : undefined;
    t.steps.push(step(m ? (m[2] || PLACES.find((p) => p.n === n)?.name || raw) : raw, n));
    refocus = t.id;
    save(); draw();
  };
  box.append(add);
  return box;
}
