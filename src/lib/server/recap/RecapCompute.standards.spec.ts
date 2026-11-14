/**
 * Standards tests for buildRecapSlides — implementation-specific edge cases
 * not covered by the TDD contract tests.
 *
 * These tests were written by reading the implementation in RecapCompute.ts
 * to exercise specific branches, boundary conditions, and computed values.
 */

import { describe, it, expect } from 'vitest';
import { buildRecapSlides } from './RecapCompute';
import { ArtifactType } from '#lib/model/Artifact';
import type { RecapEntry, RecapSlide } from '#lib/model/recap/RecapTypes';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Unix ms timestamp for a given year/month(0-based)/day/hour (local time, same as implementation) */
const ts = (year: number, month = 0, day = 1, hour = 0, min = 0, sec = 0, ms = 0): number =>
    new Date(year, month, day, hour, min, sec, ms).getTime();

/** The sentinel value the implementation uses to mean "TBD / unknown release date" */
const RELEASE_DATE_SENTINEL = 7258118400000;

function makeEntry(overrides: Partial<RecapEntry> & { type: ArtifactType }): RecapEntry {
    return {
        id: 1,
        title: 'Test Entry',
        duration: 3600,
        releaseDate: ts(2010),
        score: null,
        endDate: ts(2024, 5, 15),
        startDate: null,
        ...overrides
    };
}

// ─── Group 1: Only non-main type entries in currentEntries ────────────────────
//
// The implementation guards by_type and longest behind `mainEntries.length > 0`
// and `counts.length > 0`. When every entry is a non-MAIN type those slides
// must be omitted, even though currentEntries is non-empty.

describe('only non-main type entries present', () => {
    const nonMainEntries: RecapEntry[] = [
        makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, endDate: ts(2024, 2, 1) }),
        makeEntry({ id: 2, type: ArtifactType.TVSHOW_EPISODE, endDate: ts(2024, 4, 1) }),
        makeEntry({ id: 3, type: ArtifactType.MANGA_CHAPTER, endDate: ts(2024, 8, 1) })
    ];

    it('does NOT enter empty state (has grand_total)', () => {
        const slides = buildRecapSlides(2024, nonMainEntries, [], []);
        expect(slides.some(s => s.kind === 'empty')).toBe(false);
        expect(slides.some(s => s.kind === 'grand_total')).toBe(true);
    });

    it('omits by_type slide', () => {
        const slides = buildRecapSlides(2024, nonMainEntries, [], []);
        expect(slides.some(s => s.kind === 'by_type')).toBe(false);
    });

    it('omits longest slide', () => {
        const slides = buildRecapSlides(2024, nonMainEntries, [], []);
        expect(slides.some(s => s.kind === 'longest')).toBe(false);
    });

    it('omits highest_rated slide (no scored main entries)', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, score: 99 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'highest_rated')).toBe(false);
    });

    it('still counts non-main entries in monthly bars', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, endDate: ts(2024, 3, 10) }),
            makeEntry({ id: 2, type: ArtifactType.MANGA_CHAPTER, endDate: ts(2024, 3, 20) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const monthly = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        expect(monthly.bars[3].value).toBe(2); // April (index 3)
    });

    it('still counts non-main entries in grand_total', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, duration: 500 }),
            makeEntry({ id: 2, type: ArtifactType.MANGA_CHAPTER, duration: 300 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const grand = slides.find(s => s.kind === 'grand_total') as Extract<RecapSlide, { kind: 'grand_total' }>;
        expect(grand.totalCount).toBe(2);
        expect(grand.totalDuration).toBe(800);
    });
});

// ─── Group 2: Entries with duration = 0 ──────────────────────────────────────
//
// The implementation uses reduce / sort for both totalDuration and longest, so 0
// values must be handled without crashing or producing NaN.

