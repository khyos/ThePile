import { error } from '@sveltejs/kit';
import { ArtifactType } from '#lib/model/Artifact';
import { LinkType, getLinkTypesByArtifactType } from '#lib/model/Link';
import { User, UserRights } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';
import type { PageServerLoad } from './$types';

const ROOT_ARTIFACT_TYPES = new Set<string>([
    ArtifactType.GAME,
    ArtifactType.MOVIE,
    ArtifactType.TVSHOW,
    ArtifactType.ANIME,
    ArtifactType.MANGA,
]);

export const load: PageServerLoad = async ({ url, locals }) => {
    const user = User.deserialize(locals.user);
    if (!user.hasRight(UserRights.EDIT_ARTIFACT)) {
        error(403, 'Forbidden');
    }

    const type = url.searchParams.get('type') ?? '';
    const linkType = url.searchParams.get('linkType') ?? '';

    if (!ROOT_ARTIFACT_TYPES.has(type)) {
        return { artifacts: [] as { id: number; title: string; year: number | null }[], type: '', linkType: '' };
    }

    const artifactType = type as ArtifactType;
    const validLinkTypes = getLinkTypesByArtifactType(artifactType);
    if (!validLinkTypes.some(lt => lt === linkType)) {
        return { artifacts: [] as { id: number; title: string; year: number | null }[], type: '', linkType: '' };
    }

    const artifacts = await LinkDB.getArtifactsMissingLink(artifactType, linkType as LinkType);
    return { artifacts, type, linkType };
};
