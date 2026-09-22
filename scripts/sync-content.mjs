#!/usr/bin/env node
/**
 * Injects the private content repository into the build workspace.
 * content/<...> -> ./content/       (Astro collections)
 * media/<...>   -> ./public/media/  (static assets)
 *
 * The target directories are build workspaces and are gitignored; they are always
 * reset first so a stale file can never leak into a build.
 */
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');

export async function mustBeDirectory(dir, label) {
  try {
    const info = await stat(dir);
    if (!info.isDirectory()) throw new Error(`${label} is not a directory: ${dir}`);
  } catch (error) {
    if (error?.code === 'ENOENT') throw new Error(`${label} not found: ${dir}`);
    throw error;
  }
}

export async function resetDirectory(dir) {
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
}

/** Counts content files, ignoring dotfiles such as .gitkeep / .DS_Store. */
export async function countFiles(dir) {
  let total = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += await countFiles(full);
    else if (entry.isFile()) total += 1;
  }
  return total;
}

/**
 * @param {{ sourceRoot: string, targetRoot?: string, log?: (message: string) => void }} options
 */
export async function syncContent({ sourceRoot, targetRoot = repoRoot, log = console.log }) {
  const sourceContent = path.join(sourceRoot, 'content');
  const sourceMedia = path.join(sourceRoot, 'media');
  const targetContent = path.join(targetRoot, 'content');
  const targetMedia = path.join(targetRoot, 'public', 'media');

  await mustBeDirectory(sourceContent, 'Content directory');
  await mustBeDirectory(sourceMedia, 'Media directory');

  await resetDirectory(targetContent);
  await resetDirectory(targetMedia);

  await cp(sourceContent, targetContent, { recursive: true, force: true });
  await cp(sourceMedia, targetMedia, { recursive: true, force: true });

  // Re-create the tracked placeholders so that a build never dirties the site repo.
  await writeFile(path.join(targetContent, '.gitkeep'), '');
  await writeFile(path.join(targetMedia, '.gitkeep'), '');

  const contentFiles = await countFiles(targetContent);
  const mediaFiles = await countFiles(targetMedia);

  log(`[LunaFoundry] Synced content from: ${sourceRoot}`);
  log(`[LunaFoundry] Content files: ${contentFiles}`);
  log(`[LunaFoundry] Media files: ${mediaFiles}`);

  return { sourceRoot, contentFiles, mediaFiles, contentDir: targetContent, mediaDir: targetMedia };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const input = process.argv[2] || process.env.CONTENT_SOURCE_DIR || '../luna-ore';
  const sourceRoot = path.resolve(repoRoot, input);
  try {
    await syncContent({ sourceRoot });
  } catch (error) {
    console.error(`[LunaFoundry] ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
