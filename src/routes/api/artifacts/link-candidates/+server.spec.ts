import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contract: GET /api/artifacts/link-candidates
 *
 * - Returns 403 when the user lacks EDIT_ARTIFACT right
 * - Returns { results: [] } for an unknown (artifactType, linkType) combination
 * - Returns normalized candidates on success
 *
 * Note: error handling for external service failures is the responsibility of
 * getCandidates (tested in link-candidates.spec.ts). The endpoint calls
 * getCandidates directly without a try/catch and always receives an array back.
 */

vi.mock('#lib/model/User', () => ({
    User: {
        deserialize: vi.fn().mockReturnValue({
            hasRight: vi.fn().mockReturnValue(true)
        })
    },
    UserRights: {
        EDIT_ARTIFACT: 'edit_artifact'
    }
}));

vi.mock('#lib/server/link-candidates', () => ({
    getCandidates: vi.fn()
}));

import { GET } from './+server';
import { User } from '#lib/model/User';
import { getCandidates } from '#lib/server/link-candidates';

function makeEvent(params: Record<string, string> = {}) {
    const url = new URL('http://localhost/api/artifacts/link-candidates');
    for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
    }
    return {
        url,
        locals: { user: { id: 1 } }
    } as never;
}

async function errorStatusOf(promise: Promise<unknown>): Promise<number> {
    try {
        await promise;
        throw new Error('expected handler to throw an HttpError');
    } catch (e) {
        return (e as { status: number }).status;
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.deserialize).mockReturnValue({
        hasRight: vi.fn().mockReturnValue(true)
    } as never);
});

describe('GET /api/artifacts/link-candidates — authorization', () => {
    it('returns 403 when the user lacks EDIT_ARTIFACT right', async () => {
        vi.mocked(User.deserialize).mockReturnValue({
            hasRight: vi.fn().mockReturnValue(false)
        } as never);

        const status = await errorStatusOf(GET(makeEvent({
            artifactType: 'game',
            linkType: 'IGDB',
            query: 'zelda'
        })));

        expect(status).toBe(403);
        expect(getCandidates).not.toHaveBeenCalled();
    });
});

describe('GET /api/artifacts/link-candidates — unknown combination', () => {
    it('returns { results: [] } for an unknown (artifactType, linkType) combination', async () => {
        vi.mocked(getCandidates).mockResolvedValue([]);

        const response = await GET(makeEvent({
            artifactType: 'unknown_type',
            linkType: 'UNKNOWN_LINK',
            query: 'query'
        }));

        const body = await (response as Response).json();
        expect(body).toEqual({ results: [] });
    });
});

describe('GET /api/artifacts/link-candidates — success', () => {
    it('returns normalized candidates on success', async () => {
        const candidates = [
            { id: '1', name: 'Dark Souls', date: '2011-10-04' },
            { id: '2', name: 'Dark Souls II' }
        ];
        vi.mocked(getCandidates).mockResolvedValue(candidates);

        const response = await GET(makeEvent({
            artifactType: 'game',
            linkType: 'IGDB',
            query: 'dark souls'
        }));

        const body = await (response as Response).json();
        expect(body).toEqual({ results: candidates });
    });

    it('passes artifactType, linkType, and query to getCandidates', async () => {
        vi.mocked(getCandidates).mockResolvedValue([]);

        await GET(makeEvent({
            artifactType: 'movie',
            linkType: 'TMDB',
            query: 'inception'
        }));

        expect(getCandidates).toHaveBeenCalledWith('movie', 'TMDB', 'inception');
    });

    it('returns { results: [] } when getCandidates returns an empty array', async () => {
        vi.mocked(getCandidates).mockResolvedValue([]);

        const response = await GET(makeEvent({
            artifactType: 'game',
            linkType: 'IGDB',
            query: 'nonexistent'
        }));

        const body = await (response as Response).json();
        expect(body).toEqual({ results: [] });
    });
});
