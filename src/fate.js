// Кидок долі: майстер кидає d20 потай, гравці бачать лише кубик і настрій результату — без чисел.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { FATE, FATE_CARD } from "./state.js";
import { playSecret } from "./sfx.js";

// Чотири відтінки долі; ключ приходить від майстра
export const TIERS = {
  crit: { text: "Доля усміхається", sub: "Краще й бути не могло", cls: "crit" },
  good: { text: "Цього разу пощастило", sub: "", cls: "good" },
  bad:  { text: "Щось пішло не так…", sub: "", cls: "bad" },
  fumble: { text: "Доля відвернулася", sub: "Гірше й бути не могло", cls: "fumble" },
};

const $ = (id) => document.getElementById(id);

if (document.body.classList.contains("fate")) {
  OBR.onReady(async () => {
    const card = (await OBR.player.getMetadata())[FATE_CARD] ?? {};
    const tier = TIERS[card.tier] ?? TIERS.good;
    $("q").textContent = card.q ?? "";
    $("q").hidden = !card.q;
    $("verdict").textContent = tier.text;
    $("sub").textContent = tier.sub;
    $("sub").hidden = !tier.sub;
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 500))]);
    const box = $("box");
    box.classList.add("roll");
    playSecret("dice", "front", 1).catch(() => {});
    setTimeout(() => box.classList.add("done", tier.cls), 1700);
    setTimeout(() => box.classList.add("out"), 5600);
    setTimeout(() => OBR.popover.close(FATE), 6400);
  });
}
