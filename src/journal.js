// Корабельний журнал: записи Атласу й гравців; листи гравця; у майстра — листи гравцям і нитки героїв.
import OBR from "@owlbear-rodeo/sdk";
import "./journal.css";
import { JOURNAL, LOG_ADD, LOG_DEL, LOG_REQ, ROUTE } from "./state.js";
import { saveLocal, bytes, plain, book, appendLog, BOOK, INBOX, NOTES, LIMIT, MAX_TEXT } from "./log.js";
import { sessions, recap, PARTS } from "./recap.js";
import { inbox, openEnvelope, sentNotes, sendNote, forgetNote } from "./notes.js";
import { routeStats } from "./route.js";
import { daysBetween } from "./atlas-points.js";
import { FRAGMENTS } from "./melody.js";
import { whistleNotes, audio } from "./synth.js";

const $ = (id) => document.getElementById(id);
const PICK = "atmosfera.inbox.open";
let gm = false;
let me = { id: "", name: "", color: "#e8c27a" };
let log = [];
let room = {};
let tab = "log";
let heroesReady = false;

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  const [id, name, color] = await Promise.all([OBR.player.getId(), OBR.player.getName(), OBR.player.getColor()]);
  me = { id, name, color };
  for (const el of document.querySelectorAll("[data-gm]")) el.hidden = !gm;
  document.querySelector('[data-tab="mail"]').hidden = gm;

  room = await OBR.room.getMetadata();
  log = book();
  OBR.room.onMetadataChange((m) => { room = m; drawLog(false); });
  // Журнал і листи змінює фоновий скрипт — інше вікно того ж сайту, тож чуємо це через сховище
  window.addEventListener("storage", (e) => {
    if (e.key === INBOX) drawMail();
    if (e.key === NOTES) drawSent();
    if (e.key === BOOK) {
      const grew = book().length > log.length;
      log = book();
      drawLog(grew);
    }
  });
  // Гравець просить у майстра свіжий журнал; поки відповіді немає — показуємо збережену копію
  if (!gm) {
    OBR.broadcast.sendMessage(LOG_REQ, {}, { destination: "REMOTE" }).catch(() => {});
    setTimeout(() => { if (!$("stale").dataset.ok) $("stale").hidden = false; }, 3000);
    window.addEventListener("storage", (e) => {
      if (e.key === `${BOOK}.sync`) { $("stale").dataset.ok = "1"; $("stale").hidden = true; }
    });
  }

  build();
  drawLog(true);
  drawMail();
  if (gm) { await fillTo(); drawSent(); OBR.party.onChange(fillTo); }
});

