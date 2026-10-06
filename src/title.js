// Сам титр: бере текст з адреси і грає появу та зникнення.
import "./style.css";

const q = new URLSearchParams(window.location.search);
document.getElementById("big").textContent = q.get("big") ?? "";
const small = document.getElementById("small");
small.textContent = q.get("small") ?? "";
small.hidden = !small.textContent;
