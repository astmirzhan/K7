import { describe, expect, it } from 'vitest';
import { formatWhen, timeAgo } from '../../lib/relative-time';

const now = new Date('2026-11-15T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe('timeAgo', () => {
  it('says "just now" under a minute and for future times', () => {
    expect(timeAgo(ago(30_000), now)).toBe('just now');
    expect(timeAgo(ago(-60_000), now)).toBe('just now');
  });
  it('uses minutes, hours and days', () => {
    expect(timeAgo(ago(5 * 60_000), now)).toBe('5m ago');
    expect(timeAgo(ago(2 * 3_600_000), now)).toBe('2h ago');
    expect(timeAgo(ago(3 * 86_400_000), now)).toBe('3d ago');
  });
  it('falls back to a short date after a week', () => {
    expect(timeAgo(ago(10 * 86_400_000), now)).toMatch(/^Nov \d{1,2}$/);
  });
  it('returns an empty string for garbage', () => {
    expect(timeAgo('not a date', now)).toBe('');
  });
});

describe('formatWhen', () => {
  it('formats weekday, date and time', () => {
    expect(formatWhen('2026-11-22T16:00:00Z')).toMatch(/^[A-Z][a-z]{2}, Nov 2[12], \d{1,2}:00\s?[AP]M$/);
  });
  it('returns an empty string for garbage', () => {
    expect(formatWhen('')).toBe('');
  });
});
