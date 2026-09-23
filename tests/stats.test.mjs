import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHeatmap, collectActivity, countWords, formatWords, levelFor, toDayKey } from '../src/lib/stats.mjs';

test('countWords 统计中文字符与英文单词', () => {
  assert.equal(countWords('你好世界'), 4);
  assert.equal(countWords('hello world'), 2);
  assert.equal(countWords('Hello，世界！It works.'), 5); // 世界(2) + Hello/It/works(3)
  assert.equal(countWords(''), 0);
  assert.equal(countWords(undefined), 0);
});

test('formatWords 万级格式化', () => {
  assert.equal(formatWords(0), '0');
  assert.equal(formatWords(9999), '9999');
  assert.equal(formatWords(12345), '1.2万');
  assert.equal(formatWords(20000), '2万');
});

test('collectActivity 按天聚合，忽略无效日期', () => {
  const counts = collectActivity([
    { date: new Date(2026, 8, 23) },
    { date: new Date(2026, 8, 23) },
    { date: '2026-09-20' },
    { date: null },
    { date: 'not-a-date' },
  ]);
  assert.equal(counts.get('2026-09-23'), 2);
  assert.equal(counts.get('2026-09-20'), 1);
  assert.equal(counts.size, 2);
});

test('levelFor 分级', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 6].map(levelFor), [0, 1, 2, 2, 3, 4]);
});

test('buildHeatmap 网格按周分列（周一开头）且统计正确', () => {
  const counts = new Map([['2026-09-23', 2], ['2026-09-20', 1]]);
  const end = new Date(2026, 8, 23); // 2026-09-23 周三
  const { weeks, activeDays, total } = buildHeatmap({ counts, days: 91, endDate: end });
  for (const [i, week] of weeks.entries()) {
    if (i < weeks.length - 1 || week.length === 7) assert.equal(week.length, 7, `week ${i} 应有 7 天`);
  }
  // 首列第一天必须是周一
  const first = weeks[0][0];
  assert.equal(new Date(first.key).getDay(), 1);
  assert.equal(activeDays, 2);
  assert.equal(total, 3);
  const cell = weeks.flat().find((c) => c.key === '2026-09-23');
  assert.equal(cell.count, 2);
  assert.equal(cell.inRange, true);
  assert.equal(cell.level, 2);
  // 范围外的补位单元格
  const out = weeks.flat().filter((c) => !c.inRange);
  assert.ok(out.length < 7, '范围外最多补一周内的位置');
});
