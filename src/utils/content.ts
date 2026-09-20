import { slugify, taxonomySlug } from '../lib/slug.mjs';
import { taxonomyOverrides } from '../lib/taxonomy-overrides.mjs';

export const novelStatusLabel = {
  serializing: '连载中',
  completed: '已完结',
  paused: '暂停更新',
} as const;

export const projectStatusLabel = {
  idea: '构思中',
  building: '开发中',
  active: '维护中',
  archived: '已归档',
} as const;

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(date);
}

export { slugify, taxonomySlug, taxonomyOverrides };

export interface TaxonomyEntry {
  slug: string;
  name: string;
  count: number;
}

/** Aggregates a list of display names into slug/name/count entries, sorted by count desc. */
export function collectTaxonomy(values: string[]): TaxonomyEntry[] {
  const bySlug = new Map<string, TaxonomyEntry>();
  for (const value of values) {
    const slug = taxonomySlug(value, taxonomyOverrides);
    const entry = bySlug.get(slug);
    if (entry) entry.count += 1;
    else bySlug.set(slug, { slug, name: value, count: 1 });
  }
  return [...bySlug.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
}