function build() {
  for (const b of $("tabs").children) b.onclick = () => go(b.dataset.tab);
  $("close").onclick = () => OBR.modal.close(JOURNAL);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape") OBR.modal.close(JOURNAL); });
  $("who").textContent = gm ? "Пише майстер" : `Пише ${me.name}`;
  $("who").style.setProperty("--c", me.color);

  $("write").onsubmit = async (e) => {
    e.preventDefault();
    const t = $("text").value.trim().slice(0, MAX_TEXT);
    if (!t) return;
    $("send").disabled = true;
    await OBR.broadcast.sendMessage(LOG_ADD, { k: gm ? "g" : "p", t, w: gm ? "Майстер" : me.name, c: me.color, u: me.id, d: today() }, { destination: "ALL" });
    $("text").value = "";
    // якщо майстра немає в кімнаті, записати нікому — скажемо про це
    setTimeout(() => {
      $("send").disabled = false;
      if (!book().some((x) => x.t === t)) $("who").textContent = "Запис не дійшов: журнал веде Owlbear майстра, а його зараз немає в кімнаті";
    }, 2500);
  };
  $("text").onkeydown = (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) $("write").requestSubmit(); };

  $("meter").onclick = () => { $("mem").hidden = !$("mem").hidden; };
  // Резервна копія журналу: журнал живе в браузері майстра, тож його варто часом зберігати
  $("backup").onclick = () => {
    const box = $("bk");
    box.hidden = !box.hidden;
    $("bktext").value = JSON.stringify(book());
  };
  $("bkcopy").onclick = async () => {
    $("bktext").select();
    try { await navigator.clipboard.writeText($("bktext").value); $("bkcopy").textContent = "Скопійовано ✓"; } catch { $("bkcopy").textContent = "Виділено — Ctrl+C"; }
  };
  $("bkload").onclick = () => {
    try {
      const list = JSON.parse($("bktext").value);
      if (!Array.isArray(list) || list.some((e) => !e?.i || !e?.k)) throw new Error();
      saveLocal(BOOK, list);
      log = list;
      drawLog(true);
      $("bk").hidden = true;
      OBR.broadcast.sendMessage(LOG_REQ, {}, { destination: "LOCAL" });   // роздати гравцям оновлений
    } catch { $("bkload").textContent = "Це не схоже на копію журналу"; }
  };
  $("copy").onclick = async () => {
    const all = log;
    const text = "Корабельний журнал\n\n" + all.map(plain).join("\n");
    try { await navigator.clipboard.writeText(text); $("copy").textContent = "Скопійовано ✓"; }
    catch {
      // буфер обміну у вікні розширення може бути заборонено — тоді вибираємо текст у полі
      $("text").value = text; $("text").select(); $("copy").textContent = "Виділено — Ctrl+C";
    }
    setTimeout(() => { $("copy").textContent = "Скопіювати журнал"; }, 2500);
  };

  // Підсумок сесії
  const parts = new Set(PARTS.filter((x) => x.on).map((x) => x.k));
  $("rc-parts").replaceChildren(...PARTS.map((x) => {
    const l = document.createElement("label");
    l.className = parts.has(x.k) ? "on" : "";
    l.innerHTML = '<input type="checkbox"><span></span>';
    l.querySelector("span").textContent = x.name;
    const box = l.querySelector("input");
    box.checked = parts.has(x.k);
    box.onchange = () => { if (box.checked) parts.add(x.k); else parts.delete(x.k); l.classList.toggle("on", box.checked); makeRecap(parts); };
    return l;
  }));
  $("rc-sess").onchange = () => makeRecap(parts);
  recapParts = parts;
  $("rc-copy").onclick = async () => {
    try { await navigator.clipboard.writeText($("rc-text").value); $("rc-copy").textContent = "Скопійовано ✓"; }
    catch { $("rc-text").select(); $("rc-copy").textContent = "Виділено — Ctrl+C"; }
    setTimeout(() => { $("rc-copy").textContent = "Скопіювати"; }, 2500);
  };
  $("rc-post").onclick = async () => {
    const t = $("rc-text").value.trim().slice(0, 3000);
    if (!t) return;
    $("rc-post").disabled = true;
    await appendLog({ k: "s", t, d: today() });
    log = book();
    drawLog(true);
    $("rc-post").textContent = "Записано ✓ — гравці побачать у журналі";
    setTimeout(() => { $("rc-post").disabled = false; $("rc-post").textContent = "Записати в журнал як «Минулого разу…»"; }, 3000);
  };

  $("compose").onsubmit = async (e) => {
    e.preventDefault();
    const t = $("note").value.trim();
    const opt = $("to").selectedOptions[0];
    if (!t || !opt?.value) return;
    await sendNote({ to: opt.value, name: opt.dataset.name, t, quiet: $("quiet").checked });
    $("note").value = "";
    drawSent();
  };
}

function go(next) {
  tab = next;
  for (const b of $("tabs").children) b.classList.toggle("on", b.dataset.tab === tab);
  for (const p of document.querySelectorAll(".pane")) p.hidden = p.id !== `pane-${tab}`;
  if (tab === "heroes" && !heroesReady) {
    heroesReady = true;
    // нитки героїв вантажимо лише в майстра: окремий шматок коду, гравцям він не потрібен
    import("./heroes.js").then((m) => m.mount($("heroes")));
  }
  if (tab === "recap") drawRecap();
  if (tab === "log") $("log-scroll").scrollTop = $("log-scroll").scrollHeight;
}

