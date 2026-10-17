import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),
    tailwindcss(),
  ],
  server: {
    // Forward API calls to FastAPI so the frontend and backend share an
    // origin in development (keeps the session cookie simple).
    proxy: {
      "/api": process.env.API_PROXY_TARGET ?? "http://127.0.0.1:8000",
    },
  },
});
