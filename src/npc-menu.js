// Меню токена: показати всім картку персонажа — портрет з токена, ім'я і хто це.
// Ім'я й підпис запам'ятовуються на токені, тож наступного разу — один клік.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { NPC } from "./state.js";

const $ = (id) => document.getElementById(id);
let item = null;

OBR.onReady(async () => {
  const sel = (await OBR.player.getSelection()) ?? [];
  if (!sel.length) return;
  [item] = await OBR.scene.items.getItems([sel[0]]);
  if (!item) return;
  const saved = item.metadata?.[NPC] ?? {};
  // підказка імені: збережене, або підпис токена, або його назва
  $("name").value = saved.name ?? (item.text?.plainText || item.name || "");
  $("sub").value = saved.sub ?? "";
  $("name").focus();
  $("name").select();
  $("all").onclick = () => show("ALL");
  $("me").onclick = () => show("LOCAL");
  for (const id of ["name", "sub"]) $(id).onkeydown = (e) => { if (e.key === "Enter") show("ALL"); };
});

async function show(destination) {
  const name = $("name").value.trim();
  if (!name) { $("name").focus(); return; }
  const sub = $("sub").value.trim();
  await OBR.scene.items.updateItems([item.id], (ds) => { for (const d of ds) d.metadata[NPC] = { name, sub }; });
  await OBR.broadcast.sendMessage(NPC, { img: item.image?.url ?? "", name, sub }, { destination });
  $("hint").textContent = destination === "ALL" ? "показано всім ✓" : "лише вам ✓";
}
