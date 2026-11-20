/**
 * TDD tests for buildRecapSlides — validates the public contract of the function
 * without reading the implementation.
 *
 * Contract source: feature specification for the Year Recap feature.
 */

import { describe, it, expect } from 'vitest';
import { buildRecapSlides } from './RecapCompute';
import { ArtifactType } from '#lib/model/Artifact';
import type { RecapEntry, RecapSlide } from '#lib/model/recap/RecapTypes';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Unix ms timestamp for a given year/month(0-based)/day */
const ts = (year: number, month = 0, day = 1, hour = 0): number =>
    new Date(year, month, day, hour).getTime();

/**
 * The sentinel value used to represent "unknown / TBD" release dates.
 * According to the spec, items with this exact value are always treated as
 * "classic" regardless of the recap year.
 */
const SENTINEL = 7258118400000; // ~Jan 1 2200

function makeEntry(overrides: Partial<RecapEntry> & { type: ArtifactType }): RecapEntry {
    return {
        id: 1,
        title: 'Test Entry',
        duration: 3600,       // 1 hour in seconds
        releaseDate: ts(2010),
        score: null,
        endDate: ts(2024, 5, 15), // June 15 2024
        startDate: null,
        ...overrides
    };
}

// Convenience sets used across many tests
const MAIN_TYPES: ArtifactType[] = [
    ArtifactType.GAME,
    ArtifactType.MOVIE,
    ArtifactType.TVSHOW,
    ArtifactType.ANIME,
    ArtifactType.MANGA
];

const NON_MAIN_TYPES: ArtifactType[] = [
    ArtifactType.ANIME_EPISODE,
    ArtifactType.TVSHOW_SEASON,
    ArtifactType.TVSHOW_EPISODE,
    ArtifactType.MANGA_CHAPTER,
    ArtifactType.MANGA_VOLUME,
    ArtifactType.COMICS
];

// ─── Contract: first slide is always "opening" ────────────────────────────────

describe('opening slide', () => {
    it('is always the first slide', () => {
        const slides = buildRecapSlides(2024, [], [], []);
        expect(slides[0].kind).toBe('opening');
    });

    it('carries the requested year', () => {
        const slides = buildRecapSlides(2024, [], [], []);
        const opening = slides[0] as Extract<RecapSlide, { kind: 'opening' }>;
        expect(opening.year).toBe(2024);
    });

    it('works for any valid year', () => {
        const slides = buildRecapSlides(2019, [], [], []);
        const opening = slides[0] as Extract<RecapSlide, { kind: 'opening' }>;
        expect(opening.year).toBe(2019);
    });
});

// ─── Contract: empty result when currentEntries is empty ─────────────────────

describe('empty state (no currentEntries)', () => {
    it('returns exactly two slides: [opening, empty]', () => {
        const slides = buildRecapSlides(2024, [], [], []);
        expect(slides).toHaveLength(2);
        expect(slides[0].kind).toBe('opening');
        expect(slides[1].kind).toBe('empty');
    });

    it('empty slide carries the year', () => {
        const slides = buildRecapSlides(2024, [], [], []);
        const empty = slides[1] as Extract<RecapSlide, { kind: 'empty' }>;
        expect(empty.year).toBe(2024);
    });

    it('no additional slides are appended beyond [opening, empty]', () => {
        const slides = buildRecapSlides(2024, [], [], [{ name: 'RPG', count: 5 }]);
        expect(slides).toHaveLength(2);
    });
});

// ─── Contract: slide ordering with data present ───────────────────────────────

