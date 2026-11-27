import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Standards tests for the movie DELETE handler: validation of its own protected
 * type (TMDB) plus the `cleanupLinkData` derived-data dispatch, including the
 * one-to-many Rotten Tomatoes case (critics AND audience ratings deleted).
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
vi.mock('#lib/server/model/movie/MovieDB', autoMockModule('MovieDB'));

import { DELETE } from './+server';
import { User } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';
import { RatingDB } from '#lib/server/model/RatingDB';
import { LinkType } from '#lib/model/Link';
import { RatingType } from '#lib/model/Rating';

function makeEvent(slug: string, type: string | null) {
    const url = new URL(`http://localhost/api/movie/${slug}/link`);
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

describe('movie DELETE', () => {
    it('rejects the protected TMDB link with 400', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.TMDB)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('rejects a link type not valid for movies (STEAM) with 400', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.STEAM)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it.each([
        [LinkType.SENSCRITIQUE, RatingType.SENSCRITIQUE],
        [LinkType.METACRITIC, RatingType.METACRITIC],
        [LinkType.LETTERBOXD, RatingType.LETTERBOXD]
    ])('%s deletes the single matching rating', async (linkType, ratingType) => {
        await DELETE(makeEvent('42', linkType));

        expect(RatingDB.deleteRating).toHaveBeenCalledTimes(1);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, ratingType);
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, linkType);
    });

    it('ROTTEN_TOMATOES deletes BOTH critics and audience ratings', async () => {
        const response = await DELETE(makeEvent('42', LinkType.ROTTEN_TOMATOES));

        expect(RatingDB.deleteRating).toHaveBeenCalledTimes(2);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, RatingType.ROTTEN_TOMATOES_CRITICS);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, RatingType.ROTTEN_TOMATOES_AUDIENCE);
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, LinkType.ROTTEN_TOMATOES);
        expect(await (response as Response).json()).toEqual({ success: true });
    });
});
