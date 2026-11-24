import { describe, it, expect } from 'vitest';
import { ArtifactType } from '#lib/model/Artifact';
import { Movie } from '#lib/model/movie/Movie';
import { UserArtifact, UserArtifactStatus } from '#lib/model/UserArtifact';
import { UserListOrder, UserListOrderLabel } from '#lib/model/UserList';
import type { UserListFilters } from './UserListFilters';
import { createUserListFilters, filterUserListItems } from './UserListFilters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface UserInfoFields {
    status?: UserArtifactStatus | null;
    score?: number | null;
    startDate?: Date | null;
    endDate?: Date | null;
}

/** Builds a UserArtifact with only the fields relevant to sorting. */
function makeUserInfo(id: number, fields: UserInfoFields): UserArtifact {
    return new UserArtifact(
        1,
        id,
        fields.status ?? null,
        fields.score ?? null,
        fields.startDate ?? null,
        fields.endDate ?? null
    );
}

interface MovieFields {
    title?: string;
    releaseDate?: Date | null;
    userInfo?: UserInfoFields | null;
    genres?: number[];
}

/**
 * Builds a Movie artifact used as a UserList item. When `userInfo` is provided
 * (even as an empty object) a UserArtifact is attached; `null`/omitted leaves it null.
 */
function makeMovie(id: number, fields: MovieFields = {}): Movie {
    const releaseDate = fields.releaseDate === undefined ? new Date('2020-01-01') : fields.releaseDate;
    // releaseDate is typed Date on the class but the contract allows a missing value.
    const movie = new Movie(id, fields.title ?? `Movie ${id}`, ArtifactType.MOVIE, releaseDate as Date, 120);
    movie.userInfo = fields.userInfo ? makeUserInfo(id, fields.userInfo) : null;
    if (fields.genres) {
        // Only genre.id is consulted by the filter; a minimal shape suffices.
        movie.genres = fields.genres.map((gid) => ({ id: gid })) as never;
    }
    return movie;
}

/** Default (no-op) filters for MOVIE with a given orderBy — every filter passes everything. */
function filtersWith(type: UserListOrder, direction: 'asc' | 'desc'): UserListFilters {
    const filters = createUserListFilters(ArtifactType.MOVIE);
    filters.orderBy = { type, direction };
    return filters;
}

/** Convenience: run the sort and return the resulting ids in order. */
function sortedIds(items: Movie[], type: UserListOrder, direction: 'asc' | 'desc'): number[] {
    return filterUserListItems(items, ArtifactType.MOVIE, filtersWith(type, direction)).map((i) => i.id);
}

// ---------------------------------------------------------------------------
// Contract 1 + 2: each UserListOrder sorts by its field; asc vs desc reverses.
// ---------------------------------------------------------------------------

describe('filterUserListItems — sort by TITLE (artifact.title)', () => {
    const items = () => [
        makeMovie(1, { title: 'Charlie' }),
        makeMovie(2, { title: 'Alpha' }),
        makeMovie(3, { title: 'Bravo' })
    ];

    it('ascending orders titles A→Z', () => {
        expect(sortedIds(items(), UserListOrder.TITLE, 'asc')).toEqual([2, 3, 1]);
    });

    it('descending orders titles Z→A (reverse of ascending)', () => {
        expect(sortedIds(items(), UserListOrder.TITLE, 'desc')).toEqual([1, 3, 2]);
    });
});

describe('filterUserListItems — sort by SCORE (artifact.userInfo.score)', () => {
    const items = () => [
        makeMovie(1, { userInfo: { score: 50 } }),
        makeMovie(2, { userInfo: { score: 10 } }),
        makeMovie(3, { userInfo: { score: 90 } })
    ];

    it('ascending orders scores low→high', () => {
        expect(sortedIds(items(), UserListOrder.SCORE, 'asc')).toEqual([2, 1, 3]);
    });

    it('descending orders scores high→low (reverse of ascending)', () => {
        expect(sortedIds(items(), UserListOrder.SCORE, 'desc')).toEqual([3, 1, 2]);
    });
});

