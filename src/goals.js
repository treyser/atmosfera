// Таємні цілі: майстер пише ціль героєві й запечатує; гравець ламає печатку й бачить лише свої.
import OBR from "@owlbear-rodeo/sdk";
import "./goals.css";
import { GOAL, GOAL_DATA, GOAL_REQ, GOAL_CLAIM } from "./state.js";
import { readSheet } from "./shop-data.js";
import {
  GOALS, MINE, SHEETS, STATUS, IDEAS, allGoals, saveAll, myGoals, saveMine, opened, markOpened, owner, uid, forPlayer,
} from "./goal-data.js";

const $ = (id) => document.getElementById(id);
let gm = false;
let room = "";
let all = {};
let heroes = {};      // власник листа → ім'я
let sel = "";

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  room = OBR.room.id;
  $("close").onclick = () => OBR.modal.close(GOAL);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) OBR.modal.close(GOAL); });
  if (gm) initGM(); else initPlayer();
});

// ---------- гравець ----------

function initPlayer() {
  $("pl").hidden = false;
  const me = owner();
  OBR.broadcast.onMessage(GOAL_DATA, (e) => { if (e.data?.to === me) { saveMine(room, e.data.goals ?? []); drawPlayer(); } });
  window.addEventListener("storage", (e) => { if (e.key === MINE(room)) drawPlayer(); });
  if (me) OBR.broadcast.sendMessage(GOAL_REQ, { to: me }, { destination: "REMOTE" }).catch(() => {});
  drawPlayer();
}

function drawPlayer() {
  const list = myGoals(room);
  const op = opened();
  const name = (readSheet(room)?.data?.name || "").trim();
  $("sub").textContent = name ? `лише для очей ${name}` : "лише для твоїх очей";
  const box = $("cards");
  box.innerHTML = "";
  if (!owner()) { box.innerHTML = `<div class="none">Спершу відкрий свій «Лист персонажа» — цілі приходять героєві.</div>`; return; }
  if (!list.length) { box.innerHTML = `<div class="none">Поки жодної таємної цілі. Майстер може надіслати її будь-коли.</div>`; return; }
  for (const g of list.slice().reverse()) {
    const c = document.createElement("div");
    if (!op.has(g.id)) {
      c.className = "sealed";
      c.innerHTML = `<div class="env"><div class="flap"></div><div class="seal" title="Зламати печатку">✦</div><div class="hint">Запечатано. Відкрий, коли ніхто не дивиться.</div></div>`;
      c.querySelector(".seal").onclick = () => {
        c.classList.add("breaking");
        setTimeout(() => { markOpened(g.id); drawPlayer(); }, 750);
      };
    } else {
      c.className = `goal st-${g.status}`;
      c.innerHTML = `<div class="gt"></div><div class="gx"></div>
        ${g.status === "done" && g.reward ? `<div class="rw"><span>Нагорода</span><p></p></div>` : ""}
        <div class="gf"><span class="badge">${STATUS[g.status] ?? ""}</span></div>`;
      c.querySelector(".gt").textContent = g.title;
      c.querySelector(".gx").textContent = g.text;
      if (c.querySelector(".rw p")) c.querySelector(".rw p").textContent = g.reward;
      if (g.status === "active") {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "ghost sm";
        b.textContent = "Здається, я це зробив";
        b.onclick = () => {
          b.disabled = true;
          OBR.broadcast.sendMessage(GOAL_CLAIM, { to: owner(), gid: g.id, who: name }, { destination: "REMOTE" }).catch(() => {});
          toast("Майстер отримав. Він вирішить.");
        };
        c.querySelector(".gf").appendChild(b);
      }
    }
    box.appendChild(c);
  }
}

// ---------- майстер ----------

function initGM() {
  $("gm").hidden = false;
  all = allGoals();
  const take = (m) => {
    heroes = {};
    for (const [id, v] of Object.entries(m[SHEETS] ?? {})) heroes[id] = v?.name || "Без імені";
    for (const id of Object.keys(all)) if (!heroes[id]) heroes[id] = all[id][0]?.hero || "Герой (лист не в кімнаті)";
    if (!sel || !heroes[sel]) sel = Object.keys(heroes)[0] ?? "";
    draw();
  };
  OBR.room.getMetadata().then(take);
  OBR.room.onMetadataChange(take);
  window.addEventListener("storage", (e) => { if (e.key === GOALS) { all = allGoals(); draw(); } });
  $("idea").onclick = () => {
    const i = IDEAS[Math.floor(Math.random() * IDEAS.length)];
    $("n-title").value = i.title; $("n-text").value = i.text; $("n-reward").value = i.reward;
  };
  $("n-draft").onclick = () => create(false);
  $("n-send").onclick = () => create(true);
}

