# luna-site

[![CI](https://github.com/labuno/luna-site/actions/workflows/ci.yml/badge.svg)](https://github.com/labuno/luna-site/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

**A file-first static site engine for blogs, novels and projects — public code, private content,
reproducible publishing.**

luna-site is the engine behind [LunaFoundry](https://github.com/labuno). It renders a fast,
search-enabled static website from a **separate private content repository**: writing stays plain
Markdown / YAML / media files managed in Git, while this repository only holds the site code.
Every deployment is pinned to an exact content commit, so any published revision can be
reproduced or rolled back.

[中文文档](./README.zh-CN.md)

![Home page](docs/assets/demo-home.webp)

| Article with table of contents | Novel chapter reader |
| --- | --- |
| ![Article](docs/assets/demo-article.webp) | ![Reader](docs/assets/demo-reader.webp) |

*Screenshots use the fictional demo content bundled in [`examples/`](./examples) (`npm run dev:demo`).*

## Features

- **Blog, novels and projects** — post lists with taxonomy filters, novels with volumes and
  chapters, project cards.
- **Search without a backend** — a [Pagefind](https://pagefind.app) index is built at build
  time; `⌘/Ctrl + K` opens the search page.
- **Reading experience** — dark / light theme, CJK-first typography (sans headings, serif prose),
  adjustable text size on chapter pages, chapter table of contents.
- **Draft safety** — `draft: true` content never reaches pages, RSS, the sitemap or the search
  index, and CI asserts this after every build.
- **SEO and syndication** — canonical URLs, Open Graph, JSON-LD (`BlogPosting` / `Book`), RSS,
  sitemap and robots.txt.
- **Reproducible publishing** — deploys are pinned to a content commit SHA and can be re-run for
  any revision.
- **Host-agnostic output** — `dist/` is plain static files: GitHub Pages by default, any static
  host or Nginx works unchanged.

## How it works

```text
luna-ore (private)                        luna-site (this repo, public)
content/blog/**  novels/**  projects/**         Astro pages, components, schemas
media/**                                        scripts/, tests/, workflows
        │                                                    ▲
        │ push main                                          │ workflow_dispatch(content_ref=<SHA>)
        ▼                                                    │
  notify-site.yml ───────────────────────────────────────────┘
                              (trigger only)
                                       │
                                       ▼
                     deploy-pages.yml: checkout site + content@<SHA>
                                       │
              content:sync → validate → astro check → build
                                       │
                        pagefind --site dist → dist/pagefind/
                                       │
                   check:dist (links / drafts / index) → GitHub Pages
```

The content repository never shares Git history with this one, and only the site repository's
workflows (running with two fine-grained PATs) can read it.

## Quick start

Requires Node ≥ 22.12 (CI uses Node 24).

```bash
npm install
npm run dev:demo        # run the site with the bundled demo content — no secrets needed
```

Working on the engine itself needs nothing else. To preview real content, keep the content
checkout as a sibling directory named `luna-ore` (or point `CONTENT_SOURCE_DIR` at it):

```bash
npm run content:sync -- ../luna-ore
npm run dev
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server using the existing `content/` workspace |
| `npm run dev:demo` | Sync `examples/` and start the dev server |
| `npm run content:sync -- <dir>` | Sync a content repository into the workspace (clears stale files first) |
| `npm run content:demo` | Overwrite the workspace with `examples/` |
| `npm run validate:content` | Validate schemas, slugs, chapter numbering, media, drafts |
| `npm run check` | `astro check` type and schema checking |
| `npm run build` | `astro build` + Pagefind indexing |
| `npm run check:dist` | Assert built output: links, anchors, drafts, RSS/sitemap/index |
| `npm run test` | `node:test` unit and workflow-constraint tests |
| `npm run build:demo` | Full pipeline: validate + build + dist assertions on demo content |

> When the sibling `luna-ore` checkout is missing (public CI, or a contributor who only cloned
> this repository), tests that exercise the content repository are skipped automatically.

## Content model

Content lives in the content repository and is synced into the gitignored `content/` and
`public/media/` build workspaces:

- `content/blog/<year>/*.md` — blog posts
- `content/novels/<slug>/novel.yaml` + `content/novels/<slug>/<volume-dir>/*.md` — novels and chapters
- `content/projects/*.yaml` — project entries
- `media/**` — images, referenced from Markdown as `/media/...`

Full field reference and validation rules: [docs/CONTENT-SCHEMA.md](./docs/CONTENT-SCHEMA.md) (中文).

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_URL` | `https://labuno.github.io` | Canonical origin (canonical tags, RSS, sitemap) |
| `BASE_PATH` | `/luna-site/` | Deployed sub-path; use `/` for a custom domain |
| `CONTENT_SOURCE_DIR` | `../luna-ore` | Source directory for `content:sync` |

Site identity (name, title, description, author, language) lives in
[`src/site.config.ts`](./src/site.config.ts).

## Deployment

Pushing to `main` deploys through [`deploy-pages.yml`](./.github/workflows/deploy-pages.yml):
it checks out the private content repository at `content_ref` (defaults to `main`; the content
push workflow passes the exact commit SHA), syncs and validates the content, type-checks and
builds with Astro, indexes with Pagefind, asserts the output, and publishes to GitHub Pages.

Repository, variable and secret setup plus rollback commands are documented in
[docs/GITHUB-CLI.md](./docs/GITHUB-CLI.md) (中文).

Any static host works — building is the only requirement:

```bash
npm ci
npm run content:sync -- /srv/luna-ore
npm run validate:content && npm run build && npm run check:dist
rsync -az --delete dist/ deploy@host:/srv/www/site/
```

## Project structure

```text
luna-site/
├── .github/workflows/     # ci.yml (demo content) + deploy-pages.yml (private content)
├── docs/                  # design baseline, ops guide, content schema, screenshots
├── examples/              # fictional demo content (distributed with this repo)
├── content/               # gitignored build workspace (injected by content:sync)
├── public/media/          # gitignored build workspace for media
├── scripts/               # content pipeline + repository bootstrap tooling
├── src/
│   ├── components/ layouts/ pages/ scripts/ styles/ utils/
│   ├── lib/               # pure logic, unit-tested with node:test
│   ├── content.config.ts  # content schemas (blog / novels / chapters / projects)
│   └── site.config.ts
└── tests/                 # node:test suites and workflow constraints
```

## Contributing

Issues and pull requests are welcome. Before opening a PR:

```bash
npm run test
npm run build:demo     # validation + build + dist assertions
```

`ci.yml` uses only `examples/` and references no secrets, so forks are fully testable.
Please don't commit real content: `content/` and `public/media/` are build workspaces and are
gitignored.

## License

- Site engine code: [MIT](./LICENSE)
- Bundled demo content in `examples/`: fictional, distributed under the same MIT license
- Real published content lives in a separate private repository and is **not** covered by this
  license — see [NOTICE.md](./NOTICE.md)

## Documentation

| Document | Contents |
| --- | --- |
| [docs/CONTENT-SCHEMA.md](./docs/CONTENT-SCHEMA.md) | Content fields and validation rules (中文) |
| [docs/GITHUB-CLI.md](./docs/GITHUB-CLI.md) | Repo/variables/secrets setup, publish and rollback (中文) |
| [docs/DESIGN-V1.md](./docs/DESIGN-V1.md) | Design baseline V1.0 (中文) |
| [docs/MULTI-ACCOUNT.md](./docs/MULTI-ACCOUNT.md) | Maintainer setup for multiple GitHub accounts (中文) |

## Notes

- Astro 7 no longer bundles a unified pipeline for Markdown; remark plugins need
  `@astrojs/markdown-remark` as an explicit dependency (already included).
- Pages actions are intentionally pinned (`configure-pages` v5, `upload-pages-artifact` v4,
  `deploy-pages` v4); bump them only after validating in CI.
- Pagefind does not support stemming for `zh-cn`; Chinese search matches by token, which is
  expected behavior.