describe('filterUserListItems — sort by STATUS (lifecycle order)', () => {
    // Lifecycle order: WISHLIST < ON_GOING < ON_HOLD < DROPPED < FINISHED
    const items = () => [
        makeMovie(1, { userInfo: { status: UserArtifactStatus.FINISHED } }),
        makeMovie(2, { userInfo: { status: UserArtifactStatus.WISHLIST } }),
        makeMovie(3, { userInfo: { status: UserArtifactStatus.ON_HOLD } }),
        makeMovie(4, { userInfo: { status: UserArtifactStatus.ON_GOING } }),
        makeMovie(5, { userInfo: { status: UserArtifactStatus.DROPPED } })
    ];

    it('ascending follows the lifecycle order WISHLIST→FINISHED', () => {
        expect(sortedIds(items(), UserListOrder.STATUS, 'asc')).toEqual([2, 4, 3, 5, 1]);
    });

    it('descending reverses the lifecycle order FINISHED→WISHLIST', () => {
        expect(sortedIds(items(), UserListOrder.STATUS, 'desc')).toEqual([1, 5, 3, 4, 2]);
    });
});

describe('filterUserListItems — sort by DATE_RELEASE (artifact.releaseDate)', () => {
    const items = () => [
        makeMovie(1, { releaseDate: new Date('2021-06-01') }),
        makeMovie(2, { releaseDate: new Date('2019-01-01') }),
        makeMovie(3, { releaseDate: new Date('2023-12-31') })
    ];

    it('ascending orders release dates oldest→newest', () => {
        expect(sortedIds(items(), UserListOrder.DATE_RELEASE, 'asc')).toEqual([2, 1, 3]);
    });

    it('descending orders release dates newest→oldest (reverse of ascending)', () => {
        expect(sortedIds(items(), UserListOrder.DATE_RELEASE, 'desc')).toEqual([3, 1, 2]);
    });
});

describe('filterUserListItems — sort by DATE_START (artifact.userInfo.startDate)', () => {
    const items = () => [
        makeMovie(1, { userInfo: { startDate: new Date('2022-05-05') } }),
        makeMovie(2, { userInfo: { startDate: new Date('2020-01-01') } }),
        makeMovie(3, { userInfo: { startDate: new Date('2024-09-09') } })
    ];

    it('ascending orders start dates oldest→newest', () => {
        expect(sortedIds(items(), UserListOrder.DATE_START, 'asc')).toEqual([2, 1, 3]);
    });

    it('descending orders start dates newest→oldest (reverse of ascending)', () => {
        expect(sortedIds(items(), UserListOrder.DATE_START, 'desc')).toEqual([3, 1, 2]);
    });
});

describe('filterUserListItems — sort by DATE_END (artifact.userInfo.endDate)', () => {
    const items = () => [
        makeMovie(1, { userInfo: { endDate: new Date('2022-05-05') } }),
        makeMovie(2, { userInfo: { endDate: new Date('2020-01-01') } }),
        makeMovie(3, { userInfo: { endDate: new Date('2024-09-09') } })
    ];

    it('ascending orders end dates oldest→newest', () => {
        expect(sortedIds(items(), UserListOrder.DATE_END, 'asc')).toEqual([2, 1, 3]);
    });

    it('descending orders end dates newest→oldest (reverse of ascending)', () => {
        expect(sortedIds(items(), UserListOrder.DATE_END, 'desc')).toEqual([3, 1, 2]);
    });
});

// ---------------------------------------------------------------------------
// Contract 3: items with a null/missing sort-key sort LAST in BOTH directions.
// ---------------------------------------------------------------------------

