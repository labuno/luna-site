/**
 * 标签颜色：由 slug 生成稳定的色相（0-359）。
 *
 * - 使用 FNV-1a 32 位哈希，同一标签在任何页面、任何主题下颜色一致；
 * - 从 360° 色轮中排除 60-170（黄绿-绿），避免与品牌紫色不搭的"泥色"，
 *   保留 青→蓝→紫→粉→红→橙 的可用区间。
 */
export function tagHue(slug) {
  let hash = 0x811c9dc5;
  for (const ch of String(slug)) {
    hash ^= ch.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const usable = 250; // 360° - 排除的 110°
  const u = (hash >>> 8) % usable;
  return u < 190 ? u + 170 : u - 190;
}
