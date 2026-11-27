import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'vitest';
import { runDbQueriesParallel, getDbRow } from '../../database';
import { GameDB } from './GameDB';
import { ArtifactDB } from '../ArtifactDB';
import { ArtifactType } from '#lib/model/Artifact';

/**
 * Standards test for GameDB.updateDuration now accepting `number | null`.
 *
 * The HLTB link-removal cleanup calls updateDuration(gameId, null); this must
 * persist SQL NULL in the artifact.duration column, NOT 0. Verified against the
 * real SQLite harness (mirrors GameDB.spec.ts / LinkDB.deleteLink.spec.ts).
 */
describe('GameDB.updateDuration with null', () => {
    const cleanupTestData = async () => {
        await runDbQueriesParallel([
            { query: 'DELETE FROM artifact' },
            { query: 'DELETE FROM sqlite_sequence WHERE name IN ("artifact")' }
        ]);
    };

    beforeAll(async () => {
        await ArtifactDB.createArtifactTable();
    });

    beforeEach(async () => {
        await cleanupTestData();
    });

    afterAll(async () => {
        await cleanupTestData();
    });

    test('clears the duration to SQL NULL rather than 0', async () => {
        const gameId = await ArtifactDB.createArtifact(
            'Test Game',
            ArtifactType.GAME,
            '',
            new Date('2024-01-01'),
            7200
        );

        await GameDB.updateDuration(gameId, null);

        const row = await getDbRow<{ duration: number | null }>(
            'SELECT duration FROM artifact WHERE id = ?',
            [gameId]
        );
        expect(row).not.toBeNull();
        expect(row?.duration).toBeNull();
        expect(row?.duration).not.toBe(0);
    });

    test('still stores a concrete numeric duration', async () => {
        const gameId = await ArtifactDB.createArtifact(
            'Test Game',
            ArtifactType.GAME,
            '',
            new Date('2024-01-01'),
            7200
        );

        await GameDB.updateDuration(gameId, 3600);

        const row = await getDbRow<{ duration: number | null }>(
            'SELECT duration FROM artifact WHERE id = ?',
            [gameId]
        );
        expect(row?.duration).toBe(3600);
    });
});
