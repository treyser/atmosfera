// Мапа світу для гравців: лише номери точок, без типів і таємниць. Можна запропонувати курс.
import OBR from "@owlbear-rodeo/sdk";
import "./atlas.css";
import { MAP, VISITED, HERE } from "./state.js";
import { POINTS, REGIONS } from "./atlas-points.js";
import { getVotes, onVotes, setVote, pips } from "./votes.js";

const $ = (id) => document.getElementById(id);
let chosen = null;
let seen = new Set();
let here = null;
let votes = [];

$("map").src = import.meta.env.BASE_URL + "atlas-map.jpg";

OBR.onReady(async () => {
  build();
  const room = await OBR.room.getMetadata();
  seen = new Set(room[VISITED] ?? []);
  here = room[HERE] ?? null;
  OBR.room.onMetadataChange((m) => { seen = new Set(m[VISITED] ?? []); here = m[HERE] ?? null; draw(); });
  votes = await getVotes();
  onVotes(async () => { votes = await getVotes(); draw(); });
  draw();
});

function build() {
  for (const p of POINTS) {
    const d = document.createElement("button");
    d.type = "button";
    d.className = "dot";
    d.dataset.n = String(p.n);
    d.style.left = `${p.u * 100}%`;
    d.style.top = `${p.v * 100}%`;
    d.textContent = String(p.n);
    d.onclick = () => { chosen = p.n; draw(); };
    $("dots").append(d);
  }

  $("close").onclick = () => OBR.modal.close(MAP);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") OBR.modal.close(MAP); });

  $("vote").onclick = async () => {
    if (!chosen) return;
    const mine = votes.find((v) => v.self);
    await setVote(mine?.n === chosen ? null : chosen);   // повторний клік — забрати пропозицію
    votes = await getVotes();
    draw();
  };

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
  for (const d of $("dots").children) {
    const n = Number(d.dataset.n);
    d.classList.toggle("seen", seen.has(n));
    d.classList.toggle("here", n === here);
    d.classList.toggle("on", n === chosen);
    pips(d, votes.filter((v) => v.n === n));
  }
  $("seen").innerHTML = `<b>${seen.size}</b> / ${POINTS.length}<span>відвідано</span>`;

  // Список пропозицій
  $("votes").replaceChildren(...(votes.length ? votes.map((v) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "vote";
    row.innerHTML = `<i></i><span></span><b>№${v.n}</b>`;
    row.querySelector("i").style.background = v.color;
    row.querySelector("span").textContent = v.self ? `${v.name} (ти)` : v.name;
    row.onclick = () => { chosen = v.n; draw(); };
    return row;
  }) : [Object.assign(document.createElement("div"), { className: "none", textContent: "Поки ніхто нічого не запропонував." })]));

  const p = POINTS.find((x) => x.n === chosen);
  $("pick").hidden = Boolean(p);
  $("info").hidden = !p;
  if (!p) return;
  $("region").textContent = REGIONS[p.r];
  $("no").textContent = String(p.n);
  $("state").textContent = p.n === here ? "Ви зараз тут" : seen.has(p.n) ? "Ви тут уже були" : "Незвідані води";
  const mine = votes.find((v) => v.self);
  const on = mine?.n === p.n;
  $("vote").textContent = on ? "Забрати пропозицію" : mine ? "Змінити пропозицію на цю" : "Пропоную плисти сюди";
  $("vote").classList.toggle("undo", on);
}
