#!/usr/bin/env node
/**
 * Post-build assertions for dist/ (document 11.1):
 *  - internal links resolve inside dist and respect BASE_PATH
 *  - anchors exist on the target page
 *  - draft routes never leak into the build
 *  - Pagefind index, sitemap, RSS and robots.txt exist
 */
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateContent } from './validate-content.mjs';

const ATTRIBUTE = /\b(?:href|src)\s*=\s*"([^"]+)"/gi;

async function walkFiles(dir, predicate, collected = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return collected;
    throw error;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, predicate, collected);
    else if (entry.isFile() && predicate(full)) collected.push(full);
  }
  return collected;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {{ distDir: string, base?: string, drafts?: Array<{ collection: string, route: string, file: string }>, requirePagefind?: boolean }} options
 */
export async function checkDist({ distDir, base = '/luna-site/', drafts = [], requirePagefind = true }) {
  const errors = [];
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  const htmlFiles = await walkFiles(distDir, (file) => file.endsWith('.html'));

  const idCache = new Map();
  async function targetHasId(file, id) {
    if (!file.endsWith('.html') || !id) return true;
    if (!idCache.has(file)) idCache.set(file, await readFile(file, 'utf8'));
    return new RegExp(`\\bid\\s*=\\s*"${escapeRegExp(id)}"`).test(idCache.get(file));
  }

  let linksChecked = 0;

  for (const file of htmlFiles) {
    const html = await readFile(file, 'utf8');
    const relativeFile = path.relative(distDir, file).split(path.sep).join('/');

    for (const match of html.matchAll(ATTRIBUTE)) {
      const value = match[1];
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) continue;

      const hashIndex = value.indexOf('#');
      const fragment = hashIndex >= 0 ? decode(value.slice(hashIndex + 1)) : '';
      let target = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
      const queryIndex = target.indexOf('?');
      if (queryIndex >= 0) target = target.slice(0, queryIndex);

      linksChecked += 1;

      // Same-page anchor
      if (target === '') {
        if (fragment && !(await targetHasId(file, fragment))) {
          errors.push(`${relativeFile}: missing anchor "#${fragment}"`);
        }
        continue;
      }

      let candidate;
      if (target.startsWith('/')) {
        if (normalizedBase !== '/' && !target.startsWith(normalizedBase)) {
          errors.push(`${relativeFile}: internal link "${value}" escapes base path "${normalizedBase}"`);
          continue;
        }
        const relativeTarget = decode(target.slice(normalizedBase === '/' ? 1 : normalizedBase.length));
        candidate = path.join(distDir, relativeTarget);
      } else {
        candidate = path.resolve(path.dirname(file), decode(target));
      }

      const candidates = target.endsWith('/') || path.extname(candidate) === ''
        ? [path.join(candidate, 'index.html')]
        : [candidate, path.join(candidate, 'index.html')];

      let resolved = null;
      for (const option of candidates) {
        if (await exists(option)) {
          resolved = option;
          break;
        }
      }

      if (!resolved) {
        errors.push(`${relativeFile}: broken internal link "${value}"`);
        continue;
      }
      if (fragment && !(await targetHasId(resolved, fragment))) {
        errors.push(`${relativeFile}: link "${value}" points to a missing anchor "#${fragment}"`);
      }
    }
  }

  // Draft leakage
  for (const draft of drafts) {
    const target = path.join(distDir, draft.route.replace(/^\//, ''), 'index.html');
    if (await exists(target)) {
      errors.push(`${draft.file}: draft route leaked into dist ("${draft.route}")`);
    }
  }

  // Drafts must not appear in the RSS feed
  const rssPath = path.join(distDir, 'rss.xml');
  if (drafts.length > 0 && (await exists(rssPath))) {
    const rss = await readFile(rssPath, 'utf8');
    for (const draft of drafts) {
      if (rss.includes(draft.route)) {
        errors.push(`${draft.file}: draft route "${draft.route}" leaked into rss.xml`);
      }
    }
  }

  // Required artifacts
  if (requirePagefind && !(await exists(path.join(distDir, 'pagefind', 'pagefind.js')))) {
    errors.push('dist/pagefind/pagefind.js is missing: run `pagefind --site dist` after the Astro build.');
  }
  for (const artifact of ['sitemap-index.xml', 'rss.xml', 'robots.txt']) {
    if (!(await exists(path.join(distDir, artifact)))) {
      errors.push(`dist/${artifact} is missing.`);
    }
  }

  return { errors, stats: { htmlFiles: htmlFiles.length, linksChecked } };
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  try {
    const validation = await validateContent({
      contentRoot: repoRoot,
      mediaDir: path.join(repoRoot, 'public', 'media'),
    });
    const result = await checkDist({
      distDir: path.join(repoRoot, 'dist'),
      base: process.env.BASE_PATH || '/luna-site/',
      drafts: validation.drafts,
    });

    for (const error of result.errors) console.error(`[LunaFoundry] error: ${error}`);
    console.log(
      `[LunaFoundry] Checked ${result.stats.htmlFiles} HTML file(s), ${result.stats.linksChecked} internal link(s); ${validation.drafts.length} draft route(s) asserted absent.`,
    );
    if (result.errors.length > 0) {
      console.error(`[LunaFoundry] dist check failed with ${result.errors.length} error(s).`);
      process.exit(1);
    }
    console.log('[LunaFoundry] dist check passed.');
  } catch (error) {
    console.error(`[LunaFoundry] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
