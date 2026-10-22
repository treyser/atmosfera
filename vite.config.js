import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/atmosfera/",
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        background: resolve(__dirname, "background.html"),
        index: resolve(__dirname, "index.html"),
        title: resolve(__dirname, "title.html"),
        hud: resolve(__dirname, "hud.html"),
        atlas: resolve(__dirname, "atlas.html"),
        map: resolve(__dirname, "map.html"),
        journal: resolve(__dirname, "journal.html"),
        envelope: resolve(__dirname, "envelope.html"),
        riddle: resolve(__dirname, "riddle.html"),
        zone: resolve(__dirname, "zone.html"),
        npc: resolve(__dirname, "npc.html"),
        fate: resolve(__dirname, "fate.html"),
        shop: resolve(__dirname, "shop.html"),
        bestiary: resolve(__dirname, "bestiary.html"),
        runes: resolve(__dirname, "runes.html"),
        stars: resolve(__dirname, "stars.html"),
        chest: resolve(__dirname, "chest.html"),
        board: resolve(__dirname, "board.html"),
        goals: resolve(__dirname, "goals.html"),
        rumors: resolve(__dirname, "rumors.html"),
        arsenal: resolve(__dirname, "arsenal.html"),
        studio: resolve(__dirname, "studio.html"),
        court: resolve(__dirname, "court.html"),
        scenes: resolve(__dirname, "scenes.html"),
        acq: resolve(__dirname, "acq.html"),
        "rumor-tell": resolve(__dirname, "rumor-tell.html"),
        trap: resolve(__dirname, "trap.html"),
        "trap-hit": resolve(__dirname, "trap-hit.html"),
        "trap-check": resolve(__dirname, "trap-check.html"),
        "npc-menu": resolve(__dirname, "npc-menu.html"),
      },
    },
  },
});
