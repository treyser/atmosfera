import OBR from "@owlbear-rodeo/sdk";
import "./rumors.css";
import { ID } from "./state.js";
import { unpack } from "./trap-data.js";
const d = unpack(new URLSearchParams(location.search).get("d")) ?? {};
const WIN = `${ID}/rumor-win`;
document.getElementById("text").textContent = d.text ?? "";
document.getElementById("who").textContent = `— ${d.who || "хтось у таверні"}${d.where ? `, ${d.where}` : ""}`;
OBR.onReady(() => {
  document.getElementById("x").onclick = () => OBR.popover.close(WIN);
  setTimeout(() => OBR.popover.close(WIN), 16000);
});
