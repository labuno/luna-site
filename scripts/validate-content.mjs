#!/usr/bin/env node
/**
 * Build-time content validation (document 11.1):
 * required fields, unique slugs, unique chapter numbers, taxonomy slug collisions,
 * media reference existence, and the draft inventory used by the dist assertions.
 *
 * Astro's own Content Schema still validates types at build time; this script runs
 * earlier, works without a build, and is cheap to run in CI.
 */
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { scanContent } from './lib/content.mjs';
import { slugify, taxonomySlug } from '../src/lib/slug.mjs';
import { taxonomyOverrides } from '../src/lib/taxonomy-overrides.mjs';

const REQUIRED = {
  blog: ['title', 'slug', 'description', 'date', 'section', 'category'],
  novel: ['title', 'slug', 'author', 'description', 'created', 'updated'],
  chapter: ['title', 'novel', 'slug', 'chapter', 'published'],
  project: ['title', 'description'],
};

function isPresent(value) {
  return value !== undefined && value !== null && value !== '';
}

function checkRequired(data, fields, file, errors, label = '') {
  for (const field of fields) {
    if (!isPresent(data[field])) {
      errors.push(`${file}: missing required field "${field}"${label ? ` (${label})` : ''}`);
    }
  }
}

function mediaReferences(entry) {
  const refs = [];
  if (typeof entry.data.cover === 'string') refs.push(entry.data.cover);
  const body = typeof entry.body === 'string' ? entry.body : '';
  for (const match of body.matchAll(/!\[[^\]]*\]\((\/media\/[^)\s]+)/g)) refs.push(match[1]);
  for (const match of body.matchAll(/<img[^>]+src=["'](\/media\/[^"']+)["']/g)) refs.push(match[1]);
  return refs;
}

