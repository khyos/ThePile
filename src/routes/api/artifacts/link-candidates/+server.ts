import { getCandidates } from '#lib/server/link-candidates';
import { User, UserRights } from '#lib/model/User';
import { error, json } from '@sveltejs/kit';
import type { RequestEvent } from './$types';

export async function GET({ url, locals }: RequestEvent) {
    const user = User.deserialize(locals.user);
    if (!user.hasRight(UserRights.EDIT_ARTIFACT)) {
        return error(403, 'Forbidden');
    }

    const artifactType = url.searchParams.get('artifactType') ?? '';
    const linkType = url.searchParams.get('linkType') ?? '';
    const query = url.searchParams.get('query') ?? '';

    const results = await getCandidates(artifactType, linkType, query);
    return json({ results });
}
