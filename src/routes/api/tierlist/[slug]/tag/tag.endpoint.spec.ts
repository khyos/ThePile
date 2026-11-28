import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Contract: POST/PATCH /api/tierlist/[slug]/tag
 *
 * - A tag is created within one tier list: valid name (1-32 chars) and hex color.
 * - Duplicate names, including case-insensitive matches, return 409.
 * - Malformed JSON and invalid bodies return 400.
 * - Tag assignment is keyed by tier-list item artifactId plus tagId.
 * - Assigning or removing a tag updates the tier-list item, not an artifact.
 */

vi.mock('#lib/server/model/TierListDB', () => ({
    TierListDB: {
        canEditTierList: vi.fn(),
        getTags: vi.fn(),
        createTag: vi.fn(),
        updateItemTag: vi.fn()
    }
}));

vi.mock('#lib/model/User', () => ({
    User: { deserialize: vi.fn().mockReturnValue({ id: 1 }) }
}));

import { POST, PATCH } from './+server';
import { TierListDB } from '#lib/server/model/TierListDB';
import type { RequestEvent } from './$types';

const OK = { status: 200, message: 'OK' };

function makeEvent(body: unknown): RequestEvent {
    return {
        params: { slug: '42' },
        request: {
            json: vi.fn().mockResolvedValue(body)
        },
        locals: { user: { id: 1 } }
    } as unknown as RequestEvent;
}

function makeMalformedJsonEvent(): RequestEvent {
    return {
        params: { slug: '42' },
        request: {
            json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
        },
        locals: { user: { id: 1 } }
    } as unknown as RequestEvent;
}

async function errorStatusOf(promise: Promise<unknown>): Promise<number> {
    try {
        await promise;
        throw new Error('expected handler to throw an HttpError');
    } catch (error) {
        return (error as { status: number }).status;
    }
}

describe('POST /api/tierlist/[slug]/tag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue(OK as never);
        vi.mocked(TierListDB.getTags).mockResolvedValue([] as never);
    });

    it('creates a reusable tag scoped to the tier list', async () => {
        vi.mocked(TierListDB.createTag).mockResolvedValue({
            toJSON: () => ({ __type: 'TierListTag', id: 7, name: 'Favorites', color: '#5b7cfa' })
        } as never);

        const response = await POST(makeEvent({ name: 'Favorites', color: '#5b7cfa' }));
        const body = await (response as Response).json();

        expect(TierListDB.createTag).toHaveBeenCalledWith(42, 'Favorites', '#5b7cfa');
        expect(body).toEqual({ __type: 'TierListTag', id: 7, name: 'Favorites', color: '#5b7cfa' });
    });

    it('trims tag names before creation', async () => {
        vi.mocked(TierListDB.createTag).mockResolvedValue({
            toJSON: () => ({ __type: 'TierListTag', id: 8, name: 'Replay', color: '#00aa55' })
        } as never);

        await POST(makeEvent({ name: '  Replay  ', color: '#00aa55' }));

        expect(TierListDB.createTag).toHaveBeenCalledWith(42, 'Replay', '#00aa55');
    });

    it('returns 400 for malformed JSON', async () => {
        expect(await errorStatusOf(POST(makeMalformedJsonEvent()))).toBe(400);
        expect(TierListDB.createTag).not.toHaveBeenCalled();
    });

    it('returns 400 for an empty name', async () => {
        expect(await errorStatusOf(POST(makeEvent({ name: '   ', color: '#5b7cfa' })))).toBe(400);
        expect(TierListDB.createTag).not.toHaveBeenCalled();
    });

    it('returns 400 for a name longer than 32 characters', async () => {
        expect(await errorStatusOf(POST(makeEvent({ name: 'x'.repeat(33), color: '#5b7cfa' })))).toBe(400);
        expect(TierListDB.createTag).not.toHaveBeenCalled();
    });

    it.each([null, 42, '#fff', 'not-a-color', '#1234567', '#gggggg'])(
        'returns 400 for invalid color %s',
        async (color) => {
            expect(await errorStatusOf(POST(makeEvent({ name: 'Valid', color })))).toBe(400);
            expect(TierListDB.createTag).not.toHaveBeenCalled();
        }
    );

    it('returns 409 for a duplicate name already in the tier list', async () => {
        vi.mocked(TierListDB.getTags).mockResolvedValue([
            { id: 3, name: 'Favorites', color: '#5b7cfa' }
        ] as never);

        expect(await errorStatusOf(POST(makeEvent({ name: 'favorites', color: '#ff0000' })))).toBe(409);
        expect(TierListDB.createTag).not.toHaveBeenCalled();
    });

    it('returns 403 instead of creating a tag for a non-owner', async () => {
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue({ status: 403, message: 'Not authorized' } as never);
        expect(await errorStatusOf(POST(makeEvent({ name: 'Favorites', color: '#5b7cfa' })))).toBe(403);
        expect(TierListDB.getTags).not.toHaveBeenCalled();
        expect(TierListDB.createTag).not.toHaveBeenCalled();
    });

    it('returns 404 for a missing tier list before reading or creating tags', async () => {
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue({ status: 404, message: 'Not found' } as never);
        expect(await errorStatusOf(POST(makeEvent({ name: 'Favorites', color: '#5b7cfa' })))).toBe(404);
        expect(TierListDB.getTags).not.toHaveBeenCalled();
        expect(TierListDB.createTag).not.toHaveBeenCalled();
    });

    it.each(['', '42.5', '42x', 'NaN', '-42', '0', '9007199254740992', '9'.repeat(400)])(
        'rejects malformed tier-list slug %s',
        async (slug) => {
            const event = { ...makeEvent({ name: 'Favorites', color: '#5b7cfa' }), params: { slug } };
            expect(await errorStatusOf(POST(event))).toBe(400);
            expect(TierListDB.canEditTierList).not.toHaveBeenCalled();
        }
    );

    it('returns 409 when the database enforces the duplicate constraint', async () => {
        vi.mocked(TierListDB.createTag).mockRejectedValue({
            code: 'SQLITE_CONSTRAINT_UNIQUE',
            message: 'UNIQUE constraint failed: tier_list_tag.tierListId, tier_list_tag.name'
        });

        expect(await errorStatusOf(POST(makeEvent({ name: 'Favorites', color: '#5b7cfa' })))).toBe(409);
    });
});