describe('slide ordering', () => {
    const entries = MAIN_TYPES.map((type, i) =>
        makeEntry({ id: i + 1, type, score: 80 + i, endDate: ts(2024, i, 15) })
    );

    it('opening is first', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides[0].kind).toBe('opening');
    });

    it('grand_total follows opening', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides[1].kind).toBe('grand_total');
    });

    it('by_type follows grand_total', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides[2].kind).toBe('by_type');
    });

    it('monthly follows by_type when no genres', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const byTypeIdx = kinds.indexOf('by_type');
        expect(kinds[byTypeIdx + 1]).toBe('monthly');
    });

    it('top_genres is inserted between by_type and monthly when genres exist', () => {
        const slides = buildRecapSlides(2024, entries, [], [{ name: 'RPG', count: 3 }]);
        const kinds = slides.map(s => s.kind);
        const byTypeIdx = kinds.indexOf('by_type');
        expect(kinds[byTypeIdx + 1]).toBe('top_genres');
        expect(kinds[byTypeIdx + 2]).toBe('monthly');
    });

    it('year_comparison follows monthly', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const monthlyIdx = kinds.indexOf('monthly');
        expect(kinds[monthlyIdx + 1]).toBe('year_comparison');
    });

    it('highest_rated follows year_comparison when scored main-type entries exist', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const ycIdx = kinds.indexOf('year_comparison');
        expect(kinds[ycIdx + 1]).toBe('highest_rated');
    });

    it('top_by_type slides follow highest_rated', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const hrIdx = kinds.indexOf('highest_rated');
        expect(kinds[hrIdx + 1]).toBe('top_by_type');
    });

    it('score_dist follows all top_by_type slides', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const sdIdx = kinds.indexOf('score_dist');
        expect(kinds[sdIdx - 1]).toBe('top_by_type');
    });

    it('longest follows score_dist', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const sdIdx = kinds.indexOf('score_dist');
        expect(kinds[sdIdx + 1]).toBe('longest');
    });

    it('classics_vs_new follows longest', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const longestIdx = kinds.indexOf('longest');
        expect(kinds[longestIdx + 1]).toBe('classics_vs_new');
    });

    it('closing is last', () => {
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        expect(kinds[kinds.length - 1]).toBe('closing');
    });
});

// ─── Contract: grand_total ────────────────────────────────────────────────────

describe('grand_total slide', () => {
    it('totalCount equals the number of currentEntries', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE }),
            makeEntry({ id: 3, type: ArtifactType.ANIME_EPISODE })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'grand_total') as Extract<RecapSlide, { kind: 'grand_total' }>;
        expect(slide.totalCount).toBe(3);
    });

    it('totalDuration is the sum of all entry durations', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, duration: 100 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, duration: 200 }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, duration: 50 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'grand_total') as Extract<RecapSlide, { kind: 'grand_total' }>;
        expect(slide.totalDuration).toBe(350);
    });

    it('totalDuration handles a single entry', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, duration: 7200 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'grand_total') as Extract<RecapSlide, { kind: 'grand_total' }>;
        expect(slide.totalDuration).toBe(7200);
    });
});

// ─── Contract: by_type slide ──────────────────────────────────────────────────

describe('by_type slide', () => {
    it('counts only MAIN_ARTIFACT_TYPES (not child types)', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME }),
            makeEntry({ id: 2, type: ArtifactType.ANIME_EPISODE }),   // non-main
            makeEntry({ id: 3, type: ArtifactType.TVSHOW_EPISODE }),  // non-main
            makeEntry({ id: 4, type: ArtifactType.MANGA_CHAPTER })    // non-main
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        const total = slide.counts.reduce((sum, c) => sum + c.count, 0);
        expect(total).toBe(1); // only the GAME counts
    });

    it('mediaType is the main type with the highest count', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.MOVIE }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE }),
            makeEntry({ id: 3, type: ArtifactType.GAME })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        expect(slide.mediaType).toBe(ArtifactType.MOVIE);
    });

    it('counts include all five MAIN types that are present', () => {
        const entries = MAIN_TYPES.map((type, i) => makeEntry({ id: i + 1, type }));
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        const presentTypes = slide.counts.map(c => c.type);
        for (const t of MAIN_TYPES) {
            expect(presentTypes).toContain(t);
        }
    });

    it('counts do not include non-main types', () => {
        const entries = NON_MAIN_TYPES.map((type, i) => makeEntry({ id: i + 1, type }));
        // Need at least one main type to avoid empty state
        entries.push(makeEntry({ id: 99, type: ArtifactType.GAME }));
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        const presentTypes = slide.counts.map(c => c.type);
        for (const t of NON_MAIN_TYPES) {
            expect(presentTypes).not.toContain(t);
        }
    });
});

