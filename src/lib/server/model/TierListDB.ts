import { Artifact, ArtifactType, SERIALIZE_TYPE as ARTIFACT_SERIALIZE_TYPE, type IArtifactDB } from "#lib/model/Artifact";
import { AuthorizationStatus } from "#lib/model/AuthorizationStatus";
import { Tier } from "#lib/model/Tier";
import { TierList } from "#lib/model/TierList";
import { TierListItem } from "#lib/model/TierListItem";
import { TierListTag } from "#lib/model/TierListTag";
import { UserRights, type User } from "#lib/model/User";
import { artifactFromJSON } from "#lib/services/ArtifactService";
import { getDbRow, getDbRows, runDbInsert, runDbQuery, runDbTransaction } from "../database";

export interface ITierListDB {
    id: number;
    userId: number;
    backlogId: number | null;
    artifactType: ArtifactType;
    title: string;
    isStandalone: number;
    createdAt: number;
}

export interface ITierListTierDB {
    id: number;
    tierListId: number;
    label: string;
    color: string;
    position: number;
}

export interface ITierListItemDB {
    tierListId: number;
    artifactId: number;
    tierId: number | null;
    position: number;
}

export interface ITierListTagDB {
    id: number;
    tierListId: number;
    name: string;
    color: string;
}

export interface ITierListItemTagDB {
    tierListId: number;
    artifactId: number;
    tagId: number;
}

export interface ITierInput {
    id?: number;
    label: string;
    color: string;
    position: number;
}

export class TierListDB {
    private static tierMatch(tierId: number | null): { clause: string; params: number[] } {
        if (tierId === null) {
            return { clause: 'tierId IS NULL', params: [] };
        }
        return { clause: 'tierId = ?', params: [tierId] };
    }

    private static hydrateArtifact(row: IArtifactDB): Artifact {
        return artifactFromJSON(row.type, {
            __type: ARTIFACT_SERIALIZE_TYPE,
            id: row.id,
            title: row.title,
            type: row.type,
            duration: row.duration,
            releaseDate: new Date(row.releaseDate).toString(),
            status: row.status,
            links: [],
            genres: [],
            ratings: [],
            meanRating: null,
            tags: [],
            children: [],
            childIndex: null,
            userInfo: null
        });
    }

    static async getTierLists(userId: number, page: number, pageSize: number): Promise<TierList[]> {
        const rows = await getDbRows<ITierListDB>(
            `SELECT * FROM tier_list WHERE userId = ? ORDER BY id ASC LIMIT ? OFFSET ?`,
            [userId, pageSize, page * pageSize]
        );
        return rows.map(row => new TierList(row.id, row.userId, row.backlogId, row.artifactType, row.title, !!row.isStandalone));
    }

    static async getTierListById(id: number): Promise<TierList | null> {
        const row = await getDbRow<ITierListDB>(`SELECT * FROM tier_list WHERE id = ?`, [id]);
        if (!row) {
            return null;
        }
        return new TierList(row.id, row.userId, row.backlogId, row.artifactType, row.title, !!row.isStandalone);
    }

    static async getTierListByIdWithItems(id: number): Promise<TierList | null> {
        const row = await getDbRow<ITierListDB>(`SELECT * FROM tier_list WHERE id = ?`, [id]);
        if (!row) {
            return null;
        }

        const tierRows = await getDbRows<ITierListTierDB>(
            `SELECT * FROM tier_list_tier WHERE tierListId = ? ORDER BY position ASC`,
            [id]
        );
        const itemRows = await getDbRows<ITierListItemDB>(
            `SELECT * FROM tier_list_item WHERE tierListId = ? ORDER BY position ASC`,
            [id]
        );
        const tagRows = await getDbRows<ITierListTagDB>(
            `SELECT * FROM tier_list_tag WHERE tierListId = ? ORDER BY id ASC`,
            [id]
        );
        const itemTagRows = await getDbRows<ITierListItemTagDB>(
            `SELECT * FROM tier_list_item_tag WHERE tierListId = ?`,
            [id]
        );

        const artifactMap = new Map<number, Artifact>();
        const artifactIds = itemRows.map(itemRow => itemRow.artifactId);
        if (artifactIds.length > 0) {
            const questionMarks = artifactIds.map(() => '?').join(',');
            const artifactRows = await getDbRows<IArtifactDB>(`SELECT * FROM artifact WHERE id IN (${questionMarks})`, artifactIds);
            for (const artifactRow of artifactRows) {
                artifactMap.set(artifactRow.id, TierListDB.hydrateArtifact(artifactRow));
            }
        }

        const tagMap = new Map<number, TierListTag>(
            tagRows.map(tagRow => [tagRow.id, new TierListTag(tagRow.id, tagRow.name, tagRow.color)])
        );
        const itemTags = new Map<number, TierListTag[]>();
        for (const assignment of itemTagRows) {
            const tag = tagMap.get(assignment.tagId);
            if (tag) {
                const tags = itemTags.get(assignment.artifactId) ?? [];
                tags.push(tag);
                itemTags.set(assignment.artifactId, tags);
            }
        }

        const toItems = (rows: ITierListItemDB[]) => rows
            .filter(itemRow => artifactMap.has(itemRow.artifactId))
            .map(itemRow => new TierListItem(
                artifactMap.get(itemRow.artifactId)!,
                itemRow.tierId,
                itemRow.position,
                itemTags.get(itemRow.artifactId) ?? []
            ));

        const tiers = tierRows.map(tierRow => new Tier(
            tierRow.id,
            tierRow.label,
            tierRow.color,
            tierRow.position,
            toItems(itemRows.filter(itemRow => itemRow.tierId === tierRow.id))
        ));
        const unranked = toItems(itemRows.filter(itemRow => itemRow.tierId === null));

        return new TierList(
            row.id,
            row.userId,
            row.backlogId,
            row.artifactType,
            row.title,
            !!row.isStandalone,
            tiers,
            unranked,
            tagRows.map(tagRow => tagMap.get(tagRow.id)!)
        );
    }

