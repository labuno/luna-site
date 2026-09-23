/**
 * 写作轨迹热力图：在"最近 30 天 / 最近 90 天 / 全年"之间切换（渐进增强）。
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
    const active = grids.find((grid) => grid.getAttribute('data-heatmap-grid') === view);
    if (summaryEl) summaryEl.textContent = active?.getAttribute('data-summary') ?? '';
  };

  for (const button of buttons) {
    button.addEventListener('click', () => setView(button.getAttribute('data-heatmap-view')));
  }
}
