// Керування Hoot (музичне розширення з магазину Owlbear) з «Атмосфери».
// Hoot слухає канал "eu.armindo.hoot" і вміє: додати трек у бібліотеку майстра ("add-track"),
// увімкнути трек плейлиста ("play") і плавно погасити плейлист ("fade"). Гравцям музику роздає сам Hoot.
// Працює лише в майстра й лише коли Hoot встановлено в кімнаті.
import OBR from "@owlbear-rodeo/sdk";
import { TRACKS, PL, BY_MOOD, MUSIC_VOL, BG_VOL } from "./tracks.js";

const CHANNEL = "eu.armindo.hoot";
const FADE_MS = 1500;   // скільки чекаємо, поки старий плейлист погасне, перш ніж вмикати новий

const src = (file) => new URL(`${import.meta.env.BASE_URL}audio/${file}`, window.location.origin).href;

async function send(message) {
  const sender = await OBR.player.getId();
  // LOCAL: Hoot майстра працює в цьому ж браузері
  await OBR.broadcast.sendMessage(CHANNEL, { sender, message }, { destination: "LOCAL" });
}

// Додати всі треки «Атмосфери» в бібліотеку Hoot (Hoot сам пропускає ті, що вже є)
export async function addAll() {
  for (const t of TRACKS) {
    await send({ type: "add-track", payload: { name: t.name, source: src(t.file), playlists: [PL[t.pl]] } });
    await new Promise((r) => setTimeout(r, 120));   // Hoot зберігає по одному — не засипаємо його
  }
}

const first = (key) => TRACKS.find((t) => t.pl === key);

export const play = (key, volume) => {
  const t = first(key);
  if (!t) return Promise.resolve();
  return send({
    type: "play",
    payload: { playlist: PL[key], track: t.name, repeatMode: t.bg ? "repeat-self" : "repeat-all", shuffle: false, volume: volume ?? (t.bg ? BG_VOL : MUSIC_VOL) },
  });
};

export const fadeOut = (key) => send({ type: "fade", payload: { playlist: PL[key], fade: "out", duration: FADE_MS } });

// Що зараз грає за нашою командою: { music: ключ або null, bg: [ключі] }
let now = { music: null, bg: [] };
let busy = Promise.resolve();

// Перемкнути на ціль: зайве погасити, нове ввімкнути
export function setTarget(target) {
  busy = busy.then(async () => {
    const next = { music: target.music ?? null, bg: [...new Set(target.bg ?? [])] };
    // Гасимо все «своє», чого немає в цілі — навіть те, що грало ще до перезавантаження сторінки
    const keep = new Set([next.music, ...next.bg].filter(Boolean));
    const gone = Object.keys(PL).filter((k) => !keep.has(k));
    for (const k of gone) await fadeOut(k);
    const changed = next.music !== now.music || now.bg.some((k) => !keep.has(k));
    if (changed) await new Promise((r) => setTimeout(r, FADE_MS));
    if (next.music && next.music !== now.music) await play(next.music);
    for (const k of next.bg) if (!now.bg.includes(k)) await play(k);
    now = next;
  }).catch((err) => console.error("Атмосфера → Hoot:", err));
  return busy;
}

export const targetForMood = (preset, sea = true) => {
  const t = BY_MOOD[preset] ?? { music: null, bg: [] };
  return { music: t.music, bg: sea ? t.bg : t.bg.filter((k) => k !== "waves") };
};

export const silence = () => setTarget({ music: null, bg: [] });
export const current = () => now;