// ─── Contract: top_genres slide ───────────────────────────────────────────────

describe('top_genres slide', () => {
    it('is omitted when genres array is empty', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'top_genres')).toBe(false);
    });

    it('is included when genres array is non-empty', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], [{ name: 'RPG', count: 5 }]);
        expect(slides.some(s => s.kind === 'top_genres')).toBe(true);
    });

    it('genres array is passed through as-is (top 3, pre-sorted by DB)', () => {
        const genres = [
            { name: 'RPG', count: 10 },
            { name: 'Action', count: 7 },
            { name: 'Adventure', count: 4 }
        ];
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], genres);
        const slide = slides.find(s => s.kind === 'top_genres') as Extract<RecapSlide, { kind: 'top_genres' }>;
        expect(slide.genres).toEqual(genres);
    });
});

// ─── Contract: monthly slide ──────────────────────────────────────────────────

describe('monthly slide', () => {
    it('always has exactly 12 bars (one per month)', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        expect(slide.bars).toHaveLength(12);
    });

    it('bar values count entries by their endDate month', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: ts(2024, 0, 10) }), // Jan
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: ts(2024, 0, 20) }), // Jan
            makeEntry({ id: 3, type: ArtifactType.ANIME, endDate: ts(2024, 5, 15) })  // Jun
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        expect(slide.bars[0].value).toBe(2);  // January
        expect(slide.bars[5].value).toBe(1);  // June
        expect(slide.bars[1].value).toBe(0);  // February
    });

    it('counts ALL entry types in monthly bars (not just main types)', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, endDate: ts(2024, 2, 1) }), // non-main
            makeEntry({ id: 2, type: ArtifactType.TVSHOW_EPISODE, endDate: ts(2024, 2, 1) }) // non-main
        ];
        // Also need a main type to avoid empty state
        entries.push(makeEntry({ id: 99, type: ArtifactType.GAME, endDate: ts(2024, 6, 1) }));
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        // March (index 2) should count both non-main entries
        expect(slide.bars[2].value).toBe(2);
    });

    it('empty months have value 0', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, endDate: ts(2024, 0, 1) })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        for (let m = 1; m < 12; m++) {
            expect(slide.bars[m].value).toBe(0);
        }
    });
});

// ─── Contract: year_comparison slide ─────────────────────────────────────────

describe('year_comparison slide', () => {
    const currentEntries = [
        makeEntry({ id: 1, type: ArtifactType.GAME,  duration: 200 }),
        makeEntry({ id: 2, type: ArtifactType.MOVIE, duration: 100 })
    ];

    it('current.year equals the requested year', () => {
        const slides = buildRecapSlides(2024, currentEntries, [], []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.current.year).toBe(2024);
    });

    it('current.totalCount equals currentEntries.length', () => {
        const slides = buildRecapSlides(2024, currentEntries, [], []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.current.totalCount).toBe(2);
    });

    it('current.totalDuration equals sum of currentEntries durations', () => {
        const slides = buildRecapSlides(2024, currentEntries, [], []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.current.totalDuration).toBe(300);
    });

    it('prior is null when priorEntries is empty', () => {
        const slides = buildRecapSlides(2024, currentEntries, [], []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.prior).toBeNull();
    });

    it('prior.year equals year - 1', () => {
        const priorEntries = [makeEntry({ id: 10, type: ArtifactType.GAME, duration: 50 })];
        const slides = buildRecapSlides(2024, currentEntries, priorEntries, []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.prior?.year).toBe(2023);
    });

    it('prior.totalCount equals priorEntries.length', () => {
        const priorEntries = [
            makeEntry({ id: 10, type: ArtifactType.GAME }),
            makeEntry({ id: 11, type: ArtifactType.ANIME })
        ];
        const slides = buildRecapSlides(2024, currentEntries, priorEntries, []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.prior?.totalCount).toBe(2);
    });

    it('prior.totalDuration equals sum of priorEntries durations', () => {
        const priorEntries = [
            makeEntry({ id: 10, type: ArtifactType.GAME,  duration: 300 }),
            makeEntry({ id: 11, type: ArtifactType.ANIME, duration: 150 })
        ];
        const slides = buildRecapSlides(2024, currentEntries, priorEntries, []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.prior?.totalDuration).toBe(450);
    });
});

