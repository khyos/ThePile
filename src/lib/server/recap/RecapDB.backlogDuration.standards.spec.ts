/**
 * Standards tests for the DURATION aggregation in RecapDB.getYearBacklogActivity.
 *
 * Written by reading RecapDB.ts. These exercise implementation details that the
 * contract tests (RecapDB.spec.ts) and the count-focused standards tests
 * (RecapDB.standards.spec.ts) do NOT cover:
 *
 *   - the RELEASE_DATE_SENTINEL guard applies to addedDuration (a sentinel-release
 *     artifact must not contribute to addedDuration, yet may still be a removed row),
 *   - addedDuration uses the releaseDate window while removedDuration uses the
 *     endDate window, so the two sums diverge for the same artifact,
 *   - the duration windows are inclusive at the exact yearStart/yearEnd boundaries.
 *
 * Uses the live in-memory SQLite harness (same style as RecapDB.standards.spec.ts).
 */

import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { ArtifactType } from '#lib/model/Artifact';
import { runDbQueries } from '#lib/server/database';
import { ArtifactDB } from '#lib/server/model/ArtifactDB';
import { UserDB } from '#lib/server/model/UserDB';
import { RecapDB } from './RecapDB';

describe('RecapDB.getYearBacklogActivity — duration aggregation internals', () => {
	const year = 2024;
	const yearStart = new Date(year, 0, 1).getTime();
	const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
	const RELEASE_DATE_SENTINEL = 7258118400000;

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
			{ query: "INSERT INTO user (id, username, password, role) VALUES (1, 'recap-dur-std', 'hash', 'user')" }
		]);
	});

	afterAll(async () => {
		await runDbQueries([
			{ query: 'DELETE FROM user_artifact' },
			{ query: 'DELETE FROM artifact' },
			{ query: 'DELETE FROM user' }
		]);
	});

	// ── RELEASE_DATE_SENTINEL guard applies to addedDuration ───────────────────
	//
	// A sentinel release date means "TBD / unknown". The addedDuration CASE must
	// exclude it (releaseDate != SENTINEL), but the removedDuration CASE keys off
	// endDate only, so a sentinel-release artifact removed in-year still adds to
	// removedDuration. This is the key divergence the contract tests skip.

	it('a sentinel-release artifact removed in-year contributes to removedDuration but NOT addedDuration', async () => {
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1001, 'TBD game', 'game', ?, 7200)", params: [RELEASE_DATE_SENTINEL] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1001, 'finished', ?)", params: [yearEnd] }
		]);

		const game = findType(await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd), ArtifactType.GAME);
		expect(game.added).toBe(0);
		expect(game.addedDuration).toBe(0);
		expect(game.removed).toBe(1);
		expect(game.removedDuration).toBe(7200);
	});

	it('sentinel release is excluded from addedDuration even when the sentinel falls inside the queried window', async () => {
		// Query a window that literally straddles the sentinel instant.
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1002, 'TBD movie', 'movie', ?, 5000)", params: [RELEASE_DATE_SENTINEL] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1003, 'Real movie', 'movie', ?, 3000)", params: [RELEASE_DATE_SENTINEL + 1] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status) VALUES (1, 1002, 'wishlist')" },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status) VALUES (1, 1003, 'wishlist')" }
		]);

		const movie = findType(
			await RecapDB.getYearBacklogActivity(1, RELEASE_DATE_SENTINEL - 1, RELEASE_DATE_SENTINEL + 2),
			ArtifactType.MOVIE
		);
		// Only the non-sentinel artifact (1003) is an addition.
		expect(movie.added).toBe(1);
		expect(movie.addedDuration).toBe(3000);
	});

	// ── addedDuration (releaseDate window) vs removedDuration (endDate window) ──
	//
	// For the SAME artifact the two windows are independent, so an artifact can
	// land in exactly one of the two sums depending on which date is in-year.

	it('addedDuration (releaseDate) and removedDuration (endDate) diverge for the same type', async () => {
		await runDbQueries([
			// A: released in-year, finished AFTER the year → added only
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1101, 'Added only', 'game', ?, 4000)", params: [yearStart + 1000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1101, 'finished', ?)", params: [yearEnd + 1000] },
			// B: released BEFORE the year, finished in-year → removed only
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1102, 'Removed only', 'game', ?, 9000)", params: [yearStart - 1000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1102, 'finished', ?)", params: [yearStart + 2000] }
		]);

		const game = findType(await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd), ArtifactType.GAME);
		expect(game.added).toBe(1);
		expect(game.addedDuration).toBe(4000);        // only artifact A
		expect(game.removed).toBe(1);
		expect(game.removedDuration).toBe(9000);       // only artifact B
	});

	it('addedDuration and removedDuration are independent sums over different row subsets within one type', async () => {
		await runDbQueries([
			// Two added-only (distinct durations), one removed-only, within GAME.
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1201, 'Add 1', 'game', ?, 1000)", params: [yearStart] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1202, 'Add 2', 'game', ?, 2500)", params: [yearStart + 5000] },
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1203, 'Rem 1', 'game', ?, 8000)", params: [yearStart - 5000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1201, 'wishlist', ?)", params: [yearEnd + 10000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1202, 'wishlist', ?)", params: [yearEnd + 10000] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1203, 'finished', ?)", params: [yearStart + 1] }
		]);

		const game = findType(await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd), ArtifactType.GAME);
		expect(game.addedDuration).toBe(3500);   // 1000 + 2500 (not 1203)
		expect(game.removedDuration).toBe(8000);  // only 1203
	});

	// ── Inclusive boundaries for the duration sums ─────────────────────────────

	it('durations at the exact yearStart/yearEnd boundaries are included in the sums', async () => {
		await runDbQueries([
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1301, 'Boundary', 'movie', ?, 3600)", params: [yearStart] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1301, 'finished', ?)", params: [yearEnd] }
		]);

		const movie = findType(await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd), ArtifactType.MOVIE);
		expect(movie.addedDuration).toBe(3600);
		expect(movie.removedDuration).toBe(3600);
	});

	it('durations one millisecond outside the window contribute to neither sum', async () => {
		await runDbQueries([
			// released 1ms before window, finished 1ms after window
			{ query: "INSERT INTO artifact (id, title, type, releaseDate, duration) VALUES (1401, 'Just outside', 'anime', ?, 4200)", params: [yearStart - 1] },
			{ query: "INSERT INTO user_artifact (userId, artifactId, status, endDate) VALUES (1, 1401, 'finished', ?)", params: [yearEnd + 1] }
		]);

		const anime = findType(await RecapDB.getYearBacklogActivity(1, yearStart, yearEnd), ArtifactType.ANIME);
		expect(anime.addedDuration).toBe(0);
		expect(anime.removedDuration).toBe(0);
	});
});