describe('filterUserListItems — null/missing sort keys sort last (both directions)', () => {
    it('SCORE: item with null score is last ascending', () => {
        const items = [
            makeMovie(1, { userInfo: { score: null } }),
            makeMovie(2, { userInfo: { score: 10 } }),
            makeMovie(3, { userInfo: { score: 90 } })
        ];
        expect(sortedIds(items, UserListOrder.SCORE, 'asc')).toEqual([2, 3, 1]);
    });

    it('SCORE: item with null score is still last descending', () => {
        const items = [
            makeMovie(1, { userInfo: { score: null } }),
            makeMovie(2, { userInfo: { score: 10 } }),
            makeMovie(3, { userInfo: { score: 90 } })
        ];
        expect(sortedIds(items, UserListOrder.SCORE, 'desc')).toEqual([3, 2, 1]);
    });

    it('SCORE: item with no userInfo at all is last (both directions)', () => {
        const items = [
            makeMovie(1, { userInfo: null }),
            makeMovie(2, { userInfo: { score: 10 } }),
            makeMovie(3, { userInfo: { score: 90 } })
        ];
        expect(sortedIds(items, UserListOrder.SCORE, 'asc')).toEqual([2, 3, 1]);
        expect(sortedIds(items, UserListOrder.SCORE, 'desc')).toEqual([3, 2, 1]);
    });

    it('DATE_RELEASE: item with null release date is last (both directions)', () => {
        const items = [
            makeMovie(1, { releaseDate: null }),
            makeMovie(2, { releaseDate: new Date('2019-01-01') }),
            makeMovie(3, { releaseDate: new Date('2023-01-01') })
        ];
        expect(sortedIds(items, UserListOrder.DATE_RELEASE, 'asc')).toEqual([2, 3, 1]);
        expect(sortedIds(items, UserListOrder.DATE_RELEASE, 'desc')).toEqual([3, 2, 1]);
    });

    it('STATUS: item with null status is last (both directions)', () => {
        const items = [
            makeMovie(1, { userInfo: { status: null } }),
            makeMovie(2, { userInfo: { status: UserArtifactStatus.WISHLIST } }),
            makeMovie(3, { userInfo: { status: UserArtifactStatus.FINISHED } })
        ];
        expect(sortedIds(items, UserListOrder.STATUS, 'asc')).toEqual([2, 3, 1]);
        expect(sortedIds(items, UserListOrder.STATUS, 'desc')).toEqual([3, 2, 1]);
    });

    it('DATE_END: item with null end date is last (both directions)', () => {
        const items = [
            makeMovie(1, { userInfo: { endDate: null } }),
            makeMovie(2, { userInfo: { endDate: new Date('2020-01-01') } }),
            makeMovie(3, { userInfo: { endDate: new Date('2024-01-01') } })
        ];
        expect(sortedIds(items, UserListOrder.DATE_END, 'asc')).toEqual([2, 3, 1]);
        expect(sortedIds(items, UserListOrder.DATE_END, 'desc')).toEqual([3, 2, 1]);
    });

    it('all items have a null key → ordered deterministically by id', () => {
        const items = [
            makeMovie(3, { userInfo: { score: null } }),
            makeMovie(1, { userInfo: { score: null } }),
            makeMovie(2, { userInfo: { score: null } })
        ];
        expect(sortedIds(items, UserListOrder.SCORE, 'asc')).toEqual([1, 2, 3]);
    });
});

// ---------------------------------------------------------------------------
// Contract 4: ties are broken deterministically on artifact.id.
// ---------------------------------------------------------------------------

describe('filterUserListItems — ties broken deterministically by artifact.id', () => {
    it('equal scores are ordered by ascending id', () => {
        const items = [
            makeMovie(7, { userInfo: { score: 50 } }),
            makeMovie(2, { userInfo: { score: 50 } }),
            makeMovie(5, { userInfo: { score: 50 } })
        ];
        expect(sortedIds(items, UserListOrder.SCORE, 'asc')).toEqual([2, 5, 7]);
    });

    it('equal titles are ordered by ascending id', () => {
        const items = [
            makeMovie(9, { title: 'Same' }),
            makeMovie(3, { title: 'Same' }),
            makeMovie(6, { title: 'Same' })
        ];
        expect(sortedIds(items, UserListOrder.TITLE, 'asc')).toEqual([3, 6, 9]);
    });

    it('tie-breaking is stable regardless of input order', () => {
        const a = [makeMovie(4, { userInfo: { score: 1 } }), makeMovie(1, { userInfo: { score: 1 } })];
        const b = [makeMovie(1, { userInfo: { score: 1 } }), makeMovie(4, { userInfo: { score: 1 } })];
        expect(sortedIds(a, UserListOrder.SCORE, 'asc')).toEqual([1, 4]);
        expect(sortedIds(b, UserListOrder.SCORE, 'asc')).toEqual([1, 4]);
    });
});

// ---------------------------------------------------------------------------
// Contract 5: filterUserListItems must NOT mutate its input array.
// ---------------------------------------------------------------------------

