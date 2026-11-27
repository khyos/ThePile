import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract tests for the DELETE handler of /api/game/[slug]/link?type=<LinkType>.
 *
 * Contract (from the feature spec):
 *   - Requires UserRights.EDIT_ARTIFACT; without it -> 403.
 *   - `type` missing, or not removable (protected or invalid for the artifact
 *     type) -> 400.
 *   - On success -> json({ success: true }) and LinkDB.deleteLink is called for
 *     the (gameId, type) identified by the slug + query param.
 *
 * The real Link.ts is used for isLinkTypeRemovable (the validation contract).
 * DB modules are auto-mocked so the handler's internal derived-data cleanup
 * never touches a real database; its exact shape is the standards tester's job.
 */

vi.mock('#lib/model/User', () => ({
    User: { deserialize: vi.fn().mockReturnValue({ hasRight: () => true }) },
    UserRights: { EDIT_ARTIFACT: 'EDIT_ARTIFACT' }
}));

// Auto-mock: any method accessed returns a reusable spy resolving to [].
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
import { LinkType } from '#lib/model/Link';

function makeEvent(slug: string, type: string | null) {
    const url = new URL(`http://localhost/api/game/${slug}/link`);
    if (type !== null) {
        url.searchParams.set('type', type);
    }
    return {
        params: { slug },
        url,
        locals: { user: { id: 1 } }
    } as never;
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

describe('DELETE /api/game/[slug]/link', () => {
    it('returns 403 when the user lacks EDIT_ARTIFACT', async () => {
        vi.mocked(User.deserialize).mockReturnValue({ hasRight: () => false } as never);

        expect(await statusOf(DELETE(makeEvent('42', LinkType.STEAM)))).toBe(403);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('returns 400 when the type query param is missing', async () => {
        expect(await statusOf(DELETE(makeEvent('42', null)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('returns 400 for a protected (non-removable) link type', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.IGDB)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('returns 400 for a link type not valid for games', async () => {
        expect(await statusOf(DELETE(makeEvent('42', LinkType.MAL)))).toBe(400);
        expect(LinkDB.deleteLink).not.toHaveBeenCalled();
    });

    it('deletes a valid removable link and responds with { success: true }', async () => {
        const response = await DELETE(makeEvent('42', LinkType.STEAM));

        expect(LinkDB.deleteLink).toHaveBeenCalledWith(42, LinkType.STEAM);
        expect(await (response as Response).json()).toEqual({ success: true });
    });
});
