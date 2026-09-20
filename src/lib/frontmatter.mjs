import { parse as parseYaml } from 'yaml';

/**
 * Minimal frontmatter reader for build-time validation scripts.
 * Astro does its own parsing; this exists so that validators can run before Astro
 * and report actionable errors (missing fields, duplicate slugs, missing media).
 *
 * @param {string} text
 * @returns {{ data: Record<string, unknown>, body: string }}
 */
export function parseMarkdownFile(text) {
  const source = typeof text === 'string' ? text.replace(/^\uFEFF/, '') : '';
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);

  if (!match) {
    if (/^---\r?\n/.test(source)) {
      throw new Error('Invalid frontmatter: missing closing --- delimiter');
    }
    return { data: {}, body: source };
  }

  let data;
  try {
    data = parseYaml(match[1]) ?? {};
  } catch (error) {
    throw new Error(`Invalid frontmatter: ${error instanceof Error ? error.message : error}`);
  }

  if (typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid frontmatter: expected a YAML mapping');
  }

  return { data: /** @type {Record<string, unknown>} */ (data), body: source.slice(match[0].length) };
}
