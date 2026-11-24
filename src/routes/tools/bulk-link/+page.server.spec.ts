/**
 * Contract: +page.server.ts load function (bulk-link page)
 *
 * - Returns 403 when user lacks EDIT_ARTIFACT right
 * - Returns { artifacts: [], type: '', linkType: '' } when params are absent
 * - Returns { artifacts: [], type: '', linkType: '' } when type is not a valid artifact type
 * - Returns { artifacts: [], type: '', linkType: '' } when linkType is not valid for the given type
 * - Returns { artifacts, type, linkType } populated from LinkDB when params are valid
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('#lib/model/User', () => ({
    User: { deserialize: vi.fn() },
    UserRights: { EDIT_ARTIFACT: 'edit_artifact' }
}));

vi.mock('#lib/server/model/LinkDB', () => ({
    LinkDB: { getArtifactsMissingLink: vi.fn() }
}));

import { load } from './+page.server';
import { User } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';

function makeEvent({ type, linkType }: { type?: string; linkType?: string } = {}) {
    const url = new URL('http://localhost/tools/bulk-link');
    if (type !== undefined) url.searchParams.set('type', type);
    if (linkType !== undefined) url.searchParams.set('linkType', linkType);
    return { url, locals: { user: {} } } as never;
}

async function errorStatusOf(promise: Promise<unknown>): Promise<number> {
    try {
        await promise;
        throw new Error('expected the loader to throw an HttpError');
    } catch (e) {
        return (e as { status: number }).status;
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    // Default: user has EDIT_ARTIFACT right
    vi.mocked(User.deserialize).mockReturnValue({ hasRight: () => true } as never);
    vi.mocked(LinkDB.getArtifactsMissingLink).mockResolvedValue([]);
});

describe('bulk-link load — authorization', () => {
    it('throws 403 when the user does not have EDIT_ARTIFACT right', async () => {
        vi.mocked(User.deserialize).mockReturnValue({ hasRight: () => false } as never);

        const status = await errorStatusOf(Promise.resolve(load(makeEvent({ type: 'game', linkType: 'IGDB' }))));

        expect(status).toBe(403);
    });
});

describe('bulk-link load — absent or invalid params', () => {
    it('returns { artifacts: [], type: \'\', linkType: \'\' } when neither param is present', async () => {
        const result = await load(makeEvent());

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });

    it('returns { artifacts: [], type: \'\', linkType: \'\' } when type is not a recognised artifact type', async () => {
        const result = await load(makeEvent({ type: 'UNKNOWN_TYPE', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });

    it('returns { artifacts: [], type: \'\', linkType: \'\' } when linkType is not valid for the given type', async () => {
        // 'game' is a valid type, but 'MAL' is not a valid link type for games
        const result = await load(makeEvent({ type: 'game', linkType: 'MAL' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });
});

describe('bulk-link load — valid params', () => {
    it('returns the artifacts from LinkDB together with the type and linkType', async () => {
        const artifacts = [
            { id: 1, title: 'Alpha' },
            { id: 2, title: 'Beta' }
        ];
        vi.mocked(LinkDB.getArtifactsMissingLink).mockResolvedValue(artifacts as never);

        const result = await load(makeEvent({ type: 'game', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts, type: 'game', linkType: 'IGDB' });
    });

    it('passes the correct artifactType and linkType to LinkDB.getArtifactsMissingLink', async () => {
        await load(makeEvent({ type: 'movie', linkType: 'TMDB' }));

        expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith('movie', 'TMDB');
    });

    it('returns empty artifacts list when LinkDB finds no unlinked artifacts', async () => {
        vi.mocked(LinkDB.getArtifactsMissingLink).mockResolvedValue([]);

        const result = await load(makeEvent({ type: 'game', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts: [], type: 'game', linkType: 'IGDB' });
    });
});
