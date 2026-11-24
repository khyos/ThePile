/**
 * Standards tests for the bulk-link page load function
 *
 * These tests complement the TDD contract tests by exercising implementation
 * paths that are only visible after reading the code:
 *
 * ROOT_ARTIFACT_TYPES Set validation:
 *   - Each of the five accepted types (game, movie, tvshow, anime, manga) is recognised
 *   - Child / sub-types that look similar (anime_episode, tvshow_episode, manga_chapter) are rejected
 *   - Uppercase spellings ('GAME', 'MOVIE') are rejected (case-sensitive Set lookup)
 *
 * getLinkTypesByArtifactType integration:
 *   - The load function accepts any link type that the model returns for the given artifact type
 *   - Cross-type link assignments (e.g. game + TMDB) are correctly rejected
 *   - The load function passes exactly the original type and linkType strings back to the caller
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('#lib/model/User', () => ({
    User: { deserialize: vi.fn() },
    UserRights: { EDIT_ARTIFACT: 'edit_artifact' },
}));

vi.mock('#lib/server/model/LinkDB', () => ({
    LinkDB: { getArtifactsMissingLink: vi.fn() },
}));

import { load } from './+page.server';
import { User } from '#lib/model/User';
import { LinkDB } from '#lib/server/model/LinkDB';

type LoadData = { type: string; linkType: string; artifacts: { id: number; title: string }[] };

function makeEvent({ type, linkType }: { type?: string; linkType?: string } = {}) {
    const url = new URL('http://localhost/tools/bulk-link');
    if (type !== undefined) url.searchParams.set('type', type);
    if (linkType !== undefined) url.searchParams.set('linkType', linkType);
    return { url, locals: { user: {} } } as never;
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(User.deserialize).mockReturnValue({ hasRight: () => true } as never);
    vi.mocked(LinkDB.getArtifactsMissingLink).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// ROOT_ARTIFACT_TYPES Set — all five accepted types
// ---------------------------------------------------------------------------

describe('bulk-link load — all five root artifact types are accepted', () => {
    const validCombos: [string, string][] = [
        ['game',   'IGDB'],
        ['movie',  'TMDB'],
        ['tvshow', 'TMDB'],
        ['anime',  'MAL'],
        ['manga',  'MAL'],
    ];

    for (const [type, linkType] of validCombos) {
        it(`accepts type="${type}" with linkType="${linkType}" and calls LinkDB`, async () => {
            const result = await load(makeEvent({ type, linkType })) as LoadData;

            expect(result.type).toBe(type);
            expect(result.linkType).toBe(linkType);
            expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith(type, linkType);
        });
    }
});

// ---------------------------------------------------------------------------
// ROOT_ARTIFACT_TYPES Set — child/sub-types must be rejected
// ---------------------------------------------------------------------------

describe('bulk-link load — child artifact types are rejected', () => {
    const childTypes = ['anime_episode', 'tvshow_episode', 'tvshow_season', 'manga_chapter', 'manga_volume', 'comics'];

    for (const childType of childTypes) {
        it(`rejects type="${childType}" (not a root artifact type)`, async () => {
            const result = await load(makeEvent({ type: childType, linkType: 'MAL' }));

            expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
            expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
        });
    }
});

// ---------------------------------------------------------------------------
// ROOT_ARTIFACT_TYPES Set — case sensitivity
// ---------------------------------------------------------------------------

describe('bulk-link load — type lookup is case-sensitive', () => {
    it('rejects uppercase "GAME" (enum values are lowercase)', async () => {
        const result = await load(makeEvent({ type: 'GAME', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });

    it('rejects mixed-case "Game"', async () => {
        const result = await load(makeEvent({ type: 'Game', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getLinkTypesByArtifactType integration — cross-type combinations
// ---------------------------------------------------------------------------

describe('bulk-link load — cross-type link assignments are rejected', () => {
    it('rejects game + TMDB (TMDB is not valid for games)', async () => {
        const result = await load(makeEvent({ type: 'game', linkType: 'TMDB' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });

    it('rejects movie + IGDB (IGDB is not valid for movies)', async () => {
        const result = await load(makeEvent({ type: 'movie', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });

    it('rejects tvshow + MAL (MAL is not valid for tvshows)', async () => {
        const result = await load(makeEvent({ type: 'tvshow', linkType: 'MAL' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });

    it('rejects anime + IGDB (IGDB is not valid for anime)', async () => {
        const result = await load(makeEvent({ type: 'anime', linkType: 'IGDB' }));

        expect(result).toEqual({ artifacts: [], type: '', linkType: '' });
        expect(LinkDB.getArtifactsMissingLink).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// getLinkTypesByArtifactType integration — valid combos beyond game/IGDB
// ---------------------------------------------------------------------------

describe('bulk-link load — link types that are only valid for specific artifact types', () => {
    it('accepts tvshow + ROTTEN_TOMATOES', async () => {
        const result = await load(makeEvent({ type: 'tvshow', linkType: 'ROTTEN_TOMATOES' })) as LoadData;

        expect(result.type).toBe('tvshow');
        expect(result.linkType).toBe('ROTTEN_TOMATOES');
        expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith('tvshow', 'ROTTEN_TOMATOES');
    });

    it('accepts manga + MANGABAKA', async () => {
        const result = await load(makeEvent({ type: 'manga', linkType: 'MANGABAKA' })) as LoadData;

        expect(result.type).toBe('manga');
        expect(result.linkType).toBe('MANGABAKA');
        expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith('manga', 'MANGABAKA');
    });

    it('accepts game + STEAM', async () => {
        const result = await load(makeEvent({ type: 'game', linkType: 'STEAM' })) as LoadData;

        expect(result.type).toBe('game');
        expect(result.linkType).toBe('STEAM');
        expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith('game', 'STEAM');
    });

    it('accepts movie + LETTERBOXD', async () => {
        const result = await load(makeEvent({ type: 'movie', linkType: 'LETTERBOXD' })) as LoadData;

        expect(result.type).toBe('movie');
        expect(result.linkType).toBe('LETTERBOXD');
        expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith('movie', 'LETTERBOXD');
    });

    it('accepts anime + SENSCRITIQUE', async () => {
        const result = await load(makeEvent({ type: 'anime', linkType: 'SENSCRITIQUE' })) as LoadData;

        expect(result.type).toBe('anime');
        expect(result.linkType).toBe('SENSCRITIQUE');
        expect(LinkDB.getArtifactsMissingLink).toHaveBeenCalledWith('anime', 'SENSCRITIQUE');
    });
});

// ---------------------------------------------------------------------------
// Return value shape
// ---------------------------------------------------------------------------

describe('bulk-link load — return value passes type and linkType through unchanged', () => {
    it('echoes back the exact type and linkType strings from the URL params', async () => {
        vi.mocked(LinkDB.getArtifactsMissingLink).mockResolvedValue([
            { id: 1, title: 'Alpha' },
            { id: 2, title: 'Beta' },
        ] as never);

        const result = await load(makeEvent({ type: 'manga', linkType: 'MAL' }));

        expect(result).toEqual({
            artifacts: [{ id: 1, title: 'Alpha' }, { id: 2, title: 'Beta' }],
            type: 'manga',
            linkType: 'MAL',
        });
    });
});