describe('filterUserListItems — does not mutate the input array', () => {
    it('leaves the caller array order unchanged after sorting', () => {
        const items = [
            makeMovie(3, { userInfo: { score: 10 } }),
            makeMovie(1, { userInfo: { score: 90 } }),
            makeMovie(2, { userInfo: { score: 50 } })
        ];
        const before = items.map((i) => i.id);

        const result = filterUserListItems(items, ArtifactType.MOVIE, filtersWith(UserListOrder.SCORE, 'asc'));

        // Input array untouched...
        expect(items.map((i) => i.id)).toEqual(before);
        // ...and the returned array is a different (sorted) array.
        expect(result).not.toBe(items);
        expect(result.map((i) => i.id)).toEqual([3, 2, 1]);
    });
});

// ---------------------------------------------------------------------------
// Contract 6: sorting composes with filtering (both active → filtered AND sorted).
// ---------------------------------------------------------------------------

describe('filterUserListItems — sorting composes with filtering', () => {
    it('applies a genre filter AND sorts the surviving items', () => {
        const items = [
            makeMovie(1, { title: 'Delta', genres: [10] }),
            makeMovie(2, { title: 'Alpha', genres: [10] }),
            makeMovie(3, { title: 'Zulu', genres: [99] }), // filtered out
            makeMovie(4, { title: 'Bravo', genres: [10] })
        ];

        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.genres.included = [10];

        const result = filterUserListItems(items, ArtifactType.MOVIE, filters);
        // genre 99 removed; remainder sorted by title A→Z
        expect(result.map((i) => i.id)).toEqual([2, 4, 1]);
    });

    it('filter + descending sort returns only matching items in reverse order', () => {
        const items = [
            makeMovie(1, { title: 'Delta', genres: [10] }),
            makeMovie(2, { title: 'Alpha', genres: [10] }),
            makeMovie(3, { title: 'Zulu', genres: [99] }), // filtered out
            makeMovie(4, { title: 'Bravo', genres: [10] })
        ];

        const filters = filtersWith(UserListOrder.TITLE, 'desc');
        filters.genres.included = [10];

        const result = filterUserListItems(items, ArtifactType.MOVIE, filters);
        expect(result.map((i) => i.id)).toEqual([1, 4, 2]);
    });
});

// ---------------------------------------------------------------------------
// Boundary: empty input.
// ---------------------------------------------------------------------------

describe('filterUserListItems — empty input', () => {
    it('returns an empty array', () => {
        expect(filterUserListItems([], ArtifactType.MOVIE, filtersWith(UserListOrder.TITLE, 'asc'))).toEqual([]);
    });
});

// ===========================================================================
// STANDARDS TESTS — written against the implementation (UserListFilters.ts +
// UserList.ts). These complement the contract tests above by exercising code
// paths only visible by reading the source: the UserListOrderLabel map,
// STATUS_ORDER completeness, the exact ordering of null-handling / tiebreak vs
// direction reversal, `?? null` falsy-value handling, localeCompare semantics,
// and sort-before-filter composition.
// ===========================================================================

// ---------------------------------------------------------------------------
// UserListOrderLabel map — every enum value must have a human label. This
// guards future additions to the UserListOrder enum (a new value with no
// label would otherwise ship a blank/undefined table header).
// ---------------------------------------------------------------------------

describe('UserListOrderLabel — completeness guard', () => {
    it('has a non-empty label for every UserListOrder enum value', () => {
        for (const value of Object.values(UserListOrder)) {
            const label = (UserListOrderLabel as Record<string, string>)[value];
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
        }
    });

    it('maps exactly the current enum set (no stale / missing keys)', () => {
        expect(Object.keys(UserListOrderLabel).sort()).toEqual(Object.values(UserListOrder).sort());
    });

    it('exposes the expected labels (DATE_RELEASE renders as "Release Date")', () => {
        expect(UserListOrderLabel[UserListOrder.DATE_RELEASE]).toBe('Release Date');
        expect(UserListOrderLabel[UserListOrder.TITLE]).toBe('Title');
        expect(UserListOrderLabel[UserListOrder.SCORE]).toBe('Score');
        expect(UserListOrderLabel[UserListOrder.STATUS]).toBe('Status');
        expect(UserListOrderLabel[UserListOrder.DATE_START]).toBe('Start Date');
        expect(UserListOrderLabel[UserListOrder.DATE_END]).toBe('End Date');
    });
});

