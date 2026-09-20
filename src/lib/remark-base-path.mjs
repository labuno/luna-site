/**
 * Rewrites root-absolute links inside Markdown (links, images, definitions and raw HTML)
 * so that content files stay hosting-agnostic: authors write `/media/...` and `/blog/...`,
 * the build injects the configured base path.
 */
import { normalizeBase } from './paths.mjs';

/**
 * @param {string} url
 * @param {string} base
 */
export function rewriteUrl(url, base) {
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return url;
  const normalizedBase = normalizeBase(base);
  if (normalizedBase === '/') return url;
  if (url.startsWith(normalizedBase)) return url;
  return `${normalizedBase.replace(/\/$/, '')}${url}`;
}

const URL_ATTRIBUTE = /(\s(?:src|href|poster)\s*=\s*)(["'])(\/[^"']*)\2/gi;

/**
 * @param {string} value
 * @param {string} base
 */
export function rewriteHtmlAttributes(value, base) {
  return value.replace(URL_ATTRIBUTE, (_match, prefix, quote, url) => `${prefix}${quote}${rewriteUrl(url, base)}${quote}`);
}

function visit(node, base) {
  if (!node || typeof node !== 'object') return;

  if ((node.type === 'link' || node.type === 'image' || node.type === 'definition') && typeof node.url === 'string') {
    node.url = rewriteUrl(node.url, base);
  } else if (node.type === 'html' && typeof node.value === 'string') {
    node.value = rewriteHtmlAttributes(node.value, base);
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) visit(child, base);
  }
}

/** @param {{ base?: string }} [options] */
export default function remarkBasePath(options = {}) {
  const base = normalizeBase(options.base ?? '/');
  return (tree) => {
    if (base === '/') return;
    visit(tree, base);
  };
}
