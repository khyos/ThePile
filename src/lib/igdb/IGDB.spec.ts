import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), { status, headers });
}

describe('IGDB poster lookup', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('reuses one authentication request for concurrent callers', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            response(200, { access_token: 'test-token', expires_in: 3600 })
        );
        vi.stubGlobal('fetch', fetchMock);
        const { IGDB } = await import('./IGDB');

        const tokens = await Promise.all([
            IGDB.authenticateIGDB(),
            IGDB.authenticateIGDB(),
            IGDB.authenticateIGDB()
        ]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(tokens).toEqual([
            { access_token: 'test-token' },
            { access_token: 'test-token' },
            { access_token: 'test-token' }
        ]);
    });

    it('retries a rate-limited cover request and returns its image URL', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response(200, { access_token: 'test-token', expires_in: 3600 }))
            .mockResolvedValueOnce(response(429, { message: 'Rate limit exceeded' }, { 'retry-after': '0' }))
            .mockResolvedValueOnce(response(200, [{ url: 'https://images.igdb.com/igdb/image/upload/abc.jpg' }]));
        vi.stubGlobal('fetch', fetchMock);
        const { IGDB } = await import('./IGDB');

        await expect(IGDB.getImageURL('1372')).resolves.toBe(
            'https://images.igdb.com/igdb/image/upload/t_cover_big/abc.jpg'
        );
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('spaces concurrent cover lookups to stay below the IGDB request limit', async () => {
        const requestTimes: number[] = [];
        const fetchMock = vi.fn().mockImplementation(async (url: string) => {
            if (url.includes('oauth2/token')) {
                return response(200, { access_token: 'test-token', expires_in: 3600 });
            }
            requestTimes.push(Date.now());
            return response(200, [{ url: 'https://images.igdb.com/igdb/image/upload/abc.jpg' }]);
        });
        vi.stubGlobal('fetch', fetchMock);
        const { IGDB } = await import('./IGDB');

        await Promise.all([
            IGDB.getImageURL('1372'),
            IGDB.getImageURL('34745'),
            IGDB.getImageURL('34733')
        ]);

        expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('oauth2/token'))).toHaveLength(1);
        expect(requestTimes).toHaveLength(3);
        expect(requestTimes[1] - requestTimes[0]).toBeGreaterThanOrEqual(250);
        expect(requestTimes[2] - requestTimes[1]).toBeGreaterThanOrEqual(250);
    });

    it('does not interpret a failed API response as a game with no cover', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce(response(200, { access_token: 'test-token', expires_in: 3600 }))
            .mockResolvedValueOnce(response(403, { message: 'Forbidden' }));
        vi.stubGlobal('fetch', fetchMock);
        const { IGDB } = await import('./IGDB');

        await expect(IGDB.getImageURL('1372')).rejects.toThrow('IGDB cover lookup failed: 403');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