describe('entries with duration = 0', () => {
    it('grand_total.totalDuration is 0 when all durations are 0', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, duration: 0 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, duration: 0 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const grand = slides.find(s => s.kind === 'grand_total') as Extract<RecapSlide, { kind: 'grand_total' }>;
        expect(grand.totalDuration).toBe(0);
    });

    it('longest.items[0].duration is 0 when all main entries have duration 0', () => {
        const entries = [
            makeEntry({ id: 1, title: 'Alpha', type: ArtifactType.GAME, duration: 0 }),
            makeEntry({ id: 2, title: 'Beta', type: ArtifactType.MOVIE, duration: 0 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items[0].duration).toBe(0);
    });
});

// ─── Group 3: Score band exact boundary values ────────────────────────────────
//
// The implementation uses bands of 5 points each. Testing boundary values
// ensures fence-post conditions are correct.

describe('score_dist band boundary values', () => {
    function getBands(scores: number[]) {
        const entries = scores.map((score, i) =>
            makeEntry({ id: i + 1, type: ArtifactType.GAME, score, endDate: ts(2024, i % 12, 1) })
        );
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        return Object.fromEntries(slide.bands.map(b => [b.label, b.count]));
    }

    it('score = 96 falls in the 96–100 band', () => {
        const bands = getBands([96]);
        expect(bands['96–100']).toBe(1);
    });

    it('score = 100 falls in the 96–100 band', () => {
        const bands = getBands([100]);
        expect(bands['96–100']).toBe(1);
    });

    it('score = 95 falls in the 91–95 band (not 96–100)', () => {
        const bands = getBands([95]);
        expect(bands['91–95']).toBe(1);
        expect(bands['96–100']).toBeUndefined();
    });

    it('score = 91 falls in the 91–95 band', () => {
        const bands = getBands([91]);
        expect(bands['91–95']).toBe(1);
    });

    it('score = 90 falls in the 86–90 band', () => {
        const bands = getBands([90]);
        expect(bands['86–90']).toBe(1);
    });

    it('score = 86 falls in the 86–90 band', () => {
        const bands = getBands([86]);
        expect(bands['86–90']).toBe(1);
    });

    it('score = 85 falls in the 81–85 band (not 86–90)', () => {
        const bands = getBands([85]);
        expect(bands['81–85']).toBe(1);
        expect(bands['86–90']).toBeUndefined();
    });

    it('score = 50 falls in the 46–50 band', () => {
        const bands = getBands([50]);
        expect(bands['46–50']).toBe(1);
    });

    it('score = 46 falls in the 46–50 band', () => {
        const bands = getBands([46]);
        expect(bands['46–50']).toBe(1);
    });

    it('score = 45 falls in the 41–45 band (not 46–50)', () => {
        const bands = getBands([45]);
        expect(bands['41–45']).toBe(1);
        expect(bands['46–50']).toBeUndefined();
    });

    it('score = 1 falls in the 1–5 band', () => {
        const bands = getBands([1]);
        expect(bands['1–5']).toBe(1);
    });

    it('score = 5 falls in the 1–5 band', () => {
        const bands = getBands([5]);
        expect(bands['1–5']).toBe(1);
    });

    it('score = 0 falls in the 0 band', () => {
        const bands = getBands([0]);
        expect(bands['0']).toBe(1);
    });

    it('four different bands can be populated simultaneously', () => {
        // One entry per distinct band: 95, 80, 60, 40
        const bands = getBands([95, 80, 60, 40]);
        expect(bands['91–95']).toBe(1);
        expect(bands['76–80']).toBe(1);
        expect(bands['56–60']).toBe(1);
        expect(bands['36–40']).toBe(1);
    });
});

// ─── Group 4: score_dist Unscored band ───────────────────────────────────────
//
// The Unscored band counts mainEntries where score === null.

describe('score_dist Unscored band', () => {
    it('Unscored band appears when some main entries have null score', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: null })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        const unscoredBand = slide.bands.find(b => b.label === 'Unscored');
        expect(unscoredBand).toBeDefined();
        expect(unscoredBand!.count).toBe(1);
    });

    it('Unscored band is omitted when all main entries are scored', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 60 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        const unscoredBand = slide.bands.find(b => b.label === 'Unscored');
        expect(unscoredBand).toBeUndefined();
    });

    it('Unscored band count equals the number of null-scored main entries', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 75 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: null }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, score: null }),
            makeEntry({ id: 4, type: ArtifactType.MANGA, score: null })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        const unscoredBand = slide.bands.find(b => b.label === 'Unscored');
        expect(unscoredBand!.count).toBe(3);
    });
});

