import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/romon-sse": {
        target: "https://romon.vpnbersama.us",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/romon-sse/, ""),
      },
    },
  },
});
