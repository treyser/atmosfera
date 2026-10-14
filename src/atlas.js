// Атлас незвіданих вод: мапа світу з 51 точкою, картка локації й перехід «Пливемо сюди».
import OBR from "@owlbear-rodeo/sdk";
import "./atlas.css";
import { ATLAS, VISITED, PRESETS, MAP, VOTE_RESET, HERE, ROUTE, VOYAGE } from "./state.js";
import { EVENTS, EVENT_KINDS, eventsFor, daysBetween, chanceFor } from "./events.js";
import { drawRoute, routeStats } from "./route.js";
import { getVotes, onVotes, pips } from "./votes.js";
import { PLACES, KINDS, REGIONS, ARCHETYPES, BESTIARY } from "./atlas-data.js";
import { sceneMaps, match, pick } from "./director.js";

const $ = (id) => document.getElementById(id);
const COLORS = {
  fight: "#ef4b4b", ruins: "#b18cff", riddle: "#41b8f0", meet: "#f2c94c",
  hazard: "#ff8a3d", haven: "#4fd18b", loot: "#e8c27a",
};
// Назва мапи в сцені для підказки, якщо її бракує
const SCENE_NAME = { battle: "06 biy", wreck: "07 kladov", day: "01 korabel", storm: "03 korabel", calm: "02 korabel" };

let chosen = null;            // номер вибраної точки
let seen = new Set();         // відвідані
let present = new Set();      // ключі мап, що є у відкритій сцені
let off = new Set();          // вимкнені фільтром типи
let votes = [];               // пропозиції гравців
let here = null;              // де партія зараз
let route = [];               // пройдений шлях
let voyage = null;            // подорож, що триває
let adhoc = null;             // подія «просто зараз», без подорожі

$("map").src = import.meta.env.BASE_URL + "atlas-map.jpg";

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    document.body.innerHTML = '<div class="only">Атлас бачить лише майстер.</div>';
    return;
  }
  build();
  const room = await OBR.room.getMetadata();
  seen = new Set(room[VISITED] ?? []);
  const take = (m) => {
    seen = new Set(m[VISITED] ?? []);
    here = m[HERE] ?? null;
    route = m[ROUTE] ?? [];
    voyage = m[VOYAGE] ?? null;
  };
  take(room);
  OBR.room.onMetadataChange((m) => { take(m); draw(); });
  votes = await getVotes();
  onVotes(async () => { votes = await getVotes(); draw(); });
  await scan();
  OBR.scene.onReadyChange(() => scan());
  draw();
});

// Які мапи лежать у відкритій сцені
async function scan() {
  present = new Set();
  if (await OBR.scene.isReady()) {
    const images = await sceneMaps();
    present = new Set(Object.keys(match(pick(images), images)));
  }
  draw();
}

