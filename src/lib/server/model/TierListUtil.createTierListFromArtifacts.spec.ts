import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Contract tests for TierListUtil — the score→tier mapping and
 * TierListUtil.createTierListFromArtifacts(userId, artifactType, title, artifactIds).
 *
 * These tests are written from the PUBLIC CONTRACT only. The DB layer the
 * function persists through (TierListDB / ArtifactDB / BacklogDB) is mocked,
 * matching the repo convention (see src/lib/util/DBUtil.spec.ts). We assert the
 * observable OUTCOMES required by the contract, not the internal call order:
 *
 *   - a STANDALONE tier list (not linked to a backlog) is created
 *   - the six default tiers S, A, B, C, D, F are created in order
 *   - each artifact is placed in the tier matching the user's server-side score
 *   - no-score artifacts land in the unranked pool (tierId null)
 *   - artifactIds not in the user's list (absent from the server-side score
 *     lookup) are SKIPPED, not dumped into the unranked pool
 *   - an empty artifactIds array yields a valid tier list with six tiers / no items
 *   - the function returns the new tier list's numeric id
 */

vi.mock('./ArtifactDB', () => ({
    ArtifactDB: {
        // membership + type + existence filter: returns the user's list items of the type
        getUserList: vi.fn(),
        // server-side score lookup keyed by userId
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

import { TierListUtil, DEFAULT_TIERS } from './TierListUtil';
import { ArtifactType } from '#lib/model/Artifact';
import { ArtifactDB } from './ArtifactDB';
import { TierListDB } from './TierListDB';

const USER_ID = 7;
const TIER_LIST_ID = 100;
// tierId returned for tier at position i is 10 + i → S=10, A=11, B=12, C=13, D=14, F=15
const tierIdForIndex = (index: number) => 10 + index;

/** Find the tierId an artifact was inserted with; undefined means it was never inserted. */
function insertedTierId(artifactId: number): number | null | undefined {
    const call = vi.mocked(TierListDB.insertItem).mock.calls.find((c) => c[1] === artifactId);
    return call ? (call[2] as number | null) : undefined;
}

/**
 * Marks the given artifacts as valid members of the user's list (getUserList) AND
 * assigns their server-side scores (getUserInfos). Any artifactId NOT listed here is
 * treated as non-existent / wrong-type / not-in-list, i.e. it must be skipped.
 */
function setUser(entries: { artifactId: number; score: number | null }[]) {
    vi.mocked(ArtifactDB.getUserList).mockResolvedValue({
        artifacts: entries.map((e) => ({ id: e.artifactId }))
    } as never);
    vi.mocked(ArtifactDB.getUserInfos).mockResolvedValue(entries as never);
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

/**
 * Contract: TierListUtil.tierIndexForScore — the score→tier-index mapping.
 * S=0, A=1, B=2, C=3, D=4, F=5, no score → null. Boundaries are inclusive-low.
 */
describe('TierListUtil.tierIndexForScore — score to tier-index mapping', () => {
    const cases: { score: number | null; index: number | null; tier: string }[] = [
        { score: 100, index: 0, tier: 'S' },
        { score: 90, index: 0, tier: 'S' },
        { score: 89, index: 1, tier: 'A' },
        { score: 80, index: 1, tier: 'A' },
        { score: 79, index: 2, tier: 'B' },
        { score: 70, index: 2, tier: 'B' },
        { score: 69, index: 3, tier: 'C' },
        { score: 60, index: 3, tier: 'C' },
        { score: 59, index: 4, tier: 'D' },
        { score: 50, index: 4, tier: 'D' },
        { score: 49, index: 5, tier: 'F' },
        { score: 0, index: 5, tier: 'F' },
        { score: null, index: null, tier: 'unranked' }
    ];

    for (const { score, index, tier } of cases) {
        it(`maps score ${score} → ${tier} (index ${index})`, () => {
            expect(TierListUtil.tierIndexForScore(score)).toBe(index);
        });
    }
});

/**
 * Contract: DEFAULT_TIERS — the six default tiers S, A, B, C, D, F in order.
 */
describe('DEFAULT_TIERS — six default tiers in order', () => {
    it('contains exactly six tiers', () => {
        expect(DEFAULT_TIERS).toHaveLength(6);
    });

    it('is labelled S, A, B, C, D, F in that order', () => {
        expect(DEFAULT_TIERS.map((t) => t.label)).toEqual(['S', 'A', 'B', 'C', 'D', 'F']);
    });
});

describe('TierListUtil.createTierListFromArtifacts — standalone creation', () => {
    it('creates a tier list NOT linked to any backlog (backlogId null)', async () => {
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', []);
        const call = vi.mocked(TierListDB.insertTierList).mock.calls[0];
        expect(call[0]).toBe(USER_ID); // owned by userId
        expect(call[1]).toBeNull(); // not linked to a backlog
        expect(call[2]).toBe(ArtifactType.GAME); // given artifactType
        expect(call[3]).toBe('My List'); // given title
    });

    it('marks the created tier list as standalone', async () => {
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', []);
        const call = vi.mocked(TierListDB.insertTierList).mock.calls[0];
        // insertTierList(userId, backlogId, artifactType, title, isStandalone)
        expect(call[4]).toBe(true);
    });

    it('returns the new tier list id as a number', async () => {
        const result = await TierListUtil.createTierListFromArtifacts(
            USER_ID,
            ArtifactType.GAME,
            'My List',
            []
        );
        expect(result).toBe(TIER_LIST_ID);
        expect(typeof result).toBe('number');
    });

    it('creates the six default tiers S, A, B, C, D, F in order', async () => {
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', []);
        const calls = vi.mocked(TierListDB.insertTier).mock.calls;
        expect(calls).toHaveLength(6);
        expect(calls.map((c) => c[1])).toEqual(['S', 'A', 'B', 'C', 'D', 'F']); // labels in order
        expect(calls.map((c) => c[3])).toEqual([0, 1, 2, 3, 4, 5]); // positions 0..5
        // colors come from DEFAULT_TIERS
        expect(calls.map((c) => c[2])).toEqual(DEFAULT_TIERS.map((t) => t.color));
    });
});

/**
 * Contract: each artifact is placed into the tier matching the AUTHENTICATED
 * user's server-side score for that artifact.
 */
describe('TierListUtil.createTierListFromArtifacts — score-based placement', () => {
    const placementCases: { score: number; index: number; tier: string }[] = [
        { score: 100, index: 0, tier: 'S' },
        { score: 90, index: 0, tier: 'S' },
        { score: 89, index: 1, tier: 'A' },
        { score: 80, index: 1, tier: 'A' },
        { score: 79, index: 2, tier: 'B' },
        { score: 70, index: 2, tier: 'B' },
        { score: 69, index: 3, tier: 'C' },
        { score: 60, index: 3, tier: 'C' },
        { score: 59, index: 4, tier: 'D' },
        { score: 50, index: 4, tier: 'D' },
        { score: 49, index: 5, tier: 'F' },
        { score: 0, index: 5, tier: 'F' }
    ];

    for (const { score, index, tier } of placementCases) {
        it(`places an artifact scored ${score} into the ${tier} tier`, async () => {
            setUser([{ artifactId: 1, score }]);
            await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', [1]);
            expect(insertedTierId(1)).toBe(tierIdForIndex(index));
        });
    }

    it('places a no-score (null) artifact into the unranked pool (tierId null)', async () => {
        setUser([{ artifactId: 5, score: null }]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', [5]);
        expect(insertedTierId(5)).toBeNull();
    });

    it('looks up scores server-side using the given userId', async () => {
        setUser([{ artifactId: 1, score: 85 }]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', [1]);
        // the authenticated user's id drives the score lookup; the client never supplies scores
        expect(vi.mocked(ArtifactDB.getUserInfos).mock.calls[0][0]).toBe(USER_ID);
    });

    it('places several artifacts each into its own tier in one call', async () => {
        setUser([
            { artifactId: 1, score: 95 }, // S
            { artifactId: 2, score: 75 }, // B
            { artifactId: 3, score: 55 }, // D
            { artifactId: 4, score: null } // unranked
        ]);
        await TierListUtil.createTierListFromArtifacts(
            USER_ID,
            ArtifactType.GAME,
            'My List',
            [1, 2, 3, 4]
        );
        expect(insertedTierId(1)).toBe(tierIdForIndex(0));
        expect(insertedTierId(2)).toBe(tierIdForIndex(2));
        expect(insertedTierId(3)).toBe(tierIdForIndex(4));
        expect(insertedTierId(4)).toBeNull();
    });
});

/**
 * Contract: artifactIds that do not exist / do not match / are not in the user's
 * list are SKIPPED. Such ids are absent from the server-side user-score lookup;
 * a correct implementation must NOT place them anywhere (not even the unranked pool).
 */
describe('TierListUtil.createTierListFromArtifacts — skipping invalid artifactIds', () => {
    it('does not place an artifactId that is not in the user list', async () => {
        // id 1 is a valid list member; id 99 is not returned by the server-side lookup
        setUser([{ artifactId: 1, score: 85 }]);
        await TierListUtil.createTierListFromArtifacts(USER_ID, ArtifactType.GAME, 'My List', [1, 99]);
        expect(insertedTierId(1)).toBe(tierIdForIndex(1)); // valid one placed (A tier)
        expect(insertedTierId(99)).toBeUndefined(); // invalid one skipped entirely
    });

    it('does not place any items when none of the artifactIds are valid members', async () => {
        setUser([]);
        await TierListUtil.createTierListFromArtifacts(
            USER_ID,
            ArtifactType.GAME,
            'My List',
            [99, 100, 101]
        );
        expect(vi.mocked(TierListDB.insertItem)).not.toHaveBeenCalled();
    });
});

describe('TierListUtil.createTierListFromArtifacts — empty artifactIds', () => {
    it('creates a valid tier list with the six tiers and no items', async () => {
        const result = await TierListUtil.createTierListFromArtifacts(
            USER_ID,
            ArtifactType.GAME,
            'My List',
            []
        );
        expect(result).toBe(TIER_LIST_ID);
        expect(vi.mocked(TierListDB.insertTierList)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(TierListDB.insertTier)).toHaveBeenCalledTimes(6);
        expect(vi.mocked(TierListDB.insertItem)).not.toHaveBeenCalled();
    });
});
