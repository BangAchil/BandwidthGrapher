import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      "/romon-sse": {
        target: "https://romon.vpnbersama.us",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/romon-sse/, ""),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("Accept", "text/event-stream");
            proxyReq.setHeader("Cache-Control", "no-cache");
          });
          proxy.on("proxyRes", (proxyRes) => {
            proxyRes.headers["cache-control"] = "no-cache, no-transform";
            proxyRes.headers["x-accel-buffering"] = "no";
          });
        },
      },
    },
  },
});
