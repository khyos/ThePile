import { describe, expect, it, test } from 'vitest';
import { Rating, RatingType, SERIALIZE_TYPE, getRatingColor, getMeanRatingColor, getRatingTypeLabel, type IRating } from './Rating';
import { ArtifactType } from './Artifact';

describe('Rating', () => {
    test('should create a rating with correct initial values', () => {
        const rating = new Rating(RatingType.METACRITIC, 85);
        
        expect(rating.type).toBe(RatingType.METACRITIC);
        expect(rating.rating).toBe(85);
    });

    test('should serialize to JSON', () => {
        const rating = new Rating(RatingType.METACRITIC, 85);
        const json = rating.toJSON();

        expect(json).toEqual({
            __type: SERIALIZE_TYPE,
            type: RatingType.METACRITIC,
            rating: 85
        });
    });

    test('should deserialize from JSON', () => {
        const json = {
            __type: SERIALIZE_TYPE,
            type: RatingType.METACRITIC,
            rating: 85
        };

        const rating = Rating.fromJSON(json);

        expect(rating).toBeInstanceOf(Rating);
        expect(rating.type).toBe(RatingType.METACRITIC);
        expect(rating.rating).toBe(85);
    });

    test('should throw error when deserializing invalid type', () => {
        const json = {
            __type: 'InvalidType',
            type: RatingType.METACRITIC,
            rating: 85
        };

        expect(() => Rating.fromJSON(json as IRating)).toThrow('Invalid Type');
    });
});

describe('getRatingColor', () => {
    test('should return correct colors for MAL ratings', () => {
        expect(getRatingColor(ArtifactType.ANIME, RatingType.MAL, 90)).toBe('green');
        expect(getRatingColor(ArtifactType.ANIME, RatingType.MAL, 80)).toBe('indigo');
        expect(getRatingColor(ArtifactType.ANIME, RatingType.MAL, 70)).toBe('gray');
        expect(getRatingColor(ArtifactType.ANIME, RatingType.MAL, 60)).toBe('red');
    });

    test('should return correct colors for SensCritique ratings', () => {
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.SENSCRITIQUE, 80)).toBe('green');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.SENSCRITIQUE, 72)).toBe('indigo');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.SENSCRITIQUE, 65)).toBe('gray');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.SENSCRITIQUE, 55)).toBe('red');
    });

    test('should return correct colors for Steam ratings', () => {
        expect(getRatingColor(ArtifactType.GAME, RatingType.STEAM, 96)).toBe('green');
        expect(getRatingColor(ArtifactType.GAME, RatingType.STEAM, 92)).toBe('indigo');
        expect(getRatingColor(ArtifactType.GAME, RatingType.STEAM, 87)).toBe('gray');
        expect(getRatingColor(ArtifactType.GAME, RatingType.STEAM, 80)).toBe('red');
    });

    test('should return correct colors for other rating types', () => {
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.METACRITIC, 95)).toBe('green');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.METACRITIC, 85)).toBe('indigo');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.METACRITIC, 75)).toBe('gray');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.METACRITIC, 65)).toBe('red');
    });
});

describe('getMeanRatingColor', () => {
    test('should return correct colors for mean ratings', () => {
        expect(getMeanRatingColor(95)).toBe('green');
        expect(getMeanRatingColor(85)).toBe('indigo');
        expect(getMeanRatingColor(75)).toBe('gray');
        expect(getMeanRatingColor(65)).toBe('red');
    });
});

// --- Standards tests (implementation-specific) ---

describe('getRatingTypeLabel', () => {
    it('returns a non-empty string for every RatingType enum member', () => {
        for (const type of Object.values(RatingType)) {
            const label = getRatingTypeLabel(type);
            expect(label, `expected non-empty label for RatingType.${type}`).not.toBe('');
        }
    });

    it('returns "Letterboxd" for LETTERBOXD', () => {
        expect(getRatingTypeLabel(RatingType.LETTERBOXD)).toBe('Letterboxd');
    });

    it('returns "MyAnimeList" for MAL', () => {
        expect(getRatingTypeLabel(RatingType.MAL)).toBe('MyAnimeList');
    });

    it('returns empty string for an unknown type (default branch)', () => {
        expect(getRatingTypeLabel('UNKNOWN' as RatingType)).toBe('');
    });
});

describe('getRatingColor — LETTERBOXD thresholds', () => {
    // LETTERBOXD falls into the same case-fall-through as METACRITIC/OPENCRITIC/RT
    // thresholds: ≥90 green, ≥80 indigo, ≥70 gray, else red

    it('returns "green" at the 90 boundary and above', () => {
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 90)).toBe('green');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 100)).toBe('green');
    });

    it('returns "indigo" for ratings in the [80, 89] range', () => {
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 80)).toBe('indigo');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 89)).toBe('indigo');
    });

    it('returns "gray" for ratings in the [70, 79] range', () => {
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 70)).toBe('gray');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 79)).toBe('gray');
    });

    it('returns "red" for ratings below 70', () => {
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 69)).toBe('red');
        expect(getRatingColor(ArtifactType.MOVIE, RatingType.LETTERBOXD, 0)).toBe('red');
    });
});

/**
 * Contract tests for getRatingTypeLabel(ratingType: RatingType): string
 *
 * Contract: maps each RatingType enum member to a human-readable label string.
 * Returns '' for unknown / unrecognised values.
 */
describe('getRatingTypeLabel', () => {
    test('LETTERBOXD maps to "Letterboxd"', () => {
        expect(getRatingTypeLabel(RatingType.LETTERBOXD)).toBe('Letterboxd');
    });

    test('MAL maps to "MyAnimeList"', () => {
        expect(getRatingTypeLabel(RatingType.MAL)).toBe('MyAnimeList');
    });

    test('METACRITIC maps to "Metacritic"', () => {
        expect(getRatingTypeLabel(RatingType.METACRITIC)).toBe('Metacritic');
    });

    test('OPENCRITIC maps to "OpenCritic"', () => {
        expect(getRatingTypeLabel(RatingType.OPENCRITIC)).toBe('OpenCritic');
    });

    test('ROTTEN_TOMATOES_AUDIENCE maps to "Rotten Tomatoes Audience"', () => {
        expect(getRatingTypeLabel(RatingType.ROTTEN_TOMATOES_AUDIENCE)).toBe('Rotten Tomatoes Audience');
    });

    test('ROTTEN_TOMATOES_CRITICS maps to "Rotten Tomatoes Critics"', () => {
        expect(getRatingTypeLabel(RatingType.ROTTEN_TOMATOES_CRITICS)).toBe('Rotten Tomatoes Critics');
    });

    test('SENSCRITIQUE maps to "SensCritique"', () => {
        expect(getRatingTypeLabel(RatingType.SENSCRITIQUE)).toBe('SensCritique');
    });

    test('STEAM maps to "Steam"', () => {
        expect(getRatingTypeLabel(RatingType.STEAM)).toBe('Steam');
    });

    test('unknown value returns empty string', () => {
        expect(getRatingTypeLabel('UNKNOWN' as RatingType)).toBe('');
    });
});