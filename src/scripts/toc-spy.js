/**
 * TOC scroll spy: 滚动时高亮当前章节（渐进增强，无 JS 时目录仍然是普通链接）。
 */
export function setupTocSpy() {
  const toc = document.querySelector('[data-toc]');
  if (!toc) return;

  const entries = [...toc.querySelectorAll('a[href^="#"]')]
    .map((link) => {
      const id = decodeURIComponent(link.getAttribute('href').slice(1));
      const heading = document.getElementById(id);
      return heading ? { link, heading, item: link.closest('li') } : null;
    })
    .filter(Boolean);
  if (entries.length === 0) return;

  const OFFSET = 110; // 粘性头部高度 + 余量
  let active = null;
  let ticking = false;

  const setActive = (entry) => {
    if (entry === active) return;
    active = entry;
    for (const candidate of entries) {
      candidate.item?.removeAttribute('data-active');
      candidate.link.removeAttribute('aria-current');
    }
    if (!entry) return;
    entry.item?.setAttribute('data-active', '');
    entry.link.setAttribute('aria-current', 'location');

    // 目录自身可滚动时，保证活跃项可见
    if (toc.scrollHeight > toc.clientHeight) {
      const linkRect = entry.link.getBoundingClientRect();
      const tocRect = toc.getBoundingClientRect();
      if (linkRect.top < tocRect.top) toc.scrollTop -= tocRect.top - linkRect.top + 8;
      else if (linkRect.bottom > tocRect.bottom) toc.scrollTop += linkRect.bottom - tocRect.bottom + 8;
    }
  };

  const update = () => {
    ticking = false;
    let current = null;
    for (const entry of entries) {
      if (entry.heading.getBoundingClientRect().top <= OFFSET) current = entry;
      else break;
    }
    // 滚动到底部时高亮最后一节
    const scrollBottom = window.scrollY + window.innerHeight;
    if (document.documentElement.scrollHeight - scrollBottom < 4) current = entries[entries.length - 1];
    setActive(current);
  };

  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  window.addEventListener('hashchange', requestUpdate);
  window.addEventListener('load', requestUpdate);
  // 带 #anchor 打开时，浏览器的滚动可能发生在脚本执行之后：补算两次兜底
  requestUpdate();
  setTimeout(requestUpdate, 150);
  setTimeout(requestUpdate, 500);
}
