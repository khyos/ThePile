/**
 * Standards tests for LinkDB.getArtifactsMissingLink
 *
 * These tests complement the TDD contract tests by verifying
 * implementation-specific paths visible only by reading the SQL query:
 *
 * - An artifact with a DIFFERENT link type still appears as missing the queried type
 * - An artifact that has BOTH a matching and non-matching link is excluded
 * - The returned rows contain only the { id, title } fields (not full artifact rows)
 * - Querying with every supported LinkType still uses the same parameterised NOT EXISTS
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { runDbQueries, runDbInsert } from '../database';
import { LinkDB } from './LinkDB';
import { ArtifactDB } from './ArtifactDB';
import { LinkType } from '#lib/model/Link';
import { ArtifactType } from '#lib/model/Artifact';

describe('LinkDB.getArtifactsMissingLink — implementation-level tests', () => {
    const cleanup = async () => {
        await runDbQueries([
            { query: 'DELETE FROM link' },
            { query: 'DELETE FROM artifact' },
            { query: "DELETE FROM sqlite_sequence WHERE name IN ('artifact')" },
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

    it('includes an artifact that has a DIFFERENT link type than the queried one', async () => {
        // "My Game" has an HLTB link but no IGDB link — it must appear in the IGDB missing list
        const id = await ArtifactDB.createArtifact('My Game', ArtifactType.GAME);
        await LinkDB.addLink(id, LinkType.HLTB, 'https://hltb.com/game/my-game');

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe(id);
        expect(result[0].title).toBe('My Game');
    });

    it('excludes an artifact that has BOTH the queried link type AND other link types', async () => {
        const id = await ArtifactDB.createArtifact('Full Game', ArtifactType.GAME);
        await LinkDB.addLink(id, LinkType.IGDB, 'https://igdb.com/games/full-game');
        await LinkDB.addLink(id, LinkType.HLTB, 'https://hltb.com/game/full-game');
        await LinkDB.addLink(id, LinkType.STEAM, 'https://store.steampowered.com/app/1');

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toEqual([]);
    });

    it('returns only { id, title } fields — no other artifact columns leak through', async () => {
        const id = await ArtifactDB.createArtifact('Field Test', ArtifactType.GAME);

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        expect(result).toHaveLength(1);
        // Only id and title should be present
        const keys = Object.keys(result[0]).sort();
        expect(keys).toEqual(['id', 'title']);
        expect(result[0].id).toBe(id);
        expect(result[0].title).toBe('Field Test');
    });

    it('handles mixed population: some artifacts have the link, some have a different link, some have none', async () => {
        const withIGDB = await ArtifactDB.createArtifact('Has IGDB', ArtifactType.GAME);
        const withHLTB = await ArtifactDB.createArtifact('Has HLTB Only', ArtifactType.GAME);
        await ArtifactDB.createArtifact('Has Nothing', ArtifactType.GAME);

        await LinkDB.addLink(withIGDB, LinkType.IGDB, 'https://igdb.com/games/has-igdb');
        await LinkDB.addLink(withHLTB, LinkType.HLTB, 'https://hltb.com/game/has-hltb');

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        // withIGDB is excluded; withHLTB and withNothing are still missing IGDB
        expect(result).toHaveLength(2);
        const titles = result.map(r => r.title);
        expect(titles).toContain('Has HLTB Only');
        expect(titles).toContain('Has Nothing');
        expect(titles).not.toContain('Has IGDB');
    });

    it('works for non-GAME artifact types (movie + TMDB)', async () => {
        const movieId = await ArtifactDB.createArtifact('Some Movie', ArtifactType.MOVIE);
        // Add a SENSCRITIQUE link but not TMDB
        await LinkDB.addLink(movieId, LinkType.SENSCRITIQUE, 'https://senscritique.com/film/some-movie');

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.MOVIE, LinkType.TMDB);

        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Some Movie');
    });

    it('does not return child artifacts even when they are missing the link', async () => {
        const parentId = await ArtifactDB.createArtifact('Parent', ArtifactType.GAME);
        // Insert a child that also lacks the link
        await runDbInsert(
            `INSERT INTO artifact (title, type, releaseDate, duration, parent_artifact_id) VALUES (?, ?, ?, ?, ?)`,
            ['Child', ArtifactType.GAME, new Date().getTime(), 0, parentId]
        );

        const result = await LinkDB.getArtifactsMissingLink(ArtifactType.GAME, LinkType.IGDB);

        // Only the parent should appear
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Parent');
    });
});
