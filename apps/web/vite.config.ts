import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = process.env.API_URL ?? "http://127.0.0.1:3100";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // three.js is most of the game chunk, and it's lazy-loaded only on game routes.
  build: { chunkSizeWarningLimit: 1200 },
  server: {
    proxy: { "/api": api, "/models": api },
    // Allow sharing the dev/preview server through an ngrok tunnel.
    allowedHosts: [".ngrok-free.app", ".ngrok-free.dev", ".ngrok.app", ".ngrok.io"],
  },
});
