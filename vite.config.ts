import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// builds the popup into dist/; everything in public/ (manifest, background.js,
// block.js/css, icon) is copied into dist/ verbatim. load dist/ as the
// unpacked extension.
export default defineConfig({
  plugins: [react()],
  base: "./", // relative asset paths so popup.html works from any root

  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
      },
    },
  },
});
