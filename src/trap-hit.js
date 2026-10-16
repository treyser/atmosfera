// Вікно спрацювання пастки: гравці позначають рятунок (кидають справжні кубики), майстер вводить шкоду.
import OBR from "@owlbear-rodeo/sdk";
import "./trap.css";
import { TRAP_SAVE, TRAP_DMG, ID } from "./state.js";
import { SAVES, unpack } from "./trap-data.js";
import { readSheet } from "./shop-data.js";

const $ = (id) => document.getElementById(id);
const d = unpack(new URLSearchParams(location.search).get("d")) ?? {};
const WIN = `${ID}/trap-win`;
let ok = null;
let gm = false;

OBR.onReady(async () => {
  gm = (await OBR.player.getRole()) === "GM";
  const me = (readSheet(OBR.room.id)?.data?.name || "").trim() || (await OBR.player.getName());
  $("icon").textContent = d.icon || "⚠";
  $("name").textContent = d.name || "Пастка";
  $("who").textContent = `${d.token} наступає на пастку!`;
  $("save").textContent = `Рятівний кидок ${SAVES[d.save] ?? ""} · СК ${d.dc}`;
  $("dmg").textContent = d.dmg ? `Шкода: ${d.dmg}${d.half ? " (половина при успіху)" : ""}` : "";
  $("x").onclick = () => OBR.popover.close(WIN);
  const send = (v) => OBR.broadcast.sendMessage(TRAP_SAVE, { fid: d.fid, ok: v, who: me }, { destination: "ALL" });
  $("ok").onclick = () => send(true);
  $("fail").onclick = () => send(false);
  OBR.broadcast.onMessage(TRAP_SAVE, (e) => {
    if (e.data?.fid !== d.fid || ok !== null) return;
    ok = e.data.ok;
    $("pbtns").hidden = true;
    $("result").textContent = ok ? `Рятунок вдався${d.half && d.dmg ? " — половина шкоди" : d.dmg ? "" : " — обійшлося"}` : "Рятунок провалено";
    $("card").classList.add(ok ? "good" : "bad");
    if (gm) { $("gmd").hidden = !d.dmg; if (!d.dmg) dealt(0); else $("n").focus(); }
  });
  OBR.broadcast.onMessage(TRAP_DMG, (e) => {
    if (e.data?.fid !== d.fid) return;
    $("gmd").hidden = true;
    $("result").textContent += e.data.n ? ` · −${e.data.n} ХП` : "";
    setTimeout(() => OBR.popover.close(WIN), 3500);
  });
  const dealt = (n) => OBR.broadcast.sendMessage(TRAP_DMG, { fid: d.fid, token: d.token, tokenId: d.tokenId, name: d.name, n, failed: ok === false, cond: d.cond }, { destination: "ALL" });
  $("hit").onclick = () => dealt(Math.max(0, Number($("n").value) || 0));
  $("nohit").onclick = () => dealt(0);
  $("n").addEventListener("keydown", (e) => { if (e.key === "Enter") $("hit").click(); });
  if (gm) { $("pbtns").classList.add("gmb"); }
});
