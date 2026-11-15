import { describe, expect, it } from 'vitest';
import { US_STATES } from '../../lib/types';
import { cityCoords, US_CITIES } from '../../lib/us-cities';

describe('US city coordinates', () => {
  it('cover every state and DC with at least one city inside the US', () => {
    for (const st of US_STATES) {
      const cities = Object.entries(US_CITIES[st] ?? {});
      expect(cities.length, st).toBeGreaterThan(0);
      for (const [name, [lon, lat]] of cities) {
        expect(lon, `${st} ${name} lon`).toBeGreaterThan(-180);
        expect(lon, `${st} ${name} lon`).toBeLessThan(-65);
        expect(lat, `${st} ${name} lat`).toBeGreaterThan(18);
        expect(lat, `${st} ${name} lat`).toBeLessThan(72);
      }
    }
  });
  it('matches a typed city ignoring case and extra spaces, within its state only', () => {
    expect(cityCoords('TX', '  austin ')).toEqual([-97.74, 30.27]);
    expect(cityCoords('OR', 'Portland')).not.toEqual(cityCoords('ME', 'Portland'));
    expect(cityCoords('TX', 'Gotham')).toBeNull();
  });
});
