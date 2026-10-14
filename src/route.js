// Лінія пройденого шляху на мапі світу: однакова в Атласі майстра і на мапі гравців.
import { POINTS } from "./atlas-points.js";

const NS = "http://www.w3.org/2000/svg";
const at = (n) => POINTS.find((p) => p.n === n);
const xy = (p) => `${(p.u * 1402).toFixed(1)},${(p.v * 1122).toFixed(1)}`;

// Плавна дуга між точками: трохи вигнута, як справжній курс корабля
function arc(a, b, bend = 0.12) {
  const ax = a.u * 1402, ay = a.v * 1122, bx = b.u * 1402, by = b.v * 1122;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const cx = mx - (by - ay) * bend, cy = my + (bx - ax) * bend;
  return { d: `M${ax.toFixed(1)},${ay.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`,
    mid: { x: 0.25 * ax + 0.5 * cx + 0.25 * bx, y: 0.25 * ay + 0.5 * cy + 0.25 * by } };
}

function el(name, attrs) {
  const e = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}

// frame — контейнер мапи; route — [n, n, ...]; voyage — { from, to, event } або null
export function drawRoute(frame, route = [], voyage = null) {
  let svg = frame.querySelector("svg.route");
  if (!svg) {
    svg = el("svg", { class: "route", viewBox: "0 0 1402 1122", preserveAspectRatio: "none" });
    frame.insertBefore(svg, frame.querySelector(".dots"));
  }
  svg.replaceChildren();

  // Пройдені відрізки: темна підкладка і золота лінія, найсвіжіший — яскравіший
  const legs = [];
  for (let i = 1; i < route.length; i++) {
    const a = at(route[i - 1]), b = at(route[i]);
    if (a && b && a !== b) legs.push(arc(a, b));
  }
  legs.forEach((leg, i) => {
    const fresh = i === legs.length - 1;
    svg.append(el("path", { d: leg.d, class: "leg-shadow" }));
    svg.append(el("path", { d: leg.d, class: fresh ? "leg fresh" : "leg" }));
  });

  // Подорож, що триває: пунктир до цілі й кораблик посередині, якщо в дорозі сталася подія
  const a = at(voyage?.from), b = at(voyage?.to);
  if (a && b && a !== b) {
    const leg = arc(a, b);
    svg.append(el("path", { d: leg.d, class: "leg-shadow" }));
    svg.append(el("path", { d: leg.d, class: "leg plan" }));
    if (voyage.event) {
      const g = el("g", { class: "ship", transform: `translate(${leg.mid.x.toFixed(1)},${leg.mid.y.toFixed(1)})` });
      g.append(el("circle", { r: "15" }));
      const t = el("text", { y: "6", "text-anchor": "middle" });
      t.textContent = "⚓";
      g.append(t);
      svg.append(g);
    }
  }
}

// Скільки переходів і днів уже позаду
export function routeStats(route, daysBetween) {
  let days = 0;
  for (let i = 1; i < route.length; i++) days += daysBetween(at(route[i - 1]), at(route[i]));
  return { legs: Math.max(0, route.length - 1), days };
}
