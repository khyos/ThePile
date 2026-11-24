import { describe, it, expect, vi, beforeEach } from 'vitest';

// All mocks must be declared here (vi.mock is file-scoped)
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
import { HLTB } from '#lib/hltb/HLTB';
import { ITAD } from '#lib/itad/ITAD';
import { SensCritique } from '#lib/senscritique/SensCritique';
import { MetaCritic } from '#lib/metacritic/MetaCritic';
import { OpenCritic } from '#lib/opencritic/OpenCritic';
import { Steam } from '#lib/steam/Steam';
import { TMDB } from '#lib/tmdb/TMDB';
import { RottenTomatoes } from '#lib/rottentomatoes/RottenTomatoes';
import { Letterboxd } from '#lib/letterboxd/Letterboxd';
import { MAL } from '#lib/mal/MAL';
import { MangaBaka } from '#lib/mangabaka/MangaBaka';
import { ArtifactType } from '#lib/model/Artifact';
import { LinkType } from '#lib/model/Link';

// ---------------------------------------------------------------------------
// fromResults — implementation edge cases not covered by TDD contract tests
// ---------------------------------------------------------------------------

describe('fromResults — numeric id=0 is a valid candidate', () => {
    it('keeps an entry whose id is the number 0, coercing it to "0"', () => {
        // 0 is falsy in JS, but `0 != null` is true; String(0) = '0' which is non-empty
        const result = fromResults([{ id: 0, name: 'Zero-ID Entry' }]);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('0');
        expect(result[0].name).toBe('Zero-ID Entry');
    });
});