// ─── Group 5: by_type totalDuration aggregation per type ─────────────────────

describe('by_type totalDuration per TypeCount', () => {
    it('totalDuration for a type is the sum of durations of entries with that type', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, duration: 300 }),
            makeEntry({ id: 2, type: ArtifactType.GAME, duration: 700 }),
            makeEntry({ id: 3, type: ArtifactType.MOVIE, duration: 100 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        const gameCount = slide.counts.find(tc => tc.type === ArtifactType.GAME)!;
        const movieCount = slide.counts.find(tc => tc.type === ArtifactType.MOVIE)!;
        expect(gameCount.totalDuration).toBe(1000);
        expect(movieCount.totalDuration).toBe(100);
    });

    it('count field in TypeCount matches number of entries for that type', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME }),
            makeEntry({ id: 2, type: ArtifactType.ANIME }),
            makeEntry({ id: 3, type: ArtifactType.ANIME }),
            makeEntry({ id: 4, type: ArtifactType.MANGA })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        const animeCount = slide.counts.find(tc => tc.type === ArtifactType.ANIME)!;
        const mangaCount = slide.counts.find(tc => tc.type === ArtifactType.MANGA)!;
        expect(animeCount.count).toBe(3);
        expect(mangaCount.count).toBe(1);
    });
});

// ─── Group 6: monthly bars at exact boundary timestamps ──────────────────────

describe('monthly bars at exact month boundary timestamps', () => {
    it('entry at the first millisecond of a month is counted in that month', () => {
        const janStart = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, endDate: janStart }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: ts(2024, 6, 1) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const monthly = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        expect(monthly.bars[0].value).toBe(1); // January
    });

    it('entry at the last millisecond of a month is counted in that month', () => {
        const janEnd = new Date(2024, 1, 0, 23, 59, 59, 999).getTime();
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, endDate: janEnd }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: ts(2024, 6, 1) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const monthly = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        expect(monthly.bars[0].value).toBe(1); // January
    });

    it('December boundary: entry on Dec 31 at 23:59:59.999 is in December (month 11)', () => {
        const decEnd = new Date(2024, 12, 0, 23, 59, 59, 999).getTime();
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, endDate: decEnd }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: ts(2024, 0, 1) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const monthly = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        expect(monthly.bars[11].value).toBe(1); // December
    });
});

// ─── Group 7: monthly bars labels ────────────────────────────────────────────

describe('monthly bars labels', () => {
    it('has the correct 12 month abbreviation labels in order', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const monthly = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        const labels = monthly.bars.map(b => b.label);
        expect(labels).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    });

    it('all bars have showLabel = true', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const monthly = slides.find(s => s.kind === 'monthly') as Extract<RecapSlide, { kind: 'monthly' }>;
        for (const bar of monthly.bars) {
            expect(bar.showLabel).toBe(true);
        }
    });
});

// ─── Group 8: longest — top 5 items by duration ──────────────────────────────
//
// The new implementation sorts by duration desc and returns up to 5 items.
// When durations are equal, input order is preserved (stable sort).

