import { Artifact, ArtifactType } from "#lib/model/Artifact";
import { UserListOrder } from "#lib/model/UserList";
import { UserArtifactStatus } from "#lib/model/UserArtifact";
import type { Game } from "#lib/model/game/Game";

const currentYear = new Date().getFullYear();
const maxReleaseYear = currentYear + 1;

const CONSUMPTION_DATE_MIN = 1970;
const ANIME_RELEASE_DATE_MIN = 1917;
const MANGA_RELEASE_DATE_MIN = 1900;
const GAME_RELEASE_DATE_MIN = 1970;
const GAME_RELEASE_DATE_MAX = maxReleaseYear;
const MOVIE_RELEASE_DATE_MIN = 1895;
const MOVIE_RELEASE_DATE_MAX = maxReleaseYear;
const TVSHOW_RELEASE_DATE_MIN = 1930;
const TVSHOW_RELEASE_DATE_MAX = maxReleaseYear;
const GAME_MAX_DURATION = 200;
const MOVIE_MAX_DURATION = 240;
const TVSHOW_MAX_DURATION = 400;

export type UserListFilters = {
    orderBy: { 
        type: UserListOrder
        direction: 'asc' | 'desc'
    }
    duration: {
        max: number
        absoluteMax: number
        unit: 'hours' | 'minutes'
    }
    genres: {
        included: number[]
        excluded: number[]
    }
    platforms?: {
        included: number[]
    }
    rating: {
        min: number
    }
    score: {
        min: number
        max: number
    }
    status: {
        included: UserArtifactStatus[]
    }
    releaseDate: {
        min: number
        max: number
        absoluteMin: number
        absoluteMax: number
    }
    startDate: {
        min: number
        max: number
        absoluteMin: number
        absoluteMax: number
    }
    endDate: {
        min: number
        max: number
        absoluteMin: number
        absoluteMax: number
    }
}

export function createUserListFilters(artifactType: ArtifactType): UserListFilters {
    const filters: UserListFilters = {
        orderBy: { 
            type: UserListOrder.DATE_RELEASE,
            direction: 'asc'
        },
        duration: {
            max: 0,
            absoluteMax: 0,
            unit: 'hours'
        },
        genres: {
            included: [],
            excluded: []
        },
        rating: {
            min: 0
        },
        score: {
            min: 0,
            max: 100
        },
        status: {
            included: []
        },
        releaseDate: {
            min: 0,
            max: 0,
            absoluteMin: 0,
            absoluteMax: 0
        },
        startDate: {
            min: CONSUMPTION_DATE_MIN,
            max: currentYear,
            absoluteMin: CONSUMPTION_DATE_MIN,
            absoluteMax: currentYear
        },
        endDate: {
            min: CONSUMPTION_DATE_MIN,
            max: currentYear,
            absoluteMin: CONSUMPTION_DATE_MIN,
            absoluteMax: currentYear
        }
    }
    if (artifactType === ArtifactType.ANIME) {
        filters.releaseDate.min = ANIME_RELEASE_DATE_MIN;
        filters.releaseDate.max = maxReleaseYear;
        filters.releaseDate.absoluteMin = ANIME_RELEASE_DATE_MIN;
        filters.releaseDate.absoluteMax = maxReleaseYear;
    } else if (artifactType === ArtifactType.MANGA) {
        filters.releaseDate.min = MANGA_RELEASE_DATE_MIN;
        filters.releaseDate.max = maxReleaseYear;
        filters.releaseDate.absoluteMin = MANGA_RELEASE_DATE_MIN;
        filters.releaseDate.absoluteMax = maxReleaseYear;
    } else if (artifactType === ArtifactType.GAME) {
        filters.duration.max = GAME_MAX_DURATION;
        filters.duration.absoluteMax = GAME_MAX_DURATION;
        filters.duration.unit = 'hours';
        filters.releaseDate.min = GAME_RELEASE_DATE_MIN;
        filters.releaseDate.max = GAME_RELEASE_DATE_MAX;
        filters.releaseDate.absoluteMin = GAME_RELEASE_DATE_MIN;
        filters.releaseDate.absoluteMax = GAME_RELEASE_DATE_MAX;
        filters.platforms = {
            included: []
        };
    } else if (artifactType === ArtifactType.MOVIE) {
        filters.duration.max = MOVIE_MAX_DURATION;
        filters.duration.absoluteMax = MOVIE_MAX_DURATION;
        filters.duration.unit = 'minutes';
        filters.releaseDate.min = MOVIE_RELEASE_DATE_MIN;
        filters.releaseDate.max = MOVIE_RELEASE_DATE_MAX;
        filters.releaseDate.absoluteMin = MOVIE_RELEASE_DATE_MIN;
        filters.releaseDate.absoluteMax = MOVIE_RELEASE_DATE_MAX;
    } else if (artifactType === ArtifactType.TVSHOW) {
        filters.duration.max = TVSHOW_MAX_DURATION;
        filters.duration.absoluteMax = TVSHOW_MAX_DURATION;
        filters.duration.unit = 'hours';
        filters.releaseDate.min = TVSHOW_RELEASE_DATE_MIN;
        filters.releaseDate.max = TVSHOW_RELEASE_DATE_MAX;
        filters.releaseDate.absoluteMin = TVSHOW_RELEASE_DATE_MIN;
        filters.releaseDate.absoluteMax = TVSHOW_RELEASE_DATE_MAX;
    }
    return filters;
}

