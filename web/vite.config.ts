import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
// In dev, serve the repo-root `out/` directory so `/data/...` resolves locally.
export default defineConfig(({ command }) => ({
    plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
    publicDir: command === 'serve' ? '../out' : 'public',
    test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
}));
