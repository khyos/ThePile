import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'vitest';
import { runDbQueriesParallel } from '../database';
import { LinkDB } from './LinkDB';
import { LinkType } from '#lib/model/Link';
import { ArtifactDB } from './ArtifactDB';
import { ArtifactType } from '#lib/model/Artifact';

/**
 * Contract tests for LinkDB.deleteLink(artifactId, type).
 *
 * Contract: deletes the link row identified by (artifactId, type). After an
 * addLink followed by deleteLink, getLinks(artifactId) no longer contains that
 * link type. Mirrors the existing LinkDB.spec.ts DB harness exactly.
 */
describe('LinkDB.deleteLink', () => {
    const cleanupTestData = async () => {
        await runDbQueriesParallel([
            { query: 'DELETE FROM link' },
            { query: 'DELETE FROM artifact' },
            { query: 'DELETE FROM sqlite_sequence WHERE name IN ("artifact")' }
        ]);
    };

    beforeAll(async () => {
        ArtifactDB.createArtifactTable();
        LinkDB.createLinkTable();
    });

    beforeEach(async () => {
        await cleanupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    test('removes the targeted link so getLinks no longer contains it', async () => {
        const artifactId = await ArtifactDB.createArtifact(
            'Test Game',
            ArtifactType.GAME,
            '',
            new Date('2024-01-01'),
            120
        );

        await LinkDB.addLink(artifactId, LinkType.STEAM, 'https://store.steampowered.com/app/123456');
        await LinkDB.deleteLink(artifactId, LinkType.STEAM);

        const links = await LinkDB.getLinks(artifactId);
        expect(links.map(link => link.type)).not.toContain(LinkType.STEAM);
        expect(links).toHaveLength(0);
    });

    test('only deletes the targeted link type, leaving other links intact', async () => {
        const artifactId = await ArtifactDB.createArtifact(
            'Test Game',
            ArtifactType.GAME,
            '',
            new Date('2024-01-01'),
            120
        );

        await LinkDB.addLink(artifactId, LinkType.STEAM, 'https://store.steampowered.com/app/123456');
        await LinkDB.addLink(artifactId, LinkType.METACRITIC, 'https://www.metacritic.com/game/test-game');

        await LinkDB.deleteLink(artifactId, LinkType.STEAM);

        const links = await LinkDB.getLinks(artifactId);
        expect(links).toHaveLength(1);
        expect(links[0].type).toBe(LinkType.METACRITIC);
        expect(links[0].url).toBe('https://www.metacritic.com/game/test-game');
    });

    test('deleting a link type that is not present does not throw and leaves existing links', async () => {
        const artifactId = await ArtifactDB.createArtifact(
            'Test Game',
            ArtifactType.GAME,
            '',
            new Date('2024-01-01'),
            120
        );

        await LinkDB.addLink(artifactId, LinkType.STEAM, 'https://store.steampowered.com/app/123456');

        await expect(LinkDB.deleteLink(artifactId, LinkType.METACRITIC)).resolves.not.toThrow();

        const links = await LinkDB.getLinks(artifactId);
        expect(links).toHaveLength(1);
        expect(links[0].type).toBe(LinkType.STEAM);
    });
});
