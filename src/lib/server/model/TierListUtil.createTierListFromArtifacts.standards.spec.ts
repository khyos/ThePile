import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * STANDARDS tests for TierListUtil.createTierListFromArtifacts.
 *
 * These complement the contract (TDD) tests by exercising implementation
 * details only visible by reading TierListUtil.ts:
 *   - the per-tier `nextPosition` counter (positions 0,1,2… per tier, independent
 *     across tiers, and a separate counter for the unranked pool keyed by null)
 *   - the TWO-STAGE filter: getUserList decides membership (filteredIds), then
 *     getUserInfos only supplies SCORES. A valid member missing from getUserInfos
 *     is unranked (null), NOT skipped; an id present in getUserInfos but absent
 *     from getUserList is skipped (iteration is over filteredIds).
 *   - duplicate artifactIds survive the membership filter and are inserted once
 *     per occurrence, consuming consecutive positions.
 *   - insertion order follows the input artifactIds order (Array.filter preserves it)
 *   - getUserList is queried with (userId, artifactType); getUserInfos with the
 *     FILTERED ids, not the raw request ids.
 *
 * The DB layer is mocked, matching repo convention and the existing TDD spec.
 */

vi.mock('./ArtifactDB', () => ({
    ArtifactDB: {
        getUserList: vi.fn(),
        getUserInfos: vi.fn()
    }
}));

vi.mock('./BacklogDB', () => ({
    BacklogDB: {
        getBacklogByIdWithItems: vi.fn()
    }
}));

vi.mock('./TierListDB', () => ({
    TierListDB: {
        insertTierList: vi.fn(),
        insertTier: vi.fn(),
        insertItem: vi.fn()
    }
}));

import { TierListUtil } from './TierListUtil';
import { ArtifactType } from '#lib/model/Artifact';
import { ArtifactDB } from './ArtifactDB';
import { TierListDB } from './TierListDB';

const USER_ID = 7;
const TIER_LIST_ID = 100;
const tierIdForIndex = (index: number) => 10 + index; // S=10 … F=15

/** getUserList — membership stage. Only these ids are valid list members. */
function setList(ids: number[]) {
    vi.mocked(ArtifactDB.getUserList).mockResolvedValue({
        artifacts: ids.map((id) => ({ id }))
    } as never);
}

/** getUserInfos — score stage. Keyed independently of membership. */
function setInfos(entries: { artifactId: number; score: number | null }[]) {
    vi.mocked(ArtifactDB.getUserInfos).mockResolvedValue(entries as never);
}

/** All insertItem calls for one artifactId, in call order: { tierId, position }. */
function insertsFor(artifactId: number): { tierId: number | null; position: number }[] {
    return vi
        .mocked(TierListDB.insertItem)
        .mock.calls.filter((c) => c[1] === artifactId)
        .map((c) => ({ tierId: c[2] as number | null, position: c[3] as number }));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TierListDB.insertTierList).mockResolvedValue(TIER_LIST_ID as never);
    vi.mocked(TierListDB.insertTier).mockImplementation(
        ((_tlId: number, _label: string, _color: string, position: number) =>
            Promise.resolve(tierIdForIndex(position))) as never
    );
    vi.mocked(TierListDB.insertItem).mockResolvedValue(undefined as never);
    vi.mocked(ArtifactDB.getUserList).mockResolvedValue({ artifacts: [] } as never);
    vi.mocked(ArtifactDB.getUserInfos).mockResolvedValue([] as never);
});

describe('createTierListFromArtifacts — per-tier position counter', () => {
    it('assigns 0,1,2 to successive items landing in the SAME tier, in input order', async () => {
        // three S-tier items
        setList([1, 2, 3]);
        setInfos([
            { artifactId: 1, score: 95 },
            { artifactId: 2, score: 90 },
            { artifactId: 3, score: 100 }
        ]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1, 2, 3]);
        expect(insertsFor(1)).toEqual([{ tierId: tierIdForIndex(0), position: 0 }]);
        expect(insertsFor(2)).toEqual([{ tierId: tierIdForIndex(0), position: 1 }]);
        expect(insertsFor(3)).toEqual([{ tierId: tierIdForIndex(0), position: 2 }]);
    });

    it('keeps a SEPARATE counter per tier (each tier restarts at 0)', async () => {
        setList([1, 2, 3, 4]);
        setInfos([
            { artifactId: 1, score: 95 }, // S  pos 0
            { artifactId: 2, score: 75 }, // B  pos 0
            { artifactId: 3, score: 92 }, // S  pos 1
            { artifactId: 4, score: 72 } // B  pos 1
        ]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1, 2, 3, 4]);
        expect(insertsFor(1)).toEqual([{ tierId: tierIdForIndex(0), position: 0 }]);
        expect(insertsFor(3)).toEqual([{ tierId: tierIdForIndex(0), position: 1 }]);
        expect(insertsFor(2)).toEqual([{ tierId: tierIdForIndex(2), position: 0 }]);
        expect(insertsFor(4)).toEqual([{ tierId: tierIdForIndex(2), position: 1 }]);
    });

    it('gives the unranked pool (tierId null) its own independent counter', async () => {
        setList([1, 2, 3]);
        setInfos([
            { artifactId: 1, score: null }, // unranked pos 0
            { artifactId: 2, score: 95 }, //   S       pos 0
            { artifactId: 3, score: null } // unranked pos 1
        ]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1, 2, 3]);
        expect(insertsFor(1)).toEqual([{ tierId: null, position: 0 }]);
        expect(insertsFor(3)).toEqual([{ tierId: null, position: 1 }]);
        expect(insertsFor(2)).toEqual([{ tierId: tierIdForIndex(0), position: 0 }]);
    });
});

