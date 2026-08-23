import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://guru-ankam-portfolio.pages.dev',
  integrations: [tailwind()],
});
