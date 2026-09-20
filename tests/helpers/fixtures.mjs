import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function makeWorkspace() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lf-content-'));
  return {
    root,
    async file(relative, contents) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, contents, 'utf8');
    },
    async touch(relative) {
      const target = path.join(root, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, '', 'utf8');
    },
  };
}

function yamlLine(key, value) {
  if (Array.isArray(value)) {
    return `${key}:\n${value.map((item) => `  - ${JSON.stringify(item)}`).join('\n')}`;
  }
  return `${key}: ${JSON.stringify(value)}`;
}

export function markdown(data, body = '正文') {
  const lines = Object.entries(data).map(([key, value]) => yamlLine(key, value));
  return `---\n${lines.join('\n')}\n---\n\n${body}\n`;
}

export function blogFrontmatter(overrides = {}) {
  return {
    title: '示例文章',
    slug: 'sample-post',
    description: '摘要',
    date: '2026-09-20',
    section: 'AI',
    category: 'Agent',
    tags: ['MCP'],
    ...overrides,
  };
}

export function chapterFrontmatter(overrides = {}) {
  return {
    title: '第一章',
    novel: 'star-sea',
    slug: '001',
    volume: '第一卷',
    chapter: 1,
    published: '2026-09-20',
    ...overrides,
  };
}

export function novelYaml(overrides = {}) {
  const data = {
    title: '星海',
    slug: 'star-sea',
    author: 'LunaFoundry',
    status: 'serializing',
    description: '简介',
    genres: ['科幻'],
    created: '2026-09-01',
    updated: '2026-09-20',
    ...overrides,
  };
  return `${Object.entries(data).map(([key, value]) => yamlLine(key, value)).join('\n')}\n`;
}
