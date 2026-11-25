import { error } from '@sveltejs/kit';
import { User } from '#lib/model/User';
import { RecapDB } from '#lib/server/recap/RecapDB';
import { buildRecapSlides } from '#lib/server/recap/RecapCompute';
import type { PageServerLoad } from './$types';
import type { RecapSlide } from '#lib/model/recap/RecapTypes';

export type RecapPageData = {
	year: number;
	currentYear: number;
	slides: RecapSlide[];
};

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = User.deserialize(locals.user);
	if (user.id < 0) {
		error(401, 'Please sign in to view your year recap');
	}

	const yearNum = parseInt(params.year, 10);
	if (isNaN(yearNum) || yearNum < 1900 || yearNum > 9999) {
		error(400, 'Invalid year');
	}

	const currentYear = new Date().getFullYear();

	const yearStart = new Date(yearNum, 0, 1).getTime();
	const yearEnd = new Date(yearNum, 11, 31, 23, 59, 59, 999).getTime();
	const priorYearStart = new Date(yearNum - 1, 0, 1).getTime();
	const priorYearEnd = new Date(yearNum - 1, 11, 31, 23, 59, 59, 999).getTime();

	const [currentEntries, priorEntries, genres, backlogActivity] = await Promise.all([
		RecapDB.getYearEntries(user.id, yearStart, yearEnd),
		RecapDB.getYearEntries(user.id, priorYearStart, priorYearEnd),
		RecapDB.getTopGenres(user.id, yearStart, yearEnd),
		RecapDB.getYearBacklogActivity(user.id, yearStart, yearEnd)
	]);

	const slides = buildRecapSlides(yearNum, currentEntries, priorEntries, genres, backlogActivity);

	return { year: yearNum, currentYear, slides } satisfies RecapPageData;
};
