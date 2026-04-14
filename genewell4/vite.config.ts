import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createServer } from "./genewell4_fixed/server";

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    watch: {
      ignored: ['**/.pythonlibs/**', '**/.cache/uv/**'],
    },
  },
  build: {
    outDir: "dist/spa",
  },
  plugins: [react(), mode === 'development' && expressPlugin()].filter(Boolean) as Plugin[],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./genewell4_fixed/client"),
      "@shared": path.resolve(__dirname, "./genewell4_fixed/shared"),
    },
    dedupe: ["react", "react-dom"],
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    configureServer(server) {
      const app = createServer();
      server.middlewares.use(app);
    },
  };
}
