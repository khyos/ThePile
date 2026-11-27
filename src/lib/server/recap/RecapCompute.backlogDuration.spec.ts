/**
 * TDD contract tests for the new `backlog_duration_changes` recap slide
 * produced by buildRecapSlides.
 *
 * Validates the PUBLIC CONTRACT only (slide presence, position, shape, and the
 * net = addedDuration - removedDuration computation) WITHOUT reading the
 * implementation of RecapCompute.ts.
 */

import { describe, it, expect } from 'vitest';
import { buildRecapSlides } from './RecapCompute';
import { ArtifactType } from '#lib/model/Artifact';
import type { RecapEntry, RecapSlide, BacklogActivityCount } from '#lib/model/recap/RecapTypes';

// Fixed MAIN_ARTIFACT_TYPES order mandated by the contract.
const MAIN_TYPES: ArtifactType[] = [
    ArtifactType.GAME,
    ArtifactType.MOVIE,
    ArtifactType.TVSHOW,
    ArtifactType.ANIME,
    ArtifactType.MANGA
];

const ts = (year: number, month = 0, day = 1): number => new Date(year, month, day).getTime();

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

// Partial backlog activity — GAME and MOVIE present, other three types absent.
const activity: BacklogActivityCount[] = [
    { type: ArtifactType.GAME, added: 3, removed: 1, addedDuration: 10000, removedDuration: 4000 },
    { type: ArtifactType.MOVIE, added: 1, removed: 2, addedDuration: 5000, removedDuration: 9000 }
];

const getDurationSlide = (slides: RecapSlide[]) =>
    slides.find(s => s.kind === 'backlog_duration_changes') as Extract<RecapSlide, { kind: 'backlog_duration_changes' }>;

// ── Contract: presence & position (immediately after backlog_changes) ─────────

describe('backlog_duration_changes slide — presence & position', () => {
    it('appears IMMEDIATELY AFTER backlog_changes when currentEntries is empty', () => {
        const slides = buildRecapSlides(2024, [], [], [], activity);
        const kinds = slides.map(s => s.kind);
        const bcIdx = kinds.indexOf('backlog_changes');
        expect(bcIdx).toBeGreaterThanOrEqual(0);
        expect(kinds[bcIdx + 1]).toBe('backlog_duration_changes');
    });

    it('appears IMMEDIATELY AFTER backlog_changes when currentEntries is non-empty', () => {
        const entries = MAIN_TYPES.map((type, i) => makeEntry({ id: i + 1, type, score: 80 + i }));
        const slides = buildRecapSlides(2024, entries, [], [], activity);
        const kinds = slides.map(s => s.kind);
        const bcIdx = kinds.indexOf('backlog_changes');
        expect(bcIdx).toBeGreaterThanOrEqual(0);
        expect(kinds[bcIdx + 1]).toBe('backlog_duration_changes');
    });

    it('is present even when backlogActivity is omitted (both backlog slides exist)', () => {
        const slides = buildRecapSlides(2024, [], [], []);
        const kinds = slides.map(s => s.kind);
        expect(kinds).toContain('backlog_changes');
        expect(kinds).toContain('backlog_duration_changes');
        const bcIdx = kinds.indexOf('backlog_changes');
        expect(kinds[bcIdx + 1]).toBe('backlog_duration_changes');
    });

    it('appears exactly once', () => {
        const slides = buildRecapSlides(2024, [], [], [], activity);
        expect(slides.filter(s => s.kind === 'backlog_duration_changes')).toHaveLength(1);
    });
});

// ── Contract: counts shape & ordering ─────────────────────────────────────────

describe('backlog_duration_changes.counts — shape, order & net', () => {
    it('has one entry per MAIN type in the fixed order', () => {
        const slide = getDurationSlide(buildRecapSlides(2024, [], [], [], activity));
        expect(slide.counts.map(c => c.type)).toEqual(MAIN_TYPES);
    });

    it('carries addedDuration/removedDuration from the matching backlogActivity entry with net = added - removed', () => {
        const slide = getDurationSlide(buildRecapSlides(2024, [], [], [], activity));
        expect(slide.counts.find(c => c.type === ArtifactType.GAME)).toEqual({
            type: ArtifactType.GAME, addedDuration: 10000, removedDuration: 4000, net: 6000
        });
    });

    it('net can be negative when removedDuration exceeds addedDuration', () => {
        const slide = getDurationSlide(buildRecapSlides(2024, [], [], [], activity));
        expect(slide.counts.find(c => c.type === ArtifactType.MOVIE)).toEqual({
            type: ArtifactType.MOVIE, addedDuration: 5000, removedDuration: 9000, net: -4000
        });
    });

    it('defaults to 0/0/0 for types absent from backlogActivity', () => {
        const slide = getDurationSlide(buildRecapSlides(2024, [], [], [], activity));
        for (const type of [ArtifactType.TVSHOW, ArtifactType.ANIME, ArtifactType.MANGA]) {
            expect(slide.counts.find(c => c.type === type)).toEqual({
                type, addedDuration: 0, removedDuration: 0, net: 0
            });
        }
    });

    it('defaults every type to 0/0/0 when backlogActivity is omitted entirely', () => {
        const slide = getDurationSlide(buildRecapSlides(2024, [], [], []));
        expect(slide.counts.map(c => c.type)).toEqual(MAIN_TYPES);
        for (const c of slide.counts) {
            expect(c).toEqual({ type: c.type, addedDuration: 0, removedDuration: 0, net: 0 });
        }
    });
});

// ── Contract: existing slides remain present/unchanged ────────────────────────

describe('existing slides remain present alongside the new slide', () => {
    it('the backlog_changes slide is still present (empty case)', () => {
        const slides = buildRecapSlides(2024, [], [], [], activity);
        expect(slides.some(s => s.kind === 'backlog_changes')).toBe(true);
    });

    it('opening/grand_total/closing remain present in the non-empty case', () => {
        const entries = MAIN_TYPES.map((type, i) => makeEntry({ id: i + 1, type, score: 80 + i }));
        const slides = buildRecapSlides(2024, entries, [], [], activity);
        const kinds = slides.map(s => s.kind);
        expect(kinds[0]).toBe('opening');
        expect(kinds).toContain('grand_total');
        expect(kinds[kinds.length - 1]).toBe('closing');
    });
});
