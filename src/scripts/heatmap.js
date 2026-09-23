/**
 * 写作轨迹热力图：在"最近 90 天 / 全年"两个视图之间切换（渐进增强）。
 */
export function setupHeatmap() {
  const root = document.querySelector('[data-heatmap]');
  if (!root) return;

  const buttons = [...root.querySelectorAll('[data-heatmap-view]')];
  const grids = [...root.querySelectorAll('[data-heatmap-grid]')];
  const summaryEl = root.querySelector('[data-heatmap-summary]');

  const setView = (view) => {
    for (const grid of grids) grid.hidden = grid.getAttribute('data-heatmap-grid') !== view;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.getAttribute('data-heatmap-view') === view));
    }
    if (summaryEl) {
      const text = view === 'year' ? root.getAttribute('data-summary-year') : root.getAttribute('data-summary-recent');
      summaryEl.textContent = text ?? '';
    }
  };

  for (const button of buttons) {
    button.addEventListener('click', () => setView(button.getAttribute('data-heatmap-view')));
  }
}
