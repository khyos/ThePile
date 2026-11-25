import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contract: POST /api/tierlist — artifactIds flow
 *
 * A request body carrying an `artifactIds` array (and no backlogId) is routed to
 * TierListUtil.createTierListFromArtifacts. The endpoint:
 * - requires the CREATE_BACKLOG user right (403 otherwise)
 * - validates artifactType is a valid tier-list artifact type (400 otherwise)
 * - validates title is non-empty after trim (400 otherwise)
 * - validates artifactIds is a numeric array (400 otherwise)
 * - passes (user.id, artifactType, trimmed title, artifactIds) to the util
 * - returns { id } of the created tier list
 */

vi.mock('#lib/server/model/TierListUtil', () => ({
    TierListUtil: {
        createTierListFromBacklog: vi.fn(),
        createStandaloneTierList: vi.fn(),
        createTierListFromArtifacts: vi.fn()
    },
    TIER_LIST_ARTIFACT_TYPES: ['game', 'movie', 'tvshow', 'anime', 'manga', 'comics']
}));

vi.mock('#lib/server/model/BacklogDB', () => ({
    BacklogDB: {
        canEditBacklog: vi.fn()
    }
}));

vi.mock('#lib/model/User', () => ({
    User: {
        deserialize: vi.fn().mockReturnValue({
            id: 1,
            hasRight: vi.fn().mockReturnValue(true)
        })
    },
    UserRights: {
        CREATE_BACKLOG: 'create_backlog'
    }
}));

import { POST } from './+server';
import { TierListUtil } from '#lib/server/model/TierListUtil';
import { User } from '#lib/model/User';

function makeEvent(body: Record<string, unknown>) {
    return {
        request: { json: vi.fn().mockResolvedValue(body) },
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

describe('POST /api/tierlist — artifactIds flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(User.deserialize).mockReturnValue({
            id: 1,
            hasRight: vi.fn().mockReturnValue(true)
        } as never);
        vi.mocked(TierListUtil.createTierListFromArtifacts).mockResolvedValue(77 as never);
    });

    it('routes an artifactIds array to createTierListFromArtifacts and returns its id', async () => {
        const res = await POST(
            makeEvent({ artifactType: 'game', title: 'My List', artifactIds: [1, 2, 3] })
        );
        const body = await (res as Response).json();
        expect(body.id).toBe(77);
    });

    it('calls createTierListFromArtifacts with user id, artifactType, trimmed title, and artifactIds', async () => {
        await POST(makeEvent({ artifactType: 'game', title: '  My List  ', artifactIds: [1, 2, 3] }));
        expect(TierListUtil.createTierListFromArtifacts).toHaveBeenCalledWith(
            1,
            'game',
            'My List',
            [1, 2, 3]
        );
    });

    it('does not route to the standalone or backlog paths when artifactIds is present', async () => {
        await POST(makeEvent({ artifactType: 'game', title: 'My List', artifactIds: [1] }));
        expect(TierListUtil.createStandaloneTierList).not.toHaveBeenCalled();
        expect(TierListUtil.createTierListFromBacklog).not.toHaveBeenCalled();
    });

    it('accepts an empty artifactIds array and still routes to createTierListFromArtifacts', async () => {
        await POST(makeEvent({ artifactType: 'game', title: 'My List', artifactIds: [] }));
        expect(TierListUtil.createTierListFromArtifacts).toHaveBeenCalledWith(1, 'game', 'My List', []);
    });

    it('returns 403 when the user lacks the CREATE_BACKLOG right', async () => {
        vi.mocked(User.deserialize).mockReturnValueOnce({
            id: 1,
            hasRight: vi.fn().mockReturnValue(false)
        } as never);
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'game', title: 'My List', artifactIds: [1] }))
        );
        expect(status).toBe(403);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid artifactType', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'anime_episode', title: 'My List', artifactIds: [1] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('returns 400 when artifactType is missing', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ title: 'My List', artifactIds: [1] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('returns 400 when title is empty', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'game', title: '', artifactIds: [1] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('returns 400 when title is only whitespace', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'game', title: '   ', artifactIds: [1] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('returns 400 when artifactIds contains a non-numeric value', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'game', title: 'My List', artifactIds: [1, '2', 3] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });
});
