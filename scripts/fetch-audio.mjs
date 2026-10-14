// Під час збірки на GitHub: завантажити музику й звуки з src/tracks.js у dist/audio/.
// Якщо якийсь файл не завантажився — збірка не падає, лише пише про це в журнал.
import { mkdirSync, writeFileSync } from "node:fs";
import { TRACKS } from "../src/tracks.js";

mkdirSync("dist/audio", { recursive: true });
let ok = 0;
for (const t of TRACKS) {
  try {
    const res = await fetch(t.url, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) throw new Error(`замалий файл (${buf.length} байт)`);
    writeFileSync(`dist/audio/${t.file}`, buf);
    console.log(`✓ ${t.file}  ${(buf.length / 1e6).toFixed(1)} MB  ${t.name}`);
    ok++;
  } catch (err) {
    console.log(`✗ ${t.file}  ${t.url}  — ${err.message}`);
  }
}
console.log(`Завантажено ${ok} з ${TRACKS.length}`);