describe('longest slide — top 5 items', () => {
    it('returns up to 5 items sorted by duration descending', () => {
        const entries = [
            makeEntry({ id: 1, title: 'A', type: ArtifactType.GAME,  duration: 100 }),
            makeEntry({ id: 2, title: 'B', type: ArtifactType.MOVIE, duration: 500 }),
            makeEntry({ id: 3, title: 'C', type: ArtifactType.ANIME, duration: 300 }),
            makeEntry({ id: 4, title: 'D', type: ArtifactType.MANGA, duration: 900 }),
            makeEntry({ id: 5, title: 'E', type: ArtifactType.TVSHOW, duration: 700 }),
            makeEntry({ id: 6, title: 'F', type: ArtifactType.GAME,  duration: 200 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items).toHaveLength(5);
        expect(slide.items[0].title).toBe('D'); // 900
        expect(slide.items[1].title).toBe('E'); // 700
        expect(slide.items[2].title).toBe('B'); // 500
        expect(slide.items[3].title).toBe('C'); // 300
        expect(slide.items[4].title).toBe('F'); // 200
    });

    it('returns fewer than 5 items when fewer than 5 main entries exist', () => {
        const entries = [
            makeEntry({ id: 1, title: 'Only', type: ArtifactType.GAME, duration: 500 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items).toHaveLength(1);
    });

    it('first entry in input order wins when durations are tied (stable sort)', () => {
        const entries = [
            makeEntry({ id: 1, title: 'Zeta',  type: ArtifactType.GAME,  duration: 5000 }),
            makeEntry({ id: 2, title: 'Alpha', type: ArtifactType.MOVIE, duration: 5000 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'longest') as Extract<RecapSlide, { kind: 'longest' }>;
        expect(slide.items[0].title).toBe('Zeta');
    });
});

// ─── Group 9: score = 0 is a valid score (not treated as null) ───────────────

describe('score = 0 is valid and not treated as null', () => {
    it('entry with score=0 is included in highest_rated computation', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 0 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        expect(slides.some(s => s.kind === 'highest_rated')).toBe(true);
    });

    it('highest_rated topOverall[0].score is 0 when that is the max', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 0 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'highest_rated') as Extract<RecapSlide, { kind: 'highest_rated' }>;
        expect(slide.topOverall[0].score).toBe(0);
    });

    it('score=0 is placed in the 0 band of score_dist', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 0 })];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'score_dist') as Extract<RecapSlide, { kind: 'score_dist' }>;
        const zeroBand = slide.bands.find(b => b.label === '0');
        expect(zeroBand).toBeDefined();
        expect(zeroBand!.count).toBe(1);
    });
});

// ─── Group 10: classics_vs_new counts all entry types (not just main) ─────────

describe('classics_vs_new counts non-main type entries', () => {
    const year = 2024;

    it('new non-main entries count as new', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE, releaseDate: ts(year, 3, 1) }), // new
            makeEntry({ id: 2, type: ArtifactType.TVSHOW_EPISODE, releaseDate: ts(year, 5, 1) }) // new
        ];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.newCount).toBe(2);
        expect(slide.recentCount).toBe(0);
        expect(slide.classicCount).toBe(0);
    });

    it('recent non-main entries count as recent', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.MANGA_CHAPTER, releaseDate: ts(year - 2, 0, 1) }), // recent
            makeEntry({ id: 2, type: ArtifactType.MANGA_VOLUME, releaseDate: ts(year - 4, 6, 1) })    // recent
        ];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.recentCount).toBe(2);
        expect(slide.newCount).toBe(0);
        expect(slide.classicCount).toBe(0);
    });

    it('classic non-main entries count as classic', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.MANGA_CHAPTER, releaseDate: ts(2015, 0, 1) }),
            makeEntry({ id: 2, type: ArtifactType.MANGA_VOLUME, releaseDate: ts(2018, 6, 1) })
        ];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.classicCount).toBe(2);
        expect(slide.recentCount).toBe(0);
        expect(slide.newCount).toBe(0);
    });

    it('sentinel release date in a non-main entry is treated as classic', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.MANGA_CHAPTER, releaseDate: RELEASE_DATE_SENTINEL })
        ];
        const slides = buildRecapSlides(year, entries, [], []);
        const slide = slides.find(s => s.kind === 'classics_vs_new') as Extract<RecapSlide, { kind: 'classics_vs_new' }>;
        expect(slide.classicCount).toBe(1);
        expect(slide.recentCount).toBe(0);
        expect(slide.newCount).toBe(0);
    });
});

