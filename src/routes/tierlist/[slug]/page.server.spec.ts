import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/server/model/TierListUtil', () => ({
    TierListUtil: { loadTierListPageInfo: vi.fn() }
}));

import { load } from './+page.server';
import { TierListUtil } from '#lib/server/model/TierListUtil';

function makeEvent(slug: string) {
    return { params: { slug }, locals: {} } as never;
}

async function statusOf(promise: Promise<unknown>): Promise<number> {
    try {
        await promise;
        throw new Error('expected handler to throw an HttpError');
    } catch (cause) {
        return (cause as { status: number }).status;
    }
}

describe('tier-list page slug validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(TierListUtil.loadTierListPageInfo).mockResolvedValue({} as never);
    });

    it.each(['', '0', '42x', '42.5', '-42', '9'.repeat(400)])('rejects malformed or non-positive slug %s', async (slug) => {
        expect(await statusOf(Promise.resolve(load(makeEvent(slug))))).toBe(400);
        expect(TierListUtil.loadTierListPageInfo).not.toHaveBeenCalled();
    });

    it('passes a fully numeric slug as the tier-list id', async () => {
        await load(makeEvent('42'));
        expect(TierListUtil.loadTierListPageInfo).toHaveBeenCalledWith(42, {});
    });
});