    static async getTags(tierListId: number): Promise<TierListTag[]> {
        const rows = await getDbRows<ITierListTagDB>(
            `SELECT * FROM tier_list_tag WHERE tierListId = ? ORDER BY id ASC`,
            [tierListId]
        );
        return rows.map(row => new TierListTag(row.id, row.name, row.color));
    }

    static async createTag(tierListId: number, name: string, color: string): Promise<TierListTag> {
        const id = await runDbInsert(
            `INSERT INTO tier_list_tag (tierListId, name, color) VALUES (?, ?, ?)`,
            [tierListId, name, color]
        );
        return new TierListTag(id, name, color);
    }

    static async updateItemTag(tierListId: number, artifactId: number, tagId: number, assigned: boolean): Promise<boolean> {
        const [item, tag] = await Promise.all([
            getDbRow<ITierListItemDB>(
                `SELECT * FROM tier_list_item WHERE tierListId = ? AND artifactId = ?`,
                [tierListId, artifactId]
            ),
            getDbRow<ITierListTagDB>(
                `SELECT * FROM tier_list_tag WHERE tierListId = ? AND id = ?`,
                [tierListId, tagId]
            )
        ]);
        if (!item || !tag) {
            return false;
        }
        if (assigned) {
            await runDbQuery(
                `INSERT OR IGNORE INTO tier_list_item_tag (tierListId, artifactId, tagId) VALUES (?, ?, ?)`,
                [tierListId, artifactId, tagId]
            );
        } else {
            await runDbQuery(
                `DELETE FROM tier_list_item_tag WHERE tierListId = ? AND artifactId = ? AND tagId = ?`,
                [tierListId, artifactId, tagId]
            );
        }
        return true;
    }

    static async insertTierList(userId: number, backlogId: number | null, artifactType: ArtifactType, title: string, isStandalone: boolean = false): Promise<number> {
        return await runDbInsert(
            `INSERT INTO tier_list (userId, backlogId, artifactType, title, isStandalone) VALUES (?, ?, ?, ?, ?)`,
            [userId, backlogId, artifactType, title, isStandalone ? 1 : 0]
        );
    }

    static async insertTier(tierListId: number, label: string, color: string, position: number): Promise<number> {
        return await runDbInsert(
            `INSERT INTO tier_list_tier (tierListId, label, color, position) VALUES (?, ?, ?, ?)`,
            [tierListId, label, color, position]
        );
    }

    static async insertItem(tierListId: number, artifactId: number, tierId: number | null, position: number): Promise<void> {
        await runDbQuery(
            `INSERT INTO tier_list_item (tierListId, artifactId, tierId, position) VALUES (?, ?, ?, ?)`,
            [tierListId, artifactId, tierId, position]
        );
    }

    static async getItemArtifactIds(tierListId: number): Promise<number[]> {
        const rows = await getDbRows<{ artifactId: number }>(
            `SELECT artifactId FROM tier_list_item WHERE tierListId = ?`,
            [tierListId]
        );
        return rows.map(row => row.artifactId);
    }