describe('PATCH /api/tierlist/[slug]/tag', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue(OK as never);
    });

    it('assigns a reusable tag to a tier-list item', async () => {
        vi.mocked(TierListDB.updateItemTag).mockResolvedValue(true as never);

        const response = await PATCH(makeEvent({ artifactId: 100, tagId: 7, assigned: true }));
        const body = await (response as Response).json();

        expect(TierListDB.updateItemTag).toHaveBeenCalledWith(42, 100, 7, true);
        expect(body).toEqual({ success: true });
    });

    it('removes a tag assignment from a tier-list item', async () => {
        vi.mocked(TierListDB.updateItemTag).mockResolvedValue(true as never);

        await PATCH(makeEvent({ artifactId: 100, tagId: 7, assigned: false }));

        expect(TierListDB.updateItemTag).toHaveBeenCalledWith(42, 100, 7, false);
    });

    it.each(['', '42.5', '42x', 'NaN', '-42', '0', '9007199254740992', '9'.repeat(400)])(
        'rejects malformed tier-list slug %s',
        async (slug) => {
            const event = { ...makeEvent({ artifactId: 100, tagId: 7, assigned: true }), params: { slug } };
            expect(await errorStatusOf(PATCH(event))).toBe(400);
            expect(TierListDB.canEditTierList).not.toHaveBeenCalled();
            expect(TierListDB.updateItemTag).not.toHaveBeenCalled();
        }
    );

    it('returns 400 for malformed JSON', async () => {
        expect(await errorStatusOf(PATCH(makeMalformedJsonEvent()))).toBe(400);
        expect(TierListDB.updateItemTag).not.toHaveBeenCalled();
    });

    it.each([
        {},
        { artifactId: '100', tagId: 7, assigned: true },
        { artifactId: 100, tagId: '7', assigned: true },
        { artifactId: 100, tagId: 7, assigned: 'true' },
        { artifactId: 0, tagId: 7, assigned: true },
        { artifactId: -100, tagId: 7, assigned: true },
        { artifactId: 9007199254740992, tagId: 7, assigned: true },
        { artifactId: 100, tagId: 0, assigned: true },
        { artifactId: 100, tagId: -7, assigned: true },
        { artifactId: 100, tagId: 9007199254740992, assigned: true },
        { artifactId: 100.5, tagId: 7, assigned: true },
        { artifactId: 100, tagId: 7.5, assigned: false }
    ])('returns 400 for invalid assignment body %#', async (body) => {
        expect(await errorStatusOf(PATCH(makeEvent(body)))).toBe(400);
        expect(TierListDB.updateItemTag).not.toHaveBeenCalled();
    });

    it('returns 404 when the tier-list item or tag does not exist', async () => {
        vi.mocked(TierListDB.updateItemTag).mockResolvedValue(false as never);

        expect(await errorStatusOf(PATCH(makeEvent({ artifactId: 100, tagId: 999, assigned: true })))).toBe(404);
    });

    it.each([
        { status: 403, message: 'Not authorized' },
        { status: 404, message: 'Not found' }
    ])('returns $status instead of updating when authorization fails', async (authorization) => {
        vi.mocked(TierListDB.canEditTierList).mockResolvedValue(authorization as never);
        expect(await errorStatusOf(PATCH(makeEvent({ artifactId: 100, tagId: 7, assigned: true })))).toBe(authorization.status);
        expect(TierListDB.updateItemTag).not.toHaveBeenCalled();
    });

    it.each([null, [], 42, 'body'])(
        'returns 400 for non-object assignment body %j',
        async (body) => {
            expect(await errorStatusOf(PATCH(makeEvent(body)))).toBe(400);
            expect(TierListDB.updateItemTag).not.toHaveBeenCalled();
        }
    );
});
