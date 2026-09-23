/**
 * 站点统计与写作轨迹（纯函数，node:test 直接测试）。
 */

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff]/g;

/** 中文字符数 + 英文/数字词数 */
export function countWords(markdown) {
  if (!markdown) return 0;
  const text = String(markdown);
  const cjk = (text.match(CJK) ?? []).length;
  const latin = (text.replace(CJK, ' ').match(/[A-Za-z0-9][A-Za-z0-9'’_-]*/g) ?? []).length;
  return cjk + latin;
}

/** 格式化字数：1234 -> 1234，12345 -> 1.2万 */
export function formatWords(value) {
  if (value >= 10000) return `${(value / 10000).toFixed(1).replace(/\.0$/, '')}万`;
  return String(value);
}

/** Date -> 'YYYY-MM-DD'（本地时区） */
export function toDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** [{ date }] -> Map<'YYYY-MM-DD', 次数> */
export function collectActivity(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const value = entry?.date;
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.valueOf())) continue;
    const key = toDayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** 活跃等级 0-4（用于热力图配色） */
export function levelFor(count) {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

/**
 * 生成热力图网格：按固定列数铺满容器（方格自适应，始终填满卡片宽度）。
 * @param {{ counts: Map<string, number>, days?: number, columns?: number, endDate?: Date }} options
 */
export function buildHeatmap({ counts, days = 30, columns = 10, endDate = new Date() }) {
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));

  const cells = [];
  let activeDays = 0;
  let total = 0;

  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDayKey(date);
    const count = counts.get(key) ?? 0;
    if (count > 0) activeDays += 1;
    total += count;
    cells.push({ key, count, inRange: true, level: levelFor(count) });
  }

  // 补足末行，保持网格方正（补位格渲染为不可见）
  while (cells.length % columns !== 0) {
    cells.push({ key: `pad-${cells.length}`, count: 0, inRange: false, level: 0 });
  }

  const rows = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));

  return { rows, columns, activeDays, total, start: toDayKey(start), end: toDayKey(end) };
}
