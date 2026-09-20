/**
 * Client-side list filtering (progressive enhancement).
 * URL stays the source of truth: /blog/?section=agent&tags=mcp,tool-use
 * Chips work as plain links without JS; with JS they toggle and filter in place.
 */
export function setupListFilter() {
  const root = document.querySelector('[data-filter-root]');
  if (!root) return;

  const items = [...root.querySelectorAll('[data-filter-item]')];
  const chips = [...root.querySelectorAll('[data-filter-chip]')];
  const status = root.querySelector('[data-filter-status]');
  const empty = root.querySelector('[data-filter-empty]');

  const readState = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      section: params.get('section') ?? '',
      tags: (params.get('tags') ?? '').split(',').filter(Boolean),
      genre: (params.get('genre') ?? '').split(',').filter(Boolean),
    };
  };

  const writeState = (state) => {
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key, value) => {
      if (!value || (Array.isArray(value) && value.length === 0)) params.delete(key);
      else params.set(key, Array.isArray(value) ? value.join(',') : value);
    };
    setOrDelete('section', state.section);
    setOrDelete('tags', state.tags);
    setOrDelete('genre', state.genre);
    const query = params.toString();
    window.history.replaceState(null, '', query ? `${window.location.pathname}?${query}` : window.location.pathname);
  };

  const apply = () => {
    const state = readState();
    let visible = 0;

    for (const item of items) {
      const sectionSlug = item.dataset.sectionSlug ?? '';
      const tagSlugs = (item.dataset.tagSlugs ?? '').split(',').filter(Boolean);
      const genreSlugs = (item.dataset.genreSlugs ?? '').split(',').filter(Boolean);

      const matchesSection = !state.section || sectionSlug === state.section;
      const matchesTags = state.tags.every((tag) => tagSlugs.includes(tag));
      const matchesGenres = state.genre.length === 0 || state.genre.some((genre) => genreSlugs.includes(genre));

      const show = matchesSection && matchesTags && matchesGenres;
      item.hidden = !show;
      if (show) visible += 1;
    }

    for (const chip of chips) {
      const kind = chip.dataset.kind;
      const slug = chip.dataset.slug ?? '';
      const active =
        (kind === 'section' && slug === state.section) ||
        (kind === 'tags' && state.tags.includes(slug)) ||
        (kind === 'genre' && state.genre.includes(slug)) ||
        (slug === '' && state.section === '' && state.tags.length === 0 && state.genre.length === 0);
      if (active) chip.dataset.active = 'true';
      else delete chip.dataset.active;
    }

    const filters = [
      state.section && `栏目`,
      state.tags.length > 0 && `${state.tags.length} 个标签`,
      state.genre.length > 0 && `${state.genre.length} 个题材`,
    ].filter(Boolean);

    if (status) {
      status.hidden = filters.length === 0;
      status.textContent = filters.length > 0 ? `已筛选：${filters.join(' · ')}，共 ${visible} 条` : '';
    }
    if (empty) empty.hidden = visible > 0;
  };

  for (const chip of chips) {
    chip.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey) return;
      const kind = chip.dataset.kind;
      const slug = chip.dataset.slug ?? '';
      if (!kind || !slug) return;
      event.preventDefault();

      const state = readState();
      if (kind === 'section') state.section = state.section === slug ? '' : slug;
      if (kind === 'tags') state.tags = state.tags.includes(slug) ? state.tags.filter((tag) => tag !== slug) : [...state.tags, slug];
      if (kind === 'genre') state.genre = state.genre.includes(slug) ? state.genre.filter((g) => g !== slug) : [...state.genre, slug];

      writeState(state);
      apply();
    });
  }

  apply();
}
