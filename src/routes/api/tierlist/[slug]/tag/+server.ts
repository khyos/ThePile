import { User } from "#lib/model/User";
import { TierListDB } from "#lib/server/model/TierListDB";
import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";

const getAuthorizedTierListId = async (params: RequestEvent['params'], locals: App.Locals): Promise<number> => {
    if (!/^\d+$/.test(params.slug)) {
        return error(400, 'Invalid tier list ID');
    }
    const tierListId = Number(params.slug);
    if (!Number.isSafeInteger(tierListId) || tierListId <= 0) {
        return error(400, 'Invalid tier list ID');
    }
    const authorization = await TierListDB.canEditTierList(User.deserialize(locals.user), tierListId);
    if (authorization.status !== 200) {
        return error(authorization.status, authorization.message);
    }
    return tierListId;
};

const readBody = async (request: Request): Promise<Record<string, unknown> | null> => {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return null;
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return null;
    }
    return body as Record<string, unknown>;
};

const isDuplicateTagError = (cause: unknown): boolean => {
    if (typeof cause !== 'object' || cause === null || !('code' in cause) || !('message' in cause)) {
        return false;
    }
    return typeof cause.code === 'string'
        && cause.code.startsWith('SQLITE_CONSTRAINT')
        && typeof cause.message === 'string'
        && cause.message.includes('UNIQUE constraint failed: tier_list_tag.tierListId, tier_list_tag.name');
};

export async function POST({ params, request, locals }: RequestEvent) {
    const tierListId = await getAuthorizedTierListId(params, locals);
    const body = await readBody(request);
    if (!body) {
        return error(400, 'Invalid tag');
    }
    const { name: rawName, color } = body;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    if (name.length < 1 || name.length > 32 || typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) {
        return error(400, 'A tag needs a name and a valid color');
    }
    if ((await TierListDB.getTags(tierListId)).some(tag => tag.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        return error(409, 'A tag with this name already exists');
    }
    let tag: Awaited<ReturnType<typeof TierListDB.createTag>>;
    try {
        tag = await TierListDB.createTag(tierListId, name, color);
    } catch (cause) {
        if (isDuplicateTagError(cause)) {
            return error(409, 'A tag with this name already exists');
        }
        throw cause;
    }
    return json(tag.toJSON());
}

export async function PATCH({ params, request, locals }: RequestEvent) {
    const tierListId = await getAuthorizedTierListId(params, locals);
    const body = await readBody(request);
    if (!body) {
        return error(400, 'Invalid tag assignment');
    }
    const { artifactId, tagId, assigned } = body;
    if (
        typeof artifactId !== 'number' ||
        !Number.isSafeInteger(artifactId) ||
        artifactId <= 0 ||
        typeof tagId !== 'number' ||
        !Number.isSafeInteger(tagId) ||
        tagId <= 0 ||
        typeof assigned !== 'boolean'
    ) {
        return error(400, 'Invalid tag assignment');
    }
    const updated = await TierListDB.updateItemTag(tierListId, artifactId, tagId, assigned);
    if (!updated) {
        return error(404, 'Tier list item or tag not found');
    }
    return json({ success: true });
}
