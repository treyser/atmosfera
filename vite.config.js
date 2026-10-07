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
      },
    },
  },
});
