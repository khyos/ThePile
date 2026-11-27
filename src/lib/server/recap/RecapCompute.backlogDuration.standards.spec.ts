/**
 * Standards tests for the backlog_duration_changes slide built by buildRecapSlides,
 * plus the Net sign/format display logic used by SlideBacklogDurationChanges.svelte.
 *
 * Written by reading RecapCompute.ts and the Svelte component. These cover
 * implementation-aware concerns NOT in the contract tests
 * (RecapCompute.backlogDuration.spec.ts):
 *
 *   - the two backlog slides are derived from the SAME activity record, so their
 *     addedDuration/removedDuration agree per type and share the same 5-type order,
 *   - large / zero / negative duration values flow through net = added - removed,
 *   - the component's Net cell renders `+`/`−`(U+2212) + formatDuration(abs(net)),
 *     verified at the data level because the project has no Svelte component-test
 *     setup (no @testing-library/svelte in package.json).
 */

import { describe, it, expect } from 'vitest';
import { buildRecapSlides } from './RecapCompute';
import { TimeUtil } from '#lib/util/TimeUtil';
import { ArtifactType } from '#lib/model/Artifact';
import type { RecapSlide, BacklogActivityCount } from '#lib/model/recap/RecapTypes';

const MAIN_TYPES: ArtifactType[] = [
	ArtifactType.GAME,
	ArtifactType.MOVIE,
	ArtifactType.TVSHOW,
	ArtifactType.ANIME,
	ArtifactType.MANGA
];

const getChanges = (slides: RecapSlide[]) =>
	slides.find(s => s.kind === 'backlog_changes') as Extract<RecapSlide, { kind: 'backlog_changes' }>;
const getDuration = (slides: RecapSlide[]) =>
	slides.find(s => s.kind === 'backlog_duration_changes') as Extract<RecapSlide, { kind: 'backlog_duration_changes' }>;

// ── Consistency between the two backlog slides (same source record) ────────────

describe('backlog_duration_changes is consistent with backlog_changes', () => {
	const activity: BacklogActivityCount[] = [
		{ type: ArtifactType.GAME, added: 4, removed: 1, addedDuration: 12000, removedDuration: 3000 },
		{ type: ArtifactType.ANIME, added: 0, removed: 2, addedDuration: 0, removedDuration: 7200 }
	];

	it('per-type addedDuration/removedDuration match those carried on the backlog_changes slide', () => {
		const slides = buildRecapSlides(2024, [], [], [], activity);
		const changes = getChanges(slides);
		const duration = getDuration(slides);
		for (const type of MAIN_TYPES) {
			const c = changes.counts.find(x => x.type === type)!;
			const d = duration.counts.find(x => x.type === type)!;
			expect(d.addedDuration).toBe(c.addedDuration);
			expect(d.removedDuration).toBe(c.removedDuration);
		}
	});

	it('both slides expose the same 5 MAIN types in the same order', () => {
		const slides = buildRecapSlides(2024, [], [], [], activity);
		expect(getChanges(slides).counts.map(c => c.type)).toEqual(MAIN_TYPES);
		expect(getDuration(slides).counts.map(c => c.type)).toEqual(MAIN_TYPES);
	});

	it('net equals the backlog_changes addedDuration minus removedDuration for every type', () => {
		const slides = buildRecapSlides(2024, [], [], [], activity);
		const changes = getChanges(slides);
		for (const d of getDuration(slides).counts) {
			const c = changes.counts.find(x => x.type === d.type)!;
			expect(d.net).toBe(c.addedDuration - c.removedDuration);
		}
	});
});

// ── Numeric robustness of net ─────────────────────────────────────────────────

describe('net computation across large / zero / negative durations', () => {
	it('handles large second values without precision loss', () => {
		const big = 5_000 * 3600; // 5000 hours in seconds
		const activity: BacklogActivityCount[] = [
			{ type: ArtifactType.GAME, added: 1, removed: 1, addedDuration: big, removedDuration: 3600 }
		];
		const game = getDuration(buildRecapSlides(2024, [], [], [], activity)).counts.find(c => c.type === ArtifactType.GAME)!;
		expect(game.net).toBe(big - 3600);
	});

	it('net is exactly 0 when added equals removed (distinct from the absent-type default)', () => {
		const activity: BacklogActivityCount[] = [
			{ type: ArtifactType.MOVIE, added: 2, removed: 2, addedDuration: 4444, removedDuration: 4444 }
		];
		const movie = getDuration(buildRecapSlides(2024, [], [], [], activity)).counts.find(c => c.type === ArtifactType.MOVIE)!;
		expect(movie.net).toBe(0);
		expect(movie.addedDuration).toBe(4444);
		expect(movie.removedDuration).toBe(4444);
	});

	it('net is negative when only removals have duration', () => {
		const activity: BacklogActivityCount[] = [
			{ type: ArtifactType.MANGA, added: 0, removed: 3, addedDuration: 0, removedDuration: 9999 }
		];
		const manga = getDuration(buildRecapSlides(2024, [], [], [], activity)).counts.find(c => c.type === ArtifactType.MANGA)!;
		expect(manga.net).toBe(-9999);
	});
});

// ── Net sign + format display logic (mirrors SlideBacklogDurationChanges.svelte) ─
//
// The component renders the Net cell as:
//   {net >= 0 ? '+' : '−'}{TimeUtil.formatDuration(Math.abs(net))}
// where '−' is U+2212 (MINUS SIGN), not ASCII hyphen-minus.

describe('Net sign + format display logic', () => {
	const MINUS = '−'; // the exact character the component uses for negatives
	const renderNet = (net: number) => `${net >= 0 ? '+' : MINUS}${TimeUtil.formatDuration(Math.abs(net))}`;

	it('positive net uses a leading "+" and formats the magnitude', () => {
		// 6000s = 1h 40m
		expect(renderNet(6000)).toBe('+1h 40m');
	});

	it('negative net uses the U+2212 minus sign and the absolute magnitude', () => {
		// |-4000| = 4000s = 1h 6m
		const rendered = renderNet(-4000);
		expect(rendered).toBe('−1h 6m');
		expect(rendered.startsWith('-')).toBe(false); // NOT an ASCII hyphen
		expect(rendered.charCodeAt(0)).toBe(0x2212);
	});

	it('zero net renders as "+0h" (treated as non-negative)', () => {
		expect(renderNet(0)).toBe('+0h');
	});

	it('Added / Removed cells format raw seconds via TimeUtil.formatDuration', () => {
		expect(TimeUtil.formatDuration(12000)).toBe('3h 20m');
		expect(TimeUtil.formatDuration(0)).toBe('0h');
	});

	it('display formula is consistent with the slide net values end-to-end', () => {
		const activity: BacklogActivityCount[] = [
			{ type: ArtifactType.GAME, added: 3, removed: 1, addedDuration: 10000, removedDuration: 4000 },
			{ type: ArtifactType.MOVIE, added: 1, removed: 2, addedDuration: 5000, removedDuration: 9000 }
		];
		const duration = getDuration(buildRecapSlides(2024, [], [], [], activity));
		const game = duration.counts.find(c => c.type === ArtifactType.GAME)!;
		const movie = duration.counts.find(c => c.type === ArtifactType.MOVIE)!;
		// GAME net = +6000s = +1h 40m ; MOVIE net = -4000s = −1h 6m
		expect(renderNet(game.net)).toBe('+1h 40m');
		expect(renderNet(movie.net)).toBe('−1h 6m');
	});
});
