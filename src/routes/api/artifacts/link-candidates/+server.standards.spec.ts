import { describe, it, expect, vi, beforeEach } from 'vitest';

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

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.deserialize).mockReturnValue({
        hasRight: vi.fn().mockReturnValue(true)
    } as never);
    vi.mocked(getCandidates).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// Query param handling — missing and empty params
// ---------------------------------------------------------------------------

describe('GET /api/artifacts/link-candidates — missing params default to empty strings', () => {
    it('calls getCandidates("", "", "") when no query params are provided', async () => {
        await GET(makeEvent());
        expect(getCandidates).toHaveBeenCalledWith('', '', '');
    });

    it('calls getCandidates with empty linkType when only artifactType is provided', async () => {
        await GET(makeEvent({ artifactType: 'game' }));
        expect(getCandidates).toHaveBeenCalledWith('game', '', '');
    });

    it('calls getCandidates with empty query when artifactType and linkType are provided but query is absent', async () => {
        await GET(makeEvent({ artifactType: 'game', linkType: 'IGDB' }));
        expect(getCandidates).toHaveBeenCalledWith('game', 'IGDB', '');
    });

    it('calls getCandidates with empty artifactType when only query is provided', async () => {
        await GET(makeEvent({ query: 'zelda' }));
        expect(getCandidates).toHaveBeenCalledWith('', '', 'zelda');
    });
});

describe('GET /api/artifacts/link-candidates — empty string params', () => {
    it('passes empty strings through when params are explicitly set to empty string', async () => {
        await GET(makeEvent({ artifactType: '', linkType: '', query: '' }));
        expect(getCandidates).toHaveBeenCalledWith('', '', '');
    });

    it('returns { results: [] } when called with empty params (getCandidates returns [])', async () => {
        vi.mocked(getCandidates).mockResolvedValue([]);
        const response = await GET(makeEvent({ artifactType: '', linkType: '', query: '' }));
        const body = await (response as Response).json();
        expect(body).toEqual({ results: [] });
    });
});

describe('GET /api/artifacts/link-candidates — response always wraps in results key', () => {
    it('wraps a single candidate in { results: [...] }', async () => {
        vi.mocked(getCandidates).mockResolvedValue([{ id: '1', name: 'Test' }]);
        const response = await GET(makeEvent({ artifactType: 'game', linkType: 'IGDB', query: 'test' }));
        const body = await (response as Response).json();
        expect(body).toHaveProperty('results');
        expect(body.results).toHaveLength(1);
        expect(body.results[0]).toEqual({ id: '1', name: 'Test' });
    });

    it('does not expose extra keys beyond results in the response body', async () => {
        vi.mocked(getCandidates).mockResolvedValue([]);
        const response = await GET(makeEvent({ artifactType: 'game', linkType: 'IGDB', query: 'test' }));
        const body = await (response as Response).json();
        expect(Object.keys(body)).toEqual(['results']);
    });
});

describe('GET /api/artifacts/link-candidates — authorization is checked before getCandidates', () => {
    it('never calls getCandidates when the user is unauthorized', async () => {
        vi.mocked(User.deserialize).mockReturnValue({
            hasRight: vi.fn().mockReturnValue(false)
        } as never);

        try {
            await GET(makeEvent({ artifactType: 'game', linkType: 'IGDB', query: 'zelda' }));
        } catch {
            // error() throws in SvelteKit
        }

        expect(getCandidates).not.toHaveBeenCalled();
    });
});
