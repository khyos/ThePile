import type { ArtifactType } from '#lib/model/Artifact';

export type RecapEntry = {
	id: number;
	title: string;
	type: ArtifactType;
	duration: number;
	releaseDate: number;
	score: number | null;
	endDate: number;
	startDate: number | null;
};

export type TypeCount = {
	type: ArtifactType;
	count: number;
	totalDuration: number;
};

export type YearSummary = {
	year: number;
	totalCount: number;
	totalDuration: number;
};

export type ItemRef = {
	id: number;
	title: string;
	type: ArtifactType;
	endDate: number;
	score: number;
	duration: number;
};

export type ScoreBand = {
	label: string;
	count: number;
};

export type RecapSlide =
	| { kind: 'opening'; year: number }
	| { kind: 'empty'; year: number }
	| { kind: 'grand_total'; totalCount: number; totalDuration: number }
	| { kind: 'by_type'; counts: TypeCount[]; mediaType: ArtifactType }
	| { kind: 'top_genres'; genres: { name: string; count: number }[] }
	| { kind: 'monthly'; bars: { label: string; showLabel: boolean; value: number }[] }
	| { kind: 'year_comparison'; current: YearSummary; prior: YearSummary | null }
	| { kind: 'highest_rated'; topOverall: ItemRef[] }
	| { kind: 'top_by_type'; mediaType: ArtifactType; items: ItemRef[] }
	| { kind: 'score_dist'; bands: ScoreBand[] }
	| { kind: 'longest'; items: { title: string; duration: number; type: ArtifactType }[] }
	| { kind: 'classics_vs_new'; newCount: number; recentCount: number; classicCount: number }
	| { kind: 'binge_vs_burn';    bingeCount: number; burnCount: number; midCount: number }
	| { kind: 'rating_generosity'; currentAvg: number; priorAvg: number | null }
	| { kind: 'oldest_by_type';   items: { type: ArtifactType; title: string; releaseYear: number; finishedYear: number; gapYears: number }[] }
	| { kind: 'avg_score_by_type'; scores: { type: ArtifactType; avg: number; count: number }[] }
	| { kind: 'best_week';        weekStart: number; count: number }
	| { kind: 'closing'; totalCount: number; year: number };
