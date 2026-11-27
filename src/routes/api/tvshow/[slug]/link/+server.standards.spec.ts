import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Standards tests for the tvshow DELETE handler: rejection of the protected TMDB
 * link plus `cleanupLinkData` dispatch (SENSCRITIQUE/METACRITIC single rating,
 * ROTTEN_TOMATOES -> both RT ratings).
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
vi.mock('#lib/server/model/SubscriptionServiceDB', autoMockModule('SubscriptionServiceDB'));
vi.mock('#lib/server/model/tvshow/TvshowDB', autoMockModule('TvshowDB'));
vi.mock('#lib/server/model/ArtifactDB', autoMockModule('ArtifactDB'));

import { DELETE } from './+server';
import { User } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';
import { RatingDB } from '#lib/server/model/RatingDB';
import { LinkType } from '#lib/model/Link';
import { RatingType } from '#lib/model/Rating';

function makeEvent(slug: string, type: string | null) {
    const url = new URL(`http://localhost/api/tvshow/${slug}/link`);
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

describe('tvshow DELETE', () => {
    it('rejects the protected TMDB link with 400', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.TMDB)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('rejects LETTERBOXD (not valid for tvshows) with 400', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.LETTERBOXD)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it.each([
        [LinkType.SENSCRITIQUE, RatingType.SENSCRITIQUE],
        [LinkType.METACRITIC, RatingType.METACRITIC]
    ])('%s deletes the single matching rating', async (linkType, ratingType) => {
        await DELETE(makeEvent('42', linkType));

        expect(RatingDB.deleteRating).toHaveBeenCalledTimes(1);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, ratingType);
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, linkType);
    });

    it('ROTTEN_TOMATOES deletes BOTH critics and audience ratings', async () => {
        await DELETE(makeEvent('42', LinkType.ROTTEN_TOMATOES));

        expect(RatingDB.deleteRating).toHaveBeenCalledTimes(2);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, RatingType.ROTTEN_TOMATOES_CRITICS);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, RatingType.ROTTEN_TOMATOES_AUDIENCE);
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, LinkType.ROTTEN_TOMATOES);
    });
});
