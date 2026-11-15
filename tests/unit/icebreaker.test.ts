import { describe, expect, it } from 'vitest';
import { buildIcebreakerPrompt, parseIcebreakers, templateIcebreakers } from '../../lib/server/icebreaker';

const ctx = { me: { name: 'Sarah', city: 'Austin' }, other: { name: 'Liam', city: 'Austin', bio: 'New in town' }, interests: ['Running', 'Spanish'] };

describe('icebreakers', () => {
  it('builds a prompt with names, shared goals and city', () => {
    const p = buildIcebreakerPrompt(ctx);
    expect(p).toContain('Sarah');
    expect(p).toContain('Liam');
    expect(p).toContain('Running, Spanish');
    expect(p).toContain('both in Austin');
    expect(p).toContain('New in town');
  });
  it('parses three lines and ignores extras', () => {
    expect(parseIcebreakers('{"lines":["Hey there one","Hey there two","Hey there three","four four"]}')).toHaveLength(3);
  });
  it('rejects bad output', () => {
    expect(parseIcebreakers('sorry, I cannot')).toBeNull();
    expect(parseIcebreakers('{"lines":["only one line"]}')).toBeNull();
  });
  it('has a template fallback that names the goal and city', () => {
    const lines = templateIcebreakers(ctx);
    expect(lines).toHaveLength(3);
    expect(lines.join(' ')).toContain('running');
    expect(lines.join(' ')).toContain('Austin');
  });
});