// ---------------------------------------------------------------------------
// STATUS_ORDER completeness — the private STATUS_ORDER map must cover every
// UserArtifactStatus. A value missing from the map would produce an
// `undefined` sort key (not null) and land unpredictably. We verify this
// indirectly: one item per status, sorted asc, must follow the full lifecycle.
// ---------------------------------------------------------------------------

describe('STATUS_ORDER — every UserArtifactStatus is mapped', () => {
    // Lifecycle order the implementation encodes: WISHLIST<ON_GOING<ON_HOLD<DROPPED<FINISHED
    const lifecycle = [
        UserArtifactStatus.WISHLIST,
        UserArtifactStatus.ON_GOING,
        UserArtifactStatus.ON_HOLD,
        UserArtifactStatus.DROPPED,
        UserArtifactStatus.FINISHED
    ];

    it('covers all five enum values (count guard against new statuses)', () => {
        expect(Object.values(UserArtifactStatus).length).toBe(lifecycle.length);
        // Every enum value is present in the lifecycle we assert against.
        for (const status of Object.values(UserArtifactStatus)) {
            expect(lifecycle).toContain(status);
        }
    });

    it('sorting one item per status (scrambled input) yields the full lifecycle order', () => {
        // Build in a deliberately scrambled order; ids follow insertion so a
        // correct sort cannot be an accident of input ordering.
        const scrambled = [
            UserArtifactStatus.DROPPED,
            UserArtifactStatus.WISHLIST,
            UserArtifactStatus.FINISHED,
            UserArtifactStatus.ON_HOLD,
            UserArtifactStatus.ON_GOING
        ];
        const items = scrambled.map((status, idx) => makeMovie(idx + 1, { userInfo: { status } }));

        const result = filterUserListItems(items, ArtifactType.MOVIE, filtersWith(UserListOrder.STATUS, 'asc'));
        expect(result.map((i) => i.userInfo!.status)).toEqual(lifecycle);
    });

    it('an unknown/unmapped status does not throw and keeps every item', () => {
        const items = [
            makeMovie(1, { userInfo: { status: 'not-a-real-status' as UserArtifactStatus } }),
            makeMovie(2, { userInfo: { status: UserArtifactStatus.FINISHED } }),
            makeMovie(3, { userInfo: { status: 'another-bogus' as UserArtifactStatus } })
        ];
        let result: ReturnType<typeof filterUserListItems>;
        expect(() => {
            result = filterUserListItems(items, ArtifactType.MOVIE, filtersWith(UserListOrder.STATUS, 'asc'));
        }).not.toThrow();
        expect(result!.map((i) => i.id).sort()).toEqual([1, 2, 3]);
    });
});

// ---------------------------------------------------------------------------
// `?? null` falsy-value handling — the extractor uses nullish coalescing, so
// a score of 0 and a status that maps to 0 (WISHLIST) are REAL keys, not
// nulls. A naive `|| null` would mis-sort these to the end.
// ---------------------------------------------------------------------------

describe('getSortKey — zero-valued keys are real values, not nulls', () => {
    it('SCORE 0 sorts as the lowest score, NOT last (asc)', () => {
        const items = [
            makeMovie(1, { userInfo: { score: 0 } }),
            makeMovie(2, { userInfo: { score: 10 } }),
            makeMovie(3, { userInfo: { score: null } })
        ];
        // 0 is lowest real score → id 1 first; null (id 3) is genuinely last.
        expect(sortedIds(items, UserListOrder.SCORE, 'asc')).toEqual([1, 2, 3]);
    });

    it('SCORE 0 stays ahead of the null item even in desc (null is last both ways)', () => {
        const items = [
            makeMovie(1, { userInfo: { score: 0 } }),
            makeMovie(2, { userInfo: { score: 10 } }),
            makeMovie(3, { userInfo: { score: null } })
        ];
        // desc: 10, 0, then null still last.
        expect(sortedIds(items, UserListOrder.SCORE, 'desc')).toEqual([2, 1, 3]);
    });

    it('STATUS WISHLIST (maps to 0) is treated as a real key, not a null', () => {
        const items = [
            makeMovie(1, { userInfo: { status: UserArtifactStatus.WISHLIST } }), // key 0
            makeMovie(2, { userInfo: { status: UserArtifactStatus.FINISHED } }), // key 4
            makeMovie(3, { userInfo: { status: null } })                          // null → last
        ];
        expect(sortedIds(items, UserListOrder.STATUS, 'asc')).toEqual([1, 2, 3]);
        // desc reverses the real keys but leaves the null item last.
        expect(sortedIds(items, UserListOrder.STATUS, 'desc')).toEqual([2, 1, 3]);
    });
});