// ─── Group 11: year_comparison prior.year computation ─────────────────────────

describe('year_comparison prior.year is always year - 1', () => {
    it('prior.year = 2000 when year = 2001', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const priorEntries = [makeEntry({ id: 10, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2001, entries, priorEntries, []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.prior?.year).toBe(2000);
    });

    it('prior.year = 1999 when year = 2000', () => {
        const entries = [makeEntry({ id: 1, type: ArtifactType.GAME })];
        const priorEntries = [makeEntry({ id: 10, type: ArtifactType.GAME })];
        const slides = buildRecapSlides(2000, entries, priorEntries, []);
        const slide = slides.find(s => s.kind === 'year_comparison') as Extract<RecapSlide, { kind: 'year_comparison' }>;
        expect(slide.prior?.year).toBe(1999);
    });
});

// ─── Group 12: highest_rated tie-breaking when same score AND same endDate ────

describe('highest_rated tie-breaking when score and endDate are identical', () => {
    it('first entry in input order appears first in topOverall when score and endDate are both tied', () => {
        const sharedEndDate = ts(2024, 6, 15);
        const entries = [
            makeEntry({ id: 1, title: 'First Entry',  type: ArtifactType.GAME,  score: 90, endDate: sharedEndDate }),
            makeEntry({ id: 2, title: 'Second Entry', type: ArtifactType.MOVIE, score: 90, endDate: sharedEndDate })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'highest_rated') as Extract<RecapSlide, { kind: 'highest_rated' }>;
        expect(slide.topOverall[0].title).toBe('First Entry');
    });
});

// ─── Group 13: grand_total with mixed durations including 0 ──────────────────

describe('grand_total with mixed durations including 0', () => {
    it('totalDuration sums correctly with a mix of 0 and non-zero durations', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, duration: 0 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, duration: 500 }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, duration: 0 }),
            makeEntry({ id: 4, type: ArtifactType.MANGA, duration: 250 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const grand = slides.find(s => s.kind === 'grand_total') as Extract<RecapSlide, { kind: 'grand_total' }>;
        expect(grand.totalDuration).toBe(750);
    });
});

// ─── Group 14: by_type mediaType selection ────────────────────────────────────

describe('by_type mediaType selection', () => {
    it('mediaType is the type with strictly more entries when counts differ', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME }),
            makeEntry({ id: 2, type: ArtifactType.GAME }),
            makeEntry({ id: 3, type: ArtifactType.GAME }),
            makeEntry({ id: 4, type: ArtifactType.MOVIE }),
            makeEntry({ id: 5, type: ArtifactType.MOVIE })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        expect(slide.mediaType).toBe(ArtifactType.GAME);
    });

    it('by_type counts contain only types with count > 0 (zero-count types are filtered)', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'by_type') as Extract<RecapSlide, { kind: 'by_type' }>;
        const presentTypes = slide.counts.map(tc => tc.type);
        expect(presentTypes).toContain(ArtifactType.GAME);
        expect(presentTypes).toContain(ArtifactType.MOVIE);
        expect(presentTypes).not.toContain(ArtifactType.TVSHOW);
        expect(presentTypes).not.toContain(ArtifactType.ANIME);
        expect(presentTypes).not.toContain(ArtifactType.MANGA);
        expect(slide.counts).toHaveLength(2);
    });
});

