import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { runDbQueries, runDbInsert } from '../database';
import { LinkDB } from './LinkDB';
import { ArtifactDB } from './ArtifactDB';
import { LinkType } from '#lib/model/Link';
import { ArtifactType } from '#lib/model/Artifact';

/**
 * Contract: LinkDB.getArtifactsMissingLink(artifactType, linkType)
 *
 * - Returns only root-level artifacts (parent_artifact_id IS NULL) of the given type
 * - Excludes artifacts that already have a link of the given linkType
 * - Returns artifacts ordered by title ascending
 * - Returns empty array when all artifacts have the link
 * - Returns empty array when no artifacts of that type exist
 */

describe('LinkDB.getArtifactsMissingLink', () => {
    const cleanup = async () => {
        await runDbQueries([
            { query: 'DELETE FROM link' },
            { query: 'DELETE FROM artifact' },
            { query: 'DELETE FROM sqlite_sequence WHERE name IN ("artifact")' }
        ]);
    };

    beforeAll(async () => {
        await ArtifactDB.createArtifactTable();
        await LinkDB.createLinkTable();
    });

    beforeEach(async () => {
        await cleanup();
    });

    afterAll(async () => {
        await cleanup();
    });

    it('returns root-level artifacts of the requested type that are missing the link', async () => {
        const id = await ArtifactDB.createArtifact('Alpha Game', ArtifactType.GAME);

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(id);
        expect(result[0].title).toBe('Alpha Game');
    });

    it('excludes artifacts that already have a link of the given linkType', async () => {
        const withLink = await ArtifactDB.createArtifact('Has Link', ArtifactType.GAME);
        await ArtifactDB.createArtifact('No Link', ArtifactType.GAME);
        await LinkDB.addLink(withLink, LinkType.IGDB, 'https://igdb.com/games/has-link');

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('No Link');
    });

    it('returns artifacts sorted by title ascending', async () => {
        await ArtifactDB.createArtifact('Zulu', ArtifactType.GAME);
        await ArtifactDB.createArtifact('Alpha', ArtifactType.GAME);
        await ArtifactDB.createArtifact('Mike', ArtifactType.GAME);

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result.map(r => r.title)).toEqual(['Alpha', 'Mike', 'Zulu']);
    });

    it('excludes child artifacts (parent_artifact_id IS NOT NULL)', async () => {
        const parentId = await ArtifactDB.createArtifact('Parent Game', ArtifactType.GAME);
        // insert a child: not via createArtifact (which leaves parent_artifact_id NULL)
        await runDbInsert(
            `INSERT INTO artifact (title, type, releaseDate, duration, parent_artifact_id) VALUES (?, ?, ?, ?, ?)`,
            ['Child Game', ArtifactType.GAME, new Date().getTime(), 0, parentId]
        );

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Parent Game');
    });

    it('returns empty array when every artifact of that type already has the link', async () => {
        const id1 = await ArtifactDB.createArtifact('Game One', ArtifactType.GAME);
        const id2 = await ArtifactDB.createArtifact('Game Two', ArtifactType.GAME);
        await LinkDB.addLink(id1, LinkType.IGDB, 'https://igdb.com/games/game-one');
        await LinkDB.addLink(id2, LinkType.IGDB, 'https://igdb.com/games/game-two');

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toEqual([]);
    });

    it('returns empty array when no artifacts of that type exist', async () => {
        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toEqual([]);
    });

    it('returns only artifacts of the requested type, ignoring other types', async () => {
        await ArtifactDB.createArtifact('Some Movie', ArtifactType.MOVIE);
        await ArtifactDB.createArtifact('Some Game', ArtifactType.GAME);

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Some Game');
    });
});
