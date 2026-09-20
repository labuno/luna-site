/**
 * URL slug rules.
 *
 * Display names and URL slugs are decoupled: taxonomy pages render the display name
 * while URLs use a deterministic slug, so renaming a category never silently breaks
 * historical links (use taxonomyOverrides for renames).
 */

/** @param {unknown} input */
export function slugify(input) {
  const text = String(input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const slug = text
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'untagged';
}

/**
 * @param {string} name display name from content
 * @param {Record<string, string>} [overrides] slug -> display name
 */
export function taxonomySlug(name, overrides = {}) {
  const renamed = Object.entries(overrides).find(([, display]) => display === name);
  if (renamed) return renamed[0];
  return slugify(name);
}
