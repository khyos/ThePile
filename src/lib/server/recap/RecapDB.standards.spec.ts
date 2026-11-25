/**
 * Standards tests for RecapDB.getYearBacklogActivity.
 * These complement TDD coverage with live-SQLite checks of boundaries,
 * user/status filtering, distinct counting, and the all-types result shape.
 */

import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { ArtifactType } from '#lib/model/Artifact';
import { UserArtifactStatus } from '#lib/model/UserArtifact';
import { runDbQueries } from '#lib/server/database';
import { ArtifactDB } from '#lib/server/model/ArtifactDB';
import { UserDB } from '#lib/server/model/UserDB';
import { RecapDB } from './RecapDB';

describe('RecapDB.getYearBacklogActivity', () => {
	const year = 2024;
	const yearStart = new Date(year, 0, 1).getTime();
	const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();

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
			{ query: "INSERT INTO user (id, username, password, role) VALUES (1, 'recap-user-1', 'hash', 'user')" },
			{ query: "INSERT INTO user (id, username, password, role) VALUES (2, 'recap-user-2', 'hash', 'user')" }
		]);
	});

	afterAll(async () => {
		await runDbQueries([
			{ query: 'DELETE FROM user_artifact' },
			{ query: 'DELETE FROM artifact' },
			{ query: 'DELETE FROM user' }
		]);
	});

	it('includes both inclusive year boundaries and excludes adjacent timestamps', async () => {
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (101, 'Start game', 'game', ?)", params: [yearStart] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (102, 'End movie', 'movie', ?)", params: [yearEnd] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (103, 'Before year', 'anime', ?)", params: [yearStart - 1] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (104, 'After year', 'manga', ?)", params: [yearEnd + 1] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (105, 'Finish start', 'tvshow', 0)", params: [] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 101, 'finished', NULL)" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 102, 'finished', NULL)" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 103, 'finished', NULL)" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 104, 'finished', NULL)" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 105, 'finished', ?)", params: [yearStart] }
		]);

		const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
		expect(counts.find(c => c.type === ArtifactType.GAME)).toEqual({
			type: ArtifactType.GAME, added: 1, removed: 0
		});
		expect(counts.find(c => c.type === ArtifactType.MOVIE)).toEqual({
			type: ArtifactType.MOVIE, added: 1, removed: 0
		});
		expect(counts.find(c => c.type === ArtifactType.TVSHOW)).toEqual({
			type: ArtifactType.TVSHOW, added: 0, removed: 1
		});
		expect(counts.find(c => c.type === ArtifactType.ANIME)?.added).toBe(0);
		expect(counts.find(c => c.type === ArtifactType.MANGA)?.added).toBe(0);
	});

	it('uses the requested user and excludes rows whose status is NULL', async () => {
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (201, 'User one game', 'game', ?)", params: [yearStart + 1000] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (202, 'User two game', 'game', ?)", params: [yearStart + 2000] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (203, 'No status movie', 'movie', ?)", params: [yearStart + 3000] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (204, 'Ongoing anime', 'anime', ?)", params: [yearStart + 4000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 201, 'finished', ?)", params: [yearStart + 5000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (2, 202, 'finished', ?)", params: [yearStart + 6000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 203, NULL, ?)", params: [yearStart + 7000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 204, 'ongoing', ?)", params: [yearStart + 8000] }
		]);

		const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);

		expect(counts.find(c => c.type === ArtifactType.GAME)).toEqual({
			type: ArtifactType.GAME, added: 1, removed: 1
		});
		expect(counts.find(c => c.type === ArtifactType.MOVIE)).toEqual({
			type: ArtifactType.MOVIE, added: 0, removed: 0
		});
		expect(counts.find(c => c.type === ArtifactType.ANIME)).toEqual({
			type: ArtifactType.ANIME, added: 1, removed: 1
		});
	});

	it('counts an artifact once when it is both added and removed in the year', async () => {
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (301, 'One game', 'game', ?)", params: [yearStart] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 301, ?, ?)",
				params: [UserArtifactStatus.FINISHED, yearEnd] }
		]);

		const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);
		expect(counts.find(c => c.type === ArtifactType.GAME)).toEqual({
			type: ArtifactType.GAME, added: 1, removed: 1
		});
	});

	it('does not count the unknown release-date sentinel as an addition', async () => {
		const releaseDateSentinel = 7258118400000;
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (351, 'Unknown release', 'game', ?)", params: [releaseDateSentinel] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (352, 'Later release', 'game', ?)", params: [releaseDateSentinel + 1] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status) VALUES (1, 351, 'wishlist')" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status) VALUES (1, 352, 'wishlist')" }
		]);

		const sentinelOnlyCounts = await RecapDB.getYearBacklogActivity(1, releaseDateSentinel, releaseDateSentinel);
		const surroundingCounts = await RecapDB.getYearBacklogActivity(1, releaseDateSentinel - 1, releaseDateSentinel + 2);
		expect(sentinelOnlyCounts.find(c => c.type === ArtifactType.GAME)?.added).toBe(0);
		expect(surroundingCounts.find(c => c.type === ArtifactType.GAME)?.added).toBe(1);
	});

	it('returns a stable five-main-type shape with numeric zero-fill for types without activity', async () => {
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (401, 'Tracked game', 'game', ?)", params: [yearStart] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate) VALUES (402, 'Untracked comic', 'comics', ?)", params: [yearStart] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status) VALUES (1, 401, 'wishlist')" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status) VALUES (1, 402, 'wishlist')" }
		]);

		const counts = await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd);

		expect(counts.map(c => c.type)).toEqual([
			ArtifactType.GAME,
			ArtifactType.MOVIE,
			ArtifactType.TVSHOW,
			ArtifactType.ANIME,
			ArtifactType.MANGA
		]);
		expect(counts.every(c => typeof c.added === 'number' && typeof c.removed === 'number')).toBe(true);
		expect(counts.find(c => c.type === ArtifactType.GAME)?.added).toBe(1);
		expect(counts.find(c => c.type === ArtifactType.MOVIE)).toEqual({
			type: ArtifactType.MOVIE, added: 0, removed: 0
		});
	});
});
