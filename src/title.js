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
  plate.addEventListener("animationend", (e) => { if (e.target === plate) OBR.popover.close(CARD); });
  // чекаємо шрифт, але не довше пів секунди: без нього титр вийде запасним шрифтом
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 500))]);
  plate.classList.add("go");
});
