import { describe, expect, it } from 'vitest';
import { normalizeGoalName } from '../../lib/server/goal-name';
import { avatarSchema, customInterestSchema } from '../../lib/server/validation';

describe('normalizeGoalName', () => {
  it('trims, collapses spaces and capitalizes', () => {
    expect(normalizeGoalName('  rock   climbing ')).toEqual({ name: 'Rock climbing', slug: 'rock-climbing' });
  });
  it('gives the same slug to the same goal typed differently', () => {
    expect(normalizeGoalName('Bouldering')!.slug).toBe(normalizeGoalName(' bouldering ')!.slug);
    expect(normalizeGoalName('Running')!.slug).toBe('running'); // lands on the curated goal
  });
  it('handles accents and symbols', () => {
    expect(normalizeGoalName('Café latte art')!.slug).toBe('cafe-latte-art');
    expect(normalizeGoalName('Rock & roll')!.slug).toBe('rock-and-roll');
    expect(normalizeGoalName('C++')!.slug).toBe('c-plus-plus');
  });
  it('rejects too short, too long or empty slugs', () => {
    expect(normalizeGoalName('a')).toBeNull();
    expect(normalizeGoalName('x'.repeat(31))).toBeNull();
    expect(normalizeGoalName('日本')).toBeNull(); // no latin slug can be made
  });
});

describe('customInterestSchema', () => {
  it('accepts normal names and rejects junk', () => {
    expect(customInterestSchema.safeParse({ name: 'Bouldering' }).success).toBe(true);
    expect(customInterestSchema.safeParse({ name: '<script>' }).success).toBe(false);
    expect(customInterestSchema.safeParse({ name: ' ' }).success).toBe(false);
  });
});

describe('avatar name', () => {
  it('is optional and limited to 20 characters', () => {
    expect(avatarSchema.safeParse({ kind: 'preset', preset: 'ninja-1' }).success).toBe(true);
    expect(avatarSchema.safeParse({ kind: 'preset', preset: 'ninja-1', name: 'Shadow' }).success).toBe(true);
    expect(avatarSchema.safeParse({ kind: 'custom', suit: '#d84b6a', band: '#ffc803', accessory: 'katana', name: 'x'.repeat(21) }).success).toBe(false);
  });
});
