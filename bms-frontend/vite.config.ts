import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  const apiProxyTarget = process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || "http://127.0.0.1:8001";

  return {
    plugins: [react(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const moduleId = id.replace(/\\/g, "/");
            if (moduleId.includes("/node_modules/recharts/")) return "charts";
            if (moduleId.includes("/node_modules/@tanstack/react-query/")) return "query";
            if (moduleId.includes("/node_modules/react-hook-form/") || moduleId.includes("/node_modules/zod/")) return "forms";
            if (moduleId.includes("/node_modules/lucide-react/")) return "icons";
            if (/\/node_modules\/(react|react-dom|scheduler)\//.test(moduleId)) return "react";
          },
        },
      },
    },
    server: {
      port: 5174,
      proxy: {
        "/api": { target: apiProxyTarget, changeOrigin: false },
        "/admin": { target: apiProxyTarget, changeOrigin: false },
      },
    },
  };
});
