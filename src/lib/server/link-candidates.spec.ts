import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external service modules used by getCandidates
vi.mock('#lib/igdb/IGDB', () => ({ IGDB: { searchGame: vi.fn() } }));
vi.mock('#lib/hltb/HLTB', () => ({ HLTB: { searchGame: vi.fn() } }));
vi.mock('#lib/itad/ITAD', () => ({ ITAD: { searchGame: vi.fn() } }));
vi.mock('#lib/senscritique/SensCritique', () => ({
    SensCritique: { searchGame: vi.fn(), searchMovie: vi.fn(), searchTvshow: vi.fn(), searchBD: vi.fn() }
}));
vi.mock('#lib/metacritic/MetaCritic', () => ({
    MetaCritic: { searchGame: vi.fn(), searchMovie: vi.fn(), searchTvshow: vi.fn() }
}));
vi.mock('#lib/opencritic/OpenCritic', () => ({ OpenCritic: { searchGame: vi.fn() } }));
vi.mock('#lib/steam/Steam', () => ({ Steam: { searchGame: vi.fn() } }));
vi.mock('#lib/tmdb/TMDB', () => ({ TMDB: { searchMovie: vi.fn(), searchTvshow: vi.fn() } }));
vi.mock('#lib/rottentomatoes/RottenTomatoes', () => ({
    RottenTomatoes: { searchMovie: vi.fn(), searchTvshow: vi.fn() }
}));
vi.mock('#lib/letterboxd/Letterboxd', () => ({ Letterboxd: { searchMovie: vi.fn() } }));
vi.mock('#lib/mal/MAL', () => ({ MAL: { searchAnime: vi.fn(), searchManga: vi.fn() } }));
vi.mock('#lib/mangabaka/MangaBaka', () => ({ MangaBaka: { searchManga: vi.fn() } }));

import { fromResults, getCandidates } from './link-candidates';
import { IGDB } from '#lib/igdb/IGDB';
import { ArtifactType } from '#lib/model/Artifact';
import { LinkType } from '#lib/model/Link';

/**
 * Contract: fromResults(results)
 *
 * - Normalizes results to { id: string, name: string, date?: string }[]
 * - Filters out entries with null/undefined/`"undefined"` id
 * - Converts numeric id to string
 */
describe('fromResults — normalizes raw API results to Candidate[]', () => {
    it('returns a normalized candidate with id, name, and date', () => {
        const result = fromResults([{ id: '123', name: 'Some Game', date: '2024-01-01' }]);
        expect(result).toEqual([{ id: '123', name: 'Some Game', date: '2024-01-01' }]);
    });

    it('returns a candidate without date when no date is present', () => {
        const result = fromResults([{ id: '123', name: 'Some Game' }]);
        expect(result).toEqual([{ id: '123', name: 'Some Game' }]);
        expect(result[0]).not.toHaveProperty('date');
    });

    it('converts a numeric id to a string', () => {
        const result = fromResults([{ id: 42, name: 'Numeric ID Game' }]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('42');
        expect(typeof result[0].id).toBe('string');
    });

    it('filters out entries where id is null', () => {
        const result = fromResults([{ id: null, name: 'No ID Game' }]);
        expect(result).toEqual([]);
    });

    it('filters out entries where id is undefined (missing key)', () => {
        const result = fromResults([{ name: 'Missing ID Game' }]);
        expect(result).toEqual([]);
    });

    it('filters out entries where id is the string "undefined"', () => {
        const result = fromResults([{ id: 'undefined', name: 'String Undefined ID' }]);
        expect(result).toEqual([]);
    });

    it('returns [] for null input', () => {
        expect(fromResults(null)).toEqual([]);
    });

    it('returns [] for undefined input', () => {
        expect(fromResults(undefined)).toEqual([]);
    });

    it('returns [] for an empty array', () => {
        expect(fromResults([])).toEqual([]);
    });

    it('handles a mix of valid and invalid entries, keeping only valid ones', () => {
        const result = fromResults([
            { id: '1', name: 'Valid' },
            { id: null, name: 'Null ID' },
            { id: 'undefined', name: 'String Undefined' },
            { id: 2, name: 'Numeric ID' },
            { name: 'Missing ID' }
        ]);
        expect(result).toHaveLength(2);
        expect(result[0]).toEqual({ id: '1', name: 'Valid' });
        expect(result[1]).toEqual({ id: '2', name: 'Numeric ID' });
    });

    it('id is always a string in the returned candidates', () => {
        const result = fromResults([{ id: 999, name: 'Coerced' }]);
        expect(typeof result[0].id).toBe('string');
    });
});

/**
 * Contract: getCandidates(artifactType, linkType, query)
 *
 * - Returns Candidate[] for a known (artifactType, linkType) combination
 * - Returns [] for an unknown combination
 * - Returns [] when the external service throws
 */
describe('getCandidates — dispatches to the correct external service', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns Candidate[] for a known combination (GAME, IGDB)', async () => {
        vi.mocked(IGDB.searchGame).mockResolvedValue([
            { id: '1', name: 'Dark Souls' }
        ] as never);

        const result = await getCandidates(ArtifactType.GAME, LinkType.IGDB, 'dark souls');

        expect(IGDB.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toEqual([{ id: '1', name: 'Dark Souls' }]);
    });

    it('returns [] for an unknown artifactType', async () => {
        const result = await getCandidates('unknown_type', LinkType.IGDB, 'query');
        expect(result).toEqual([]);
    });

    it('returns [] for a known artifactType with an unknown linkType', async () => {
        const result = await getCandidates(ArtifactType.GAME, 'UNKNOWN_LINK', 'query');
        expect(result).toEqual([]);
    });

    it('returns [] when the external service throws', async () => {
        vi.mocked(IGDB.searchGame).mockRejectedValue(new Error('Service unavailable'));

        const result = await getCandidates(ArtifactType.GAME, LinkType.IGDB, 'query');
        expect(result).toEqual([]);
    });
});