// ─── Contract: highest_rated slide ───────────────────────────────────────────

describe('highest_rated slide', () => {
    it('is omitted when no MAIN-type entry has a non-null score', () => {
        const entries = MAIN_TYPES.map((type, i) => makeEntry({ id: i, type, score: null }));
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'highest_rated')).toBe(false);
    });

    it('is omitted when scored entries exist but all are non-main types', () => {
        const entries = NON_MAIN_TYPES.map((type, i) => makeEntry({ id: i, type, score: 90 }));
        // Need at least one main type (unscored) to avoid empty state
        entries.push(makeEntry({ id: 99, type: ArtifactType.GAME, score: null }));
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'highest_rated')).toBe(false);
    });

    it('is included when at least one MAIN-type entry has a non-null score', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 85 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'highest_rated')).toBe(true);
    });

    it('topOverall[0].score equals the maximum score among MAIN-type entries', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 70, endDate: ts(2024, 0, 1) }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 95, endDate: ts(2024, 1, 1) }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, score: 80, endDate: ts(2024, 2, 1) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'highest_rated') as Extract<RecapSlide, { kind: 'highest_rated' }>;
        expect(slide.topOverall[0].score).toBe(95);
    });

    it('non-main type scores are ignored when finding highest', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,         score: 70 }),
            makeEntry({ id: 2, type: ArtifactType.ANIME_EPISODE, score: 99 }) // non-main, higher score
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'highest_rated') as Extract<RecapSlide, { kind: 'highest_rated' }>;
        expect(slide.topOverall[0].score).toBe(70); // only the GAME score counts
    });

    it('breaks ties by most recent endDate', () => {
        const entries = [
            makeEntry({ id: 1, title: 'Earlier', type: ArtifactType.GAME,  score: 90, endDate: ts(2024, 0, 1) }),
            makeEntry({ id: 2, title: 'Later',   type: ArtifactType.MOVIE, score: 90, endDate: ts(2024, 6, 1) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'highest_rated') as Extract<RecapSlide, { kind: 'highest_rated' }>;
        expect(slide.topOverall[0].title).toBe('Later');
    });
});

// ─── Contract: score_dist slide ───────────────────────────────────────────────

describe('score_dist slide', () => {
    it('is omitted alongside highest_rated (same guard)', () => {
        const entries = MAIN_TYPES.map((type, i) => makeEntry({ id: i, type, score: null }));
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'score_dist')).toBe(false);
    });

    it('is included when at least one MAIN-type entry has a score', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'score_dist')).toBe(true);
    });

    it('bands contain only entries with count > 0', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        for (const band of slide.bands) {
            expect(band.count).toBeGreaterThan(0);
        }
    });

    it('bands array is non-empty when scored entries exist', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        expect(slide.bands.length).toBeGreaterThan(0);
    });
});

// ─── Contract: longest slide ──────────────────────────────────────────────────