    static async addUnrankedItems(tierListId: number, artifactIds: number[]): Promise<void> {
        if (artifactIds.length === 0) {
            return;
        }
        const maxRow = await getDbRow<{ maxPos: number | null }>(
            `SELECT MAX(position) as maxPos FROM tier_list_item WHERE tierListId = ? AND tierId IS NULL`,
            [tierListId]
        );
        let position = (maxRow?.maxPos ?? -1) + 1;
        for (const artifactId of artifactIds) {
            await TierListDB.insertItem(tierListId, artifactId, null, position);
            position++;
        }
    }

    static async moveItem(
        tierListId: number,
        artifactId: number,
        targetTierId: number | null,
        targetPosition: number
    ): Promise<'moved' | 'not-found' | 'invalid-position'> {
        return runDbTransaction(async transaction => {
            const row = await transaction.get<ITierListItemDB>(
                `SELECT * FROM tier_list_item WHERE tierListId = ? AND artifactId = ?`,
                [tierListId, artifactId]
            );
            if (!row) {
                return 'not-found';
            }
            if (targetTierId !== null) {
                const targetTier = await transaction.get<{ id: number }>(
                    `SELECT id FROM tier_list_tier WHERE tierListId = ? AND id = ?`,
                    [tierListId, targetTierId]
                );
                if (!targetTier) {
                    return 'not-found';
                }
            }
            if (!Number.isSafeInteger(targetPosition) || targetPosition < 0) {
                return 'invalid-position';
            }

            const targetMatch = TierListDB.tierMatch(targetTierId);
            const targetCount = await transaction.get<{ itemCount: number }>(
                `SELECT COUNT(*) AS itemCount FROM tier_list_item WHERE tierListId = ? AND ${targetMatch.clause}`,
                [tierListId, ...targetMatch.params]
            );
            const positionLimit = (targetCount?.itemCount ?? 0) - (row.tierId === targetTierId ? 1 : 0);
            if (targetPosition > positionLimit) {
                return 'invalid-position';
            }

            const sourceMatch = TierListDB.tierMatch(row.tierId);
            await transaction.run(
                `UPDATE tier_list_item SET position = position - 1 WHERE tierListId = ? AND ${sourceMatch.clause} AND position > ?`,
                [tierListId, ...sourceMatch.params, row.position]
            );
            await transaction.run(
                `UPDATE tier_list_item SET position = position + 1 WHERE tierListId = ? AND ${targetMatch.clause} AND position >= ?`,
                [tierListId, ...targetMatch.params, targetPosition]
            );
            await transaction.run(
                `UPDATE tier_list_item SET tierId = ?, position = ? WHERE tierListId = ? AND artifactId = ?`,
                [targetTierId, targetPosition, tierListId, artifactId]
            );
            return 'moved';
        });
    }

    static async deleteItem(tierListId: number, artifactId: number): Promise<void> {
        const row = await getDbRow<ITierListItemDB>(
            `SELECT * FROM tier_list_item WHERE tierListId = ? AND artifactId = ?`,
            [tierListId, artifactId]
        );
        if (!row) {
            return;
        }
        await runDbQuery(`DELETE FROM tier_list_item WHERE tierListId = ? AND artifactId = ?`, [tierListId, artifactId]);
        const match = TierListDB.tierMatch(row.tierId);
        await runDbQuery(
            `UPDATE tier_list_item SET position = position - 1 WHERE tierListId = ? AND ${match.clause} AND position > ?`,
            [tierListId, ...match.params, row.position]
        );
    }

    static async replaceTiers(tierListId: number, tiers: ITierInput[]): Promise<void> {
        const existing = await getDbRows<ITierListTierDB>(`SELECT * FROM tier_list_tier WHERE tierListId = ?`, [tierListId]);
        const payloadIds = new Set(tiers.filter(tier => tier.id != null).map(tier => tier.id));

        for (const tier of existing) {
            if (!payloadIds.has(tier.id)) {
                await TierListDB.removeTier(tierListId, tier.id);
            }
        }

        for (const tier of tiers) {
            if (tier.id != null) {
                await runDbQuery(
                    `UPDATE tier_list_tier SET label = ?, color = ?, position = ? WHERE id = ? AND tierListId = ?`,
                    [tier.label, tier.color, tier.position, tier.id, tierListId]
                );
            } else {
                await TierListDB.insertTier(tierListId, tier.label, tier.color, tier.position);
            }
        }
    }

