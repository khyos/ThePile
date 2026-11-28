import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Standards tests for the tier-list move endpoint (POST /api/tierlist/[slug]/move).
 *
 * These exercise the branches that are only visible by reading +server.ts, with
 * TierListDB + User mocked so no database is touched:
 *   - complete slug/body validation
 *   - the `targetTierId ?? null` coalescing for the Unranked pool
 *   - the authorization gate short-circuits (non-200 => no moveItem call)
 *   - a throwing moveItem is mapped to a 500 error
 *   - the happy path returns { success: true }
 */

vi.mock('#lib/server/model/TierListDB', () => ({
    TierListDB: {
        canEditTierList: vi.fn(),
        moveItem: vi.fn()
    }
}));

vi.mock('#lib/model/User', () => ({
    User: { deserialize: vi.fn().mockReturnValue({ id: 1 }) }
}));

import { POST } from './+server';
import { TierListDB } from '#lib/server/model/TierListDB';

const OK = { status: 200, message: 'OK' };

function makeEvent(slug: string, body: unknown) {
    return {
        params: { slug },
        request: { json: vi.fn().mockResolvedValue(body) },
        locals: { user: { id: 1 } }
    } as never;
}

function makeMalformedJsonEvent() {
    return {
        params: { slug: '42' },
        request: { json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')) },
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

describe('move endpoint - targetTierId coalescing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue(OK as never);
        vi.mocked(TierListDB.moveItem).mockResolvedValue('moved');
    });

    it('coalesces an undefined targetTierId to null (Unranked pool)', async () => {
        await POST(makeEvent('42', { artifactId: 7, targetPosition: 2 }));
        expect(TierListDB.moveItem).toHaveBeenCalledWith(42, 7, null, 2);
    });

    it('forwards an explicit null targetTierId as null', async () => {
        await POST(makeEvent('42', { artifactId: 7, targetTierId: null, targetPosition: 0 }));
        expect(TierListDB.moveItem).toHaveBeenCalledWith(42, 7, null, 0);
    });

    it('forwards a real tier id to moveItem without pre-validating the destination', async () => {
        await POST(makeEvent('99', { artifactId: 7, targetTierId: 5, targetPosition: 3 }));
        expect(TierListDB.moveItem).toHaveBeenCalledWith(99, 7, 5, 3);
    });

    it('returns { success: true } on the happy path', async () => {
        const res = await POST(makeEvent('42', { artifactId: 7, targetTierId: 1, targetPosition: 0 }));
        expect(await (res as Response).json()).toEqual({ success: true });
    });
});

describe('move endpoint - gates and error handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue(OK as never);
        vi.mocked(TierListDB.moveItem).mockResolvedValue('moved');
    });

    it('short-circuits with the authorization status and never calls moveItem', async () => {
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue({ status: 403, message: 'Not authorized' } as never);
        expect(await statusOf(POST(makeEvent('42', { artifactId: 7, targetPosition: 0 })))).toBe(403);
        expect(TierListDB.moveItem).not.toHaveBeenCalled();
    });

    it('propagates a 404 authorization status', async () => {
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue({ status: 404, message: 'Not found' } as never);
        expect(await statusOf(POST(makeEvent('42', { artifactId: 7, targetPosition: 0 })))).toBe(404);
    });

    it.each(['', '0', '42.5', '42x', '9'.repeat(400)])('rejects malformed or non-positive slug %s', async (slug) => {
        expect(await statusOf(POST(makeEvent(slug, { artifactId: 7, targetPosition: 0 })))).toBe(400);
        expect(TierListDB.canEditTierList).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed JSON', async () => {
        expect(await statusOf(POST(makeMalformedJsonEvent()))).toBe(400);
        expect(TierListDB.moveItem).not.toHaveBeenCalled();
    });

    it.each([
        null,
        [],
        42,
        {},
        { artifactId: '7', targetPosition: 0 },
        { artifactId: 7, targetPosition: -1 },
        { artifactId: 7, targetPosition: 0.5 },
        { artifactId: 7, targetTierId: '5', targetPosition: 0 },
        { artifactId: 7, targetTierId: 0, targetPosition: 0 },
        { artifactId: 7, targetPosition: 0, extra: true }
    ])('returns 400 for invalid move body %#', async (body) => {
        expect(await statusOf(POST(makeEvent('42', body)))).toBe(400);
        expect(TierListDB.moveItem).not.toHaveBeenCalled();
    });

    it('maps a throwing moveItem to a 500 error', async () => {
        vi.mocked(TierListDB.moveItem).mockRejectedValue(new Error('boom'));
        expect(await statusOf(POST(makeEvent('42', { artifactId: 7, targetPosition: 0 })))).toBe(500);
    });

    it.each([
        ['not-found', 404],
        ['invalid-position', 400]
    ])('maps a %s move result to %i instead of claiming success', async (moveResult, expectedStatus) => {
        vi.mocked(TierListDB.moveItem).mockResolvedValue(moveResult as never);

        expect(await statusOf(POST(makeEvent('42', { artifactId: 7, targetPosition: 0 })))).toBe(expectedStatus);
        expect(TierListDB.moveItem).toHaveBeenCalledWith(42, 7, null, 0);
    });
});
