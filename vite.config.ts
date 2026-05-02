import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/** Injects Figma HTML-to-design capture script when `VITE_FIGMA_CAPTURE=1` (dev only). */
function figmaCaptureInjectPlugin() {
  return {
    name: "figma-capture-inject",
    transformIndexHtml(html: string) {
      if (process.env.VITE_FIGMA_CAPTURE !== "1") return html;
      return html.replace(
        "</body>",
        '    <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>\n  </body>',
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), figmaCaptureInjectPlugin()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