    private static async removeTier(tierListId: number, tierId: number): Promise<void> {
        const maxRow = await getDbRow<{ maxPos: number | null }>(
            `SELECT MAX(position) as maxPos FROM tier_list_item WHERE tierListId = ? AND tierId IS NULL`,
            [tierListId]
        );
        let position = (maxRow?.maxPos ?? -1) + 1;
        const items = await getDbRows<ITierListItemDB>(
            `SELECT * FROM tier_list_item WHERE tierListId = ? AND tierId = ? ORDER BY position ASC`,
            [tierListId, tierId]
        );
        for (const item of items) {
            await runDbQuery(
                `UPDATE tier_list_item SET tierId = NULL, position = ? WHERE tierListId = ? AND artifactId = ?`,
                [position, tierListId, item.artifactId]
            );
            position++;
        }
        await runDbQuery(`DELETE FROM tier_list_tier WHERE id = ? AND tierListId = ?`, [tierId, tierListId]);
    }

    static async deleteTierList(id: number): Promise<void> {
        await runDbQuery(`DELETE FROM tier_list_item WHERE tierListId = ?`, [id]);
        await runDbQuery(`DELETE FROM tier_list_tag WHERE tierListId = ?`, [id]);
        await runDbQuery(`DELETE FROM tier_list_tier WHERE tierListId = ?`, [id]);
        await runDbQuery(`DELETE FROM tier_list WHERE id = ?`, [id]);
    }

    static async canEditTierList(user: User, tierListId: number): Promise<AuthorizationStatus> {
        if (!user.hasRight(UserRights.EDIT_BACKLOG)) {
            return new AuthorizationStatus(403, "Not authorized");
        }
        const tierList = await TierListDB.getTierListById(tierListId);
        if (!tierList) {
            return new AuthorizationStatus(404, "Not found");
        }
        if (tierList.userId !== user.id) {
            return new AuthorizationStatus(403, "Not authorized");
        }
        return new AuthorizationStatus(200, "OK");
    }

    static async createTierListTable() {
        await runDbQuery(`CREATE TABLE IF NOT EXISTS tier_list (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            userId INTEGER NOT NULL,
            backlogId INTEGER,
            artifactType TEXT NOT NULL,
            title TEXT NOT NULL,
            isStandalone INTEGER NOT NULL DEFAULT 0,
            createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
            FOREIGN KEY (userId) REFERENCES user(id)
        )`);
    }

    static async unlinkFromBacklog(id: number): Promise<void> {
        await runDbQuery(
            `UPDATE tier_list SET backlogId = NULL, isStandalone = 1 WHERE id = ?`,
            [id]
        );
    }

    static async createTierListTierTable() {
        await runDbQuery(`CREATE TABLE IF NOT EXISTS tier_list_tier (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tierListId INTEGER NOT NULL,
            label TEXT NOT NULL,
            color TEXT NOT NULL,
            position INTEGER NOT NULL,
            FOREIGN KEY (tierListId) REFERENCES tier_list(id)
        )`);
    }

    static async createTierListItemTable() {
        await runDbQuery(`CREATE TABLE IF NOT EXISTS tier_list_item (
            tierListId INTEGER NOT NULL,
            artifactId INTEGER NOT NULL,
            tierId INTEGER,
            position INTEGER NOT NULL,
            PRIMARY KEY (tierListId, artifactId),
            FOREIGN KEY (tierListId) REFERENCES tier_list(id),
            FOREIGN KEY (artifactId) REFERENCES artifact(id),
            FOREIGN KEY (tierId) REFERENCES tier_list_tier(id)
        )`);
        await runDbQuery(
            `CREATE INDEX IF NOT EXISTS idx_tier_list_item_list_tier_position
             ON tier_list_item (tierListId, tierId, position)`
        );
        await TierListDB.createTierListTagTable();
        await TierListDB.createTierListItemTagTable();
    }

    static async createTierListTagTable() {
        await runDbQuery(`CREATE TABLE IF NOT EXISTS tier_list_tag (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tierListId INTEGER NOT NULL,
            name TEXT NOT NULL COLLATE NOCASE,
            color TEXT NOT NULL,
            UNIQUE (tierListId, name),
            UNIQUE (tierListId, id),
            FOREIGN KEY (tierListId) REFERENCES tier_list(id) ON DELETE CASCADE
        )`);
    }

    static async createTierListItemTagTable() {
        await runDbQuery(`CREATE TABLE IF NOT EXISTS tier_list_item_tag (
            tierListId INTEGER NOT NULL,
            artifactId INTEGER NOT NULL,
            tagId INTEGER NOT NULL,
            PRIMARY KEY (tierListId, artifactId, tagId),
            FOREIGN KEY (tierListId, artifactId) REFERENCES tier_list_item(tierListId, artifactId) ON DELETE CASCADE,
            FOREIGN KEY (tierListId, tagId) REFERENCES tier_list_tag(tierListId, id) ON DELETE CASCADE
        )`);
    }
}