function build() {
  for (const [k, name] of Object.entries(KINDS)) {
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.kind = k;
    b.style.setProperty("--c", COLORS[k]);
    const n = PLACES.filter((p) => p.kind === k).length;
    b.innerHTML = `<i></i>${name}<small>${n}</small>`;
    b.onclick = () => { off.has(k) ? off.delete(k) : off.add(k); draw(); };
    $("kinds").append(b);
  }

  for (const p of PLACES) {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "dot";
    d.dataset.n = String(p.n);
    d.style.left = `${p.u * 100}%`;
    d.style.top = `${p.v * 100}%`;
    d.style.setProperty("--c", COLORS[p.kind]);
    d.title = `${p.n}. ${p.name} — ${KINDS[p.kind]}`;
    d.textContent = String(p.n);
    d.onclick = () => { chosen = p.n; draw(); };
    $("dots").append(d);
  }

  $("close").onclick = () => OBR.modal.close(ATLAS);
  $("show").onclick = async () => {
    await OBR.broadcast.sendMessage(MAP, {}, { destination: "REMOTE" });
    $("show").textContent = "Відкрито гравцям ✓";
    setTimeout(() => { $("show").textContent = "Мапу — гравцям"; }, 2500);
  };
  $("reset").onclick = () => OBR.broadcast.sendMessage(VOTE_RESET, {}, { destination: "ALL" });
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") OBR.modal.close(ATLAS);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const list = PLACES.filter((p) => !off.has(p.kind));
      const at = list.findIndex((p) => p.n === chosen);
      const to = list[(at + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
      if (to) { chosen = to.n; draw(); }
    }
  });

  // «Пливемо сюди»: рахуємо дні в морі й кидаємо d100 на подію в дорозі
  $("go").onclick = async () => {
    const p = PLACES.find((x) => x.n === chosen);
    if (!p || !present.has(p.map)) return;
    if (!here || here === p.n) return arrive(p);
    const days = daysBetween(PLACES.find((x) => x.n === here), p);
    const chance = chanceFor(days);
    const roll = 1 + Math.floor(Math.random() * 100);
    if (roll > chance) return arrive(p);
    const ev = randomEvent(here, p.n);
    await saveVoyage({ from: here, to: p.n, days, chance, roll, event: ev.id, played: false });
  };

  $("eplay").onclick = async () => {
    const ev = currentEvent();
    if (!ev) return;
    const to = adhoc ? null : voyage?.to;
    await OBR.broadcast.sendMessage(ATLAS, {
      kind: "event", map: ev.map, mood: ev.mood, big: ev.show,
      small: "У відкритому морі",
      // запис у корабельний журнал — лише нейтральна назва, без розгадки
      log: { k: "e", t: ev.show, s: to ? `У дорозі до №${to}` : "У морі", d: dayNow() + (to ? Math.max(1, Math.floor(voyage.days / 2)) : 0) },
    }, { destination: "LOCAL" });
    if (adhoc) adhoc = null;
    else await saveVoyage({ ...voyage, played: true });
    await OBR.modal.close(ATLAS);
  };
  $("eother").onclick = async () => {
    const cur = currentEvent();
    const ev = randomEvent(adhoc ? here : voyage?.from, adhoc ? null : voyage?.to, cur?.id);
    if (adhoc) { adhoc = ev; draw(); } else await saveVoyage({ ...voyage, event: ev.id });
  };
  $("eskip").onclick = async () => {
    if (adhoc) { adhoc = null; draw(); return; }
    const p = PLACES.find((x) => x.n === voyage?.to);
    if (p) await arrive(p);
  };
  $("roll").onclick = () => {
    if (voyage?.event && !voyage.played) return $("eother").onclick();
    adhoc = randomEvent(here, null);
    draw();
  };
  $("onward").onclick = async () => {
    const p = PLACES.find((x) => x.n === voyage?.to);
    if (p) await arrive(p);
  };
  $("abort").onclick = () => saveVoyage(null);

  // Поставити корабель на точку без переходу (наприклад, звідки починається плавання)
  $("herebtn").onclick = async () => {
    if (!chosen) return;
    seen.add(chosen);
    const next = route.at(-1) === chosen ? route : [...route, chosen];
    await OBR.room.setMetadata({ [HERE]: chosen, [ROUTE]: next, [VISITED]: [...seen].sort((a, b) => a - b), [VOYAGE]: null });
  };
  $("back").onclick = async () => {
    if (!route.length) return;
    const next = route.slice(0, -1);
    await OBR.room.setMetadata({ [ROUTE]: next, [HERE]: next.at(-1) ?? null, [VOYAGE]: null });
  };
  $("clear").onclick = async () => {
    await OBR.room.setMetadata({ [ROUTE]: here ? [here] : [], [VOYAGE]: null });
  };

  $("mark").onclick = async () => {
    if (!chosen) return;
    seen.has(chosen) ? seen.delete(chosen) : seen.add(chosen);
    draw();
    await OBR.room.setMetadata({ [VISITED]: [...seen].sort((a, b) => a - b) });
  };

  // Мапа завжди цілком у вікні, точки лежать на ній у тих самих частках
  const fit = () => {
    const box = $("sea").getBoundingClientRect();
    const ratio = 1402 / 1122;
    let w = box.width - 24, h = w / ratio;
    if (h > box.height - 24) { h = box.height - 24; w = h * ratio; }
    $("frame").style.width = `${w}px`;
    $("frame").style.height = `${h}px`;
  };
  new ResizeObserver(fit).observe($("sea"));
  fit();
}

