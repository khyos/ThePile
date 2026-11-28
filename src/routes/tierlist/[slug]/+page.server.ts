import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { TierListUtil } from '#lib/server/model/TierListUtil';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!/^\d+$/.test(params.slug)) {
		error(400, 'Invalid tier list ID');
	}
	const tierListId = Number(params.slug);
	if (!Number.isSafeInteger(tierListId) || tierListId <= 0) {
		error(400, 'Invalid tier list ID');
	}

	const tierListPageInfo = await TierListUtil.loadTierListPageInfo(tierListId, locals);
	if (!tierListPageInfo) {
		error(404, 'Tier list not found');
	}
	return tierListPageInfo;
}
