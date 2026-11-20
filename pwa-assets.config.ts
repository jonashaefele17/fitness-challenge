import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#0b0b0c' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#0b0b0c' } },
  },
  images: ['public/favicon.svg'],
});
