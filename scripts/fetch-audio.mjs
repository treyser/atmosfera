// Під час збірки на GitHub: завантажити музику й звуки з src/tracks.js у dist/audio/.
// Якщо якийсь файл не завантажився — збірка не падає, лише пише про це в журнал.
import { mkdirSync, writeFileSync } from "node:fs";
import { TRACKS, SFX } from "../src/tracks.js";

mkdirSync("dist/audio", { recursive: true });
let ok = 0;
const ALL = [...TRACKS, ...SFX];
for (const t of ALL) {
  try {
    const res = await fetch(t.url, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 (atmosfera build; github.com/treyser/atmosfera)" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5000) throw new Error(`замалий файл (${buf.length} байт)`);
    writeFileSync(`dist/audio/${t.file}`, buf);
    console.log(`✓ ${t.file}  ${(buf.length / 1e6).toFixed(1)} MB  ${t.name}`);
    ok++;
  } catch (err) {
    console.log(`✗ ${t.file}  ${t.url}  — ${err.message}`);
  }
}
console.log(`Завантажено ${ok} з ${ALL.length}`);
