import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

declare const process: { env: { API_PROXY_TARGET?: string } };

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET: envApiProxyTarget } = loadEnv(mode, ".", "");
  const apiProxyTarget = process.env.API_PROXY_TARGET ?? envApiProxyTarget ?? "http://127.0.0.1:8001";
  const apiProxyOptions = { target: apiProxyTarget, changeOrigin: false };
  const apiProxy = {
    "/api": apiProxyOptions,
    "/media": apiProxyOptions,
    "/orders": apiProxyOptions,
  };
  return {
    plugins: [react(), tailwindcss()],
    server: { proxy: apiProxy },
    preview: { proxy: apiProxy },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replace(/\\/g, "/");
            if (moduleId.includes("/node_modules/gsap/")) return "gsap";
            if (/\/node_modules\/(framer-motion|motion-dom|motion-utils)\//.test(moduleId)) {
              return "motion";
            }
          },
        },
      },
    },
  };
});
