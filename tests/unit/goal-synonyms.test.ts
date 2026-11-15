import { describe, expect, it } from 'vitest';
import { suggestedSlugFor } from '../../lib/goal-synonyms';

describe('suggestedSlugFor', () => {
  it('maps common wordings to suggested goals', () => {
    expect(suggestedSlugFor('Read books')).toBe('reading');
    expect(suggestedSlugFor('jogging')).toBe('running');
    expect(suggestedSlugFor('Lose weight')).toBe('gym');
    expect(suggestedSlugFor('Español')).toBe('spanish');
    expect(suggestedSlugFor('read more books every week')).toBe('reading');
    expect(suggestedSlugFor('Board games')).toBe('board-games');
  });
  it('leaves truly new goals alone', () => {
    expect(suggestedSlugFor('Kite surfing')).toBeNull();
    expect(suggestedSlugFor('Find friends')).toBeNull();
    expect(suggestedSlugFor('')).toBeNull();
  });
});