// ─── Group 15: binge_vs_burn boundary values ──────────────────────────────────
//
// The implementation uses WEEK_MS = 7*24*60*60*1000 as the binge boundary
// and MONTH_MS = 30*24*60*60*1000 as the burn boundary.

describe('binge_vs_burn exact boundary values', () => {
    const DAY_MS  = 24 * 60 * 60 * 1000;
    const WEEK_MS = 7  * DAY_MS;
    const MONTH_MS = 30 * DAY_MS;

    function getBVB(diffs: number[]) {
        const base = ts(2024, 0, 31);
        const entries = diffs.map((d, i) =>
            makeEntry({ id: i + 1, type: ArtifactType.GAME, startDate: base - d, endDate: base })
        );
        const slides = buildRecapSlides(2024, entries, [], []);
        return slides.find(s => s.kind === 'binge_vs_burn') as Extract<RecapSlide, { kind: 'binge_vs_burn' }>;
    }

    it('exactly 7 days elapsed is binge (≤ WEEK_MS)', () => {
        const slide = getBVB([WEEK_MS]);
        expect(slide.bingeCount).toBe(1);
        expect(slide.midCount).toBe(0);
        expect(slide.burnCount).toBe(0);
    });

    it('one ms more than 7 days is mid (> WEEK_MS)', () => {
        const slide = getBVB([WEEK_MS + 1]);
        expect(slide.midCount).toBe(1);
        expect(slide.bingeCount).toBe(0);
    });

    it('exactly 30 days is still mid (not burn, requires > MONTH_MS)', () => {
        const slide = getBVB([MONTH_MS]);
        expect(slide.midCount).toBe(1);
        expect(slide.burnCount).toBe(0);
    });

    it('one ms more than 30 days is slow burn (> MONTH_MS)', () => {
        const slide = getBVB([MONTH_MS + 1]);
        expect(slide.burnCount).toBe(1);
        expect(slide.midCount).toBe(0);
    });

    it('counts across all three categories are consistent (sum = mainWithStart.length)', () => {
        const base = ts(2024, 6, 15);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  startDate: base - 3 * DAY_MS,   endDate: base }), // binge
            makeEntry({ id: 2, type: ArtifactType.MOVIE, startDate: base - 15 * DAY_MS,  endDate: base }), // mid
            makeEntry({ id: 3, type: ArtifactType.ANIME, startDate: base - 45 * DAY_MS,  endDate: base }), // burn
            makeEntry({ id: 4, type: ArtifactType.MANGA, startDate: base - DAY_MS,       endDate: base })  // binge
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'binge_vs_burn') as Extract<RecapSlide, { kind: 'binge_vs_burn' }>;
        expect(slide.bingeCount + slide.midCount + slide.burnCount).toBe(4);
        expect(slide.bingeCount).toBe(2);
        expect(slide.midCount).toBe(1);
        expect(slide.burnCount).toBe(1);
    });
});

// ─── Group 16: rating_generosity average computation ─────────────────────────

describe('rating_generosity average computation', () => {
    it('currentAvg rounds to 1 decimal correctly (not integer division)', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.MOVIE, score: 81 }),
            makeEntry({ id: 3, type: ArtifactType.ANIME, score: 82 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'rating_generosity') as Extract<RecapSlide, { kind: 'rating_generosity' }>;
        // (80 + 81 + 82) / 3 = 81.0
        expect(slide.currentAvg).toBe(81);
    });

    it('non-main type entries are excluded from currentAvg', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,         score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.ANIME_EPISODE, score: 20 }) // excluded from average
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'rating_generosity') as Extract<RecapSlide, { kind: 'rating_generosity' }>;
        expect(slide.currentAvg).toBe(80);
    });

    it('priorAvg excludes non-main type prior entries', () => {
        const current = [makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 })];
        const prior   = [
            makeEntry({ id: 10, type: ArtifactType.MOVIE,        score: 60 }),
            makeEntry({ id: 11, type: ArtifactType.ANIME_EPISODE, score: 20 }) // excluded
        ];
        const slides = buildRecapSlides(2024, current, prior, []);
        const slide = slides.find(s => s.kind === 'rating_generosity') as Extract<RecapSlide, { kind: 'rating_generosity' }>;
        expect(slide.priorAvg).toBe(60);
    });
});

