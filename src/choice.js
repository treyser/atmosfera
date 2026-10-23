// Вікно вибору для гравців (з блупрінта): питання й кнопки. Перша відповідь вирішує — граф іде далі.
import OBR from "@owlbear-rodeo/sdk";
import { CHOICE, CHOICE_ANS } from "./state.js";
import { unpack } from "./trap-data.js";

const $ = (id) => document.getElementById(id);
const WIN = `${CHOICE}-win`;
const d = unpack(new URLSearchParams(location.search).get("d") || "") ?? {};

const css = document.createElement("style");
css.textContent = `
body.choicew{margin:0; background:transparent; font-family:Inter,system-ui,sans-serif; color:#ece6d8; overflow:hidden}
.cbox{margin:6px; padding:16px 18px 12px; border-radius:16px; background:radial-gradient(120% 90% at 50% 0%, #2a2216, #121619 75%);
  border:1px solid rgba(232,194,122,.5); box-shadow:0 18px 40px rgba(0,0,0,.6); animation:drop .35s ease-out both}
@keyframes drop{from{transform:translateY(-14px); opacity:0}}
#q{margin:0 0 12px; font-family:"Cormorant Garamond",Georgia,serif; font-size:22px; line-height:1.25; text-align:center; color:#f3d595}
.cbtns{display:flex; flex-wrap:wrap; gap:8px; justify-content:center}
.cbtns button{flex:1 1 40%; padding:10px 12px; border-radius:10px; border:1px solid rgba(232,194,122,.45); background:rgba(232,194,122,.08); color:#ece6d8; font:inherit; font-weight:600; cursor:pointer}
.cbtns button:hover{background:rgba(232,194,122,.2)}
.bar{margin-top:12px; height:3px; border-radius:2px; background:rgba(255,255,255,.08); overflow:hidden}
.bar i{display:block; height:100%; background:#e8c27a; transform-origin:left}`;
document.head.appendChild(css);

OBR.onReady(async () => {
  $("q").textContent = d.text || "Що робите?";
  const name = await OBR.player.getName();
  (d.opts ?? []).forEach((o, i) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = o;
    b.onclick = async () => {
      for (const x of $("btns").children) x.disabled = true;
      await OBR.broadcast.sendMessage(CHOICE_ANS, { cid: d.cid, i, who: name }, { destination: "REMOTE" }).catch(() => {});
      OBR.popover.close(WIN);
    };
    $("btns").appendChild(b);
  });
  const secs = Number(d.secs) || 90;
  $("bar").animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], { duration: secs * 1000, fill: "forwards" });
  setTimeout(() => OBR.popover.close(WIN), secs * 1000 + 500);
});
