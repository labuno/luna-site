/**
 * Reads the synced content workspace (or a private content repository checkout)
 * and returns plain data structures for validation and dist assertions.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseMarkdownFile } from '../../src/lib/frontmatter.mjs';

async function walkFiles(dir, predicate, collected = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return collected;
    throw error;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walkFiles(full, predicate, collected);
    else if (entry.isFile() && predicate(full)) collected.push(full);
  }
  return collected;
}

/** @param {string} contentDir */
export async function scanContent(contentDir) {
  const toRelative = (file) => path.relative(contentDir, file).split(path.sep).join('/');
  const sortByPath = (list) => list.sort((a, b) => a.file.localeCompare(b.file));

  const markdownFiles = await walkFiles(path.join(contentDir, 'blog'), (file) => file.endsWith('.md') || file.endsWith('.mdx'));
  const blogFiles = sortByPath(
    await Promise.all(
      markdownFiles.map(async (file) => {
        const { data, body } = parseMarkdownFile(await readFile(file, 'utf8'));
        return { file: toRelative(file), data, body };
      }),
    ),
  );

  const novelDirs = path.join(contentDir, 'novels');
  const novelFiles = await walkFiles(novelDirs, (file) => /novel\.(ya?ml)$/.test(path.basename(file)));
  const novels = sortByPath(
    await Promise.all(
      novelFiles.map(async (file) => ({ file: toRelative(file), data: parseYaml(await readFile(file, 'utf8')) ?? {} })),
    ),
  );

  const chapterFiles = await walkFiles(novelDirs, (file) => file.endsWith('.md'));
  const chapters = sortByPath(
    await Promise.all(
      chapterFiles.map(async (file) => {
        const { data, body } = parseMarkdownFile(await readFile(file, 'utf8'));
        return { file: toRelative(file), data, body };
      }),
    ),
  );

  const projectFiles = await walkFiles(path.join(contentDir, 'projects'), (file) => /\.(ya?ml)$/.test(file) && !file.endsWith('.md'));
  const projects = sortByPath(
    await Promise.all(
      projectFiles.map(async (file) => ({ file: toRelative(file), data: parseYaml(await readFile(file, 'utf8')) ?? {} })),
    ),
  );

  return { blogs: blogFiles, novels, chapters, projects };
}