async function saveVoyage(v) {
  voyage = v;
  draw();
  await OBR.room.setMetadata({ [VOYAGE]: v });
}

// Перехід на точку: фоновий скрипт майстра веде камеру, а потім дописує точку в маршрут
async function arrive(p) {
  // День прибуття: шлях разом із цим переходом
  const next = [...route];
  if (!next.length && here && here !== p.n) next.push(here);
  if (next.at(-1) !== p.n) next.push(p.n);
  const log = { k: "a", n: p.n, t: p.show, s: REGIONS[p.r], d: 1 + routeStats(next, daysBetween).days };
  await OBR.broadcast.sendMessage(ATLAS, { kind: "arrive", n: p.n, map: p.map, mood: p.mood, big: p.show, small: REGIONS[p.r], log }, { destination: "LOCAL" });
  await OBR.modal.close(ATLAS);
}

// Який сьогодні день плавання: перший день — у першій точці маршруту
const dayNow = () => 1 + routeStats(route, daysBetween).days;

function randomEvent(fromN, toN, not) {
  const pool = eventsFor(PLACES.find((x) => x.n === fromN), PLACES.find((x) => x.n === toN)).filter((e) => e.id !== not);
  return pool[Math.floor(Math.random() * pool.length)];
}

const currentEvent = () => adhoc ?? (voyage?.event && !voyage.played ? EVENTS.find((e) => e.id === voyage.event) : null);

