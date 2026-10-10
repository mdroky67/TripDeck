import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

// On GitHub Pages the site lives under the repository name, so production
// builds need a base path. Anywhere else:  BASE=/ npm run build
export default defineConfig(({ command }) => ({
  base: process.env.BASE ?? (command === 'build' ? '/TripDeck/' : '/'),
  plugins: [preact()],
  build: { target: 'es2020', cssTarget: 'safari15' },
}));
