import { describe, it, expect } from 'vitest';
import { viewFromHash } from './viewFromHash';

describe('viewFromHash', () => {
  it('maps "#archives" to the archives view', () => {
    expect(viewFromHash('#archives')).toBe('archives');
  });

  it('maps empty hash to the current view', () => {
    expect(viewFromHash('')).toBe('current');
  });

  it('maps unknown hash to the current view', () => {
    expect(viewFromHash('#something-else')).toBe('current');
  });
});
