import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

// Dev-only smoke test for bloomwright-ui. Static output; Tailwind v4 via the
// Vite plugin, exactly as a real consumer would wire it.
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
