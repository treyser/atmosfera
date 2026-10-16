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
        "npc-menu": resolve(__dirname, "npc-menu.html"),
      },
    },
  },
});