describe('longest slide', () => {
    it('items[0] corresponds to the MAIN-type entry with highest duration', () => {
        const entries = [
            makeEntry({ id: 1, title: 'Short', type: ArtifactType.GAME,  duration: 100 }),
            makeEntry({ id: 2, title: 'Long',  type: ArtifactType.MOVIE, duration: 9999 }),
            makeEntry({ id: 3, title: 'Mid',   type: ArtifactType.ANIME, duration: 500 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items[0].title).toBe('Long');
        expect(slide.items[0].duration).toBe(9999);
    });

    it('non-main type entries are excluded from longest selection', () => {
        const entries = [
            makeEntry({ id: 1, title: 'MainGame',    type: ArtifactType.GAME,         duration: 300 }),
            makeEntry({ id: 2, title: 'EpicEpisode', type: ArtifactType.ANIME_EPISODE, duration: 9999 }) // non-main
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items[0].title).toBe('MainGame');
    });

    it('type field in items[0] matches the longest entry type', () => {
        const entries = [makeEntry({ id: 1, title: 'Hero', type: ArtifactType.MANGA, duration: 500 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items[0].type).toBe(ArtifactType.MANGA);
    });
});

// ─── Contract: classics_vs_new slide ─────────────────────────────────────────

describe('classics_vs_new slide', () => {
    const year = 2024;

    /** A release date in the recap year — counts as "new" */
    const newRelease  = ts(year, 5, 1);           // June 1 2024, < SENTINEL
    /** A release date exactly 5 years before recap year — counts as "classic" (not recent) */
    const oldRelease  = ts(year - 5, 0, 1);       // Jan 1 2019
    /** A release date 2 years before recap year — counts as "recent" */
    const recentRelease = ts(year - 2, 0, 1);     // Jan 1 2022
    /** The sentinel value (TBD/unknown) — always counts as "classic" */
    const sentinel    = SENTINEL;

    it('counts an entry as new when releaseDate is in the recap year and < sentinel', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: newRelease })];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.newCount).toBe(1);
        expect(slide.recentCount).toBe(0);
        expect(slide.classicCount).toBe(0);
    });

    it('counts an entry as classic when releaseDate year is exactly (recap year - 5)', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: oldRelease })];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.classicCount).toBe(1);
        expect(slide.recentCount).toBe(0);
        expect(slide.newCount).toBe(0);
    });

    it('counts an entry as recent when releaseDate is 1-4 years before the recap year and < sentinel', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: recentRelease })];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.recentCount).toBe(1);
        expect(slide.newCount).toBe(0);
        expect(slide.classicCount).toBe(0);
    });

    it('counts the sentinel releaseDate as classic (not new), even if the year matches', () => {
        // The sentinel is ~2200, so year 2200 with sentinel should still be classic
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: sentinel })];
        const slides = buildRecapSlides(2200, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.classicCount).toBe(1);
        expect(slide.recentCount).toBe(0);
        expect(slide.newCount).toBe(0);
    });

    it('mixes new and classic entries correctly', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  releaseDate: newRelease }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, releaseDate: newRelease }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, releaseDate: oldRelease }),
            makeEntry({ id: 4, type: ArtifactType.MANGA, releaseDate: sentinel })
        ];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.newCount).toBe(2);
        expect(slide.recentCount).toBe(0);
        expect(slide.classicCount).toBe(2);
    });

    it('mixes all three tiers correctly', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  releaseDate: newRelease }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, releaseDate: recentRelease }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, releaseDate: oldRelease }),
            makeEntry({ id: 4, type: ArtifactType.MANGA, releaseDate: sentinel })
        ];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.newCount).toBe(1);
        expect(slide.recentCount).toBe(1);
        expect(slide.classicCount).toBe(2);
    });

    it('counts an entry with a future year release as classic (not new for this year)', () => {
        const futureRelease = ts(year + 1, 0, 1); // Jan 2025 when recapping 2024
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: futureRelease })];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.classicCount).toBe(1);
        expect(slide.recentCount).toBe(0);
        expect(slide.newCount).toBe(0);
    });
});

// ─── Contract: closing slide ──────────────────────────────────────────────────

describe('closing slide', () => {
    it('totalCount equals currentEntries.length', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'closing') as Extract<RecapSlide, { kind: 'closing' }>;
        expect(slide.totalCount).toBe(2);
    });

    it('year equals the requested year', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'closing') as Extract<RecapSlide, { kind: 'closing' }>;
        expect(slide.year).toBe(2024);
    });
});

// ─── Contract: no-data slides are silently omitted ───────────────────────────

