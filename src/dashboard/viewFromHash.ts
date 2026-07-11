/** Dashboard 顶部可切换的视图标识。 */
export type DashboardView = 'current' | 'archives' | 'settings';

/**
 * 将 location.hash 映射为 dashboard 的初始视图。
 * 仅识别 '#archives'，其余（空 hash 或未知 hash）一律回落到 'current'。
 * settings 视图无外部入口，不纳入 hash 映射。
 */
export function viewFromHash(hash: string): DashboardView {
  return hash === '#archives' ? 'archives' : 'current';
}