// ─── Group 17: oldest_by_type gapYears calculation ───────────────────────────

describe('oldest_by_type gapYears calculation', () => {
    it('gapYears is finishedYear minus releaseYear', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, releaseDate: ts(1999), endDate: ts(2024, 6, 1) })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'oldest_by_type') as Extract<RecapSlide, { kind: 'oldest_by_type' }>;
        expect(slide.items[0].gapYears).toBe(25);
        expect(slide.items[0].releaseYear).toBe(1999);
        expect(slide.items[0].finishedYear).toBe(2024);
    });

    it('a type with only sentinel or zero releaseDates is excluded from items', () => {
        const SENTINEL = 7258118400000;
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  releaseDate: ts(2000) }), // valid
            makeEntry({ id: 2, type: ArtifactType.MOVIE, releaseDate: SENTINEL }),  // invalid
            makeEntry({ id: 3, type: ArtifactType.ANIME, releaseDate: 0 })          // invalid
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'oldest_by_type') as Extract<RecapSlide, { kind: 'oldest_by_type' }>;
        expect(slide.items).toHaveLength(1);
        expect(slide.items[0].type).toBe(ArtifactType.GAME);
    });
});

// ─── Group 18: avg_score_by_type count field ─────────────────────────────────

describe('avg_score_by_type count field', () => {
    it('count equals the number of scored entries for that type', () => {
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME, score: 80 }),
            makeEntry({ id: 2, type: ArtifactType.GAME, score: 90 }),
            makeEntry({ id: 3, type: ArtifactType.GAME, score: null }), // not counted
            makeEntry({ id: 4, type: ArtifactType.MOVIE, score: 70 })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'avg_score_by_type') as Extract<RecapSlide, { kind: 'avg_score_by_type' }>;
        const gameScore = slide.scores.find(s => s.type === ArtifactType.GAME)!;
        expect(gameScore.count).toBe(2);
    });
});

// ─── Group 19: best_week rolling window computation ───────────────────────────

describe('best_week rolling window computation', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;

    it('picks the window that contains the most entries, not just the first', () => {
        const base = ts(2024, 0, 1);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.GAME,  endDate: base }),                      // window A: 1 entry
            makeEntry({ id: 2, type: ArtifactType.MOVIE, endDate: base + 20 * DAY_MS }),        // window B start
            makeEntry({ id: 3, type: ArtifactType.ANIME, endDate: base + 21 * DAY_MS }),        // window B
            makeEntry({ id: 4, type: ArtifactType.MANGA, endDate: base + 22 * DAY_MS })         // window B
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'best_week') as Extract<RecapSlide, { kind: 'best_week' }>;
        expect(slide.count).toBe(3);
        expect(slide.weekStart).toBe(base + 20 * DAY_MS);
    });

    it('uses ALL entry types, not just main types', () => {
        const base = ts(2024, 3, 1);
        const entries = [
            makeEntry({ id: 1, type: ArtifactType.ANIME_EPISODE,  endDate: base }),
            makeEntry({ id: 2, type: ArtifactType.TVSHOW_EPISODE, endDate: base + DAY_MS }),
            makeEntry({ id: 3, type: ArtifactType.MANGA_CHAPTER,  endDate: base + 2 * DAY_MS })
        ];
        const slides = buildRecapSlides(2024, entries, [], []);
        const slide = slides.find(s => s.kind === 'best_week') as Extract<RecapSlide, { kind: 'best_week' }>;
        expect(slide.count).toBe(3);
    });
});
