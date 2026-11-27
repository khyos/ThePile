import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Standards tests for the game DELETE handler's internal `cleanupLinkData`.
 *
 * The TDD contract spec (+server.delete.spec.ts) already covers auth/validation
 * and that LinkDB.deleteLink is called. These tests read the implementation and
 * assert the derived-data cleanup dispatch that is only visible in the code:
 *   HLTB       -> GameDB.updateDuration(id, null)
 *   SENSCRITIQUE/METACRITIC/OPENCRITIC/STEAM -> RatingDB.deleteRating(id, <type>)
 *   ITAD       -> SubscriptionServiceDB.syncArtifactSubscriptions(id, [], services)
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
vi.mock('#lib/server/model/game/GameDB', autoMockModule('GameDB'));

import { DELETE } from './+server';
import { User } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';
import { RatingDB } from '#lib/server/model/RatingDB';
import { SubscriptionServiceDB } from '#lib/server/model/SubscriptionServiceDB';
import { GameDB } from '#lib/server/model/game/GameDB';
import { LinkType } from '#lib/model/Link';
import { RatingType } from '#lib/model/Rating';

function makeEvent(slug: string, type: string | null) {
    const url = new URL(`http://localhost/api/game/${slug}/link`);
    if (type !== null) {
        url.searchParams.set('type', type);
    }
    return { params: { slug }, url, locals: { user: { id: 1 } } } as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.deserialize).mockReturnValue({ hasRight: () => true } as never);
});

describe('game DELETE cleanupLinkData dispatch', () => {
    it('HLTB clears the duration with NULL (not 0)', async () => {
        await DELETE(makeEvent('42', LinkType.HLTB));

        expect(GameDB.updateDuration).toHaveBeenCalledWith(42, null);
        expect(RatingDB.deleteRating).not.toHaveBeenCalled();
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, LinkType.HLTB);
    });

    it.each([
        [LinkType.SENSCRITIQUE, RatingType.SENSCRITIQUE],
        [LinkType.METACRITIC, RatingType.METACRITIC],
        [LinkType.OPENCRITIC, RatingType.OPENCRITIC],
        [LinkType.STEAM, RatingType.STEAM]
    ])('%s deletes the matching rating', async (linkType, ratingType) => {
        await DELETE(makeEvent('42', linkType));

        expect(RatingDB.deleteRating).toHaveBeenCalledTimes(1);
        expect(RatingDB.deleteRating).toHaveBeenCalledWith(42, ratingType);
        expect(GameDB.updateDuration).not.toHaveBeenCalled();
        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, linkType);
    });

    it('ITAD syncs an empty subscription set using all services', async () => {
        const services = [{ id: 1, name: 'Netflix' }];
        vi.mocked(SubscriptionServiceDB.getAllServices).mockResolvedValueOnce(services as never);

        await DELETE(makeEvent('42', LinkType.ITAD));

        expect(SubscriptionServiceDB.getAllServices).toHaveBeenCalledTimes(1);
        expect(SubscriptionServiceDB.syncArtifactSubscriptions).toHaveBeenCalledWith(42, [], services);
        expect(RatingDB.deleteRating).not.toHaveBeenCalled();
    });

    it('runs cleanup BEFORE deleting the link row', async () => {
        await DELETE(makeEvent('42', LinkType.STEAM));

        const cleanupOrder = vi.mocked(RatingDB.deleteRating).mock.invocationCallOrder[0];
        const deleteOrder = vi.mocked(LinkDB.deleteLink).mock.invocationCallOrder[0];
        expect(cleanupOrder).toBeLessThan(deleteOrder);
    });
});
