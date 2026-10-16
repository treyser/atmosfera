// Пастки: заготовки й підписи. Сама пастка — намальована фігура з позначкою TRAP у метаданих.
export const SAVES = { str: "Сили", dex: "Спритності", con: "Статури", wis: "Мудрості", int: "Інтелекту", cha: "Харизми" };

// sound — ключ таємного звуку (sfx.js), after — ефект зони, що лишається після спрацювання
export const PRESETS = [
  { kind: "spikes", icon: "🗡", name: "Шипи в підлозі", save: "dex", dc: 13, dmg: "2к10 колючої", half: true, cond: "", after: "", sound: "metal",
    clue: "Одна плита підлоги трохи вища за інші, а в щілинах — іржа." },
  { kind: "bolt", icon: "🏹", name: "Самостріл у стіні", save: "dex", dc: 14, dmg: "2к8 колючої", half: true, cond: "", after: "", sound: "metal",
    clue: "У стіні на рівні грудей — ледь помітний отвір, а під ногами натягнута нитка." },
  { kind: "fire", icon: "🔥", name: "Вогняна руна", save: "dex", dc: 14, dmg: "3к6 вогню", half: true, cond: "burning", after: "fire", sound: "breath",
    clue: "На камені вирізано символ, обведений сажею. Повітря над ним тремтить." },
  { kind: "needle", icon: "🧪", name: "Отруйна голка", save: "con", dc: 13, dmg: "1 колюча + 2к10 отрути", half: false, cond: "poisoned", after: "", sound: "knock",
    clue: "У замковій щілині блищить щось тонке, наче голка." },
  { kind: "gas", icon: "☁", name: "Отруйний газ", save: "con", dc: 13, dmg: "2к8 отрути", half: true, cond: "poisoned", after: "poison", sound: "breath",
    clue: "Від підлоги тягне солодкуватим запахом, а на стінах — зеленкуватий наліт." },
  { kind: "net", icon: "🕸", name: "Сітка зі стелі", save: "dex", dc: 12, dmg: "", half: false, cond: "restrained", after: "", sound: "creak",
    clue: "Під стелею звисає мотузка, яка ні до чого не прив'язана." },
  { kind: "pit", icon: "🕳", name: "Яма з кілками", save: "dex", dc: 13, dmg: "2к6 дробильної + 1к10 колючої", half: false, cond: "prone", after: "", sound: "knock",
    clue: "Кроки тут звучать глухо, наче під підлогою порожнеча." },
  { kind: "rocks", icon: "🪨", name: "Обвал", save: "dex", dc: 15, dmg: "4к10 дробильної", half: true, cond: "prone", after: "", sound: "knock",
    clue: "Стеля в тріщинах, а підпори виглядають підпиляними." },
];
export const presetOf = (k) => PRESETS.find((p) => p.kind === k) ?? PRESETS[0];

export function newTrap(kind = "spikes") {
  const p = presetOf(kind);
  return { kind: p.kind, name: p.name, save: p.save, dc: p.dc, dmg: p.dmg, half: p.half, cond: p.cond, after: p.after, clue: p.clue,
    spot: p.dc + 1, once: true, armed: true, fired: 0, seen: [] };
}

export const SEEN = (room) => `atmosfera.traps-seen.${room}`;   // у гравця: які пастки він помітив
export function seenTraps(room) { try { return JSON.parse(localStorage.getItem(SEEN(room)) || "[]"); } catch { return []; } }
export function saveSeenTraps(room, ids) { try { localStorage.setItem(SEEN(room), JSON.stringify(ids)); } catch {} }

// Дані для вікна пастки — у посиланні, щоб вікно відкривалося одразу
export const pack = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
export const unpack = (s) => { try { return JSON.parse(decodeURIComponent(escape(atob(s)))); } catch { return null; } };
