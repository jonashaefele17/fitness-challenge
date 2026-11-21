import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Windows: Node reports the cwd with the drive letter as typed ("c:\\" in VS Code terminals),
// while resolved dependencies use the real path ("C:\\"). Mixed casing makes Vite bundle
// modules such as React twice. Normalise to upper case for root and aliases.
const projectRoot = process.cwd().replace(/^[a-z]:/, (drive) => drive.toUpperCase());

// Keep in sync with --color-bg in src/shared/design-tokens/tokens.css.
// The manifest is generated at build time, so it cannot read CSS variables.
const BACKGROUND_COLOR = '#0b0b0c';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, 'VITE_');
  const base = env.VITE_BASE_PATH || '/';

  return {
    root: projectRoot,
    base,
    resolve: {
      alias: { '@': resolve(projectRoot, 'src') },
    },
    server: { port: 5173, strictPort: true },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        // Custom service worker (src/service-worker/sw.ts) for Web Push; Workbox still
        // precaches the build output.
        strategies: 'injectManifest',
        srcDir: 'src/service-worker',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        injectRegister: false,
        includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        },
        manifest: {
          name: 'Fitness Challenge',
          short_name: 'Challenge',
          description: 'Gemeinsam trainieren, Fortschritt sichtbar machen.',
          lang: 'de',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'portrait',
          background_color: BACKGROUND_COLOR,
          theme_color: BACKGROUND_COLOR,
          icons: [
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: { enabled: false },
      }),
    ],
  };
});
