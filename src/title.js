// Сам титр: бере текст із метаданих гравця і грає появу та зникнення.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { CARD } from "./state.js";

OBR.onReady(async () => {
  const meta = await OBR.player.getMetadata();
  const text = meta[CARD] ?? {};
  document.getElementById("big").textContent = text.big ?? "";
  const small = document.getElementById("small");
  small.textContent = text.small ?? "";
  small.hidden = !small.textContent;

  // Вікно вантажиться не миттєво, тому появу починаємо лише тепер і закриваємось самі, коли вона дограє.
  const plate = document.querySelector(".plate");
  plate.addEventListener("animationend", () => OBR.popover.close(CARD));
  plate.classList.add("go");
});
