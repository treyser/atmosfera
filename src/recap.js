// Підсумок сесії: «Минулого разу…» з записів корабельного журналу.
const GAP = 6 * 3600;   // між сесіями минає щонайменше 6 годин

export const PARTS = [
  { k: "path", name: "Шлях", on: true },
  { k: "events", name: "Події в дорозі", on: true },
  { k: "tune", name: "Мелодія й загадки", on: true },
  { k: "fights", name: "Бої", on: true },
  { k: "gm", name: "Записи майстра", on: true },
  { k: "crew", name: "Записи команди", on: false },
];

const date = (at) => new Date(at * 1000).toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
const isFight = (e) => e.k === "g" && /^Бій завершено/.test(e.t ?? "");

// Розбити журнал на сесії за перервами між записами (старі підсумки не враховуємо)
export function sessions(log) {
  const list = log.filter((e) => e.k !== "s").slice().sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
  const out = [];
  let cur = [];
  for (const e of list) {
    if (cur.length && (e.at ?? 0) - (cur[cur.length - 1].at ?? 0) > GAP) { out.push(cur); cur = []; }
    cur.push(e);
  }
  if (cur.length) out.push(cur);
  return out.map((items) => {
    const days = items.map((e) => e.d).filter(Boolean);
    const dd = days.length ? (Math.min(...days) === Math.max(...days) ? `день ${days[0]}` : `дні ${Math.min(...days)}–${Math.max(...days)}`) : "";
    return { items, label: `${date(items[0].at ?? 0)}${dd ? " · " + dd : ""} · записів: ${items.length}` };
  });
}

// «А», «А і Б», «А, Б і В»
function and(list) {
  if (list.length < 2) return list.join("");
  return `${list.slice(0, -1).join(", ")} і ${list[list.length - 1]}`;
}

export function recap(items, parts) {
  const has = (k) => parts.has(k);
  const lines = [];
  const days = items.map((e) => e.d).filter(Boolean);
  const lo = Math.min(...days), hi = Math.max(...days);
  const head = days.length ? (lo === hi ? ` (день ${lo} плавання)` : ` (дні ${lo}–${hi} плавання)`) : "";

  if (has("path")) {
    const ports = items.filter((e) => e.k === "a").map((e) => `«${e.t}»`);
    if (ports.length === 1) lines.push(`• Корабель прибув до ${ports[0]}.`);
    else if (ports.length > 1) lines.push(`• Корабель прибув до ${ports[0]}, а згодом — до ${and(ports.slice(1))}.`);
  }
  if (has("events")) {
    for (const e of items.filter((x) => x.k === "e")) lines.push(`• ${e.s ? e.s + ": " : "У дорозі: "}«${e.t}».`);
  }
  if (has("tune")) {
    const frags = [...new Set(items.filter((e) => e.k === "m").map((e) => e.n))].sort((a, b) => a - b);
    if (frags.length) lines.push(`• Маркус насвистів ${frags.length > 1 ? "уривки" : "уривок"} мелодії: ${and(frags.map(String))}.`);
    for (const e of items.filter((x) => x.k === "r")) lines.push(`• ${e.t}.`);
  }
  if (has("fights")) {
    const fights = items.filter(isFight);
    if (fights.length) {
      const foes = fights.reduce((n, e) => n + Number((e.t.match(/Переможено ворогів: (\d+)/) ?? [])[1] ?? 0), 0);
      const word = fights.length === 1 ? "бій" : fights.length < 5 ? "бої" : "боїв";
      lines.push(`• Команда пройшла ${fights.length} ${word}${foes ? `, переможено ворогів: ${foes}` : ""}.`);
    }
  }
  if (has("gm")) {
    for (const e of items.filter((x) => x.k === "g" && !isFight(x))) lines.push(`• ${e.t}`);
  }
  if (has("crew")) {
    const crew = items.filter((x) => x.k === "p");
    if (crew.length) {
      lines.push("", "З записів команди:");
      for (const e of crew) lines.push(`— ${e.w || "Гравець"}: ${e.t}`);
    }
  }
  if (!lines.length) return `Минулого разу${head}: нічого з обраного не записано.`;
  return `Минулого разу${head}:\n${lines.join("\n")}`;
}