// ---------------------------------------------------------------------------
// Ordering of null-handling / id-tiebreak vs the direction reversal. The
// implementation returns the null verdicts (1 / -1) and the id tiebreak
// (a.id - b.id) BEFORE applying `direction === 'asc' ? comparison : -comparison`.
// Consequence: nulls stay last AND ties stay ascending-by-id even in desc.
// The contract tests only checked tiebreaks in asc; this pins the desc path.
// ---------------------------------------------------------------------------

describe('comparator — tiebreak and null-handling are NOT reversed by desc', () => {
    it('equal keys keep ascending-id order even when direction is desc', () => {
        const items = [
            makeMovie(7, { userInfo: { score: 50 } }),
            makeMovie(2, { userInfo: { score: 50 } }),
            makeMovie(5, { userInfo: { score: 50 } })
        ];
        // All scores equal → id tiebreak is applied verbatim (ascending) and is
        // NOT negated by desc.
        expect(sortedIds(items, UserListOrder.SCORE, 'desc')).toEqual([2, 5, 7]);
    });

    it('all-null keys keep ascending-id order even when direction is desc', () => {
        const items = [
            makeMovie(3, { userInfo: { score: null } }),
            makeMovie(1, { userInfo: { score: null } }),
            makeMovie(2, { userInfo: { score: null } })
        ];
        expect(sortedIds(items, UserListOrder.SCORE, 'desc')).toEqual([1, 2, 3]);
    });

    it('equal DATE_RELEASE timestamps break the tie by ascending id (both directions)', () => {
        const sameInstant = () => new Date('2020-01-01T00:00:00Z');
        const items = () => [
            makeMovie(8, { releaseDate: sameInstant() }),
            makeMovie(4, { releaseDate: sameInstant() }),
            makeMovie(6, { releaseDate: sameInstant() })
        ];
        expect(sortedIds(items(), UserListOrder.DATE_RELEASE, 'asc')).toEqual([4, 6, 8]);
        expect(sortedIds(items(), UserListOrder.DATE_RELEASE, 'desc')).toEqual([4, 6, 8]);
    });

    it('a null-key item mixed with ties: null is last, real keys tie by id (desc)', () => {
        const items = [
            makeMovie(5, { userInfo: { score: 50 } }),
            makeMovie(1, { userInfo: { score: null } }),
            makeMovie(2, { userInfo: { score: 50 } })
        ];
        // desc: the two score-50 items first (ascending id tiebreak, unreversed),
        // then the null item last.
        expect(sortedIds(items, UserListOrder.SCORE, 'desc')).toEqual([2, 5, 1]);
    });
});

// ---------------------------------------------------------------------------
// TITLE sorting uses String.prototype.localeCompare, not raw `<`/`>` on char
// codes. That makes it case-insensitive-ish (letter before ASCII code), which
// a naive comparison would get wrong (uppercase 'B'=66 < lowercase 'a'=97).
// ---------------------------------------------------------------------------

describe('getSortKey TITLE — uses localeCompare (not raw char-code comparison)', () => {
    it('orders by letter regardless of case (localeCompare semantics)', () => {
        const items = [
            makeMovie(1, { title: 'Banana' }),
            makeMovie(2, { title: 'apple' }),
            makeMovie(3, { title: 'Cherry' })
        ];
        // localeCompare → apple, Banana, Cherry (a<b<c, case folded).
        // Raw `<` would put 'Banana' and 'Cherry' before 'apple' (uppercase first).
        expect(sortedIds(items, UserListOrder.TITLE, 'asc')).toEqual([2, 1, 3]);
    });

    it('titles that differ only by case tie-break deterministically by id', () => {
        const items = [
            makeMovie(9, { title: 'alpha' }),
            makeMovie(3, { title: 'Alpha' })
        ];
        // localeCompare('alpha','Alpha') is non-zero on some locales; whichever
        // order wins, the result must be a stable, repeatable permutation.
        const once = sortedIds([...items], UserListOrder.TITLE, 'asc');
        const twice = sortedIds([...items].reverse(), UserListOrder.TITLE, 'asc');
        expect(once).toEqual(twice);
    });
});

