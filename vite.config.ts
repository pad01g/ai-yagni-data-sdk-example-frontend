import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// 手元の開発サーバーは /api を backend-rust に渡す（compose の中では nginx が同じことをする）。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { "/api": process.env["BACKEND_URL"] ?? "http://localhost:8000" },
  },
});
