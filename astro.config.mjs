// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import remarkBasePath from './src/lib/remark-base-path.mjs';
import { normalizeBase } from './src/lib/paths.mjs';

// Hosting-agnostic: GitHub Pages project site by default, custom domain / VPS by env override.
const site = process.env.SITE_URL || 'https://labuno.github.io';
const base = process.env.BASE_PATH || '/luna-site/';

export default defineConfig({
  site,
  base: normalizeBase(base).replace(/\/$/, '') || '/',
  output: 'static',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    remarkPlugins: [[remarkBasePath, { base }]],
    shikiConfig: {
      theme: 'github-dark-default',
      wrap: true,
    },
  },
});