const today = () => 1 + routeStats(room[ROUTE] ?? [], daysBetween).days;

// --- журнал ---

function entry(e, archived) {
  const row = document.createElement("div");
  row.className = `entry k-${e.k}${archived ? " old" : ""}`;
  const day = document.createElement("div");
  day.className = "eday";
  day.textContent = e.d ? `День ${e.d}` : "";
  const body = document.createElement("div");
  body.className = "ebody";
  if (e.k === "s") {
    // підсумок попередньої сесії
    const t = document.createElement("div");
    t.className = "etitle";
    // перший рядок «Минулого разу (дні …):» стає заголовком картки
    const [first, ...rest] = String(e.t).split("\n");
    const head = /^Минулого разу/.test(first);
    t.textContent = `📜 ${head ? first.replace(/:\s*$/, "") : "Минулого разу…"}`;
    const p = document.createElement("p");
    p.textContent = head ? rest.join("\n") : e.t;
    body.append(t, p);
  } else if (e.k === "m" || e.k === "r") {
    // уривок мелодії Маркуса — його можна переслухати; розгадана загадка Ребер
    const t = document.createElement("div");
    t.className = "etitle tune";
    t.textContent = e.k === "m" ? `♪ Почута мелодія — уривок ${e.n} з ${FRAGMENTS.length}` : `♪ ${e.t}`;
    body.append(t);
    if (e.k === "m" && FRAGMENTS[e.n - 1]) {
      const play = document.createElement("button");
      play.type = "button";
      play.className = "listen";
      play.textContent = "▶ Переслухати";
      play.onclick = () => { audio(); whistleNotes(FRAGMENTS[e.n - 1]); };
      body.append(play);
    }
  } else if (e.k === "a" || e.k === "e") {
    const t = document.createElement("div");
    t.className = "etitle";
    t.textContent = e.k === "a" ? `⚓ Прибули до №${e.n} — «${e.t}»` : `✦ «${e.t}»`;
    const s = document.createElement("div");
    s.className = "esub";
    s.textContent = e.s ?? "";
    body.append(t, s);
  } else {
    const w = document.createElement("span");
    w.className = "ewho";
    w.textContent = e.k === "g" ? "Майстер" : e.w || "Гравець";
    w.style.setProperty("--c", e.k === "g" ? "#e8c27a" : e.c || "#9aa3ad");
    const t = document.createElement("p");
    t.textContent = e.t;
    body.append(w, t);
  }
  row.append(day, body);
  // Викреслити: майстер — будь-що, гравець — лише своє
  if (gm || (e.k === "p" && e.u === me.id)) {
    const x = document.createElement("button");
    x.type = "button";
    x.className = "del";
    x.title = "Викреслити запис";
    x.textContent = "✕";
    x.onclick = () => OBR.broadcast.sendMessage(LOG_DEL, { i: e.i, u: gm ? null : me.id }, { destination: "ALL" });
    row.append(x);
  }
  return row;
}

function drawLog(scroll) {
  const box = $("log-scroll");
  const atEnd = box.scrollHeight - box.scrollTop - box.clientHeight < 60;
  $("log").replaceChildren(...(log.length ? log.map((e) => entry(e, false)) : [
    Object.assign(document.createElement("div"), { className: "none", textContent: "Журнал порожній. Перший запис з'явиться, щойно корабель кудись припливе, або напиши щось сам." }),
  ]));
  if (gm) {
    const used = bytes(room);
    $("meter").textContent = `Пам'ять кімнати: ${(used / 1000).toFixed(1)} з ${LIMIT / 1000} кБ`;
    $("meter").classList.toggle("warn", used > LIMIT * 0.85);
    // Хто скільки займає пам'ять кімнати — по кліку на лічильник
    $("mem").replaceChildren(...Object.entries(room)
      .map(([k, v]) => [k, bytes({ [k]: v })])
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => Object.assign(document.createElement("div"), { textContent: `${(n / 1000).toFixed(1)} кБ — ${k}` })));
  }
  $("day").innerHTML = `<b>День ${today()}</b><span>плавання</span>`;
  if (scroll || atEnd) box.scrollTop = box.scrollHeight;
}

