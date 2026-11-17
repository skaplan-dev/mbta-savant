import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
// In dev, serve the repo-root `out/` directory so `/data/...` resolves locally.
export default defineConfig(({ command }) => ({
    plugins: [react()],
    publicDir: command === 'serve' ? '../out' : 'public',
}));