describe('fromResults — non-string name fields', () => {
    it('falls back to empty string when name is a number', () => {
        const result = fromResults([{ id: '1', name: 42 }]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('');
    });

    it('falls back to empty string when name is null', () => {
        const result = fromResults([{ id: '1', name: null }]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('');
    });

    it('falls back to empty string when name key is missing', () => {
        const result = fromResults([{ id: '1' }]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('');
    });

    it('falls back to empty string when name is an array', () => {
        const result = fromResults([{ id: '1', name: ['some', 'name'] }]);
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('');
    });
});

describe('fromResults — date edge cases', () => {
    it('does NOT set date when date is an empty string', () => {
        // The guard is: typeof rec.date === 'string' && rec.date (truthy)
        // Empty string is falsy, so it must not be added
        const result = fromResults([{ id: '1', name: 'Game', date: '' }]);
        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('date');
    });

    it('does NOT set date when date is a number', () => {
        const result = fromResults([{ id: '1', name: 'Game', date: 20240101 }]);
        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('date');
    });

    it('does NOT set date when date is null', () => {
        const result = fromResults([{ id: '1', name: 'Game', date: null }]);
        expect(result).toHaveLength(1);
        expect(result[0]).not.toHaveProperty('date');
    });
});

describe('fromResults — primitive elements in array are filtered out', () => {
    it('filters out string elements', () => {
        const result = fromResults(['not an object'] as unknown[]);
        expect(result).toEqual([]);
    });

    it('filters out number elements', () => {
        const result = fromResults([123] as unknown[]);
        expect(result).toEqual([]);
    });

    it('filters out boolean elements', () => {
        const result = fromResults([true] as unknown[]);
        expect(result).toEqual([]);
    });

    it('filters out null elements', () => {
        const result = fromResults([null] as unknown[]);
        expect(result).toEqual([]);
    });

    it('keeps valid objects when mixed with primitives', () => {
        const result = fromResults([
            'a string',
            null,
            42,
            { id: '7', name: 'Valid' },
            true
        ] as unknown[]);
        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({ id: '7', name: 'Valid' });
    });
});

describe('fromResults — empty string id is filtered out', () => {
    it('filters out entries where id is an explicit empty string', () => {
        // rec.id = '' → String('') = '' → !'' is true → filtered
        const result = fromResults([{ id: '', name: 'Empty string ID' }]);
        expect(result).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// getCandidates — all dispatch combinations not covered by the TDD tests
// (TDD already covers GAME+IGDB; this covers the remaining 20 paths)
// ---------------------------------------------------------------------------

describe('getCandidates — GAME dispatches (remaining)', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    const GAME_RESULT = [{ id: '1', name: 'Dark Souls' }];

    it('dispatches GAME+HLTB to HLTB.searchGame', async () => {
        vi.mocked(HLTB.searchGame).mockResolvedValue(GAME_RESULT as never);
        const result = await getCandidates(ArtifactType.GAME, LinkType.HLTB, 'dark souls');
        expect(HLTB.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toEqual([{ id: '1', name: 'Dark Souls' }]);
    });

    it('dispatches GAME+SENSCRITIQUE to SensCritique.searchGame', async () => {
        vi.mocked(SensCritique.searchGame).mockResolvedValue(GAME_RESULT as never);
        const result = await getCandidates(ArtifactType.GAME, LinkType.SENSCRITIQUE, 'dark souls');
        expect(SensCritique.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toHaveLength(1);
    });

    it('dispatches GAME+METACRITIC to MetaCritic.searchGame', async () => {
        vi.mocked(MetaCritic.searchGame).mockResolvedValue(GAME_RESULT as never);
        const result = await getCandidates(ArtifactType.GAME, LinkType.METACRITIC, 'dark souls');
        expect(MetaCritic.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toHaveLength(1);
    });

    it('dispatches GAME+OPENCRITIC to OpenCritic.searchGame', async () => {
        vi.mocked(OpenCritic.searchGame).mockResolvedValue(GAME_RESULT as never);
        const result = await getCandidates(ArtifactType.GAME, LinkType.OPENCRITIC, 'dark souls');
        expect(OpenCritic.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toHaveLength(1);
    });

    it('dispatches GAME+STEAM to Steam.searchGame', async () => {
        vi.mocked(Steam.searchGame).mockResolvedValue(GAME_RESULT as never);
        const result = await getCandidates(ArtifactType.GAME, LinkType.STEAM, 'dark souls');
        expect(Steam.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toHaveLength(1);
    });

    it('dispatches GAME+ITAD to ITAD.searchGame', async () => {
        vi.mocked(ITAD.searchGame).mockResolvedValue(GAME_RESULT as never);
        const result = await getCandidates(ArtifactType.GAME, LinkType.ITAD, 'dark souls');
        expect(ITAD.searchGame).toHaveBeenCalledWith('dark souls');
        expect(result).toHaveLength(1);
    });
});

describe('getCandidates — MOVIE dispatches', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    const MOVIE_RESULT = [{ id: '10', name: 'Inception', date: '2010-07-16' }];

    it('dispatches MOVIE+TMDB to TMDB.searchMovie', async () => {
        vi.mocked(TMDB.searchMovie).mockResolvedValue(MOVIE_RESULT as never);
        const result = await getCandidates(ArtifactType.MOVIE, LinkType.TMDB, 'inception');
        expect(TMDB.searchMovie).toHaveBeenCalledWith('inception');
        expect(result).toEqual([{ id: '10', name: 'Inception', date: '2010-07-16' }]);
    });

    it('dispatches MOVIE+SENSCRITIQUE to SensCritique.searchMovie', async () => {
        vi.mocked(SensCritique.searchMovie).mockResolvedValue(MOVIE_RESULT as never);
        const result = await getCandidates(ArtifactType.MOVIE, LinkType.SENSCRITIQUE, 'inception');
        expect(SensCritique.searchMovie).toHaveBeenCalledWith('inception');
        expect(result).toHaveLength(1);
    });

    it('dispatches MOVIE+METACRITIC to MetaCritic.searchMovie', async () => {
        vi.mocked(MetaCritic.searchMovie).mockResolvedValue(MOVIE_RESULT as never);
        const result = await getCandidates(ArtifactType.MOVIE, LinkType.METACRITIC, 'inception');
        expect(MetaCritic.searchMovie).toHaveBeenCalledWith('inception');
        expect(result).toHaveLength(1);
    });

    it('dispatches MOVIE+ROTTEN_TOMATOES to RottenTomatoes.searchMovie', async () => {
        vi.mocked(RottenTomatoes.searchMovie).mockResolvedValue(MOVIE_RESULT as never);
        const result = await getCandidates(ArtifactType.MOVIE, LinkType.ROTTEN_TOMATOES, 'inception');
        expect(RottenTomatoes.searchMovie).toHaveBeenCalledWith('inception');
        expect(result).toHaveLength(1);
    });

    it('dispatches MOVIE+LETTERBOXD to Letterboxd.searchMovie', async () => {
        vi.mocked(Letterboxd.searchMovie).mockResolvedValue(MOVIE_RESULT as never);
        const result = await getCandidates(ArtifactType.MOVIE, LinkType.LETTERBOXD, 'inception');
        expect(Letterboxd.searchMovie).toHaveBeenCalledWith('inception');
        expect(result).toHaveLength(1);
    });
});

describe('getCandidates — TVSHOW dispatches', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    const TVSHOW_RESULT = [{ id: '20', name: 'Breaking Bad' }];

    it('dispatches TVSHOW+TMDB to TMDB.searchTvshow', async () => {
        vi.mocked(TMDB.searchTvshow).mockResolvedValue(TVSHOW_RESULT as never);
        const result = await getCandidates(ArtifactType.TVSHOW, LinkType.TMDB, 'breaking bad');
        expect(TMDB.searchTvshow).toHaveBeenCalledWith('breaking bad');
        expect(result).toHaveLength(1);
    });

    it('dispatches TVSHOW+SENSCRITIQUE to SensCritique.searchTvshow', async () => {
        vi.mocked(SensCritique.searchTvshow).mockResolvedValue(TVSHOW_RESULT as never);
        const result = await getCandidates(ArtifactType.TVSHOW, LinkType.SENSCRITIQUE, 'breaking bad');
        expect(SensCritique.searchTvshow).toHaveBeenCalledWith('breaking bad');
        expect(result).toHaveLength(1);
    });

    it('dispatches TVSHOW+METACRITIC to MetaCritic.searchTvshow', async () => {
        vi.mocked(MetaCritic.searchTvshow).mockResolvedValue(TVSHOW_RESULT as never);
        const result = await getCandidates(ArtifactType.TVSHOW, LinkType.METACRITIC, 'breaking bad');
        expect(MetaCritic.searchTvshow).toHaveBeenCalledWith('breaking bad');
        expect(result).toHaveLength(1);
    });

    it('dispatches TVSHOW+ROTTEN_TOMATOES to RottenTomatoes.searchTvshow', async () => {
        vi.mocked(RottenTomatoes.searchTvshow).mockResolvedValue(TVSHOW_RESULT as never);
        const result = await getCandidates(ArtifactType.TVSHOW, LinkType.ROTTEN_TOMATOES, 'breaking bad');
        expect(RottenTomatoes.searchTvshow).toHaveBeenCalledWith('breaking bad');
        expect(result).toHaveLength(1);
    });
});

describe('getCandidates — ANIME dispatches', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    const ANIME_RESULT = [{ id: '30', name: 'Naruto' }];

    it('dispatches ANIME+MAL to MAL.searchAnime', async () => {
        vi.mocked(MAL.searchAnime).mockResolvedValue(ANIME_RESULT as never);
        const result = await getCandidates(ArtifactType.ANIME, LinkType.MAL, 'naruto');
        expect(MAL.searchAnime).toHaveBeenCalledWith('naruto');
        expect(result).toHaveLength(1);
    });

    it('dispatches ANIME+SENSCRITIQUE to SensCritique.searchTvshow (not searchGame or searchAnime)', async () => {
        // Implementation routes anime SensCritique queries to searchTvshow
        vi.mocked(SensCritique.searchTvshow).mockResolvedValue(ANIME_RESULT as never);
        const result = await getCandidates(ArtifactType.ANIME, LinkType.SENSCRITIQUE, 'naruto');
        expect(SensCritique.searchTvshow).toHaveBeenCalledWith('naruto');
        expect(SensCritique.searchGame).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
    });
});

describe('getCandidates — MANGA dispatches', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    const MANGA_RESULT = [{ id: '40', name: 'One Piece' }];

    it('dispatches MANGA+MAL to MAL.searchManga', async () => {
        vi.mocked(MAL.searchManga).mockResolvedValue(MANGA_RESULT as never);
        const result = await getCandidates(ArtifactType.MANGA, LinkType.MAL, 'one piece');
        expect(MAL.searchManga).toHaveBeenCalledWith('one piece');
        expect(result).toHaveLength(1);
    });

    it('dispatches MANGA+SENSCRITIQUE to SensCritique.searchBD (not searchTvshow or searchGame)', async () => {
        // Implementation routes manga SensCritique queries to searchBD (BD = bande dessinée)
        vi.mocked(SensCritique.searchBD).mockResolvedValue(MANGA_RESULT as never);
        const result = await getCandidates(ArtifactType.MANGA, LinkType.SENSCRITIQUE, 'one piece');
        expect(SensCritique.searchBD).toHaveBeenCalledWith('one piece');
        expect(SensCritique.searchTvshow).not.toHaveBeenCalled();
        expect(SensCritique.searchGame).not.toHaveBeenCalled();
        expect(result).toHaveLength(1);
    });

    it('dispatches MANGA+MANGABAKA to MangaBaka.searchManga', async () => {
        vi.mocked(MangaBaka.searchManga).mockResolvedValue(MANGA_RESULT as never);
        const result = await getCandidates(ArtifactType.MANGA, LinkType.MANGABAKA, 'one piece');
        expect(MangaBaka.searchManga).toHaveBeenCalledWith('one piece');
        expect(result).toHaveLength(1);
    });
});

describe('getCandidates — unhandled ArtifactType enum values return []', () => {
    beforeEach(() => { vi.clearAllMocks(); });

    it('returns [] for ANIME_EPISODE (no dispatch exists)', async () => {
        const result = await getCandidates(ArtifactType.ANIME_EPISODE, LinkType.MAL, 'query');
        expect(result).toEqual([]);
    });

    it('returns [] for TVSHOW_EPISODE (no dispatch exists)', async () => {
        const result = await getCandidates(ArtifactType.TVSHOW_EPISODE, LinkType.TMDB, 'query');
        expect(result).toEqual([]);
    });

    it('returns [] for COMICS (no dispatch exists)', async () => {
        const result = await getCandidates(ArtifactType.COMICS, LinkType.SENSCRITIQUE, 'query');
        expect(result).toEqual([]);
    });
});
