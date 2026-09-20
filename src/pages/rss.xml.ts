import type { APIContext } from 'astro';
import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { siteConfig } from '@/site.config';
import { sitePath } from '@/utils/paths';

export async function GET(context: APIContext) {
  if (!context.site) throw new Error('Missing `site` in Astro config: set SITE_URL before building.');

  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: siteConfig.title,
    description: siteConfig.description,
    site: new URL(sitePath('/'), context.site),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: new URL(sitePath(`/blog/${post.data.slug}/`), context.site).href,
    })),
  });
}