describe('createTierListFromArtifacts — two-stage membership vs score filter', () => {
    it('places a VALID member that has NO score entry into the unranked pool (not skipped)', async () => {
        // id 1 is in the user list but getUserInfos returns nothing for it
        setList([1]);
        setInfos([]); // no score info at all
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1]);
        // membership (getUserList) decides inclusion; missing score => null => unranked
        expect(insertsFor(1)).toEqual([{ tierId: null, position: 0 }]);
    });

    it('skips an id that getUserInfos HAS a score for but that is NOT a list member', async () => {
        // id 9 is not in the user list; even though a stray score exists it must be skipped
        setList([1]);
        setInfos([
            { artifactId: 1, score: 85 },
            { artifactId: 9, score: 100 }
        ]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1, 9]);
        expect(insertsFor(1)).toEqual([{ tierId: tierIdForIndex(1), position: 0 }]);
        expect(insertsFor(9)).toEqual([]); // never inserted
        expect(vi.mocked(TierListDB.insertItem)).toHaveBeenCalledTimes(1);
    });

    it('queries getUserList with (userId, artifactType)', async () => {
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.MOVIE, 'L', []);
        expect(vi.mocked(ArtifactDB.getUserList)).toHaveBeenCalledWith(USER_ID, ArtifactType.MOVIE);
    });

    it('queries getUserInfos with the FILTERED ids only, not the raw request ids', async () => {
        setList([1, 2]); // only 1 and 2 are members
        setInfos([{ artifactId: 1, score: 85 }]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1, 2, 99]);
        const call = vi.mocked(ArtifactDB.getUserInfos).mock.calls[0];
        expect(call[0]).toBe(USER_ID);
        expect(call[1]).toEqual([1, 2]); // 99 filtered out before the score lookup
    });
});

describe('createTierListFromArtifacts — duplicates & ordering', () => {
    it('inserts a duplicated valid id once per occurrence with consecutive positions', async () => {
        setList([1]);
        setInfos([{ artifactId: 1, score: 90 }]); // S, exactly at the 90 boundary
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1, 1, 1]);
        expect(insertsFor(1)).toEqual([
            { tierId: tierIdForIndex(0), position: 0 },
            { tierId: tierIdForIndex(0), position: 1 },
            { tierId: tierIdForIndex(0), position: 2 }
        ]);
    });

    it('preserves the input artifactIds order when assigning positions across tiers', async () => {
        setList([3, 1, 2]);
        setInfos([
            { artifactId: 1, score: 50 }, // D boundary
            { artifactId: 2, score: 60 }, // C boundary
            { artifactId: 3, score: 49 } // F boundary
        ]);
        // request order 3,1,2 — insertItem must be called in that exact order
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [3, 1, 2]);
        const order = vi.mocked(TierListDB.insertItem).mock.calls.map((c) => c[1]);
        expect(order).toEqual([3, 1, 2]);
        expect(insertsFor(3)).toEqual([{ tierId: tierIdForIndex(5), position: 0 }]); // F
        expect(insertsFor(1)).toEqual([{ tierId: tierIdForIndex(4), position: 0 }]); // D
        expect(insertsFor(2)).toEqual([{ tierId: tierIdForIndex(3), position: 0 }]); // C
    });
});

describe('createTierListFromArtifacts — operation ordering', () => {
    it('creates the tier list and all six tiers before inserting any item', async () => {
        const seq: string[] = [];
        vi.mocked(TierListDB.insertTierList).mockImplementation((() => {
            seq.push('list');
            return Promise.resolve(TIER_LIST_ID);
        }) as never);
        vi.mocked(TierListDB.insertTier).mockImplementation(((
            _t: number,
            _l: string,
            _c: string,
            position: number
        ) => {
            seq.push('tier');
            return Promise.resolve(tierIdForIndex(position));
        }) as never);
        vi.mocked(TierListDB.insertItem).mockImplementation((() => {
            seq.push('item');
            return Promise.resolve(undefined);
        }) as never);
        setList([1]);
        setInfos([{ artifactId: 1, score: 85 }]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'L', [1]);
        expect(seq).toEqual(['list', 'tier', 'tier', 'tier', 'tier', 'tier', 'tier', 'item']);
    });
});