describe('slide omission — no-data slides are silently omitted', () => {
    it('does not include highest_rated when there are no scored main-type entries', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: null })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'highest_rated')).toBe(false);
    });

    it('does not include score_dist when there are no scored main-type entries', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: null })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'score_dist')).toBe(false);
    });

    it('does not include top_genres when genres is empty', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'top_genres')).toBe(false);
    });

    it('every slide kind except top_by_type appears at most once', () => {
        const entries = MAIN_TYPES.map((type, i) =>
            makeEntry({ id: i + 1, type, score: 80 + i, endDate: ts(2024, i, 15) })
        );
        const slides = buildRecapSlides(2024, entries, [], [{ name: 'RPG', count: 3 }]);
        const nonTypeSlideKinds = slides.filter(s => s.kind !== 'top_by_type').map(s => s.kind);
        const uniqueKinds = new Set(nonTypeSlideKinds);
        expect(nonTypeSlideKinds.length).toBe(uniqueKinds.size);
    });
});

// ─── Contract: binge_vs_burn slide ────────────────────────────────────────────

describe('binge_vs_burn slide', () => {
    const DAY_MS  = 24 * 60 * 60 * 1000;
    const WEEK_MS = 7  * DAY_MS;

    it('is omitted when no MAIN-type entry has a non-null startDate', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, startDate: null })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'binge_vs_burn')).toBe(false);
    });

    it('is included when at least one MAIN-type entry has a non-null startDate', () => {
        const end = ts(2024, 0, 10);
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, startDate: end - DAY_MS, endDate: end })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'binge_vs_burn')).toBe(true);
    });

    it('is omitted when only non-MAIN entries have startDate', () => {
        const end = ts(2024, 0, 10);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, startDate: end - DAY_MS, endDate: end }),
            makeEntry({ id: 2, type: ArtifactType.GAME, startDate: null })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'binge_vs_burn')).toBe(false);
    });

    it('bingeCount counts entries completed in ≤ 7 days', () => {
        const end = ts(2024, 0, 10);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  startDate: end - WEEK_MS, endDate: end }),   // exactly 7 days = binge
            makeEntry({ id: 2, type: ArtifactType.MOVIE, startDate: end - WEEK_MS + 1000, endDate: end }) // < 7 days = binge
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'binge_vs_burn') as Extract<RecapSlide, { kind: 'binge_vs_burn' }>;
        expect(slide.bingeCount).toBe(2);
    });

    it('burnCount counts entries completed in > 30 days', () => {
        const MONTH_MS = 30 * DAY_MS;
        const end = ts(2024, 3, 1);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, startDate: end - MONTH_MS - 1000, endDate: end })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'binge_vs_burn') as Extract<RecapSlide, { kind: 'binge_vs_burn' }>;
        expect(slide.burnCount).toBe(1);
        expect(slide.bingeCount).toBe(0);
        expect(slide.midCount).toBe(0);
    });

    it('midCount counts entries between 1 week and 1 month', () => {
        const end = ts(2024, 2, 1);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, startDate: end - 15 * DAY_MS, endDate: end }) // 15 days = mid
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'binge_vs_burn') as Extract<RecapSlide, { kind: 'binge_vs_burn' }>;
        expect(slide.midCount).toBe(1);
        expect(slide.bingeCount).toBe(0);
        expect(slide.burnCount).toBe(0);
    });
});

// ─── Contract: rating_generosity slide ───────────────────────────────────────

describe('rating_generosity slide', () => {
    it('is omitted when no scored MAIN-type entries in currentEntries', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: null })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'rating_generosity')).toBe(false);
    });

    it('is omitted when scored entries exist but only in non-MAIN types', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.GAME, score: null })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'rating_generosity')).toBe(false);
    });

    it('is included when at least one scored MAIN-type entry exists', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'rating_generosity')).toBe(true);
    });

    it('currentAvg is rounded to 1 decimal', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 70 }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, score: 75 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'rating_generosity') as Extract<RecapSlide, { kind: 'rating_generosity' }>;
        expect(slide.currentAvg).toBe(75);
    });

    it('priorAvg is null when priorEntries has no scored MAIN-type entries', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'rating_generosity') as Extract<RecapSlide, { kind: 'rating_generosity' }>;
        expect(slide.priorAvg).toBeNull();
    });

    it('priorAvg reflects prior year scored MAIN-type entries', () => {
        const current = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const prior   = [makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 60 })];
        const slides = buildRecapSlides(2024, current, prior, []);
        const slide = slides.find(s => s.kind === 'rating_generosity') as Extract<RecapSlide, { kind: 'rating_generosity' }>;
        expect(slide.priorAvg).toBe(60);
    });
});

