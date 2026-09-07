import { copyFile, mkdir } from 'node:fs/promises';
import path from 'path';
import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

const port = Number(process.env.PORT || 4175);
const outputDir = path.resolve(import.meta.dirname, 'dist/public');
const apiProxy = {
  '/api': {
    target: 'https://api.share-brasil.com',
    changeOrigin: true,
    secure: true,
    ws: true,
  },
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-login-entry',
      async writeBundle() {
        const loginDir = path.join(outputDir, 'login');
        await mkdir(loginDir, { recursive: true });
        await copyFile(path.join(outputDir, 'index.html'), path.join(loginDir, 'index.html'));
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(
        import.meta.dirname,
        '..',
        '..',
        'attached_assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  envDir: path.resolve(import.meta.dirname, '..', '..'),
  publicDir: path.resolve(import.meta.dirname, '..', '..', 'public'),
  build: {
    outDir: outputDir,
    emptyOutDir: true,
  },
  server: {
    proxy: apiProxy,
    port,
    host: '0.0.0.0',
    strictPort: false,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
    cors: {
      origin: '*',
      credentials: false,
    },
  },
  preview: {
    proxy: apiProxy,
    port,
    host: '0.0.0.0',
    strictPort: false,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  },
});
