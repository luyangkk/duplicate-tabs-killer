/** Switchable views shown at the top of the dashboard. */
export type DashboardView = 'current' | 'archives' | 'settings';

/**
 * Maps location.hash to the dashboard's initial view.
 * Only '#archives' is recognized; anything else (empty or unknown hash)
 * falls back to 'current'. The settings view has no external entry point,
 * so it is not part of the hash mapping.
 */
export function viewFromHash(hash: string): DashboardView {
  return hash === '#archives' ? 'archives' : 'current';
}