// ─── Contract: oldest_by_type slide ──────────────────────────────────────────

describe('oldest_by_type slide', () => {
    it('is omitted when no MAIN-type entry has a valid releaseDate', () => {
        const SENTINEL = 7258118400000;
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: SENTINEL })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'oldest_by_type')).toBe(false);
    });

    it('is omitted when releaseDate is 0', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: 0 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'oldest_by_type')).toBe(false);
    });

    it('is included when at least one MAIN-type entry has a valid releaseDate', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: ts(2010) })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'oldest_by_type')).toBe(true);
    });

    it('selects entry with largest endDate - releaseDate gap per type', () => {
        const end = ts(2024, 5, 1);
        const entries = [
            makeEntry({ id: 1, title: 'Older', type: ArtifactType.GAME, releaseDate: ts(2000), endDate: end }), // gap = 24 yrs
            makeEntry({ id: 2, title: 'Newer', type: ArtifactType.GAME, releaseDate: ts(2020), endDate: end })  // gap = 4 yrs
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'oldest_by_type') as Extract<RecapSlide, { kind: 'oldest_by_type' }>;
        const gameItem = slide.items.find(i => i.type === ArtifactType.GAME)!;
        expect(gameItem.title).toBe('Older');
    });

    it('items are sorted by gapYears descending', () => {
        const end = ts(2024, 6, 1);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  releaseDate: ts(2020), endDate: end }), // 4 yrs
            makeEntry({ id: 2, type: ArtifactType.MOVIE, releaseDate: ts(2000), endDate: end })   // 24 yrs
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'oldest_by_type') as Extract<RecapSlide, { kind: 'oldest_by_type' }>;
        expect(slide.items[0].type).toBe(ArtifactType.MOVIE);
        expect(slide.items[1].type).toBe(ArtifactType.GAME);
    });
});

// ─── Contract: avg_score_by_type slide ───────────────────────────────────────

describe('avg_score_by_type slide', () => {
    it('is omitted when fewer than 2 MAIN types have scored entries', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'avg_score_by_type')).toBe(false);
    });

    it('is omitted when no MAIN-type entries are scored', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: null }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: null })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'avg_score_by_type')).toBe(false);
    });

    it('is included when at least 2 MAIN types have scored entries', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 70 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'avg_score_by_type')).toBe(true);
    });

    it('scores are sorted by avg descending', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 60 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 90 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'avg_score_by_type') as Extract<RecapSlide, { kind: 'avg_score_by_type' }>;
        expect(slide.scores[0].type).toBe(ArtifactType.MOVIE);
        expect(slide.scores[1].type).toBe(ArtifactType.GAME);
    });

    it('avg is the mean score for that type rounded to 1 decimal', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, score: 70 }),
            makeEntry({ id: 2, type: ArtifactType.GAME, score: 80 }),
            makeEntry({ id: 3, type: ArtifactType.MOVIE, score: 90 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'avg_score_by_type') as Extract<RecapSlide, { kind: 'avg_score_by_type' }>;
        const gameScore = slide.scores.find(s => s.type === ArtifactType.GAME)!;
        expect(gameScore.avg).toBe(75);
        expect(gameScore.count).toBe(2);
    });
});

// ─── Contract: best_week slide ────────────────────────────────────────────────

