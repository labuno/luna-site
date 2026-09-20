import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './content/blog' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    /** 一级栏目，例如 AI / Engineering / Notes */
    section: z.string(),
    /** 二级分类，例如 Agent / Astro */
    category: z.string(),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const novels = defineCollection({
  loader: glob({ pattern: '**/novel.{yaml,yml}', base: './content/novels' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    author: z.string(),
    status: z.enum(['serializing', 'completed', 'paused']).default('serializing'),
    description: z.string(),
    genres: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    cover: z.string().optional(),
    created: z.coerce.date(),
    updated: z.coerce.date(),
    featured: z.boolean().default(false),
  }),
});

const chapters = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/novels' }),
  schema: z.object({
    title: z.string(),
    /** 所属小说的 novel.yaml slug */
    novel: z.string(),
    slug: z.string(),
    volume: z.string().default('正文'),
    chapter: z.number().int().positive(),
    published: z.coerce.date(),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{yaml,yml}', base: './content/projects' }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    description: z.string(),
    url: z.url().optional(),
    repo: z.url().optional(),
    status: z.enum(['idea', 'building', 'active', 'archived']).default('active'),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
  }),
});

export const collections = { blog, novels, chapters, projects };
