import { ArtifactType } from '#lib/model/Artifact';
import { UserArtifactStatus } from '#lib/model/UserArtifact';
import { getDbRows } from '#lib/server/database';
import type { BacklogActivityCount, RecapEntry } from '#lib/model/recap/RecapTypes';

const TRACKED_TYPES = [
	ArtifactType.GAME,
	ArtifactType.MOVIE,
	ArtifactType.TVSHOW,
	ArtifactType.TVSHOW_SEASON,
	ArtifactType.TVSHOW_EPISODE,
	ArtifactType.ANIME,
	ArtifactType.ANIME_EPISODE,
	ArtifactType.MANGA,
	ArtifactType.MANGA_VOLUME,
	ArtifactType.MANGA_CHAPTER,
	ArtifactType.COMICS
];

const MAIN_ARTIFACT_TYPES = [
	ArtifactType.GAME,
	ArtifactType.MOVIE,
	ArtifactType.TVSHOW,
	ArtifactType.ANIME,
	ArtifactType.MANGA
];

const RELEASE_DATE_SENTINEL = 7258118400000;

type RawEntry = {
	id: number;
	title: string;
	type: ArtifactType;
	duration: number;
	releaseDate: number;
	score: number | null;
	endDate: number;
	startDate: number | null;
};

type RawBacklogActivityCount = {
	type: ArtifactType;
	added: number;
	removed: number;
};

type RawGenre = {
	name: string;
	count: number;
};

export const RecapDB = {
	async getYearEntries(userId: number, yearStart: number, yearEnd: number): Promise<RecapEntry[]> {
		const placeholders = TRACKED_TYPES.map(() => '?').join(', ');
		const rows = await getDbRows<RawEntry>(
			`SELECT artifact.id, artifact.title, artifact.type, artifact.duration,
			        artifact.releaseDate, user_artifact.score, user_artifact.endDate,
			        user_artifact.startDate
			 FROM user_artifact
			 JOIN artifact ON artifact.id = user_artifact.artifactId
			 WHERE user_artifact.userId = ?
			   AND user_artifact.status = ?
			   AND user_artifact.endDate >= ?
			   AND user_artifact.endDate <= ?
			   AND artifact.type IN (${placeholders})`,
			[userId, UserArtifactStatus.FINISHED, yearStart, yearEnd, ...TRACKED_TYPES]
		);
		return rows;
	},

	async getYearBacklogActivity(userId: number, yearStart: number, yearEnd: number): Promise<BacklogActivityCount[]> {
		const placeholders = MAIN_ARTIFACT_TYPES.map(() => '?').join(', ');
		const rows = await getDbRows<RawBacklogActivityCount>(
			`SELECT artifact.type AS type,
			        COUNT(DISTINCT CASE
			            WHEN artifact.releaseDate >= ? AND artifact.releaseDate <= ?
			                 AND artifact.releaseDate != ? THEN artifact.id
			        END) AS added,
			        COUNT(DISTINCT CASE
			            WHEN user_artifact.endDate >= ? AND user_artifact.endDate <= ? THEN artifact.id
			        END) AS removed
			 FROM user_artifact
			 JOIN artifact ON artifact.id = user_artifact.artifactId
			 WHERE user_artifact.userId = ?
			   AND user_artifact.status IS NOT NULL
			   AND artifact.type IN (${placeholders})
			 GROUP BY artifact.type`,
			[yearStart, yearEnd, RELEASE_DATE_SENTINEL, yearStart, yearEnd, userId, ...MAIN_ARTIFACT_TYPES]
		);

		const countsByType = new Map(rows.map(row => [row.type, row]));
		return MAIN_ARTIFACT_TYPES.map(type => {
			const counts = countsByType.get(type);
			return { type, added: counts?.added ?? 0, removed: counts?.removed ?? 0 };
		});
	},

	async getTopGenres(
		userId: number,
		yearStart: number,
		yearEnd: number
	): Promise<{ name: string; count: number }[]> {
		const rows = await getDbRows<RawGenre>(
			`SELECT title AS name, COUNT(*) AS count FROM (
			   SELECT g.title
			   FROM game_game_genre map
			   JOIN game_genre g ON map.genreId = g.id
			   JOIN user_artifact ua ON ua.artifactId = map.artifactId
			   WHERE ua.userId = ? AND ua.status = ? AND ua.endDate >= ? AND ua.endDate <= ?

			   UNION ALL

			   SELECT g.title
			   FROM movie_movie_genre map
			   JOIN movie_genre g ON map.genreId = g.id
			   JOIN user_artifact ua ON ua.artifactId = map.artifactId
			   WHERE ua.userId = ? AND ua.status = ? AND ua.endDate >= ? AND ua.endDate <= ?

			   UNION ALL

			   SELECT g.title
			   FROM tvshow_tvshow_genre map
			   JOIN tvshow_genre g ON map.genreId = g.id
			   JOIN user_artifact ua ON ua.artifactId = map.artifactId
			   WHERE ua.userId = ? AND ua.status = ? AND ua.endDate >= ? AND ua.endDate <= ?

			   UNION ALL

			   SELECT g.title
			   FROM anime_anime_genre map
			   JOIN anime_genre g ON map.genreId = g.id
			   JOIN user_artifact ua ON ua.artifactId = map.artifactId
			   WHERE ua.userId = ? AND ua.status = ? AND ua.endDate >= ? AND ua.endDate <= ?

			   UNION ALL

			   SELECT g.title
			   FROM manga_manga_genre map
			   JOIN manga_genre g ON map.genreId = g.id
			   JOIN user_artifact ua ON ua.artifactId = map.artifactId
			   WHERE ua.userId = ? AND ua.status = ? AND ua.endDate >= ? AND ua.endDate <= ?
			) all_genres
			GROUP BY title
			ORDER BY count DESC
			LIMIT 3`,
			[
				userId, UserArtifactStatus.FINISHED, yearStart, yearEnd,
				userId, UserArtifactStatus.FINISHED, yearStart, yearEnd,
				userId, UserArtifactStatus.FINISHED, yearStart, yearEnd,
				userId, UserArtifactStatus.FINISHED, yearStart, yearEnd,
				userId, UserArtifactStatus.FINISHED, yearStart, yearEnd
			]
		);
		return rows;
	}
};
