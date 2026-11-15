import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, api, KEYS, onApiError } from '../../lib/api';
import { authMessage, safeNext } from '../../lib/auth-client';
import { localInputToIso, matchReason, nearbyLine, paywallCopy, planPrice, socialHandle } from '../../lib/format';
import { reasonFromPath } from '../../lib/paywall';
import { fitWithin } from '../../lib/photo';
import { US_STATES } from '../../lib/types';
import { STATE_NAMES, US_TILE_GRID, US_TILES } from '../../lib/us';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const json = (status: number, body: unknown) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));

describe('api client', () => {
  it('returns typed JSON and sends JSON bodies with cookies', async () => {
    const f = json(200, { ok: true, interests: 30 });
    vi.stubGlobal('fetch', f);
    await expect(api.health()).resolves.toEqual({ ok: true, interests: 30 });
    vi.stubGlobal('fetch', json(200, { url: 'https://checkout.stripe.com/x' }));
    await api.checkout({ tier: 'pro' });
    const [path, init] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(path).toBe('/api/stripe/checkout');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', body: '{"tier":"pro"}' });
  });

  it('turns 402 into ApiRequestError with requiredPlan and notifies listeners', async () => {
    vi.stubGlobal('fetch', json(402, { error: { code: 'PLAN_LIMIT', message: 'Upgrade', requiredPlan: 'starter' } }));
    const seen: ApiRequestError[] = [];
    const off = onApiError((e) => seen.push(e));
    const err = await api.completeStage('s1', {}).catch((e: unknown) => e);
    off();
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({ status: 402, code: 'PLAN_LIMIT', requiredPlan: 'starter', path: '/api/stages/s1/complete' });
    expect(seen).toHaveLength(1);
    expect(reasonFromPath(seen[0]!.path)).toBe('level');
  });

  it('maps VALIDATION details to field errors', async () => {
    vi.stubGlobal('fetch', json(400, {
      error: { code: 'VALIDATION', message: 'Some fields are invalid.', details: [
        { path: 'profile.socialUrl', message: 'Use a linkedin.com, instagram.com or x.com profile link' },
        { path: 'interests', message: 'Pick 3 different interests' },
      ] },
    }));
    const err = (await api.me().catch((e: unknown) => e)) as ApiRequestError;
    expect(err.fieldErrors()).toEqual({
      'profile.socialUrl': 'Use a linkedin.com, instagram.com or x.com profile link',
      interests: 'Pick 3 different interests',
    });
  });

  it('handles non-JSON errors and network failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad gateway</html>', { status: 502 })));
    await expect(api.me()).rejects.toMatchObject({ status: 502, code: 'INTERNAL' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(api.me()).rejects.toMatchObject({ status: 0, code: 'INTERNAL' });
  });

  it('builds query keys', () => {
    expect(KEYS.mapUsers('TX')).toBe('/api/map/users?state=TX');
    expect(KEYS.feed('mine')).toBe('/api/feed?scope=mine');
  });
});

describe('auth helpers', () => {
  it('safeNext blocks open redirects', () => {
    expect(safeNext('/roadmap?x=1')).toBe('/roadmap?x=1');
    for (const bad of [null, '', 'https://evil.com', '//evil.com', '/\\evil.com']) expect(safeNext(bad)).toBe('/home');
  });
  it('maps auth error codes', () => {
    expect(authMessage({ code: 'invalid_credentials', message: 'x' })).toBe('Wrong email or password.');
    expect(authMessage({ code: undefined, message: 'Raw' })).toBe('Raw');
  });
});

