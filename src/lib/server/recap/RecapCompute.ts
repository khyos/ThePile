import { ArtifactType } from '#lib/model/Artifact';
import type { ItemRef, RecapEntry, RecapSlide, TypeCount } from '#lib/model/recap/RecapTypes';

const MAIN_ARTIFACT_TYPES: ArtifactType[] = [
	ArtifactType.GAME,
	ArtifactType.MOVIE,
	ArtifactType.TVSHOW,
	ArtifactType.ANIME,
	ArtifactType.MANGA
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RELEASE_DATE_SENTINEL = 7258118400000;

const SCORE_BANDS: { label: string; min: number; max: number }[] = [
	{ label: '96–100', min: 96, max: 100 },
	{ label: '91–95',  min: 91, max: 95  },
	{ label: '86–90',  min: 86, max: 90  },
	{ label: '81–85',  min: 81, max: 85  },
	{ label: '76–80',  min: 76, max: 80  },
	{ label: '71–75',  min: 71, max: 75  },
	{ label: '66–70',  min: 66, max: 70  },
	{ label: '61–65',  min: 61, max: 65  },
	{ label: '56–60',  min: 56, max: 60  },
	{ label: '51–55',  min: 51, max: 55  },
	{ label: '46–50',  min: 46, max: 50  },
	{ label: '41–45',  min: 41, max: 45  },
	{ label: '36–40',  min: 36, max: 40  },
	{ label: '31–35',  min: 31, max: 35  },
	{ label: '26–30',  min: 26, max: 30  },
	{ label: '21–25',  min: 21, max: 25  },
	{ label: '16–20',  min: 16, max: 20  },
	{ label: '11–15',  min: 11, max: 15  },
	{ label: '6–10',   min: 6,  max: 10  },
	{ label: '1–5',    min: 1,  max: 5   },
	{ label: '0',      min: 0,  max: 0   },
];

function toItemRef(e: RecapEntry & { score: number }): ItemRef {
	return { id: e.id, title: e.title, type: e.type, endDate: e.endDate, score: e.score, duration: e.duration };
}

export function buildRecapSlides(
	year: number,
	currentEntries: RecapEntry[],
	priorEntries: RecapEntry[],
	genres: { name: string; count: number }[]
): RecapSlide[] {
	const opening: RecapSlide = { kind: 'opening', year };

	if (currentEntries.length === 0) {
		return [opening, { kind: 'empty', year }];
	}

	const slides: RecapSlide[] = [opening];

	// Slide 2: Grand total
	const totalCount = currentEntries.length;
	const totalDuration = currentEntries.reduce((sum, e) => sum + e.duration, 0);
	slides.push({ kind: 'grand_total', totalCount, totalDuration });

	// Slide 3: By type (MAIN types only)
	const mainEntries = currentEntries.filter(e => MAIN_ARTIFACT_TYPES.includes(e.type));
	const countsByType = new Map<ArtifactType, TypeCount>();
	for (const type of MAIN_ARTIFACT_TYPES) {
		countsByType.set(type, { type, count: 0, totalDuration: 0 });
	}
	for (const e of mainEntries) {
		const tc = countsByType.get(e.type);
		if (tc) {
			tc.count += 1;
			tc.totalDuration += e.duration;
		}
	}
	const counts = Array.from(countsByType.values()).filter(tc => tc.count > 0);
	if (counts.length > 0) {
		const mediaType = counts.reduce((best, tc) => tc.count > best.count ? tc : best).type;
		slides.push({ kind: 'by_type', counts, mediaType });
	}

	// Slide 4: Top genres (skip if none)
	if (genres.length > 0) {
		slides.push({ kind: 'top_genres', genres });
	}

	// Slide 5: Monthly completions (ALL types)
	const bars = MONTH_SHORT.map((label, month) => {
		const monthStart = new Date(year, month, 1).getTime();
		const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
		const value = currentEntries.filter(e => e.endDate >= monthStart && e.endDate <= monthEnd).length;
		return { label, showLabel: true, value };
	});
	slides.push({ kind: 'monthly', bars });

	// Slide 6: Year vs last year
	const currentSummary = { year, totalCount, totalDuration };
	const priorSummary = priorEntries.length > 0
		? {
			year: year - 1,
			totalCount: priorEntries.length,
			totalDuration: priorEntries.reduce((sum, e) => sum + e.duration, 0)
		}
		: null;
	slides.push({ kind: 'year_comparison', current: currentSummary, prior: priorSummary });

	// Slides 7 & 8: Highest rated + Score distribution (MAIN types only, only if scored items exist)
	const scoredMainEntries = mainEntries.filter(
		(e): e is RecapEntry & { score: number } => e.score !== null
	);
	const byScoreDesc = (a: RecapEntry & { score: number }, b: RecapEntry & { score: number }) => {
		const diff = b.score - a.score;
		return diff !== 0 ? diff : b.endDate - a.endDate;
	};
	if (scoredMainEntries.length > 0) {
		// Slide 7: Top 5 highest rated overall
		const sortedByScore = [...scoredMainEntries].sort(byScoreDesc);
		const topOverall = sortedByScore.slice(0, 5).map(toItemRef);
		slides.push({ kind: 'highest_rated', topOverall });

		// One slide per type that has scored items, inserted after highest_rated
		for (const type of MAIN_ARTIFACT_TYPES) {
			const typeEntries = scoredMainEntries.filter(e => e.type === type);
			if (typeEntries.length === 0) continue;
			const typeSorted = [...typeEntries].sort(byScoreDesc);
			slides.push({ kind: 'top_by_type', mediaType: type, items: typeSorted.slice(0, 5).map(toItemRef) });
		}

		// Slide 8: Score distribution (bands of 5 points)
		const scoreBands = [
			...SCORE_BANDS.map(b => ({
				label: b.label,
				count: scoredMainEntries.filter(e => e.score >= b.min && e.score <= b.max).length
			})),
			{ label: 'Unscored', count: mainEntries.filter(e => e.score === null).length }
		];
		slides.push({ kind: 'score_dist', bands: scoreBands.filter(b => b.count > 0) });
	}

	// Slide 9 (was first_last — removed): Top 5 longest items (MAIN types only)
	if (mainEntries.length > 0) {
		const sortedByDuration = [...mainEntries].sort((a, b) => b.duration - a.duration);
		const items = sortedByDuration.slice(0, 5).map(e => ({ title: e.title, duration: e.duration, type: e.type }));
		slides.push({ kind: 'longest', items });
	}

	// Slide 10: Classics vs new releases (ALL entries)
	const newCount = currentEntries.filter(e =>
		new Date(e.releaseDate).getFullYear() === year && e.releaseDate < RELEASE_DATE_SENTINEL
	).length;
	const recentCount = currentEntries.filter(e => {
		const releaseYear = new Date(e.releaseDate).getFullYear();
		return releaseYear > (year - 5) && releaseYear < year && e.releaseDate < RELEASE_DATE_SENTINEL;
	}).length;
	const classicCount = currentEntries.length - newCount - recentCount;
	slides.push({ kind: 'classics_vs_new', newCount, recentCount, classicCount });

	// Slide: Binge vs slow burn (MAIN types with non-null startDate only)
	const WEEK_MS  = 7  * 24 * 60 * 60 * 1000;
	const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
	const mainWithStart = mainEntries.filter(e => e.startDate !== null);
	if (mainWithStart.length > 0) {
		const bingeCount = mainWithStart.filter(e => e.endDate - e.startDate! <= WEEK_MS).length;
		const burnCount  = mainWithStart.filter(e => e.endDate - e.startDate! > MONTH_MS).length;
		const midCount   = mainWithStart.length - bingeCount - burnCount;
		slides.push({ kind: 'binge_vs_burn', bingeCount, burnCount, midCount });
	}

	// Slide: Rating generosity (MAIN types with scores)
	if (scoredMainEntries.length > 0) {
		const currentAvg = Math.round(
			(scoredMainEntries.reduce((s, e) => s + e.score, 0) / scoredMainEntries.length) * 10
		) / 10;
		const priorScoredMain = priorEntries.filter(
			(e): e is RecapEntry & { score: number } => MAIN_ARTIFACT_TYPES.includes(e.type) && e.score !== null
		);
		const priorAvg = priorScoredMain.length > 0
			? Math.round((priorScoredMain.reduce((s, e) => s + e.score, 0) / priorScoredMain.length) * 10) / 10
			: null;
		slides.push({ kind: 'rating_generosity', currentAvg, priorAvg });
	}

	// Slide: Oldest by type — entry with largest (endDate - releaseDate) gap per MAIN type
	const oldestItems: { type: ArtifactType; title: string; releaseYear: number; finishedYear: number; gapYears: number }[] = [];
	for (const type of MAIN_ARTIFACT_TYPES) {
		const validEntries = mainEntries.filter(
			e => e.type === type && e.releaseDate > 0 && e.releaseDate < RELEASE_DATE_SENTINEL
		);
		if (validEntries.length === 0) continue;
		const oldest = validEntries.reduce((best, e) =>
			(e.endDate - e.releaseDate) > (best.endDate - best.releaseDate) ? e : best
		);
		const releaseYear  = new Date(oldest.releaseDate).getFullYear();
		const finishedYear = new Date(oldest.endDate).getFullYear();
		oldestItems.push({ type, title: oldest.title, releaseYear, finishedYear, gapYears: finishedYear - releaseYear });
	}
	if (oldestItems.length > 0) {
		oldestItems.sort((a, b) => b.gapYears - a.gapYears);
		slides.push({ kind: 'oldest_by_type', items: oldestItems });
	}

	// Slide: Average score by type (MAIN types; requires ≥ 2 types with scored entries)
	const avgScoreByType: { type: ArtifactType; avg: number; count: number }[] = [];
	for (const type of MAIN_ARTIFACT_TYPES) {
		const typeScored = mainEntries.filter(
			(e): e is RecapEntry & { score: number } => e.type === type && e.score !== null
		);
		if (typeScored.length === 0) continue;
		const avg = Math.round(
			(typeScored.reduce((s, e) => s + e.score, 0) / typeScored.length) * 10
		) / 10;
		avgScoreByType.push({ type, avg, count: typeScored.length });
	}
	if (avgScoreByType.length >= 2) {
		avgScoreByType.sort((a, b) => b.avg - a.avg);
		slides.push({ kind: 'avg_score_by_type', scores: avgScoreByType });
	}

	// Slide: Best week — 7-day rolling window with most completions (ALL types)
	const sortedByEnd = [...currentEntries].sort((a, b) => a.endDate - b.endDate);
	let bestWeekStart = 0;
	let bestWeekCount = 0;
	for (let i = 0; i < sortedByEnd.length; i++) {
		const windowEnd = sortedByEnd[i].endDate + WEEK_MS;
		let count = 0;
		for (let j = i; j < sortedByEnd.length && sortedByEnd[j].endDate < windowEnd; j++) {
			count++;
		}
		if (count > bestWeekCount) {
			bestWeekCount = count;
			bestWeekStart = sortedByEnd[i].endDate;
		}
	}
	if (bestWeekCount >= 2) {
		slides.push({ kind: 'best_week', weekStart: bestWeekStart, count: bestWeekCount });
	}

	// Slide 11: Closing
	slides.push({ kind: 'closing', totalCount, year });

	return slides;
}
