// Атлас незвіданих вод: мапа світу з 51 точкою, картка локації й перехід «Пливемо сюди».
import OBR from "@owlbear-rodeo/sdk";
import "./atlas.css";
import { ATLAS, VISITED, PRESETS } from "./state.js";
import { PLACES, KINDS, REGIONS, ARCHETYPES } from "./atlas-data.js";
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

$("map").src = import.meta.env.BASE_URL + "atlas-map.jpg";

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    document.body.innerHTML = '<div class="only">Атлас бачить лише майстер.</div>';
    return;
  }
  build();
  const room = await OBR.room.getMetadata();
  seen = new Set(room[VISITED] ?? []);
  OBR.room.onMetadataChange((m) => { seen = new Set(m[VISITED] ?? []); draw(); });
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
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") OBR.modal.close(ATLAS);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const list = PLACES.filter((p) => !off.has(p.kind));
      const at = list.findIndex((p) => p.n === chosen);
      const to = list[(at + (e.key === "ArrowRight" ? 1 : list.length - 1)) % list.length];
      if (to) { chosen = to.n; draw(); }
    }
  });

  $("go").onclick = async () => {
    const p = PLACES.find((x) => x.n === chosen);
    if (!p || !present.has(p.map)) return;
    // Перехід веде фоновий скрипт майстра, тож вікно можна закрити одразу — екран темніє вже без нього.
    await OBR.broadcast.sendMessage(ATLAS, { n: p.n, map: p.map, mood: p.mood, big: p.name, small: p.tag }, { destination: "LOCAL" });
    await OBR.modal.close(ATLAS);
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

function draw() {
  for (const b of $("kinds").children) b.classList.toggle("off", off.has(b.dataset.kind));
  for (const d of $("dots").children) {
    const n = Number(d.dataset.n);
    const p = PLACES.find((x) => x.n === n);
    d.classList.toggle("hide", off.has(p.kind));
    d.classList.toggle("seen", seen.has(n));
    d.classList.toggle("on", n === chosen);
  }
  $("seen").innerHTML = `<b>${seen.size}</b> / ${PLACES.length}<span>відвідано</span>`;

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
  $("what").textContent = p.what;
  $("fight").textContent = p.fight;
  $("reward").textContent = p.reward;
  $("hook").textContent = p.hook;
  $("mapname").textContent = ARCHETYPES[p.map] ?? p.map;
  $("mood").textContent = PRESETS.find((x) => x.id === p.mood)?.name ?? p.mood;

  const ok = present.has(p.map);
  const scene = SCENE_NAME[p.map] ?? p.map.replace(/^at(\d\d)$/, "at $1");
  $("warn").hidden = ok;
  $("warn").textContent = `У відкритій сцені немає мапи «${scene}». Відкрий сцену «Тихе море · Пригода» — там лежать усі мапи атласу.`;
  $("go").disabled = !ok;
  $("mark").classList.toggle("on", seen.has(p.n));
  $("mark").textContent = seen.has(p.n) ? "✓ Відвідано" : "Позначити відвіданою";
}