function save(push) {
  saveAll(all);
  if (push) send(sel);
  draw();
}
function send(to, fresh) {
  return OBR.broadcast.sendMessage(GOAL_DATA, { to, goals: forPlayer(all[to]), fresh }, { destination: "REMOTE" }).catch(() => {});
}

function create(sendNow) {
  if (!sel) return toast("Немає героя — гравці мають відкрити свої листи персонажа");
  const title = $("n-title").value.trim(), text = $("n-text").value.trim();
  if (!title || !text) return toast("Потрібні назва й текст");
  const g = { id: uid(), title, text, reward: $("n-reward").value.trim(), gm: $("n-gm").value.trim(), status: "active", sent: sendNow, hero: heroes[sel], at: Date.now() };
  (all[sel] ??= []).push(g);
  saveAll(all);
  if (sendNow) send(sel, g.id);
  for (const id of ["n-title", "n-text", "n-reward", "n-gm"]) $(id).value = "";
  draw();
  toast(sendNow ? `Запечатано й надіслано: ${heroes[sel]}` : "Чернетку збережено");
}

function draw() {
  $("sub").textContent = "бачиш лише ти — кожен гравець бачить тільки свої";
  const box = $("heroes");
  box.innerHTML = "";
  if (!Object.keys(heroes).length) box.innerHTML = `<div class="none small">Героїв ще немає. Цілі надсилаються за листами персонажів — нехай гравці відкриють свої листи.</div>`;
  for (const [id, name] of Object.entries(heroes)) {
    const list = all[id] ?? [];
    const act = list.filter((g) => g.status === "active" || g.status === "claimed").length;
    const claim = list.some((g) => g.status === "claimed");
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hero" + (id === sel ? " on" : "") + (claim ? " ping" : "");
    b.innerHTML = `<b></b><span>${act ? `цілей: ${act}` : list.length ? "усе завершено" : "без цілей"}</span>`;
    b.querySelector("b").textContent = name;
    b.onclick = () => { sel = id; draw(); };
    box.appendChild(b);
  }
  $("for").textContent = heroes[sel] ?? "—";
  $("new").hidden = !sel;
  const gbox = $("hero-goals");
  gbox.innerHTML = "";
  for (const g of (all[sel] ?? []).slice().reverse()) {
    const c = document.createElement("div");
    c.className = `goal gmv st-${g.status}` + (g.sent ? "" : " draft");
    c.innerHTML = `<div class="gt"></div><div class="gx"></div>
      ${g.reward ? `<div class="rw small"><span>Нагорода</span><p></p></div>` : ""}
      ${g.gm ? `<div class="gmn">🔒 <i></i></div>` : ""}
      <div class="gf"><span class="badge">${g.sent ? STATUS[g.status] : "Чернетка"}</span><span class="btns"></span></div>`;
    c.querySelector(".gt").textContent = g.title;
    c.querySelector(".gx").textContent = g.text;
    if (c.querySelector(".rw p")) c.querySelector(".rw p").textContent = g.reward;
    if (c.querySelector(".gmn i")) c.querySelector(".gmn i").textContent = g.gm;
    const btns = c.querySelector(".btns");
    const btn = (label, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label; b.onclick = fn; btns.appendChild(b); };
    if (!g.sent) btn("Запечатати й надіслати", "go sm", () => { g.sent = true; saveAll(all); send(sel, g.id); draw(); });
    else {
      if (g.status !== "done") btn("Виконано", "go sm", () => { g.status = "done"; save(true); });
      if (g.status !== "failed") btn("Провалено", "ghost sm danger", () => { g.status = "failed"; save(true); });
      if (g.status === "done" || g.status === "failed" || g.status === "claimed") btn("Знову триває", "ghost sm", () => { g.status = "active"; save(true); });
    }
    let armed = 0;
    btn("🗑", "ghost sm", () => {
      if (Date.now() - armed > 3000) { armed = Date.now(); return toast("Ще раз — і ціль зникне в гравця теж"); }
      all[sel] = all[sel].filter((x) => x.id !== g.id);
      save(true);
    });
    gbox.appendChild(c);
  }
}

let toastTimer = null;
function toast(text) {
  const t = $("toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
