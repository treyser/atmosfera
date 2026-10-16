// Дошка розслідувань: справи, улики на дошці й нитки між ними.
// Усе живе в браузері майстра; кожна зміна — маленька «операція», яку всі застосовують у себе наживо.
// Приховані улики (у шухляді майстра) гравцям не надсилаються, доки майстер їх не викладе.

export const BOARDS = "atmosfera.boards";
export const W = 3200, H = 2000;      // розмір дошки в «пікселях дошки»

export const KINDS = {
  photo:   { name: "Фото",        icon: "📷" },
  person:  { name: "Особа",       icon: "👤" },
  letter:  { name: "Лист",        icon: "✉" },
  diary:   { name: "Щоденник",    icon: "📔" },
  notice:  { name: "Оголошення",  icon: "📰" },
  order:   { name: "Наказ",       icon: "📜" },
  note:    { name: "Записка",     icon: "📝" },
  question:{ name: "Питання",     icon: "❓" },
  map:     { name: "Шматок мапи", icon: "🗺" },
  rune:    { name: "Напис",       icon: "ᚱ" },
  beast:   { name: "Істота",      icon: "🐉" },
  item:    { name: "Річ",         icon: "🗝" },
  rumor:   { name: "Чутка",       icon: "🍺" },
};
export const NOTE_COLORS = ["#f7e27a", "#f6a6b2", "#9fd8a8", "#9cc7f2", "#f5b97a"];
export const YARN = {
  red:   { name: "пов'язано",  color: "#c8202b" },
  blue:  { name: "можливо",    color: "#2f6fb5" },
  black: { name: "хибний слід", color: "#1d1d1f" },
  gold:  { name: "доведено",   color: "#d4a62a" },
};
export const STAMPS = { yes: "ПІДТВЕРДЖЕНО", no: "ХИБНИЙ СЛІД", secret: "ТАЄМНО" };

export const uid = () => Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
const read = (k, f) => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : f; } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

// --- майстер: усі справи ---
export function boards() {
  const b = read(BOARDS, null);
  if (b?.list?.length) return b;
  const first = { list: [newCase("Свята Елеонора")] };
  write(BOARDS, first);
  return first;
}
export const saveBoards = (b) => write(BOARDS, b);
export function newCase(name = "Нова справа") {
  return { id: "k" + uid(), name, closed: false, items: [], links: [], at: Date.now() };
}

// Нова улика: координати — центр
export function newItem(kind, data = {}, x = W / 2, y = H / 2) {
  const rot = Math.round((Math.random() * 8 - 4) * 10) / 10;
  return { id: "i" + uid(), kind, x: Math.round(x), y: Math.round(y), rot, z: Date.now(), ...data };
}

// Що бачать гравці: без прихованих улик і без таємних нотаток майстра
export function publicCase(c) {
  const hidden = new Set(c.items.filter((i) => i.hidden).map((i) => i.id));
  return {
    id: c.id, name: c.name, closed: c.closed,
    items: c.items.filter((i) => !i.hidden).map(({ gm, ...rest }) => rest),
    links: c.links.filter((l) => !hidden.has(l.a) && !hidden.has(l.b)),
  };
}
export function publicList(b) {
  return b.list.map(publicCase);
}

// Застосувати операцію до списку справ (і в майстра, і в гравця). Повертає true, якщо щось змінилось.
export function apply(list, op) {
  if (!op) return false;
  if (op.op === "case") {
    const i = list.findIndex((c) => c.id === op.c.id);
    if (op.del) { if (i >= 0) list.splice(i, 1); return i >= 0; }
    if (i >= 0) list[i] = { ...list[i], ...op.c, items: list[i].items, links: list[i].links };
    else list.push({ items: [], links: [], ...op.c });
    return true;
  }
  const c = list.find((x) => x.id === op.k);
  if (!c) return false;
  switch (op.op) {
    case "add": {
      const i = c.items.findIndex((x) => x.id === op.item.id);
      if (i >= 0) c.items[i] = { ...c.items[i], ...op.item }; else c.items.push(op.item);
      return true;
    }
    case "move": {
      const it = c.items.find((x) => x.id === op.id);
      if (!it) return false;
      it.x = op.x; it.y = op.y; if (op.z) it.z = op.z;
      return true;
    }
    case "upd": {
      const it = c.items.find((x) => x.id === op.id);
      if (!it) return false;
      Object.assign(it, op.patch);
      return true;
    }
    case "del": {
      c.items = c.items.filter((x) => x.id !== op.id);
      c.links = c.links.filter((l) => l.a !== op.id && l.b !== op.id);
      return true;
    }
    case "link": {
      if (c.links.some((l) => l.id === op.link.id)) return false;
      c.links.push(op.link);
      return true;
    }
    case "lupd": {
      const l = c.links.find((x) => x.id === op.id);
      if (!l) return false;
      Object.assign(l, op.patch);
      return true;
    }
    case "unlink": {
      const n = c.links.length;
      c.links = c.links.filter((l) => l.id !== op.id);
      return c.links.length !== n;
    }
  }
  return false;
}

// Повний стан шматками (кожне повідомлення Owlbear — до 16 кБ)
export function chunks(list, max = 11000) {
  const out = [];
  const enc = (v) => new TextEncoder().encode(JSON.stringify(v)).length;
  for (const c of list) {
    const head = { id: c.id, name: c.name, closed: c.closed, items: [], links: c.links };
    if (enc(c) <= max) { out.push({ c }); continue; }
    out.push({ c: head });
    let part = [], size = 0;
    for (const it of c.items) {
      const s = enc(it);
      if (part.length && size + s > max) { out.push({ k: c.id, items: part }); part = []; size = 0; }
      part.push(it); size += s;
    }
    if (part.length) out.push({ k: c.id, items: part });
  }
  return out;
}

// гравець: остання копія дошки
export const SEEN = (room) => `atmosfera.boards-seen.${room}`;
export const seenBoards = (room) => read(SEEN(room), []);
export const saveSeenBoards = (room, list) => write(SEEN(room), list);