// --- майстер: підсумок сесії ---

let recapParts = new Set();
function drawRecap() {
  const list = sessions(log);
  const keep = $("rc-sess").value;
  $("rc-sess").replaceChildren(...list.map((x, n) => {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = x.label;
    return o;
  }), Object.assign(document.createElement("option"), { value: "all", textContent: "Усе плавання" }));
  $("rc-sess").value = keep && [...$("rc-sess").options].some((o) => o.value === keep) ? keep : (list.length ? String(list.length - 1) : "all");
  makeRecap(recapParts);
}

function makeRecap(parts) {
  const list = sessions(log);
  const v = $("rc-sess").value;
  const pick = v === "all" ? log.filter((e) => e.k !== "s") : (list[Number(v)]?.items ?? []);
  $("rc-info").textContent = `${pick.length} записів`;
  $("rc-text").value = pick.length ? recap(pick, parts) : "У цій сесії журнал порожній.";
}

// --- листи гравця ---

function drawMail() {
  if (gm) return;
  const list = inbox();
  const unread = list.filter((n) => !n.read).length;
  $("unread").hidden = !unread;
  $("unread").textContent = String(unread);
  $("mail").replaceChildren(...(list.length ? [...list].reverse().map((n) => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = `letterrow${n.read ? "" : " fresh"}`;
    const when = new Date(n.at).toLocaleString("uk-UA", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    row.innerHTML = `<i>✉</i><span></span><small></small>`;
    row.querySelector("span").textContent = n.read ? n.t : "Запечатаний лист — натисни, щоб зламати печатку";
    row.querySelector("small").textContent = when;
    row.onclick = () => { saveLocal(PICK, n.id); openEnvelope(); };
    return row;
  }) : [Object.assign(document.createElement("div"), { className: "none", textContent: "Листів поки немає. Якщо майстер щось надішле лише тобі, воно з'явиться тут." })]));
}

// --- майстер: листи гравцям ---

async function fillTo() {
  const players = await OBR.party.getPlayers();
  const known = new Map(players.map((p) => [p.id, { name: p.name, on: true }]));
  // ті, кому вже писали, — навіть якщо зараз їх немає в кімнаті
  for (const n of sentNotes()) if (!known.has(n.to)) known.set(n.to, { name: n.name, on: false });
  const keep = $("to").value;
  $("to").replaceChildren(...(known.size ? [...known].map(([id, p]) => {
    const o = document.createElement("option");
    o.value = id;
    o.dataset.name = p.name;
    o.textContent = p.on ? p.name : `${p.name} (не в кімнаті)`;
    return o;
  }) : [Object.assign(document.createElement("option"), { value: "", textContent: "У кімнаті немає гравців" })]));
  if (keep && known.has(keep)) $("to").value = keep;
}

function drawSent() {
  if (!gm) return;
  const STATUS = { sent: "надіслано, ще не дійшов", got: "дійшов, ще запечатаний", read: "розпечатано ✓" };
  const list = [...sentNotes()].reverse();
  $("sent").replaceChildren(...(list.length ? list.map((n) => {
    const row = document.createElement("div");
    row.className = `sentrow st-${n.st}`;
    row.innerHTML = `<div class="sh"><b></b><span class="st"></span><button type="button" class="del" title="Прибрати зі списку">✕</button></div><p></p>`;
    row.querySelector("b").textContent = `→ ${n.name}`;
    row.querySelector(".st").textContent = STATUS[n.st] ?? n.st;
    row.querySelector("p").textContent = n.t;
    row.querySelector(".del").onclick = () => { forgetNote(n.id); drawSent(); };
    return row;
  }) : [Object.assign(document.createElement("div"), { className: "none", textContent: "Ще жодного листа." })]));
}
