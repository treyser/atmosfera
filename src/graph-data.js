// Графи (блупрінти): збережений граф LiteGraph + як по ньому ходити.
// Типи вузлів: ev/… — події (старт), if/… — умова з виходами «так / ні», flow/random — випадковий вихід,
// flow/choice — вибір гравців (вихід на кожну кнопку + «час вийшов»), act/… — дія (вхід → вихід).
import { local, saveLocal, uid } from "./log.js";

export const GRAPHS = (room) => `atmosfera.graphs.${room}`;
export const graphs = (room) => local(GRAPHS(room), []);
export const saveGraphs = (room, v) => saveLocal(GRAPHS(room), v);
export const blankGraph = () => ({ id: "g" + uid(), name: "Новий граф", on: true, data: null, off: {} });

const kindOf = (type) => {
  const [a, b] = String(type ?? "").split("/");
  if (a === "ev") return "ev";
  if (a === "if") return "if";
  if (a === "flow") return b;          // random, choice
  if (a === "act") return "act";
  return null;
};

// вузли-події графа як «слухачі» для виконавця
export function nodeEvents(g, all = false) {
  const out = [];
  for (const n of g.data?.nodes ?? []) {
    if (kindOf(n.type) !== "ev") continue;
    if (!all && g.off?.[n.id]) continue;
    const p = n.properties ?? {};
    out.push({ id: `g:${g.id}:${n.id}`, name: `${g.name}${n.title ? ` · ${n.title}` : ""}`, cd: Number(p.cd) || 0, once: Boolean(p.once), ev: { ...p, t: n.type.slice(3) }, graph: g, node: n.id });
  }
  return out;
}

// куди йти далі: вузли, приєднані до виходу slot вузла nodeId (у порядку зв'язків)
export function nextNodes(g, nodeId, slot) {
  const d = g.data;
  if (!d) return [];
  const node = d.nodes.find((n) => n.id === nodeId);
  const links = node?.outputs?.[slot]?.links ?? [];
  const out = [];
  for (const lid of links) {
    const l = d.links.find((x) => (Array.isArray(x) ? x[0] : x.id) === lid);
    if (!l) continue;
    const target = Array.isArray(l) ? l[3] : l.target_id;
    const t = d.nodes.find((n) => n.id === target);
    if (!t) continue;
    const kind = kindOf(t.type);
    if (!kind || kind === "ev") continue;
    out.push({ node: t.id, kind, props: { ...(t.properties ?? {}), t: t.type.split("/")[1] } });
  }
  return out.sort((a, b) => (d.nodes.find((n) => n.id === a.node)?.pos?.[1] ?? 0) - (d.nodes.find((n) => n.id === b.node)?.pos?.[1] ?? 0));
}
