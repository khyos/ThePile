import { User } from "#lib/model/User";
import { TierListDB } from "#lib/server/model/TierListDB";
import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";
import { ErrorUtil } from "#lib/util/ErrorUtil";

export async function POST({ params, request, locals }: RequestEvent) {
    if (!/^\d+$/.test(params.slug)) {
        return error(400, 'Invalid tier list ID');
    }
    const tierListId = Number(params.slug);
    if (!Number.isSafeInteger(tierListId) || tierListId <= 0) {
        return error(400, 'Invalid tier list ID');
    }
    const user = User.deserialize(locals.user);
    const authorization = await TierListDB.canEditTierList(user, tierListId);
    if (authorization.status !== 200) {
        return error(authorization.status, authorization.message);
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return error(400, 'Invalid move request');
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        return error(400, 'Invalid move request');
    }
    const move = body as Record<string, unknown>;
    if (
        Object.keys(move).some(key => !['artifactId', 'targetTierId', 'targetPosition'].includes(key)) ||
        typeof move.artifactId !== 'number' ||
        !Number.isSafeInteger(move.artifactId) ||
        move.artifactId < 1 ||
        !('targetPosition' in move) ||
        typeof move.targetPosition !== 'number' ||
        !Number.isSafeInteger(move.targetPosition) ||
        move.targetPosition < 0 ||
        (move.targetTierId !== undefined &&
            move.targetTierId !== null &&
            (typeof move.targetTierId !== 'number' ||
                !Number.isSafeInteger(move.targetTierId) ||
                move.targetTierId < 1))
    ) {
        return error(400, 'Invalid move request');
    }

    let result: Awaited<ReturnType<typeof TierListDB.moveItem>>;
    try {
        result = await TierListDB.moveItem(
            tierListId,
            move.artifactId,
            move.targetTierId ?? null,
            move.targetPosition
        );
    } catch (e) {
        return error(500, ErrorUtil.getErrorMessage(e));
    }
    if (result === 'not-found') {
        return error(404, 'Tier list item or target tier not found');
    }
    if (result === 'invalid-position') {
        return error(400, 'Invalid target position');
    }
    return json({ success: true });
}
