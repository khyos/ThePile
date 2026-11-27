import { describe, expect, test } from 'vitest';
import { LinkType, getProtectedLinkTypes, isLinkTypeRemovable } from './Link';
import { ArtifactType } from './Artifact';

/**
 * Contract tests for the "remove external links" feature's pure model functions.
 *
 * Contract (from the feature spec):
 *   getProtectedLinkTypes(artifactType) returns the non-removable "primary" link
 *   types per artifact type, exactly:
 *     GAME   -> [IGDB]
 *     MOVIE  -> [TMDB]
 *     TVSHOW -> [TMDB]
 *     ANIME  -> [MAL]
 *     MANGA  -> [MAL, MANGABAKA]
 *
 *   isLinkTypeRemovable(artifactType, linkType) is true iff linkType is a VALID
 *   link type for artifactType AND is NOT in that type's protected list.
 *   A link type not valid for the artifact type at all returns false.
 */
describe('getProtectedLinkTypes', () => {
    test('GAME protected list is exactly [IGDB]', () => {
        expect(getProtectedLinkTypes(ArtifactType.GAME)).toEqual([LinkType.IGDB]);
    });

    test('MOVIE protected list is exactly [TMDB]', () => {
        expect(getProtectedLinkTypes(ArtifactType.MOVIE)).toEqual([LinkType.TMDB]);
    });

    test('TVSHOW protected list is exactly [TMDB]', () => {
        expect(getProtectedLinkTypes(ArtifactType.TVSHOW)).toEqual([LinkType.TMDB]);
    });

    test('ANIME protected list is exactly [MAL]', () => {
        expect(getProtectedLinkTypes(ArtifactType.ANIME)).toEqual([LinkType.MAL]);
    });

    test('MANGA protected list is exactly {MAL, MANGABAKA}', () => {
        const protectedTypes = getProtectedLinkTypes(ArtifactType.MANGA);
        expect(protectedTypes).toHaveLength(2);
        expect(protectedTypes).toContain(LinkType.MAL);
        expect(protectedTypes).toContain(LinkType.MANGABAKA);
    });
});

describe('isLinkTypeRemovable', () => {
    test('protected primary links are NOT removable', () => {
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.IGDB)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.MOVIE, LinkType.TMDB)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.TVSHOW, LinkType.TMDB)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.ANIME, LinkType.MAL)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.MANGA, LinkType.MAL)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.MANGA, LinkType.MANGABAKA)).toBe(false);
    });

    test('valid non-protected links ARE removable', () => {
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.STEAM)).toBe(true);
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.HLTB)).toBe(true);
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.METACRITIC)).toBe(true);
        expect(isLinkTypeRemovable(ArtifactType.MOVIE, LinkType.SENSCRITIQUE)).toBe(true);
        expect(isLinkTypeRemovable(ArtifactType.MOVIE, LinkType.LETTERBOXD)).toBe(true);
        expect(isLinkTypeRemovable(ArtifactType.ANIME, LinkType.SENSCRITIQUE)).toBe(true);
        expect(isLinkTypeRemovable(ArtifactType.MANGA, LinkType.SENSCRITIQUE)).toBe(true);
    });

    test('a link type not valid for the artifact type is not removable', () => {
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.MAL)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.TMDB)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.GAME, LinkType.MANGABAKA)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.MOVIE, LinkType.IGDB)).toBe(false);
        expect(isLinkTypeRemovable(ArtifactType.MOVIE, LinkType.STEAM)).toBe(false);
    });
});
