// Перевірка Уважності: гравець кидає справжній кубик і вводить результат. Пройшов — бачить пастку.
import OBR from "@owlbear-rodeo/sdk";
import "./trap.css";
import { TRAP_SEEN, ID } from "./state.js";
import { unpack, seenTraps, saveSeenTraps } from "./trap-data.js";
import { readSheet } from "./shop-data.js";

const $ = (id) => document.getElementById(id);
const d = unpack(new URLSearchParams(location.search).get("d")) ?? {};
const WIN = `${ID}/trap-check-win`;

OBR.onReady(async () => {
  const room = OBR.room.id;
  const me = (readSheet(room)?.data?.name || "").trim() || (await OBR.player.getName());
  $("x").onclick = () => OBR.popover.close(WIN);
  $("n").focus();
  $("n").addEventListener("keydown", (e) => { if (e.key === "Enter") $("go").click(); });
  $("go").onclick = async () => {
    const total = Number($("n").value);
    if (!total) return;
    const ok = total >= (Number(d.dc) || 99);
    $("go").disabled = true;
    if (ok) {
      const s = new Set(seenTraps(room)); s.add(d.tid); saveSeenTraps(room, [...s]);
      $("result").textContent = d.clue ? `Ти помічаєш: ${d.clue}` : "Ти помічаєш щось недобре — тут пастка.";
      $("card").classList.add("good");
    } else {
      $("result").textContent = "Нічого підозрілого.";
    }
    await OBR.broadcast.sendMessage(TRAP_SEEN, { tid: d.tid, who: me, total, ok }, { destination: "REMOTE" }).catch(() => {});
    setTimeout(() => OBR.popover.close(WIN), ok ? 6000 : 2500);
  };
});
