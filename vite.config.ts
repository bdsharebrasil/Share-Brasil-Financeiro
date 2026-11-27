import fs from 'node:fs';
import { copyFile, mkdir } from 'node:fs/promises';
import path from 'path';
import react from '@vitejs/plugin-react-swc';
import dotenv from 'dotenv';
import { defineConfig, loadEnv } from 'vite';

const port = Number(process.env.PORT || 3000);
const apiOriginPadrao = 'https://api-workers.sharebrasil.workers.dev';
const outputDir = path.resolve(import.meta.dirname, 'dist');

export default defineConfig(({ mode }) => {
  const envFilePath = path.resolve(import.meta.dirname, '.env');
  if (fs.existsSync(envFilePath)) {
    const parsedEnv = dotenv.parse(fs.readFileSync(envFilePath, 'utf8'));
    if (
      parsedEnv.VITE_SUPABASE_PUBLISHABLE_KEY &&
      parsedEnv.VITE_SUPABASE_PUBLISHABLE_KEY.split('.').length === 3 &&
      (!process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
        process.env.VITE_SUPABASE_PUBLISHABLE_KEY.split('.').length < 3)
    ) {
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY = parsedEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
    }
  }
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = (env.VITE_API_PROXY_TARGET || apiOriginPadrao).trim().replace(/\/+$/, '');
  const apiProxy = {
    '/api': {
      target: apiTarget,
      changeOrigin: true,
      secure: true,
      ws: true,
    },
  };
  return {
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
        'src',
        'assets',
      ),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  root: path.resolve(import.meta.dirname),
  envDir: path.resolve(import.meta.dirname),
  publicDir: path.resolve(import.meta.dirname, 'public'),
  build: {
    outDir: outputDir,
    emptyOutDir: true,
  },
  server: {
    proxy: apiProxy,
    port,
    host: '0.0.0.0',
    allowedHosts: true,
    strictPort: false,
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
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
  };
});