function cardsFor(text, box, list) {
  const nums = [...new Set([...text.matchAll(/#(\d+)/g)].map((m) => Number(m[1])))].filter((n) => BESTIARY[n]);
  $(box).hidden = !nums.length;
  $(list).replaceChildren(...nums.map((n) => {
    const b = BESTIARY[n];
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `<span class="cn">#${n}</span><b></b><span class="rk">${b.rank}</span><span class="st">КД ${b.ac} · ХП ${b.hp} · ${b.xp} XP</span>`;
    row.querySelector("b").textContent = b.name;
    return row;
  }));
}

function draw() {
  for (const b of $("kinds").children) b.classList.toggle("off", off.has(b.dataset.kind));
  for (const d of $("dots").children) {
    const n = Number(d.dataset.n);
    const p = PLACES.find((x) => x.n === n);
    d.classList.toggle("hide", off.has(p.kind));
    d.classList.toggle("seen", seen.has(n));
    d.classList.toggle("on", n === chosen);
    d.classList.toggle("here", n === here);
    pips(d, votes.filter((v) => v.n === n));
  }
  // Пропозиції гравців: хто куди хоче, клік — відкрити ту точку
  $("reset").hidden = !votes.length;
  $("votes").replaceChildren(...(votes.length ? votes.map((v) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "vote";
    const place = PLACES.find((x) => x.n === v.n);
    row.innerHTML = `<i></i><span></span><b>№${v.n}</b>`;
    row.querySelector("i").style.background = v.color;
    row.querySelector("span").textContent = `${v.name} → ${place?.name ?? ""}`;
    row.onclick = () => { chosen = v.n; draw(); };
    return row;
  }) : [Object.assign(document.createElement("div"), { className: "none", textContent: "Поки порожньо. Кнопка «Мапу — гравцям» відкриє їм мапу з білими точками." })]));
  $("seen").innerHTML = `<b>${seen.size}</b> / ${PLACES.length}<span>відвідано</span>`;

  // Маршрут на мапі й підсумок під ним
  drawRoute($("frame"), route, voyage);
  const st = routeStats(route, daysBetween);
  $("rinfo").textContent = route.length
    ? `${route.join(" → ")} · переходів: ${st.legs}, ≈ ${st.days} дн. у морі`
    : "Порожньо. Обери точку, звідки починаєте, і натисни «Ми вже тут».";
  $("back").hidden = !route.length;
  $("clear").hidden = route.length < 2;

  // Подорож, що триває
  $("voyage").hidden = !voyage;
  if (voyage) {
    const to = PLACES.find((x) => x.n === voyage.to);
    const ev = EVENTS.find((e) => e.id === voyage.event);
    $("vline").textContent = `№${voyage.from} → №${voyage.to} ${to ? "«" + to.name + "»" : ""} · ≈ ${voyage.days} дн.` +
      (ev ? (voyage.played ? ` · подія «${ev.name}» розіграна` : ` · подія: «${ev.name}»`) : "");
    $("onward").hidden = !voyage.played;
  }

  // Подія в дорозі — поверх картки локації
  const ev = currentEvent();
  $("event").hidden = !ev;
  if (ev) {
    $("blank").hidden = true;
    $("info").hidden = true;
    $("ekind").textContent = EVENT_KINDS[ev.kind];
    $("etrip").textContent = adhoc ? "Просто зараз" : `Між №${voyage.from} і №${voyage.to}`;
    $("ename").textContent = ev.name;
    $("etag").textContent = ev.tag;
    $("eshow").textContent = `Гравці побачать титр: «${ev.show}» · У відкритому морі`;
    $("ewhat").textContent = ev.what;
    $("echeck").textContent = ev.check;
    $("eafter").textContent = ev.after;
    cardsFor(ev.check, "ecards-box", "ecards");
    $("eroll").textContent = adhoc ? "" : `≈ ${voyage.days} дн. у морі · шанс події ${voyage.chance}% · кидок d100: ${voyage.roll}`;
    $("eskip").textContent = adhoc ? "Закрити" : "Без події";
    $("eplay").disabled = !present.has(ev.map);
    return;
  }

  const p = PLACES.find((x) => x.n === chosen);
  $("blank").hidden = Boolean(p);
  $("info").hidden = !p;
  if (!p) return;

  $("kind").textContent = KINDS[p.kind];
  $("kind").style.setProperty("--c", COLORS[p.kind]);
  $("region").textContent = REGIONS[p.r];
  $("no").textContent = `${p.n}`;
  $("name").textContent = p.name;
  $("tag").textContent = p.tag;
  $("pshow").textContent = `Гравці побачать титр: «${p.show}» · ${REGIONS[p.r]}`;
  $("what").textContent = p.what;
  $("fight").textContent = p.fight;
  cardsFor(p.fight, "cards-box", "cards");
  $("reward").textContent = p.reward;
  $("hook").textContent = p.hook;
  $("mapname").textContent = ARCHETYPES[p.map] ?? p.map;
  $("mood").textContent = PRESETS.find((x) => x.id === p.mood)?.name ?? p.mood;

  const ok = present.has(p.map);
  const scene = SCENE_NAME[p.map] ?? p.map.replace(/^at(\d\d)$/, "at $1");
  $("warn").hidden = ok;
  $("warn").textContent = `У відкритій сцені немає мапи «${scene}». Відкрий сцену «Тихе море · Пригода» — там лежать усі мапи атласу.`;
  $("go").disabled = !ok;
  if (here && here !== p.n) {
    const days = daysBetween(PLACES.find((x) => x.n === here), p);
    $("trip").textContent = `Від №${here}: ≈ ${days} дн. у морі · шанс події в дорозі ${chanceFor(days)}%`;
  } else $("trip").textContent = here === p.n ? "Ви зараз тут." : "Звідки пливете — ще не відомо: постав корабель кнопкою нижче.";
  $("herebtn").hidden = here === p.n;
  $("mark").classList.toggle("on", seen.has(p.n));
  $("mark").textContent = seen.has(p.n) ? "✓ Відвідано" : "Позначити відвіданою";
}