const STATUS_ORDER: Record<UserArtifactStatus, number> = {
    [UserArtifactStatus.WISHLIST]: 0,
    [UserArtifactStatus.ON_GOING]: 1,
    [UserArtifactStatus.ON_HOLD]: 2,
    [UserArtifactStatus.DROPPED]: 3,
    [UserArtifactStatus.FINISHED]: 4
};

function getSortKey(artifact: Artifact, type: UserListOrder): number | string | null {
    switch (type) {
        case UserListOrder.TITLE:
            return artifact.title;
        case UserListOrder.SCORE:
            return artifact.userInfo?.score ?? null;
        case UserListOrder.STATUS:
            return artifact.userInfo?.status != null ? STATUS_ORDER[artifact.userInfo.status] : null;
        case UserListOrder.DATE_RELEASE:
            return artifact.releaseDate ? artifact.releaseDate.getTime() : null;
        case UserListOrder.DATE_START:
            return artifact.userInfo?.startDate ? artifact.userInfo.startDate.getTime() : null;
        case UserListOrder.DATE_END:
            return artifact.userInfo?.endDate ? artifact.userInfo.endDate.getTime() : null;
    }
}

export function filterUserListItems(items: Artifact[], artifactType: ArtifactType, filters: UserListFilters) {
    items = [...items];
    const { type, direction } = filters.orderBy;
    items.sort((a, b) => {
        const keyA = getSortKey(a, type);
        const keyB = getSortKey(b, type);
        if (keyA === null && keyB === null) {
            return a.id - b.id;
        }
        if (keyA === null) {
            return 1;
        }
        if (keyB === null) {
            return -1;
        }
        let comparison: number;
        if (typeof keyA === 'string' && typeof keyB === 'string') {
            comparison = keyA.localeCompare(keyB);
        } else {
            comparison = (keyA as number) - (keyB as number);
        }
        if (comparison === 0) {
            return a.id - b.id;
        }
        return direction === 'asc' ? comparison : -comparison;
    });
    if (filters.genres.included.length > 0) {
        items = items.filter((item) => {
            return item.genres.some((genre) => {
                return filters.genres.included.includes(genre.id);
            });
        });
    }
    if (filters.genres.excluded.length > 0) {
        items = items.filter((item) => {
            return !item.genres.some((genre) => {
                return filters.genres.excluded.includes(genre.id);
            });
        });
    }
    if (filters.releaseDate.min > filters.releaseDate.absoluteMin
        || filters.releaseDate.max < filters.releaseDate.absoluteMax) {
        const noUpperBound = filters.releaseDate.max >= filters.releaseDate.absoluteMax;
        items = items.filter((item) => {
            const artifactYearString = item.releaseDate;
            let artifactYear: number | null = null;
            if (artifactYearString) {
                artifactYear = new Date(artifactYearString).getFullYear();
            }
            return (
                artifactYear == null ||
                (artifactYear >= filters.releaseDate.min &&
                (noUpperBound || artifactYear <= filters.releaseDate.max))
            );
        });
    }
    if (filters.duration.max < filters.duration.absoluteMax) {
        let maxDurationInSeconds: number;
        if (artifactType === ArtifactType.GAME || artifactType === ArtifactType.TVSHOW) {
            maxDurationInSeconds = filters.duration.max * 3600;
        } else if (artifactType === ArtifactType.MOVIE) {
            maxDurationInSeconds = filters.duration.max * 60;
        }
        items = items.filter((item) => {
            return item.duration <= maxDurationInSeconds;
        });
    }
    if (artifactType === ArtifactType.GAME && filters.platforms && filters.platforms.included.length > 0) {
        items = items.filter((item) => {
            return (item as Game).platforms.some((platform) => {
                return filters.platforms?.included.includes(platform.id);
            });
        });
    }
    if (filters.rating.min > 0) {
        items = items.filter((item) => {
            const meanRating = item.meanRating;
            return meanRating === null || meanRating >= filters.rating.min;
        });
    }
    if (filters.score.min > 0 || filters.score.max < 100) {
        items = items.filter((item) => {
            const score = item.userInfo?.score;
            return score != null && score >= filters.score.min && score <= filters.score.max;
        });
    }
    if (filters.status.included.length > 0) {
        items = items.filter((item) => {
            const status = item.userInfo?.status;
            return status != null && filters.status.included.includes(status);
        });
    }
    if (filters.startDate.min > filters.startDate.absoluteMin
        || filters.startDate.max < filters.startDate.absoluteMax) {
        items = items.filter((item) => {
            const startDate = item.userInfo?.startDate;
            if (!startDate) {
                return false;
            }
            const year = startDate.getFullYear();
            return year >= filters.startDate.min && year <= filters.startDate.max;
        });
    }
    if (filters.endDate.min > filters.endDate.absoluteMin
        || filters.endDate.max < filters.endDate.absoluteMax) {
        items = items.filter((item) => {
            const endDate = item.userInfo?.endDate;
            if (!endDate) {
                return false;
            }
            const year = endDate.getFullYear();
            return year >= filters.endDate.min && year <= filters.endDate.max;
        });
    }
    return items;
}