describe('photo', () => {
  it('fits the longest side', () => {
    expect(fitWithin(4032, 3024, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3024, 4032, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('US data', () => {
  it('has a name and a unique tile for every state + DC inside the grid', () => {
    expect(Object.keys(STATE_NAMES).sort()).toEqual([...US_STATES].sort());
    expect(Object.keys(US_TILES).sort()).toEqual([...US_STATES].sort());
    const cells = Object.values(US_TILES).map((t) => `${t.row}:${t.col}`);
    expect(new Set(cells).size).toBe(51);
    for (const t of Object.values(US_TILES)) {
      expect(t.row).toBeGreaterThanOrEqual(0);
      expect(t.row).toBeLessThan(US_TILE_GRID.rows);
      expect(t.col).toBeGreaterThanOrEqual(0);
      expect(t.col).toBeLessThan(US_TILE_GRID.cols);
    }
  });
});

describe('copy', () => {
  it('formats nearby lines, prices and paywall titles', () => {
    expect(nearbyLine({ interestSlug: 'running', interestName: 'Running', state: 'TX', people: 12 }))
      .toBe('12 people in Texas also want to start running');
    expect(nearbyLine({ interestSlug: 'running', interestName: 'Running', state: 'TX', people: 1 }))
      .toBe('1 person in Texas also wants to start running');
    expect(nearbyLine({ interestSlug: 'chess', interestName: 'Chess', state: 'WY', people: 0 }))
      .toBe('Be the first in Wyoming to start chess');
    expect(planPrice('pro')).toBe('$7/mo');
    expect(paywallCopy('level', 'starter', 'Spanish').title).toBe('Unlock Medium: Spanish');
    expect(paywallCopy('connects', 'starter').cta).toBe('Get Starter — $5/mo');
  });
  it('converts datetime-local to ISO', () => {
    expect(localInputToIso('2026-11-20T18:30')).toMatch(/^2026-11-2\dT\d\d:30:00\.000Z$/);
    expect(() => localInputToIso('nope')).toThrow();
  });
});

describe('matchReason', () => {
  it('lists shared interests and the city', () => {
    expect(matchReason(['Running'], true)).toBe('You both do Running · same city');
    expect(matchReason(['Running', 'Spanish'], false)).toBe('You both do Running and Spanish');
    expect(matchReason(['Running', 'Spanish', 'Guitar'], false)).toBe('You both do Running, Spanish and Guitar');
  });
  it('handles no shared interests', () => {
    expect(matchReason([], true)).toBe('Same city');
    expect(matchReason([], false)).toBe('');
  });
});

describe('avatar accessory sprites', () => {
  it('are rectangular and use only known colors', async () => {
    const { ACCESSORY_SPRITES } = await import('../../components/scene/Ninja');
    for (const [name, sprite] of Object.entries(ACCESSORY_SPRITES)) {
      const width = sprite.rows[0]!.length;
      for (const row of sprite.rows) {
        expect(row.length, `${name} row width`).toBe(width);
        expect(row, `${name} colors`).toMatch(/^[.osSghwWkp]+$/);
      }
    }
  });
});

describe('socialHandle', () => {
  it('reads the handle from Instagram, X and LinkedIn links', () => {
    expect(socialHandle('https://instagram.com/nqzmirzhan')).toBe('@nqzmirzhan');
    expect(socialHandle('https://x.com/k7_app')).toBe('@k7_app');
    expect(socialHandle('https://linkedin.com/in/sarah-k')).toBe('@sarah-k');
  });
  it('returns null without a usable handle', () => {
    expect(socialHandle(null)).toBeNull();
    expect(socialHandle('https://instagram.com/')).toBeNull();
    expect(socialHandle('not a url')).toBeNull();
  });
});

describe('badge credentials', () => {
  it('builds a stable credential id and a LinkedIn add-certification link', async () => {
    const { credentialId, linkedinAddUrl } = await import('../../lib/credential');
    const id = credentialId('user-1', 'drawing', 1);
    expect(id).toMatch(/^K7-DRA-E-[0-9A-F]{6}$/);
    expect(credentialId('user-1', 'drawing', 1)).toBe(id);
    expect(credentialId('user-2', 'drawing', 1)).not.toBe(id);
    const url = new URL(linkedinAddUrl({ name: 'Drawing — Bronze Ninja (Easy)', certId: id, certUrl: 'https://k7.app', issued: new Date('2026-11-15') }));
    expect(url.hostname).toBe('www.linkedin.com');
    expect(url.searchParams.get('organizationName')).toBe('K7');
    expect(url.searchParams.get('certId')).toBe(id);
    expect(url.searchParams.get('issueMonth')).toBe('11');
  });
});