describe('best_week slide', () => {
    it('is omitted when best week has fewer than 2 completions', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, endDate: ts(2024, 0, 1) })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'best_week')).toBe(false);
    });

    it('is included when at least 2 entries fall within a 7-day window', () => {
        const base = ts(2024, 0, 1);
        const DAY_MS = 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: base + 2 * DAY_MS })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'best_week')).toBe(true);
    });

    it('count equals the number of entries in the best 7-day window', () => {
        const base = ts(2024, 2, 1);
        const DAY_MS = 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: base + DAY_MS }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, endDate: base + 2 * DAY_MS }),
            makeEntry({ id: 4, type: ArtifactType.MANGA, endDate: base + 30 * DAY_MS }) // outside window
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'best_week') as Extract<RecapSlide, { kind: 'best_week' }>;
        expect(slide.count).toBe(3);
    });

    it('weekStart is the endDate of the first entry in the best window', () => {
        const base = ts(2024, 3, 5);
        const DAY_MS = 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: base + DAY_MS }),
            makeEntry({ id: 3, type: ArtifactType.TVSHOW, endDate: base + 60 * DAY_MS }) // isolated
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'best_week') as Extract<RecapSlide, { kind: 'best_week' }>;
        expect(slide.weekStart).toBe(base);
    });

    it('counts ALL entry types (not just main) toward the best week', () => {
        const base = ts(2024, 4, 1);
        const DAY_MS = 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE,  endDate: base }),           // non-main
            makeEntry({ id: 2, type: ArtifactType.MANGA_CHAPTER,  endDate: base + DAY_MS }),  // non-main
            makeEntry({ id: 3, type: ArtifactType.TVSHOW_EPISODE, endDate: base + 2 * DAY_MS }) // non-main
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'best_week') as Extract<RecapSlide, { kind: 'best_week' }>;
        expect(slide.count).toBe(3);
    });

    it('7-day window is exclusive on the right ([t, t+7days))', () => {
        const base = ts(2024, 5, 1);
        const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: base + WEEK_MS }) // at exactly 7 days = excluded
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'best_week')).toBe(false);
    });
});

// ─── Contract: new slides follow classics_vs_new, closing is last ─────────────

describe('new slide ordering after classics_vs_new', () => {
    it('closing is always last', () => {
        const entries = MAIN_TYPES.map((type, i) =>
            makeEntry({ id: i + 1, type, score: 80 + i, endDate: ts(2024, i, 15) })
        );
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides[slides.length - 1].kind).toBe('closing');
    });

    it('binge_vs_burn appears after classics_vs_new when data is present', () => {
        const base = ts(2024, 0, 10);
        const DAY_MS = 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  startDate: base - 2 * DAY_MS, endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, startDate: base - 15 * DAY_MS, endDate: base + DAY_MS })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const cvnIdx = kinds.indexOf('classics_vs_new');
        const bvbIdx = kinds.indexOf('binge_vs_burn');
        expect(bvbIdx).toBeGreaterThan(cvnIdx);
    });

    it('rating_generosity appears after classics_vs_new when data is present', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const cvnIdx = kinds.indexOf('classics_vs_new');
        const rgIdx = kinds.indexOf('rating_generosity');
        expect(rgIdx).toBeGreaterThan(cvnIdx);
    });

    it('oldest_by_type appears after classics_vs_new when data is present', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: ts(2000) })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const cvnIdx = kinds.indexOf('classics_vs_new');
        const otIdx = kinds.indexOf('oldest_by_type');
        expect(otIdx).toBeGreaterThan(cvnIdx);
    });

    it('avg_score_by_type appears after classics_vs_new when data is present', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 70 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const cvnIdx = kinds.indexOf('classics_vs_new');
        const astIdx = kinds.indexOf('avg_score_by_type');
        expect(astIdx).toBeGreaterThan(cvnIdx);
    });

    it('best_week appears after classics_vs_new when data is present', () => {
        const base = ts(2024, 0, 1);
        const DAY_MS = 24 * 60 * 60 * 1000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: base + DAY_MS })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const kinds = slides.map(s => s.kind);
        const cvnIdx = kinds.indexOf('classics_vs_new');
        const bwIdx = kinds.indexOf('best_week');
        expect(bwIdx).toBeGreaterThan(cvnIdx);
    });
});
