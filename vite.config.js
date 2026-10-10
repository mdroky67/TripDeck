import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

// On GitHub Pages the site lives under the repository name, so production
// builds need a base path. Anywhere else:  BASE=/ npm run build
export default defineConfig(({ command }) => ({
  base: process.env.BASE ?? (command === 'build' ? '/TripDeck/' : '/'),
  plugins: [preact()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  build: { target: 'es2020', cssTarget: 'safari15' },
}));