// ---------------------------------------------------------------------------
// Sort-before-filter composition. The implementation sorts the FULL copied
// array first, then applies the filter blocks. Filtering preserves relative
// order, so removing items (even ones that would sort to the extremes) must
// not disturb the ordering of the survivors.
// ---------------------------------------------------------------------------

describe('filterUserListItems — sort runs before filter, survivors keep their order', () => {
    it('removing the would-be-first and would-be-last items leaves survivors correctly sorted', () => {
        const items = [
            makeMovie(1, { title: 'Alpha', genres: [99] }), // would be first asc, but filtered out
            makeMovie(2, { title: 'Delta', genres: [10] }),
            makeMovie(3, { title: 'Bravo', genres: [10] }),
            makeMovie(4, { title: 'Zulu', genres: [99] })  // would be last asc, filtered out
        ];
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.genres.included = [10];

        const result = filterUserListItems(items, ArtifactType.MOVIE, filters);
        // Only genre-10 items remain, still sorted Bravo < Delta.
        expect(result.map((i) => i.id)).toEqual([3, 2]);
    });

    it('does not mutate input even when both sort and multiple filters are active', () => {
        const items = [
            makeMovie(3, { title: 'Delta', genres: [10] }),
            makeMovie(1, { title: 'Alpha', genres: [10] }),
            makeMovie(2, { title: 'Bravo', genres: [20] })
        ];
        const before = items.map((i) => i.id);
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.genres.included = [10];
        filters.genres.excluded = [20];

        filterUserListItems(items, ArtifactType.MOVIE, filters);
        expect(items.map((i) => i.id)).toEqual(before);
    });
});

// ---------------------------------------------------------------------------
// Score filter (filters.score = { min, max }, 0–100).
// ---------------------------------------------------------------------------

