/**
 * Base-path helpers, shared by Astro components (via src/utils/paths.ts) and scripts.
 * Hosting-agnostic: only the configured base changes between GitHub Pages and a custom domain.
 */

/** @param {string | undefined | null} base */
export function normalizeBase(base) {
  const value = typeof base === 'string' && base.trim() !== '' ? base.trim() : '/';
  const withLeading = value.startsWith('/') ? value : `/${value}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

/** @param {string} url */
export function isExternalUrl(url) {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url);
}

/**
 * Join a root-absolute or relative path with the site base path.
 * External URLs, protocol-relative URLs and fragments are returned untouched.
 * @param {string} pathname
 * @param {string} [base]
 */
export function withBase(pathname, base = '/') {
  const raw = typeof pathname === 'string' ? pathname : '';
  if (raw === '') return normalizeBase(base);
  if (isExternalUrl(raw)) return raw;

  const normalizedBase = normalizeBase(base);
  const withoutLeadingSlash = raw.replace(/^\/+/, '');
  if (normalizedBase !== '/' && raw.startsWith(normalizedBase)) {
    return `/${withoutLeadingSlash}`;
  }
  return `${normalizedBase}${withoutLeadingSlash}`;
}

/** Alias used for media assets; kept separate so intent reads clearly at call sites. */
export const assetUrl = withBase;
