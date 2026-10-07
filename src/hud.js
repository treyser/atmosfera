// Таймер раундів і лічильник прориву для всіх гравців: читає числа з метаданих сцени.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { HUD, hudOf } from "./state.js";

const $ = (id) => document.getElementById(id);
let last = null;

function pips(el, filled, total) {
  el.replaceChildren();
  for (let n = 0; n < total; n++) {
    const pip = document.createElement("i");
    if (n < filled) pip.className = "on";
    el.append(pip);
  }
}

function draw(raw) {
  const t = hudOf(raw);
  $("bar").hidden = false;
  const rounds = $("rounds");
  rounds.textContent = String(t.rounds);
  rounds.classList.toggle("low", t.rounds <= 3);
  // коротке «цокання», коли число змінилось
  if (last !== null && last !== t.rounds) {
    rounds.classList.remove("tick");
    void rounds.offsetWidth;
    rounds.classList.add("tick");
  }
  last = t.rounds;
  pips($("ok"), t.ok, t.okMax);
  pips($("fail"), t.fail, t.failMax);
}

OBR.onReady(async () => {
  OBR.scene.onMetadataChange((m) => draw(m[HUD]));
  if (await OBR.scene.isReady()) draw((await OBR.scene.getMetadata())[HUD]);
});
