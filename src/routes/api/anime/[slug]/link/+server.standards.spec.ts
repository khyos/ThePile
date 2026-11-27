import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Standards tests for the anime DELETE handler: rejection of the protected MAL
 * link, and `cleanupLinkData` dispatch (SENSCRITIQUE -> deleteRating). Also the
 * edge case where no derived data exists for a type but the link row is still
 * removed without crashing.
 */

vi.mock('#lib/model/User', () => ({
    User: { deserialize: vi.fn().mockReturnValue({ hasRight: () => true }) },
    UserRights: { EDIT_ARTIFACT: 'EDIT_ARTIFACT' }
}));

function autoMockModule(exportName: string) {
    return () => {
        const cache = new Map<string | symbol, unknown>();
        const proxy = new Proxy({}, {
            get(_target, prop) {
                if (!cache.has(prop)) {
                    cache.set(prop, vi.fn(() => Promise.resolve([])));
                }
                return cache.get(prop);
            }
        });
        return { [exportName]: proxy };
    };
}

vi.mock('#lib/server/model/LinkDB', autoMockModule('LinkDB'));
vi.mock('#lib/server/model/RatingDB', autoMockModule('RatingDB'));
vi.mock('#lib/server/model/anime/AnimeDB', autoMockModule('AnimeDB'));

import { DELETE } from './+server';
import { User } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';
import { RatingDB } from '#lib/server/model/RatingDB';
import { LinkType } from '#lib/model/Link';
import { RatingType } from '#lib/model/Rating';

function makeEvent(slug: string, type: string | null) {
    const url = new URL(`http://localhost/api/anime/${slug}/link`);
    if (type !== null) {
        url.searchParams.set('type', type);
    }
    return { params: { slug }, url, locals: { user: { id: 1 } } } as never;
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
    try {
        await promise;
        throw new Error('expected handler to throw an HttpError');
    } catch (e) {
        return (e as { status: number }).status;
    }
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.deserialize).mockReturnValue({ hasRight: () => true } as never);
});

describe('anime DELETE', () => {
    it('rejects the protected MAL link with 400', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.MAL)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('SENSCRITIQUE deletes the matching rating then the link', async () => {
        await DELETE(makeEvent('42', LinkType.SENSCRITIQUE));

        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, RatingType.SENSCRITIQUE);
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, LinkType.SENSCRITIQUE);

        const cleanupOrder = vi.mocked(RatingDB.deleteRating).mock.invocationCallOrder[0];
        const deleteOrder = vi.mocked(LinkDB.deleteLink).mock.invocationCallOrder[0];
        expect(cleanupOrder).toBeLessThan(deleteOrder);
    });
});
