import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * STANDARDS tests for POST /api/tierlist — branch DISCRIMINATION.
 *
 * +server.ts routes a request in a fixed order:
 *   1. body.backlogId != null                → createTierListFromBacklog
 *   2. Array.isArray(body.artifactIds)       → createTierListFromArtifacts
 *   3. otherwise {artifactType,title}        → createStandaloneTierList
 *
 * These tests pin that ORDER and the guard conditions, which the contract tests
 * (each exercising one path in isolation) don't cover:
 *   - backlogId present together with artifactIds → the backlog path wins
 *   - artifactIds that is NOT an array (string / number / object / null) falls
 *     through to the standalone path (Array.isArray guard)
 *   - artifactIds present must NOT reach the standalone path, even when the
 *     standalone-shaped fields (artifactType, title) are also present
 *   - backlogId === null explicitly still skips the backlog path (!= null guard)
 *   - a failing title/artifactType inside the artifactIds branch 400s there
 *     rather than falling through to the standalone branch
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
import { BacklogDB } from '#lib/server/model/BacklogDB';
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

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.deserialize).mockReturnValue({
        id: 1,
        hasRight: vi.fn().mockReturnValue(true)
    } as never);
    vi.mocked(TierListUtil.createTierListFromArtifacts).mockResolvedValue(77 as never);
    vi.mocked(TierListUtil.createStandaloneTierList).mockResolvedValue(88 as never);
    vi.mocked(TierListUtil.createTierListFromBacklog).mockResolvedValue(99 as never);
    vi.mocked(BacklogDB.canEditBacklog).mockResolvedValue({ status: 200 } as never);
});

describe('POST /api/tierlist — branch order: backlogId wins over artifactIds', () => {
    it('routes to the backlog path (not artifactIds) when BOTH are present', async () => {
        const res = await POST(
            makeEvent({ backlogId: 5, artifactType: 'game', title: 'L', artifactIds: [1, 2] })
        );
        const body = await (res as Response).json();
        expect(body.id).toBe(99); // backlog path return value
        expect(TierListUtil.createTierListFromBacklog).toHaveBeenCalledTimes(1);
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
        expect(TierListUtil.createStandaloneTierList).not.toHaveBeenCalled();
    });

    it('treats backlogId === null as absent and uses the artifactIds path', async () => {
        const res = await POST(
            makeEvent({ backlogId: null, artifactType: 'game', title: 'L', artifactIds: [1] })
        );
        const body = await (res as Response).json();
        expect(body.id).toBe(77); // artifactIds path return value
        expect(TierListUtil.createTierListFromBacklog).not.toHaveBeenCalled();
        expect(TierListUtil.createTierListFromArtifacts).toHaveBeenCalledTimes(1);
    });
});

describe('POST /api/tierlist — Array.isArray guard on artifactIds', () => {
    const nonArrays: { label: string; value: unknown }[] = [
        { label: 'a string', value: '1,2,3' },
        { label: 'a number', value: 3 },
        { label: 'an object', value: { 0: 1 } },
        { label: 'null', value: null }
    ];

    for (const { label, value } of nonArrays) {
        it(`falls through to the standalone path when artifactIds is ${label}`, async () => {
            const res = await POST(
                makeEvent({ artifactType: 'game', title: 'L', artifactIds: value })
            );
            const body = await (res as Response).json();
            expect(body.id).toBe(88); // standalone path return value
            expect(TierListUtil.createStandaloneTierList).toHaveBeenCalledWith(1, 'game', 'L');
            expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
        });
    }

    it('400s on the standalone path (not the artifactIds path) when artifactIds is a non-array and artifactType is missing', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ title: 'L', artifactIds: 'nope' }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createStandaloneTierList).not.toHaveBeenCalled();
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('does NOT trim the title on the standalone path (only the artifactIds path trims)', async () => {
        // documents that the standalone branch passes title through verbatim
        await POST(makeEvent({ artifactType: 'game', title: '  L  ', artifactIds: 'notarray' }));
        expect(TierListUtil.createStandaloneTierList).toHaveBeenCalledWith(1, 'game', '  L  ');
    });
});

describe('POST /api/tierlist — artifactIds branch does not leak to standalone on validation failure', () => {
    it('400s inside the artifactIds branch for a bad artifactType without calling standalone', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'anime_episode', title: 'L', artifactIds: [1] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createStandaloneTierList).not.toHaveBeenCalled();
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('400s inside the artifactIds branch for a whitespace title without calling standalone', async () => {
        const status = await errorStatusOf(
            POST(makeEvent({ artifactType: 'game', title: '   ', artifactIds: [1] }))
        );
        expect(status).toBe(400);
        expect(TierListUtil.createStandaloneTierList).not.toHaveBeenCalled();
        expect(TierListUtil.createTierListFromArtifacts).not.toHaveBeenCalled();
    });

    it('rejects a NaN / non-integer numeric sneaking in? — only typeof number matters (documents guard)', async () => {
        // the guard is `typeof id === 'number'`, so NaN passes it; this documents that reality
        await POST(makeEvent({ artifactType: 'game', title: 'L', artifactIds: [1, Number.NaN] }));
        expect(TierListUtil.createTierListFromArtifacts).toHaveBeenCalledWith(1, 'game', 'L', [
            1,
            Number.NaN
        ]);
    });
});
