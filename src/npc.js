// Картка персонажа: портрет, ім'я і хто це — з'являється внизу екрана й зникає сама.
import OBR from "@owlbear-rodeo/sdk";
import "./style.css";
import { NPC, NPC_CARD } from "./state.js";

const STAY = 6500;   // скільки картка тримається на екрані, мс

OBR.onReady(async () => {
  const card = (await OBR.player.getMetadata())[NPC_CARD] ?? {};
  document.getElementById("name").textContent = card.name ?? "";
  const sub = document.getElementById("sub");
  sub.textContent = card.sub ?? "";
  sub.hidden = !sub.textContent;
  const img = document.getElementById("img");
  const face = img.parentElement;
  if (card.img) {
    img.src = card.img;
    img.onerror = () => { face.hidden = true; };
  } else {
    face.hidden = true;
  }
  // чекаємо шрифт і портрет, але недовго
  await Promise.race([
    Promise.all([document.fonts.ready, card.img ? img.decode().catch(() => {}) : null]),
    new Promise((r) => setTimeout(r, 900)),
  ]);
  const who = document.querySelector(".who");
  who.classList.add("in");
  setTimeout(() => {
    who.classList.replace("in", "out");
    who.addEventListener("animationend", () => OBR.popover.close(NPC), { once: true });
    setTimeout(() => OBR.popover.close(NPC), 1500);   // запасне закриття, якщо анімація не відіграла
  }, STAY);
});
