/**
 * TDD contract tests for RecapDB.getYearBacklogActivity.
 *
 * These validate the PUBLIC CONTRACT of the method (return shape, fixed
 * all-types ordering, and the new addedDuration/removedDuration aggregation)
 * WITHOUT reading the implementation. Expectations are derived from the
 * feature contract only.
 *
 * DB-touching tests follow the live-SQLite harness style from
 * RecapDB.standards.spec.ts.
 */

import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { ArtifactType } from '#lib/model/Artifact';
import { runDbQueries } from '#lib/server/database';
import { ArtifactDB } from '#lib/server/model/ArtifactDB';
import { UserDB } from '#lib/server/model/UserDB';
import { RecapDB } from './RecapDB';

describe('RecapDB.getYearBacklogActivity — contract', () => {
    const year = 2024;
    const yearStart = new Date(year, 0, 1).getTime();
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

    // Fixed MAIN_ARTIFACT_TYPES order mandated by the contract.
    const MAIN_TYPES = [
        ArtifactType.GAME,
        ArtifactType.MOVIE,
        ArtifactType.TVSHOW,
        ArtifactType.ANIME,
        ArtifactType.MANGA
    ];

    const findType = (
        counts: Awaited<ReturnType<typeof RecapDB.getYearBacklogActivity>>,
        type: ArtifactType
    ) => counts.find(c => c.type === type)!;

    beforeAll(async () => {
        await UserDB.createUserTable();
        await ArtifactDB.createArtifactTable();
        await ArtifactDB.createUserArtifactTable();
    });

    beforeEach(async () => {
        await runDbQueries([
            { query: 'DELETE FROM user_artifact' },
            { query: 'DELETE FROM artifact' },
            { query: 'DELETE FROM user' },
            { query: "INSERT INTO user (id, username, password, role) VALUES (1, 'recap-dur-user', 'hash', 'user')" }
        ]);
    });

    afterAll(async () => {
        await runDbQueries([
            { query: 'DELETE FROM user_artifact' },
            { query: 'DELETE FROM artifact' },
            { query: 'DELETE FROM user' }
        ]);
    });

    // ── Contract: stable all-types shape, fixed order, numeric zero-fill ───────

    it('returns exactly one entry per MAIN_ARTIFACT_TYPE in the fixed order even with no rows', async () => {
        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        expect(counts.map(c => c.type)).toEqual(MAIN_TYPES);
    });

    it('zero-fills addedDuration/removedDuration with numeric 0 (never null/undefined) when a type has no rows', async () => {
        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        for (const c of counts) {
            expect(typeof c.addedDuration).toBe('number');
            expect(typeof c.removedDuration).toBe('number');
            expect(c.addedDuration).toBe(0);
            expect(c.removedDuration).toBe(0);
        }
    });

    // ── Contract: addedDuration = SUM(duration) over the rows counted by added ──

    it('addedDuration is the sum of duration over the same rows counted by added', async () => {
        await runDbQueries([
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (11, 'Game A', 'game', ?, 3600)", params: [yearStart] },
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (12, 'Game B', 'game', ?, 1800)", params: [yearStart + 1000] },
            // endDate NULL → added only, not removed
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 11, 'wishlist', NULL)" },
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 12, 'wishlist', NULL)" }
        ]);

        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        const game = findType(counts, ArtifactType.GAME);
        expect(game.added).toBe(2);
        expect(game.addedDuration).toBe(5400);
        expect(game.removed).toBe(0);
        expect(game.removedDuration).toBe(0);
    });

    // ── Contract: removedDuration = SUM(duration) over the rows counted by removed

    it('removedDuration is the sum of duration over the same rows counted by removed', async () => {
        await runDbQueries([
            // releaseDate before the year → not an addition; removed in-year
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (21, 'Movie X', 'movie', ?, 2400)", params: [yearStart - 1000] },
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 21, 'finished', ?)", params: [yearEnd] }
        ]);

        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        const movie = findType(counts, ArtifactType.MOVIE);
        expect(movie.removed).toBe(1);
        expect(movie.removedDuration).toBe(2400);
        expect(movie.added).toBe(0);
        expect(movie.addedDuration).toBe(0);
    });

    it('an artifact added and removed in the same year contributes its duration to BOTH sums', async () => {
        await runDbQueries([
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (31, 'Game Both', 'game', ?, 3000)", params: [yearStart] },
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 31, 'finished', ?)", params: [yearEnd] }
        ]);

        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        const game = findType(counts, ArtifactType.GAME);
        expect(game.added).toBe(1);
        expect(game.removed).toBe(1);
        expect(game.addedDuration).toBe(3000);
        expect(game.removedDuration).toBe(3000);
    });

    // ── Contract: NULL / absent duration contributes 0 ─────────────────────────

    it('a NULL duration contributes 0 to the sum (other rows still counted)', async () => {
        await runDbQueries([
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (41, 'No duration', 'game', ?, NULL)", params: [yearStart] },
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (42, 'Has duration', 'game', ?, 1200)", params: [yearStart + 2000] },
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 41, 'wishlist', NULL)" },
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 42, 'wishlist', NULL)" }
        ]);

        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        const game = findType(counts, ArtifactType.GAME);
        expect(game.added).toBe(2);
        expect(game.addedDuration).toBe(1200);
    });

    it('durations are isolated per type (one type having rows does not leak into another)', async () => {
        await runDbQueries([
            { query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (51, 'Tracked game', 'game', ?, 900)", params: [yearStart] },
            { query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 51, 'wishlist', NULL)" }
        ]);

        const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
        expect(findType(counts, ArtifactType.GAME).addedDuration).toBe(900);
        for (const type of [ArtifactType.MOVIE, ArtifactType.TVSHOW, ArtifactType.ANIME, ArtifactType.MANGA]) {
            const entry = findType(counts, type);
            expect(entry.addedDuration).toBe(0);
            expect(entry.removedDuration).toBe(0);
        }
    });
});
