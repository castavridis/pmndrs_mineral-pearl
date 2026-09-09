import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// `base` stays '/' so the SPA rewrite in vercel.json serves nested routes
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  // the desktop-app preview assigns a free port through PORT
  server: { port: Number(process.env.PORT) || 5173 },
});
