/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// GitHub Pages serves the site from /wuwa-optimizer/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/wuwa-optimizer/',
  plugins: [react(), tailwindcss()],
  test: { environment: 'node' },
});
