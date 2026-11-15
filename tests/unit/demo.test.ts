import { describe, expect, it } from 'vitest';
import { isDemoAccount, shouldAutoAccept } from '../../lib/server/demo';

describe('demo accounts and auto-accept', () => {
  it('recognises seeded people only', () => {
    expect(isDemoAccount('k7.seed.07@example.com')).toBe(true);
    expect(isDemoAccount('K7.Sarah@example.com')).toBe(true);
    expect(isDemoAccount('judge1@example.com')).toBe(false);
    expect(isDemoAccount('someone@gmail.com')).toBe(false);
    expect(isDemoAccount(null)).toBe(false);
  });
  it('auto-accepts demo people by default, everyone on "all", nobody on "off"', () => {
    expect(shouldAutoAccept('k7.seed.07@example.com', undefined)).toBe(true);
    expect(shouldAutoAccept('judge2@example.com', undefined)).toBe(false);
    expect(shouldAutoAccept('judge2@example.com', 'all')).toBe(true);
    expect(shouldAutoAccept('k7.seed.07@example.com', 'off')).toBe(false);
  });
});
