import type { APIContext } from 'astro';
import { sitePath } from '@/utils/paths';

export function GET({ site }: APIContext) {
  const sitemap = site ? new URL(sitePath('/sitemap-index.xml'), site).href : '/sitemap-index.xml';
  return new Response(`User-agent: *\nAllow: /\nSitemap: ${sitemap}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