describe('filterUserListItems — score filter', () => {
    const items = () => [
        makeMovie(1, { userInfo: { score: 10 } }),
        makeMovie(2, { userInfo: { score: 50 } }),
        makeMovie(3, { userInfo: { score: 90 } }),
        makeMovie(4, { userInfo: { score: null } }),
        makeMovie(5, { userInfo: null })
    ];

    function filteredIds(score: { min: number; max: number }): number[] {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.score = score;
        return filterUserListItems(items(), ArtifactType.MOVIE, filters).map((i) => i.id);
    }

    it('full range (0–100) keeps everything, including null/absent scores', () => {
        expect(filteredIds({ min: 0, max: 100 }).sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('raising min keeps only scores >= min and drops null/absent', () => {
        expect(filteredIds({ min: 50, max: 100 }).sort()).toEqual([2, 3]);
    });

    it('lowering max keeps only scores <= max and drops null/absent', () => {
        expect(filteredIds({ min: 0, max: 50 }).sort()).toEqual([1, 2]);
    });

    it('a narrow window keeps only scores inside it', () => {
        expect(filteredIds({ min: 40, max: 60 })).toEqual([2]);
    });

    it('score 0 is a real value kept by the full range', () => {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        const result = filterUserListItems([makeMovie(1, { userInfo: { score: 0 } })], ArtifactType.MOVIE, filters);
        expect(result.map((i) => i.id)).toEqual([1]);
    });
});

// ---------------------------------------------------------------------------
// Status filter (filters.status.included).
// ---------------------------------------------------------------------------

describe('filterUserListItems — status filter', () => {
    const items = () => [
        makeMovie(1, { userInfo: { status: UserArtifactStatus.FINISHED } }),
        makeMovie(2, { userInfo: { status: UserArtifactStatus.WISHLIST } }),
        makeMovie(3, { userInfo: { status: UserArtifactStatus.ON_GOING } }),
        makeMovie(4, { userInfo: { status: null } }),
        makeMovie(5, { userInfo: null })
    ];

    function filteredIds(included: UserArtifactStatus[]): number[] {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.status.included = included;
        return filterUserListItems(items(), ArtifactType.MOVIE, filters).map((i) => i.id);
    }

    it('empty included keeps everything, including null/absent status', () => {
        expect(filteredIds([]).sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('a single status keeps only matching items', () => {
        expect(filteredIds([UserArtifactStatus.FINISHED])).toEqual([1]);
    });

    it('multiple statuses keep any matching item and drop null/absent', () => {
        expect(filteredIds([UserArtifactStatus.WISHLIST, UserArtifactStatus.ON_GOING]).sort()).toEqual([2, 3]);
    });
});

// ---------------------------------------------------------------------------
// Start/End date filters (year ranges over userInfo.startDate / endDate).
// ---------------------------------------------------------------------------

describe('filterUserListItems — start date filter (year range)', () => {
    const items = () => [
        makeMovie(1, { userInfo: { startDate: new Date('2018-06-01') } }),
        makeMovie(2, { userInfo: { startDate: new Date('2021-06-01') } }),
        makeMovie(3, { userInfo: { startDate: new Date('2024-06-01') } }),
        makeMovie(4, { userInfo: { startDate: null } }),
        makeMovie(5, { userInfo: null })
    ];

    function filteredIds(min: number, max: number): number[] {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.startDate = { ...filters.startDate, min, max };
        return filterUserListItems(items(), ArtifactType.MOVIE, filters).map((i) => i.id);
    }

    it('full range keeps everything, including null/absent start dates', () => {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        const result = filterUserListItems(items(), ArtifactType.MOVIE, filters).map((i) => i.id);
        expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('narrowing the year range keeps only start dates inside it and drops null/absent', () => {
        expect(filteredIds(2020, 2022)).toEqual([2]);
    });

    it('year-range boundaries are inclusive', () => {
        expect(filteredIds(2018, 2024).sort()).toEqual([1, 2, 3]);
    });
});

describe('filterUserListItems — end date filter (year range)', () => {
    const items = () => [
        makeMovie(1, { userInfo: { endDate: new Date('2018-06-01') } }),
        makeMovie(2, { userInfo: { endDate: new Date('2021-06-01') } }),
        makeMovie(3, { userInfo: { endDate: new Date('2024-06-01') } }),
        makeMovie(4, { userInfo: { endDate: null } }),
        makeMovie(5, { userInfo: null })
    ];

    function filteredIds(min: number, max: number): number[] {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.endDate = { ...filters.endDate, min, max };
        return filterUserListItems(items(), ArtifactType.MOVIE, filters).map((i) => i.id);
    }

    it('full range keeps everything, including null/absent end dates', () => {
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        const result = filterUserListItems(items(), ArtifactType.MOVIE, filters).map((i) => i.id);
        expect(result.sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('narrowing the year range keeps only end dates inside it and drops null/absent', () => {
        expect(filteredIds(2023, 2024)).toEqual([3]);
    });
});

// ---------------------------------------------------------------------------
// Score/status/date filters compose with each other and with sorting.
// ---------------------------------------------------------------------------

describe('filterUserListItems — new filters compose with sorting', () => {
    it('status + score narrow the set while the active sort still orders survivors', () => {
        const items = [
            makeMovie(1, { title: 'Delta', userInfo: { status: UserArtifactStatus.FINISHED, score: 80 } }),
            makeMovie(2, { title: 'Alpha', userInfo: { status: UserArtifactStatus.FINISHED, score: 40 } }),
            makeMovie(3, { title: 'Bravo', userInfo: { status: UserArtifactStatus.WISHLIST, score: 90 } }),
            makeMovie(4, { title: 'Echo', userInfo: { status: UserArtifactStatus.FINISHED, score: 90 } })
        ];
        const filters = filtersWith(UserListOrder.TITLE, 'asc');
        filters.status.included = [UserArtifactStatus.FINISHED];
        filters.score = { min: 50, max: 100 };
        const result = filterUserListItems(items, ArtifactType.MOVIE, filters).map((i) => i.id);
        // Finished AND score>=50 → ids 1 (Delta,80) and 4 (Echo,90); sorted by title asc → Delta, Echo.
        expect(result).toEqual([1, 4]);
    });
});

// ---------------------------------------------------------------------------
// NOTE: `setSort(type)` in +page.svelte (toggle asc↔desc on the active column,
// reset to asc on a different column) is implemented inline inside the Svelte
// component against a writable store and is not exported. It is not reasonably
// unit-testable in isolation without a component-store harness, so it is
// intentionally not covered here (per the standards-testing scope).
// ---------------------------------------------------------------------------
