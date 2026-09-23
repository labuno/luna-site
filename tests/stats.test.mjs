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

test('buildHeatmap 固定列数铺满、按行返回，统计正确', () => {
  const counts = new Map([['2026-09-23', 2], ['2026-09-20', 1]]);
  const end = new Date(2026, 8, 23);
  const { rows, columns, activeDays, total, start, end: endKey } = buildHeatmap({
    counts,
    days: 30,
    columns: 10,
    endDate: end,
  });

  assert.equal(columns, 10);
  assert.equal(rows.length, 3, '30 天 / 10 列 = 3 行');
  for (const row of rows) assert.equal(row.length, 10, '每行必须正好 10 格');

  assert.equal(activeDays, 2);
  assert.equal(total, 3);
  assert.equal(endKey, '2026-09-23');
  assert.equal(start, '2026-08-25');

  const cell = rows.flat().find((c) => c.key === '2026-09-23');
  assert.equal(cell.count, 2);
  assert.equal(cell.inRange, true);
  assert.equal(cell.level, 2);

  // 末行补位：最后若干格为不可见补位
  const padded = rows.flat().filter((c) => !c.inRange);
  assert.equal(padded.length, 0, '30 天正好填满 3 行，无需补位');

  const uneven = buildHeatmap({ counts, days: 31, columns: 10, endDate: end });
  assert.equal(uneven.rows.length, 4, '31 天需要第 4 行');
  assert.equal(uneven.rows.flat().filter((c) => !c.inRange).length, 9, '末行补 9 格');
});