async function mediaExists(mediaDir, reference) {
  if (!reference.startsWith('/media/')) return { ok: false, reason: 'must start with /media/' };
  const relative = reference.replace(/^\/media\//, '').split(/[?#]/)[0];
  try {
    await access(path.join(mediaDir, relative));
    return { ok: true };
  } catch {
    return { ok: false, reason: `missing media file "${reference}"` };
  }
}

/**
 * @param {{ contentRoot: string, contentDir?: string, mediaDir?: string, overrides?: Record<string,string> }} options
 */
export async function validateContent({ contentRoot, contentDir, mediaDir, overrides = taxonomyOverrides }) {
  const resolvedContentDir = path.resolve(contentDir ?? path.join(contentRoot, 'content'));
  const resolvedMediaDir = path.resolve(mediaDir ?? path.join(contentRoot, 'media'));

  const scanned = await scanContent(resolvedContentDir);
  // Report repo-style paths ("content/blog/...") instead of workspace-relative ones.
  const withPrefix = (list) => list.map((entry) => ({ ...entry, file: `content/${entry.file}` }));
  const blogs = withPrefix(scanned.blogs);
  const novels = withPrefix(scanned.novels);
  const chapters = withPrefix(scanned.chapters);
  const projects = withPrefix(scanned.projects);

  const errors = [];
  const warnings = [];
  const drafts = [];

  // --- blogs ---
  const blogSlugs = new Map();
  for (const entry of blogs) {
    checkRequired(entry.data, REQUIRED.blog, entry.file, errors);
    const slug = entry.data.slug;
    if (isPresent(slug)) {
      if (blogSlugs.has(slug)) errors.push(`${entry.file}: duplicate blog slug "${slug}" (also in ${blogSlugs.get(slug)})`);
      else blogSlugs.set(slug, entry.file);
    }
    if (entry.data.draft === true && isPresent(slug)) {
      drafts.push({ collection: 'blog', route: `/blog/${slug}/`, file: entry.file });
    }
  }

  // --- novels ---
  const novelSlugs = new Map();
  for (const entry of novels) {
    checkRequired(entry.data, REQUIRED.novel, entry.file, errors);
    const slug = entry.data.slug;
    if (isPresent(slug)) {
      if (novelSlugs.has(slug)) errors.push(`${entry.file}: duplicate novel slug "${slug}" (also in ${novelSlugs.get(slug)})`);
      else novelSlugs.set(slug, entry.file);
    }
  }

  // --- chapters ---
  const chapterKeys = new Map();
  const chapterSlugs = new Map();
  for (const entry of chapters) {
    checkRequired(entry.data, REQUIRED.chapter, entry.file, errors);
    const { novel, chapter, slug, draft } = entry.data;

    if (isPresent(chapter) && (!Number.isInteger(chapter) || chapter <= 0)) {
      errors.push(`${entry.file}: chapter must be a positive integer, got ${JSON.stringify(chapter)}`);
    }
    if (isPresent(novel) && !novelSlugs.has(novel)) {
      errors.push(`${entry.file}: unknown novel "${novel}" (no novel.yaml declares that slug)`);
    }
    if (isPresent(novel) && isPresent(chapter)) {
      const key = `${novel}#${chapter}`;
      if (chapterKeys.has(key)) errors.push(`${entry.file}: duplicate chapter number ${chapter} in "${novel}" (also in ${chapterKeys.get(key)})`);
      else chapterKeys.set(key, entry.file);
    }
    if (isPresent(novel) && isPresent(slug)) {
      const key = `${novel}#${slug}`;
      if (chapterSlugs.has(key)) errors.push(`${entry.file}: duplicate chapter slug "${slug}" in "${novel}" (also in ${chapterSlugs.get(key)})`);
      else chapterSlugs.set(key, entry.file);
    }
    if (draft === true && isPresent(novel) && isPresent(slug)) {
      drafts.push({ collection: 'chapters', route: `/novel/${novel}/${slug}/`, file: entry.file });
    }
  }

  // --- projects ---
  const projectSlugs = new Map();
  for (const entry of projects) {
    checkRequired(entry.data, REQUIRED.project, entry.file, errors);
    const slug = entry.data.slug;
    if (isPresent(slug)) {
      if (projectSlugs.has(slug)) errors.push(`${entry.file}: duplicate project slug "${slug}" (also in ${projectSlugs.get(slug)})`);
      else projectSlugs.set(slug, entry.file);
    }
  }

  // --- taxonomy slug collisions ---
  const taxonomy = new Map();
  const rememberTaxonomy = (namespace, display, file) => {
    if (!isPresent(display)) return;
    const slug = taxonomySlug(String(display), overrides);
    const key = `${namespace}:${slug}`;
    if (taxonomy.has(key) && taxonomy.get(key).display !== String(display)) {
      errors.push(
        `${file}: ${namespace} "${display}" collides with "${taxonomy.get(key).display}" on URL slug "${slug}"`,
      );
      return;
    }
    taxonomy.set(key, { display: String(display), file });
  };

  for (const entry of blogs) {
    rememberTaxonomy('section', entry.data.section, entry.file);
    rememberTaxonomy('category', entry.data.category, entry.file);
    for (const tag of entry.data.tags ?? []) rememberTaxonomy('tag', tag, entry.file);
  }
  for (const entry of novels) {
    for (const genre of entry.data.genres ?? []) rememberTaxonomy('genre', genre, entry.file);
    for (const tag of entry.data.tags ?? []) rememberTaxonomy('tag', tag, entry.file);
  }
  for (const entry of chapters) {
    for (const tag of entry.data.tags ?? []) rememberTaxonomy('tag', tag, entry.file);
  }
  for (const entry of projects) {
    for (const tag of entry.data.tags ?? []) rememberTaxonomy('tag', tag, entry.file);
  }

  // --- media references ---
  for (const entry of [...blogs, ...novels, ...chapters, ...projects]) {
    for (const reference of mediaReferences(entry)) {
      const result = await mediaExists(resolvedMediaDir, reference);
      if (!result.ok) errors.push(`${entry.file}: ${result.reason}`);
    }
  }

  drafts.sort((a, b) => a.file.localeCompare(b.file));

  return {
    errors,
    warnings,
    drafts,
    mediaDir: resolvedMediaDir,
    contentDir: resolvedContentDir,
    stats: {
      blogs: blogs.length,
      novels: novels.length,
      chapters: chapters.length,
      projects: projects.length,
      drafts: drafts.length,
      taxonomy: taxonomy.size,
    },
  };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const asJson = process.argv.includes('--json');
  try {
    const result = await validateContent({ contentRoot: repoRoot, mediaDir: path.join(repoRoot, 'public', 'media') });
    if (asJson) {
      console.log(JSON.stringify({ errors: result.errors, warnings: result.warnings, drafts: result.drafts, stats: result.stats }, null, 2));
    } else {
      const { stats } = result;
      console.log(
        `[LunaFoundry] Validated content: ${stats.blogs} blog, ${stats.novels} novel, ${stats.chapters} chapter, ${stats.projects} project, ${stats.drafts} draft`,
      );
      for (const warning of result.warnings) console.warn(`[LunaFoundry] warning: ${warning}`);
      for (const error of result.errors) console.error(`[LunaFoundry] error: ${error}`);
    }
    if (result.errors.length > 0) {
      console.error(`[LunaFoundry] Validation failed with ${result.errors.length} error(s).`);
      process.exit(1);
    }
    console.log('[LunaFoundry] Content validation passed.');
  } catch (error) {
    console.error(`[LunaFoundry] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
